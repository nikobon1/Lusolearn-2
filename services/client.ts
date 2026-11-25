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


/** True when the AI service is unavailable for account reasons (billing, credits, key) — retrying won't help. */
export const isAiAccountError = (error: unknown): boolean => {
    const err = error as { status?: number; message?: string };
    const msg = (err?.message || '').toLowerCase();
    return err?.status === 401 || err?.status === 402 || err?.status === 403 ||
        msg.includes('prepayment credits') || msg.includes('billing') || msg.includes('api key not valid') ||
        msg.includes('permission_denied');
};

/** Human-readable Russian explanation of an AI request failure. */
export const describeAiError = (error: unknown, fallback = 'Не удалось выполнить запрос к ИИ. Попробуйте ещё раз.'): string => {
    const err = error as { status?: number; message?: string };
    const msg = (err?.message || '').toLowerCase();
    if (err?.status === 402 || msg.includes('prepayment credits')) {
        return 'Закончился предоплаченный баланс Gemini. Пополните его в AI Studio (ai.studio/projects → Billing).';
    }
    if (msg.includes('billing') || msg.includes('outstanding balance')) {
        return 'Google заблокировал Gemini из-за проблемы с оплатой. Проверьте биллинг в AI Studio / Google Cloud.';
    }
    if (err?.status === 401 || err?.status === 403 || msg.includes('api key not valid') || msg.includes('missing gemini_api_key')) {
        return 'Нет доступа к Gemini: проверьте ключ GEMINI_API_KEY в настройках Vercel.';
    }
    if (err?.status === 429 || msg.includes('quota') || msg.includes('exhausted')) {
        return 'Превышен лимит запросов к Gemini. Подождите минуту и попробуйте снова.';
    }
    if (err?.status === 503 || msg.includes('overloaded') || msg.includes('unavailable')) {
        return 'Gemini сейчас перегружен. Попробуйте чуть позже.';
    }
    return fallback;
};
