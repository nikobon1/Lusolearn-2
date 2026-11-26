import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Flashcard } from '../types';
import { PERSONS, PERSON_LABELS, TENSES, TENSE_LABELS, Tense, conjugate, ruleHint } from '../domain/conjugation';
import type { TheoryTopic } from '../domain/conjugationTheory';
import ConjugationTheory from './ConjugationTheory';
import { DrillItem, DrillStats, DrillVerb, ExampleSentence, buildDrill } from '../domain/conjugationDrill';
import { FrequencyEntry, loadFrequencyDictionary, normalizeTerm } from '../domain/frequencyDictionary';
import { AnswerVerdict, checkAnswer, stripArticle } from '../domain/reviewExercise';
import { supabase } from '../services/supabase';
import { CheckCircleIcon, GridIcon, LoaderIcon, XIcon } from './Icons';
import type { PracticeLog } from '../hooks/usePracticeLog';
import type { PracticeVerdict } from '../domain/practiceLog';

interface Props {
    cards: Flashcard[];
    practice: PracticeLog;
    /** Started from «Занятие на сегодня»: a short drill, then back to the route */
    quickStart?: { count: number } | null;
    onQuickDone?: () => void;
}

type VerbSource = 10 | 25 | 50 | 100 | 'mine';
const COUNTS = [10, 20, 30];
const REQUEUE_GAP = 3;


interface QueueItem extends DrillItem { retry?: boolean }
interface Result { item: DrillItem; given: string; verdict: AnswerVerdict }

const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }> = ({ active, onClick, children, disabled }) => (
    <button onClick={onClick} disabled={disabled} className={`rounded-full px-3 py-1.5 text-sm font-bold transition-colors disabled:opacity-40 ${active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'}`}>
        {children}
    </button>
);

const TenseTableView: React.FC<{ verb: string; tense: Tense; highlight?: string }> = ({ verb, tense, highlight }) => {
    const table = conjugate(verb);
    if (!table) return null;
    return (
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-700/40">
            {PERSONS.map(p => (
                <React.Fragment key={p}>
                    <span className="text-slate-400">{PERSON_LABELS[p].pt}</span>
                    <span className={`font-bold ${highlight === p ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-200'}`}>{table[tense][p]}</span>
                </React.Fragment>
            ))}
        </div>
    );
};

/**
 * Tenses for a quick drill: the present until it's solid, then also the tenses already practised.
 */
const quickTenses = (stats: DrillStats): Tense[] => {
    const practised = new Set<Tense>();
    let presentRight = 0;
    for (const [key, s] of Object.entries(stats)) {
        const tense = key.split('|')[1] as Tense;
        practised.add(tense);
        if (tense === 'presente') presentRight += s.right;
    }
    if (presentRight < 40) return ['presente'];
    return TENSES.filter(t => practised.has(t) || t === 'perfeito');
};

const ConjugationTrainer: React.FC<Props> = ({ cards, practice, quickStart, onQuickDone }) => {
    const readStats = (): DrillStats => practice.stats('conjugation');
    const [dictionary, setDictionary] = useState<FrequencyEntry[] | null>(null);
    const [phase, setPhase] = useState<'setup' | 'drill' | 'summary'>('setup');
    // First visit starts with theory; after some practice — with practice
    const [tab, setTab] = useState<'theory' | 'practice'>(() => Object.keys(practice.stats('conjugation')).length > 0 || quickStart ? 'practice' : 'theory');
    const [theoryOpen, setTheoryOpen] = useState<TheoryTopic['id'] | null>(null);
    const [source, setSource] = useState<VerbSource>(10);
    const [tenses, setTenses] = useState<Set<Tense>>(new Set(['presente']));
    const [count, setCount] = useState(10);
    const [preparing, setPreparing] = useState(false);

    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [index, setIndex] = useState(0);
    const [value, setValue] = useState('');
    const [checked, setChecked] = useState<{ verdict: AnswerVerdict; given: string } | null>(null);
    const [results, setResults] = useState<Result[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const nextRef = useRef<HTMLButtonElement>(null);
    // The Enter that submits an answer must not also press "Дальше" (focus moves there right away)
    const checkedAtRef = useRef(0);

    useEffect(() => { loadFrequencyDictionary().then(setDictionary).catch(() => setDictionary([])); }, []);

    const dictVerbs = useMemo<DrillVerb[]>(
        () => (dictionary || []).filter(e => e.p === 'verb' && !e.w.includes(' ') && conjugate(e.w))
            .map(e => ({ infinitive: e.w, translation: e.ru, rank: e.r })),
        [dictionary]
    );

    const myVerbs = useMemo<DrillVerb[]>(() => {
        const verbKeys = new Set(dictVerbs.map(v => v.infinitive));
        const seen = new Set<string>();
        const out: DrillVerb[] = [];
        for (const c of cards) {
            const inf = stripArticle(c.originalTerm.trim()).toLowerCase();
            if (seen.has(inf) || inf.includes(' ') || !conjugate(inf)) continue;
            if (!c.conjugation?.isVerb && !verbKeys.has(inf)) continue;
            seen.add(inf);
            out.push({ infinitive: inf, translation: c.translation, rank: dictVerbs.find(v => v.infinitive === inf)?.rank });
        }
        return out.sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9));
    }, [cards, dictVerbs]);

    const selectedVerbs = source === 'mine' ? myVerbs : dictVerbs.slice(0, source);

    const toggleTense = (t: Tense) => setTenses(prev => {
        const next = new Set(prev);
        if (next.has(t) && next.size > 1) next.delete(t); else next.add(t);
        return next;
    });

    /** Example sentences for context: your cards + the shared word base. */
    const loadExamples = async (verbs: DrillVerb[]): Promise<Record<string, ExampleSentence[]>> => {
        const byVerb: Record<string, ExampleSentence[]> = {};
        const add = (inf: string, ex: any) => {
            if (!ex?.sentence || ex.source) return;
            (byVerb[inf] ||= []).push({ sentence: ex.sentence, translation: ex.translation || '' });
        };
        const wanted = new Set(verbs.map(v => v.infinitive));
        for (const c of cards) {
            const inf = normalizeTerm(c.originalTerm);
            if (wanted.has(inf)) (c.examples || []).forEach(ex => add(inf, ex));
        }
        try {
            const { data } = await supabase.from('word_entries').select('term_key, examples').in('term_key', [...wanted]);
            (data || []).forEach((row: any) => (row.examples || []).forEach((ex: any) => add(row.term_key, ex)));
        } catch {
            // shared base unavailable — drill without context sentences
        }
        return byVerb;
    };

    const start = async (items?: DrillItem[], override?: { tenses: Tense[]; verbs: DrillVerb[]; count?: number }) => {
        setPreparing(true);
        let drill = items;
        if (!drill) {
            const verbs = override?.verbs ?? selectedVerbs;
            const examples = await loadExamples(verbs);
            drill = buildDrill(verbs, override?.tenses ?? [...tenses], override?.count ?? count, readStats(), examples);
        }
        setQueue(drill);
        setIndex(0);
        setResults([]);
        setValue('');
        setChecked(null);
        setPhase('drill');
        setPreparing(false);
    };

    const current = queue[index];

    useEffect(() => {
        if (phase !== 'drill') return;
        if (checked) nextRef.current?.focus({ preventScroll: true });
        else inputRef.current?.focus({ preventScroll: true });
    }, [phase, index, checked]);

    const check = (giveUp = false) => {
        if (!current || checked) return;
        const given = giveUp ? '' : value.trim();
        if (!giveUp && !given) return;
        const verdict: AnswerVerdict = giveUp ? 'wrong' : checkAnswer(given, current.answer);
        checkedAtRef.current = Date.now();
        setChecked({ verdict, given });

        if (!current.retry) {
            setResults(prev => [...prev, { item: current, given, verdict }]);
            practice.record('conjugation', current.key, verdict as PracticeVerdict);
        }
        if (verdict === 'wrong' && !current.retry) {
            setQueue(prev => {
                const at = Math.min(index + 1 + REQUEUE_GAP, prev.length);
                return [...prev.slice(0, at), { ...current, retry: true }, ...prev.slice(at)];
            });
        }
    };

    const next = () => {
        if (Date.now() - checkedAtRef.current < 400) return;
        setChecked(null);
        setValue('');
        if (index + 1 >= queue.length) setPhase('summary');
        else setIndex(i => i + 1);
    };

    // Quick start from the daily route: your verbs (or the most frequent), once the dictionary is loaded
    const quickStarted = useRef(false);
    useEffect(() => {
        if (!quickStart || quickStarted.current || !dictionary) return;
        quickStarted.current = true;
        const verbs = myVerbs.length >= 3 ? myVerbs.slice(0, 30) : dictVerbs.slice(0, 25);
        const quick = quickTenses(readStats());
        setTenses(new Set(quick));
        start(undefined, { tenses: quick, verbs, count: quickStart.count });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quickStart, dictionary]);

    // Practise a tense straight from its theory page: top-25 verbs, this tense only
    const practiceTense = (tense: Tense) => {
        const verbs = dictVerbs.slice(0, 25);
        setTenses(new Set([tense]));
        setSource(25);
        start(undefined, { tenses: [tense], verbs });
    };

    // ---------- Setup ----------
    if (phase === 'setup') {
        return (
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="mx-auto max-w-2xl space-y-5">
                    <header>
                        <h2 className="serif text-3xl font-bold text-slate-800 dark:text-white">Спряжения</h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Сначала правило, потом практика. Формы — европейский португальский.
                        </p>
                    </header>

                    <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                        {([['theory', 'Теория'], ['practice', 'Практика']] as const).map(([id, label]) => (
                            <button key={id} onClick={() => setTab(id)} className={`flex-1 rounded-lg py-2 text-sm font-bold transition-colors ${tab === id ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400'}`}>
                                {label}
                            </button>
                        ))}
                    </div>

                    {tab === 'theory' ? (
                        <ConjugationTheory openId={theoryOpen} onOpen={setTheoryOpen} onPractice={practiceTense} />
                    ) : (<>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Впишите нужную форму глагола. Самые частые глаголы и ваши ошибки попадаются чаще.
                    </p>

                    <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Какие глаголы</p>
                        <div className="flex flex-wrap gap-1.5">
                            {([10, 25, 50, 100] as const).map(n => <Chip key={n} active={source === n} onClick={() => setSource(n)}>Топ-{n}</Chip>)}
                            <Chip active={source === 'mine'} onClick={() => setSource('mine')} disabled={myVerbs.length === 0}>Мои глаголы ({myVerbs.length})</Chip>
                        </div>
                        <p className="text-xs text-slate-400">
                            {dictionary === null ? 'Загружаем словарь…' : selectedVerbs.slice(0, 12).map(v => v.infinitive).join(', ') + (selectedVerbs.length > 12 ? '…' : '')}
                        </p>
                    </section>

                    <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Времена</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {TENSES.map(t => (
                                <button key={t} onClick={() => toggleTense(t)} className={`rounded-xl border-2 px-3 py-2 text-left transition-colors ${tenses.has(t) ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-100 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700'}`}>
                                    <p className={`text-sm font-bold ${tenses.has(t) ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-200'}`}>{TENSE_LABELS[t].pt} · {TENSE_LABELS[t].ru}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{TENSE_LABELS[t].hint}</p>
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-slate-400">Для начала — только Presente. Добавляйте прошедшее, когда настоящее станет лёгким.</p>
                    </section>

                    <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Сколько заданий</p>
                        <div className="flex gap-1.5">{COUNTS.map(n => <Chip key={n} active={count === n} onClick={() => setCount(n)}>{n}</Chip>)}</div>
                    </section>

                    <button onClick={() => start()} disabled={!dictionary || selectedVerbs.length === 0 || preparing}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-4 text-lg font-bold text-white shadow-lg hover:bg-indigo-700 disabled:opacity-50">
                        {preparing ? <LoaderIcon className="h-5 w-5 animate-spin" /> : <GridIcon className="h-5 w-5" />} Начать
                    </button>
                    </>)}
                </div>
            </div>
        );
    }

    // ---------- Summary ----------
    if (phase === 'summary') {
        const correct = results.filter(r => r.verdict !== 'wrong').length;
        const mistakes = results.filter(r => r.verdict === 'wrong');
        const almost = results.filter(r => r.verdict === 'almost');
        return (
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="mx-auto max-w-2xl space-y-5">
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-800">
                        <CheckCircleIcon className="mx-auto mb-2 h-10 w-10 text-indigo-500" />
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Правильно: {correct} из {results.length}</h2>
                        {almost.length > 0 && <p className="mt-1 text-sm text-amber-600">С ошибкой в ударении/написании: {almost.length}</p>}
                    </div>
                    {mistakes.length > 0 && (
                        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800">
                            {mistakes.map((r, i) => (
                                <li key={i} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                                    <span className="text-slate-500">{r.item.verb.infinitive} · {TENSE_LABELS[r.item.tense].ru} · {PERSON_LABELS[r.item.person].pt}</span>
                                    <span>
                                        {r.given && <span className="mr-2 text-rose-500 line-through">{r.given}</span>}
                                        <b className="text-slate-800 dark:text-white">{r.item.answer}</b>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                    <div className="grid gap-2 sm:grid-cols-2">
                        {quickStart && onQuickDone && (
                            <button onClick={onQuickDone} className="rounded-2xl bg-emerald-600 py-3 font-bold text-white hover:bg-emerald-700 sm:col-span-2">Дальше по занятию →</button>
                        )}
                        {mistakes.length > 0 && (
                            <button onClick={() => start(mistakes.map(m => m.item))} className="rounded-2xl bg-indigo-600 py-3 font-bold text-white hover:bg-indigo-700">Повторить ошибки · {mistakes.length}</button>
                        )}
                        <button onClick={() => { setTab('practice'); setPhase('setup'); }} className="rounded-2xl bg-slate-100 py-3 font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200">Новая тренировка</button>
                        {mistakes.length > 0 && (
                            <button onClick={() => { setTab('theory'); setTheoryOpen(mistakes[0].item.tense); setPhase('setup'); }} className="rounded-2xl bg-slate-100 py-3 font-bold text-slate-700 hover:bg-slate-200 sm:col-span-2 dark:bg-slate-700 dark:text-slate-200">
                                📖 Повторить правило: {TENSE_LABELS[mistakes[0].item.tense].pt}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ---------- Drill ----------
    if (!current) return null;
    const label = TENSE_LABELS[current.tense];
    const person = PERSON_LABELS[current.person];
    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="mx-auto max-w-xl space-y-4">
                <div className="flex items-center gap-3">
                    <button onClick={() => setPhase('setup')} className="rounded-full p-1 text-slate-400 hover:text-slate-600" title="Закончить"><XIcon className="h-5 w-5" /></button>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${(index / queue.length) * 100}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-400">{index}/{queue.length}</span>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">{label.pt} · {label.ru}</span>
                        {current.retry && <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-600 dark:bg-rose-900/30 dark:text-rose-300">ещё раз</span>}
                    </div>
                    <p className="mb-5 text-slate-500 dark:text-slate-400">
                        <span className="font-serif text-2xl font-bold text-slate-800 dark:text-white">{current.verb.infinitive}</span> — {current.verb.translation}
                    </p>

                    {current.context ? (
                        <div className="mb-5">
                            <p className="font-serif text-2xl leading-relaxed text-slate-800 dark:text-slate-100">
                                {current.context.before}
                                <span className="mx-1 inline-block min-w-[4rem] border-b-2 border-indigo-500">&nbsp;</span>
                                {current.context.after}
                            </p>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{current.context.translation}</p>
                            <p className="mt-2 text-xs text-slate-400">лицо: <b>{person.pt}</b> ({person.ru})</p>
                        </div>
                    ) : (
                        <p className="mb-5 font-serif text-3xl text-slate-800 dark:text-white">
                            {person.pt} <span className="inline-block min-w-[5rem] border-b-2 border-indigo-500">&nbsp;</span>
                            <span className="ml-2 font-sans text-sm text-slate-400">({person.ru})</span>
                        </p>
                    )}

                    {!checked ? (
                        <div className="space-y-2">
                            <input ref={inputRef} value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') check(); }}
                                placeholder="Форма глагола" autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} lang="pt-PT"
                                className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-lg text-slate-800 outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => check(true)} className="rounded-2xl bg-slate-100 py-3 font-bold text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300">Не знаю</button>
                                <button onClick={() => check()} disabled={!value.trim()} className="rounded-2xl bg-indigo-600 py-3 font-bold text-white hover:bg-indigo-700 disabled:opacity-40">Проверить</button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className={`rounded-2xl border p-3 ${checked.verdict === 'correct' ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20' : checked.verdict === 'almost' ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20' : 'border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-900/20'}`}>
                                <p className="font-bold text-slate-800 dark:text-white">
                                    {checked.verdict === 'correct' ? '✓ Верно' : checked.verdict === 'almost' ? '≈ Почти — проверьте ударение' : '✗ Правильно:'} <span className="text-indigo-700 dark:text-indigo-300">{current.answer}</span>
                                </p>
                                {checked.given && checked.verdict !== 'correct' && <p className="text-sm text-slate-500">ваш ответ: <span className="line-through">{checked.given}</span></p>}
                            </div>
                            <TenseTableView verb={current.verb.infinitive} tense={current.tense} highlight={current.person} />
                            {checked.verdict !== 'correct' && (
                                <p className="rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-200">
                                    💡 {ruleHint(current.verb.infinitive, current.tense, current.person)}
                                </p>
                            )}
                            <button ref={nextRef} onClick={next}
                                className="w-full rounded-2xl bg-indigo-600 py-3 font-bold text-white hover:bg-indigo-700">
                                {index + 1 >= queue.length ? 'Итоги' : 'Дальше'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ConjugationTrainer;
