import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { AICardDetails, VocabularyItem, Example, Flashcard, Folder } from "../types";
import { findGlobalAudio, saveGlobalAudio, findGlobalImage, saveGlobalImage } from "./supabase";

const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");
  return new GoogleGenAI({ apiKey });
};

// --- Helper: Retry Logic for Rate Limiting (429) ---
async function callWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isRateLimit = error?.status === 429 || 
                        error?.code === 429 ||
                        (error?.message && (
                            error.message.includes('429') || 
                            error.message.includes('quota') || 
                            error.message.includes('exhausted')
                        ));
    
    if (retries > 0 && isRateLimit) {
      console.warn(`Rate limit hit (429). Retrying in ${delay}ms... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

// --- Audio System Optimized ---

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
  // Heuristic: Raw PCM from Gemini usually needs int16 conversion. 
  // Standard MP3 files (from URL) should use decodeAudioData.
  // We'll try decodeAudioData first if it looks like a file, otherwise manual PCM.
  
  try {
      // Try native browser decoding first (works for MP3/WAV/Ogg from URL)
      // We clone the buffer because decodeAudioData detaches it
      const tempBuffer = arrayBuffer.slice(0); 
      return await ctx.decodeAudioData(tempBuffer);
  } catch (e) {
      // If native decode fails, assume it's Gemini Raw PCM Int16
      // console.log("Native decode failed, trying PCM...", e);
      
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

// Helper to generate a unique hash for long strings to prevent cache collisions
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

            // 2.5 If no source provided, try finding it in Global Cache first
            if (!finalSource) {
                // Try DB lookup
                const cachedUrl = await findGlobalAudio(text);
                if (cachedUrl) {
                    console.log(`[Audio] ☁️ Global DB Cache HIT: "${text.substring(0, 20)}..."`);
                    finalSource = cachedUrl;
                    stringCache.set(text, cachedUrl); // Remember this is a URL
                } else {
                    console.log(`[Audio] 💨 Global DB Cache MISS: "${text.substring(0, 20)}..."`);
                }
            } else {
                console.log(`[Audio] 📦 Source provided for: "${text.substring(0, 20)}..."`);
            }

            // 3. Determine Source Processing
            if (finalSource && finalSource.startsWith('http')) {
                // URL (Global Cache or User Storage)
                const response = await fetch(finalSource, { mode: 'cors' });
                if (!response.ok) throw new Error(`Failed to fetch audio: ${response.statusText}`);
                arrayBuffer = await response.arrayBuffer();
            } else if (finalSource && finalSource.length > 100) {
                // Explicit Base64 passed in
                const cleanBase64 = finalSource.includes(',') ? finalSource.split(',')[1] : finalSource;
                arrayBuffer = base64ToArrayBuffer(cleanBase64);
                stringCache.set(text, finalSource); 
            } else if (stringCache.has(text)) {
                // Found in runtime string cache
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
                // Not found in Global Cache, not passed as arg. Must generate.
                console.log(`[Audio] 🤖 Generating AI Audio for: "${text.substring(0, 20)}..."`);
                const generatedBase64 = await generateAudio(text);
                
                // Fire and forget: Save to global cache for future users
                saveGlobalAudio(text, generatedBase64).then(url => {
                    if (url) {
                        console.log(`[Audio] 💾 Saved to Global Cache: "${text.substring(0, 20)}..."`);
                        stringCache.set(text, url); // Update cache to use URL next time
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
  // BUG FIX: Previously truncated to 20 chars, causing collision for Base64 strings with identical headers.
  // Now using a hash for long strings to ensure uniqueness.
  const key = textOrSource.length > 50 ? simpleHash(textOrSource) : textOrSource;
  const source = textOrSource.length > 50 ? textOrSource : undefined;

  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();

    // Load (or get from cache)
    const audioBuffer = await loadAudio(key, source);

    // Play
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
 * Logic:
 * 1. Check runtime cache.
 * 2. Check Global DB Cache.
 * 3. Generate -> Save Global -> Return URL.
 */
export const getOrGenerateAudio = async (text: string, cachedSource?: string): Promise<string> => {
  // 1. Use provided source if valid
  if (cachedSource && cachedSource.length > 50) return cachedSource;
  
  // 2. Check runtime cache
  if (stringCache.has(text)) return stringCache.get(text)!;
  
  // 3. Check Global DB
  const globalUrl = await findGlobalAudio(text);
  if (globalUrl) {
      stringCache.set(text, globalUrl);
      return globalUrl;
  }

  // 4. Generate New
  const audioBase64 = await generateAudio(text);
  
  // 5. Save Global and return the URL if save successful, otherwise return base64
  const savedUrl = await saveGlobalAudio(text, audioBase64);
  
  const result = savedUrl || audioBase64;
  stringCache.set(text, result);
  return result;
};

export const generateAudio = async (text: string, mode: 'card' | 'story' = 'card'): Promise<string> => {
  const ai = getAIClient();
  
  const speedInstruction = mode === 'story' 
    ? "Speak with an engaging storytelling tone. Speak in a fast, authentic, conversational European Portuguese accent (pt-PT)." 
    : "Speak in a fast, authentic, conversational European Portuguese accent (pt-PT).";

  const prompt = `
    ${speedInstruction}
    
    Text to speak: "${text}"
  `;

  const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' }, 
        },
      },
    },
  }));

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("Failed to generate audio");
  return base64Audio;
};

// Orchestrator for Images: Cache -> GenAI -> Save -> Return
export const getOrGenerateImage = async (prompt: string, word: string): Promise<string> => {
    // 1. Check Global Cache first
    const cachedUrl = await findGlobalImage(word);
    if (cachedUrl) {
        console.log(`[Image] ☁️ Global Cache HIT: "${word}"`);
        return cachedUrl;
    }

    console.log(`[Image] 💨 Global Cache MISS: "${word}"`);
    
    // 2. Generate
    console.log(`[Image] 🤖 Generating AI Image for: "${word}"`);
    const base64Image = await generateImage(prompt);
    
    // 3. Save to Global Cache (async)
    // Use a promise to save, but we will return the URL if possible to save User Storage
    const savedUrl = await saveGlobalImage(word, base64Image);
    
    if (savedUrl) {
        console.log(`[Image] 💾 Saved to Global Cache: "${word}"`);
        return savedUrl;
    }

    return `data:image/png;base64,${base64Image}`;
};

export const generateImage = async (prompt: string): Promise<string> => {
  const ai = getAIClient();
  
  // Use gemini-2.5-flash-image for image generation
  const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: { parts: [{ text: prompt }] },
    // Note: responseMimeType is NOT supported for nano banana models, so we don't set it.
  }));

  // Find the image part in the response
  if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.data) {
              return part.inlineData.data;
          }
      }
  }
  
  throw new Error("No image generated");
};

// --- Text Analysis System ---

export const extractVocabulary = async (
  input: string | { imageBase64: string; mimeType: string },
  mode: 'text' | 'image',
  count: number = 5
): Promise<VocabularyItem[]> => {
  const ai = getAIClient();

  const extractionSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        word: { type: Type.STRING, description: "The extracted Portuguese word (lemma/dictionary form). If Noun, include Article." },
        translation: { type: Type.STRING, description: "Russian translation." },
        context: { type: Type.STRING, description: "Краткое объяснение на РУССКОМ языке, почему это слово выделено (контекст)." }
      },
      required: ["word", "translation", "context"]
    }
  };

  const prompt = `
    Analyze the input. Identify exactly ${count} key words/phrases for learning European Portuguese.
    
    RULES:
    1. If NOUN, include definite article (o/a/os/as).
    2. If VERB, provide infinitive.
    3. Context in Russian.

    Return JSON array.
  `;

  let contents;
  if (mode === 'image' && typeof input !== 'string') {
    contents = {
      parts: [
        { inlineData: { mimeType: input.mimeType, data: input.imageBase64 } },
        { text: prompt }
      ]
    };
  } else {
    contents = {
      parts: [{ text: `${prompt}\n\nInput Text: "${input}"` }]
    };
  }

  const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: contents as any,
    config: {
      responseMimeType: "application/json",
      responseSchema: extractionSchema,
    }
  }));

  const text = response.text;
  if (!text) throw new Error("No vocabulary found");
  return JSON.parse(text) as VocabularyItem[];
};

export const generateCardDetails = async (word: string): Promise<AICardDetails> => {
  const ai = getAIClient();

  const verbFormsSchema = {
      type: Type.OBJECT,
      properties: {
          eu: { type: Type.STRING },
          tu: { type: Type.STRING },
          ele: { type: Type.STRING },
          nos: { type: Type.STRING },
          eles: { type: Type.STRING }
      },
      required: ["eu", "tu", "ele", "nos", "eles"]
  };

  const detailSchema = {
    type: Type.OBJECT,
    properties: {
      definition: { type: Type.STRING },
      grammarNotes: { type: Type.STRING },
      visualPrompt: { type: Type.STRING },
      frequency: { 
          type: Type.STRING, 
          enum: ["Top 500", "Top 1000", "Top 3000", "Top 5000", "10000+"]
      },
      conjugation: {
          type: Type.OBJECT,
          properties: {
              isVerb: { type: Type.BOOLEAN },
              tenses: {
                  type: Type.OBJECT,
                  properties: {
                      presente: verbFormsSchema,
                      perfeito: verbFormsSchema,
                      imperfeito: verbFormsSchema,
                      futuro: verbFormsSchema
                  }
              }
          },
          required: ["isVerb"]
      },
      examples: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            level: { type: Type.STRING, enum: ["A1", "A2", "B1", "B2"] },
            sentence: { type: Type.STRING },
            translation: { type: Type.STRING },
            patterns: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        target: { type: Type.STRING },
                        explanation: { type: Type.STRING }
                    },
                    required: ["target", "explanation"]
                }
            }
          },
          required: ["level", "sentence", "translation"]
        }
      }
    },
    required: ["definition", "grammarNotes", "examples", "visualPrompt", "conjugation"]
  };

  const systemInstruction = `
    Create a study card for: "${word}".
    Target: European Portuguese.
    Output Language for explanations: Russian.
    
    Requirements:
    1. Definition in simple PT.
    2. 4 Examples (A1-B2).
    3. Visual prompt for icon.
    4. Grammar notes in Russian.
    5. Frequency rank estimate.
    6. Conjugation if verb (Present, Perf, Imperf, Future).
  `;

  const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: { parts: [{ text: `Generate details for "${word}"` }] } as any,
    config: {
      systemInstruction: systemInstruction,
      responseMimeType: "application/json",
      responseSchema: detailSchema,
    }
  }));

  const text = response.text;
  if (!text) throw new Error("No details generated");
  return JSON.parse(text) as AICardDetails;
};

export const enrichCardPatterns = async (originalTerm: string, examples: Example[]): Promise<Example[]> => {
    // Legacy function to backfill grammar patterns
    const ai = getAIClient();
    const schema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                level: { type: Type.STRING },
                patterns: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            target: { type: Type.STRING },
                            explanation: { type: Type.STRING }
                        },
                        required: ["target", "explanation"]
                    }
                }
            },
            required: ["level", "patterns"]
        }
    };

    const prompt = `Analyze grammar patterns in these sentences for word "${originalTerm}". Explanations in Russian.`;
    const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [{ text: `${prompt}\n${JSON.stringify(examples)}` }] } as any,
        config: { responseMimeType: "application/json", responseSchema: schema }
    }));

    const text = response.text;
    if (!text) return examples;
    const result = JSON.parse(text) as { level: string, patterns: any[] }[];
    return examples.map(ex => {
        const enriched = result.find(r => r.level === ex.level);
        return enriched ? { ...ex, patterns: enriched.patterns } : ex;
    });
};

export interface SmartSortSuggestion {
    action: 'move' | 'create';
    targetFolderId: string;
    suggestedFolderName?: string;
    cardIds: string[];
}

export const suggestSmartSorting = async (cards: Flashcard[], folders: Folder[]): Promise<SmartSortSuggestion[]> => {
    const ai = getAIClient();
    const cardSimplified = cards.map(c => ({ id: c.id, term: c.originalTerm }));
    const folderSimplified = folders.map(f => ({ id: f.id, name: f.name })).filter(f => f.id !== 'default');

    if (cardSimplified.length === 0) return [];

    const schema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                action: { type: Type.STRING, enum: ["move", "create"] },
                targetFolderId: { type: Type.STRING },
                suggestedFolderName: { type: Type.STRING },
                cardIds: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["action", "targetFolderId", "cardIds"]
        }
    };

    const prompt = `Sort these cards into folders. Create new folders (in Russian) if needed for clusters > 1 card.`;
    
    const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [{ text: `${prompt}\nFolders: ${JSON.stringify(folderSimplified)}\nCards: ${JSON.stringify(cardSimplified)}` }] } as any,
        config: { responseMimeType: "application/json", responseSchema: schema }
    }));

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);
};

export const generateStoryFromWords = async (words: string[]): Promise<{ pt: string, ru: string, audioBase64?: string }> => {
    const ai = getAIClient();
    const schema = {
        type: Type.OBJECT,
        properties: {
            pt: { type: Type.STRING },
            ru: { type: Type.STRING }
        },
        required: ["pt", "ru"]
    };

    const prompt = `
        Create a simple European Portuguese story (A2-B1) using: ${words.join(', ')}.
        1-3 sentences. Return PT text and RU translation.
    `;

    const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [{ text: prompt }] } as any,
        config: { responseMimeType: "application/json", responseSchema: schema }
    }));

    const text = response.text;
    if (!text) throw new Error("Failed to generate story");
    return JSON.parse(text);
};