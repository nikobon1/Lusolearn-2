import { GoogleGenAI } from "@google/genai";

type ReqBody = {
    model?: string;
    contents?: unknown;
    config?: unknown;
};

const readInlineData = (response: any): { mimeType?: string; data: string } | null => {
    const candidates = response?.candidates;
    if (!Array.isArray(candidates)) return null;

    for (const candidate of candidates) {
        const parts = candidate?.content?.parts;
        if (!Array.isArray(parts)) continue;
        for (const part of parts) {
            if (part?.inlineData?.data) {
                return {
                    mimeType: part.inlineData.mimeType,
                    data: part.inlineData.data,
                };
            }
        }
    }

    return null;
};

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        res.status(500).json({ error: '[server] Missing GEMINI_API_KEY' });
        return;
    }

    try {
        const body: ReqBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        if (!body?.model || !body?.contents) {
            res.status(400).json({ error: 'Invalid request body: model and contents are required' });
            return;
        }

        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: body.model,
            contents: body.contents as any,
            config: body.config as any,
        });

        const inlineData = readInlineData(response);
        res.status(200).json({
            text: response.text ?? null,
            inlineData,
        });
    } catch (error: any) {
        const status = error?.status || 500;
        const message = error?.message || 'Gemini proxy request failed';
        res.status(status).json({ error: message });
    }
}

