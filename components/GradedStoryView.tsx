import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Flashcard } from '../types';
import {
    GlossEntry, GradedStory, SERIES_NAME, glossFor, isTargetToken, knownLemmaSet, markStoryReadToday, readSeries,
    rememberEpisode, storyCoverage,
} from '../domain/gradedStory';
import { normalizeTerm } from '../domain/frequencyDictionary';
import { CefrLevel } from '../domain/reviewExercise';
import { generateGradedStory, judgeSpokenAnswer } from '../services/stories';
import { playAndWait, stopAudio } from '../services/audio';
import { describeAiError } from '../services/client';
import { useSpeechRecording } from '../hooks/useSpeechRecording';
import { notifyError, notifySuccess } from '../lib/notifications';
import { sounds } from '../lib/sounds';
import VoiceMeter from './VoiceMeter';
import { BookIcon, HomeIcon, LoaderIcon, MicIcon, PlusIcon, VolumeIcon } from './Icons';

export interface StoryRequest {
    words: Flashcard[];
    series: boolean;
}

interface Props {
    /** Generate a new story… */
    request?: StoryRequest;
    /** …or open a saved one */
    saved?: GradedStory;
    cards: Flashcard[];
    markedKnown: Set<string>;
    level: CefrLevel;
    userId?: string;
    onBack: () => void;
    onNext: () => void;
    onSave: (story: GradedStory) => Promise<void>;
    onAddCard: (gloss: GlossEntry, sentence: { pt: string; ru: string }, storyTitle: string) => Promise<void>;
}

const WORD_SPLIT = /([\p{L}][\p{L}'-]*)/u;

const GradedStoryView: React.FC<Props> = ({ request, saved, cards, markedKnown, level, userId, onBack, onNext, onSave, onAddCard }) => {
    const [story, setStory] = useState<GradedStory | null>(saved || null);
    const [loading, setLoading] = useState(!saved);
    const [error, setError] = useState<string | null>(null);
    const [showAllRu, setShowAllRu] = useState(false);
    const [openRu, setOpenRu] = useState<Set<number>>(new Set());
    const [selected, setSelected] = useState<{ sentence: number; token: string } | null>(null);
    const [playing, setPlaying] = useState<number | null>(null);
    const [loadingAudio, setLoadingAudio] = useState<number | null>(null);
    const [rate, setRate] = useState(1);
    const [answers, setAnswers] = useState<(number | null)[]>([]);
    const [adding, setAdding] = useState<string | null>(null);
    const [added, setAdded] = useState<Set<string>>(new Set());
    const [judging, setJudging] = useState(false);
    const [judgement, setJudgement] = useState<{ heard: string; ok: boolean; feedback: string; corrected: string } | null>(null);
    const stopRef = useRef(false);
    const speech = useSpeechRecording();

    const deckTerms = useMemo(() => new Set(cards.map(c => normalizeTerm(c.originalTerm))), [cards]);

    const generate = async (simpler?: { avoid: string[] }) => {
        if (!request) return;
        setLoading(true);
        setError(null);
        try {
            const knownWords = cards.filter(c => c.interval > 0).sort((a, b) => b.interval - a.interval).map(c => normalizeTerm(c.originalTerm));
            const previous = request.series ? readSeries(userId) : [];
            const episode = request.series ? (previous[previous.length - 1]?.episode || 0) + 1 : 0;
            const result = await generateGradedStory({
                targetWords: request.words.map(c => c.originalTerm),
                knownWords: [...new Set([...knownWords, ...markedKnown])],
                level,
                series: request.series ? { episode, previous: previous.slice(-4) } : undefined,
                simpler,
            });
            const full: GradedStory = {
                ...result,
                targetWords: request.words.map(c => c.originalTerm),
                level,
                series: request.series ? { name: SERIES_NAME, episode } : undefined,
            };
            setStory(full);
            setAnswers(full.questions.map(() => null));
            if (full.series) rememberEpisode(userId, { episode: full.series.episode, title: full.title, summary: full.summary, at: Date.now() });
            onSave(full).catch(e => console.error('Saving story failed', e));
        } catch (e) {
            console.error(e);
            setError(describeAiError(e, 'Не удалось создать историю. Попробуйте ещё раз.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (saved) { setAnswers(saved.questions.map(() => null)); return; }
        generate();
        return () => { stopRef.current = true; stopAudio(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const coverage = useMemo(() => {
        if (!story) return null;
        return storyCoverage(story, knownLemmaSet(cards, markedKnown, story.targetWords));
    }, [story, cards, markedKnown]);

    // ---------- Audio ----------
    const playFrom = async (start: number, single = false) => {
        if (!story) return;
        stopRef.current = false;
        for (let i = start; i < story.sentences.length; i++) {
            if (stopRef.current) break;
            setLoadingAudio(i);
            try {
                const p = playAndWait(story.sentences[i].pt, rate);
                setPlaying(i);
                setLoadingAudio(null);
                await p;
            } catch {
                notifyError('Не удалось загрузить озвучку.');
                break;
            }
            if (single) break;
        }
        setPlaying(null);
        setLoadingAudio(null);
    };
    const stopPlaying = () => { stopRef.current = true; stopAudio(); setPlaying(null); };

    // ---------- Speaking task ----------
    useEffect(() => {
        if (!speech.result || !story) return;
        const heard = speech.result.heard;
        setJudging(true);
        judgeSpokenAnswer(story.speak.qPt, story.sentences.map(s => s.pt).join(' '), heard)
            .then(r => { setJudgement({ heard, ...r }); r.ok ? sounds.success() : sounds.almost(); markStoryReadToday(userId); })
            .catch(e => notifyError(describeAiError(e, 'Не удалось проверить ответ.')))
            .finally(() => setJudging(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [speech.result]);

    const answerQuestion = (qi: number, oi: number) => {
        if (!story || answers[qi] !== null) return;
        const next = answers.map((a, i) => (i === qi ? oi : a));
        setAnswers(next);
        if (oi === story.questions[qi].answer) sounds.success(); else sounds.error();
        if (next.every(a => a !== null)) markStoryReadToday(userId);
    };

    const addWord = async (g: GlossEntry, sentenceIdx: number) => {
        if (!story) return;
        const key = normalizeTerm(g.lemma);
        setAdding(key);
        try {
            await onAddCard(g, story.sentences[sentenceIdx], story.title);
            setAdded(prev => new Set(prev).add(key));
            notifySuccess(`«${g.lemma}» добавлено в карточки`);
        } catch (e) {
            notifyError(describeAiError(e, 'Не удалось добавить слово.'));
        } finally {
            setAdding(null);
        }
    };

    // ---------- Render ----------
    if (loading) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <LoaderIcon className="h-8 w-8 animate-spin text-amber-600" />
                <p className="font-bold text-slate-700 dark:text-slate-200">Пишем историю из ваших слов…</p>
                {request && <p className="max-w-sm text-sm text-slate-500">{request.words.map(w => w.originalTerm).join(', ')}</p>}
            </div>
        );
    }
    if (error || !story) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <p className="text-rose-600">{error || 'История не найдена.'}</p>
                <div className="flex gap-2">
                    <button onClick={onBack} className="rounded-xl bg-slate-100 px-4 py-2 font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200">Назад</button>
                    {request && <button onClick={() => generate()} className="rounded-xl bg-amber-600 px-4 py-2 font-bold text-white">Ещё раз</button>}
                </div>
            </div>
        );
    }

    const covPct = coverage ? Math.round(coverage.share * 100) : 100;
    const covTone = covPct >= 95 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
        : covPct >= 90 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
        : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
    const unknownKeys = new Set((coverage?.unknown || []).map(g => normalizeTerm(g.lemma)));
    const answered = answers.filter(a => a !== null).length;
    const correct = answers.filter((a, i) => a !== null && a === story.questions[i].answer).length;
    const sel = selected ? glossFor(story, selected.token) : undefined;

    return (
        <div className="flex-1 overflow-y-auto bg-amber-50/40 p-4 dark:bg-slate-900 md:p-8">
            <div className="mx-auto max-w-2xl space-y-4">
                {/* Header */}
                <div className="flex items-start gap-3">
                    <button onClick={() => { stopPlaying(); onBack(); }} className="rounded-full p-2 text-amber-800 hover:bg-amber-100 dark:text-amber-500 dark:hover:bg-slate-800" title="Назад">
                        <HomeIcon className="h-5 w-5" />
                    </button>
                    <div className="min-w-0 flex-1">
                        {story.series && <p className="text-[11px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">{story.series.name} · серия {story.series.episode}</p>}
                        <h2 className="font-serif text-2xl font-bold text-slate-800 dark:text-white">{story.title}</h2>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${covTone}`} title="Доля слов текста, которые вы уже учили или знаете (служебные слова вроде o, de, em, que считаются известными)">Вы знаете {covPct}% слов</span>
                            {coverage && coverage.unknown.length > 0 && <span className="text-xs text-slate-500">новых: {coverage.unknown.length}</span>}
                            {request && covPct < 90 && (
                                <button onClick={() => generate({ avoid: (coverage?.unknown || []).map(g => g.lemma) })} className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-amber-700 shadow-sm hover:bg-amber-50 dark:bg-slate-800 dark:text-amber-400">
                                    Слишком сложно — проще
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex flex-wrap items-center gap-2">
                    {playing !== null || loadingAudio !== null ? (
                        <button onClick={stopPlaying} className="flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2 text-sm font-bold text-white">■ Стоп</button>
                    ) : (
                        <button onClick={() => playFrom(0)} className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700"><VolumeIcon className="h-4 w-4" /> Слушать</button>
                    )}
                    <div className="flex rounded-lg bg-white p-0.5 shadow-sm dark:bg-slate-800">
                        {[1, 0.8].map(r => (
                            <button key={r} onClick={() => setRate(r)} className={`rounded-md px-2 py-1 text-xs font-bold ${rate === r ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'text-slate-500'}`}>{r}×</button>
                        ))}
                    </div>
                    <button onClick={() => setShowAllRu(v => !v)} className="ml-auto rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300">
                        {showAllRu ? 'Скрыть перевод' : 'Показать перевод'}
                    </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Нажмите на слово — перевод. На 🔊 у предложения — послушать его и увидеть перевод. <b className="text-emerald-700 dark:text-emerald-400">Зелёные</b> — слова, которые вы учите, <span className="underline decoration-dotted">подчёркнутые</span> — новые.</p>

                {/* Text */}
                <div className="space-y-3 rounded-3xl border border-amber-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    {story.sentences.map((s, si) => (
                        <div key={si} className={`rounded-xl px-2 py-1 transition-colors ${playing === si ? 'bg-amber-100/70 dark:bg-amber-900/30' : ''}`}>
                            <p className="font-serif text-lg leading-relaxed text-slate-800 dark:text-slate-100">
                                {s.pt.split(WORD_SPLIT).map((part, pi) => {
                                    if (!WORD_SPLIT.test(part) || pi % 2 === 0) return <React.Fragment key={pi}>{part}</React.Fragment>;
                                    const g = glossFor(story, part);
                                    const target = isTargetToken(story, part);
                                    const isNew = !target && g && !g.name && unknownKeys.has(normalizeTerm(g.lemma));
                                    const isSel = selected?.sentence === si && selected.token === part;
                                    return (
                                        <span key={pi} onClick={() => setSelected(isSel ? null : { sentence: si, token: part })}
                                            className={`cursor-pointer rounded ${isSel ? 'bg-amber-200 dark:bg-amber-700/60' : 'hover:bg-amber-50 dark:hover:bg-slate-700'} ${target ? 'font-bold text-emerald-700 dark:text-emerald-400' : ''} ${isNew ? 'underline decoration-slate-400 decoration-dotted underline-offset-4' : ''}`}>
                                            {part}
                                        </span>
                                    );
                                })}
                                <button onClick={() => { setOpenRu(prev => new Set(prev).add(si)); playFrom(si, true); }} className="ml-1 inline-flex align-middle text-slate-400 hover:text-amber-600" title="Послушать предложение и перевод">
                                    {loadingAudio === si ? <LoaderIcon className="h-4 w-4 animate-spin" /> : <VolumeIcon className="h-4 w-4" />}
                                </button>
                            </p>
                            {(showAllRu || openRu.has(si)) && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{s.ru}</p>}
                            {selected?.sentence === si && (
                                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm dark:bg-slate-700/60">
                                    {sel ? (
                                        <>
                                            <span><b className="text-slate-800 dark:text-white">{sel.form}</b>{sel.lemma && sel.lemma.toLowerCase() !== sel.form.toLowerCase() && <span className="text-slate-500"> ← {sel.lemma}</span>} — {sel.ru}</span>
                                            {!sel.name && !sel.lemma.includes('+') && !deckTerms.has(normalizeTerm(sel.lemma)) && (
                                                added.has(normalizeTerm(sel.lemma))
                                                    ? <span className="ml-auto text-xs font-bold text-emerald-600">✓ в карточках</span>
                                                    : <button onClick={() => addWord(sel, si)} disabled={adding !== null} className="ml-auto flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-xs font-bold text-white disabled:opacity-50">
                                                        {adding === normalizeTerm(sel.lemma) ? <LoaderIcon className="h-3 w-3 animate-spin" /> : <PlusIcon className="h-3 w-3" />} В карточки
                                                    </button>
                                            )}
                                            {deckTerms.has(normalizeTerm(sel.lemma)) && <span className="ml-auto text-xs text-slate-400">уже в карточках</span>}
                                        </>
                                    ) : <span className="text-slate-500">Нет в словарике — посмотрите перевод предложения.</span>}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Comprehension */}
                {story.questions.length > 0 && (
                    <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                        <h3 className="flex items-center gap-2 font-bold text-slate-800 dark:text-white"><BookIcon className="h-5 w-5 text-amber-600" /> Проверьте себя</h3>
                        {story.questions.map((q, qi) => (
                            <div key={qi}>
                                <p className="font-medium text-slate-800 dark:text-slate-100">{qi + 1}. {q.q}</p>
                                <p className="mb-1.5 text-xs text-slate-400">{q.qRu}</p>
                                <div className="grid gap-1.5">
                                    {q.options.map((o, oi) => {
                                        const chosen = answers[qi] === oi;
                                        const done = answers[qi] !== null;
                                        const right = oi === q.answer;
                                        return (
                                            <button key={oi} onClick={() => answerQuestion(qi, oi)} disabled={done}
                                                className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${done && right ? 'border-emerald-400 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200' : done && chosen ? 'border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-200' : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700'}`}>
                                                {o}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                        {answered === story.questions.length && (
                            <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 dark:bg-slate-700/50 dark:text-slate-200">
                                Понимание: {correct} из {story.questions.length} {correct === story.questions.length ? '🎉' : '— загляните в перевод предложений, где ошиблись'}
                            </p>
                        )}

                        {/* Speaking */}
                        <div className="border-t border-slate-100 pt-3 dark:border-slate-700">
                            <p className="font-medium text-slate-800 dark:text-slate-100">🎤 {story.speak.qPt}</p>
                            <p className="mb-2 text-xs text-slate-400">{story.speak.qRu} — ответьте вслух одной фразой</p>
                            {!judgement && (
                                <div className="flex flex-col items-center gap-2">
                                    <button
                                        onClick={async () => { if (speech.isRecording) await speech.stopAndEvaluate(story.speak.sample); else await speech.startRecording({ autoStopText: story.speak.sample }); }}
                                        disabled={speech.isProcessing || judging}
                                        className={`flex h-14 w-14 items-center justify-center rounded-full text-white shadow ${speech.isRecording ? 'animate-pulse bg-rose-500' : 'bg-violet-600 hover:bg-violet-700'} disabled:opacity-50`}
                                    >
                                        {speech.isProcessing || judging ? <LoaderIcon className="h-6 w-6 animate-spin" /> : speech.isRecording ? <span className="h-5 w-5 rounded-sm bg-white" /> : <MicIcon className="h-6 w-6" />}
                                    </button>
                                    {(speech.isRecording || speech.isProcessing) && <VoiceMeter level={speech.level} voiceDetected={speech.voiceDetected} processing={speech.isProcessing} autoStop />}
                                    {judging && <p className="text-sm text-slate-500">Проверяю ответ…</p>}
                                    {speech.error && <p className="text-sm text-rose-600">{speech.error}</p>}
                                </div>
                            )}
                            {judgement && (
                                <div className={`space-y-1 rounded-xl px-3 py-2 text-sm ${judgement.ok ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
                                    <p className="text-slate-500">Вы сказали: «{judgement.heard}»</p>
                                    <p className="font-medium text-slate-800 dark:text-slate-100">{judgement.ok ? '✓ ' : ''}{judgement.feedback}</p>
                                    <p className="flex items-center gap-2 font-serif text-slate-800 dark:text-slate-100">
                                        <span>Лучше так: <b>{judgement.corrected}</b></span>
                                        <button onClick={() => playAndWait(judgement.corrected).catch(() => undefined)} className="text-slate-400 hover:text-amber-600"><VolumeIcon className="h-4 w-4" /></button>
                                    </p>
                                    <button onClick={() => { setJudgement(null); speech.reset(); }} className="text-xs font-bold text-violet-700 hover:underline dark:text-violet-300">Ответить ещё раз</button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="grid gap-2 pb-6 sm:grid-cols-2">
                    <button onClick={() => { stopPlaying(); onBack(); }} className="rounded-2xl bg-slate-100 py-3 font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200">К историям</button>
                    <button onClick={() => { stopPlaying(); onNext(); }} className="rounded-2xl bg-amber-600 py-3 font-bold text-white hover:bg-amber-700">{story.series ? 'Следующая серия →' : 'Новая история →'}</button>
                </div>
            </div>
        </div>
    );
};

export default GradedStoryView;
