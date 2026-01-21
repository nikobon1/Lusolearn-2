import { GoogleGenAI } from "@google/genai";

export const getAIClient = () => {
    // Try multiple possible env var names for compatibility
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) throw new Error("API Key not found. Set GEMINI_API_KEY in .env.local");
    return new GoogleGenAI({ apiKey });
};

// Retry Logic for Rate Limiting (429)
export async function callWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
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
