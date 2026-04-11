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

    const apiKey = readApiKey();
    if (!apiKey) {
        res.status(500).json({
            error: '[server] Missing SPEECH_API_KEY or GOOGLE_CLOUD_API_KEY',
        });
        return;
    }

    try {
        const body: ReqBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const audioContent = body?.audio?.content;

        if (!audioContent) {
            res.status(400).json({ error: 'Invalid request body: audio.content is required' });
            return;
        }

        const response = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`, {
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
                audio: {
                    content: audioContent,
                },
            }),
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok) {
            const message = payload?.error?.message || 'Speech recognition failed';
            res.status(response.status).json({ error: message });
            return;
        }

        const result = payload?.results?.[0]?.alternatives?.[0];
        const data: SpeechResult = {
            transcript: result?.transcript || '',
            confidence: result?.confidence || 0,
            words: Array.isArray(result?.words)
                ? result.words.map((word: any) => ({
                    word: word.word,
                    confidence: word.confidence || 0,
                }))
                : [],
        };

        res.status(200).json(data);
    } catch (error: any) {
        const status = error?.status || 500;
        const message = error?.message || 'Speech proxy request failed';
        res.status(status).json({ error: message });
    }
}
