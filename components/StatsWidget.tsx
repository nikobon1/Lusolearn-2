import React, { useEffect, useMemo, useState } from 'react';
import { Flashcard, UserProfile } from '../types';
import { ChartIcon } from './Icons';
import { FrequencyEntry, loadFrequencyDictionary } from '../domain/frequencyDictionary';
import { PlanSettings } from '../domain/dailyPlan';
import { PracticeEntry, dayKey } from '../domain/practiceLog';
import { isPaused } from '../domain/paused';
import { formatMinutes, lastDays } from '../domain/studyTime';
import {
    ReviewRecord, STAGE_LABELS, STREAK_MILESTONES, Stage, WEEKLY_GOAL_DAYS, accuracyAdvice, activityByDay, currentWeek, hardWords, practiceScores, streakInfo,
    recallAccuracy, reviewForecast, speechCoverage, stageCounts, stageOf,
} from '../domain/stats';

interface StatsWidgetProps {
    cards: Flashcard[];
    user: UserProfile;
    records: ReviewRecord[];
    practice: PracticeEntry[];
    markedKnown: Set<string>;
    settings: PlanSettings;
    onChangeSettings: (patch: Partial<PlanSettings>) => void;
    onShowCards: (title: string, cards: Flashcard[]) => void;
    onPracticeCards: (cards: Flashcard[]) => void;
    onAddWords: () => void;
    /** Study seconds per day (tracked + estimated for older days) */
    studySeconds: Record<string, number>;
}

const STAGE_COLORS: Record<Stage, string> = {
    new: 'bg-slate-300 dark:bg-slate-600',
    learning: 'bg-amber-400',
    known: 'bg-emerald-400',
    solid: 'bg-emerald-700 dark:bg-emerald-500',
};
const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const pct = (x: number) => `${Math.round(x * 100)}%`;
const daysWord = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? 'день' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'дня' : 'дней');

/** "?" next to a title: tap to show what the number means and how it's counted. */
const InfoToggle: React.FC<{ open: boolean; onClick: () => void; label: string }> = ({ open, onClick, label }) => (
    <button
        onClick={onClick}
        aria-expanded={open}
        aria-label={`Что это: ${label}`}
        className={`inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-[11px] font-bold transition-colors ${open ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 text-slate-400 hover:border-slate-400 hover:text-slate-600 dark:border-slate-600'}`}
    >
        ?
    </button>
);

const InfoText: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="mb-3 space-y-1.5 rounded-xl bg-slate-50 px-3 py-2.5 text-sm leading-snug text-slate-600 animate-in fade-in duration-200 dark:bg-slate-700/50 dark:text-slate-300">
        {children}
    </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode; aside?: React.ReactNode; info?: React.ReactNode }> = ({ title, children, aside, info }) => {
    const [showInfo, setShowInfo] = useState(false);
    return (
        <section className="border-t border-slate-100 pt-4 dark:border-slate-700">
            <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</h4>
                    {info && <InfoToggle open={showInfo} onClick={() => setShowInfo(v => !v)} label={title} />}
                </div>
                {aside}
            </div>
            {info && showInfo && <InfoText>{info}</InfoText>}
            {children}
        </section>
    );
};

const StatsWidget: React.FC<StatsWidgetProps> = ({
    cards: allCards, user, records, practice, markedKnown, settings, onChangeSettings, onShowCards, onPracticeCards, onAddWords, studySeconds,
}) => {
    const [open, setOpen] = useState(() => {
        try { return localStorage.getItem('luso_stats_open') === '1'; } catch { return false; }
    });
    const toggleOpen = () => setOpen(v => {
        try { localStorage.setItem('luso_stats_open', v ? '0' : '1'); } catch { /* ignore */ }
        return !v;
    });
    const [dictionary, setDictionary] = useState<FrequencyEntry[] | null>(null);
    const [coverageInfo, setCoverageInfo] = useState(false);
    useEffect(() => { loadFrequencyDictionary().then(setDictionary).catch(() => setDictionary([])); }, []);

    const cards = useMemo(() => allCards.filter(c => !isPaused(c)), [allCards]);
    const coverage = useMemo(() => (dictionary ? speechCoverage(dictionary, cards, markedKnown) : null), [dictionary, cards, markedKnown]);
    const activity = useMemo(() => activityByDay(records, practice, user.learningHistory), [records, practice, user.learningHistory]);
    const streakData = useMemo(() => streakInfo(activity), [activity]);
    const streak = streakData.current;
    const studied = cards.filter(c => c.interval > 0).length;
    const week = lastDays(studySeconds, 7);
    const todayMinutes = week[week.length - 1].minutes;

    // ---------- Collapsed ----------
    if (!open) {
        return (
            <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <button onClick={toggleOpen} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <ChartIcon className="h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-bold text-slate-800 dark:text-white">Статистика</span>
                    <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {coverage ? `${pct(coverage.known)} речи` : ''}{streak > 0 ? ` · 🔥 ${streak}` : ''}{todayMinutes > 0 ? ` · ⏱ ${formatMinutes(todayMinutes)}` : ''}
                    </span>
                </button>
                <button
                    onClick={() => onShowCards('Изученные слова', cards.filter(c => c.interval > 0))}
                    className="flex-shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300"
                >
                    Слова · {studied}
                </button>
                <button onClick={toggleOpen} aria-label="Развернуть статистику" className="flex-shrink-0 px-1 text-slate-400 hover:text-slate-600">▾</button>
            </div>
        );
    }

    // ---------- Expanded ----------
    const stages = stageCounts(cards);
    const totalCards = cards.length || 1;
    const accuracy = recallAccuracy(records);
    const advice = accuracyAdvice(accuracy, settings.newPerDay);
    const hard = hardWords(records, cards);
    const forecast = reviewForecast(cards);
    const forecastMax = Math.max(1, ...forecast.map(f => f.count));
    const scores = practiceScores(practice);


    return (
        <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <button onClick={toggleOpen} className="flex items-center gap-2 text-left">
                <ChartIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-bold text-slate-800 dark:text-white">Статистика</h3>
                <span className="text-slate-400">▴</span>
            </button>

            {/* 1. Coverage */}
            {coverage && (
                <div>
                    <div className="flex items-center gap-2">
                        <p className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">{pct(coverage.known)}</p>
                        <InfoToggle open={coverageInfo} onClick={() => setCoverageInfo(v => !v)} label="доля речи" />
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">обычной речи — слова, которые вы уже знаете</p>
                    {coverageInfo && (
                        <div className="mt-2"><InfoText>
                            <p>Какая часть слов в обычном разговоре — ваши. Посчитано по частотному словарю живой речи: «de», «que», «não» встречаются тысячи раз, «rinoceronte» — почти никогда, поэтому частые слова весят намного больше.</p>
                            <p><b>Зелёная часть</b> — слова, которые вы знаете: интервал повторения от недели или отмечены «Знаю» в «С нуля». <b>Жёлтая</b> — слова, которые ещё учите.</p>
                            <p>Для ориентира: 100 самых частых слов дают около 60% речи, 500 — около 78%, весь словарь «С нуля» (~1650 слов) — около 86%. Поэтому быстрее всего процент растёт от первых слов, и «С нуля» идёт по частоте. Для свободного понимания нужно знать 95% слов и больше — остальное добирается из своих тем и видео.</p>
                        </InfoText></div>
                    )}
                    <div className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                        <div className="absolute inset-y-0 left-0 rounded-full bg-amber-300/70" style={{ width: pct(coverage.withLearning) }} />
                        <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-500" style={{ width: pct(coverage.known) }} />
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                        {coverage.withLearning > coverage.known + 0.005 && <>+{pct(coverage.withLearning - coverage.known)} в процессе изучения. </>}
                        {coverage.nextMilestone !== null && <>До {pct(coverage.nextMilestone)} — ещё {coverage.wordsToMilestone} частых слов. </>}
                    </p>
                    {coverage.nextMilestone !== null && (
                        <button onClick={onAddWords} className="mt-1 text-xs font-bold text-emerald-700 hover:underline dark:text-emerald-400">Добавить следующие слова →</button>
                    )}
                </div>
            )}

            {/* 2. Stages */}
            <Section title="Ваши слова" info={<>
                <p>Все карточки (кроме слов на паузе) по тому, насколько прочно слово уже сидит в памяти. Стадия зависит от интервала — через сколько дней слово покажется снова.</p>
                <p><b>Новые</b> — ещё не изучали. <b>Учу</b> — интервал меньше недели, слово легко забыть. <b>Знаю</b> — 1–3 недели. <b>Закреплено</b> — больше 3 недель: такое слово, скорее всего, останется надолго.</p>
                <p>Нажмите на стадию, чтобы увидеть её слова. Если ошибиться в повторении, слово вернётся в «Учу» — это нормально.</p>
            </>}>
                <div className="flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    {(Object.keys(STAGE_LABELS) as Stage[]).map(s => stages[s] > 0 && (
                        <div key={s} className={STAGE_COLORS[s]} style={{ width: `${(stages[s] / totalCards) * 100}%` }} />
                    ))}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1">
                    {(Object.keys(STAGE_LABELS) as Stage[]).map(s => (
                        <button key={s} onClick={() => onShowCards(STAGE_LABELS[s].label, cards.filter(c => stageOf(c) === s))} disabled={!stages[s]}
                            className="flex items-center gap-2 rounded-lg px-2 py-1 text-left text-sm hover:bg-slate-50 disabled:opacity-50 dark:hover:bg-slate-700/50" title={STAGE_LABELS[s].hint}>
                            <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${STAGE_COLORS[s]}`} />
                            <span className="text-slate-600 dark:text-slate-300">{STAGE_LABELS[s].label}</span>
                            <span className="ml-auto font-bold text-slate-800 dark:text-white">{stages[s]}</span>
                        </button>
                    ))}
                </div>
            </Section>

            {/* 3. Regularity — this week, streak, record, milestones */}
            {(() => {
                const weekDays = currentWeek(activity, streakData.frozen);
                const weekDone = weekDays.filter(d => d.active).length;
                const goalMet = weekDone >= WEEKLY_GOAL_DAYS;
                const next = streakData.nextMilestone;
                const prev = [...STREAK_MILESTONES].reverse().find(m => m <= streak) ?? 0;
                const progress = next ? (streak - prev) / (next - prev) : 1;
                return (
                    <Section title="Регулярность" info={<>
                        <p><b>Серия</b> — сколько дней подряд вы занимались (хотя бы один ответ, фраза или реплика в диалоге). Сегодняшний день засчитается после первого занятия, до конца дня серия не сгорит.</p>
                        <p><b>❄️ Заморозка:</b> один пропущенный день в неделю не обнуляет серию — жизнь бывает. Два дня подряд без занятий серию сбрасывают.</p>
                        <p><b>Недельная цель</b> — {WEEKLY_GOAL_DAYS} дней из 7. Награды открываются на сериях {STREAK_MILESTONES.slice(0, 6).join(', ')}… дней. Для памяти 10 минут каждый день полезнее, чем час раз в неделю.</p>
                    </>}>
                        <div className="flex items-center gap-3">
                            <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-3xl ${streak > 0 ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-slate-100 grayscale dark:bg-slate-700'}`}>🔥</div>
                            <div className="min-w-0 flex-1">
                                <p className="text-slate-800 dark:text-white">
                                    {streak > 0 ? <><b className="text-2xl">{streak}</b> <span className="text-sm">{daysWord(streak)} подряд</span></> : <span className="text-sm">Начните серию сегодня</span>}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Рекорд: {streakData.best} {daysWord(streakData.best)}{streakData.freezeReady ? ' · ❄️ заморозка готова' : ' · ❄️ заморозка использована'}
                                </p>
                            </div>
                        </div>

                        {/* This week */}
                        <div className="mt-3 flex justify-between">
                            {weekDays.map((d, i) => (
                                <div key={i} className="flex flex-col items-center gap-1">
                                    <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                                        d.active ? 'bg-emerald-500 text-white'
                                        : d.frozen ? 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300'
                                        : d.today ? 'border-2 border-dashed border-emerald-400 text-emerald-600 dark:text-emerald-400'
                                        : d.future ? 'border border-slate-200 text-slate-300 dark:border-slate-700 dark:text-slate-600'
                                        : 'bg-slate-100 text-slate-400 dark:bg-slate-700'}`}>
                                        {d.active ? '✓' : d.frozen ? '❄' : d.today ? '?' : ''}
                                    </span>
                                    <span className={`text-[10px] ${d.today ? 'font-bold text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][i]}</span>
                                </div>
                            ))}
                        </div>
                        <p className={`mt-2 text-xs ${goalMet ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                            {goalMet ? `🎯 Недельная цель выполнена: ${weekDone} из 7 дней!` : `Недельная цель: ${weekDone} из ${WEEKLY_GOAL_DAYS} дней`}
                        </p>

                        {/* Milestones */}
                        <div className="mt-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-700/40">
                            <div className="mb-1.5 flex items-center justify-between text-xs">
                                <span className="font-bold text-slate-600 dark:text-slate-300">{next ? `До награды «${next} дней»` : 'Все награды получены!'}</span>
                                {next && <span className="text-slate-400">ещё {next - streak} {daysWord(next - streak)}</span>}
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-white dark:bg-slate-800">
                                <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-400 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1">
                                {STREAK_MILESTONES.slice(0, 6).map(m => {
                                    const got = streakData.reached.includes(m);
                                    return (
                                        <span key={m} title={got ? `Получено: серия ${m} дней` : `Серия ${m} дней`}
                                            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${got ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' : 'bg-white text-slate-300 dark:bg-slate-800 dark:text-slate-600'}`}>
                                            {got ? '🏅' : '🔒'} {m}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    </Section>
                );
            })()}

            {/* 3b. Study time */}
            {(() => {
                const total = week.reduce((m, d) => m + d.minutes, 0);
                const avg = Math.round(total / 7);
                const activeDays = week.filter(d => d.minutes > 0);
                const avgActive = activeDays.length ? Math.round(total / activeDays.length) : 0;
                const max = Math.max(1, ...week.map(d => d.minutes));
                return (
                    <Section title="Время занятий" aside={<span className="text-xs text-slate-400">7 дней</span>} info={<>
                        <p>Сколько минут вы занимались в каждый из последних 7 дней: карточки, фразы, глаголы, диалоги, истории, «С нуля» и видеоуроки. Время идёт, только пока открыт учебный экран и вы что-то делаете — если минуту ничего не нажимать, таймер останавливается. Телефон и компьютер суммируются.</p>
                        <p>Для дней до появления таймера время оценено по вашим ответам (паузы длиннее 2 минут не считаются).</p>
                        <p><b>В среднем</b> — за все 7 дней, включая пропущенные; <b>в дни занятий</b> — только по дням, когда вы занимались. Для языка лучше 15 минут каждый день, чем час раз в неделю.</p>
                    </>}>
                        <div className="mb-2 grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-xl bg-slate-50 py-2 dark:bg-slate-700/40"><p className="text-lg font-bold text-slate-800 dark:text-white">{formatMinutes(todayMinutes)}</p><p className="text-[10px] uppercase text-slate-400">сегодня</p></div>
                            <div className="rounded-xl bg-slate-50 py-2 dark:bg-slate-700/40"><p className="text-lg font-bold text-slate-800 dark:text-white">{formatMinutes(avg)}</p><p className="text-[10px] uppercase text-slate-400">в среднем/день</p></div>
                            <div className="rounded-xl bg-slate-50 py-2 dark:bg-slate-700/40"><p className="text-lg font-bold text-slate-800 dark:text-white">{formatMinutes(total)}</p><p className="text-[10px] uppercase text-slate-400">за неделю</p></div>
                        </div>
                        <div className="relative flex h-24 items-end gap-1.5">
                            {avg > 0 && (
                                <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-emerald-400/70" style={{ bottom: `${16 + (avg / max) * 56}px` }}>
                                    <span className="absolute -top-2 left-0 rounded bg-white px-1 text-[10px] font-bold leading-none text-emerald-600 dark:bg-slate-800 dark:text-emerald-400">ср. {avg}</span>
                                </div>
                            )}
                            {week.map((d, i) => (
                                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{d.minutes || ''}</span>
                                    <div className={`w-full rounded-t ${i === week.length - 1 ? 'bg-emerald-500' : 'bg-emerald-300 dark:bg-emerald-700'}`} style={{ height: `${d.minutes ? Math.max(4, (d.minutes / max) * 56) : 0}px` }} />
                                    <span className="text-[10px] text-slate-400">{i === week.length - 1 ? 'Сег' : WEEKDAYS[d.date.getDay()]}</span>
                                </div>
                            ))}
                        </div>
                        {activeDays.length > 0 && activeDays.length < 7 && <p className="mt-1 text-xs text-slate-400">В дни занятий — в среднем {formatMinutes(avgActive)}.</p>}
                    </Section>
                );
            })()}

            {/* 4. Accuracy */}
            <Section title="Точность вспоминания" info={<>
                <p>Какую долю уже знакомых слов вы вспомнили с первой попытки за последние 2 недели («Вспомнил», «С трудом» или «Легко», а не «Не вспомнил»). Новые слова и повторные показы после ошибки не считаются.</p>
                <p><b>Норма — 85–90%.</b> Ниже 80% — новых слов слишком много, повторения не успевают закрепиться: лучше снизить темп. Выше 95% — слова даются легко, можно брать больше новых.</p>
                <p>Оценивайте себя честно: от оценки зависит, когда слово вернётся, и точность тоже.</p>
            </>} aside={<span className="text-xs text-slate-400">за 2 недели</span>}>
                {accuracy.total < 20 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">Нужно хотя бы 20 повторений, чтобы оценить. Пока: {accuracy.total}.</p>
                ) : (
                    <>
                        <p className="text-sm text-slate-700 dark:text-slate-200">
                            С первого раза: <b className={accuracy.share < 0.8 ? 'text-rose-600' : accuracy.share > 0.95 ? 'text-sky-600' : 'text-emerald-600'}>{pct(accuracy.share)}</b>
                            <span className="text-slate-400"> · норма 85–90% · {accuracy.total} повторений</span>
                        </p>
                        {advice && (
                            <div className={`mt-2 rounded-xl px-3 py-2 text-sm ${advice.tone === 'low' ? 'bg-rose-50 text-rose-800 dark:bg-rose-900/20 dark:text-rose-200' : advice.tone === 'high' ? 'bg-sky-50 text-sky-800 dark:bg-sky-900/20 dark:text-sky-200' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200'}`}>
                                {advice.text}
                                {advice.suggestNewPerDay !== undefined && advice.suggestNewPerDay !== settings.newPerDay && (
                                    <button onClick={() => onChangeSettings({ newPerDay: advice.suggestNewPerDay })} className="mt-1 block font-bold underline">
                                        Сделать {advice.suggestNewPerDay} новых в день (сейчас {settings.newPerDay})
                                    </button>
                                )}
                            </div>
                        )}
                    </>
                )}
            </Section>

            {/* 5. Forecast */}
            <Section title="Повторения на неделю" info={<>
                <p>Сколько уже изученных слов придёт на повторение в каждый из ближайших 7 дней. «Сег» включает всё, что накопилось раньше. Новые слова сюда не входят — они добавляются по дневному лимиту.</p>
                <p><b>Красный столбик</b> — день, когда повторений больше вашего лимита. Лишнее перенесётся на следующие дни, а новые слова при большом завале встанут на паузу. Если таких дней много — уменьшите число новых слов или поднимите лимит повторений (⚙️ в «Занятии на сегодня»).</p>
            </>} aside={<span className="text-xs text-slate-400">лимит {settings.reviewsPerDay}/день</span>}>
                <div className="flex h-20 items-end gap-1.5">
                    {forecast.map((f, i) => (
                        <div key={i} className="flex flex-1 flex-col items-center gap-1">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{f.count || ''}</span>
                            <div className={`w-full rounded-t ${f.count > settings.reviewsPerDay ? 'bg-rose-400' : 'bg-indigo-400'}`} style={{ height: `${Math.max(f.count ? 4 : 0, (f.count / forecastMax) * 48)}px` }} />
                            <span className="text-[10px] text-slate-400">{i === 0 ? 'Сег' : WEEKDAYS[f.date.getDay()]}</span>
                        </div>
                    ))}
                </div>
                {forecast.some(f => f.count > settings.reviewsPerDay) && (
                    <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">Красные дни — больше дневного лимита: лишнее перенесётся, новые слова могут встать на паузу.</p>
                )}
            </Section>

            {/* 6. Hard words */}
            <Section title="Трудные слова" info={<>
                <p>Слова, которые вы чаще всего забывали за последние 2 месяца (нажимали «Не вспомнил» хотя бы дважды).</p>
                <p><b>«Потренировать»</b> — прогнать их сейчас вне плана: расписание повторений не меняется. Если слово упорно не запоминается, помогает свой пример: добавьте его через «Создать» вместе с фразой из жизни, или поставьте слово на паузу, если оно вам пока не нужно.</p>
            </>} aside={hard.length > 0 ? (
                <button onClick={() => onPracticeCards(hard.map(h => h.card))} className="text-xs font-bold text-emerald-700 hover:underline dark:text-emerald-400">Потренировать →</button>
            ) : undefined}>
                {hard.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">Пока нет слов, которые вы забывали больше одного раза. 👍</p>
                ) : (
                    <ul className="space-y-1">
                        {hard.map(h => (
                            <li key={h.card.id} className="flex items-center justify-between gap-2 text-sm">
                                <span className="min-w-0 truncate"><b className="text-slate-800 dark:text-white">{h.card.originalTerm}</b> <span className="text-slate-500">— {h.card.translation}</span></span>
                                <span className="flex-shrink-0 text-xs text-rose-500">забыто {h.lapses}×</span>
                            </li>
                        ))}
                    </ul>
                )}
            </Section>

            {/* 7. Phrases & verbs */}
            {(scores.phrases.length > 0 || scores.verbs.length > 0) && (
                <Section title="Фразы и глаголы" info={<>
                    <p>Доля правильных ответов за 30 дней во «Фразах-шаблонах» (💬 по ситуациям) и в «Тренажёре спряжений» (🔤 по временам). Показаны темы, где было хотя бы 3 ответа; сверху — самые слабые.</p>
                    <p>Красный — меньше 60%: стоит повторить правило или шаблоны этой ситуации. Жёлтый — 60–85%, зелёный — уверенно.</p>
                </>} aside={<span className="text-xs text-slate-400">за 30 дней</span>}>
                    <div className="space-y-1.5">
                        {[...scores.phrases.map(s => ({ ...s, icon: '💬' })), ...scores.verbs.map(s => ({ ...s, icon: '🔤' }))].map(s => (
                            <div key={s.icon + s.label} className="flex items-center gap-2 text-sm">
                                <span>{s.icon}</span>
                                <span className="w-36 flex-shrink-0 truncate text-slate-600 dark:text-slate-300">{s.label}</span>
                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                                    <div className={`h-full rounded-full ${s.share < 0.6 ? 'bg-rose-400' : s.share < 0.85 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: pct(s.share) }} />
                                </div>
                                <span className="w-10 text-right text-xs font-bold text-slate-500">{pct(s.share)}</span>
                            </div>
                        ))}
                    </div>
                </Section>
            )}
        </div>
    );
};

export default StatsWidget;
