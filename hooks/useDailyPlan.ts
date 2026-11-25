import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Flashcard } from '../types';
import {
    DEFAULT_PLAN_SETTINGS, DailyProgress, PORTION_SIZE, PlanSettings, buildPlanQueue, summarizePlan,
} from '../domain/dailyPlan';

interface StoredPlan extends DailyProgress {
    date: string;
    settings: PlanSettings;
}

const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const storageKey = (userId?: string) => `luso_plan_${userId || 'guest'}`;

const read = (userId?: string): StoredPlan => {
    const empty: StoredPlan = { date: todayKey(), reviewIds: [], newIds: [], settings: DEFAULT_PLAN_SETTINGS };
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
            settings,
        };
    } catch {
        return empty;
    }
};

/**
 * Today's study plan: limits, what was already studied today, and the queue for the rest of the day.
 * Progress is kept per user in localStorage (on this device) and resets at local midnight.
 */
export const useDailyPlan = (cards: Flashcard[], userId?: string) => {
    const [state, setState] = useState<StoredPlan & { owner?: string }>(() => ({ ...read(userId), owner: userId }));

    useEffect(() => {
        if (state.owner !== userId) setState({ ...read(userId), owner: userId });
    }, [userId, state.owner]);

    // Day rolled over while the app was open
    useEffect(() => {
        const timer = setInterval(() => {
            setState(prev => (prev.date === todayKey() ? prev : { ...read(prev.owner), owner: prev.owner }));
        }, 60_000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (state.owner !== userId) return;
        try {
            const { date, reviewIds, newIds, settings } = state;
            localStorage.setItem(storageKey(userId), JSON.stringify({ date, reviewIds, newIds, settings }));
        } catch {
            // storage unavailable — plan progress lives in memory
        }
    }, [state, userId]);

    const progress: DailyProgress = useMemo(
        () => ({ reviewIds: state.reviewIds, newIds: state.newIds }),
        [state.reviewIds, state.newIds]
    );

    // Synchronous copy: a session asks for the next cards right after rating one,
    // before React has re-rendered with the updated progress.
    const progressRef = useRef<DailyProgress>(progress);
    useEffect(() => { progressRef.current = progress; }, [progress]);

    const summary = useMemo(
        () => summarizePlan(cards, progress, state.settings),
        [cards, progress, state.settings]
    );

    /** Records that a card was studied today (each card counted once). */
    const recordStudied = useCallback((card: Flashcard, wasNew: boolean) => {
        const p = progressRef.current;
        if (!p.reviewIds.includes(card.id) && !p.newIds.includes(card.id)) {
            progressRef.current = wasNew
                ? { ...p, newIds: [...p.newIds, card.id] }
                : { ...p, reviewIds: [...p.reviewIds, card.id] };
        }
        setState(prev => {
            const fresh = prev.date === todayKey() ? prev : { ...read(prev.owner), owner: prev.owner };
            if (fresh.reviewIds.includes(card.id) || fresh.newIds.includes(card.id)) return fresh;
            return wasNew
                ? { ...fresh, newIds: [...fresh.newIds, card.id] }
                : { ...fresh, reviewIds: [...fresh.reviewIds, card.id] };
        });
    }, []);

    const setSettings = useCallback((patch: Partial<PlanSettings>) => {
        setState(prev => ({ ...prev, settings: { ...prev.settings, ...patch } }));
    }, []);

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

    return { summary, settings: state.settings, setSettings, recordStudied, getQueue, getExtraQueue };
};
