type SpeechWord = {
    word: string;
    confidence: number;
};

type SpeechResult = {
    transcript: string;
    confidence: number;
    words: SpeechWord[];
};

type ReqBody = {
    /** Recorded format, e.g. "audio/webm;codecs=opus" or "audio/mp4" (iPhone) */
    mimeType?: string;
    audio?: {
        content?: string;
    };
    config?: {
        encoding?: string;
        sampleRateHertz?: number;
        languageCode?: string;
        enableWordConfidence?: boolean;
        model?: string;
    };
};

const GEMINI_MODEL = 'gemini-2.5-flash';
const TRANSCRIBE_PROMPT =
    'Transcribe this short recording of a learner speaking European Portuguese. ' +
    'Write exactly the words that were said, in Portuguese, without correcting mistakes, adding words or translating. ' +
    'Output only the transcript. If no speech can be heard, output nothing.';

/**
 * Fallback recogniser: Gemini understands any audio format (WebM, MP4 from iPhone…)
 * and uses the same key as the rest of the app.
 */
const transcribeWithGemini = async (audioContent: string, mimeType: string): Promise<SpeechResult> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw Object.assign(new Error('[server] Missing GEMINI_API_KEY'), { status: 500 });
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: TRANSCRIBE_PROMPT }, { inlineData: { mimeType: mimeType.split(';')[0], data: audioContent } }] }],
            generationConfig: { temperature: 0, thinkingConfig: { thinkingBudget: 0 } },
        }),
    });
    const payload: any = await response.json().catch(() => null);
    if (!response.ok) {
        throw Object.assign(new Error(payload?.error?.message || 'Gemini transcription failed'), { status: response.status });
    }
    const text = (payload?.candidates?.[0]?.content?.parts || []).map((p: any) => p?.text || '').join('').trim();
    const transcript = text.replace(/^["«“]|["»”]$/g, '').trim();
    return {
        transcript,
        confidence: transcript ? 0.9 : 0,
        words: transcript ? transcript.split(/\s+/).map(word => ({ word, confidence: 0.9 })) : [],
    };
};

const readApiKey = () =>
    process.env.SPEECH_API_KEY ||
    process.env.GOOGLE_CLOUD_API_KEY ||
    process.env.VITE_GOOGLE_CLOUD_API_KEY ||
    '';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const body: ReqBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const audioContent = body?.audio?.content;

        if (!audioContent) {
            res.status(400).json({ error: 'Invalid request body: audio.content is required' });
            return;
        }

        const mimeType = body.mimeType || 'audio/webm';
        const speechKey = readApiKey();
        // Google Speech-to-Text first (WebM/Opus only); on any failure — Gemini
        if (speechKey && /webm|ogg/i.test(mimeType)) {
            const response = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${speechKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    config: {
                        encoding: body.config?.encoding || 'WEBM_OPUS',
                        sampleRateHertz: body.config?.sampleRateHertz || 48000,
                        languageCode: body.config?.languageCode || 'pt-PT',
                        enableWordConfidence: body.config?.enableWordConfidence ?? true,
                        model: body.config?.model || 'default',
                    },
                    audio: { content: audioContent },
                }),
            });

            const payload = await response.json().catch(() => null);
            if (response.ok) {
                const result = payload?.results?.[0]?.alternatives?.[0];
                const data: SpeechResult = {
                    transcript: result?.transcript || '',
                    confidence: result?.confidence || 0,
                    words: Array.isArray(result?.words)
                        ? result.words.map((word: any) => ({ word: word.word, confidence: word.confidence || 0 }))
                        : [],
                };
                res.status(200).json(data);
                return;
            }
            console.warn('[speech] Google Speech-to-Text failed, using Gemini:', response.status, payload?.error?.message);
        }

        res.status(200).json(await transcribeWithGemini(audioContent, mimeType));
    } catch (error: any) {
        const status = error?.status || 500;
        const message = error?.message || 'Speech proxy request failed';
        res.status(status).json({ error: message });
    }
}
