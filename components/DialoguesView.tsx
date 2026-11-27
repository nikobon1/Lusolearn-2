import React, { useEffect, useRef, useState } from 'react';
import { DialogueTurn, SCENARIOS, Scenario } from '../domain/dialogues';
import { CefrLevel } from '../domain/reviewExercise';
import { dialogueTurn } from '../services/dialogue';
import { playAndWait, stopAudio } from '../services/audio';
import { describeAiError } from '../services/client';
import { useSpeechRecording } from '../hooks/useSpeechRecording';
import { notifyError } from '../lib/notifications';
import { sounds } from '../lib/sounds';
import VoiceMeter from './VoiceMeter';
import { CheckCircleIcon, LoaderIcon, MicIcon, VolumeIcon, XIcon } from './Icons';

interface Props {
    level: CefrLevel;
    /** Saves a corrected phrase as a flashcard */
    onAddPhrase: (pt: string, ru: string) => Promise<void>;
}

const Say: React.FC<{ text: string }> = ({ text }) => {
    const [busy, setBusy] = useState(false);
    return (
        <button
            onClick={async () => { if (busy) return; setBusy(true); try { await playAndWait(text); } catch { /* audio unavailable */ } finally { setBusy(false); } }}
            className="inline-flex flex-shrink-0 rounded-full p-1 text-slate-400 hover:text-violet-600" title="Послушать"
        >
            {busy ? <LoaderIcon className="h-4 w-4 animate-spin" /> : <VolumeIcon className="h-4 w-4" />}
        </button>
    );
};

/**
 * Role-play dialogues: the AI plays a café owner, pharmacist, clerk…; you reach the scene's goals
 * by speaking (or typing). Each line gets a gentle correction.
 */
const DialoguesView: React.FC<Props> = ({ level, onAddPhrase }) => {
    const [scenario, setScenario] = useState<Scenario | null>(null);
    const [turns, setTurns] = useState<DialogueTurn[]>([]);
    const [goalsDone, setGoalsDone] = useState<number[]>([]);
    const [hint, setHint] = useState<{ pt: string; ru: string } | null>(null);
    const [showHint, setShowHint] = useState(false);
    const [showRu, setShowRu] = useState<Set<number>>(new Set());
    const [finished, setFinished] = useState(false);
    const [thinking, setThinking] = useState(false);
    const [text, setText] = useState('');
    const [autoVoice, setAutoVoice] = useState(true);
    const [added, setAdded] = useState<Set<number>>(new Set());
    const speech = useSpeechRecording();
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [turns, thinking, finished]);
    useEffect(() => () => stopAudio(), []);

    const start = (s: Scenario) => {
        setScenario(s);
        setTurns([{ who: 'ai', pt: s.opening.pt, ru: s.opening.ru }]);
        setGoalsDone([]);
        setHint(null);
        setShowHint(false);
        setShowRu(new Set());
        setFinished(false);
        setAdded(new Set());
        if (autoVoice) playAndWait(s.opening.pt).catch(() => undefined);
    };

    const send = async (line: string) => {
        if (!scenario || !line.trim() || thinking || finished) return;
        const mine: DialogueTurn = { who: 'me', pt: line.trim() };
        const history = turns;
        setTurns(prev => [...prev, mine]);
        setText('');
        setShowHint(false);
        setThinking(true);
        try {
            const r = await dialogueTurn(scenario, history, mine.pt, level, goalsDone);
            const newlyDone = r.goalsDone.filter(g => !goalsDone.includes(g));
            if (newlyDone.length) sounds.success(); else if (!r.check.ok) sounds.almost();
            setTurns(prev => [
                ...prev.slice(0, -1),
                { ...mine, check: r.check },
                { who: 'ai', pt: r.reply, ru: r.replyRu },
            ]);
            setGoalsDone(r.goalsDone);
            setHint(r.hint ? { pt: r.hint, ru: r.hintRu } : null);
            if (r.finished || r.goalsDone.length === scenario.goals.length) setFinished(true);
            if (autoVoice) playAndWait(r.reply).catch(() => undefined);
        } catch (e) {
            notifyError(describeAiError(e, 'Собеседник не ответил. Попробуйте ещё раз.'));
            setTurns(prev => prev.slice(0, -1));
            setText(mine.pt);
        } finally {
            setThinking(false);
        }
    };

    // Voice answer → send what was heard
    useEffect(() => {
        if (speech.result?.heard) send(speech.result.heard);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [speech.result]);

    const toggleMic = async () => {
        stopAudio();
        if (speech.isRecording) await speech.stopAndEvaluate(hint?.pt || '');
        else { speech.reset(); await speech.startRecording({ autoStopText: hint?.pt || ' ' }); }
    };

    // ---------- Scenario list ----------
    if (!scenario) {
        return (
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="mx-auto max-w-2xl space-y-5">
                    <header>
                        <h2 className="serif text-3xl font-bold text-slate-800 dark:text-white">Диалоги</h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Разговор в бытовой ситуации: ИИ играет продавца, фармацевта, соседку… Отвечайте голосом или текстом — каждая ваша фраза получит мягкую поправку. В каждой сцене есть цели.
                        </p>
                    </header>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {SCENARIOS.map(s => (
                            <button key={s.id} onClick={() => start(s)} className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-50/40 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-violet-900/10">
                                <span className="text-2xl">{s.emoji}</span>
                                <span className="mt-1 block font-bold text-slate-800 dark:text-white">{s.title}</span>
                                <span className="block text-sm text-slate-500 dark:text-slate-400">{s.setting}</span>
                            </button>
                        ))}
                    </div>
                    <p className="text-xs text-slate-400">Уровень речи собеседника: {level} (меняется в ⚙️ «Занятия на сегодня»).</p>
                </div>
            </div>
        );
    }

    // ---------- Conversation ----------
    const corrections = turns.map((t, i) => ({ t, i })).filter(({ t }) => t.who === 'me' && t.check && !t.check.ok);
    return (
        <div className="flex h-full flex-col bg-slate-50 dark:bg-slate-900">
            {/* Header with goals */}
            <div className="border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                <div className="mx-auto flex max-w-2xl items-start gap-3">
                    <button onClick={() => { stopAudio(); setScenario(null); }} className="rounded-full p-1 text-slate-400 hover:text-slate-600" title="К сценам"><XIcon className="h-5 w-5" /></button>
                    <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-800 dark:text-white">{scenario.emoji} {scenario.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{scenario.setting}</p>
                        <ul className="mt-1.5 flex flex-wrap gap-1">
                            {scenario.goals.map((g, i) => (
                                <li key={i} className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${goalsDone.includes(i) ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}>
                                    {goalsDone.includes(i) ? '✓ ' : ''}{g}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <button onClick={() => setAutoVoice(v => !v)} className={`rounded-lg px-2 py-1 text-xs font-bold ${autoVoice ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-700'}`} title="Озвучивать ответы собеседника">
                        🔊 {autoVoice ? 'вкл' : 'выкл'}
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
                <div className="mx-auto max-w-2xl space-y-3">
                    {turns.map((t, i) => t.who === 'ai' ? (
                        <div key={i} className="flex max-w-[85%] flex-col items-start">
                            <div className="rounded-2xl rounded-tl-sm bg-white px-4 py-2.5 shadow-sm dark:bg-slate-800">
                                <p className="flex items-start gap-1 font-serif text-lg text-slate-800 dark:text-slate-100">{t.pt} <Say text={t.pt} /></p>
                                {showRu.has(i) && <p className="text-sm text-slate-500 dark:text-slate-400">{t.ru}</p>}
                            </div>
                            {!showRu.has(i) && t.ru && (
                                <button onClick={() => setShowRu(prev => new Set(prev).add(i))} className="mt-0.5 px-2 text-xs font-bold text-slate-400 hover:text-slate-600">перевод</button>
                            )}
                        </div>
                    ) : (
                        <div key={i} className="ml-auto flex max-w-[85%] flex-col items-end">
                            <div className="rounded-2xl rounded-tr-sm bg-violet-600 px-4 py-2.5 text-white shadow-sm">
                                <p className="font-serif text-lg">{t.pt}</p>
                            </div>
                            {t.check && (t.check.ok ? (
                                <p className="mt-0.5 px-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">✓ хорошо</p>
                            ) : (
                                <div className="mt-1 rounded-xl bg-amber-50 px-3 py-1.5 text-sm dark:bg-amber-900/20">
                                    <p className="flex items-center gap-1 font-serif text-slate-800 dark:text-slate-100">Лучше: <b>{t.check.corrected}</b> <Say text={t.check.corrected} /></p>
                                    {t.check.note && <p className="text-xs text-amber-800 dark:text-amber-300">{t.check.note}</p>}
                                </div>
                            ))}
                        </div>
                    ))}
                    {thinking && (
                        <div className="flex items-center gap-2 text-sm text-slate-400"><LoaderIcon className="h-4 w-4 animate-spin" /> собеседник отвечает…</div>
                    )}

                    {finished && (
                        <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
                            <p className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-200"><CheckCircleIcon className="h-5 w-5" /> Сцена пройдена: {goalsDone.length} из {scenario.goals.length} целей</p>
                            {corrections.length > 0 ? (
                                <div>
                                    <p className="mb-1 text-sm text-slate-600 dark:text-slate-300">Фразы, которые стоит запомнить:</p>
                                    <ul className="space-y-1">
                                        {corrections.map(({ t, i }) => (
                                            <li key={i} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm dark:bg-slate-800">
                                                <span className="flex-1 font-serif text-slate-800 dark:text-slate-100">{t.check!.corrected}</span>
                                                {added.has(i) ? <span className="text-xs font-bold text-emerald-600">✓ в карточках</span> : (
                                                    <button onClick={async () => {
                                                        try { await onAddPhrase(t.check!.corrected, t.check!.correctedRu || ''); setAdded(prev => new Set(prev).add(i)); }
                                                        catch (e) { notifyError(describeAiError(e, 'Не удалось добавить фразу.')); }
                                                    }} className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-bold text-white">+ в карточки</button>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : <p className="text-sm text-slate-600 dark:text-slate-300">Ни одной ошибки — отлично! 🎉</p>}
                            <div className="flex gap-2">
                                <button onClick={() => start(scenario)} className="flex-1 rounded-xl bg-white py-2 text-sm font-bold text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200">Ещё раз</button>
                                <button onClick={() => setScenario(null)} className="flex-1 rounded-xl bg-violet-600 py-2 text-sm font-bold text-white">Другая сцена</button>
                            </div>
                        </div>
                    )}
                    <div ref={bottomRef} />
                </div>
            </div>

            {/* Input */}
            {!finished && (
                <div className="border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                    <div className="mx-auto max-w-2xl space-y-2">
                        {hint && (showHint ? (
                            <p className="flex items-center gap-1 rounded-xl bg-violet-50 px-3 py-1.5 text-sm text-violet-900 dark:bg-violet-900/20 dark:text-violet-200">
                                💡 <span className="font-serif">{hint.pt}</span> <Say text={hint.pt} /> <span className="text-xs text-violet-500">— {hint.ru}</span>
                            </p>
                        ) : (
                            <button onClick={() => setShowHint(true)} className="text-xs font-bold text-violet-600 hover:underline dark:text-violet-300">💡 Подсказка: что можно сказать</button>
                        ))}
                        {(speech.isRecording || speech.isProcessing) && <VoiceMeter level={speech.level} voiceDetected={speech.voiceDetected} processing={speech.isProcessing} autoStop />}
                        {speech.error && <p className="text-sm text-rose-600">{speech.error}</p>}
                        <div className="flex gap-2">
                            <input
                                value={text}
                                onChange={e => setText(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') send(text); }}
                                placeholder="Ответьте по-португальски…"
                                lang="pt-PT" autoComplete="off" autoCorrect="off" spellCheck={false}
                                disabled={thinking}
                                className="min-w-0 flex-1 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-violet-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                            />
                            {text.trim() ? (
                                <button onClick={() => send(text)} disabled={thinking} className="rounded-2xl bg-violet-600 px-4 font-bold text-white disabled:opacity-50">→</button>
                            ) : (
                                <button onClick={toggleMic} disabled={thinking || speech.isProcessing} title={speech.isRecording ? 'Остановить запись' : 'Ответить голосом'}
                                    className={`flex h-[52px] w-[52px] items-center justify-center rounded-2xl text-white ${speech.isRecording ? 'animate-pulse bg-rose-500' : 'bg-violet-600 hover:bg-violet-700'} disabled:opacity-50`}>
                                    {speech.isProcessing ? <LoaderIcon className="h-5 w-5 animate-spin" /> : speech.isRecording ? <span className="h-4 w-4 rounded-sm bg-white" /> : <MicIcon className="h-5 w-5" />}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DialoguesView;
