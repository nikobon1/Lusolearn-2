import React, { useState } from 'react';
import {
    BACKLOG_PAUSE_THRESHOLD, NEW_PER_DAY_OPTIONS, PlanSettings, PlanSummary, REVIEWS_PER_DAY_OPTIONS,
} from '../domain/dailyPlan';
import { CheckCircleIcon, SettingsIcon, TargetIcon } from './Icons';
import { RouteStep, nextStep, routeDone } from '../domain/todayRoute';
import { CEFR_LEVELS, CefrLevel } from '../domain/reviewExercise';

interface Props {
    summary: PlanSummary;
    settings: PlanSettings;
    onChangeSettings: (patch: Partial<PlanSettings>) => void;
    onStart: () => void;
    steps: RouteStep[];
    onStep: (step: RouteStep) => void;
    onMorePhrases: () => void;
}

const Chips: React.FC<{ options: number[]; value: number; onChange: (n: number) => void }> = ({ options, value, onChange }) => (
    <div className="flex flex-wrap gap-1">
        {options.map(n => (
            <button key={n} onClick={() => onChange(n)} className={`h-8 min-w-[2.5rem] rounded-lg px-2 text-sm font-bold ${value === n ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'}`}>
                {n}
            </button>
        ))}
    </div>
);

const STEP_ICONS: Record<RouteStep['id'], string> = { reviews: '🔁', new: '✨', addWords: '➕', phrases: '💬', conjugation: '🔤' };

/**
 * «Занятие на сегодня»: today's route (reviews → new words → phrases → verbs) with one main button
 * that always leads to the next step.
 */
const DailyPlanWidget: React.FC<Props> = ({ summary, settings, onChangeSettings, onStart, steps, onStep, onMorePhrases }) => {
    const [showSettings, setShowSettings] = useState(false);
    const next = nextStep(steps);
    const done = routeDone(steps);
    const started = steps.some(s => s.done) || summary.reviewsDone + summary.newDone > 0;
    const minutesLeft = steps.filter(s => !s.done && !s.skipped && !s.optional).reduce((m, s) => m + s.minutes, 0);

    return (
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
                    <TargetIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Занятие на сегодня
                </h3>
                <button onClick={() => setShowSettings(v => !v)} className={`flex h-8 w-8 items-center justify-center rounded-full ${showSettings ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'}`} title="Настройки плана">
                    <SettingsIcon className="h-4 w-4" />
                </button>
            </div>

            {showSettings && (
                <div className="mb-4 space-y-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-700/40">
                    <div>
                        <p className="mb-1 text-xs font-bold text-slate-500 dark:text-slate-400">Новых слов в день</p>
                        <Chips options={NEW_PER_DAY_OPTIONS} value={settings.newPerDay} onChange={n => onChangeSettings({ newPerDay: n })} />
                    </div>
                    <div>
                        <p className="mb-1 text-xs font-bold text-slate-500 dark:text-slate-400">Повторений в день (максимум)</p>
                        <Chips options={REVIEWS_PER_DAY_OPTIONS} value={settings.reviewsPerDay} onChange={n => onChangeSettings({ reviewsPerDay: n })} />
                    </div>
                    <div>
                        <p className="mb-1 text-xs font-bold text-slate-500 dark:text-slate-400">Мой уровень (для упражнений с пропуском)</p>
                        <div className="flex flex-wrap gap-1">
                            {CEFR_LEVELS.map(lvl => (
                                <button key={lvl} onClick={() => onChangeSettings({ level: lvl as CefrLevel })} className={`h-8 min-w-[2.5rem] rounded-lg px-2 text-sm font-bold ${settings.level === lvl ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'}`}>
                                    {lvl}
                                </button>
                            ))}
                        </div>
                    </div>
                    <p className="text-[11px] leading-snug text-slate-400">
                        Каждое новое слово даёт ещё 5–8 повторений в ближайшие недели. Для начала разумно 5–10 новых в день.
                    </p>
                </div>
            )}

            <ol className="space-y-1.5">
                {steps.map((step, i) => {
                    const isNext = !done && next?.id === step.id;
                    return (
                        <li key={step.id}>
                            <button
                                onClick={() => !step.skipped && onStep(step)}
                                disabled={step.skipped}
                                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${isNext ? 'bg-emerald-50 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:ring-emerald-800' : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'} ${step.skipped ? 'opacity-50' : ''}`}
                            >
                                <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm ${step.done ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-700'}`}>
                                    {step.done ? '✓' : STEP_ICONS[step.id] || i + 1}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className={`block text-sm font-bold ${step.done ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-white'}`}>{step.title}</span>
                                    <span className="block text-xs text-slate-500 dark:text-slate-400">{step.detail}</span>
                                </span>
                                {!step.done && !step.skipped && step.minutes > 0 && <span className="flex-shrink-0 text-xs text-slate-400">~{step.minutes} мин</span>}
                            </button>
                        </li>
                    );
                })}
            </ol>

            {summary.newPaused && (
                <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                    Накопилось {summary.totalDue} повторений — пока их больше {BACKLOG_PAUSE_THRESHOLD}, новые слова на паузе. Разберём завал за несколько дней.
                </p>
            )}

            {done ? (
                <div className="mt-4 space-y-2 rounded-xl bg-emerald-50 px-3 py-3 dark:bg-emerald-900/20">
                    <p className="flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                        <CheckCircleIcon className="h-5 w-5" /> На сегодня всё! 🎉
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {summary.backlogBeyondLimit > 0 && <button onClick={onStart} className="rounded-lg bg-white px-3 py-1 text-xs font-bold text-emerald-700 shadow-sm dark:bg-emerald-900/40 dark:text-emerald-300">Ещё порция повторений</button>}
                        {next?.optional && <button onClick={() => onStep(next)} className="rounded-lg bg-white px-3 py-1 text-xs font-bold text-emerald-700 shadow-sm dark:bg-emerald-900/40 dark:text-emerald-300">{next.title}</button>}
                        <button onClick={onMorePhrases} className="rounded-lg bg-white px-3 py-1 text-xs font-bold text-emerald-700 shadow-sm dark:bg-emerald-900/40 dark:text-emerald-300">Ещё фразы</button>
                    </div>
                </div>
            ) : (
                <button onClick={() => next && onStep(next)} className="mt-4 w-full rounded-2xl bg-emerald-600 py-3 font-bold text-white shadow-lg transition-colors hover:bg-emerald-700">
                    {started ? 'Продолжить' : 'Начать'}: {next!.title.toLowerCase()}
                    {minutesLeft > 0 && <span className="font-medium opacity-80"> · ещё ~{minutesLeft} мин</span>}
                </button>
            )}
            {summary.backlogBeyondLimit > 0 && !done && (
                <p className="mt-2 text-center text-[11px] text-slate-400">Ещё {summary.backlogBeyondLimit} повторений подождут следующих дней — так завал разойдётся равномерно</p>
            )}
        </div>
    );
};

export default DailyPlanWidget;
