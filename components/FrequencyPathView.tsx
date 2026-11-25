import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Flashcard } from '../types';
import {
    BatchFocus, EntryStatus, FrequencyEntry, FREQUENCY_TAG, POS_LABELS, PartOfSpeech, TOPICS, TOPIC_LABELS, Topic,
    buildCardKeySet, entryKey, getCoverageLevels, getEntryStatus, getNextBatch, getTextCoverage,
    loadFrequencyDictionary, rankToFrequency,
} from '../domain/frequencyDictionary';
import { useFrequencyProgress } from '../hooks/useFrequencyProgress';
import { buildFlashcard } from '../services/cardFactory';
import { describeAiError } from '../services/client';
import { notifyError, notifySuccess } from '../lib/notifications';
import { CheckCircleIcon, LoaderIcon, PlusIcon, SearchIcon, SparklesIcon, TargetIcon, XIcon } from './Icons';

interface Props {
    cards: Flashcard[];
    userId?: string;
    onCardsCreated: (cards: Flashcard[]) => Promise<void>;
    ensureFolder: () => Promise<string>;
    onStudyCards: (cards: Flashcard[]) => void;
}

type Tab = 'today' | 'dictionary';
type StatusFilter = 'all' | EntryStatus;
type PosFilter = 'all' | 'verb' | 'noun' | 'adj' | 'other';

const GOAL_OPTIONS = [5, 10, 15, 20];
const PAGE_SIZE = 60;

const FOCUS_OPTIONS: { id: BatchFocus; label: string }[] = [
    { id: 'all', label: 'Все слова' },
    { id: 'everyday', label: 'Только быт' },
    { id: 'content', label: 'Без служебных' },
    { id: 'verbs', label: 'Только глаголы' },
];

const isToday = (ts: number) => new Date(ts).toDateString() === new Date().toDateString();

const PosBadge = ({ entry }: { entry: FrequencyEntry }) => (
    <span className="inline-flex items-center gap-1">
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-700 dark:text-slate-300">
            {POS_LABELS[entry.p]}
        </span>
        {entry.t && (
            <span className="rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                {TOPIC_LABELS[entry.t]}
            </span>
        )}
        {entry.irr && (
            <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                неправ.
            </span>
        )}
    </span>
);

const EntryRow: React.FC<{ entry: FrequencyEntry; actions: React.ReactNode }> = ({ entry, actions }) => (
    <li className="flex items-center gap-3 px-4 py-3">
        <span className="w-10 flex-shrink-0 text-right font-mono text-xs text-slate-400">#{entry.r}</span>
        <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
                <span className="font-serif text-lg font-bold text-slate-800 dark:text-white">{entry.w}</span>
                <PosBadge entry={entry} />
            </div>
            <p className="line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{entry.ru}</p>
        </div>
        <div className="flex-shrink-0">{actions}</div>
    </li>
);

const matchesPos = (p: PartOfSpeech, filter: PosFilter) => {
    if (filter === 'all') return true;
    if (filter === 'other') return !['verb', 'noun', 'adj'].includes(p);
    return p === filter;
};

const FrequencyPathView: React.FC<Props> = ({ cards, userId, onCardsCreated, ensureFolder, onStudyCards }) => {
    const [dictionary, setDictionary] = useState<FrequencyEntry[] | null>(null);
    const [loadError, setLoadError] = useState(false);
    const [tab, setTab] = useState<Tab>('today');
    const [focus, setFocus] = useState<BatchFocus>('all');

    const [generating, setGenerating] = useState<{ current: number; total: number; word: string } | null>(null);
    const [justCreated, setJustCreated] = useState<Flashcard[]>([]);
    const isMounted = useRef(true);

    const [search, setSearch] = useState('');
    const [posFilter, setPosFilter] = useState<PosFilter>('all');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [topicFilter, setTopicFilter] = useState<'all' | Topic>('all');
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    const { knownKeys, dailyGoal, markKnown, unmarkKnown, setDailyGoal } = useFrequencyProgress(userId);

    useEffect(() => {
        isMounted.current = true;
        loadFrequencyDictionary()
            .then(d => { if (isMounted.current) setDictionary(d); })
            .catch(() => { if (isMounted.current) setLoadError(true); });
        return () => { isMounted.current = false; };
    }, []);

    const cardKeys = useMemo(() => buildCardKeySet(cards), [cards]);

    const addedToday = useMemo(
        () => cards.filter(c => c.tags?.includes(FREQUENCY_TAG) && isToday(c.createdAt)).length,
        [cards]
    );
    const remainingToday = Math.max(dailyGoal - addedToday, 0);
    const goalReached = remainingToday === 0;

    const batch = useMemo(() => {
        if (!dictionary) return [];
        return getNextBatch(dictionary, cardKeys, knownKeys, goalReached ? dailyGoal : remainingToday, focus);
    }, [dictionary, cardKeys, knownKeys, remainingToday, goalReached, dailyGoal, focus]);

    const coverage = useMemo(
        () => dictionary ? getCoverageLevels(dictionary, cardKeys, knownKeys) : [],
        [dictionary, cardKeys, knownKeys]
    );
    const textCoverage = useMemo(
        () => dictionary ? getTextCoverage(dictionary, cardKeys, knownKeys) : 0,
        [dictionary, cardKeys, knownKeys]
    );

    const filteredDictionary = useMemo(() => {
        if (!dictionary) return [];
        const q = search.trim().toLowerCase();
        return dictionary.filter(e => {
            if (!matchesPos(e.p, posFilter)) return false;
            if (topicFilter !== 'all' && e.t !== topicFilter) return false;
            if (statusFilter !== 'all' && getEntryStatus(entryKey(e), cardKeys, knownKeys) !== statusFilter) return false;
            if (q && !e.w.toLowerCase().includes(q) && !e.ru.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [dictionary, search, posFilter, topicFilter, statusFilter, cardKeys, knownKeys]);

    useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, posFilter, topicFilter, statusFilter]);

    const createCards = async (entries: FrequencyEntry[]) => {
        if (entries.length === 0 || generating) return;
        setJustCreated([]);
        setGenerating({ current: 0, total: entries.length, word: entries[0].w });

        const created: Flashcard[] = [];
        try {
            const folderId = await ensureFolder();
            for (let i = 0; i < entries.length; i++) {
                if (!isMounted.current) break;
                const entry = entries[i];
                setGenerating({ current: i + 1, total: entries.length, word: entry.w });
                const card = await buildFlashcard(entry.w, entry.ru, {
                    folderIds: [folderId],
                    tags: [FREQUENCY_TAG, ...(entry.p === 'verb' ? ['глагол'] : [])],
                    frequency: rankToFrequency(entry.r),
                    allowFallback: true,
                });
                created.push(card);
            }
        } catch (error) {
            console.error('Frequency card generation failed', error);
            notifyError(describeAiError(error, 'Не удалось создать часть карточек. Попробуйте ещё раз.'), 8000);
        }

        if (created.length > 0) {
            await onCardsCreated(created);
            notifySuccess(`Добавлено карточек: ${created.length}`);
        }
        if (isMounted.current) {
            setJustCreated(created);
            setGenerating(null);
        }
    };

    if (loadError) {
        return (
            <div className="flex h-full items-center justify-center p-6 text-center text-slate-500">
                Не удалось загрузить частотный словарь. Обновите страницу.
            </div>
        );
    }

    if (!dictionary) {
        return (
            <div className="flex h-full items-center justify-center">
                <LoaderIcon className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    const renderEntryActions = (entry: FrequencyEntry) => {
        const key = entryKey(entry);
        const status = getEntryStatus(key, cardKeys, knownKeys);
        if (status === 'inCards') {
            return <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400"><CheckCircleIcon className="h-4 w-4" /> В карточках</span>;
        }
        if (status === 'known') {
            return (
                <button onClick={() => unmarkKnown(key)} className="rounded-lg px-2 py-1 text-xs font-bold text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700" title="Вернуть в новые">
                    Знаю ↺
                </button>
            );
        }
        return (
            <div className="flex items-center gap-1">
                <button onClick={() => markKnown(key)} disabled={!!generating} className="rounded-lg px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-700">
                    Знаю
                </button>
                <button onClick={() => createCards([entry])} disabled={!!generating} className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 dark:bg-emerald-900/30 dark:text-emerald-400" title="Создать карточку">
                    <PlusIcon className="h-4 w-4" />
                </button>
            </div>
        );
    };

    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="mx-auto max-w-3xl space-y-6">
                <header>
                    <h2 className="serif text-3xl font-bold text-slate-800 dark:text-white">С нуля</h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Самые частые слова европейского португальского — по порядку. Основа — частоты живой речи (португальские субтитры), с поправкой на быт: слова из кафе, магазина, транспорта и у врача подняты выше, «киношная» лексика опущена.
                    </p>
                </header>

                {/* Progress */}
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                        <h3 className="font-bold text-slate-800 dark:text-white">Ваш прогресс</h3>
                        <p className="text-sm text-slate-500 sm:text-right dark:text-slate-400">
                            вы узнаёте <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">≈{Math.round(textCoverage * 100)}%</span> слов в обычной речи
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        {coverage.map(level => (
                            <div key={level.label}>
                                <div className="mb-1 flex justify-between text-xs font-bold">
                                    <span className="text-slate-600 dark:text-slate-300">{level.label}</span>
                                    <span className="text-slate-400">{level.learned}/{level.total}</span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(level.learned / Math.max(level.total, 1)) * 100}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Tabs */}
                <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                    {([['today', 'Порция на сегодня'], ['dictionary', 'Весь словарь']] as [Tab, string][]).map(([id, label]) => (
                        <button key={id} onClick={() => setTab(id)} className={`flex-1 rounded-lg py-2 text-sm font-bold transition-colors ${tab === id ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                            {label}
                        </button>
                    ))}
                </div>

                {generating && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-900/20">
                        <div className="mb-2 flex items-center gap-3">
                            <LoaderIcon className="h-5 w-5 animate-spin text-emerald-600" />
                            <p className="font-bold text-emerald-800 dark:text-emerald-300">
                                Создаём карточку {generating.current} из {generating.total}: <span className="font-serif">{generating.word}</span>
                            </p>
                        </div>
                        <p className="mb-3 text-xs text-emerald-700/80 dark:text-emerald-400/80">Примеры, грамматика, спряжения и картинка — около 10–20 секунд на слово.</p>
                        <div className="h-2 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${((generating.current - 1) / generating.total) * 100}%` }} />
                        </div>
                    </div>
                )}

                {!generating && justCreated.length > 0 && (
                    <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-800 dark:bg-emerald-900/20">
                        <div className="flex items-center gap-3">
                            <CheckCircleIcon className="h-6 w-6 text-emerald-600" />
                            <p className="font-bold text-emerald-800 dark:text-emerald-300">Готово! Новых карточек: {justCreated.length}</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setJustCreated([])} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-500 hover:bg-white/60 dark:text-slate-400">Позже</button>
                            <button onClick={() => onStudyCards(justCreated)} className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow hover:bg-emerald-700">Учить сейчас</button>
                        </div>
                    </div>
                )}

                {tab === 'today' && (
                    <section className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <TargetIcon className="h-5 w-5 text-amber-500" />
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Слов в день:</span>
                                <div className="flex gap-1">
                                    {GOAL_OPTIONS.map(n => (
                                        <button key={n} onClick={() => setDailyGoal(n)} className={`h-8 w-9 rounded-lg text-sm font-bold ${dailyGoal === n ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'}`}>
                                            {n}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <span className="text-sm text-slate-500 dark:text-slate-400">
                                Сегодня добавлено: <b className="text-slate-700 dark:text-slate-200">{addedToday}</b> из {dailyGoal}
                            </span>
                        </div>

                        <div className="flex flex-wrap gap-1">
                            {FOCUS_OPTIONS.map(opt => (
                                <button key={opt.id} onClick={() => setFocus(opt.id)} className={`rounded-full px-3 py-1 text-xs font-bold ${focus === opt.id ? 'bg-slate-800 text-white dark:bg-emerald-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'}`}>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        <div className="flex flex-wrap gap-1">
                            <span className="self-center pr-1 text-xs font-bold text-slate-400">Темы:</span>
                            {TOPICS.map(topic => (
                                <button key={topic} onClick={() => setFocus(focus === topic ? 'all' : topic)} className={`rounded-full px-3 py-1 text-xs font-bold ${focus === topic ? 'bg-sky-600 text-white' : 'bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-900/20 dark:text-sky-300'}`}>
                                    {TOPIC_LABELS[topic]}
                                </button>
                            ))}
                        </div>

                        {goalReached && (
                            <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                                🎉 Цель на сегодня выполнена. Можно повторить карточки — или взять дополнительную порцию ниже.
                            </div>
                        )}

                        {batch.length === 0 ? (
                            <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-600">
                                В этой категории не осталось новых слов. Отличная работа!
                            </p>
                        ) : (
                            <>
                                <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800">
                                    {batch.map(entry => (
                                        <EntryRow
                                            key={entry.r}
                                            entry={entry}
                                            actions={
                                                <button onClick={() => markKnown(entryKey(entry))} disabled={!!generating} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 dark:hover:bg-slate-700" title="Я уже знаю это слово — убрать из порции">
                                                    <XIcon className="h-3.5 w-3.5" /> Знаю
                                                </button>
                                            }
                                        />
                                    ))}
                                </ul>
                                <p className="text-xs text-slate-400">Уже знакомое слово отметьте «Знаю» — на его место придёт следующее по частоте.</p>
                                <button
                                    onClick={() => createCards(batch)}
                                    disabled={!!generating}
                                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-lg font-bold text-white shadow-lg transition-all hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    <SparklesIcon className="h-5 w-5" />
                                    {goalReached ? 'Добавить ещё' : 'Создать'} {batch.length} {batch.length === 1 ? 'карточку' : batch.length < 5 ? 'карточки' : 'карточек'}
                                </button>
                            </>
                        )}
                    </section>
                )}

                {tab === 'dictionary' && (
                    <section className="space-y-3">
                        <div className="relative">
                            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Поиск по-португальски или по-русски"
                                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <select value={posFilter} onChange={e => setPosFilter(e.target.value as PosFilter)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                                <option value="all">Все части речи</option>
                                <option value="verb">Глаголы</option>
                                <option value="noun">Существительные</option>
                                <option value="adj">Прилагательные</option>
                                <option value="other">Остальное</option>
                            </select>
                            <select value={topicFilter} onChange={e => setTopicFilter(e.target.value as 'all' | Topic)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                                <option value="all">Все темы</option>
                                {TOPICS.map(topic => <option key={topic} value={topic}>{TOPIC_LABELS[topic]}</option>)}
                            </select>
                            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                                <option value="all">Любой статус</option>
                                <option value="new">Новые</option>
                                <option value="inCards">В карточках</option>
                                <option value="known">Отмечены «знаю»</option>
                            </select>
                            <span className="ml-auto self-center text-xs text-slate-400">{filteredDictionary.length} слов</span>
                        </div>
                        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800">
                            {filteredDictionary.slice(0, visibleCount).map(entry => (
                                <EntryRow key={entry.r} entry={entry} actions={renderEntryActions(entry)} />
                            ))}
                            {filteredDictionary.length === 0 && (
                                <li className="p-8 text-center text-sm text-slate-500">Ничего не найдено</li>
                            )}
                        </ul>
                        {visibleCount < filteredDictionary.length && (
                            <button onClick={() => setVisibleCount(c => c + PAGE_SIZE)} className="w-full rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300">
                                Показать ещё
                            </button>
                        )}
                    </section>
                )}

                <p className="pb-4 text-center text-[11px] text-slate-400">
                    Частоты: корпус субтитров OpenSubtitles (FrequencyWords, H. Dave) с поправками под быт. Отметки «знаю» хранятся на этом устройстве.
                </p>
            </div>
        </div>
    );
};

export default FrequencyPathView;
