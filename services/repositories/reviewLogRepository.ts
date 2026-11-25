import { supabase } from '../supabase';
import { PlanSettings } from '../../domain/dailyPlan';
import { ReviewRating } from '../../domain/srs';

export interface ReviewLogInsert {
    card_id: string;
    rating: ReviewRating;
    was_new: boolean;
    attempt: number;
    exercise?: string;
    interval_before?: number;
    interval_after?: number;
    ease_before?: number;
    ease_after?: number;
}

export interface ReviewLogRow {
    card_id: string;
    was_new: boolean;
    attempt: number;
    rating: ReviewRating;
    interval_after: number | null;
    reviewed_at: string;
}

/** Postgres "relation does not exist" / PostgREST "table/column not found" — migration not applied yet. */
export const isMissingSchemaError = (error: { code?: string; message?: string } | null) =>
    !!error && (error.code === '42P01' || error.code === 'PGRST205' || error.code === '42703' || error.code === 'PGRST204'
        || /does not exist|could not find/i.test(error.message || ''));

export const insertReviewLog = (userId: string, log: ReviewLogInsert) =>
    supabase.from('review_logs').insert({ ...log, user_id: userId });

/** Logs (ReviewLogRow) since the given moment (local midnight), oldest first. */
export const fetchReviewLogsSince = (userId: string, since: Date) =>
    supabase
        .from('review_logs')
        .select('card_id, was_new, attempt, rating, interval_after, reviewed_at')
        .eq('user_id', userId)
        .gte('reviewed_at', since.toISOString())
        .order('reviewed_at', { ascending: true })
        .limit(5000);

export const fetchStudyPlanSettings = (userId: string) =>
    supabase.from('profiles').select('study_plan').eq('id', userId).maybeSingle();

export const saveStudyPlanSettings = (userId: string, settings: PlanSettings) =>
    supabase.from('profiles').update({ study_plan: settings }).eq('id', userId);
