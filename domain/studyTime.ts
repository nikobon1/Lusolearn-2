import { dayKey } from './practiceLog';

/** Seconds of study per day: { "2026-11-27": 840, … } */
export type DaySeconds = Record<string, number>;
/** Per device, so two devices' time adds up instead of overwriting each other. */
export type StudyTimeStore = Record<string, DaySeconds>;

const DAY = 86_400_000;
/** A pause longer than this between answers is not counted as study time */
const MAX_GAP_MS = 2 * 60_000;
/** Time credited for the first answer of a sitting (reading the card, thinking) */
const FIRST_ANSWER_MS = 20_000;

export const sumDevices = (store: StudyTimeStore | null | undefined): DaySeconds => {
    const out: DaySeconds = {};
    for (const days of Object.values(store || {})) {
        for (const [d, s] of Object.entries(days || {})) out[d] = (out[d] || 0) + (Number(s) || 0);
    }
    return out;
};

/**
 * Estimate for days before the timer existed: answers close together form a sitting;
 * the time between them counts (capped), plus a little for the first answer.
 */
export const estimateFromAnswers = (timestamps: number[]): DaySeconds => {
    const out: DaySeconds = {};
    const sorted = [...timestamps].sort((a, b) => a - b);
    let prev = 0;
    for (const t of sorted) {
        const gap = t - prev;
        const add = prev && gap <= MAX_GAP_MS && dayKey(t) === dayKey(prev) ? gap : FIRST_ANSWER_MS;
        out[dayKey(t)] = (out[dayKey(t)] || 0) + add / 1000;
        prev = t;
    }
    return out;
};

/** Tracked time where it exists, the estimate for older days. */
export const combineStudyTime = (tracked: DaySeconds, estimated: DaySeconds): DaySeconds => {
    const out: DaySeconds = { ...estimated };
    for (const [d, s] of Object.entries(tracked)) if (s > 0) out[d] = s;
    return out;
};

export const lastDays = (seconds: DaySeconds, days = 7, now = Date.now()) =>
    Array.from({ length: days }, (_, i) => {
        const date = new Date(now - (days - 1 - i) * DAY);
        return { date, minutes: Math.round((seconds[dayKey(date.getTime())] || 0) / 60) };
    });

export const formatMinutes = (min: number) => {
    if (min < 60) return `${min} мин`;
    const h = Math.floor(min / 60), m = min % 60;
    return m ? `${h} ч ${m} мин` : `${h} ч`;
};
