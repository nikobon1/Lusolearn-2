import React, { useEffect, useMemo, useState } from 'react';
import { Flashcard } from '../types';
import { isPaused } from '../domain/paused';
import { normalizeTerm } from '../domain/frequencyDictionary';
import { useFrequencyRanks } from '../hooks/useFrequencyRanks';
import { XIcon } from './Icons';

interface WordListModalProps {
    title: string;
    cards: Flashcard[];
    onClose: () => void;
    onCardClick: (id: string) => void;
    onSetPaused?: (ids: string[], paused: boolean) => Promise<void>;
}

type Tab = 'active' | 'paused';

const WordListModal: React.FC<WordListModalProps> = ({ title, cards, onClose, onCardClick, onSetPaused }) => {
    const [tab, setTab] = useState<Tab>('active');
    const [selecting, setSelecting] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [busy, setBusy] = useState(false);
    const ranks = useFrequencyRanks();

    const pausedCount = useMemo(() => cards.filter(isPaused).length, [cards]);
    const shown = useMemo(() => cards.filter(c => (tab === 'paused') === isPaused(c)), [cards, tab]);
    const rankOf = (c: Flashcard) => ranks?.get(normalizeTerm(c.originalTerm)) ?? null;
    /** Not in the top frequency list — the likely candidates for a pause (носорог, хлор…). */
    const rare = useMemo(() => (ranks ? shown.filter(c => rankOf(c) === null) : []), [shown, ranks]);

    useEffect(() => { setSelected(new Set()); setSelecting(false); }, [tab]);
    useEffect(() => { if (tab === 'paused' && pausedCount === 0) setTab('active'); }, [tab, pausedCount]);

    const toggle = (id: string) => setSelected(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const apply = async () => {
        if (!onSetPaused || selected.size === 0 || busy) return;
        setBusy(true);
        try {
            await onSetPaused([...selected], tab === 'active');
            setSelected(new Set());
            setSelecting(false);
        } finally {
            setBusy(false);
        }
    };

    const chip = (active: boolean) =>
        `rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${active ? 'bg-emerald-600 text-white' : 'border border-slate-200 bg-white text-slate-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300'}`;

    return (
        <div className="absolute inset-0 z-[70] bg-white dark:bg-slate-800 flex flex-col animate-in slide-in-from-bottom duration-300 md:animate-in md:fade-in md:zoom-in md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[500px] md:h-[600px] md:rounded-2xl md:shadow-2xl md:border md:border-slate-200 dark:md:border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm z-10 space-y-3">
                <div className="flex justify-between items-center">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">{title} ({cards.length - pausedCount})</h2>
                    <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600">
                        <XIcon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                    </button>
                </div>
                {onSetPaused && (
                    <div className="flex flex-wrap items-center gap-2">
                        <button className={chip(tab === 'active')} onClick={() => setTab('active')}>В повторениях ({cards.length - pausedCount})</button>
                        {pausedCount > 0 && <button className={chip(tab === 'paused')} onClick={() => setTab('paused')}>На паузе ({pausedCount})</button>}
                        <button
                            onClick={() => { setSelecting(v => !v); setSelected(new Set()); }}
                            className="ml-auto rounded-full px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                        >
                            {selecting ? 'Отмена' : 'Выбрать'}
                        </button>
                    </div>
                )}
                {selecting && (
                    <div className="space-y-2">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {tab === 'active'
                                ? 'Слова на паузе сохраняют прогресс, но не попадаются в плане, повторениях и тренировке. Вернуть можно в любой момент.'
                                : 'Выберите слова, которые снова нужно повторять.'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {tab === 'active' && rare.length > 0 && (
                                <button onClick={() => setSelected(new Set(rare.map(c => c.id)))} className={chip(false)}>
                                    Выбрать редкие (не из частотного словаря) · {rare.length}
                                </button>
                            )}
                            <button onClick={() => setSelected(new Set(shown.map(c => c.id)))} className={chip(false)}>Выбрать все · {shown.length}</button>
                            {selected.size > 0 && <button onClick={() => setSelected(new Set())} className={chip(false)}>Снять выбор</button>}
                        </div>
                    </div>
                )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50 dark:bg-slate-900">
                {shown.length === 0 ? (
                    <p className="text-center text-slate-400 mt-10">Список пуст.</p>
                ) : (
                    shown.map(card => {
                        const rank = rankOf(card);
                        const isSelected = selected.has(card.id);
                        return (
                            <div
                                key={card.id}
                                onClick={() => (selecting ? toggle(card.id) : onCardClick(card.id))}
                                className={`bg-white dark:bg-slate-800 p-3 rounded-xl border shadow-sm flex items-center gap-3 cursor-pointer transition-colors ${isSelected ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30' : 'border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'}`}
                            >
                                {selecting && (
                                    <div className={`h-5 w-5 flex-shrink-0 rounded border flex items-center justify-center text-xs ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'}`}>
                                        {isSelected && '✓'}
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className="font-bold text-slate-800 dark:text-slate-200">{card.originalTerm}</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{card.translation}</p>
                                </div>
                                {ranks && (rank !== null
                                    ? <span className="font-mono text-[10px] text-slate-400">#{rank}</span>
                                    : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-300">редкое</span>)}
                                {card.interval > 0 ? (
                                    <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded-full">{card.interval}д</span>
                                ) : (
                                    <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] font-bold rounded-full">New</span>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
            {selecting && selected.size > 0 && (
                <div className="border-t border-slate-100 p-3 dark:border-slate-700">
                    <button onClick={apply} disabled={busy} className="w-full rounded-xl bg-emerald-600 py-3 font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                        {tab === 'active' ? `Поставить на паузу · ${selected.size}` : `Вернуть в повторения · ${selected.size}`}
                    </button>
                </div>
            )}
        </div>
    );
};

export default WordListModal;
