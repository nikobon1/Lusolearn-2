import { supabase } from '../supabase';
import { VideoLesson } from '../../types';
import { isMissingSchemaError } from './reviewLogRepository';

/**
 * Video lessons: Supabase table `video_lessons` for signed-in users;
 * localStorage in offline mode or until the migration has been applied.
 */

const localKey = (userId?: string) => `luso_lessons_${userId || 'guest'}`;

const readLocal = (userId?: string): VideoLesson[] => {
    try {
        const raw = localStorage.getItem(localKey(userId));
        return raw ? (JSON.parse(raw) as VideoLesson[]) : [];
    } catch {
        return [];
    }
};

const writeLocal = (userId: string | undefined, lessons: VideoLesson[]) => {
    try {
        localStorage.setItem(localKey(userId), JSON.stringify(lessons));
    } catch {
        // storage full/unavailable
    }
};

const isOnline = (userId?: string) => !!userId && userId !== 'offline';

const fromRow = (row: any): VideoLesson => ({
    id: row.id,
    title: row.title,
    url: row.url || undefined,
    videoId: row.video_id || undefined,
    transcript: row.transcript,
    analysis: row.analysis,
    createdAt: new Date(row.created_at).getTime(),
});

export interface LessonsResult {
    lessons: VideoLesson[];
    /** false = stored only in this browser (offline mode or migration not applied) */
    synced: boolean;
}

export const loadLessons = async (userId?: string): Promise<LessonsResult> => {
    const local = readLocal(userId);
    if (!isOnline(userId)) return { lessons: local, synced: false };

    const { data, error } = await supabase
        .from('video_lessons')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    if (error) {
        if (!isMissingSchemaError(error)) console.error('[Lessons] load failed', error);
        return { lessons: local, synced: false };
    }
    const remote = (data || []).map(fromRow);
    // Lessons saved locally before the table existed are kept in the list
    const remoteIds = new Set(remote.map(l => l.id));
    return { lessons: [...remote, ...local.filter(l => !remoteIds.has(l.id))], synced: true };
};

export const saveLesson = async (userId: string | undefined, lesson: VideoLesson): Promise<boolean> => {
    if (isOnline(userId)) {
        const { error } = await supabase.from('video_lessons').insert({
            id: lesson.id,
            user_id: userId,
            title: lesson.title,
            url: lesson.url || null,
            video_id: lesson.videoId || null,
            transcript: lesson.transcript,
            analysis: lesson.analysis,
            created_at: new Date(lesson.createdAt).toISOString(),
        });
        if (!error) return true;
        if (!isMissingSchemaError(error)) console.error('[Lessons] save failed', error);
    }
    writeLocal(userId, [lesson, ...readLocal(userId).filter(l => l.id !== lesson.id)]);
    return false;
};

export const deleteLesson = async (userId: string | undefined, lessonId: string) => {
    writeLocal(userId, readLocal(userId).filter(l => l.id !== lessonId));
    if (!isOnline(userId)) return;
    const { error } = await supabase.from('video_lessons').delete().eq('id', lessonId);
    if (error && !isMissingSchemaError(error)) console.error('[Lessons] delete failed', error);
};
