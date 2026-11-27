import { useEffect, useRef, useState } from 'react';
import { ViewState } from '../types';
import { DaySeconds, StudyTimeStore, sumDevices } from '../domain/studyTime';
import { dayKey } from '../domain/practiceLog';
import { supabase } from '../services/supabase';
import { isMissingSchemaError } from '../services/repositories/reviewLogRepository';

/** Screens where time counts as study */
export const STUDY_VIEWS = new Set<ViewState>([
    ViewState.Study, ViewState.Phrases, ViewState.Conjugation, ViewState.Dialogues, ViewState.Story, ViewState.Frequency, ViewState.Lessons,
]);
const TICK_S = 5;
/** No taps/keys/scroll for this long → not counted (the phone is lying on the table) */
const IDLE_MS = 60_000;
const KEEP_DAYS = 120;

const deviceId = () => {
    try {
        let id = localStorage.getItem('luso_device_id');
        if (!id) { id = self.crypto.randomUUID().slice(0, 8); localStorage.setItem('luso_device_id', id); }
        return id;
    } catch { return 'web'; }
};
const localKey = (userId?: string) => `luso_time_${userId || 'guest'}`;
const readLocal = (userId?: string): DaySeconds => {
    try { return JSON.parse(localStorage.getItem(localKey(userId)) || '{}'); } catch { return {}; }
};
const trim = (days: DaySeconds): DaySeconds => {
    const cutoff = dayKey(Date.now() - KEEP_DAYS * 86_400_000);
    return Object.fromEntries(Object.entries(days).filter(([d]) => d >= cutoff));
};

/**
 * Active study time: counts while a study screen is open, the tab is visible and the learner
 * interacted within the last minute. Stored per device in profiles.study_time (all devices add up).
 */
export const useStudyTime = (userId: string | undefined, view: ViewState) => {
    const online = !!userId && userId !== 'offline';
    const device = useRef(deviceId());
    const mine = useRef<DaySeconds>(readLocal(userId));
    const others = useRef<StudyTimeStore>({});
    const serverOk = useRef<boolean | null>(null);
    const dirty = useRef(false);
    const lastInput = useRef(Date.now());
    const [total, setTotal] = useState<DaySeconds>(() => mine.current);

    const publish = () => setTotal(sumDevices({ ...others.current, [device.current]: mine.current }));

    // Load other devices' time (and this device's server copy, in case local storage was cleared)
    useEffect(() => {
        mine.current = readLocal(userId);
        others.current = {};
        publish();
        if (!online) return;
        let cancelled = false;
        supabase.from('profiles').select('study_time').eq('id', userId!).maybeSingle().then(({ data, error }) => {
            if (cancelled) return;
            if (error) { if (isMissingSchemaError(error)) serverOk.current = false; return; }
            serverOk.current = true;
            const store = (data?.study_time || {}) as StudyTimeStore;
            const server = store[device.current] || {};
            for (const [d, s] of Object.entries(server)) mine.current[d] = Math.max(mine.current[d] || 0, s);
            delete store[device.current];
            others.current = store;
            publish();
        });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, online]);

    const flush = async () => {
        if (!online || !dirty.current || serverOk.current === false) return;
        dirty.current = false;
        // Re-read so another device's fresh time isn't overwritten
        const { data, error } = await supabase.from('profiles').select('study_time').eq('id', userId!).maybeSingle();
        if (error) { if (isMissingSchemaError(error)) serverOk.current = false; dirty.current = true; return; }
        const store = (data?.study_time || {}) as StudyTimeStore;
        store[device.current] = trim(mine.current);
        const { error: saveError } = await supabase.from('profiles').update({ study_time: store }).eq('id', userId!);
        if (saveError) { dirty.current = true; return; }
        delete store[device.current];
        others.current = store;
        publish();
    };

    // Activity signals
    useEffect(() => {
        const mark = () => { lastInput.current = Date.now(); };
        const events = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'scroll'];
        events.forEach(e => window.addEventListener(e, mark, { passive: true, capture: true }));
        return () => events.forEach(e => window.removeEventListener(e, mark, { capture: true } as any));
    }, []);

    // The clock
    useEffect(() => {
        const timer = window.setInterval(() => {
            if (!STUDY_VIEWS.has(view) || document.visibilityState !== 'visible') return;
            // Listening to audio (story read-aloud) also counts as activity via the last tap before it
            if (Date.now() - lastInput.current > IDLE_MS) return;
            const d = dayKey(Date.now());
            mine.current = { ...mine.current, [d]: (mine.current[d] || 0) + TICK_S };
            dirty.current = true;
            try { localStorage.setItem(localKey(userId), JSON.stringify(trim(mine.current))); } catch { /* unavailable */ }
            publish();
        }, TICK_S * 1000);
        return () => window.clearInterval(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view, userId]);

    // Save every minute and when leaving
    useEffect(() => {
        const timer = window.setInterval(flush, 60_000);
        const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
        document.addEventListener('visibilitychange', onHide);
        return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onHide); flush(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, online]);

    return total;
};
