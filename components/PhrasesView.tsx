import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Difficulty, Flashcard } from '../types';
import {
    PhraseDrillItem, PhraseStats, PhraseTemplate, PhraseVerdict as Verdict, SITUATIONS, Situation, TEMPLATES, buildPhraseDrill, checkSentenceDetailed, templatesBySituation,
} from '../domain/phraseTemplates';
import { loadAudio, playAudio } from '../services/geminiService';
import { notifyError, notifySuccess } from '../lib/notifications';
import { CheckCircleIcon, LoaderIcon, PlusIcon, VolumeIcon, XIcon } from './Icons';
import type { PracticeLog } from '../hooks/usePracticeLog';

interface Props {
    cards: Flashcard[];
    userId?: string;
    onCardsCreated: (cards: Flashcard[]) => Promise<void>;
    ensureFolder: (name: string) => Promise<string>;
    practice: PracticeLog;
    /** Started from «Занятие на сегодня»: a short drill in this situation, then back to the route */
    quickStart?: { situation: Situation; count: number } | null;
    onQuickDone?: () => void;
}

const FOLDER = 'Фразы-шаблоны';
const TAG = 'шаблон';
const COUNTS = [10, 20];
const REQUEUE_GAP = 3;


const SayButton: React.FC<{ text: string }> = ({ text }) => {
    const [busy, setBusy] = useState(false);
    return (
        <button
            onClick={async (e) => {
                e.stopPropagation();
                if (busy) return;
                setBusy(true);
                try { await loadAudio(text); await playAudio(text, 0.9); } catch { /* audio unavailable */ } finally { setBusy(false); }
            }}
            className="flex-shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-emerald-600 dark:hover:bg-slate-700"
            title="Послушать"
        >
            {busy ? <LoaderIcon className="h-4 w-4 animate-spin" /> : <VolumeIcon className="h-4 w-4" />}
        </button>
    );
};

const TemplateCard: React.FC<{ t: PhraseTemplate; inCards: boolean; open: boolean; onToggle: () => void }> = ({ t, inCards, open, onToggle }) => (
    <li className="rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <button onClick={onToggle} className="flex w-full items-start justify-between gap-3 p-4 text-left">
            <span>
                <span className="block font-serif text-lg font-bold text-slate-800 dark:text-white">{t.pt}</span>
                <span className="block text-sm text-slate-500 dark:text-slate-400">{t.ru}</span>
            </span>
            {inCards && <span className="flex-shrink-0 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">в карточках</span>}
        </button>
        {open && (
            <div className="space-y-2 border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-700">
                <p className="text-sm text-amber-800 dark:text-amber-300">💡 {t.note}</p>
                <ul className="space-y-1">
                    {t.examples.map((ex, i) => (
                        <li key={i} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-700/40">
                            <span className="flex-1">
                                <span className="block font-serif text-slate-800 dark:text-slate-100">{ex.pt}</span>
                                <span className="block text-xs text-slate-500 dark:text-slate-400">{ex.ru}</span>
                            </span>
                            <SayButton text={ex.pt} />
                        </li>
                    ))}
                </ul>
            </div>
        )}
    </li>
);

const PhrasesView: React.FC<Props> = ({ cards, onCardsCreated, ensureFolder, practice, quickStart, onQuickDone }) => {
    const [phase, setPhase] = useState<'browse' | 'drill' | 'summary'>('browse');
    const [situations, setSituations] = useState<Set<Situation>>(new Set(['cafe']));
    const [openId, setOpenId] = useState<string | null>(null);
    const [count, setCount] = useState(10);
    const [adding, setAdding] = useState(false);

    const [queue, setQueue] = useState<(PhraseDrillItem & { retry?: boolean })[]>([]);
    const [index, setIndex] = useState(0);
    const [value, setValue] = useState('');
    const [checked, setChecked] = useState<{ verdict: Verdict; given: string; overridden?: boolean; bySlot?: boolean } | null>(null);
    const [results, setResults] = useState<{ item: PhraseDrillItem; verdict: Verdict }[]>([]);
    const [showHint, setShowHint] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const checkedAt = useRef(0);

    const cardTerms = useMemo(() => new Set(cards.map(c => c.originalTerm.trim())), [cards]);
    const visible = TEMPLATES.filter(t => situations.has(t.situation));
    const toAdd = visible.filter(t => !cardTerms.has(t.pt));

    const toggleSituation = (s: Situation) => setSituations(prev => {
        const next = new Set(prev);
        if (next.has(s) && next.size > 1) next.delete(s); else next.add(s);
        return next;
    });

    /** Templates become regular flashcards (examples are the hand-written sentences — no AI). */
    const addToCards = async () => {
        if (toAdd.length === 0 || adding) return;
        setAdding(true);
        try {
            const folderId = await ensureFolder(FOLDER);
            const now = Date.now();
            const newCards: Flashcard[] = toAdd.map((t, i) => ({
                id: self.crypto.randomUUID(),
                folderIds: [folderId],
                tags: [TAG, SITUATIONS.find(s => s.id === t.situation)!.label],
                originalTerm: t.pt,
                translation: t.ru,
                definition: t.note,
                examples: t.examples.map(ex => ({ level: 'A1' as const, sentence: ex.pt, translation: ex.ru })),
                difficulty: Difficulty.New,
                interval: 0,
                easeFactor: 2.5,
                nextReviewDate: now,
                createdAt: now + i,
            }));
            await onCardsCreated(newCards);
            notifySuccess(`Добавлено в карточки: ${newCards.length} (папка «${FOLDER}»)`);
        } catch (error) {
            console.error(error);
            notifyError('Не удалось добавить шаблоны в карточки.');
        } finally {
            setAdding(false);
        }
    };

    const readStats = (): PhraseStats => practice.stats('phrase');

    const start = (items?: PhraseDrillItem[], only?: { situations: Situation[]; count: number }) => {
        setQueue(items ?? buildPhraseDrill(only?.situations ?? [...situations], only?.count ?? count, readStats()));
        setIndex(0);
        setResults([]);
        setValue('');
        setChecked(null);
        setShowHint(false);
        setPhase('drill');
    };

    const current = queue[index];

    // Quick start from the daily route
    const quickStarted = useRef(false);
    useEffect(() => {
        if (!quickStart || quickStarted.current) return;
        quickStarted.current = true;
        setSituations(new Set([quickStart.situation]));
        start(undefined, { situations: [quickStart.situation], count: quickStart.count });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quickStart]);

    useEffect(() => {
        if (phase === 'drill' && !checked) inputRef.current?.focus({ preventScroll: true });
    }, [phase, index, checked]);

    const record = (item: PhraseDrillItem, verdict: Verdict) => practice.record('phrase', item.key, verdict);

    const check = (giveUp = false) => {
        if (!current || checked) return;
        const given = giveUp ? '' : value.trim();
        if (!giveUp && !given) return;
        const result = giveUp ? { verdict: 'wrong' as Verdict, bySlot: false } : checkSentenceDetailed(given, current.example.pt, current.template.pt);
        const verdict = result.verdict;
        checkedAt.current = Date.now();
        setChecked({ verdict, given, bySlot: result.bySlot });
        if (!current.retry) {
            setResults(prev => [...prev, { item: current, verdict }]);
            record(current, verdict);
        }
        if (verdict === 'wrong' && !current.retry) {
            setQueue(prev => {
                const at = Math.min(index + 1 + REQUEUE_GAP, prev.length);
                return [...prev.slice(0, at), { ...current, retry: true }, ...prev.slice(at)];
            });
        }
    };

    /** "My answer is also right": count it, drop the retry. */
    const acceptMine = () => {
        if (!current || !checked || checked.verdict !== 'wrong') return;
        setChecked({ ...checked, verdict: 'correct', overridden: true });
        if (!current.retry) {
            setResults(prev => prev.map(r => (r.item.key === current.key ? { ...r, verdict: 'correct' } : r)));
            practice.record('phrase', current.key, 'override');
            setQueue(prev => prev.filter((q, i) => !(i > index && q.retry && q.key === current.key)));
        }
    };

    const next = () => {
        if (Date.now() - checkedAt.current < 400) return;
        setChecked(null);
        setValue('');
        setShowHint(false);
        if (index + 1 >= queue.length) setPhase('summary');
        else setIndex(i => i + 1);
    };

    // ---------- Summary ----------
    if (phase === 'summary') {
        const ok = results.filter(r => r.verdict !== 'wrong').length;
        const wrong = results.filter(r => r.verdict === 'wrong');
        return (
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="mx-auto max-w-2xl space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-800">
                        <CheckCircleIcon className="mx-auto mb-2 h-10 w-10 text-emerald-500" />
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Собрано: {ok} из {results.length}</h2>
                    </div>
                    {wrong.length > 0 && (
                        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800">
                            {wrong.map((r, i) => (
                                <li key={i} className="px-4 py-3">
                                    <p className="font-serif text-slate-800 dark:text-white">{r.item.example.pt}</p>
                                    <p className="text-xs text-slate-500">{r.item.example.ru}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                    <div className="grid gap-2 sm:grid-cols-2">
                        {wrong.length > 0 && <button onClick={() => start(wrong.map(w => w.item))} className="rounded-2xl bg-emerald-600 py-3 font-bold text-white hover:bg-emerald-700">Повторить ошибки · {wrong.length}</button>}
                        {quickStart && onQuickDone && (
                            <button onClick={onQuickDone} className="rounded-2xl bg-emerald-600 py-3 font-bold text-white hover:bg-emerald-700 sm:col-span-2">Дальше по занятию →</button>
                        )}
                        <button onClick={() => setPhase('browse')} className="rounded-2xl bg-slate-100 py-3 font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200">К фразам</button>
                    </div>
                </div>
            </div>
        );
    }

    // ---------- Drill ----------
    if (phase === 'drill' && current) {
        const t = current.template;
        return (
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="mx-auto max-w-xl space-y-4">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setPhase('browse')} className="rounded-full p-1 text-slate-400 hover:text-slate-600" title="Закончить"><XIcon className="h-5 w-5" /></button>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(index / queue.length) * 100}%` }} />
                        </div>
                        <span className="text-xs font-bold text-slate-400">{index}/{queue.length}</span>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                        <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                            Скажите по-португальски {current.retry && <span className="ml-1 text-rose-500">· ещё раз</span>}
                        </p>
                        <p className="mb-4 text-2xl font-bold text-slate-800 dark:text-white">{current.example.ru}</p>
                        <p className="mb-4 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-700/40 dark:text-slate-300">
                            Шаблон: <span className="font-serif font-bold text-slate-800 dark:text-white">{t.pt}</span>
                            <span className="mt-0.5 block text-xs text-slate-400">Напишите всю фразу или только то, что стоит вместо «…»</span>
                        </p>

                        {!checked ? (
                            <div className="space-y-2">
                                <input ref={inputRef} value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') check(); }}
                                    placeholder="Фраза по-португальски" autoComplete="off" autoCorrect="off" spellCheck={false} lang="pt-PT"
                                    className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-lg text-slate-800 outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                                {showHint && <p className="text-sm text-slate-500">Начало: <span className="font-serif font-bold">{current.example.pt.split(' ').slice(0, Math.ceil(current.example.pt.split(' ').length / 2)).join(' ')} …</span></p>}
                                <div className="grid grid-cols-3 gap-2">
                                    <button onClick={() => check(true)} className="rounded-2xl bg-slate-100 py-3 text-sm font-bold text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300">Не знаю</button>
                                    <button onClick={() => setShowHint(true)} disabled={showHint} className="rounded-2xl bg-amber-50 py-3 text-sm font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-40 dark:bg-amber-900/20 dark:text-amber-300">Подсказка</button>
                                    <button onClick={() => check()} disabled={!value.trim()} className="rounded-2xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40">Проверить</button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className={`rounded-2xl border p-3 ${checked.verdict === 'correct' ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20' : checked.verdict === 'almost' ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20' : 'border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-900/20'}`}>
                                    <p className="font-bold text-slate-800 dark:text-white">
                                        {checked.verdict === 'correct' ? (checked.overridden ? '✓ Засчитано' : checked.bySlot ? '✓ Верно! Целиком фраза звучит так:' : '✓ Верно') : checked.verdict === 'almost' ? '≈ Почти — сравните написание' : '✗ Правильно так:'}
                                    </p>
                                    <div className="mt-1 flex items-center gap-2">
                                        <p className="flex-1 font-serif text-lg text-slate-800 dark:text-slate-100">{current.example.pt}</p>
                                        <SayButton text={current.example.pt} />
                                    </div>
                                    {checked.given && checked.verdict !== 'correct' && <p className="text-sm text-slate-500">ваш ответ: {checked.given}</p>}
                                </div>
                                <p className="text-sm text-amber-800 dark:text-amber-300">💡 {t.note}</p>
                                {checked.verdict === 'wrong' && checked.given && (
                                    <button onClick={acceptMine} className="w-full rounded-2xl border border-slate-200 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700">Мой вариант тоже правильный</button>
                                )}
                                <button onClick={next} autoFocus className="w-full rounded-2xl bg-emerald-600 py-3 font-bold text-white hover:bg-emerald-700">
                                    {index + 1 >= queue.length ? 'Итоги' : 'Дальше'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ---------- Browse ----------
    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="mx-auto max-w-2xl space-y-5">
                <header>
                    <h2 className="serif text-3xl font-bold text-slate-800 dark:text-white">Фразы-шаблоны</h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Готовые конструкции для бытовых ситуаций: выучите шаблон — и подставляйте нужные слова. Европейский португальский.
                    </p>
                </header>

                <div className="flex flex-wrap gap-1.5">
                    {SITUATIONS.map(s => (
                        <button key={s.id} onClick={() => toggleSituation(s.id)}
                            className={`rounded-full px-3 py-1.5 text-sm font-bold transition-colors ${situations.has(s.id) ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'}`}>
                            {s.emoji} {s.label} <span className="opacity-70">· {templatesBySituation(s.id).length}</span>
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-900/20">
                    <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Тренировка «Соберите фразу»:</span>
                    {COUNTS.map(n => (
                        <button key={n} onClick={() => setCount(n)} className={`h-8 w-10 rounded-lg text-sm font-bold ${count === n ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>{n}</button>
                    ))}
                    <button onClick={() => start()} className="ml-auto rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700">Начать</button>
                </div>

                <ul className="space-y-2">
                    {visible.map(t => (
                        <TemplateCard key={t.id} t={t} inCards={cardTerms.has(t.pt)} open={openId === t.id} onToggle={() => setOpenId(openId === t.id ? null : t.id)} />
                    ))}
                </ul>

                <button onClick={addToCards} disabled={toAdd.length === 0 || adding}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-emerald-600 py-3 font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-40 dark:text-emerald-300 dark:hover:bg-emerald-900/20">
                    {adding ? <LoaderIcon className="h-5 w-5 animate-spin" /> : <PlusIcon className="h-5 w-5" />}
                    {toAdd.length === 0 ? 'Все шаблоны этих ситуаций уже в карточках' : `Добавить в карточки · ${toAdd.length}`}
                </button>
                <p className="text-center text-xs text-slate-400">Шаблоны попадут в папку «{FOLDER}» и будут повторяться в дневном плане.</p>
            </div>
        </div>
    );
};

export default PhrasesView;
