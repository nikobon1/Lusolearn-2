import { conjugate, personsFor } from './conjugation';
import type { Person, Tense } from './conjugation';

export interface DrillVerb {
    infinitive: string;
    translation: string;
    /** Frequency rank (lower = more frequent); undefined for verbs outside the dictionary */
    rank?: number;
}

export interface ExampleSentence {
    sentence: string;
    translation: string;
}

export interface DrillItem {
    key: string; // "fazer|presente|eu"
    verb: DrillVerb;
    tense: Tense;
    person: Person;
    answer: string;
    /** Real sentence with the form blanked out, when one exists */
    context?: { before: string; after: string; translation: string };
}

/** Per-form results, used to bring weak forms back more often. */
export type DrillStats = Record<string, { right: number; wrong: number }>;

export const drillKey = (verb: string, tense: Tense, person: Person) => `${verb}|${tense}|${person}`;

const WORD = 'a-zA-ZÀ-ÿ';
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A short example sentence that contains exactly this form, with the form blanked out. */
export const findContext = (form: string, examples: ExampleSentence[]): DrillItem['context'] => {
    const re = new RegExp(`(^|[^${WORD}])(${escapeRe(form)})(?=[^${WORD}]|$)`, 'i');
    const candidates = examples
        .filter(ex => ex.sentence && ex.sentence.split(/\s+/).length <= 15)
        .sort((a, b) => a.sentence.length - b.sentence.length);
    for (const ex of candidates) {
        const m = re.exec(ex.sentence);
        if (!m) continue;
        const start = m.index + m[1].length;
        return { before: ex.sentence.slice(0, start), after: ex.sentence.slice(start + m[2].length), translation: ex.translation };
    }
    return undefined;
};

/**
 * Picks `count` exercises. Weight: weak forms (wrong answers) ×, well-known forms ÷,
 * more frequent verbs ×. No same verb twice in a row.
 */
export const buildDrill = (
    verbs: DrillVerb[],
    tenses: Tense[],
    count: number,
    stats: DrillStats,
    examplesByVerb: Record<string, ExampleSentence[]>,
    random: () => number = Math.random
): DrillItem[] => {
    const pool: { item: DrillItem; weight: number }[] = [];
    verbs.forEach((verb, index) => {
        const table = conjugate(verb.infinitive);
        if (!table) return;
        const freqBoost = 1 / (1 + index / 15);
        for (const tense of tenses) {
            for (const person of personsFor(verb.infinitive)) {
                const answer = table[tense][person];
                const key = drillKey(verb.infinitive, tense, person);
                const s = stats[key] || { right: 0, wrong: 0 };
                const weight = freqBoost * (1 + 3 * s.wrong) / (1 + 0.7 * s.right);
                pool.push({
                    item: { key, verb, tense, person, answer, context: findContext(answer, examplesByVerb[verb.infinitive] || []) },
                    weight,
                });
            }
        }
    });

    const picked: DrillItem[] = [];
    const available = [...pool];
    while (picked.length < count && available.length > 0) {
        const last = picked[picked.length - 1];
        const candidates = available.filter(p => !last || p.item.verb.infinitive !== last.verb.infinitive || available.every(a => a.item.verb.infinitive === last.verb.infinitive));
        const total = candidates.reduce((sum, p) => sum + p.weight, 0);
        let r = random() * total;
        let chosen = candidates[candidates.length - 1];
        for (const c of candidates) {
            r -= c.weight;
            if (r <= 0) { chosen = c; break; }
        }
        picked.push(chosen.item);
        available.splice(available.indexOf(chosen), 1);
    }
    return picked;
};
