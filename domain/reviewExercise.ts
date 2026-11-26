import { Flashcard } from '../types';

/**
 * Which exercise to show for a card during review.
 * One SRS schedule per card; the exercise gets harder as the card matures:
 *   new / learning  -> recognition (PT -> RU, translation hidden)
 *   interval 1-2 d  -> cloze (sentence from the card's examples with a gap)
 *   interval >= 3 d -> production (RU -> PT, type or say) alternating with cloze
 */
export type Exercise =
    | { type: 'recognition' }
    | { type: 'production' }
    | {
        type: 'cloze';
        before: string;
        answer: string;
        after: string;
        translation: string;
        /** Lemma shown as a hint when the gap holds an inflected form (fiz ← fazer) */
        lemmaHint?: string;
    };

export type AnswerVerdict = 'correct' | 'almost' | 'wrong';

const ARTICLE = /^(o|a|os|as|um|uma|uns|umas)\s+/i;
const PUNCT = /[.,!?¿¡;:"«»()…]/g;

export const stripArticle = (s: string) => s.replace(ARTICLE, '');

const normalize = (s: string) =>
    s.toLowerCase().replace(PUNCT, '').replace(/\s+/g, ' ').trim();

const removeAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

const levenshtein = (a: string, b: string): number => {
    if (a === b) return 0;
    const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let diag = prev[0];
        prev[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const tmp = prev[j];
            prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
            diag = tmp;
        }
    }
    return prev[b.length];
};

/**
 * Compares a typed answer with the expected Portuguese.
 * - article is optional ("casa" for "a casa")
 * - missing/wrong accents or one typo in a longer word -> "almost"
 */
export const checkAnswer = (input: string, expected: string): AnswerVerdict => {
    const given = normalize(input);
    const target = normalize(expected);
    if (!given) return 'wrong';

    const variants = Array.from(new Set([target, stripArticle(target)]));
    const givenVariants = Array.from(new Set([given, stripArticle(given)]));

    for (const g of givenVariants) {
        if (variants.includes(g)) return 'correct';
    }
    for (const g of givenVariants) {
        for (const v of variants) {
            if (removeAccents(g) === removeAccents(v)) return 'almost';
            if (v.length >= 5 && levenshtein(removeAccents(g), removeAccents(v)) === 1) return 'almost';
        }
    }
    return 'wrong';
};

const WORD_CHARS = 'a-zA-ZÀ-ÿ';

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const VERB_SUFFIXES: Record<string, string[]> = {
    ar: ['ar', 'o', 'as', 'a', 'amos', 'ámos', 'am', 'ei', 'aste', 'ou', 'aram', 'ava', 'avas', 'ávamos', 'avam', 'arei', 'arás', 'ará', 'aremos', 'arão', 'aria', 'e', 'es', 'emos', 'em', 'ado', 'ada', 'ados', 'adas', 'ando'],
    er: ['er', 'o', 'es', 'e', 'emos', 'em', 'i', 'este', 'eu', 'eram', 'ia', 'ias', 'íamos', 'iam', 'erei', 'erá', 'eremos', 'erão', 'eria', 'a', 'as', 'amos', 'am', 'ido', 'ida', 'idos', 'idas', 'endo'],
    ir: ['ir', 'o', 'es', 'e', 'imos', 'em', 'i', 'iste', 'iu', 'iram', 'ia', 'ias', 'íamos', 'iam', 'irei', 'irá', 'iremos', 'irão', 'iria', 'a', 'as', 'amos', 'am', 'ido', 'ida', 'idos', 'idas', 'indo'],
};

/** Likely word forms of a lemma: regular verb endings or noun/adjective gender and plural. */
const candidateForms = (lemma: string): string[] => {
    const l = lemma.toLowerCase();
    const ending = l.slice(-2);
    if (l.length > 3 && VERB_SUFFIXES[ending]) {
        const stem = l.slice(0, -2);
        return VERB_SUFFIXES[ending].map(suf => stem + suf);
    }
    const forms = [l, l + 's', l + 'es'];
    if (l.endsWith('o')) forms.push(l.slice(0, -1) + 'a', l.slice(0, -1) + 'as');
    if (l.endsWith('ão')) forms.push(l.slice(0, -2) + 'ões', l.slice(0, -2) + 'ães', l.slice(0, -2) + 'ãos');
    if (l.endsWith('l')) forms.push(l.slice(0, -1) + 'is');
    if (l.endsWith('m')) forms.push(l.slice(0, -1) + 'ns');
    return forms;
};

const findWord = (sentence: string, word: string): { start: number; end: number } | null => {
    if (!word) return null;
    const re = new RegExp(`(^|[^${WORD_CHARS}])(${escapeRegExp(word)})(?=[^${WORD_CHARS}]|$)`, 'i');
    const m = re.exec(sentence);
    if (!m) return null;
    const start = m.index + m[1].length;
    return { start, end: start + m[2].length };
};

/**
 * Finds the card's term inside an example sentence: the exact term (with or
 * without article), then known forms (conjugation table of the card), then
 * regular inflections (falo ← falar, casas ← casa). Whole words only.
 */
export const findTermInSentence = (
    sentence: string,
    term: string,
    knownForms: string[] = []
): { start: number; end: number } | null => {
    const lemma = stripArticle(term.trim());
    if (!lemma) return null;

    const exact = findWord(sentence, lemma);
    if (exact) return exact;
    if (/\s/.test(lemma)) return null; // multi-word terms: exact match only

    const forms = [...knownForms, ...candidateForms(lemma)]
        .map(f => f.trim())
        .filter(f => f && !/\s/.test(f))
        .sort((a, b) => b.length - a.length);
    for (const form of forms) {
        const pos = findWord(sentence, form);
        if (pos) return pos;
    }
    return null;
};

/** Forms from the AI-generated conjugation table (handles irregulars: fiz, fez, feito…). */
const conjugationForms = (card: Flashcard): string[] => {
    const tenses = card.conjugation?.isVerb ? card.conjugation.tenses : undefined;
    if (!tenses) return [];
    return Object.values(tenses).flatMap(forms => Object.values(forms || {}) as string[]);
};

/** All gap-fill variants available for this card (one per example that contains the term). */
export const buildClozeOptions = (card: Flashcard): Extract<Exercise, { type: 'cloze' }>[] => {
    const lemma = stripArticle(card.originalTerm.trim());
    const options: Extract<Exercise, { type: 'cloze' }>[] = [];
    const forms = conjugationForms(card);
    for (const ex of card.examples || []) {
        if (!ex?.sentence) continue;
        if (ex.source && ex.sentence.length > 200) continue; // long transcript chunks make poor gap-fills
        const pos = findTermInSentence(ex.sentence, card.originalTerm, forms);
        if (!pos) continue;
        const answer = ex.sentence.slice(pos.start, pos.end);
        options.push({
            type: 'cloze',
            before: ex.sentence.slice(0, pos.start),
            answer,
            after: ex.sentence.slice(pos.end),
            translation: ex.translation,
            lemmaHint: answer.toLowerCase() !== lemma.toLowerCase() ? lemma : undefined,
        });
    }
    return options;
};

const hash = (s: string) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
};

/**
 * Picks the exercise. Deterministic for a card on a given day/attempt,
 * but rotates between days so the same card is practised in different ways.
 */
export const chooseExercise = (card: Flashcard, attempt = 0, now = Date.now()): Exercise => {
    // New cards and cards re-shown after a mistake in this session: plain recognition first
    if (card.interval <= 0 || attempt > 0) return { type: 'recognition' };

    const day = Math.floor(now / 86_400_000);
    const seed = hash(card.id) + day + attempt;
    const clozes = buildClozeOptions(card);

    if (card.interval < 3) {
        return clozes.length ? clozes[seed % clozes.length] : { type: 'recognition' };
    }

    // Mature card: alternate production and cloze
    if (clozes.length && seed % 2 === 1) return clozes[seed % clozes.length];
    return { type: 'production' };
};
