import { Difficulty } from '../../types';
import { supabase } from '../supabase';

export const updateFlashcardSrs = async (
    cardId: string,
    interval: number,
    nextReviewDate: number,
    easeFactor: number,
    difficulty: Difficulty
) => {
    return supabase
        .from('flashcards')
        .update({
            interval,
            next_review_date: nextReviewDate,
            ease_factor: easeFactor,
            difficulty,
        })
        .eq('id', cardId);
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
