import { Type, GenerateContentResponse } from "@google/genai";
import { getAIClient, callWithRetry } from "./client";
import { Flashcard, Folder } from "../types";

export interface SmartSortSuggestion {
    action: 'move' | 'create';
    targetFolderId: string;
    suggestedFolderName?: string;
    cardIds: string[];
}

export const suggestSmartSorting = async (cards: Flashcard[], folders: Folder[]): Promise<SmartSortSuggestion[]> => {
    const ai = getAIClient();
    const cardSimplified = cards.map(c => ({ id: c.id, term: c.originalTerm }));
    const folderSimplified = folders.map(f => ({ id: f.id, name: f.name })).filter(f => f.id !== 'default');

    if (cardSimplified.length === 0) return [];

    const schema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                action: { type: Type.STRING, enum: ["move", "create"] },
                targetFolderId: { type: Type.STRING },
                suggestedFolderName: { type: Type.STRING },
                cardIds: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["action", "targetFolderId", "cardIds"]
        }
    };

    const prompt = `Sort these cards into folders. Create new folders (in Russian) if needed for clusters > 1 card.`;

    const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [{ text: `${prompt}\nFolders: ${JSON.stringify(folderSimplified)}\nCards: ${JSON.stringify(cardSimplified)}` }] } as any,
        config: { responseMimeType: "application/json", responseSchema: schema }
    }));

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);
};
