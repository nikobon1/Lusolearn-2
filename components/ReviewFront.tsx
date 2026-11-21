import React, { useEffect, useRef, useState } from 'react';
import { Flashcard } from '../types';
import { AnswerVerdict, Exercise, checkAnswer } from '../domain/reviewExercise';
import { useSpeechRecording } from '../hooks/useSpeechRecording';
import { BrainIcon, LoaderIcon, MicIcon, VolumeIcon } from './Icons';

export interface AnswerResult {
    verdict: AnswerVerdict;
    given: string;
    expected: string;
    /** Answer was given by voice */
    spoken?: boolean;
}

interface Props {
    card: Flashcard;
    exercise: Exercise;
    onReveal: (result?: AnswerResult) => void;
    onPlayWord: (e: React.MouseEvent) => void;
    isPlaying: boolean;
}

const CardImage: React.FC<{ card: Flashcard; compact?: boolean }> = ({ card, compact }) => (
    <div className={`${compact ? 'h-[32%]' : 'h-[45%]'} relative overflow-hidden bg-slate-100 dark:bg-slate-900 flex-shrink-0`}>
        {card.imageUrl ? (
            <img src={card.imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-emerald-900/20 dark:to-teal-900/20">
                <BrainIcon className="w-20 h-20 text-emerald-200 dark:text-emerald-800" />
            </div>
        )}
    </div>
);

const ExerciseLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">{children}</p>
);

/** Text input + "check" / "don't remember" (+ optional voice answer) for production and cloze. */
const AnswerBox: React.FC<{
    expected: string;
    onReveal: (result?: AnswerResult) => void;
    allowVoice?: boolean;
}> = ({ expected, onReveal, allowVoice }) => {
    const [value, setValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const speech = useSpeechRecording();

    useEffect(() => { inputRef.current?.focus({ preventScroll: true }); }, []);

    useEffect(() => {
        if (!speech.result) return;
        const score = speech.result.score;
        const verdict: AnswerVerdict = score >= 85 ? 'correct' : score >= 60 ? 'almost' : 'wrong';
        onReveal({ verdict, given: speech.result.heard, expected, spoken: true });
    }, [speech.result]);

    const submit = () => {
        if (!value.trim()) return;
        onReveal({ verdict: checkAnswer(value, expected), given: value.trim(), expected });
    };

    const toggleVoice = async () => {
        if (speech.isRecording) await speech.stopAndEvaluate(expected);
        else await speech.startRecording();
    };

    return (
        <div className="w-full max-w-sm space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex gap-2">
                <input
                    ref={inputRef}
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') submit(); }}
                    placeholder="Ваш ответ по-португальски"
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    lang="pt-PT"
                    className="min-w-0 flex-1 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-lg text-slate-800 outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
                {allowVoice && (
                    <button
                        onClick={toggleVoice}
                        disabled={speech.isProcessing}
                        title={speech.isRecording ? 'Остановить запись' : 'Ответить голосом'}
                        className={`flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-2xl text-white transition-colors ${speech.isRecording ? 'bg-rose-500 animate-pulse' : speech.isProcessing ? 'bg-slate-300 dark:bg-slate-600' : 'bg-violet-600 hover:bg-violet-700'}`}
                    >
                        {speech.isProcessing ? <LoaderIcon className="h-5 w-5 animate-spin" /> : speech.isRecording ? <span className="h-4 w-4 rounded-sm bg-white" /> : <MicIcon className="h-5 w-5" />}
                    </button>
                )}
            </div>
            {speech.isRecording && <p className="text-center text-sm font-medium text-rose-600 dark:text-rose-400">Говорите… нажмите ещё раз, чтобы закончить</p>}
            {speech.error && <p className="text-center text-sm text-rose-600 dark:text-rose-400">{speech.error}</p>}
            <div className="grid grid-cols-2 gap-2">
                <button onClick={() => onReveal()} className="rounded-2xl bg-slate-100 py-3 font-bold text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600">
                    Не помню
                </button>
                <button onClick={submit} disabled={!value.trim()} className="rounded-2xl bg-emerald-600 py-3 font-bold text-white hover:bg-emerald-700 disabled:opacity-40">
                    Проверить
                </button>
            </div>
        </div>
    );
};

const ReviewFront: React.FC<Props> = ({ card, exercise, onReveal, onPlayWord, isPlaying }) => {
    if (exercise.type === 'production') {
        return (
            <div className="absolute inset-0 flex flex-col bg-white dark:bg-slate-800">
                <CardImage card={card} compact />
                <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto p-6 text-center">
                    <ExerciseLabel>Как это по-португальски?</ExerciseLabel>
                    <h2 className="mb-6 text-3xl font-bold text-slate-800 dark:text-white">{card.translation}</h2>
                    <AnswerBox expected={card.originalTerm} onReveal={onReveal} allowVoice />
                </div>
            </div>
        );
    }

    if (exercise.type === 'cloze') {
        return (
            <div className="absolute inset-0 flex flex-col overflow-y-auto bg-white px-6 pb-6 pt-20 dark:bg-slate-800">
                <div className="flex flex-1 flex-col items-center justify-center text-center">
                    <ExerciseLabel>Вставьте пропущенное слово</ExerciseLabel>
                    <p className="mb-3 font-serif text-2xl leading-relaxed text-slate-800 dark:text-slate-100">
                        {exercise.before}
                        <span className="mx-1 inline-block min-w-[4.5rem] border-b-2 border-emerald-500 align-baseline text-emerald-600">&nbsp;</span>
                        {exercise.after}
                    </p>
                    <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">{exercise.translation}</p>
                    <p className="mb-6 rounded-xl bg-amber-50 px-3 py-1.5 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                        Подсказка: {card.translation}{exercise.lemmaHint ? <> · <span className="font-semibold">{exercise.lemmaHint}</span> (нужна форма)</> : null}
                    </p>
                    <AnswerBox expected={exercise.answer} onReveal={onReveal} />
                </div>
            </div>
        );
    }

    // Recognition: Portuguese word, translation hidden
    return (
        <div className="absolute inset-0 flex cursor-pointer flex-col bg-white dark:bg-slate-800" onClick={() => onReveal()}>
            <CardImage card={card} />
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
                <ExerciseLabel>Вспомните перевод</ExerciseLabel>
                <div className="mb-2 flex items-center gap-3">
                    <h2 className="text-4xl font-bold text-slate-800 dark:text-white">{card.originalTerm}</h2>
                    <button
                        onClick={e => { e.stopPropagation(); onPlayWord(e); }}
                        disabled={isPlaying}
                        className="rounded-full border border-slate-200 p-2 text-slate-500 hover:border-emerald-200 hover:text-emerald-600 dark:border-slate-600 dark:text-slate-300"
                        title="Послушать"
                    >
                        {isPlaying ? <LoaderIcon className="h-5 w-5 animate-spin" /> : <VolumeIcon className="h-5 w-5" />}
                    </button>
                </div>
                <p className="mt-6 text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">Нажмите, чтобы проверить</p>
            </div>
        </div>
    );
};

export default ReviewFront;
