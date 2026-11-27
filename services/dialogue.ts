import { Type } from "./geminiSchema";
import { generateContent, callWithRetry } from "./client";
import type { DialogueTurn, Scenario } from "../domain/dialogues";
import type { CefrLevel } from "../domain/reviewExercise";
import { MODELS, thinkingFor } from '../shared/models';

export interface DialogueReply {
    check: { ok: boolean; corrected: string; correctedRu: string; note: string };
    reply: string;
    replyRu: string;
    goalsDone: number[];
    hint: string;
    hintRu: string;
    finished: boolean;
}

/**
 * One turn of a role-play: checks the learner's line, answers in character,
 * tracks the scenario goals and suggests what the learner could say next.
 */
export const dialogueTurn = async (
    scenario: Scenario,
    history: DialogueTurn[],
    learnerLine: string,
    level: CefrLevel,
    goalsDone: number[],
): Promise<DialogueReply> => {
    const schema = {
        type: Type.OBJECT,
        properties: {
            check: { type: Type.OBJECT, properties: { ok: { type: Type.BOOLEAN }, corrected: { type: Type.STRING }, correctedRu: { type: Type.STRING }, note: { type: Type.STRING } }, required: ['ok', 'corrected', 'correctedRu', 'note'] },
            reply: { type: Type.STRING },
            replyRu: { type: Type.STRING },
            goalsDone: { type: Type.ARRAY, items: { type: Type.INTEGER } },
            hint: { type: Type.STRING },
            hintRu: { type: Type.STRING },
            finished: { type: Type.BOOLEAN },
        },
        required: ['check', 'reply', 'replyRu', 'goalsDone', 'hint', 'hintRu', 'finished'],
    };

    const transcript = history.map(t => `${t.who === 'ai' ? 'YOU' : 'LEARNER'}: ${t.pt}`).join('\n');
    const prompt = `You are role-playing to help someone practise EUROPEAN Portuguese (Portugal; never Brazilian forms: "autocarro", "pequeno-almoço", "está a fazer"; the learner may use "tu" or "você").
Your role: ${scenario.role}
Learner level: ${level}. Don't assume the learner's gender (avoid gendered words like obrigado/obrigada about them, vizinho/vizinha, cansado/cansada addressed to them). Speak naturally but simply for this level: short sentences (max ~15 words), common words, one question at a time.
Learner's goals in this scene (0-based): ${scenario.goals.map((g, i) => `${i}. ${g}`).join('; ')}. Already reached: ${goalsDone.join(', ') || 'none'}.

Conversation so far:
${transcript}
LEARNER: ${learnerLine}

The learner's line may come from speech recognition (ignore punctuation/capitals). Return JSON:
- check: ok = true if the line is understandable and grammatically acceptable; corrected = the line in correct, natural European Portuguese (same meaning; same as the original if it was fine); correctedRu = its Russian translation; note = one short tip in Russian about the main mistake (empty if ok). Address the learner as "вы", avoid gendered verb forms.
- reply: your next line in character (Portuguese), reacting to what the learner said. If they said something unclear, ask politely in simple words.
- replyRu: Russian translation of reply.
- goalsDone: indices of ALL goals reached so far (including earlier ones).
- hint: a short example of what the learner could say next (Portuguese, at their level; for words that depend on the learner's gender write both forms, e.g. "Obrigado/a"); hintRu: its translation.
- finished: true when all goals are reached and the scene naturally ends (then reply is a friendly goodbye).`;

    const response = await callWithRetry(() => generateContent({
        model: MODELS.text,
        contents: { parts: [{ text: prompt }] } as any,
        config: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.7, ...thinkingFor(MODELS.text) },
    }));
    if (!response.text) throw new Error("Empty dialogue reply");
    const parsed = JSON.parse(response.text) as DialogueReply;
    parsed.goalsDone = [...new Set([...goalsDone, ...(parsed.goalsDone || [])])].filter(i => i >= 0 && i < scenario.goals.length);
    return parsed;
};
