import { GenerateContentResponse } from "@google/genai";
import { getAIClient, callWithRetry } from "./client";
import { findGlobalImage, saveGlobalImage } from "./supabase";
import { supabase } from "./supabase";

// Orchestrator for Images: Cache -> GenAI -> Save -> Return
export const getOrGenerateImage = async (prompt: string, word: string): Promise<string> => {
    // 1. Check Global Cache first
    const cachedUrl = await findGlobalImage(word);
    if (cachedUrl) {
        console.log(`[Image] ☁️ Global Cache HIT: "${word}"`);
        return cachedUrl;
    }

    console.log(`[Image] 💨 Global Cache MISS: "${word}"`);

    // 2. Generate
    console.log(`[Image] 🤖 Generating AI Image for: "${word}"`);
    const base64Image = await generateImage(prompt);

    // 3. Save to Global Cache (async)
    const savedUrl = await saveGlobalImage(word, base64Image);

    if (savedUrl) {
        console.log(`[Image] 💾 Saved to Global Cache: "${word}"`);
        return savedUrl;
    }

    return `data:image/png;base64,${base64Image}`;
};

export const generateImage = async (prompt: string): Promise<string> => {
    const ai = getAIClient();

    const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: { parts: [{ text: prompt }] },
    }));

    if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
                return part.inlineData.data;
            }
        }
    }

    throw new Error("No image generated");
};

// Regenerate images for cards without image URLs
export const regenerateMissingImages = async (
    cards: Array<{ id: string; originalTerm: string; translation: string; imageUrl?: string }>,
    onProgress: (current: number, total: number, word: string) => void,
    onCardUpdated: (cardId: string, imageUrl: string) => void
): Promise<number> => {
    const cardsWithoutImages = cards.filter(c => !c.imageUrl || c.imageUrl === '');
    let regenerated = 0;

    for (let i = 0; i < cardsWithoutImages.length; i++) {
        const card = cardsWithoutImages[i];
        onProgress(i + 1, cardsWithoutImages.length, card.originalTerm);

        try {
            const prompt = `A realistic, life-like illustration of "${card.originalTerm}" (${card.translation}). Show a concrete scene or object that represents this word. Style: Modern digital art, warm colors, soft lighting, educational flashcard style. No text or letters in the image.`;
            const imageUrl = await getOrGenerateImage(prompt, card.originalTerm);

            // Update in database
            await supabase
                .from('flashcards')
                .update({ image_url: imageUrl })
                .eq('id', card.id);

            onCardUpdated(card.id, imageUrl);
            regenerated++;

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.error(`Failed to regenerate image for ${card.originalTerm}:`, error);
        }
    }

    return regenerated;
};
