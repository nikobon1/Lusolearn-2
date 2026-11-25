import React, { useState } from 'react';
import {
    BACKLOG_PAUSE_THRESHOLD, NEW_PER_DAY_OPTIONS, PlanSettings, PlanSummary, REVIEWS_PER_DAY_OPTIONS, planRemaining,
} from '../domain/dailyPlan';
import { CheckCircleIcon, SettingsIcon, TargetIcon } from './Icons';

interface Props {
    summary: PlanSummary;
    settings: PlanSettings;
    onChangeSettings: (patch: Partial<PlanSettings>) => void;
    onStart: () => void;
}

const Bar: React.FC<{ label: string; done: number; left: number; color: string }> = ({ label, done, left, color }) => {
    const total = done + left;
    return (
        <div>
            <div className="mb-1 flex justify-between text-xs font-bold">
                <span className="text-slate-600 dark:text-slate-300">{label}</span>
                <span className="text-slate-400">{done} / {total}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
            </div>
        </div>
    );
};

const Chips: React.FC<{ options: number[]; value: number; onChange: (n: number) => void }> = ({ options, value, onChange }) => (
    <div className="flex flex-wrap gap-1">
        {options.map(n => (
            <button key={n} onClick={() => onChange(n)} className={`h-8 min-w-[2.5rem] rounded-lg px-2 text-sm font-bold ${value === n ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'}`}>
                {n}
            </button>
        ))}
    </div>
);

const DailyPlanWidget: React.FC<Props> = ({ summary, settings, onChangeSettings, onStart }) => {
    const [showSettings, setShowSettings] = useState(false);
    const remaining = planRemaining(summary);
    const done = remaining === 0;

    return (
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
                    <TargetIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> План на сегодня
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
                    <p className="text-[11px] leading-snug text-slate-400">
                        Каждое новое слово даёт ещё 5–8 повторений в ближайшие недели. Для начала разумно 5–10 новых в день.
                    </p>
                </div>
            )}

            <div className="space-y-3">
                <Bar label="Повторения" done={summary.reviewsDone} left={summary.reviewsLeft} color="bg-indigo-500" />
                <Bar label="Новые слова" done={summary.newDone} left={summary.newLeft} color="bg-emerald-500" />
            </div>

            {summary.newPaused && (
                <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                    Накопилось {summary.totalDue} повторений — пока их больше {BACKLOG_PAUSE_THRESHOLD}, новые слова на паузе. Разберём завал за несколько дней.
                </p>
            )}
            {!summary.newPaused && summary.newLeft === 0 && summary.newAvailable === 0 && settings.newPerDay > 0 && (
                <p className="mt-3 text-xs text-slate-400">Новых карточек нет — добавьте слова в «С нуля» или «Создать».</p>
            )}

            {done ? (
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-3 text-sm font-bold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                    <CheckCircleIcon className="h-5 w-5" /> На сегодня всё!
                    {summary.backlogBeyondLimit > 0 && <button onClick={onStart} className="ml-auto rounded-lg bg-white px-3 py-1 text-xs text-emerald-700 shadow-sm dark:bg-emerald-900/40 dark:text-emerald-300">Ещё порция</button>}
                </div>
            ) : (
                <button onClick={onStart} className="mt-4 w-full rounded-2xl bg-emerald-600 py-3 font-bold text-white shadow-lg transition-colors hover:bg-emerald-700">
                    {summary.reviewsDone + summary.newDone > 0 ? 'Продолжить' : 'Начать'} · {remaining}
                </button>
            )}
            {summary.backlogBeyondLimit > 0 && !done && (
                <p className="mt-2 text-center text-[11px] text-slate-400">Ещё {summary.backlogBeyondLimit} повторений подождут следующих дней — так завал разойдётся равномерно</p>
            )}
        </div>
    );
};

export default DailyPlanWidget;
