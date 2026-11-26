import React, { useMemo, useState } from 'react';
import { Flashcard, Folder } from '../types';
import { normalizeFrequency } from '../domain/frequency';
import { XIcon } from './Icons';

interface Props {
    cards: Flashcard[];
    folders: Folder[];
    onClose: () => void;
    onStart: (cards: Flashcard[]) => void;
}

type Source = 'all' | 'folder' | 'tag' | 'frequency';
const BUCKETS = ['Top 500', 'Top 1000', 'Top 3000', 'Top 5000', '10000+'];
const COUNTS: (number | 'all')[] = [10, 20, 50, 'all'];

const shuffle = <T,>(items: T[]): T[] => {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
    <button onClick={onClick} className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${active ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'}`}>
        {children}
    </button>
);

/**
 * "Свободная тренировка": practise any set of cards without touching the schedule or today's plan.
 */
const PracticeConfigModal: React.FC<Props> = ({ cards, folders, onClose, onStart }) => {
    const [source, setSource] = useState<Source>('all');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [count, setCount] = useState<number | 'all'>(20);

    const tags = useMemo(() => {
        const counts = new Map<string, number>();
        cards.forEach(c => (c.tags || []).forEach(t => counts.set(t, (counts.get(t) || 0) + 1)));
        return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
    }, [cards]);

    const usedFolders = useMemo(
        () => folders.filter(f => cards.some(c => c.folderIds?.includes(f.id))),
        [folders, cards]
    );

    const pool = useMemo(() => {
        if (source === 'all') return cards;
        if (selected.size === 0) return [];
        if (source === 'folder') return cards.filter(c => c.folderIds?.some(id => selected.has(id)));
        if (source === 'tag') return cards.filter(c => c.tags?.some(t => selected.has(t)));
        return cards.filter(c => selected.has(normalizeFrequency(c.frequency)));
    }, [cards, source, selected]);

    const pickSource = (s: Source) => { setSource(s); setSelected(new Set()); };
    const toggle = (key: string) => setSelected(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
    });

    const start = () => {
        const shuffled = shuffle(pool);
        onStart(count === 'all' ? shuffled : shuffled.slice(0, count));
    };

    const sources: { id: Source; label: string; disabled?: boolean }[] = [
        { id: 'all', label: 'Все карточки' },
        { id: 'folder', label: 'Папка', disabled: usedFolders.length === 0 },
        { id: 'tag', label: 'Тег', disabled: tags.length === 0 },
        { id: 'frequency', label: 'Частотность' },
    ];
    const total = count === 'all' ? pool.length : Math.min(pool.length, count);

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800" onClick={e => e.stopPropagation()}>
                <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Свободная тренировка</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><XIcon className="h-5 w-5" /></button>
                </div>
                <p className="mb-5 text-xs leading-snug text-slate-500 dark:text-slate-400">
                    Повторите любые карточки — например, слова урока перед походом в банк. Расписание повторений и план на сегодня не меняются.
                </p>

                <p className="mb-2 text-xs font-bold text-slate-500 dark:text-slate-400">Что тренировать</p>
                <div className="mb-3 grid grid-cols-2 gap-2">
                    {sources.map(s => (
                        <button key={s.id} disabled={s.disabled} onClick={() => pickSource(s.id)}
                            className={`rounded-xl border-2 px-3 py-2 text-sm font-bold transition-colors disabled:opacity-40 ${source === s.id ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : 'border-slate-100 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700'}`}>
                            {s.label}
                        </button>
                    ))}
                </div>

                {source !== 'all' && (
                    <div className="mb-4 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                        {source === 'folder' && usedFolders.map(f => <Chip key={f.id} active={selected.has(f.id)} onClick={() => toggle(f.id)}>{f.name}</Chip>)}
                        {source === 'tag' && tags.map(t => <Chip key={t} active={selected.has(t)} onClick={() => toggle(t)}>{t}</Chip>)}
                        {source === 'frequency' && BUCKETS.map(b => <Chip key={b} active={selected.has(b)} onClick={() => toggle(b)}>{b}</Chip>)}
                    </div>
                )}

                <p className="mb-2 text-xs font-bold text-slate-500 dark:text-slate-400">Сколько карточек</p>
                <div className="mb-5 flex gap-1.5">
                    {COUNTS.map(n => <Chip key={String(n)} active={count === n} onClick={() => setCount(n)}>{n === 'all' ? 'Все' : n}</Chip>)}
                </div>

                <button onClick={start} disabled={total === 0}
                    className="w-full rounded-xl bg-emerald-600 py-3.5 font-bold text-white shadow-lg transition-colors hover:bg-emerald-700 disabled:opacity-40">
                    {pool.length === 0 ? (source === 'all' ? 'Нет карточек' : 'Выберите, что тренировать') : `Начать · ${total}`}
                </button>
            </div>
        </div>
    );
};

export default PracticeConfigModal;
