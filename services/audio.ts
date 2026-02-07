import { Modality, GenerateContentResponse } from "@google/genai";
import { getAIClient, callWithRetry } from "./client";
import { findGlobalAudio, saveGlobalAudio } from "./supabase";

// --- Audio System ---

let audioContext: AudioContext | null = null;

// Cache for DECODED audio buffers (Instant playback)
const bufferCache = new Map<string, AudioBuffer>();
// Cache for pending promises (Prevent duplicate API calls)
const pendingRequests = new Map<string, Promise<AudioBuffer>>();
// Cache for strings (Base64 or URL) to prevent re-lookup
const stringCache = new Map<string, string>();

function getAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    return audioContext;
}

async function decodePCMToAudioBuffer(
    arrayBuffer: ArrayBuffer,
    ctx: AudioContext,
    sampleRate: number = 24000
): Promise<AudioBuffer> {
    if (arrayBuffer.byteLength === 0) {
        throw new Error("Audio buffer is empty");
    }

    let bufferToUse = arrayBuffer;

    try {
        // Try native browser decoding first (works for MP3/WAV/Ogg from URL)
        const tempBuffer = arrayBuffer.slice(0);
        return await ctx.decodeAudioData(tempBuffer);
    } catch (e) {
        // If native decode fails, assume it's Gemini Raw PCM Int16
        if (arrayBuffer.byteLength % 2 !== 0) {
            bufferToUse = arrayBuffer.slice(0, arrayBuffer.byteLength - 1);
        }

        const dataInt16 = new Int16Array(bufferToUse);
        const float32 = new Float32Array(dataInt16.length);

        for (let i = 0; i < dataInt16.length; i++) {
            float32[i] = dataInt16[i] / 32768.0;
        }

        const audioBuffer = ctx.createBuffer(1, float32.length, sampleRate);
        audioBuffer.copyToChannel(float32, 0);
        return audioBuffer;
    }
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64.replace(/\s/g, ''));
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

// Helper to generate a unique hash for long strings
const simpleHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
    }
    return "h" + hash.toString();
};

/**
 * Core function to load audio from any source (Cache -> URL -> Base64 -> GenAI)
 * Returns a decoded AudioBuffer ready for instant playback.
 */
export const loadAudio = async (text: string, source?: string): Promise<AudioBuffer> => {
    // 1. Check Memory Cache (Fastest)
    if (bufferCache.has(text)) {
        console.log(`[Audio] ⚡ Memory Cache HIT: "${text.substring(0, 20)}..."`);
        return bufferCache.get(text)!;
    }

    // 2. Check Pending Requests (Deduplication)
    if (pendingRequests.has(text)) {
        console.log(`[Audio] ⏳ Pending Request JOIN: "${text.substring(0, 20)}..."`);
        return pendingRequests.get(text)!;
    }

    const ctx = getAudioContext();

    const promise = (async () => {
        try {
            let arrayBuffer: ArrayBuffer;
            let finalSource = source;

            // 2.5 Always try finding in Global Cache first (even if source provided)
            const cachedUrl = await findGlobalAudio(text);
            if (cachedUrl) {
                console.log(`[Audio] ☁️ Global DB Cache HIT: "${text.substring(0, 20)}..."`);
                finalSource = cachedUrl;
                stringCache.set(text, cachedUrl);
            } else {
                console.log(`[Audio] 💨 Global DB Cache MISS: "${text.substring(0, 20)}..."`);
                // Use provided source if available
                if (source) {
                    console.log(`[Audio] 📦 Using provided source for: "${text.substring(0, 20)}..."`);
                    // Try to save provided base64 to global cache for others
                    if (source.length > 100 && !source.startsWith('http')) {
                        console.log(`[Audio] 📤 Saving provided audio to Global Cache...`);
                        saveGlobalAudio(text, source).then(url => {
                            if (url) {
                                console.log(`[Audio] 💾 Saved to Global Cache: "${text.substring(0, 20)}..."`);
                                stringCache.set(text, url);
                            }
                        });
                    }
                }
            }

            // 3. Determine Source Processing
            if (finalSource && finalSource.startsWith('http')) {
                const response = await fetch(finalSource, { mode: 'cors' });
                if (!response.ok) throw new Error(`Failed to fetch audio: ${response.statusText}`);
                arrayBuffer = await response.arrayBuffer();
            } else if (finalSource && finalSource.length > 100) {
                const cleanBase64 = finalSource.includes(',') ? finalSource.split(',')[1] : finalSource;
                arrayBuffer = base64ToArrayBuffer(cleanBase64);
                stringCache.set(text, finalSource);
            } else if (source && source.length > 100) {
                // Use provided source (base64)
                const cleanBase64 = source.includes(',') ? source.split(',')[1] : source;
                arrayBuffer = base64ToArrayBuffer(cleanBase64);
                stringCache.set(text, source);
            } else if (stringCache.has(text)) {
                const cached = stringCache.get(text)!;
                if (cached.startsWith('http')) {
                    const response = await fetch(cached, { mode: 'cors' });
                    arrayBuffer = await response.arrayBuffer();
                } else {
                    const cleanBase64 = cached.includes(',') ? cached.split(',')[1] : cached;
                    arrayBuffer = base64ToArrayBuffer(cleanBase64);
                }
            } else {
                // 4. Generate via AI (Slowest)
                console.log(`[Audio] 🤖 Generating AI Audio for: "${text.substring(0, 20)}..."`);
                const generatedBase64 = await generateAudio(text);

                // Fire and forget: Save to global cache for future users
                saveGlobalAudio(text, generatedBase64).then(url => {
                    if (url) {
                        console.log(`[Audio] 💾 Saved to Global Cache: "${text.substring(0, 20)}..."`);
                        stringCache.set(text, url);
                    }
                });

                arrayBuffer = base64ToArrayBuffer(generatedBase64);
                stringCache.set(text, generatedBase64);
            }

            // 5. Decode
            const audioBuffer = await decodePCMToAudioBuffer(arrayBuffer, ctx, 24000);

            // 6. Cache Result
            bufferCache.set(text, audioBuffer);
            return audioBuffer;

        } catch (error) {
            console.error(`Error loading audio for "${text}":`, error);
            throw error;
        } finally {
            pendingRequests.delete(text);
        }
    })();

    pendingRequests.set(text, promise);
    return promise;
};

export const playAudio = async (textOrSource: string, rate: number = 1.0) => {
    console.log(`🔊🔊🔊 [NEW AUDIO CODE] playAudio called! Text: "${textOrSource.substring(0, 30)}...", Rate: ${rate}`);

    // Determine if input is base64 or plain text
    // Base64 audio is typically very long (>500 chars) and doesn't contain spaces
    const isBase64 = textOrSource.length > 500 && !textOrSource.includes(' ') && !textOrSource.startsWith('http');

    // For regular text (sentences, words) - use text directly as key
    // For base64 - use hash as key to prevent memory issues
    const key = isBase64 ? simpleHash(textOrSource) : textOrSource;
    const source = isBase64 ? textOrSource : undefined;

    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') await ctx.resume();

        const audioBuffer = await loadAudio(key, source);

        const sourceNode = ctx.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.playbackRate.value = rate;
        sourceNode.connect(ctx.destination);
        sourceNode.start(0);

    } catch (e) {
        console.error("[Audio] Playback failed:", e);
    }
};

export const preloadAudio = (text: string, source?: string) => {
    loadAudio(text, source).catch(e => console.debug("Preload failed (non-fatal):", e));
};

/**
 * Retrieve the Audio source (URL preferred, or Base64) for DB saving.
 */
export const getOrGenerateAudio = async (text: string, cachedSource?: string): Promise<string> => {
    if (cachedSource && cachedSource.length > 50) return cachedSource;

    if (stringCache.has(text)) return stringCache.get(text)!;

    const globalUrl = await findGlobalAudio(text);
    if (globalUrl) {
        stringCache.set(text, globalUrl);
        return globalUrl;
    }

    const audioBase64 = await generateAudio(text);
    const savedUrl = await saveGlobalAudio(text, audioBase64);

    const result = savedUrl || audioBase64;
    stringCache.set(text, result);
    return result;
};

export const generateAudio = async (text: string, mode: 'card' | 'story' = 'card'): Promise<string> => {
    const apiKey = process.env.ELEVEN_LABS_API_KEY;
    if (!apiKey) {
        throw new Error("Eleven Labs API key not found. Set ELEVEN_LABS_API_KEY in .env.local");
    }

    // Voice ID for European Portuguese - using "Antoni" (clear male voice, good for learning)
    // Alternative voices: "Rachel" (female), or custom voice IDs
    const voiceId = "zKjRewuiqTkXNUVAMwat"; // "Antoni" - multilingual voice

    // Adjust settings based on mode
    const stability = mode === 'story' ? 0.5 : 0.75; // More expressive for stories
    const similarityBoost = 0.75;
    const speed = mode === 'story' ? 1.0 : 0.9; // Slightly slower for learning

    console.log(`[Eleven Labs] 🎙️ Generating audio for: "${text.substring(0, 30)}..."`)

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': apiKey,
        },
        body: JSON.stringify({
            text: text,
            model_id: 'eleven_multilingual_v2', // Supports European Portuguese
            voice_settings: {
                stability: stability,
                similarity_boost: similarityBoost,
                style: 0.0,
                use_speaker_boost: true,
                speed: speed
            }
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Eleven Labs] ❌ Error:`, errorText);
        throw new Error(`Eleven Labs API error: ${response.status} - ${errorText}`);
    }

    // Convert response to base64
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
    }
    const base64Audio = btoa(binary);

    console.log(`[Eleven Labs] ✅ Audio generated successfully (${Math.round(arrayBuffer.byteLength / 1024)}KB)`);

    return base64Audio;
};
