import { supabase } from '../supabase';
import type { PracticeKind, PracticeVerdict } from '../../domain/practiceLog';

export interface PracticeLogRow {
    id: string;
    kind: PracticeKind;
    item_key: string;
    verdict: PracticeVerdict;
    practiced_at: string;
}

/** The id is generated on the device, so the local copy and the server row are recognised as the same answer. */
export const insertPracticeLog = (userId: string, id: string, kind: PracticeKind, itemKey: string, verdict: PracticeVerdict, at: number) =>
    supabase.from('practice_logs').insert({ id, user_id: userId, kind, item_key: itemKey, verdict, practiced_at: new Date(at).toISOString() });

/** All of the user's practice logs (a few thousand rows at most for one learner), oldest first. */
export const fetchPracticeLogs = (userId: string) =>
    supabase
        .from('practice_logs')
        .select('id, kind, item_key, verdict, practiced_at')
        .eq('user_id', userId)
        .order('practiced_at', { ascending: true })
        .limit(20000);
