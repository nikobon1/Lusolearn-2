import { Difficulty, Flashcard } from '../types';

/**
 * Daily study plan (Anki-style):
 *  - reviews first, limited per day, most overdue first; failed/relearning cards before others
 *  - a limited number of new cards per day, interleaved with reviews (1 new after every N reviews)
 *  - no new cards while the review backlog is large
 *  - the session is served in portions with a checkpoint between them
 */

export interface PlanSettings {
    newPerDay: number;
    reviewsPerDay: number;
}

export const DEFAULT_PLAN_SETTINGS: PlanSettings = { newPerDay: 10, reviewsPerDay: 60 };
export const NEW_PER_DAY_OPTIONS = [0, 5, 10, 15, 20];
export const REVIEWS_PER_DAY_OPTIONS = [30, 60, 100, 200];

/** Cards per portion before a "continue / finish" checkpoint. */
export const PORTION_SIZE = 20;
/** One new card after this many reviews. */
export const REVIEWS_BETWEEN_NEW = 4;
/** Pause new cards while more reviews than this are due. */
export const BACKLOG_PAUSE_THRESHOLD = 100;

export interface DailyProgress {
    /** Card ids reviewed today (counted once per card) */
    reviewIds: string[];
    /** New card ids introduced today */
    newIds: string[];
}

/** Never studied: no rating yet. */
export const isNewCard = (card: Flashcard) =>
    card.interval === 0 && (card.difficulty === Difficulty.New || !card.difficulty);

export const isDue = (card: Flashcard, now = Date.now()) => card.nextReviewDate <= now;

/** Reviews due now: relearning (failed) cards first, then the most overdue relative to their interval. */
export const getDueReviews = (cards: Flashcard[], now = Date.now()): Flashcard[] => {
    const overdueRatio = (c: Flashcard) => (now - c.nextReviewDate) / (Math.max(c.interval, 1) * 86_400_000);
    return cards
        .filter(c => !isNewCard(c) && isDue(c, now))
        .sort((a, b) => {
            const aRelearn = a.interval === 0 ? 1 : 0;
            const bRelearn = b.interval === 0 ? 1 : 0;
            if (aRelearn !== bRelearn) return bRelearn - aRelearn;
            return overdueRatio(b) - overdueRatio(a);
        });
};

/** New cards in the order they were added (frequency-path cards are added in frequency order). */
export const getNewCards = (cards: Flashcard[]): Flashcard[] =>
    cards.filter(isNewCard).sort((a, b) => a.createdAt - b.createdAt);

export interface PlanSummary {
    reviewsDone: number;
    reviewsLeft: number;
    newDone: number;
    newLeft: number;
    /** Due reviews beyond today's limit */
    backlogBeyondLimit: number;
    totalDue: number;
    newPaused: boolean;
    newAvailable: number;
}

/** Splits due reviews into cards already studied today (relearning — always shown) and the rest (limited). */
const splitDue = (cards: Flashcard[], progress: DailyProgress, now: number) => {
    const studiedToday = new Set([...progress.reviewIds, ...progress.newIds]);
    const due = getDueReviews(cards, now);
    return {
        due,
        relearn: due.filter(c => studiedToday.has(c.id)),
        fresh: due.filter(c => !studiedToday.has(c.id)),
    };
};

export const summarizePlan = (
    cards: Flashcard[],
    progress: DailyProgress,
    settings: PlanSettings,
    now = Date.now()
): PlanSummary => {
    const { due, relearn, fresh } = splitDue(cards, progress, now);
    const reviewsDone = progress.reviewIds.length;
    const newDone = progress.newIds.length;
    const limitedLeft = Math.max(0, Math.min(fresh.length, settings.reviewsPerDay - reviewsDone));
    const reviewsLeft = relearn.length + limitedLeft;
    const newPaused = due.length > BACKLOG_PAUSE_THRESHOLD;
    const newAvailable = getNewCards(cards).length;
    const newLeft = newPaused ? 0 : Math.max(0, Math.min(newAvailable, settings.newPerDay - newDone));
    return {
        reviewsDone,
        reviewsLeft,
        newDone,
        newLeft,
        backlogBeyondLimit: Math.max(0, fresh.length - limitedLeft),
        totalDue: due.length,
        newPaused,
        newAvailable,
    };
};

/** Interleaves new cards into reviews: R R R R N R R R R N … then the rest. */
export const interleave = (reviews: Flashcard[], fresh: Flashcard[], every = REVIEWS_BETWEEN_NEW): Flashcard[] => {
    const out: Flashcard[] = [];
    let r = 0;
    let n = 0;
    while (r < reviews.length || n < fresh.length) {
        for (let i = 0; i < every && r < reviews.length; i++) out.push(reviews[r++]);
        if (n < fresh.length) out.push(fresh[n++]);
    }
    return out;
};

/**
 * Cards for the rest of today's plan, excluding ones already shown in this session.
 * `extra` > 0 allows studying beyond the daily review limit ("ещё порция сверх плана").
 */
export const buildPlanQueue = (
    cards: Flashcard[],
    progress: DailyProgress,
    settings: PlanSettings,
    exclude: Set<string> = new Set(),
    extra = 0,
    now = Date.now()
): Flashcard[] => {
    const summary = summarizePlan(cards, progress, settings, now);
    const { relearn, fresh } = splitDue(cards, progress, now);
    const limited = summary.reviewsLeft - relearn.length + extra;
    const reviews = [...relearn, ...fresh.slice(0, limited)].filter(c => !exclude.has(c.id));
    const newCards = getNewCards(cards)
        .filter(c => !exclude.has(c.id))
        .slice(0, summary.newLeft);
    return interleave(reviews, newCards);
};

/** Remaining cards in today's plan (for the badge in navigation). */
export const planRemaining = (summary: PlanSummary) => summary.reviewsLeft + summary.newLeft;
