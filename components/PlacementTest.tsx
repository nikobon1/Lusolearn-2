import React, { useEffect, useMemo, useState } from 'react';
import { FrequencyEntry, entryKey, loadFrequencyDictionary } from '../domain/frequencyDictionary';
import { PlacementItem, PlacementResult, buildPlacementSample, evaluatePlacement } from '../domain/placement';
import { useFrequencyProgress } from '../hooks/useFrequencyProgress';
import { LoaderIcon, XIcon } from './Icons';

interface Props {
    userId?: string;
    onClose: () => void;
    /** After the result: continue in «С нуля» */
    onDone: () => void;
}

/**
 * «Я уже знаю основы»: ~30 words from easy to rare. "Знаю" reveals the meaning for a self-check,
 * so a vague feeling of familiarity doesn't count as knowing the word.
 */
const PlacementTest: React.FC<Props> = ({ userId, onClose, onDone }) => {
    const [dictionary, setDictionary] = useState<FrequencyEntry[] | null>(null);
    const [index, setIndex] = useState(0);
    const [revealed, setRevealed] = useState(false);
    const [answers, setAnswers] = useState<{ item: PlacementItem; known: boolean }[]>([]);
    const [result, setResult] = useState<PlacementResult | null>(null);
    const { markManyKnown } = useFrequencyProgress(userId);

    useEffect(() => { loadFrequencyDictionary().then(setDictionary).catch(() => setDictionary([])); }, []);
    const sample = useMemo(() => (dictionary ? buildPlacementSample(dictionary) : []), [dictionary]);
    const current = sample[index];

    const answer = (known: boolean) => {
        if (!current || !dictionary) return;
        const next = [...answers, { item: current, known }];
        setAnswers(next);
        setRevealed(false);
        // Stop early once two bands in a row are mostly unknown — no point showing rarer words
        const bandsDone = new Set(next.map(a => a.item.band));
        const shareOf = (band: number) => {
            const inBand = next.filter(a => a.item.band === band);
            return inBand.length ? inBand.filter(a => a.known).length / inBand.length : 1;
        };
        const lastBand = current.band;
        const bandFinished = index + 1 >= sample.length || sample[index + 1].band !== lastBand;
        const twoWeak = bandFinished && lastBand > 0 && bandsDone.has(lastBand - 1) && shareOf(lastBand) < 0.4 && shareOf(lastBand - 1) < 0.4;
        if (index + 1 >= sample.length || twoWeak) {
            const res = evaluatePlacement(dictionary, next);
            setResult(res);
            markManyKnown(res.knownKeys);
        } else {
            setIndex(i => i + 1);
        }
    };

    const firstGap = useMemo(() => {
        if (!result || !dictionary) return null;
        const known = new Set(result.knownKeys);
        return dictionary.find(e => !known.has(entryKey(e))) || null;
    }, [result, dictionary]);

    return (
        <div className="fixed inset-0 z-[85] flex items-end justify-center bg-slate-950/50 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Проверка словарного запаса">
            <div className="flex max-h-[92vh] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-2xl dark:bg-slate-800 sm:rounded-3xl">
                <div className="flex items-center gap-3 px-6 pt-5">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${result ? 100 : sample.length ? (index / sample.length) * 100 : 0}%` }} />
                    </div>
                    <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:text-slate-600" title="Закрыть"><XIcon className="h-5 w-5" /></button>
                </div>

                {!dictionary ? (
                    <div className="flex h-64 items-center justify-center"><LoaderIcon className="h-8 w-8 animate-spin text-emerald-600" /></div>
                ) : result ? (
                    <div className="space-y-4 px-6 pb-6 pt-4">
                        <h2 className="font-serif text-2xl font-bold text-slate-800 dark:text-white">Ваш словарный запас</h2>
                        <p className="text-slate-600 dark:text-slate-300">
                            Из первых ~1650 самых частых слов вы знаете примерно <b>{result.estimatedKnown}</b>.
                        </p>
                        <ul className="space-y-1 text-sm text-slate-500 dark:text-slate-400">
                            {result.frontierRank > 0
                                ? <li>✓ Слова до <b>#{result.frontierRank}</b> отмечены как известные — карточки для них создаваться не будут.</li>
                                : <li>Самые частые слова пока стоит пройти — начнём с них.</li>}
                            {firstGap && <li>Начнём с <b>#{firstGap.r} {firstGap.w}</b> ({firstGap.ru.split(';')[0]}).</li>}
                            <li>Ошиблись с оценкой — в «С нуля» → «Словарь» у любого слова можно нажать «Знаю ↺».</li>
                        </ul>
                        <button onClick={onDone} className="w-full rounded-2xl bg-emerald-600 py-3 font-bold text-white shadow-lg hover:bg-emerald-700">Открыть «С нуля»</button>
                    </div>
                ) : current ? (
                    <div className="flex flex-col items-center px-6 pb-6 pt-6 text-center">
                        <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">Слово {index + 1} из {sample.length}</p>
                        <p className="mb-2 text-xs text-slate-400">Знаете, что оно значит?</p>
                        <h2 className="mb-6 font-serif text-4xl font-bold text-slate-800 dark:text-white">{current.entry.w}</h2>
                        {!revealed ? (
                            <div className="grid w-full grid-cols-2 gap-2">
                                <button onClick={() => answer(false)} className="rounded-2xl bg-slate-100 py-3 font-bold text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300">Не знаю</button>
                                <button onClick={() => setRevealed(true)} className="rounded-2xl bg-emerald-600 py-3 font-bold text-white hover:bg-emerald-700">Знаю</button>
                            </div>
                        ) : (
                            <div className="w-full space-y-3">
                                <p className="rounded-2xl bg-slate-50 px-4 py-3 text-lg text-slate-700 dark:bg-slate-700/50 dark:text-slate-200">{current.entry.ru}</p>
                                <p className="text-sm text-slate-500">Вы так и думали?</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => answer(false)} className="rounded-2xl bg-slate-100 py-3 font-bold text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300">Нет, не то</button>
                                    <button onClick={() => answer(true)} className="rounded-2xl bg-emerald-600 py-3 font-bold text-white hover:bg-emerald-700">Да, верно</button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="p-6 text-center text-slate-500">Не удалось загрузить словарь. Попробуйте позже.</div>
                )}
            </div>
        </div>
    );
};

export default PlacementTest;
