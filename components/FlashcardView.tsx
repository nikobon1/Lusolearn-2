import React, { useState, useEffect, useMemo } from 'react';
import { Flashcard, Example, Pattern } from '../types';
import { VolumeIcon, BookIcon, BrainIcon, XIcon, HomeIcon, GridIcon, LoaderIcon, MicIcon } from './Icons';
import { playAudio, loadAudio, getOrGenerateAudio, preloadAudio } from '../services/geminiService';
import { useSpeechRecording } from '../hooks/useSpeechRecording';

interface Props {
    card: Flashcard;
    onResult: (success: boolean) => void;
    onBack: () => void;
    onUpdate: (card: Flashcard) => void;
}

const FlashcardView: React.FC<Props> = ({ card, onResult, onBack, onUpdate }) => {
    const [isFlipped, setIsFlipped] = useState(false);
    // Track which audio source is currently active: 'main' | 'example' | null
    const [playingTarget, setPlayingTarget] = useState<'main' | 'example' | null>(null);
    const [selectedPattern, setSelectedPattern] = useState<Pattern | null>(null);

    // Restored Features State
    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
    const [activeLevel, setActiveLevel] = useState<'A1' | 'A2' | 'B1' | 'B2'>('A1');
    const [showConjugation, setShowConjugation] = useState(false);
    const [conjugationTense, setConjugationTense] = useState<'presente' | 'perfeito' | 'imperfeito' | 'futuro'>('presente');

    // Pronunciation Practice State
    const [showPronunciationMode, setShowPronunciationMode] = useState(false);
    const [pronunciationTarget, setPronunciationTarget] = useState<'word' | 'sentence'>('word');
    const speech = useSpeechRecording();

    // Preload audio on mount - AGGRESSIVE PRELOADING
    useEffect(() => {
        // Start generating main word audio immediately if not cached
        preloadAudio(card.originalTerm, card.audioBase64);

        // Start generating audio for the current active example immediately
        const ex = card.examples.find(e => e.level === activeLevel);
        if (ex) {
            preloadAudio(ex.sentence);
        }
    }, [card, activeLevel]);

    // Reset state when card changes
    useEffect(() => {
        setIsFlipped(false);
        setSelectedPattern(null);
        setPlaybackSpeed(1.0);
        setActiveLevel('A1');
        setShowConjugation(false);
        setPlayingTarget(null);
        setShowPronunciationMode(false);
        speech.reset();
    }, [card.id]);

    const processAudioPlayback = async (target: 'main' | 'example', text: string, source?: string) => {
        if (playingTarget) return; // Prevent overlapping playback

        setPlayingTarget(target);
        try {
            // Use loadAudio to ensure caching. 
            // If it was preloaded, this will be instant (promise resolves immediately).
            // If it wasn't, it handles generation/fetching transparently.
            await loadAudio(text, source);
            await playAudio(text, playbackSpeed);

            // If we generated new audio for the main word (and didn't have it before), save it
            if (target === 'main' && !card.audioBase64) {
                const audioStr = await getOrGenerateAudio(text); // Helper to get string for DB
                onUpdate({ ...card, audioBase64: audioStr });
            }
        } catch (err) {
            console.error("Audio playback failed", err);
        } finally {
            setPlayingTarget(null);
        }
    };

    const handleMainAudio = async (e: React.MouseEvent) => {
        e.stopPropagation();
        await processAudioPlayback('main', card.originalTerm, card.audioBase64);
    };

    const handleExampleAudio = async (text: string, e: React.MouseEvent) => {
        e.stopPropagation();
        await processAudioPlayback('example', text);
    };

    const currentExample = useMemo(() => {
        return card.examples.find(ex => ex.level === activeLevel) || card.examples[0];
    }, [card.examples, activeLevel]);

    // Helper to highlight patterns in text
    const renderSentenceWithHighlights = (example: Example) => {
        if (!example.patterns || example.patterns.length === 0) return example.sentence;

        const text = example.sentence;
        const sortedPatterns = [...example.patterns].sort((a, b) => b.target.length - a.target.length);

        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        const highlights: { start: number, end: number, pattern: Pattern }[] = [];

        sortedPatterns.forEach(p => {
            const regex = new RegExp(p.target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            const match = text.match(regex);
            if (match && match.index !== undefined) {
                const start = match.index;
                const end = start + match[0].length;
                const isOverlap = highlights.some(h => (start < h.end && end > h.start));
                if (!isOverlap) {
                    highlights.push({ start, end, pattern: p });
                }
            }
        });

        highlights.sort((a, b) => a.start - b.start);

        highlights.forEach(h => {
            if (h.start > lastIndex) {
                parts.push(text.substring(lastIndex, h.start));
            }
            parts.push(
                <span
                    key={h.start}
                    onClick={(e) => { e.stopPropagation(); setSelectedPattern(h.pattern); }}
                    className="text-indigo-700 dark:text-indigo-400 font-medium border-b-2 border-dashed border-indigo-300 dark:border-indigo-600 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/50 transition-colors"
                >
                    {text.substring(h.start, h.end)}
                </span>
            );
            lastIndex = h.end;
        });

        if (lastIndex < text.length) {
            parts.push(text.substring(lastIndex));
        }

        return <>{parts}</>;
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-800 rounded-3xl shadow-xl overflow-hidden relative border border-slate-200 dark:border-slate-700">

            {/* Top Navigation Bar */}
            <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-20 pointer-events-none">
                <button
                    onClick={(e) => { e.stopPropagation(); onBack(); }}
                    className="p-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white shadow-sm pointer-events-auto"
                >
                    <HomeIcon className="w-5 h-5" />
                </button>

                {/* Speed Controls */}
                <div className="pointer-events-auto flex bg-white/90 dark:bg-slate-800/90 backdrop-blur rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 shadow-sm">
                    {[1.0, 0.75, 0.5].map(rate => (
                        <button
                            key={rate}
                            onClick={(e) => { e.stopPropagation(); setPlaybackSpeed(rate); }}
                            className={`px-2 py-1 text-[10px] font-bold rounded-md transition-colors ${playbackSpeed === rate ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                        >
                            {rate}x
                        </button>
                    ))}
                </div>
            </div>

            {/* CARD CONTENT AREA */}
            <div className="flex-1 relative overflow-hidden flex flex-col">

                {/* FRONT SIDE (Image & Word) */}
                {!isFlipped && (
                    <div
                        className="absolute inset-0 flex flex-col cursor-pointer bg-white dark:bg-slate-800"
                        onClick={() => setIsFlipped(true)}
                    >
                        {/* Image Top Half */}
                        <div className="h-[45%] relative overflow-hidden bg-slate-100 dark:bg-slate-900">
                            {card.imageUrl ? (
                                <img src={card.imageUrl} alt={card.originalTerm} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-emerald-900/20 dark:to-teal-900/20">
                                    <BrainIcon className="w-24 h-24 text-emerald-200 dark:text-emerald-800" />
                                </div>
                            )}
                        </div>

                        {/* Text Bottom Half */}
                        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-white dark:bg-slate-800">
                            <h2 className="text-4xl font-bold text-slate-800 dark:text-white mb-3">{card.originalTerm}</h2>
                            <p className="text-xl text-slate-500 dark:text-slate-400">{card.translation}</p>
                            <p className="mt-8 text-xs text-slate-300 dark:text-slate-600 uppercase tracking-widest">Нажмите, чтобы перевернуть</p>
                        </div>
                    </div>
                )}

                {/* BACK SIDE (Details) */}
                {isFlipped && (
                    <div className="absolute inset-0 bg-white dark:bg-slate-800 flex flex-col animate-in fade-in duration-300">
                        {/* Header Area with Padding Top */}
                        <div className="pt-20 px-6 pb-4 border-b border-slate-100 dark:border-slate-700 flex items-start justify-between bg-slate-50/50 dark:bg-slate-800/50 cursor-pointer" onClick={() => setIsFlipped(false)}>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800 dark:text-white leading-tight">{card.originalTerm}</h2>
                                <p className="text-slate-500 dark:text-slate-400 text-lg">{card.translation}</p>
                            </div>
                            <div className="flex gap-2 items-center">
                                {card.conjugation?.isVerb && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setShowConjugation(true); }}
                                        className="p-3 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                                    >
                                        <GridIcon className="w-5 h-5" />
                                    </button>
                                )}
                                <button
                                    onClick={handleMainAudio}
                                    disabled={playingTarget !== null}
                                    className={`p-3 rounded-full transition-all flex-shrink-0 relative ${playingTarget === 'main' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800 cursor-wait' : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:text-emerald-600 hover:border-emerald-200'}`}
                                >
                                    {playingTarget === 'main' ? (
                                        <>
                                            <span className="absolute inset-0 rounded-full border-2 border-emerald-400 opacity-50 animate-ping"></span>
                                            <LoaderIcon className="w-6 h-6 animate-spin" />
                                        </>
                                    ) : (
                                        <VolumeIcon className="w-6 h-6" />
                                    )}
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setPronunciationTarget('word'); setShowPronunciationMode(true); }}
                                    className="p-3 rounded-full bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 border border-violet-100 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors"
                                    title="Практика произношения"
                                >
                                    <MicIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">

                            {/* Definition */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-wider">Определение</h4>
                                <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm md:text-base italic bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                                    "{card.definition}"
                                </p>
                            </div>

                            {/* Context / Examples with Level Tabs */}
                            <div>
                                <div className="flex justify-between items-end mb-3">
                                    <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Пример контекста</h4>
                                    <div className="flex bg-slate-100 dark:bg-slate-700 p-0.5 rounded-lg">
                                        {(['A1', 'A2', 'B1', 'B2'] as const).map(lvl => (
                                            <button
                                                key={lvl}
                                                onClick={(e) => { e.stopPropagation(); setActiveLevel(lvl); }}
                                                className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${activeLevel === lvl ? 'bg-white dark:bg-slate-600 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                                            >
                                                {lvl}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {currentExample ? (
                                    <div className="p-4 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-800/30 transition-all">
                                        <div className="flex justify-between items-start gap-3 mb-2">
                                            <p className="text-slate-800 dark:text-slate-200 font-serif text-lg leading-relaxed">
                                                {renderSentenceWithHighlights(currentExample)}
                                            </p>
                                            <button
                                                onClick={(e) => handleExampleAudio(currentExample.sentence, e)}
                                                disabled={playingTarget !== null}
                                                className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 transition-opacity p-1 flex-shrink-0"
                                            >
                                                {playingTarget === 'example' ? <LoaderIcon className="w-5 h-5 animate-spin" /> : <VolumeIcon className="w-5 h-5 opacity-60 hover:opacity-100" />}
                                            </button>
                                        </div>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm">{currentExample.translation}</p>
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-400 italic p-4">Пример для этого уровня не найден.</p>
                                )}
                            </div>

                            {/* Grammar Notes */}
                            {card.grammarNotes && (
                                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl text-sm text-amber-900/80 dark:text-amber-100/80 border border-amber-100 dark:border-amber-800/30">
                                    <div className="flex items-center gap-2 mb-2 text-amber-600 dark:text-amber-400 font-bold uppercase text-xs">
                                        <BookIcon className="w-3 h-3" /> Грамматика
                                    </div>
                                    {card.grammarNotes}
                                </div>
                            )}

                            <div className="h-20"></div> {/* Bottom Spacer for buttons */}
                        </div>

                        {/* ACTION BUTTONS (Only on Back) */}
                        <div className="absolute bottom-0 left-0 w-full p-4 bg-white/95 dark:bg-slate-800/95 backdrop-blur border-t border-slate-100 dark:border-slate-700 flex gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                            <button
                                onClick={() => onResult(false)}
                                className="flex-1 py-4 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-300 font-bold rounded-2xl hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors text-lg border border-rose-100 dark:border-rose-800/50"
                            >
                                Учить
                            </button>
                            <button
                                onClick={() => onResult(true)}
                                className="flex-1 py-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-300 font-bold rounded-2xl hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors text-lg border border-emerald-100 dark:border-emerald-800/50"
                            >
                                Запомнил
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Pattern Explanation Popup */}
            {selectedPattern && (
                <div
                    className="absolute inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={(e) => { e.stopPropagation(); setSelectedPattern(null); }}
                >
                    <div
                        className="bg-white dark:bg-slate-800 w-full max-w-sm p-6 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in duration-300 border border-slate-100 dark:border-slate-700"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-start mb-3">
                            <h4 className="font-bold text-indigo-700 dark:text-indigo-300 text-xl">{selectedPattern.target}</h4>
                            <button onClick={() => setSelectedPattern(null)} className="p-1 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-400"><XIcon className="w-5 h-5" /></button>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-base">{selectedPattern.explanation}</p>
                    </div>
                </div>
            )}

            {/* Conjugation Modal */}
            {showConjugation && card.conjugation?.tenses && (
                <div
                    className="absolute inset-0 z-50 bg-white dark:bg-slate-800 flex flex-col animate-in slide-in-from-bottom duration-300"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
                        <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><GridIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Спряжение</h3>
                        <button onClick={() => setShowConjugation(false)} className="p-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-full text-slate-500 dark:text-slate-400"><XIcon className="w-5 h-5" /></button>
                    </div>

                    <div className="p-4">
                        <select
                            value={conjugationTense}
                            onChange={(e) => setConjugationTense(e.target.value as any)}
                            className="w-full p-3 rounded-xl border border-indigo-100 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-200 font-bold mb-6 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="presente">Presente (Настоящее)</option>
                            <option value="perfeito">Pretérito Perfeito (Прош. сов.)</option>
                            <option value="imperfeito">Pretérito Imperfeito (Прош. несов.)</option>
                            <option value="futuro">Futuro (Будущее)</option>
                        </select>

                        <div className="space-y-4">
                            {['eu', 'tu', 'ele', 'nos', 'eles'].map((pronoun) => (
                                <div key={pronoun} className="flex items-center justify-between p-3 bg-white dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 rounded-xl shadow-sm">
                                    <span className="text-slate-400 dark:text-slate-500 font-medium w-12">{pronoun === 'nos' ? 'nós' : pronoun}</span>
                                    <span className="text-slate-800 dark:text-slate-200 font-bold text-lg">
                                        {/* @ts-ignore dynamic access */}
                                        {card.conjugation.tenses[conjugationTense][pronoun]}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Pronunciation Practice Modal */}
            {showPronunciationMode && (
                <div
                    className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={(e) => { e.stopPropagation(); setShowPronunciationMode(false); speech.reset(); }}
                >
                    <div
                        className="bg-white dark:bg-slate-800 w-full max-w-md p-6 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-300 border border-slate-100 dark:border-slate-700"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-2">
                                <MicIcon className="w-6 h-6 text-violet-600 dark:text-violet-400" />
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Практика произношения</h3>
                            </div>
                            <button
                                onClick={() => { setShowPronunciationMode(false); speech.reset(); }}
                                className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-400"
                            >
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Target Text */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl mb-6 text-center">
                            <p className="text-xs text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wide">Произнесите:</p>
                            <p className="text-2xl font-bold text-slate-800 dark:text-white">
                                {pronunciationTarget === 'word' ? card.originalTerm : currentExample?.sentence}
                            </p>
                            {pronunciationTarget === 'word' && (
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{card.translation}</p>
                            )}
                        </div>

                        {/* Recording Controls */}
                        <div className="flex flex-col items-center gap-4">
                            {!speech.result && !speech.error && (
                                <button
                                    onClick={async () => {
                                        if (speech.isRecording) {
                                            const targetText = pronunciationTarget === 'word' ? card.originalTerm : (currentExample?.sentence || '');
                                            await speech.stopAndEvaluate(targetText);
                                        } else {
                                            await speech.startRecording();
                                        }
                                    }}
                                    disabled={speech.isProcessing}
                                    className={`w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-lg ${speech.isRecording
                                        ? 'bg-rose-500 hover:bg-rose-600 animate-pulse'
                                        : speech.isProcessing
                                            ? 'bg-slate-300 dark:bg-slate-600 cursor-wait'
                                            : 'bg-violet-600 hover:bg-violet-700'
                                        }`}
                                >
                                    {speech.isProcessing ? (
                                        <LoaderIcon className="w-10 h-10 text-white animate-spin" />
                                    ) : speech.isRecording ? (
                                        <div className="w-8 h-8 bg-white rounded-md" />
                                    ) : (
                                        <MicIcon className="w-10 h-10 text-white" />
                                    )}
                                </button>
                            )}

                            {speech.isRecording && (
                                <p className="text-rose-600 dark:text-rose-400 font-medium animate-pulse">🔴 Запись... Нажмите чтобы остановить</p>
                            )}

                            {speech.isProcessing && (
                                <p className="text-slate-500 dark:text-slate-400">Обработка...</p>
                            )}

                            {/* Error Display */}
                            {speech.error && (
                                <div className="w-full p-4 bg-rose-50 dark:bg-rose-900/20 rounded-2xl text-center">
                                    <p className="text-rose-600 dark:text-rose-400 mb-3">{speech.error}</p>
                                    <button
                                        onClick={() => speech.reset()}
                                        className="px-4 py-2 bg-rose-100 dark:bg-rose-800/30 text-rose-700 dark:text-rose-300 rounded-xl font-medium hover:bg-rose-200 dark:hover:bg-rose-800/50"
                                    >
                                        Попробовать снова
                                    </button>
                                </div>
                            )}

                            {/* Result Display */}
                            {speech.result && (
                                <div className="w-full space-y-4">
                                    {/* Score */}
                                    <div className={`p-4 rounded-2xl text-center ${speech.result.isCorrect
                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30'
                                        : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30'
                                        }`}>
                                        <div className="text-4xl mb-2">
                                            {speech.result.score >= 90 ? '🎉' : speech.result.score >= 70 ? '👍' : speech.result.score >= 50 ? '🔄' : '🎯'}
                                        </div>
                                        <p className={`text-lg font-bold ${speech.result.isCorrect
                                            ? 'text-emerald-700 dark:text-emerald-300'
                                            : 'text-amber-700 dark:text-amber-300'
                                            }`}>
                                            {speech.result.feedback}
                                        </p>
                                        <p className="text-2xl font-bold mt-2 text-slate-800 dark:text-white">{speech.result.score}%</p>
                                    </div>

                                    {/* What was heard */}
                                    <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-xl">
                                        <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Распознано:</p>
                                        <p className="text-slate-700 dark:text-slate-200 font-medium">"{speech.result.heard}"</p>
                                    </div>

                                    {/* Play My Recording */}
                                    {speech.recordingUrl && (
                                        <button
                                            onClick={() => speech.playRecording()}
                                            className="w-full py-3 flex items-center justify-center gap-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-xl font-bold hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
                                        >
                                            🎧 Послушать свою запись
                                        </button>
                                    )}

                                    {/* Try Again */}
                                    <button
                                        onClick={() => speech.reset()}
                                        className="w-full py-3 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-xl font-bold hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors"
                                    >
                                        Попробовать снова
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Listen Button */}
                        {!speech.isRecording && !speech.isProcessing && (
                            <button
                                onClick={async () => {
                                    const text = pronunciationTarget === 'word' ? card.originalTerm : (currentExample?.sentence || '');
                                    await playAudio(text, 0.75);
                                }}
                                className="mt-4 w-full py-3 flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                            >
                                <VolumeIcon className="w-5 h-5" /> Послушать произношение
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FlashcardView;
