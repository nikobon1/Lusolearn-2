import React, { useMemo, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { Flashcard } from '../types';
import { findDuplicateGroups, mergeGroup } from '../domain/duplicates';
import { deleteFlashcardsByIds, updateFlashcardMerged } from '../services/repositories/flashcardsRepository';
import { notifyError, notifySuccess } from '../lib/notifications';
import { LoaderIcon } from './Icons';

interface Props {
    cards: Flashcard[];
    setCards: React.Dispatch<React.SetStateAction<Flashcard[]>>;
    session: Session | null;
}

/**
 * Same word added more than once (e.g. from "С нуля" and from a video lesson).
 * Offers to merge each group into one card: best progress kept, folders/tags/examples combined.
 */
const DuplicatesBanner: React.FC<Props> = ({ cards, setCards, session }) => {
    const groups = useMemo(() => findDuplicateGroups(cards), [cards]);
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);

    if (groups.length === 0) return null;
    const extra = groups.reduce((n, g) => n + g.remove.length, 0);

    const merge = async () => {
        if (busy) return;
        const words = groups.map(g => g.keep.originalTerm).join(', ');
        if (!window.confirm(`Объединить повторяющиеся карточки?\n\n${words}\n\nОстанется по одной карточке на слово: с лучшим прогрессом повторений, а папки, теги и примеры (в том числе из видео) перенесутся в неё. Лишние копии (${extra}) будут удалены.`)) return;
        setBusy(true);
        const merged = groups.map(mergeGroup);
        const removeIds = new Set<string>(groups.flatMap(g => g.remove.map(c => c.id)));
        const mergedById = new Map(merged.map(c => [c.id, c]));
        try {
            if (session && session.user.email !== 'offline@demo.com') {
                for (const card of merged) {
                    const { error } = await updateFlashcardMerged(card);
                    if (error) throw error;
                }
                const { error } = await deleteFlashcardsByIds([...removeIds]);
                if (error) throw error;
            }
            setCards(prev => prev.filter(c => !removeIds.has(c.id)).map(c => mergedById.get(c.id) || c));
            notifySuccess(`Объединено: ${groups.length} ${groups.length === 1 ? 'слово' : 'слов'}, удалено копий: ${extra}`);
        } catch (error) {
            console.error('Merging duplicates failed', error);
            notifyError('Не удалось объединить карточки. Попробуйте ещё раз.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
            <p className="font-bold text-amber-900 dark:text-amber-200">Повторяющиеся карточки: {groups.length} {groups.length === 1 ? 'слово' : 'слов'}</p>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
                Одно и то же слово добавлено несколько раз — из-за этого в повторении карточка может «вернуться» сразу после ответа.
            </p>
            {open && (
                <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto text-sm text-amber-900 dark:text-amber-200">
                    {groups.map(g => <li key={g.key}><b>{g.keep.originalTerm}</b> × {g.remove.length + 1}</li>)}
                </ul>
            )}
            <div className="mt-3 flex gap-2">
                <button onClick={() => setOpen(v => !v)} className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-amber-800 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-200">
                    {open ? 'Скрыть' : 'Показать'}
                </button>
                <button onClick={merge} disabled={busy} className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50">
                    {busy && <LoaderIcon className="h-4 w-4 animate-spin" />} Объединить
                </button>
            </div>
        </div>
    );
};

export default DuplicatesBanner;
