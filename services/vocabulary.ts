import { Type } from "./geminiSchema";
import { generateContent, callWithRetry } from "./client";
import { VocabularyItem, AICardDetails, Example } from "../types";
import { buildCardDetailsRequest } from "../shared/cardDetailsSpec";
import { MODELS, thinkingFor } from '../shared/models';

export interface VocabularyExtractionResult {
    items: VocabularyItem[];
    suggestedFolder: string;
}

const hasCyrillic = (text: string): boolean => /[А-Яа-яЁё]/.test(text);

export const translateExplanationToRussian = async (text: string): Promise<string> => {
    const trimmed = (text || '').trim();
    if (!trimmed || hasCyrillic(trimmed)) return trimmed;

    const schema = {
        type: Type.OBJECT,
        properties: {
            ru: { type: Type.STRING }
        },
        required: ["ru"]
    };

    const response = await callWithRetry(() => generateContent({
        model: MODELS.textLite,
        contents: {
            parts: [{
                text: `Translate this grammar explanation into Russian.
Return JSON only.
Keep the meaning exact and concise (1-2 short sentences).
Text: ${JSON.stringify(trimmed)}`
            }]
        } as any,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            ...thinkingFor(MODELS.textLite),
        }
    }));

    const payload = response.text ? JSON.parse(response.text) as { ru?: string } : null;
    return payload?.ru?.trim() || trimmed;
};

export const enforceRussianPatternExplanations = async (examples: Example[]): Promise<Example[]> => {
    const toTranslate: { exIndex: number; patternIndex: number; text: string }[] = [];

    examples.forEach((ex, exIndex) => {
        ex.patterns?.forEach((pattern, patternIndex) => {
            const explanation = (pattern.explanation || '').trim();
            if (!explanation) return;
            if (hasCyrillic(explanation)) return;
            toTranslate.push({ exIndex, patternIndex, text: explanation });
        });
    });

    if (toTranslate.length === 0) return examples;

    const translated = await Promise.all(toTranslate.map(item => translateExplanationToRussian(item.text)));

    return examples.map((ex, exIndex) => ({
        ...ex,
        patterns: ex.patterns?.map((pattern, patternIndex) => {
            const translationIdx = toTranslate.findIndex(x => x.exIndex === exIndex && x.patternIndex === patternIndex);
            if (translationIdx === -1) return pattern;
            const ruText = translated[translationIdx];
            return ruText ? { ...pattern, explanation: ruText } : pattern;
        })
    }));
};

export const extractVocabulary = async (
    input: string | { imageBase64: string; mimeType: string },
    mode: 'text' | 'image',
    count: number = 5
): Promise<VocabularyExtractionResult> => {
    const extractionSchema = {
        type: Type.OBJECT,
        properties: {
            suggestedFolder: {
                type: Type.STRING,
                description: "Suggested folder name in Russian based on the theme of all words (e.g. 'Еда', 'Путешествия', 'Дом', 'Работа', 'Глаголы движения'). Should be short, 1-2 words."
            },
            items: {
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
            }
        },
        required: ["suggestedFolder", "items"]
    };

    const prompt = `
    Analyze the input. Identify exactly ${count} key words/phrases for learning European Portuguese.
    
    RULES:
    1. If NOUN, include definite article (o/a/os/as).
    2. If VERB, provide infinitive.
    3. Context in Russian.
    4. Suggest a folder name in Russian that best describes all these words thematically (e.g. "Еда", "Природа", "Одежда", "Глаголы").

    Return JSON with suggestedFolder and items array.
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

    const response = await callWithRetry(() => generateContent({
        model: MODELS.text,
        contents: contents as any,
        config: {
            responseMimeType: "application/json",
            responseSchema: extractionSchema,
            ...thinkingFor(MODELS.text),
        }
    }));

    const text = response.text;
    if (!text) throw new Error("No vocabulary found");

    const result = JSON.parse(text) as { suggestedFolder: string; items: VocabularyItem[] };
    return {
        items: result.items || [],
        suggestedFolder: result.suggestedFolder || 'Разное'
    };
};

export const generateCardDetails = async (word: string): Promise<AICardDetails> => {
    const response = await callWithRetry(() => generateContent(buildCardDetailsRequest(word) as any));

    const text = response.text;
    if (!text) throw new Error("No details generated");
    const parsed = JSON.parse(text) as AICardDetails;
    parsed.examples = await enforceRussianPatternExplanations(parsed.examples || []);
    return parsed;
};

export const enrichCardPatterns = async (originalTerm: string, examples: Example[]): Promise<Example[]> => {
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
    const response = await callWithRetry(() => generateContent({
        model: MODELS.text,
        contents: { parts: [{ text: `${prompt}\n${JSON.stringify(examples)}` }] } as any,
        config: { responseMimeType: "application/json", responseSchema: schema, ...thinkingFor(MODELS.text) }
    }));

    const text = response.text;
    if (!text) return examples;
    const result = JSON.parse(text) as { level: string, patterns: any[] }[];
    const enrichedExamples = examples.map(ex => {
        const enriched = result.find(r => r.level === ex.level);
        return enriched ? { ...ex, patterns: enriched.patterns } : ex;
    });
    return enforceRussianPatternExplanations(enrichedExamples);
};
