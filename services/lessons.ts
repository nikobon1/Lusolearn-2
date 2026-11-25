import { Type } from './geminiSchema';
import { generateContent, callWithRetry } from './client';
import { LessonAnalysis, LessonItem } from '../types';
import { TranscriptLine, numberedForPrompt } from '../domain/transcript';

const MAX_ITEMS = 20;

/**
 * One Gemini call per lesson: topic, summary, language variant and the key words/phrases,
 * each tied to the transcript line where it is used.
 */
export const analyzeTranscript = async (
    lines: TranscriptLine[],
    userTitle?: string
): Promise<{ analysis: LessonAnalysis; truncated: boolean }> => {
    const { text, truncated } = numberedForPrompt(lines);

    const schema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING, description: 'Short lesson title in Russian (2-5 words), e.g. "В банке: открытие счёта"' },
            summary: { type: Type.STRING, description: 'What happens in the video, 2-4 sentences in Russian' },
            variant: { type: Type.STRING, enum: ['pt-PT', 'pt-BR', 'mixed', 'unknown'] },
            items: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        term: { type: Type.STRING, description: 'Single word in dictionary form (nouns with o/a article, verbs in infinitive) OR a useful phrase exactly as said' },
                        kind: { type: Type.STRING, enum: ['word', 'phrase'] },
                        translation: { type: Type.STRING, description: 'Russian translation' },
                        line: { type: Type.INTEGER, description: 'Number N of the line "LN:" where it occurs' },
                        lineTranslation: { type: Type.STRING, description: 'Russian translation of that whole line' },
                        note: { type: Type.STRING, description: 'Optional short usage note in Russian (European Portuguese specifics, register)' },
                    },
                    required: ['term', 'kind', 'translation', 'line', 'lineTranslation'],
                },
            },
        },
        required: ['title', 'summary', 'variant', 'items'],
    };

    const prompt = `You are preparing a lesson for a Russian-speaking beginner learning EUROPEAN Portuguese (Portugal), focused on everyday situations.
Below is a video transcript, one numbered line per "LN:".

Tasks:
1. title and summary in Russian${userTitle ? ` (the learner called it: "${userTitle}")` : ''}.
2. variant: is the speech European (pt-PT) or Brazilian (pt-BR) Portuguese?
3. Pick up to ${MAX_ITEMS} items most useful for real-life situations:
   - about half: ready-made PHRASES / chunks people actually say ("Queria abrir uma conta", "Pode repetir, por favor?"), copied as said;
   - the rest: key WORDS in dictionary form (nouns with article, verbs in infinitive);
   - prefer frequent, reusable language over names and rare words; no duplicates.
4. For each item give the line number where it occurs and the Russian translation of that line.
Explanations in Russian. Return JSON only.

TRANSCRIPT:
${text}`;

    const response = await callWithRetry(() => generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: prompt }] },
        config: { responseMimeType: 'application/json', responseSchema: schema },
    }));
    if (!response.text) throw new Error('Empty lesson analysis');

    const raw = JSON.parse(response.text) as LessonAnalysis;
    const validLines = new Set(lines.map(l => l.index));
    const seen = new Set<string>();
    const items: LessonItem[] = (raw.items || [])
        .filter(it => it?.term?.trim() && it.translation)
        .filter(it => {
            const key = it.term.trim().toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .map(it => ({
            term: it.term.trim(),
            kind: (it.kind === 'phrase' ? 'phrase' : 'word') as LessonItem['kind'],
            translation: it.translation.trim(),
            line: validLines.has(it.line) ? it.line : -1,
            lineTranslation: it.lineTranslation || '',
            note: it.note?.trim() || undefined,
        }))
        .slice(0, MAX_ITEMS);

    return {
        analysis: {
            title: raw.title?.trim() || userTitle || 'Видеоурок',
            summary: raw.summary?.trim() || '',
            variant: (['pt-PT', 'pt-BR', 'mixed'] as const).includes(raw.variant as any) ? raw.variant : 'unknown',
            items,
        },
        truncated,
    };
};
