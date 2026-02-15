import { logger } from "../lib/logger";

export interface GeminiGenerateRequest {
    model: string;
    contents: unknown;
    config?: unknown;
}

export interface GeminiGenerateResponse {
    text?: string | null;
    inlineData?: { mimeType?: string; data: string } | null;
}

export const generateContent = async (request: GeminiGenerateRequest): Promise<GeminiGenerateResponse> => {
    const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const message = payload?.error || `Gemini proxy error (${response.status})`;
        const error = new Error(message) as Error & { status?: number; code?: number };
        error.status = response.status;
        throw error;
    }

    return payload as GeminiGenerateResponse;
};

export async function callWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
    try {
        return await fn();
    } catch (error: unknown) {
        const err = error as { status?: number; code?: number; message?: string };
        const isRateLimit = err?.status === 429 ||
            err?.code === 429 ||
            (err?.message && (
                err.message.includes('429') ||
                err.message.includes('quota') ||
                err.message.includes('exhausted')
            ));

        if (retries > 0 && isRateLimit) {
            logger.warn(`Rate limit hit (429). Retrying in ${delay}ms... (${retries} left)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return callWithRetry(fn, retries - 1, delay * 2);
        }
        throw error;
    }
}

