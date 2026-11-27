import React, { useEffect, useMemo, useState } from 'react';
import { Flashcard, UserProfile } from '../types';
import { ChartIcon } from './Icons';
import { FrequencyEntry, loadFrequencyDictionary } from '../domain/frequencyDictionary';
import { PlanSettings } from '../domain/dailyPlan';
import { PracticeEntry, dayKey } from '../domain/practiceLog';
import { isPaused } from '../domain/paused';
import {
    ReviewRecord, STAGE_LABELS, Stage, accuracyAdvice, activityByDay, currentStreak, hardWords, practiceScores,
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
    cards: allCards, user, records, practice, markedKnown, settings, onChangeSettings, onShowCards, onPracticeCards, onAddWords,
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
    const streak = currentStreak(activity);
    const studied = cards.filter(c => c.interval > 0).length;

    // ---------- Collapsed ----------
    if (!open) {
        return (
            <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <button onClick={toggleOpen} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <ChartIcon className="h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-bold text-slate-800 dark:text-white">Статистика</span>
                    <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {coverage ? `${pct(coverage.known)} речи` : ''}{streak > 0 ? ` · 🔥 ${streak}` : ''}
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

    // Calendar: 12 weeks, columns = weeks (Mon..Sun), last column = this week
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const mondayOffset = (today.getDay() + 6) % 7;
    const WEEKS = 16;
    const gridStart = new Date(today.getTime() - (mondayOffset + 7 * (WEEKS - 1)) * 86_400_000);
    const counts = [...activity.values()].filter(n => n > 0).sort((a, b) => a - b);
    const q = (p: number) => counts.length ? counts[Math.min(counts.length - 1, Math.floor(p * counts.length))] : 1;
    const shade = (n: number) => !n ? 'bg-slate-100 dark:bg-slate-700/60'
        : n <= q(0.33) ? 'bg-emerald-200 dark:bg-emerald-900' : n <= q(0.66) ? 'bg-emerald-400 dark:bg-emerald-700' : 'bg-emerald-600 dark:bg-emerald-500';
    const activeDays28 = Array.from({ length: 28 }, (_, i) => activity.get(dayKey(today.getTime() - i * 86_400_000)) || 0).filter(Boolean).length;

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

            {/* 3. Regularity */}
            <Section title="Регулярность" info={<>
                <p>Каждая клетка — один день, колонки — недели (сверху понедельник). Чем темнее клетка, тем больше было ответов: повторения, фразы и глаголы вместе.</p>
                <p><b>Серия</b> — сколько дней подряд вы занимались. Сегодняшний день засчитается после первого ответа, а серия не сгорит до конца дня.</p>
                <p>Для памяти 10 минут каждый день полезнее, чем час раз в неделю: повторения приходят точно в срок и не копятся.</p>
            </>} aside={<span className="text-xs text-slate-400">{activeDays28} из 28 дней</span>}>
                <p className="mb-2 text-sm text-slate-700 dark:text-slate-200">
                    {streak > 0 ? <>🔥 <b>{streak} {daysWord(streak)}</b> подряд</> : 'Серия начнётся с сегодняшнего занятия'}
                </p>
                <div className="flex gap-[3px] overflow-hidden">
                    {Array.from({ length: WEEKS }, (_, w) => (
                        <div key={w} className="flex flex-col gap-[3px]">
                            {Array.from({ length: 7 }, (_, d) => {
                                const date = new Date(gridStart.getTime() + (w * 7 + d) * 86_400_000);
                                if (date > today) return <span key={d} className="h-3.5 w-3.5" />;
                                const n = activity.get(dayKey(date.getTime())) || 0;
                                return <span key={d} className={`h-3.5 w-3.5 rounded-[3px] ${shade(n)}`} title={`${date.toLocaleDateString('ru-RU')}: ${n} ответов`} />;
                            })}
                        </div>
                    ))}
                </div>
            </Section>

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
