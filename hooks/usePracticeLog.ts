import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ItemStats, PracticeEntry, PracticeKind, PracticeVerdict, mergeStats, statsFromEntries,
} from '../domain/practiceLog';
import { fetchPracticeLogs, insertPracticeLog } from '../services/repositories/practiceLogRepository';
import { isMissingSchemaError } from '../services/repositories/reviewLogRepository';

const LOCAL_LIMIT = 3000;
const logKey = (userId?: string) => `luso_practice_${userId || 'guest'}`;
/** Per-item stats the trainers kept on this device before sync existed. */
const legacyKey = (kind: PracticeKind, userId?: string) => `${kind === 'phrase' ? 'luso_phrases' : 'luso_conj'}_${userId || 'guest'}`;

const readJson = <T,>(key: string, fallback: T): T => {
    try { return JSON.parse(localStorage.getItem(key) || '') ?? fallback; } catch { return fallback; }
};

const byId = (entries: PracticeEntry[]) => {
    const map = new Map<string, PracticeEntry>();
    for (const e of entries) map.set(e.id, e);
    return [...map.values()].sort((a, b) => a.at - b.at);
};

export interface PracticeLog {
    entries: PracticeEntry[];
    stats: (kind: PracticeKind) => ItemStats;
    record: (kind: PracticeKind, key: string, verdict: PracticeVerdict) => void;
}

/**
 * Phrase/conjugation answers. Signed-in users: stored in `practice_logs` (same on every device);
 * this device keeps a copy, which is also the only store offline or before the migration is applied.
 */
export const usePracticeLog = (userId?: string): PracticeLog => {
    const online = !!userId && userId !== 'offline';
    const [entries, setEntries] = useState<PracticeEntry[]>(() => readJson<PracticeEntry[]>(logKey(userId), []));
    const serverAvailable = useRef<boolean | null>(null);
    const entriesRef = useRef(entries);
    useEffect(() => { entriesRef.current = entries; }, [entries]);

    useEffect(() => {
        serverAvailable.current = null;
        setEntries(readJson<PracticeEntry[]>(logKey(userId), []));
    }, [userId]);

    useEffect(() => {
        try { localStorage.setItem(logKey(userId), JSON.stringify(entries.slice(-LOCAL_LIMIT))); } catch { /* unavailable */ }
    }, [entries, userId]);

    const sync = useCallback(async () => {
        if (!online || !userId || serverAvailable.current === false) return;
        const { data, error } = await fetchPracticeLogs(userId);
        if (error) {
            if (isMissingSchemaError(error)) {
                serverAvailable.current = false;
                console.warn('[Practice] practice_logs table not found — run supabase/migrations/20261128_practice_logs.sql. Using this device only.');
            } else {
                console.error('[Practice] Failed to load practice logs', error);
            }
            return;
        }
        serverAvailable.current = true;
        const server: PracticeEntry[] = (data || []).map(r => ({
            id: r.id, kind: r.kind, key: r.item_key, verdict: r.verdict, at: new Date(r.practiced_at).getTime(),
        }));
        // Local answers the server doesn't have yet (insert in flight or failed) are sent again
        const known = new Set(server.map(e => e.id));
        const missing = entriesRef.current.filter(e => !known.has(e.id));
        missing.forEach(e => insertPracticeLog(userId, e.id, e.kind, e.key, e.verdict, e.at).then(({ error: err }) => {
            if (err && err.code !== '23505') console.error('[Practice] Failed to upload practice log', err);
        }));
        // Functional update: answers given while the request was in flight are kept
        setEntries(prev => byId([...server, ...prev]));
    }, [online, userId]);

    useEffect(() => {
        if (!online) return;
        sync();
        const onVisible = () => { if (document.visibilityState === 'visible') sync(); };
        window.addEventListener('focus', sync);
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            window.removeEventListener('focus', sync);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [online, sync]);

    const record = useCallback((kind: PracticeKind, key: string, verdict: PracticeVerdict) => {
        const entry: PracticeEntry = { id: self.crypto.randomUUID(), kind, key, verdict, at: Date.now() };
        setEntries(prev => [...prev, entry]);
        if (!online || !userId || serverAvailable.current === false) return;
        insertPracticeLog(userId, entry.id, kind, key, verdict, entry.at).then(({ error }) => {
            if (!error) return;
            if (isMissingSchemaError(error)) serverAvailable.current = false;
            else console.error('[Practice] Failed to save practice log', error);
        });
    }, [online, userId]);

    const legacy = useMemo(() => ({
        phrase: readJson<ItemStats>(legacyKey('phrase', userId), {}),
        conjugation: readJson<ItemStats>(legacyKey('conjugation', userId), {}),
    }), [userId]);

    const stats = useCallback(
        (kind: PracticeKind) => mergeStats(legacy[kind], statsFromEntries(entries, kind)),
        [entries, legacy]
    );

    return { entries, stats, record };
};
