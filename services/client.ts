import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env";
import { logger } from "../lib/logger";

export const getAIClient = () => {
    return new GoogleGenAI({ apiKey: env.geminiApiKey });
};

// Retry Logic for Rate Limiting (429)
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
