import { GenerateContentResponse } from "@google/genai";
import { getAIClient, callWithRetry } from "./client";
import { findGlobalImage, saveGlobalImage } from "./supabase";

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
