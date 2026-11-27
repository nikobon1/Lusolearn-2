import { Flashcard } from '../types';
import { normalizeTerm } from './frequencyDictionary';
import { CefrLevel } from './reviewExercise';

/**
 * Graded reading: short stories written mostly from words the learner knows,
 * built around the words they are learning right now.
 */

export interface StorySentence { pt: string; ru: string }
export interface GlossEntry {
    /** Word as it appears in the text */
    form: string;
    /** Dictionary form (infinitive, singular…) */
    lemma: string;
    ru: string;
    /** Person or place name — not counted as vocabulary */
    name?: boolean;
}
export interface StoryQuestion { q: string; qRu: string; options: string[]; answer: number }

export interface GradedStory {
    title: string;
    series?: { name: string; episode: number };
    sentences: StorySentence[];
    glossary: GlossEntry[];
    questions: StoryQuestion[];
    speak: { qPt: string; qRu: string; sample: string };
    /** One-line recap (Russian) — memory for the next episode */
    summary: string;
    targetWords: string[];
    level: CefrLevel;
}

export const SERIES_NAME = 'Vida em Lisboa';
export const SERIES_BIBLE =
    'Recurring characters: the learner ("tu"), who recently moved to Lisbon; Ana, a friendly neighbour (around 30, works in a pharmacy); ' +
    'Sr. Manuel, the owner of the café downstairs; Rita, a colleague. Places: the street café, the market, the tram 28, the health centre, Finanças, the flat. ' +
    'Everyday situations only, warm and a little funny.';

export type StoryWordSource = 'consolidate' | 'folder' | 'recent';

const DAY = 86_400_000;

/**
 * "Для закрепления": words still fragile — hard words first, then the ones being learned
 * with the shortest intervals, then today's new words.
 */
export const pickConsolidationWords = (cards: Flashcard[], count: number, hardIds: string[] = [], now = Date.now()): Flashcard[] => {
    const startOfDay = new Date(now).setHours(0, 0, 0, 0);
    const byId = new Map(cards.map(c => [c.id, c]));
    const picked: Flashcard[] = [];
    const add = (c?: Flashcard) => { if (c && !picked.some(p => p.id === c.id) && picked.length < count) picked.push(c); };
    hardIds.forEach(id => add(byId.get(id)));
    cards.filter(c => c.interval > 0 && c.interval < 7).sort((a, b) => a.interval - b.interval).forEach(add);
    cards.filter(c => c.createdAt >= startOfDay).forEach(add);
    // Not enough fresh words: recently studied ones
    cards.filter(c => c.interval > 0).sort((a, b) => b.createdAt - a.createdAt).forEach(add);
    void DAY;
    return picked;
};

/**
 * Function words every story needs (articles, prepositions and their contractions, pronouns, "e", "que", "não"…).
 * They are explained in the glossary and counted as known, so the coverage reflects real vocabulary.
 */
export const BASIC_WORDS = new Set((
    'o a os as um uma uns umas de do da dos das em no na nos nas num numa ao à aos às pelo pela pelos pelas por para com sem ' +
    'e ou mas que se não sim eu tu ele ela nós vós eles elas me te lhe lhes nos vos se meu minha meus minhas teu tua teus tuas ' +
    'seu sua seus suas nosso nossa este esta estes estas isto esse essa isso aquele aquela aquilo muito mais também já só ' +
    'aqui ali lá como quando onde porque então até depois antes bem mal agora sempre nunca'
).split(' '));

/** Words the learner can be expected to recognise: basic function words, studied cards, words marked "know", the story's targets. */
export const knownLemmaSet = (cards: Flashcard[], markedKnown: Set<string>, targets: string[] = []) => {
    const set = new Set<string>([...BASIC_WORDS, ...markedKnown]);
    cards.forEach(c => { if (c.interval > 0) set.add(normalizeTerm(c.originalTerm)); });
    targets.forEach(t => set.add(normalizeTerm(t)));
    return set;
};

const WORD_RE = /[\p{L}][\p{L}'-]*/gu;
export const tokenize = (text: string) => text.match(WORD_RE) || [];

/** Looks a surface form up in the story's glossary. */
export const glossFor = (story: GradedStory, token: string): GlossEntry | undefined => {
    const t = token.toLowerCase();
    return story.glossary.find(g => g.form.toLowerCase() === t)
        || story.glossary.find(g => g.form.toLowerCase().split(/\s+/).includes(t));
};

/**
 * Share of running words the learner knows (names excluded). Graded readers aim for ~95%:
 * below ~90% reading turns into decoding.
 */
export const storyCoverage = (story: GradedStory, known: Set<string>) => {
    let total = 0, ok = 0;
    const unknown = new Map<string, GlossEntry>();
    for (const s of story.sentences) {
        for (const token of tokenize(s.pt)) {
            const g = glossFor(story, token);
            if (g?.name) continue;
            total++;
            const keys = [token.toLowerCase(), normalizeTerm(token), g ? normalizeTerm(g.lemma) : '', ...(g ? g.lemma.split('+').map(normalizeTerm) : [])].filter(Boolean);
            if (keys.some(k => known.has(k)) || (g && g.lemma.includes('+') && g.lemma.split('+').every(p => known.has(normalizeTerm(p))))) ok++;
            else if (g) unknown.set(normalizeTerm(g.lemma), g);
        }
    }
    return { share: total ? ok / total : 1, total, unknown: [...unknown.values()] };
};

export const isTargetToken = (story: GradedStory, token: string) => {
    const g = glossFor(story, token);
    const keys = new Set(story.targetWords.map(normalizeTerm));
    return keys.has(normalizeTerm(token)) || (!!g && keys.has(normalizeTerm(g.lemma)));
};

// ---------- Series memory (recaps of previous episodes) ----------

export interface EpisodeMemory { episode: number; title: string; summary: string; at: number }
const seriesKey = (userId?: string) => `luso_series_${userId || 'guest'}`;

export const readSeries = (userId?: string): EpisodeMemory[] => {
    try { return JSON.parse(localStorage.getItem(seriesKey(userId)) || '[]'); } catch { return []; }
};
export const rememberEpisode = (userId: string | undefined, ep: EpisodeMemory) => {
    const list = [...readSeries(userId).filter(e => e.episode !== ep.episode), ep].sort((a, b) => a.episode - b.episode).slice(-20);
    try { localStorage.setItem(seriesKey(userId), JSON.stringify(list)); } catch { /* unavailable */ }
};

// ---------- "Read a story today" (daily route) ----------

const readKey = (userId?: string) => `luso_story_read_${userId || 'guest'}`;
export const markStoryReadToday = (userId?: string) => {
    try { localStorage.setItem(readKey(userId), new Date().toDateString()); } catch { /* unavailable */ }
};
export const storyReadToday = (userId?: string) => {
    try { return localStorage.getItem(readKey(userId)) === new Date().toDateString(); } catch { return false; }
};
