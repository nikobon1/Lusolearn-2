import { Type, GenerateContentResponse } from "@google/genai";
import { getAIClient, callWithRetry } from "./client";
import { VocabularyItem, AICardDetails, Example } from "../types";

export const extractVocabulary = async (
    input: string | { imageBase64: string; mimeType: string },
    mode: 'text' | 'image',
    count: number = 5
): Promise<VocabularyItem[]> => {
    const ai = getAIClient();

    const extractionSchema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                word: { type: Type.STRING, description: "The extracted Portuguese word (lemma/dictionary form). If Noun, include Article." },
                translation: { type: Type.STRING, description: "Russian translation." },
                context: { type: Type.STRING, description: "Краткое объяснение на РУССКОМ языке, почему это слово выделено (контекст)." }
            },
            required: ["word", "translation", "context"]
        }
    };

    const prompt = `
    Analyze the input. Identify exactly ${count} key words/phrases for learning European Portuguese.
    
    RULES:
    1. If NOUN, include definite article (o/a/os/as).
    2. If VERB, provide infinitive.
    3. Context in Russian.

    Return JSON array.
  `;

    let contents;
    if (mode === 'image' && typeof input !== 'string') {
        contents = {
            parts: [
                { inlineData: { mimeType: input.mimeType, data: input.imageBase64 } },
                { text: prompt }
            ]
        };
    } else {
        contents = {
            parts: [{ text: `${prompt}\n\nInput Text: "${input}"` }]
        };
    }

    const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: contents as any,
        config: {
            responseMimeType: "application/json",
            responseSchema: extractionSchema,
        }
    }));

    const text = response.text;
    if (!text) throw new Error("No vocabulary found");
    return JSON.parse(text) as VocabularyItem[];
};

export const generateCardDetails = async (word: string): Promise<AICardDetails> => {
    const ai = getAIClient();

    const verbFormsSchema = {
        type: Type.OBJECT,
        properties: {
            eu: { type: Type.STRING },
            tu: { type: Type.STRING },
            ele: { type: Type.STRING },
            nos: { type: Type.STRING },
            eles: { type: Type.STRING }
        },
        required: ["eu", "tu", "ele", "nos", "eles"]
    };

    const detailSchema = {
        type: Type.OBJECT,
        properties: {
            definition: { type: Type.STRING },
            grammarNotes: { type: Type.STRING },
            visualPrompt: { type: Type.STRING },
            frequency: {
                type: Type.STRING,
                enum: ["Top 500", "Top 1000", "Top 3000", "Top 5000", "10000+"]
            },
            conjugation: {
                type: Type.OBJECT,
                properties: {
                    isVerb: { type: Type.BOOLEAN },
                    tenses: {
                        type: Type.OBJECT,
                        properties: {
                            presente: verbFormsSchema,
                            perfeito: verbFormsSchema,
                            imperfeito: verbFormsSchema,
                            futuro: verbFormsSchema
                        }
                    }
                },
                required: ["isVerb"]
            },
            examples: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        level: { type: Type.STRING, enum: ["A1", "A2", "B1", "B2"] },
                        sentence: { type: Type.STRING },
                        translation: { type: Type.STRING },
                        patterns: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    target: { type: Type.STRING },
                                    explanation: { type: Type.STRING }
                                },
                                required: ["target", "explanation"]
                            }
                        }
                    },
                    required: ["level", "sentence", "translation"]
                }
            }
        },
        required: ["definition", "grammarNotes", "examples", "visualPrompt", "conjugation"]
    };

    const systemInstruction = `
    Create a study card for: "${word}".
    Target: European Portuguese.
    Output Language for explanations: Russian.
    
    Requirements:
    1. Definition in simple PT.
    2. 4 Examples (A1-B2).
    3. Visual prompt: Write a detailed prompt for generating a REALISTIC, life-like illustration of this word. 
       The prompt should describe a concrete scene or object that represents the word's meaning.
       Style: Modern digital art, warm colors, soft lighting, educational flashcard style.
       Example for "o pão": "A freshly baked loaf of bread on a wooden cutting board, with steam rising, warm kitchen background"
    4. Grammar notes in Russian.
    5. Frequency rank estimate.
    6. Conjugation if verb (Present, Perf, Imperf, Future).
  `;

    const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [{ text: `Generate details for "${word}"` }] } as any,
        config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
            responseSchema: detailSchema,
        }
    }));

    const text = response.text;
    if (!text) throw new Error("No details generated");
    return JSON.parse(text) as AICardDetails;
};

export const enrichCardPatterns = async (originalTerm: string, examples: Example[]): Promise<Example[]> => {
    const ai = getAIClient();
    const schema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                level: { type: Type.STRING },
                patterns: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            target: { type: Type.STRING },
                            explanation: { type: Type.STRING }
                        },
                        required: ["target", "explanation"]
                    }
                }
            },
            required: ["level", "patterns"]
        }
    };

    const prompt = `Проанализируй грамматические паттерны в этих предложениях для слова "${originalTerm}". 
    ВАЖНО: Объяснения (explanation) ОБЯЗАТЕЛЬНО на РУССКОМ языке. 
    target - это португальское слово/фраза из предложения.
    explanation - объяснение грамматического правила НА РУССКОМ.`;
    const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [{ text: `${prompt}\n${JSON.stringify(examples)}` }] } as any,
        config: { responseMimeType: "application/json", responseSchema: schema }
    }));

    const text = response.text;
    if (!text) return examples;
    const result = JSON.parse(text) as { level: string, patterns: any[] }[];
    return examples.map(ex => {
        const enriched = result.find(r => r.level === ex.level);
        return enriched ? { ...ex, patterns: enriched.patterns } : ex;
    });
};
