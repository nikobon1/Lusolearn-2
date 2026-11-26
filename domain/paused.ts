import { Flashcard } from '../types';

/**
 * Cards set aside for now (rare words learned long ago: "носорог", chemical elements…).
 * Stored as a tag so it syncs without a schema change. Paused cards keep their progress
 * but never appear in the daily plan, reviews or practice until they are returned.
 */
export const PAUSED_TAG = 'пауза';

export const isPaused = (card: Flashcard) => (card.tags || []).includes(PAUSED_TAG);

export const withPaused = (card: Flashcard, paused: boolean): Flashcard => {
    const rest = (card.tags || []).filter(t => t !== PAUSED_TAG);
    return { ...card, tags: paused ? [...rest, PAUSED_TAG] : rest };
};

export const activeCards = (cards: Flashcard[]) => cards.filter(c => !isPaused(c));
