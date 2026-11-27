import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReviewEvent } from './useDailyPlan';
import type { ReviewRecord } from '../domain/stats';
import { fetchReviewHistory, isMissingSchemaError } from '../services/repositories/reviewLogRepository';

const DAYS = 120;
const LOCAL_LIMIT = 4000;
const key = (userId?: string) => `luso_reviews_${userId || 'guest'}`;

const readLocal = (userId?: string): ReviewRecord[] => {
    try { return JSON.parse(localStorage.getItem(key(userId)) || '[]'); } catch { return []; }
};

/**
 * Review history for the statistics block (last ~4 months).
 * Signed-in: from `review_logs` (all devices) plus this session's reviews not yet fetched;
 * offline / before the migration: a copy kept on this device.
 */
export const useReviewHistory = (userId?: string) => {
    const online = !!userId && userId !== 'offline';
    const [records, setRecords] = useState<ReviewRecord[]>(() => readLocal(userId));
    const [fromServer, setFromServer] = useState(false);
    const localRef = useRef<ReviewRecord[]>(readLocal(userId));

    useEffect(() => {
        localRef.current = readLocal(userId);
        setRecords(localRef.current);
        setFromServer(false);
    }, [userId]);

    const sync = useCallback(async () => {
        if (!online || !userId) return;
        const since = new Date(Date.now() - DAYS * 86_400_000);
        const { data, error } = await fetchReviewHistory(userId, since);
        if (error) {
            if (!isMissingSchemaError(error)) console.error('[Stats] Failed to load review history', error);
            return;
        }
        const server: ReviewRecord[] = (data || []).map(r => ({
            cardId: r.card_id, rating: r.rating, wasNew: r.was_new, attempt: r.attempt,
            intervalAfter: r.interval_after ?? null, at: new Date(r.reviewed_at).getTime(),
        }));
        // Reviews made in this session after the fetch started are kept
        const newest = server.reduce((m, r) => Math.max(m, r.at), 0);
        const pending = localRef.current.filter(r => r.at > newest + 1000);
        setRecords([...server, ...pending].sort((a, b) => a.at - b.at));
        setFromServer(true);
    }, [online, userId]);

    useEffect(() => {
        if (!online) return;
        sync();
        const onVisible = () => { if (document.visibilityState === 'visible') sync(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [online, sync]);

    const add = useCallback((event: ReviewEvent) => {
        const record: ReviewRecord = {
            cardId: event.card.id, rating: event.rating, wasNew: event.wasNew, attempt: event.attempt,
            intervalAfter: event.outcome.interval, at: Date.now(),
        };
        localRef.current = [...localRef.current, record].slice(-LOCAL_LIMIT);
        try { localStorage.setItem(key(userId), JSON.stringify(localRef.current)); } catch { /* unavailable */ }
        setRecords(prev => [...prev, record]);
    }, [userId]);

    return { records, fromServer, add };
};
