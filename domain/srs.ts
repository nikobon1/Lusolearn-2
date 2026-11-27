import { Difficulty, Flashcard } from '../types';
import { FsrsState, RATING_TO_GRADE, nextFsrs } from './fsrs';

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

export interface ReviewOutcome {
    interval: number;
    nextReviewDate: number;
    easeFactor: number;
    difficulty: Difficulty;
    countsAsSuccess: boolean;
    fsrs?: FsrsState;
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

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
 * FSRS scheduling (see domain/fsrs.ts).
 * - again: back in 10 min in this session; memory stability drops (lapse), interval 0 until relearned
 * - hard / good / easy: next review when predicted recall falls to 90% (with a little fuzz)
 * Successful answers never shorten a review card's interval (the "card came back after «Легко»" guard).
 */
export const getReviewOutcome = (
    card: Flashcard,
    rating: ReviewRating,
    now = Date.now(),
    _random = Math.random
): ReviewOutcome => {
    const ease = clampEase(card.easeFactor || 2.5);
    const { days, state } = nextFsrs(card, RATING_TO_GRADE[rating], now);

    if (rating === 'again') {
        return {
            interval: 0,
            nextReviewDate: now + 10 * MINUTE_MS,
            easeFactor: clampEase(ease - 0.2),
            difficulty: Difficulty.Hard,
            countsAsSuccess: false,
            fsrs: state,
        };
    }

    let interval = Math.max(1, Math.round(days));
    // Relearned in the same session after «Не вспомнил»: trust the (low) stability, not the long-term guess
    if (card.interval === 0 && card.fsrs && now - card.fsrs.last < 86_400_000) {
        interval = Math.max(1, Math.round(state.s));
    }
    if (card.interval > 0 && rating !== 'hard') interval = Math.max(interval, card.interval + (rating === 'easy' ? 2 : 1));
    const difficulty = rating === 'hard' ? Difficulty.Hard : rating === 'easy' ? Difficulty.Easy : Difficulty.Medium;
    const easeFactor = rating === 'hard' ? clampEase(ease - 0.15) : rating === 'easy' ? clampEase(ease + 0.15) : ease;
    return { interval, nextReviewDate: scheduled(interval, now), easeFactor, difficulty, countsAsSuccess: true, fsrs: state };
};
