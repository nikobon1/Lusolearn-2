import { useCallback, useEffect, useMemo, useState } from 'react';

interface StoredProgress {
    known: string[];
    dailyGoal: number;
}

const DEFAULT_GOAL = 10;

const storageKey = (userId?: string) => `luso_freq_${userId || 'guest'}`;

const readProgress = (userId?: string): StoredProgress => {
    try {
        const raw = localStorage.getItem(storageKey(userId));
        if (!raw) return { known: [], dailyGoal: DEFAULT_GOAL };
        const parsed = JSON.parse(raw) as Partial<StoredProgress>;
        return {
            known: Array.isArray(parsed.known) ? parsed.known : [],
            dailyGoal: typeof parsed.dailyGoal === 'number' ? parsed.dailyGoal : DEFAULT_GOAL,
        };
    } catch {
        return { known: [], dailyGoal: DEFAULT_GOAL };
    }
};

/**
 * Per-user frequency-path settings: words marked "already known" (no card needed)
 * and the daily goal. Stored in localStorage on this device.
 */
export const useFrequencyProgress = (userId?: string) => {
    const [state, setState] = useState<StoredProgress & { owner?: string }>(() => ({ ...readProgress(userId), owner: userId }));

    // Reload when the user changes; never write one user's progress under another's key.
    useEffect(() => {
        if (state.owner !== userId) setState({ ...readProgress(userId), owner: userId });
    }, [userId, state.owner]);

    useEffect(() => {
        if (state.owner !== userId) return;
        try {
            const { known, dailyGoal } = state;
            localStorage.setItem(storageKey(userId), JSON.stringify({ known, dailyGoal }));
        } catch {
            // storage unavailable — progress lives in memory for this session
        }
    }, [state, userId]);

    const markKnown = useCallback((key: string) => {
        setState(prev => prev.known.includes(key) ? prev : { ...prev, known: [...prev.known, key] });
    }, []);

    const markManyKnown = useCallback((keys: string[]) => {
        setState(prev => {
            const set = new Set(prev.known);
            keys.forEach(k => set.add(k));
            return set.size === prev.known.length ? prev : { ...prev, known: [...set] };
        });
    }, []);

    const unmarkKnown = useCallback((key: string) => {
        setState(prev => ({ ...prev, known: prev.known.filter(k => k !== key) }));
    }, []);

    const setDailyGoal = useCallback((dailyGoal: number) => {
        setState(prev => ({ ...prev, dailyGoal }));
    }, []);

    const knownKeys = useMemo(() => new Set(state.known), [state.known]);

    return {
        knownKeys,
        dailyGoal: state.dailyGoal,
        markKnown,
        markManyKnown,
        unmarkKnown,
        setDailyGoal,
    };
};
