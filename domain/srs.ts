import { Difficulty, Flashcard } from '../types';

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

export interface ReviewOutcome {
    interval: number;
    nextReviewDate: number;
    easeFactor: number;
    difficulty: Difficulty;
    countsAsSuccess: boolean;
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** A forgotten mature card keeps this share of its interval instead of starting over. */
export const LAPSE_INTERVAL_FACTOR = 0.3;
/** Random spread of review intervals so cards added together don't come back on the same day. */
export const FUZZ = 0.05;

const clampEase = (value: number) => Math.min(3, Math.max(1.3, value));

/** ±5% (at least ±1 day for intervals ≥ 7 days); short intervals are left exact. */
export const fuzzInterval = (days: number, random = Math.random): number => {
    if (days < 3) return days;
    const spread = Math.max(1, Math.round(days * FUZZ));
    const delta = Math.round((random() * 2 - 1) * spread);
    return Math.max(2, days + (days >= 7 ? delta : Math.max(-1, Math.min(1, delta))));
};

const scheduled = (interval: number, now: number) => now + interval * DAY_MS;

/**
 * SM-2 style scheduling.
 * - new card: hard → 8 h, good → 1 d, easy → 3 d
 * - review card: hard ×1.2, good ×ease, easy ×ease×1.3 (+ fuzz)
 * - again: back in 10 min; a review card keeps 30% of its interval (lapse) instead of resetting to 0
 */
export const getReviewOutcome = (
    card: Flashcard,
    rating: ReviewRating,
    now = Date.now(),
    random = Math.random
): ReviewOutcome => {
    const ease = clampEase(card.easeFactor || 2.5);

    if (rating === 'again') {
        // Stored so that the next successful review (×ease) lands at ~30% of the old interval:
        // 60 d forgotten → relearn → next "good" ≈ 18 d, instead of starting from 1 d again.
        const newEase = clampEase(ease - 0.2);
        const lapsedInterval = card.interval >= 1
            ? Math.max(1, Math.round((card.interval * LAPSE_INTERVAL_FACTOR) / newEase))
            : 0;
        return {
            interval: lapsedInterval,
            nextReviewDate: now + 10 * MINUTE_MS,
            easeFactor: newEase,
            difficulty: Difficulty.Hard,
            countsAsSuccess: false,
        };
    }

    if (card.interval === 0) {
        if (rating === 'hard') {
            return { interval: 0, nextReviewDate: now + 8 * HOUR_MS, easeFactor: clampEase(ease - 0.05), difficulty: Difficulty.Hard, countsAsSuccess: true };
        }
        if (rating === 'easy') {
            return { interval: 3, nextReviewDate: scheduled(3, now), easeFactor: clampEase(ease + 0.15), difficulty: Difficulty.Easy, countsAsSuccess: true };
        }
        return { interval: 1, nextReviewDate: scheduled(1, now), easeFactor: ease, difficulty: Difficulty.Medium, countsAsSuccess: true };
    }

    let interval: number;
    let easeFactor = ease;
    let difficulty = Difficulty.Medium;
    if (rating === 'hard') {
        interval = Math.max(card.interval + 1, Math.round(card.interval * 1.2));
        easeFactor = clampEase(ease - 0.15);
        difficulty = Difficulty.Hard;
    } else if (rating === 'easy') {
        interval = Math.max(card.interval + 2, Math.round(card.interval * ease * 1.3));
        easeFactor = clampEase(ease + 0.15);
        difficulty = Difficulty.Easy;
    } else {
        interval = Math.max(card.interval + 1, Math.round(card.interval * ease));
    }
    interval = fuzzInterval(interval, random);
    return { interval, nextReviewDate: scheduled(interval, now), easeFactor, difficulty, countsAsSuccess: true };
};
