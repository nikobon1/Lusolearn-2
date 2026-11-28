import React, { useMemo, useState } from 'react';
import { Flashcard } from '../types';
import { TrophyIcon, HomeIcon, CheckCircleIcon } from './Icons';
import FlashcardView from './FlashcardView';
import { updateFlashcardSrs } from '../services/repositories/flashcardsRepository';
import { CefrLevel, chooseExercise } from '../domain/reviewExercise';
import { ReviewOutcome, ReviewRating, getReviewOutcome } from '../domain/srs';
import { PORTION_SIZE, isNewCard, uniqueByTerm } from '../domain/dailyPlan';
import { normalizeTerm } from '../shared/wordKeys';

interface StudyContainerProps {
    cards: Flashcard[];
    onComplete: () => void;
    onUpdateCard: (card: Flashcard) => void;
    onProgress: (amount: number) => void;
    /** Called for every rating (daily progress + review log). */
    onReviewed?: (event: { card: Flashcard; rating: ReviewRating; wasNew: boolean; attempt: number; exercise?: string; outcome: ReviewOutcome }) => void;
    /** Rest of today's plan not yet in this session; used to keep the session going. */
    getMoreCards?: (excludeIds: Set<string>) => Flashcard[];
    /** Extra due cards beyond today's plan (offered when the plan is done). */
    getExtraCards?: (excludeIds: Set<string>) => Flashcard[];
    /** Learner's level for gap-fill sentences */
    level?: CefrLevel;
    /** Free practice: nothing is saved (schedule, plan, log, XP stay untouched) */
    practice?: boolean;
    userId?: string;
}

/** A card answered "again" comes back after this many other cards in the same session. */
const RELEARN_GAP = 4;
const MAX_RELEARN_ATTEMPTS = 2;

interface QueueItem {
    card: Flashcard;
    attempt: number;
}

const pluralCards = (n: number) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'карточка';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'карточки';
    return 'карточек';
};

const StudyContainer: React.FC<StudyContainerProps> = ({
    cards, onComplete, onUpdateCard, onProgress, onReviewed, getMoreCards, getExtraCards, level = 'A1' as CefrLevel, practice = false, userId
}) => {
    const [queue, setQueue] = useState<QueueItem[]>(() => cards.map(card => ({ card, attempt: 0 })));
    const [currentIndex, setCurrentIndex] = useState(0);
    const [phase, setPhase] = useState<'card' | 'checkpoint' | 'finished'>('card');
    const [rated, setRated] = useState(0);
    const [stats, setStats] = useState({ reviews: 0, fresh: 0, relearned: 0 });
    const [extraAvailable, setExtraAvailable] = useState(0);
    // Free practice: first-attempt results per card (true = remembered)
    const [practiceResults, setPracticeResults] = useState<Map<string, boolean>>(new Map());

    const current = queue[currentIndex];
    const exercise = useMemo(
        () => current ? chooseExercise(current.card, current.attempt, Date.now(), level) : { type: 'recognition' as const },
        [current, level]
    );

    const seenIds = (q: QueueItem[]) => new Set(q.map(item => item.card.id));

    const finish = (q: QueueItem[]) => {
        setExtraAvailable(practice ? 0 : getExtraCards?.(seenIds(q)).length ?? 0);
        setPhase('finished');
    };

    const handleResult = async (rating: ReviewRating) => {
        const currentCard = current.card;
        const wasNew = current.attempt === 0 && isNewCard(currentCard);
        const outcome = getReviewOutcome(currentCard, rating);

        const updatedCard = {
            ...currentCard,
            interval: outcome.interval,
            nextReviewDate: outcome.nextReviewDate,
            easeFactor: outcome.easeFactor,
            difficulty: outcome.difficulty,
            fsrs: outcome.fsrs ?? currentCard.fsrs,
        };

        if (practice) {
            // Free practice: remember the first answer per card for the summary, save nothing
            if (current.attempt === 0) {
                setPracticeResults(prev => new Map(prev).set(currentCard.id, rating === 'good' || rating === 'easy'));
            }
        } else {
            onUpdateCard(updatedCard);
            if (outcome.countsAsSuccess) onProgress(1);
            onReviewed?.({ card: currentCard, rating, wasNew, attempt: current.attempt, exercise: exercise.type, outcome });
            if (current.attempt === 0) {
                setStats(s => wasNew ? { ...s, fresh: s.fresh + 1 } : { ...s, reviews: s.reviews + 1 });
            }
        }

        if (!practice && userId && userId !== 'offline') {
            updateFlashcardSrs(
                currentCard.id,
                outcome.interval,
                outcome.nextReviewDate,
                outcome.easeFactor,
                outcome.difficulty,
                outcome.fsrs
            ).then(({ error }) => {
                if (error) console.error('Failed to update card SRS:', error);
            });
        }

        // Forgotten card: show it again a few cards later in this session
        let nextQueue = queue;
        // Never right after itself: at least one other card in between. If nothing else is left,
        // it isn't repeated now — it comes back in ~10 minutes through today's plan.
        const othersLeft = queue.slice(currentIndex + 1).filter(item => item.card.id !== currentCard.id).length;
        if (rating === 'again' && current.attempt < MAX_RELEARN_ATTEMPTS && othersLeft > 0) {
            const insertAt = currentIndex + 1 + Math.min(RELEARN_GAP, queue.length - currentIndex - 1);
            // In practice the card keeps its real state; in a real session it carries the new schedule
            const again = practice ? currentCard : updatedCard;
            nextQueue = [...queue.slice(0, insertAt), { card: again, attempt: current.attempt + 1 }, ...queue.slice(insertAt)];
            setStats(s => ({ ...s, relearned: s.relearned + 1 }));
        }

        // Queue ran out: continue with the rest of today's plan
        if (!practice && currentIndex >= nextQueue.length - 1) {
            // skip duplicates of words already in this session (same word added twice to the deck)
            const sessionTerms = new Set<string>(nextQueue.map(item => normalizeTerm(item.card.originalTerm)));
            const more = uniqueByTerm(getMoreCards?.(seenIds(nextQueue)) ?? [], sessionTerms);
            nextQueue = [...nextQueue, ...more.map(card => ({ card, attempt: 0 }))];
        }
        setQueue(nextQueue);

        const nextRated = rated + 1;
        setRated(nextRated);

        if (currentIndex >= nextQueue.length - 1) {
            finish(nextQueue);
            return;
        }
        setCurrentIndex(i => i + 1);
        if (!practice && nextRated % PORTION_SIZE === 0) setPhase('checkpoint');
    };

    const startExtra = () => {
        const extra = getExtraCards?.(seenIds(queue)) ?? [];
        if (extra.length === 0) return;
        setQueue(q => [...q, ...extra.map(card => ({ card, attempt: 0 }))]);
        setCurrentIndex(queue.length);
        setPhase('card');
    };

    const retryHard = () => {
        const hardIds = new Set([...practiceResults.entries()].filter(([, ok]) => !ok).map(([id]) => id));
        const hard = queue.filter((item, i, arr) => item.attempt === 0 && hardIds.has(item.card.id) && arr.findIndex(x => x.card.id === item.card.id) === i);
        if (hard.length === 0) return;
        setQueue(hard.map(item => ({ card: item.card, attempt: 0 })));
        setPracticeResults(new Map());
        setCurrentIndex(0);
        setRated(0);
        setPhase('card');
    };

    const remainingInQueue = queue.length - currentIndex;
    const studiedTotal = stats.reviews + stats.fresh;

    const StatLine = () => (
        <p className="mb-8 max-w-xs text-slate-500 dark:text-slate-400">
            Повторено: <b className="text-slate-700 dark:text-slate-200">{stats.reviews}</b> · новых: <b className="text-slate-700 dark:text-slate-200">{stats.fresh}</b>
            {stats.relearned > 0 && <> · вернулись к трудным: {stats.relearned}</>}
        </p>
    );

    if (phase === 'checkpoint') {
        return (
            <div className="relative flex h-full flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-700 dark:bg-slate-800 md:mx-auto md:h-[28rem] md:w-96">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                    <CheckCircleIcon className="h-8 w-8" />
                </div>
                <h2 className="mb-2 text-2xl font-bold text-slate-800 dark:text-white">Порция готова!</h2>
                <StatLine />
                <p className="-mt-6 mb-8 text-sm text-slate-400">
                    Осталось в плане на сегодня: {remainingInQueue} {pluralCards(remainingInQueue)}
                </p>
                <div className="flex w-full max-w-xs flex-col gap-2">
                    <button onClick={() => setPhase('card')} className="rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white hover:bg-emerald-700">
                        Продолжить
                    </button>
                    <button onClick={onComplete} className="rounded-xl bg-slate-100 px-6 py-3 font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300">
                        Закончить пока
                    </button>
                </div>
            </div>
        );
    }

    if (phase === 'finished' && practice) {
        const total = practiceResults.size;
        const remembered = [...practiceResults.values()].filter(Boolean).length;
        const hardCount = total - remembered;
        return (
            <div className="relative flex h-full flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-700 dark:bg-slate-800 md:mx-auto md:h-[28rem] md:w-96">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300">
                    <TrophyIcon className="h-10 w-10" />
                </div>
                <h2 className="mb-2 text-2xl font-bold text-slate-800 dark:text-white">Тренировка завершена</h2>
                <p className="mb-1 text-slate-600 dark:text-slate-300">Вспомнили сразу: <b>{remembered}</b> из <b>{total}</b></p>
                <p className="mb-8 text-xs text-slate-400">Расписание повторений не изменилось</p>
                <div className="flex w-full max-w-xs flex-col gap-2">
                    {hardCount > 0 && (
                        <button onClick={retryHard} className="rounded-xl bg-sky-600 px-6 py-3 font-bold text-white hover:bg-sky-700">
                            Повторить трудные · {hardCount}
                        </button>
                    )}
                    <button onClick={onComplete} className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600">
                        <HomeIcon className="h-5 w-5" /> На главную
                    </button>
                </div>
            </div>
        );
    }

    if (phase === 'finished') {
        return (
            <div className="relative flex h-full flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-700 dark:bg-slate-800 md:mx-auto md:h-[28rem] md:w-96">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 animate-bounce dark:bg-emerald-900/30 dark:text-emerald-400">
                    <TrophyIcon className="h-10 w-10" />
                </div>
                <h2 className="mb-2 text-2xl font-bold text-slate-800 dark:text-white">
                    {getMoreCards ? 'План на сегодня выполнен!' : 'Сессия завершена!'}
                </h2>
                {studiedTotal > 0 ? <StatLine /> : <p className="mb-8 text-slate-500">Отличная работа!</p>}
                <div className="flex w-full max-w-xs flex-col gap-2">
                    {extraAvailable > 0 && (
                        <button onClick={startExtra} className="rounded-xl bg-emerald-50 px-6 py-3 font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300">
                            Ещё {Math.min(extraAvailable, PORTION_SIZE)} сверх плана
                        </button>
                    )}
                    <button
                        onClick={onComplete}
                        className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                    >
                        <HomeIcon className="h-5 w-5" /> На главную
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full w-full max-w-md flex-col md:h-auto md:max-h-[85vh] md:max-w-lg md:aspect-[3/4] lg:max-w-xl">
            {practice && (
                <p className="mb-2 rounded-lg bg-sky-50 px-3 py-1.5 text-center text-xs font-bold text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                    Свободная тренировка · расписание не меняется
                </p>
            )}
            <div className="mb-2 flex items-center gap-3 px-1">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div className={`h-full rounded-full transition-all ${practice ? 'bg-sky-500' : 'bg-emerald-500'}`} style={{ width: `${practice ? (currentIndex / Math.max(queue.length, 1)) * 100 : ((rated % PORTION_SIZE) / PORTION_SIZE) * 100}%` }} />
                </div>
                <span className="text-xs font-bold text-slate-400">{practice ? `${currentIndex}/${queue.length}` : `${rated % PORTION_SIZE}/${PORTION_SIZE}`}</span>
            </div>
            <div className="min-h-0 flex-1">
                <FlashcardView
                    key={`${current.card.id}-${current.attempt}`}
                    card={current.card}
                    exercise={exercise}
                    onResult={handleResult}
                    onBack={onComplete}
                    onUpdate={onUpdateCard}
                />
            </div>
        </div>
    );
};

export default StudyContainer;
