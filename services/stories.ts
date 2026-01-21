import { Type, GenerateContentResponse } from "@google/genai";
import { getAIClient, callWithRetry } from "./client";

export const generateStoryFromWords = async (words: string[]): Promise<{ pt: string, ru: string, audioBase64?: string }> => {
    const ai = getAIClient();
    const schema = {
        type: Type.OBJECT,
        properties: {
            pt: { type: Type.STRING },
            ru: { type: Type.STRING }
        },
        required: ["pt", "ru"]
    };

    const prompt = `
        Create a simple European Portuguese story (A2-B1) using: ${words.join(', ')}.
        1-3 sentences. Return PT text and RU translation.
    `;

    const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [{ text: prompt }] } as any,
        config: { responseMimeType: "application/json", responseSchema: schema }
    }));

    const text = response.text;
    if (!text) throw new Error("Failed to generate story");
    return JSON.parse(text);
};
