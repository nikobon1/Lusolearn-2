import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Flashcard } from '../types';
import {
    DEFAULT_PLAN_SETTINGS, DailyProgress, PORTION_SIZE, PlanSettings, buildPlanQueue, summarizePlan,
} from '../domain/dailyPlan';
import { ReviewOutcome, ReviewRating } from '../domain/srs';
import {
    fetchReviewLogsSince, fetchStudyPlanSettings, insertReviewLog, isMissingSchemaError, saveStudyPlanSettings,
} from '../services/repositories/reviewLogRepository';

interface StoredPlan extends DailyProgress {
    openIds: string[];
    date: string;
    settings: PlanSettings;
}

/** Everything about one rating, sent from the study session. */
export interface ReviewEvent {
    card: Flashcard;
    rating: ReviewRating;
    wasNew: boolean;
    attempt: number;
    exercise?: string;
    outcome: ReviewOutcome;
}

const localMidnight = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
};

const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const storageKey = (userId?: string) => `luso_plan_${userId || 'guest'}`;

const readLocal = (userId?: string): StoredPlan => {
    const empty: StoredPlan = { date: todayKey(), reviewIds: [], newIds: [], openIds: [], settings: DEFAULT_PLAN_SETTINGS };
    try {
        const raw = localStorage.getItem(storageKey(userId));
        if (!raw) return empty;
        const parsed = JSON.parse(raw) as Partial<StoredPlan>;
        const settings = { ...DEFAULT_PLAN_SETTINGS, ...(parsed.settings || {}) };
        if (parsed.date !== todayKey()) return { ...empty, settings }; // new day: progress resets, settings stay
        return {
            date: parsed.date,
            reviewIds: Array.isArray(parsed.reviewIds) ? parsed.reviewIds : [],
            newIds: Array.isArray(parsed.newIds) ? parsed.newIds : [],
            openIds: Array.isArray(parsed.openIds) ? parsed.openIds : [],
            settings,
        };
    } catch {
        return empty;
    }
};

/** Adds a card to today's progress (each card counted once, in the category of its first rating today). */
const addToProgress = (p: DailyProgress, cardId: string, wasNew: boolean): DailyProgress => {
    if (p.reviewIds.includes(cardId) || p.newIds.includes(cardId)) return p;
    return wasNew ? { ...p, newIds: [...p.newIds, cardId] } : { ...p, reviewIds: [...p.reviewIds, cardId] };
};

/** Marks whether the card comes back later today (its latest rating was "again" or kept it in learning). */
const setOpen = (p: DailyProgress, cardId: string, open: boolean): DailyProgress => {
    const ids = (p.openIds || []).filter(id => id !== cardId);
    return { ...p, openIds: open ? [...ids, cardId] : ids };
};

const isOpenAfter = (rating: string, intervalAfter: number | null | undefined) =>
    rating === 'again' || intervalAfter === 0;

/**
 * Today's study plan.
 * Signed-in users: progress comes from the `review_logs` table (shared across devices),
 * settings from `profiles.study_plan`. localStorage is a fast cache, and the only store
 * in offline mode or until the migration has been applied.
 */
export const useDailyPlan = (cards: Flashcard[], userId?: string) => {
    const online = !!userId && userId !== 'offline';
    const [state, setState] = useState<StoredPlan & { owner?: string }>(() => ({ ...readLocal(userId), owner: userId }));
    /** null = unknown yet, false = tables missing (migration not applied) */
    const serverAvailable = useRef<boolean | null>(null);

    const progress: DailyProgress = useMemo(
        () => ({ reviewIds: state.reviewIds, newIds: state.newIds, openIds: state.openIds }),
        [state.reviewIds, state.newIds, state.openIds]
    );

    // Synchronous copy: a session asks for the next cards right after rating one,
    // before React has re-rendered with the updated progress.
    const progressRef = useRef<DailyProgress>(progress);
    useEffect(() => { progressRef.current = progress; }, [progress]);

    // Switch user
    useEffect(() => {
        if (state.owner !== userId) {
            serverAvailable.current = null;
            setState({ ...readLocal(userId), owner: userId });
        }
    }, [userId, state.owner]);

    // Cache locally
    useEffect(() => {
        if (state.owner !== userId) return;
        try {
            const { date, reviewIds, newIds, openIds, settings } = state;
            localStorage.setItem(storageKey(userId), JSON.stringify({ date, reviewIds, newIds, openIds, settings }));
        } catch {
            // storage unavailable — fine, server or memory still works
        }
    }, [state, userId]);

    /** Pulls today's progress from the server and merges it with anything not yet confirmed locally. */
    const syncFromServer = useCallback(async () => {
        if (!online || !userId || serverAvailable.current === false) return;
        const { data, error } = await fetchReviewLogsSince(userId, localMidnight());
        if (error) {
            if (isMissingSchemaError(error)) {
                serverAvailable.current = false;
                console.warn('[Plan] review_logs table not found — run supabase/migrations/20261125_review_logs.sql. Using local progress.');
            } else {
                console.error('[Plan] Failed to load review logs', error);
            }
            return;
        }
        serverAvailable.current = true;

        let server: DailyProgress = { reviewIds: [], newIds: [], openIds: [] };
        const serverCards = new Set<string>();
        for (const row of data || []) {
            server = addToProgress(server, row.card_id, row.was_new);
            server = setOpen(server, row.card_id, isOpenAfter(row.rating, row.interval_after));
            serverCards.add(row.card_id);
        }

        setState(prev => {
            const base = prev.date === todayKey() ? prev : { ...readLocal(prev.owner), owner: prev.owner };
            // Keep local ratings the server hasn't confirmed yet (insert still in flight)
            let merged = server;
            for (const id of base.newIds) merged = addToProgress(merged, id, true);
            for (const id of base.reviewIds) merged = addToProgress(merged, id, false);
            for (const id of base.openIds || []) if (!serverCards.has(id)) merged = setOpen(merged, id, true);
            progressRef.current = merged;
            return { ...base, date: todayKey(), reviewIds: merged.reviewIds, newIds: merged.newIds, openIds: merged.openIds || [] };
        });
    }, [online, userId]);

    // Load settings + progress on sign-in; refresh when returning to the app (e.g. after studying on the phone)
    useEffect(() => {
        if (!online || !userId) return;
        let cancelled = false;
        fetchStudyPlanSettings(userId).then(({ data, error }) => {
            if (cancelled) return;
            if (error) {
                if (!isMissingSchemaError(error)) console.error('[Plan] Failed to load plan settings', error);
                return;
            }
            const remote = data?.study_plan as Partial<PlanSettings> | null;
            if (remote) setState(prev => ({ ...prev, settings: { ...DEFAULT_PLAN_SETTINGS, ...remote } }));
        });
        syncFromServer();

        const onVisible = () => { if (document.visibilityState === 'visible') syncFromServer(); };
        window.addEventListener('focus', syncFromServer);
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            cancelled = true;
            window.removeEventListener('focus', syncFromServer);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [online, userId, syncFromServer]);

    // Day rolled over while the app was open
    useEffect(() => {
        const timer = setInterval(() => {
            setState(prev => {
                if (prev.date === todayKey()) return prev;
                const next = { ...readLocal(prev.owner), owner: prev.owner, reviewIds: [], newIds: [], openIds: [], date: todayKey() };
                progressRef.current = { reviewIds: [], newIds: [], openIds: [] };
                return next;
            });
        }, 60_000);
        return () => clearInterval(timer);
    }, []);

    const summary = useMemo(
        () => summarizePlan(cards, progress, state.settings),
        [cards, progress, state.settings]
    );

    /** Called for every rating: updates today's progress and writes the review log. */
    const recordReview = useCallback((event: ReviewEvent) => {
        const { card, rating, wasNew, attempt, exercise, outcome } = event;
        const open = isOpenAfter(rating, outcome.interval);
        progressRef.current = setOpen(addToProgress(progressRef.current, card.id, wasNew), card.id, open);
        setState(prev => {
            const base = prev.date === todayKey() ? prev : { ...readLocal(prev.owner), owner: prev.owner };
            const next = setOpen(addToProgress(base, card.id, wasNew), card.id, open);
            return { ...base, reviewIds: next.reviewIds, newIds: next.newIds, openIds: next.openIds || [] };
        });

        if (!online || !userId || serverAvailable.current === false) return;
        insertReviewLog(userId, {
            card_id: card.id,
            rating,
            was_new: wasNew,
            attempt,
            exercise,
            interval_before: card.interval,
            interval_after: outcome.interval,
            ease_before: card.easeFactor,
            ease_after: outcome.easeFactor,
        }).then(({ error }) => {
            if (!error) return;
            if (isMissingSchemaError(error)) serverAvailable.current = false;
            else console.error('[Plan] Failed to save review log', error);
        });
    }, [online, userId]);

    const setSettings = useCallback((patch: Partial<PlanSettings>) => {
        setState(prev => {
            const settings = { ...prev.settings, ...patch };
            if (online && userId) {
                saveStudyPlanSettings(userId, settings).then(({ error }) => {
                    if (error && !isMissingSchemaError(error)) console.error('[Plan] Failed to save plan settings', error);
                });
            }
            return { ...prev, settings };
        });
    }, [online, userId]);

    /** Rest of today's plan, excluding cards already in the session. */
    const getQueue = useCallback(
        (exclude: Set<string> = new Set()) => buildPlanQueue(cards, progressRef.current, state.settings, exclude),
        [cards, state.settings]
    );

    /** An extra portion of due reviews beyond today's limit. */
    const getExtraQueue = useCallback(
        (exclude: Set<string> = new Set()) => buildPlanQueue(cards, progressRef.current, { ...state.settings, newPerDay: 0 }, exclude, PORTION_SIZE),
        [cards, state.settings]
    );

    return { summary, settings: state.settings, setSettings, recordReview, getQueue, getExtraQueue, refresh: syncFromServer, todayNewIds: state.newIds };
};
