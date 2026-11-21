import { Difficulty, Flashcard } from '../types';
import { generateCardDetails } from './vocabulary';
import { getOrGenerateImage } from './images';

const IMAGE_STYLE_SUFFIX = ", photorealistic educational flashcard image, single clear main subject, real-world scene, natural colors, natural lighting, realistic textures, clean background, no text, no letters, no logos, no abstract art, no symbolism, no surreal elements, no flat vector style";

export interface BuildCardOptions {
    folderIds: string[];
    tags?: string[];
    /** Overrides the AI frequency estimate (e.g. real rank bucket from the frequency dictionary). */
    frequency?: string;
    /** If AI generation fails, still create a minimal card with the given translation. */
    allowFallback?: boolean;
}

export const buildFlashcard = async (
    word: string,
    translation: string,
    { folderIds, tags = [], frequency, allowFallback = false }: BuildCardOptions
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
        details = await generateCardDetails(word);
    } catch (error) {
        if (!allowFallback) throw error;
        console.warn(`Card details generation failed for "${word}", creating minimal card`, error);
        return { ...base, definition: '', examples: [], frequency };
    }

    let imageUrl: string | undefined;
    if (details.visualPrompt) {
        try {
            imageUrl = await getOrGenerateImage(details.visualPrompt + IMAGE_STYLE_SUFFIX, word);
        } catch (imgErr) {
            console.warn('Image generation failed:', imgErr);
        }
    }

    return {
        ...base,
        definition: details.definition || 'Definition unavailable',
        examples: details.examples || [],
        grammarNotes: details.grammarNotes,
        conjugation: details.conjugation,
        imageUrl,
        imagePrompt: details.visualPrompt,
        frequency: frequency ?? details.frequency,
    };
};
