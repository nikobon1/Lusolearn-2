import { Difficulty, Example, Flashcard } from '../types';
import { getWordDetails } from './wordEntries';
import { getOrGenerateImage } from './images';
import { isAiAccountError } from './client';

const IMAGE_STYLE_SUFFIX = ", photorealistic educational flashcard image, single clear main subject, real-world scene, natural colors, natural lighting, realistic textures, clean background, no text, no letters, no logos, no abstract art, no symbolism, no surreal elements, no flat vector style";

export interface BuildCardOptions {
    folderIds: string[];
    tags?: string[];
    /** Overrides the AI frequency estimate (e.g. real rank bucket from the frequency dictionary). */
    frequency?: string;
    /** If AI generation fails, still create a minimal card with the given translation. */
    allowFallback?: boolean;
    /** Real usage (e.g. a line from a video lesson) shown as the first example. */
    extraExample?: Example;
}

export const buildFlashcard = async (
    word: string,
    translation: string,
    { folderIds, tags = [], frequency, allowFallback = false, extraExample }: BuildCardOptions
): Promise<Flashcard> => {
    const now = Date.now();
    const base = {
        id: self.crypto.randomUUID(),
        folderIds,
        tags,
        originalTerm: word,
        translation,
        difficulty: Difficulty.New,
        nextReviewDate: now,
        interval: 0,
        easeFactor: 2.5,
        createdAt: now,
    };

    let details;
    try {
        details = (await getWordDetails(word, translation)).details;
    } catch (error) {
        if (!allowFallback || isAiAccountError(error)) throw error;
        console.warn(`Card details generation failed for "${word}", creating minimal card`, error);
        return { ...base, definition: '', examples: extraExample ? [extraExample] : [], frequency };
    }

    let imageUrl: string | undefined;
    // Shared image cache is keyed by word; entries filled from old cards may have no visual prompt
    const visualPrompt = details.visualPrompt
        || `A realistic everyday scene clearly illustrating the Portuguese word "${word}" (meaning: ${translation})`;
    {
        try {
            imageUrl = await getOrGenerateImage(visualPrompt + IMAGE_STYLE_SUFFIX, word);
        } catch (imgErr) {
            console.warn('Image generation failed:', imgErr);
        }
    }

    return {
        ...base,
        definition: details.definition || 'Definition unavailable',
        examples: [...(extraExample ? [extraExample] : []), ...(details.examples || [])],
        grammarNotes: details.grammarNotes,
        conjugation: details.conjugation,
        imageUrl,
        imagePrompt: visualPrompt,
        frequency: frequency ?? details.frequency,
    };
};
