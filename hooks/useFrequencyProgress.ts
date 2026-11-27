import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { supabase } from '../services/supabase';
import { isMissingSchemaError } from '../services/repositories/reviewLogRepository';

interface StoredProgress {
    known: string[];
    dailyGoal: number;
    /** Last change, ms — newer of server and device wins */
    updatedAt?: number;
}

const DEFAULT_GOAL = 10;
const EMPTY: StoredProgress = { known: [], dailyGoal: DEFAULT_GOAL };
const storageKey = (userId?: string) => `luso_freq_${userId || 'guest'}`;
const isOnline = (userId?: string) => !!userId && userId !== 'offline';

const readLocal = (userId?: string): StoredProgress => {
    try {
        const raw = localStorage.getItem(storageKey(userId));
        if (!raw) return EMPTY;
        const parsed = JSON.parse(raw) as Partial<StoredProgress>;
        return {
            known: Array.isArray(parsed.known) ? parsed.known : [],
            dailyGoal: typeof parsed.dailyGoal === 'number' ? parsed.dailyGoal : DEFAULT_GOAL,
            updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : undefined,
        };
    } catch {
        return EMPTY;
    }
};

/**
 * One shared store per user, so every screen (С нуля, statistics, stories, placement test)
 * sees the same "known" words. Signed-in users: kept in profiles.frequency_progress (all devices),
 * with a copy on the device; offline / before the migration: the device only.
 */
const stores = new Map<string, {
    state: StoredProgress;
    listeners: Set<() => void>;
    synced: boolean;
    serverAvailable: boolean | null;
    saveTimer?: number;
}>();

const getStore = (userId?: string) => {
    const key = userId || 'guest';
    let store = stores.get(key);
    if (!store) {
        store = { state: readLocal(userId), listeners: new Set(), synced: false, serverAvailable: null };
        stores.set(key, store);
    }
    return store;
};

const emit = (userId?: string) => getStore(userId).listeners.forEach(l => l());

const saveToServer = (userId: string) => {
    const store = getStore(userId);
    if (!isOnline(userId) || store.serverAvailable === false) return;
    window.clearTimeout(store.saveTimer);
    // Debounced: marking several words in a row sends one request
    store.saveTimer = window.setTimeout(async () => {
        const { error } = await supabase.from('profiles').update({ frequency_progress: store.state }).eq('id', userId);
        if (error) {
            if (isMissingSchemaError(error)) {
                store.serverAvailable = false;
                console.warn('[Frequency] profiles.frequency_progress is missing — run supabase/migrations/20261201_frequency_progress.sql. Keeping marks on this device.');
            } else console.error('[Frequency] Failed to save progress', error);
        }
    }, 800);
};

const setState = (userId: string | undefined, update: (prev: StoredProgress) => StoredProgress) => {
    const store = getStore(userId);
    const next = update(store.state);
    if (next === store.state) return;
    store.state = { ...next, updatedAt: Date.now() };
    try { localStorage.setItem(storageKey(userId), JSON.stringify(store.state)); } catch { /* storage unavailable */ }
    emit(userId);
    if (userId) saveToServer(userId);
};

const syncFromServer = async (userId: string) => {
    const store = getStore(userId);
    if (!isOnline(userId) || store.serverAvailable === false) return;
    const { data, error } = await supabase.from('profiles').select('frequency_progress').eq('id', userId).maybeSingle();
    if (error) {
        if (isMissingSchemaError(error)) store.serverAvailable = false;
        else console.error('[Frequency] Failed to load progress', error);
        return;
    }
    store.serverAvailable = true;
    const remote = data?.frequency_progress as StoredProgress | null;
    const local = store.state;
    if (!remote) {
        // First sync: upload what this device has (e.g. the placement test done before the migration)
        if (local.known.length || local.dailyGoal !== DEFAULT_GOAL) saveToServer(userId);
        return;
    }
    if ((local.updatedAt || 0) > (remote.updatedAt || 0)) {
        saveToServer(userId); // this device changed more recently (e.g. while offline)
        return;
    }
    store.state = {
        known: Array.isArray(remote.known) ? remote.known : [],
        dailyGoal: typeof remote.dailyGoal === 'number' ? remote.dailyGoal : DEFAULT_GOAL,
        updatedAt: remote.updatedAt,
    };
    try { localStorage.setItem(storageKey(userId), JSON.stringify(store.state)); } catch { /* storage unavailable */ }
    emit(userId);
};

/**
 * Per-user frequency-path settings: words marked "already known" (no card needed) and the daily goal.
 */
export const useFrequencyProgress = (userId?: string) => {
    const store = getStore(userId);
    const state = useSyncExternalStore(
        useCallback(listener => {
            store.listeners.add(listener);
            return () => { store.listeners.delete(listener); };
        }, [store]),
        () => store.state,
    );

    // Load once per user and when returning to the app (changes made on another device)
    useEffect(() => {
        if (!isOnline(userId) || !userId) return;
        if (!store.synced) { store.synced = true; syncFromServer(userId); }
        const onVisible = () => { if (document.visibilityState === 'visible') syncFromServer(userId); };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [userId, store]);

    const markKnown = useCallback((key: string) => {
        setState(userId, prev => (prev.known.includes(key) ? prev : { ...prev, known: [...prev.known, key] }));
    }, [userId]);

    const markManyKnown = useCallback((keys: string[]) => {
        setState(userId, prev => {
            const set = new Set(prev.known);
            keys.forEach(k => set.add(k));
            return set.size === prev.known.length ? prev : { ...prev, known: [...set] };
        });
    }, [userId]);

    const unmarkKnown = useCallback((key: string) => {
        setState(userId, prev => (prev.known.includes(key) ? { ...prev, known: prev.known.filter(k => k !== key) } : prev));
    }, [userId]);

    const setDailyGoal = useCallback((dailyGoal: number) => {
        setState(userId, prev => (prev.dailyGoal === dailyGoal ? prev : { ...prev, dailyGoal }));
    }, [userId]);

    const knownKeys = useMemo(() => new Set(state.known), [state.known]);

    return { knownKeys, dailyGoal: state.dailyGoal, markKnown, markManyKnown, unmarkKnown, setDailyGoal };
};
