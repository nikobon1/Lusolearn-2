import { Difficulty } from '../../types';
import { supabase } from '../supabase';

/** Set once the database reports that flashcards.difficulty doesn't exist (migration not applied yet). */
let difficultyColumnMissing = false;

const isMissingColumn = (error: { code?: string; message?: string } | null) =>
    !!error && (error.code === 'PGRST204' || error.code === '42703' || /difficulty/i.test(error.message || '') && /column/i.test(error.message || ''));

/**
 * Saves a card's schedule. If the `difficulty` column is missing, the whole update used to be
 * rejected (schedules were never saved); now it retries without that field.
 */
export const updateFlashcardSrs = async (
    cardId: string,
    interval: number,
    nextReviewDate: number,
    easeFactor: number,
    difficulty: Difficulty
) => {
    const schedule = { interval, next_review_date: nextReviewDate, ease_factor: easeFactor };
    if (!difficultyColumnMissing) {
        const result = await supabase.from('flashcards').update({ ...schedule, difficulty }).eq('id', cardId);
        if (!isMissingColumn(result.error)) return result;
        difficultyColumnMissing = true;
        console.warn('[SRS] flashcards.difficulty column is missing — saving schedule without it. Run supabase/migrations/20261127_word_entries.sql.');
    }
    return supabase.from('flashcards').update(schedule).eq('id', cardId);
};

export const deleteFlashcardsByIds = async (cardIds: string[]) => {
    if (cardIds.length === 0) return { error: null };
    return supabase
        .from('flashcards')
        .delete()
        .in('id', cardIds);
};

export const updateFlashcardFolders = async (cardId: string, folderIds: string[]) => {
    return supabase
        .from('flashcards')
        .update({ folder_ids: folderIds })
        .eq('id', cardId);
};
