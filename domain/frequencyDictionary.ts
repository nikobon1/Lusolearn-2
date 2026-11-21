import { Flashcard } from '../types';
import { NormalizedFrequency } from './frequency';

export type PartOfSpeech = 'verb' | 'noun' | 'adj' | 'adv' | 'pron' | 'prep' | 'conj' | 'det' | 'num' | 'interj' | 'phrase';

/** Entry of data/frequencyDictionary.json (built by scripts/frequency/build.py). */
export interface FrequencyEntry {
    /** Frequency rank, 1 = most frequent */
    r: number;
    /** Portuguese lemma; nouns include the article ("a casa") */
    w: string;
    /** Russian translation */
    ru: string;
    p: PartOfSpeech;
    /** Occurrences per million words in the subtitle corpus */
    ipm: number;
    /** Irregular verb */
    irr?: boolean;
}

export const POS_LABELS: Record<PartOfSpeech, string> = {
    verb: 'глагол',
    noun: 'сущ.',
    adj: 'прил.',
    adv: 'нареч.',
    pron: 'местоим.',
    prep: 'предлог',
    conj: 'союз',
    det: 'артикль',
    num: 'числ.',
    interj: 'междом.',
    phrase: 'фраза',
};

export const FUNCTION_POS: PartOfSpeech[] = ['pron', 'prep', 'conj', 'det'];

export const FREQUENCY_TAG = 'частотный';
export const FREQUENCY_FOLDER_NAME = 'Частотный словарь';

let cache: Promise<FrequencyEntry[]> | null = null;

/** Lazily loads the dictionary so it does not bloat the main bundle. */
export const loadFrequencyDictionary = (): Promise<FrequencyEntry[]> => {
    if (!cache) {
        cache = import('../data/frequencyDictionary.json')
            .then(mod => (mod.default as FrequencyEntry[]))
            .catch(error => {
                cache = null;
                throw error;
            });
    }
    return cache;
};

const LEADING_ARTICLE = /^(o|a|os|as|um|uma|uns|umas)\s+(?=\S)/;

/** Normalizes a Portuguese term for matching: "A Casa." -> "casa". */
export const normalizeTerm = (term: string): string =>
    term
        .toLowerCase()
        .trim()
        .replace(/[.!?¿¡,;:"«»()]/g, '')
        .replace(/\s+/g, ' ')
        .replace(LEADING_ARTICLE, '')
        .trim();

export const entryKey = (entry: FrequencyEntry) => normalizeTerm(entry.w);

export const rankToFrequency = (rank: number): NormalizedFrequency => {
    if (rank <= 500) return 'Top 500';
    if (rank <= 1000) return 'Top 1000';
    if (rank <= 3000) return 'Top 3000';
    if (rank <= 5000) return 'Top 5000';
    return '10000+';
};

export const buildCardKeySet = (cards: Flashcard[]): Set<string> =>
    new Set(cards.map(c => normalizeTerm(c.originalTerm)));

export type EntryStatus = 'new' | 'inCards' | 'known';

export const getEntryStatus = (key: string, cardKeys: Set<string>, knownKeys: Set<string>): EntryStatus => {
    if (cardKeys.has(key)) return 'inCards';
    if (knownKeys.has(key)) return 'known';
    return 'new';
};

export type BatchFocus = 'all' | 'verbs' | 'content';

export const matchesFocus = (entry: FrequencyEntry, focus: BatchFocus) => {
    if (focus === 'verbs') return entry.p === 'verb';
    if (focus === 'content') return !FUNCTION_POS.includes(entry.p);
    return true;
};

/** Next most frequent words the learner has neither in cards nor marked as known. */
export const getNextBatch = (
    dictionary: FrequencyEntry[],
    cardKeys: Set<string>,
    knownKeys: Set<string>,
    size: number,
    focus: BatchFocus = 'all'
): FrequencyEntry[] => {
    const batch: FrequencyEntry[] = [];
    for (const entry of dictionary) {
        if (batch.length >= size) break;
        if (!matchesFocus(entry, focus)) continue;
        if (getEntryStatus(entryKey(entry), cardKeys, knownKeys) === 'new') batch.push(entry);
    }
    return batch;
};

export interface CoverageLevel {
    limit: number;
    label: string;
    learned: number;
    total: number;
}

/** How many of the top-N words the learner already covers (cards or marked known). */
export const getCoverageLevels = (
    dictionary: FrequencyEntry[],
    cardKeys: Set<string>,
    knownKeys: Set<string>
): CoverageLevel[] => {
    const limits = [100, 500, 1000, dictionary.length];
    return limits.map((limit, i) => {
        const slice = dictionary.slice(0, limit);
        const learned = slice.filter(e => getEntryStatus(entryKey(e), cardKeys, knownKeys) !== 'new').length;
        return {
            limit,
            label: i === limits.length - 1 ? 'Весь словарь' : `Топ-${limit}`,
            learned,
            total: slice.length,
        };
    });
};

/**
 * Approximate share of words in everyday speech (subtitle corpus tokens)
 * that belong to lemmas the learner covers. ipm = occurrences per million tokens.
 */
export const getTextCoverage = (
    dictionary: FrequencyEntry[],
    cardKeys: Set<string>,
    knownKeys: Set<string>
): number => {
    let known = 0;
    for (const e of dictionary) {
        if (e.p === 'phrase') continue; // phrase ipm is an estimate, avoid double counting
        if (getEntryStatus(entryKey(e), cardKeys, knownKeys) !== 'new') known += e.ipm;
    }
    return Math.min(known / 1_000_000, 1);
};
