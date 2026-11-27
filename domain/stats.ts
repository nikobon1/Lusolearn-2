import { Flashcard } from '../types';
import { FrequencyEntry, entryKey, normalizeTerm } from './frequencyDictionary';
import { PracticeEntry, dayKey } from './practiceLog';
import { TEMPLATES, SITUATIONS, Situation } from './phraseTemplates';
import { TENSE_LABELS, Tense } from './conjugation';
import type { ReviewRating } from './srs';

const DAY = 86_400_000;

export interface ReviewRecord {
    cardId: string;
    rating: ReviewRating;
    wasNew: boolean;
    attempt: number;
    intervalAfter: number | null;
    at: number;
}

// ---------- Stages ----------

export type Stage = 'new' | 'learning' | 'known' | 'solid';
export const STAGE_LABELS: Record<Stage, { label: string; hint: string }> = {
    new: { label: 'Новые', hint: 'ещё не изучали' },
    learning: { label: 'Учу', hint: 'интервал меньше недели' },
    known: { label: 'Знаю', hint: 'интервал 1–3 недели' },
    solid: { label: 'Закреплено', hint: 'интервал больше 3 недель' },
};

export const stageOf = (card: Flashcard): Stage =>
    card.interval <= 0 ? 'new' : card.interval < 7 ? 'learning' : card.interval <= 21 ? 'known' : 'solid';

export const stageCounts = (cards: Flashcard[]) => {
    const counts: Record<Stage, number> = { new: 0, learning: 0, known: 0, solid: 0 };
    cards.forEach(c => { counts[stageOf(c)]++; });
    return counts;
};

// ---------- Coverage of everyday speech ----------

export interface Coverage {
    /** Share of running speech made of words you know (interval ≥ 7 days, or marked "know") */
    known: number;
    /** Including words still being learned */
    withLearning: number;
    nextMilestone: number | null;
    /** Most frequent words still missing to reach the milestone */
    wordsToMilestone: number;
}

const MILESTONES = [0.3, 0.4, 0.5, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9];

export const speechCoverage = (dictionary: FrequencyEntry[], cards: Flashcard[], markedKnown: Set<string>): Coverage => {
    const best = new Map<string, number>();
    cards.forEach(c => {
        const k = normalizeTerm(c.originalTerm);
        best.set(k, Math.max(best.get(k) ?? -1, c.interval));
    });
    let known = 0, withLearning = 0;
    const missing: FrequencyEntry[] = [];
    for (const e of dictionary) {
        if (e.p === 'phrase') continue;
        const k = entryKey(e);
        const interval = best.get(k);
        const isKnown = markedKnown.has(k) || (interval !== undefined && interval >= 7);
        if (isKnown) known += e.ipm;
        if (isKnown || (interval !== undefined && interval > 0)) withLearning += e.ipm;
        if (!isKnown) missing.push(e);
    }
    const share = Math.min(known / 1_000_000, 1);
    const nextMilestone = MILESTONES.find(m => m > share + 0.001) ?? null;
    let wordsToMilestone = 0;
    if (nextMilestone !== null) {
        let acc = known;
        for (const e of missing) { // dictionary order = most frequent first
            if (acc / 1_000_000 >= nextMilestone) break;
            acc += e.ipm;
            wordsToMilestone++;
        }
        if (acc / 1_000_000 < nextMilestone) wordsToMilestone = 0; // not reachable within the dictionary
    }
    return { known: share, withLearning: Math.min(withLearning / 1_000_000, 1), nextMilestone: wordsToMilestone ? nextMilestone : null, wordsToMilestone };
};

// ---------- Activity & streak ----------

/** Answers per day (reviews + phrases + verbs); learningHistory fills days before logs existed. */
export const activityByDay = (records: ReviewRecord[], practice: PracticeEntry[], learningHistory: Record<string, number> = {}) => {
    const days = new Map<string, number>();
    const add = (d: string, n = 1) => days.set(d, (days.get(d) || 0) + n);
    records.forEach(r => add(dayKey(r.at)));
    practice.forEach(p => { if (p.verdict !== 'override') add(dayKey(p.at)); });
    Object.entries(learningHistory).forEach(([d, n]) => { if (!days.has(d) && n > 0) days.set(d, n); });
    return days;
};

/** Consecutive days with activity, ending today (or yesterday — today isn't over yet). */
export const currentStreak = (activity: Map<string, number>, now = Date.now()) => {
    let day = now;
    if (!activity.get(dayKey(day))) day -= DAY;
    let streak = 0;
    while (activity.get(dayKey(day))) { streak++; day -= DAY; }
    return streak;
};

// ---------- Recall accuracy ----------

export interface Accuracy { share: number; total: number }

/** First-try recall of cards seen before, over the last `days` days. */
export const recallAccuracy = (records: ReviewRecord[], days = 14, now = Date.now()): Accuracy => {
    const recent = records.filter(r => !r.wasNew && r.attempt === 0 && r.at >= now - days * DAY);
    const ok = recent.filter(r => r.rating !== 'again').length;
    return { share: recent.length ? ok / recent.length : 0, total: recent.length };
};

export type AccuracyAdvice = { tone: 'low' | 'ok' | 'high'; text: string; suggestNewPerDay?: number };

export const accuracyAdvice = (acc: Accuracy, newPerDay: number): AccuracyAdvice | null => {
    if (acc.total < 20) return null;
    if (acc.share < 0.8) {
        const fewer = Math.max(3, Math.min(newPerDay - 5, 5));
        return { tone: 'low', text: 'Слова забываются чаще нормы — новых слов многовато. Стоит снизить темп, пока повторения не устоятся.', suggestNewPerDay: newPerDay > 5 ? fewer : undefined };
    }
    if (acc.share > 0.95) {
        return { tone: 'high', text: 'Почти всё вспоминаете с первого раза — можно брать больше новых слов.', suggestNewPerDay: newPerDay < 20 ? Math.min(20, newPerDay + 5) : undefined };
    }
    return { tone: 'ok', text: 'Отличный баланс: слова закрепляются, а новые не перегружают.' };
};

// ---------- Hard words ----------

export const hardWords = (records: ReviewRecord[], cards: Flashcard[], n = 5, days = 60, now = Date.now()) => {
    const lapses = new Map<string, number>();
    records.forEach(r => { if (r.rating === 'again' && r.at >= now - days * DAY) lapses.set(r.cardId, (lapses.get(r.cardId) || 0) + 1); });
    const byId = new Map(cards.map(c => [c.id, c]));
    return [...lapses.entries()]
        .filter(([id, count]) => count >= 2 && byId.has(id))
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([id, count]) => ({ card: byId.get(id)!, lapses: count }));
};

// ---------- Forecast ----------

/** Reviews falling due on each of the next `days` days (today includes everything overdue). */
export const reviewForecast = (cards: Flashcard[], days = 7, now = Date.now()) => {
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const counts = Array(days).fill(0) as number[];
    cards.forEach(c => {
        if (c.interval <= 0) return; // new cards come via the daily new-word limit
        const idx = Math.max(0, Math.floor((c.nextReviewDate - start.getTime()) / DAY));
        if (idx < days) counts[idx]++;
    });
    return counts.map((count, i) => ({ date: new Date(start.getTime() + i * DAY), count }));
};

// ---------- Phrases & verbs ----------

export interface PracticeScore { label: string; share: number; total: number }

const scoreBy = (entries: PracticeEntry[], groupOf: (e: PracticeEntry) => string | null): Map<string, { ok: number; total: number }> => {
    const map = new Map<string, { ok: number; total: number }>();
    for (const e of entries) {
        const g = groupOf(e);
        if (!g) continue;
        const s = map.get(g) || { ok: 0, total: 0 };
        if (e.verdict === 'override') s.ok++; // "my answer was right too": the earlier wrong becomes right
        else { s.total++; if (e.verdict !== 'wrong') s.ok++; }
        map.set(g, s);
    }
    return map;
};

const templateSituation = new Map(TEMPLATES.map(t => [t.id, t.situation]));

export const practiceScores = (entries: PracticeEntry[], days = 30, now = Date.now()) => {
    const recent = entries.filter(e => e.at >= now - days * DAY);
    const toList = (map: Map<string, { ok: number; total: number }>, label: (k: string) => string): PracticeScore[] =>
        [...map.entries()].filter(([, s]) => s.total >= 3)
            .map(([k, s]) => ({ label: label(k), share: Math.min(1, s.ok / s.total), total: s.total }))
            .sort((a, b) => a.share - b.share);
    const phrases = scoreBy(recent.filter(e => e.kind === 'phrase'), e => templateSituation.get(e.key.split('|')[0]) ?? null);
    const verbs = scoreBy(recent.filter(e => e.kind === 'conjugation'), e => e.key.split('|')[1] || null);
    return {
        phrases: toList(phrases, k => SITUATIONS.find(s => s.id === (k as Situation))?.label || k),
        verbs: toList(verbs, k => TENSE_LABELS[k as Tense]?.pt || k),
    };
};
