import { Difficulty, Flashcard } from '../types';
import { CefrLevel } from './reviewExercise';
import { normalizeTerm } from '../shared/wordKeys';

/**
 * One card per word in a session: if the deck has duplicates (the same word added twice),
 * the second copy waits — otherwise it looks like "the same card came back".
 */
export const uniqueByTerm = (cards: Flashcard[], seenTerms: Set<string> = new Set()): Flashcard[] => {
    const seen = new Set(seenTerms);
    return cards.filter(c => {
        const key = normalizeTerm(c.originalTerm);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

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
    /** Learner's level: gap-fill exercises use example sentences up to this level */
    level: CefrLevel;
}

export const DEFAULT_PLAN_SETTINGS: PlanSettings = { newPerDay: 10, reviewsPerDay: 60, level: 'A1' };
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
    /** Cards whose latest rating today brings them back today ("again", or "hard" on a new card) */
    openIds?: string[];
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

/**
 * Splits due reviews into relearning cards (studied today and still open — always shown) and the rest (limited).
 * Cards studied today that are not open are skipped even if this device has a stale schedule for them
 * (e.g. they were just reviewed on another device).
 */
const splitDue = (cards: Flashcard[], progress: DailyProgress, now: number) => {
    const studiedToday = new Set([...progress.reviewIds, ...progress.newIds]);
    const open = new Set(progress.openIds || []);
    const due = getDueReviews(cards, now);
    const relearn = due.filter(c => studiedToday.has(c.id) && open.has(c.id));
    const fresh = due.filter(c => !studiedToday.has(c.id));
    return { due: [...relearn, ...fresh], relearn, fresh };
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
    // Backlog as it was at the start of the day, so the plan doesn't change mid-session
    const newPaused = fresh.length + reviewsDone > BACKLOG_PAUSE_THRESHOLD;
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
    return uniqueByTerm(interleave(reviews, newCards));
};

/** Remaining cards in today's plan (for the badge in navigation). */
export const planRemaining = (summary: PlanSummary) => summary.reviewsLeft + summary.newLeft;
