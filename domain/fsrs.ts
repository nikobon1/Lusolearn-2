import { Card as FsrsCard, Grade, Rating, State, createEmptyCard, fsrs, generatorParameters } from 'ts-fsrs';
import { Flashcard } from '../types';

/**
 * FSRS (Free Spaced Repetition Scheduler): models each word's memory with
 * stability (days until recall drops to 90%) and difficulty (1–10), learned from research on
 * hundreds of millions of reviews. Schedules each word for when you're about to forget it.
 */

/** What we store per card (flashcards.fsrs). */
export interface FsrsState {
    s: number;      // stability, days
    d: number;      // difficulty 1..10
    reps: number;
    lapses: number;
    state: State;
    last: number;   // last review, ms
}

const DAY = 86_400_000;

/** 90% target recall. No minute-level learning steps: forgotten words come back later in the same session. */
export const scheduler = fsrs(generatorParameters({
    request_retention: 0.9,
    maximum_interval: 3650,
    enable_fuzz: true,
    enable_short_term: false,
    learning_steps: [],
    relearning_steps: [],
}));

export const RATING_TO_GRADE = { again: Rating.Again, hard: Rating.Hard, good: Rating.Good, easy: Rating.Easy } as const;

/** Card state for FSRS: stored state, or an estimate from the old SM-2 schedule for cards reviewed before. */
export const toFsrsCard = (card: Flashcard, now: number): FsrsCard => {
    if (card.fsrs) {
        const f = card.fsrs;
        return {
            ...createEmptyCard(new Date(f.last)),
            due: new Date(card.nextReviewDate),
            stability: f.s,
            difficulty: f.d,
            reps: f.reps,
            lapses: f.lapses,
            state: f.state,
            last_review: new Date(f.last),
            scheduled_days: Math.max(0, card.interval),
            elapsed_days: Math.max(0, Math.floor((now - f.last) / DAY)),
        };
    }
    const isNew = card.interval <= 0 && (card.difficulty === 'New' || !card.difficulty);
    if (isNew) return createEmptyCard(new Date(now));
    // Migrate from SM-2: the interval was planned for ~90% recall, so stability ≈ interval;
    // a low ease factor means the word was hard (difficulty 1..10).
    const ease = card.easeFactor || 2.5;
    const interval = Math.max(card.interval, 0);
    const last = interval > 0 ? card.nextReviewDate - interval * DAY : now;
    return {
        ...createEmptyCard(new Date(last)),
        due: new Date(card.nextReviewDate),
        stability: Math.max(interval, 0.5),
        difficulty: Math.min(10, Math.max(1, 5 + (2.5 - ease) * 4)),
        reps: 1,
        lapses: 0,
        state: interval > 0 ? State.Review : State.Relearning,
        last_review: new Date(last),
        scheduled_days: interval,
        elapsed_days: Math.max(0, Math.floor((now - last) / DAY)),
    };
};

export const nextFsrs = (card: Flashcard, grade: Grade, now: number) => {
    const result = scheduler.next(toFsrsCard(card, now), new Date(now), grade);
    const c = result.card;
    const state: FsrsState = { s: c.stability, d: c.difficulty, reps: c.reps, lapses: c.lapses, state: c.state, last: now };
    return { days: c.scheduled_days, state };
};

/** Predicted chance (0..1) of recalling the card now. */
export const retrievability = (card: Flashcard, now = Date.now()) =>
    scheduler.get_retrievability(toFsrsCard(card, now), new Date(now), false) as number;
