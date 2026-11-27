import type { GradedStory } from "../domain/gradedStory";
import { SERIES_BIBLE, SERIES_NAME } from "../domain/gradedStory";
import type { CefrLevel } from "../domain/reviewExercise";
import { Type } from "./geminiSchema";
import { generateContent, callWithRetry } from "./client";
import { MODELS, thinkingFor } from '../shared/models';

export const generateStoryFromWords = async (words: string[]): Promise<{ pt: string, ru: string, audioBase64?: string }> => {
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

    const response = await callWithRetry(() => generateContent({
        model: MODELS.text,
        contents: { parts: [{ text: prompt }] } as any,
        config: { responseMimeType: "application/json", responseSchema: schema, ...thinkingFor(MODELS.text) }
    }));

    const text = response.text;
    if (!text) throw new Error("Failed to generate story");
    return JSON.parse(text);
};

// ---------- Graded stories ----------


export interface GradedStoryRequest {
    targetWords: string[];
    /** Words the learner knows (most frequent first) — the story should be written mostly from them */
    knownWords: string[];
    level: CefrLevel;
    /** Continue the series: recaps of previous episodes (oldest first) */
    series?: { episode: number; previous: { episode: number; title: string; summary: string }[] };
    /** Ask for an easier version: these words were unknown last time */
    simpler?: { avoid: string[] };
}

const LEVEL_GUIDE: Record<CefrLevel, string> = {
    A1: 'A1: 6-8 very short sentences (5-9 words), present tense, simple word order, the most common everyday words only.',
    A2: 'A2: 7-9 short sentences, present + pretérito perfeito, everyday vocabulary.',
    B1: 'B1: 8-10 sentences, natural past tenses, some connectors (porque, quando, depois).',
    B2: 'B2: 9-11 sentences, natural style.',
};

export const generateGradedStory = async (req: GradedStoryRequest): Promise<Omit<GradedStory, 'targetWords' | 'level' | 'series'>> => {
    const schema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            sentences: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { pt: { type: Type.STRING }, ru: { type: Type.STRING } }, required: ['pt', 'ru'] } },
            glossary: {
                type: Type.ARRAY,
                items: { type: Type.OBJECT, properties: { form: { type: Type.STRING }, lemma: { type: Type.STRING }, ru: { type: Type.STRING }, name: { type: Type.BOOLEAN } }, required: ['form', 'lemma', 'ru'] },
            },
            questions: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: { q: { type: Type.STRING }, qRu: { type: Type.STRING }, options: { type: Type.ARRAY, items: { type: Type.STRING } }, answer: { type: Type.INTEGER } },
                    required: ['q', 'qRu', 'options', 'answer'],
                },
            },
            speak: { type: Type.OBJECT, properties: { qPt: { type: Type.STRING }, qRu: { type: Type.STRING }, sample: { type: Type.STRING } }, required: ['qPt', 'qRu', 'sample'] },
            summary: { type: Type.STRING },
        },
        required: ['title', 'sentences', 'glossary', 'questions', 'speak', 'summary'],
    };

    const seriesPart = req.series
        ? `This is episode ${req.series.episode} of the series "${SERIES_NAME}". ${SERIES_BIBLE}
${req.series.previous.length ? `Previous episodes (keep continuity, don't repeat the plot):\n${req.series.previous.map(p => `${p.episode}. ${p.title}: ${p.summary}`).join('\n')}` : 'This is the first episode: introduce the learner and Ana.'}`
        : 'A standalone everyday scene in Portugal.';

    const prompt = `
You write graded readers in EUROPEAN Portuguese (Portugal: "autocarro", "pequeno-almoço", "estás a fazer", "tu" forms; never Brazilian usage).
Level: ${LEVEL_GUIDE[req.level]}
${seriesPart}

MUST use each of these target words at least once (any grammatical form): ${req.targetWords.join(', ')}.
Write the rest of the story MAINLY with words from the learner's known vocabulary below, plus the most basic function words (o, a, de, em, e, que, não, é…). Avoid other vocabulary; if unavoidable, use very common words.
Known vocabulary: ${req.knownWords.slice(0, 400).join(', ') || '(beginner — use only the most common words)'}
${req.simpler ? `The previous version was too hard. Make it simpler and shorter, and do NOT use: ${req.simpler.avoid.join(', ')}.` : ''}

Return JSON:
- title: short Portuguese title.
- sentences: the story split into sentences, each with a natural Russian translation.
- glossary: EVERY distinct word form used in the story (each surface form once, lowercase except names): form, lemma (dictionary form: infinitive for verbs, masculine singular for adjectives, singular for nouns WITHOUT article), ru (short Russian meaning in this context). Mark person/place names with name=true.
- questions: 3 multiple-choice comprehension questions in simple Portuguese (q) with Russian translation (qRu), 3 options each in Portuguese, answer = index of the correct option (0-2). Vary the position of the correct answer.
- speak: one open question to answer aloud in one short sentence (qPt, qRu), plus a sample answer.
- summary: one Russian sentence recapping what happened (memory for the next episode).
`;

    const response = await callWithRetry(() => generateContent({
        model: MODELS.text,
        contents: { parts: [{ text: prompt }] } as any,
        config: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.8, ...thinkingFor(MODELS.text) },
    }));
    if (!response.text) throw new Error("Failed to generate story");
    const parsed = JSON.parse(response.text);
    parsed.questions = (parsed.questions || []).filter((q: any) => Array.isArray(q.options) && q.options.length >= 2 && q.answer >= 0 && q.answer < q.options.length);
    return parsed;
};

/** Checks a spoken one-sentence answer to the story's open question. */
export const judgeSpokenAnswer = async (questionPt: string, story: string, answer: string): Promise<{ ok: boolean; feedback: string; corrected: string }> => {
    const schema = {
        type: Type.OBJECT,
        properties: { ok: { type: Type.BOOLEAN }, feedback: { type: Type.STRING }, corrected: { type: Type.STRING } },
        required: ['ok', 'feedback', 'corrected'],
    };
    const prompt = `A learner of European Portuguese answered a question about a short story aloud (speech-to-text, so ignore punctuation and capitalisation).
Story: ${story}
Question: ${questionPt}
Answer: "${answer}"
Return JSON: ok = true if the answer makes sense for the question and is understandable (small mistakes are fine);
feedback = 1-2 short sentences in Russian: praise or what to fix (grammar/word choice), friendly. Address the learner as "вы" and avoid gendered verb forms (write "получилось", "ответ верный", not "ты построил/построила");
corrected = the answer rewritten in correct, natural European Portuguese (keep the learner's meaning).`;
    const response = await callWithRetry(() => generateContent({
        model: MODELS.text,
        contents: { parts: [{ text: prompt }] } as any,
        config: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.2, ...thinkingFor(MODELS.text) },
    }));
    if (!response.text) throw new Error("Failed to check answer");
    return JSON.parse(response.text);
};
