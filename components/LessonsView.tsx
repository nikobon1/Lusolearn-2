import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Flashcard, LessonItem, VideoLesson } from '../types';
import { TranscriptLine, extractYouTubeId, formatTime, parseTranscript, youtubeLink } from '../domain/transcript';
import { FrequencyEntry, buildCardKeySet, entryKey, loadFrequencyDictionary, normalizeTerm, rankToFrequency } from '../domain/frequencyDictionary';
import { findTermInSentence, stripArticle } from '../domain/reviewExercise';
import { analyzeTranscript } from '../services/lessons';
import { buildFlashcard } from '../services/cardFactory';
import { describeAiError } from '../services/client';
import { deleteLesson, loadLessons, saveLesson } from '../services/repositories/lessonsRepository';
import { notifyError, notifyInfo, notifySuccess } from '../lib/notifications';
import { BookIcon, CheckCircleIcon, LoaderIcon, PlusIcon, SparklesIcon, TrashIcon, VolumeIcon } from './Icons';

interface Props {
    cards: Flashcard[];
    userId?: string;
    onCardsCreated: (cards: Flashcard[]) => Promise<void>;
    ensureFolder: (name: string) => Promise<string>;
    onStudyCards: (cards: Flashcard[]) => void;
}

const LESSON_TAG = 'видео';
const VARIANT_LABEL: Record<string, { text: string; cls: string }> = {
    'pt-PT': { text: '🇵🇹 Европейский', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
    'pt-BR': { text: '🇧🇷 Бразильский', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
    mixed: { text: 'Смешанный', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
    unknown: { text: 'Вариант не определён', cls: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' },
};

const findLine = (item: LessonItem, lines: TranscriptLine[]): TranscriptLine | undefined => {
    if (item.line >= 0 && lines[item.line]) return lines[item.line];
    const needle = stripArticle(item.term).toLowerCase();
    return lines.find(l => l.text.toLowerCase().includes(needle));
};

/** A transcript line is a good card example only if it is short and really contains the word/phrase. */
const usableLine = (item: LessonItem, line?: TranscriptLine): line is TranscriptLine =>
    !!line && line.text.length <= 250 && (
        !!findTermInSentence(line.text, item.term)
        || line.text.toLowerCase().includes(stripArticle(item.term).toLowerCase().replace(/[.!?…]+$/, ''))
    );

const TimeLink: React.FC<{ videoId?: string; time?: number }> = ({ videoId, time }) => {
    if (time === undefined) return null;
    if (!videoId) return <span className="font-mono text-[11px] text-slate-400">{formatTime(time)}</span>;
    return (
        <a href={youtubeLink(videoId, time)} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-1.5 py-0.5 font-mono text-[11px] font-bold text-rose-600 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-300"
            title="Открыть видео на этом месте">
            ▶ {formatTime(time)}
        </a>
    );
};

const LessonsView: React.FC<Props> = ({ cards, userId, onCardsCreated, ensureFolder, onStudyCards }) => {
    const [lessons, setLessons] = useState<VideoLesson[]>([]);
    const [synced, setSynced] = useState(true);
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState<'list' | 'new' | 'lesson'>('list');
    const [openId, setOpenId] = useState<string | null>(null);

    // new lesson form
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [transcript, setTranscript] = useState('');
    const [analyzing, setAnalyzing] = useState(false);

    // lesson page
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [generating, setGenerating] = useState<{ current: number; total: number; term: string } | null>(null);
    const [justCreated, setJustCreated] = useState<Flashcard[]>([]);
    const [showTranscript, setShowTranscript] = useState(false);
    const [dictionary, setDictionary] = useState<Map<string, FrequencyEntry> | null>(null);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        loadLessons(userId).then(res => {
            if (!isMounted.current) return;
            setLessons(res.lessons);
            setSynced(res.synced);
            setLoading(false);
        });
        loadFrequencyDictionary()
            .then(d => { if (isMounted.current) setDictionary(new Map(d.map(e => [entryKey(e), e]))); })
            .catch(() => undefined);
        return () => { isMounted.current = false; };
    }, [userId]);

    const cardKeys = useMemo(() => buildCardKeySet(cards), [cards]);
    const lesson = lessons.find(l => l.id === openId) || null;
    const lines = useMemo(() => (lesson ? parseTranscript(lesson.transcript).lines : []), [lesson]);
    const draft = useMemo(() => parseTranscript(transcript), [transcript]);
    const videoIdDraft = extractYouTubeId(url);

    const rankOf = (term: string) => dictionary?.get(normalizeTerm(term))?.r;
    const inCards = (term: string) => cardKeys.has(normalizeTerm(term));

    const openLesson = (l: VideoLesson) => {
        setOpenId(l.id);
        setMode('lesson');
        setJustCreated([]);
        setShowTranscript(false);
        setSelected(new Set(l.analysis.items.map((it, i) => (inCards(it.term) ? -1 : i)).filter(i => i >= 0)));
    };

    const handleAnalyze = async () => {
        if (draft.lines.length === 0 || analyzing) return;
        setAnalyzing(true);
        try {
            const { analysis, truncated } = await analyzeTranscript(draft.lines, title.trim() || undefined);
            const newLesson: VideoLesson = {
                id: self.crypto.randomUUID(),
                title: title.trim() || analysis.title,
                url: url.trim() || undefined,
                videoId: videoIdDraft || undefined,
                transcript,
                analysis,
                createdAt: Date.now(),
            };
            const savedOnline = await saveLesson(userId, newLesson);
            if (!isMounted.current) return;
            setLessons(prev => [newLesson, ...prev]);
            if (!savedOnline && userId && userId !== 'offline') setSynced(false);
            if (truncated) notifyInfo('Расшифровка очень длинная — разобрана первая часть (~40 тыс. символов).', 6000);
            setTitle(''); setUrl(''); setTranscript('');
            openLesson(newLesson);
        } catch (error) {
            console.error('Lesson analysis failed', error);
            notifyError(describeAiError(error, 'Не удалось разобрать расшифровку. Попробуйте ещё раз.'), 8000);
        } finally {
            if (isMounted.current) setAnalyzing(false);
        }
    };

    const handleCreateCards = async () => {
        if (!lesson || selected.size === 0 || generating) return;
        const items = Array.from<number>(selected).sort((a, b) => a - b).map(i => lesson.analysis.items[i]).filter(Boolean);
        setJustCreated([]);
        setGenerating({ current: 0, total: items.length, term: items[0].term });
        const created: Flashcard[] = [];
        try {
            const folderId = await ensureFolder(`Видео: ${lesson.title}`.slice(0, 60));
            for (let i = 0; i < items.length; i++) {
                if (!isMounted.current) break;
                const item = items[i];
                setGenerating({ current: i + 1, total: items.length, term: item.term });
                const line = findLine(item, lines);
                const rank = rankOf(item.term);
                const card = await buildFlashcard(item.term, item.translation, {
                    folderIds: [folderId],
                    tags: [LESSON_TAG, ...(item.kind === 'phrase' ? ['фраза'] : [])],
                    frequency: rank ? rankToFrequency(rank) : undefined,
                    allowFallback: true,
                    extraExample: usableLine(item, line) ? {
                        level: 'A1',
                        sentence: line.text,
                        translation: item.lineTranslation,
                        source: {
                            lessonId: lesson.id,
                            title: lesson.title,
                            time: line.time,
                            url: lesson.videoId ? youtubeLink(lesson.videoId, line.time) : lesson.url,
                        },
                    } : undefined,
                });
                created.push(card);
            }
        } catch (error) {
            console.error('Lesson card generation failed', error);
            notifyError(describeAiError(error, 'Не удалось создать часть карточек.'), 8000);
        }
        if (created.length > 0) {
            await onCardsCreated(created);
            notifySuccess(`Добавлено карточек: ${created.length}`);
        }
        if (isMounted.current) {
            setJustCreated(created);
            setGenerating(null);
            setSelected(new Set());
        }
    };

    const handleDelete = async (l: VideoLesson) => {
        if (!window.confirm(`Удалить урок «${l.title}»? Созданные карточки останутся.`)) return;
        await deleteLesson(userId, l.id);
        setLessons(prev => prev.filter(x => x.id !== l.id));
        setMode('list');
    };

    const toggle = (i: number) => setSelected(prev => {
        const next = new Set(prev);
        if (next.has(i)) next.delete(i); else next.add(i);
        return next;
    });

    if (loading) {
        return <div className="flex h-full items-center justify-center"><LoaderIcon className="h-8 w-8 animate-spin text-emerald-600" /></div>;
    }

    // ---------- New lesson ----------
    if (mode === 'new') {
        return (
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="mx-auto max-w-3xl space-y-4">
                    <button onClick={() => setMode('list')} className="text-sm font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400">← Все уроки</button>
                    <h2 className="serif text-3xl font-bold text-slate-800 dark:text-white">Новый урок</h2>
                    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-900/20 dark:text-sky-200">
                        <b>Как скопировать расшифровку с YouTube:</b> под видео нажмите «…ещё» → <b>«Показать текст видео»</b> (Show transcript), выделите весь текст справа и скопируйте. Метки времени копировать вместе с текстом — тогда у каждой реплики будет кнопка ▶.
                    </div>
                    <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Название (необязательно) — например, «В банке»"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                    <div>
                        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Ссылка на видео YouTube (необязательно)"
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                        {url.trim() && !videoIdDraft && <p className="mt-1 text-xs text-amber-600">Не похоже на ссылку YouTube — переход к моменту видео работать не будет.</p>}
                    </div>
                    <textarea value={transcript} onChange={e => setTranscript(e.target.value)} rows={12}
                        placeholder={'Вставьте расшифровку, например:\n0:00\nBom dia, em que posso ajudar?\n0:03\nQueria abrir uma conta, se faz favor.'}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                    {transcript.trim() && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Распознано реплик: <b>{draft.lines.length}</b> · метки времени: <b>{draft.hasTimestamps ? 'есть' : 'нет'}</b>
                            {transcript.length > 40_000 && <> · текст длинный — разберём первые ~40 тыс. символов</>}
                        </p>
                    )}
                    <button onClick={handleAnalyze} disabled={!draft.lines.length || analyzing}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-lg font-bold text-white shadow-lg hover:bg-emerald-700 disabled:opacity-50">
                        {analyzing ? <><LoaderIcon className="h-5 w-5 animate-spin" /> Разбираем…</> : <><SparklesIcon className="h-5 w-5" /> Разобрать урок</>}
                    </button>
                </div>
            </div>
        );
    }

    // ---------- Lesson page ----------
    if (mode === 'lesson' && lesson) {
        const variant = VARIANT_LABEL[lesson.analysis.variant] || VARIANT_LABEL.unknown;
        const items = lesson.analysis.items;
        return (
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="mx-auto max-w-3xl space-y-5">
                    <button onClick={() => setMode('list')} className="text-sm font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400">← Все уроки</button>
                    <header className="space-y-2">
                        <h2 className="serif text-3xl font-bold text-slate-800 dark:text-white">{lesson.title}</h2>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${variant.cls}`}>{variant.text}</span>
                            {lesson.videoId && (
                                <a href={youtubeLink(lesson.videoId)} target="_blank" rel="noreferrer" className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-600 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-300">▶ Открыть видео</a>
                            )}
                            <button onClick={() => handleDelete(lesson)} className="ml-auto flex items-center gap-1 text-xs text-slate-400 hover:text-rose-500"><TrashIcon className="h-3.5 w-3.5" /> Удалить урок</button>
                        </div>
                        {lesson.analysis.summary && <p className="text-slate-600 dark:text-slate-300">{lesson.analysis.summary}</p>}
                        {lesson.analysis.variant === 'pt-BR' && (
                            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                                Речь в ролике бразильская — произношение и некоторые слова в Португалии другие (например, ônibus → autocarro, celular → telemóvel).
                            </p>
                        )}
                    </header>

                    {generating && (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-900/20">
                            <div className="mb-2 flex items-center gap-3">
                                <LoaderIcon className="h-5 w-5 animate-spin text-emerald-600" />
                                <p className="font-bold text-emerald-800 dark:text-emerald-300">Создаём карточку {generating.current} из {generating.total}: <span className="font-serif">{generating.term}</span></p>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${((generating.current - 1) / generating.total) * 100}%` }} />
                            </div>
                        </div>
                    )}
                    {!generating && justCreated.length > 0 && (
                        <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-800 dark:bg-emerald-900/20">
                            <p className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300"><CheckCircleIcon className="h-6 w-6" /> Готово! Новых карточек: {justCreated.length}</p>
                            <button onClick={() => onStudyCards(justCreated)} className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700">Учить сейчас</button>
                        </div>
                    )}

                    <section>
                        <div className="mb-2 flex items-center justify-between">
                            <h3 className="font-bold text-slate-800 dark:text-white">Слова и фразы из ролика</h3>
                            <div className="flex gap-2 text-xs font-bold">
                                <button onClick={() => setSelected(new Set(items.map((it, i) => (inCards(it.term) ? -1 : i)).filter(i => i >= 0)))} className="text-emerald-600 hover:underline">Выбрать новые</button>
                                <button onClick={() => setSelected(new Set())} className="text-slate-400 hover:underline">Снять</button>
                            </div>
                        </div>
                        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800">
                            {items.map((item, i) => {
                                const line = findLine(item, lines);
                                const rank = item.kind === 'word' ? rankOf(item.term) : undefined;
                                const have = inCards(item.term);
                                return (
                                    <li key={i} onClick={() => !have && toggle(i)} className={`flex gap-3 px-4 py-3 ${have ? 'opacity-70' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40'}`}>
                                        <div className="pt-1">
                                            {have
                                                ? <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
                                                : <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} onClick={e => e.stopPropagation()} className="h-5 w-5 accent-emerald-600" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-serif text-lg font-bold text-slate-800 dark:text-white">{item.term}</span>
                                                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${item.kind === 'phrase' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}>{item.kind === 'phrase' ? 'фраза' : 'слово'}</span>
                                                {rank && <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" title="Место в частотном словаре">#{rank}</span>}
                                                {have && <span className="text-[11px] font-bold text-emerald-600">в карточках</span>}
                                            </div>
                                            <p className="text-sm text-slate-600 dark:text-slate-300">{item.translation}</p>
                                            {item.note && <p className="text-xs text-amber-700 dark:text-amber-300">{item.note}</p>}
                                            {line && (
                                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                    <TimeLink videoId={lesson.videoId} time={line.time} /> <span className="italic">«{line.text}»</span>
                                                </p>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                        <button onClick={handleCreateCards} disabled={selected.size === 0 || !!generating}
                            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-lg font-bold text-white shadow-lg hover:bg-emerald-700 disabled:opacity-50">
                            <SparklesIcon className="h-5 w-5" /> Создать карточки ({selected.size})
                        </button>
                        <p className="mt-2 text-xs text-slate-400">В карточке первым примером будет реплика из ролика{lesson.videoId ? ' с переходом к этому моменту видео' : ''}. Карточки попадут в папку «Видео: {lesson.title}».</p>
                    </section>

                    <section>
                        <button onClick={() => setShowTranscript(v => !v)} className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
                            <BookIcon className="h-4 w-4" /> Расшифровка ({lines.length} реплик) {showTranscript ? '▲' : '▼'}
                        </button>
                        {showTranscript && (
                            <ol className="mt-2 space-y-1 rounded-2xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-800">
                                {lines.map(l => (
                                    <li key={l.index} className="flex gap-2 text-slate-700 dark:text-slate-300">
                                        <span className="w-14 flex-shrink-0"><TimeLink videoId={lesson.videoId} time={l.time} /></span>
                                        <span>{l.text}</span>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </section>
                </div>
            </div>
        );
    }

    // ---------- List ----------
    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="mx-auto max-w-3xl space-y-5">
                <header className="flex items-end justify-between gap-4">
                    <div>
                        <h2 className="serif text-3xl font-bold text-slate-800 dark:text-white">Видеоуроки</h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Расшифровка ролика → ключевые слова и фразы → карточки с репликами из видео.</p>
                    </div>
                    <button onClick={() => setMode('new')} className="flex flex-shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white shadow hover:bg-emerald-700">
                        <PlusIcon className="h-5 w-5" /> Новый
                    </button>
                </header>
                {!synced && userId && userId !== 'offline' && (
                    <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                        Уроки сейчас сохраняются только в этом браузере. Чтобы они были на всех устройствах, запустите в Supabase скрипт <code>supabase/migrations/20261126_video_lessons.sql</code>.
                    </p>
                )}
                {lessons.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-600">
                        <VolumeIcon className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                        <p className="mb-4 text-slate-500">Пока нет уроков. Возьмите ролик на португальском — например, про банк или поход к врачу — и вставьте его расшифровку.</p>
                        <button onClick={() => setMode('new')} className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700">Создать первый урок</button>
                    </div>
                ) : (
                    <ul className="grid gap-3 sm:grid-cols-2">
                        {lessons.map(l => {
                            const total = l.analysis.items.length;
                            const have = l.analysis.items.filter(it => inCards(it.term)).length;
                            const v = VARIANT_LABEL[l.analysis.variant] || VARIANT_LABEL.unknown;
                            return (
                                <li key={l.id}>
                                    <button onClick={() => openLesson(l)} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
                                        <p className="font-bold text-slate-800 dark:text-white">{l.title}</p>
                                        <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{l.analysis.summary}</p>
                                        <div className="mt-3 flex items-center gap-2 text-xs">
                                            <span className={`rounded-md px-1.5 py-0.5 font-bold ${v.cls}`}>{v.text}</span>
                                            <span className="text-slate-400">в карточках {have}/{total}</span>
                                            <span className="ml-auto text-slate-400">{new Date(l.createdAt).toLocaleDateString()}</span>
                                        </div>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default LessonsView;
