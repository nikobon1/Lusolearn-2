import { Flashcard } from '../types';
import { normalizeTerm } from '../shared/wordKeys';

export interface DuplicateGroup {
    key: string;
    /** Card that stays (best progress, then richest content) */
    keep: Flashcard;
    /** Copies that will be merged into `keep` and deleted */
    remove: Flashcard[];
}

/** Score for choosing the card to keep: learning progress first, then content. */
const score = (c: Flashcard) =>
    c.interval * 1000
    + (c.examples?.filter(e => !e.source).length || 0) * 10
    + (c.imageUrl ? 5 : 0)
    + (c.definition ? 2 : 0);

/** Cards with the same word (article and case ignored), e.g. "trabalhar" added from two places. */
export const findDuplicateGroups = (cards: Flashcard[]): DuplicateGroup[] => {
    const byKey = new Map<string, Flashcard[]>();
    for (const c of cards) {
        const key = normalizeTerm(c.originalTerm);
        if (!key) continue;
        byKey.set(key, [...(byKey.get(key) || []), c]);
    }
    const groups: DuplicateGroup[] = [];
    for (const [key, list] of byKey) {
        if (list.length < 2) continue;
        const sorted = [...list].sort((a, b) => score(b) - score(a) || a.createdAt - b.createdAt);
        groups.push({ key, keep: sorted[0], remove: sorted.slice(1) });
    }
    return groups.sort((a, b) => a.key.localeCompare(b.key));
};

/** The kept card with folders, tags, examples and missing content taken from the copies. */
export const mergeGroup = (group: DuplicateGroup): Flashcard => {
    const all = [group.keep, ...group.remove];
    const seenSentences = new Set<string>();
    const examples = all.flatMap(c => c.examples || []).filter(ex => {
        const k = (ex.sentence || '').trim().toLowerCase();
        if (!k || seenSentences.has(k)) return false;
        seenSentences.add(k);
        return true;
    });
    const pick = <K extends keyof Flashcard>(field: K) =>
        group.keep[field] || group.remove.find(c => c[field])?.[field];
    return {
        ...group.keep,
        folderIds: [...new Set(all.flatMap(c => c.folderIds || []))],
        tags: [...new Set(all.flatMap(c => c.tags || []))],
        examples,
        definition: (pick('definition') as string) || '',
        grammarNotes: pick('grammarNotes') as string | undefined,
        conjugation: pick('conjugation') as Flashcard['conjugation'],
        imageUrl: pick('imageUrl') as string | undefined,
        audioBase64: pick('audioBase64') as string | undefined,
    };
};
