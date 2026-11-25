import { AICardDetails } from '../types';
import { enforceRussianPatternExplanations, generateCardDetails } from './vocabulary';

export interface WordDetailsResult {
    details: AICardDetails;
    /** Taken from the shared base (no generation needed) */
    cached: boolean;
    /** Stored in the shared base for everyone */
    saved: boolean;
    entryId?: string;
}

/**
 * Card details for a word in a given meaning: from the shared word base (/api/word),
 * generated there once if missing. Falls back to direct generation when the server
 * function isn't available (local dev, older deployment).
 */
export const getWordDetails = async (term: string, translation: string): Promise<WordDetailsResult> => {
    let response: Response | null = null;
    try {
        response = await fetch('/api/word', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ term, translation }),
        });
    } catch {
        response = null;
    }

    if (!response || response.status === 404 || response.status === 405) {
        const details = await generateCardDetails(term);
        return { details, cached: false, saved: false };
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.details) {
        const message = payload?.error || `Word service error (${response.status})`;
        const error = new Error(message) as Error & { status?: number };
        error.status = response.status;
        throw error;
    }

    const details = payload.details as AICardDetails;
    details.examples = await enforceRussianPatternExplanations(details.examples || []);
    return { details, cached: !!payload.cached, saved: !!payload.saved, entryId: payload.entryId };
};
