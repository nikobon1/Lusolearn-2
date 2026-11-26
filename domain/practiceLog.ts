/**
 * Results of the phrase and conjugation trainers.
 * Every answer is one log entry; per-item stats (used to bring weak items back more often)
 * and "practised today" counts are derived from the log, so they are the same on every device.
 */

export type PracticeKind = 'phrase' | 'conjugation';
/** `override` = "my answer was right too": turns an earlier wrong into a right. */
export type PracticeVerdict = 'correct' | 'almost' | 'wrong' | 'override';

export type ItemStats = Record<string, { right: number; wrong: number }>;

export interface PracticeEntry {
    id: string;
    kind: PracticeKind;
    key: string;
    verdict: PracticeVerdict;
    at: number;
}

export const applyVerdict = (
    kind: PracticeKind,
    s: { right: number; wrong: number } = { right: 0, wrong: 0 },
    verdict: PracticeVerdict
) => {
    switch (verdict) {
        case 'correct': return { ...s, right: s.right + 1 };
        // Conjugation: right form with an accent slip is half a mistake; phrases: "almost" counts as right
        case 'almost': return kind === 'conjugation' ? { right: s.right + 1, wrong: s.wrong + 0.5 } : { ...s, right: s.right + 1 };
        case 'wrong': return { ...s, wrong: s.wrong + 1 };
        case 'override': return { right: s.right + 1, wrong: Math.max(0, s.wrong - 1) };
    }
};

export const statsFromEntries = (entries: PracticeEntry[], kind: PracticeKind): ItemStats => {
    const stats: ItemStats = {};
    for (const e of entries) if (e.kind === kind) stats[e.key] = applyVerdict(kind, stats[e.key], e.verdict);
    return stats;
};

/** Per item, the larger of two stats (server log vs. this device's history from before sync). */
export const mergeStats = (a: ItemStats, b: ItemStats): ItemStats => {
    const out: ItemStats = { ...a };
    for (const [key, s] of Object.entries(b)) {
        const o = out[key];
        out[key] = o ? { right: Math.max(o.right, s.right), wrong: Math.max(o.wrong, s.wrong) } : s;
    }
    return out;
};

export const dayKey = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Answers given today (first tries; overrides don't count as extra answers). */
export const answeredOn = (entries: PracticeEntry[], kind: PracticeKind, day: string) =>
    entries.filter(e => e.kind === kind && e.verdict !== 'override' && dayKey(e.at) === day);

/** Days (YYYY-MM-DD) on which this kind was practised. */
export const practiceDays = (entries: PracticeEntry[], kind: PracticeKind) =>
    new Set(entries.filter(e => e.kind === kind).map(e => dayKey(e.at)));
