import { PlanSettings, PlanSummary } from './dailyPlan';
import { PracticeEntry, answeredOn, dayKey, practiceDays } from './practiceLog';
import { Situation, SITUATIONS, TEMPLATES } from './phraseTemplates';
import type { Topic } from './frequencyDictionary';

/**
 * "Занятие на сегодня": a short route through the day so the learner never has to decide what to do.
 * Order follows the evidence: retrieval of due items first (forgetting is the most urgent),
 * a small dose of new words, then production (phrases, verb forms), interleaved by type.
 */

export type RouteStepId = 'reviews' | 'new' | 'addWords' | 'phrases' | 'conjugation' | 'story';

export interface RouteStep {
    id: RouteStepId;
    title: string;
    detail: string;
    /** Rough minutes left for this step */
    minutes: number;
    done: boolean;
    /** Shown but not actionable today (e.g. new words paused because of a backlog) */
    skipped?: boolean;
    /** Suggested, but the day counts as done without it (adding more words) */
    optional?: boolean;
    /** Phrases: situation to practise */
    situation?: Situation;
}

export const PHRASES_PER_DAY = 5;
export const CONJUGATIONS_PER_DAY = 5;

export interface RouteInput {
    summary: PlanSummary;
    settings: PlanSettings;
    entries: PracticeEntry[];
    /** Topics of the words learned today (from the frequency dictionary) — phrases follow them */
    todayTopics: Topic[];
    /** The learner has verbs among their cards */
    hasVerbs: boolean;
    /** Offer a graded story (enough words being learned, or already read today) */
    story?: { done: boolean; episode: number };
    now?: number;
}

const TOPIC_TO_SITUATION: Partial<Record<Topic, Situation>> = {
    food: 'cafe', shop: 'shop', transport: 'transport', health: 'health', admin: 'admin', social: 'talk', home: 'talk', time: 'talk',
};

const templateSituation = new Map(TEMPLATES.map(t => [t.id, t.situation]));
const situationLabel = (s: Situation) => SITUATIONS.find(x => x.id === s)!.label;

/** Situation for today's phrases: the topic of today's new words, else the one not practised for longest. */
export const pickSituation = (entries: PracticeEntry[], todayTopics: Topic[], now = Date.now()): Situation => {
    const today = dayKey(now);
    // Already started today — keep the same situation
    const todays = entries.filter(e => e.kind === 'phrase' && dayKey(e.at) === today);
    if (todays.length) {
        const s = templateSituation.get(todays[todays.length - 1].key.split('|')[0]);
        if (s) return s;
    }
    const counts = new Map<Situation, number>();
    for (const t of todayTopics) {
        const s = TOPIC_TO_SITUATION[t];
        if (s) counts.set(s, (counts.get(s) || 0) + 1);
    }
    const fromWords = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (fromWords) return fromWords;

    const lastSeen = new Map<Situation, number>();
    for (const e of entries) {
        if (e.kind !== 'phrase') continue;
        const s = templateSituation.get(e.key.split('|')[0]);
        if (s) lastSeen.set(s, Math.max(lastSeen.get(s) || 0, e.at));
    }
    // Never practised first (in the listed order: café → shop → …), then the oldest
    return [...SITUATIONS].map(s => s.id).sort((a, b) => (lastSeen.get(a) || 0) - (lastSeen.get(b) || 0))[0];
};

export const buildTodayRoute = ({ summary, settings, entries, todayTopics, hasVerbs, story, now = Date.now() }: RouteInput): RouteStep[] => {
    const steps: RouteStep[] = [];
    const today = dayKey(now);
    const yesterday = dayKey(now - 86_400_000);

    // 1. Reviews
    const reviewsTotal = summary.reviewsDone + summary.reviewsLeft;
    if (reviewsTotal > 0) {
        steps.push({
            id: 'reviews',
            title: 'Повторить слова',
            detail: summary.reviewsLeft > 0 ? `${summary.reviewsLeft} к повторению` : `${summary.reviewsDone} повторено`,
            minutes: Math.ceil(summary.reviewsLeft * 10 / 60),
            done: summary.reviewsLeft === 0,
        });
    }

    // 2. New words (or: add them first)
    if (settings.newPerDay > 0) {
        if (summary.newPaused) {
            steps.push({
                id: 'new', title: 'Новые слова', detail: 'Сегодня пропускаем: сначала разберём накопившиеся повторения',
                minutes: 0, done: false, skipped: true,
            });
        } else if (summary.newLeft > 0 || summary.newDone > 0) {
            steps.push({
                id: 'new',
                title: 'Новые слова',
                detail: summary.newLeft > 0 ? `${summary.newLeft} новых` : `${summary.newDone} выучено`,
                minutes: Math.ceil(summary.newLeft * 25 / 60),
                done: summary.newLeft === 0,
            });
        } else {
            steps.push({
                id: 'addWords', title: 'Добавить новые слова', detail: 'Новые карточки закончились — возьмите следующие в «С нуля»',
                minutes: 1, done: false, optional: true,
            });
        }
    }

    // 3. Phrases — every day: production of whole sentences
    const phrasesToday = answeredOn(entries, 'phrase', today).length;
    const situation = pickSituation(entries, todayTopics, now);
    steps.push({
        id: 'phrases',
        title: 'Сказать фразами',
        detail: phrasesToday >= PHRASES_PER_DAY
            ? `${phrasesToday} фраз собрано`
            : `${PHRASES_PER_DAY - phrasesToday} фраз · ${situationLabel(situation)}`,
        minutes: phrasesToday >= PHRASES_PER_DAY ? 0 : 3,
        done: phrasesToday >= PHRASES_PER_DAY,
        situation,
    });

    // 4. Verb forms — every other day (or today, if started): short and spaced
    const conjToday = answeredOn(entries, 'conjugation', today).length;
    const conjYesterday = practiceDays(entries, 'conjugation').has(yesterday);
    if (conjToday > 0 || !conjYesterday) {
        steps.push({
            id: 'conjugation',
            title: 'Глаголы',
            detail: conjToday >= CONJUGATIONS_PER_DAY
                ? `${conjToday} форм`
                : `${CONJUGATIONS_PER_DAY - conjToday} форм · ${hasVerbs ? 'ваши глаголы' : 'самые частые глаголы'}`,
            minutes: conjToday >= CONJUGATIONS_PER_DAY ? 0 : 2,
            done: conjToday >= CONJUGATIONS_PER_DAY,
        });
    }

    // 5. Reading — optional bonus: today's fragile words in a short story
    if (story) {
        steps.push({
            id: 'story',
            title: 'Прочитать историю',
            detail: story.done ? 'прочитано' : `серия ${story.episode} · ваши новые слова в тексте`,
            minutes: story.done ? 0 : 3,
            done: story.done,
            optional: true,
        });
    }

    return steps;
};

const isOpen = (s: RouteStep) => !s.done && !s.skipped;

/** The step the main button leads to: required steps first, then suggestions. */
export const nextStep = (steps: RouteStep[]) =>
    steps.find(s => isOpen(s) && !s.optional) || steps.find(s => isOpen(s) && s.optional) || null;

/** Everything required for today is done (optional suggestions may remain). */
export const routeDone = (steps: RouteStep[]) => !steps.some(s => isOpen(s) && !s.optional);
