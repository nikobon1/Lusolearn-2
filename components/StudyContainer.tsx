import React, { useState } from 'react';
import { Flashcard, Difficulty } from '../types';
import { TrophyIcon, HomeIcon } from './Icons';
import FlashcardView from './FlashcardView';
import { updateFlashcardSrs } from '../services/repositories/flashcardsRepository';

type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

interface StudyContainerProps {
    cards: Flashcard[];
    onComplete: () => void;
    onUpdateCard: (card: Flashcard) => void;
    onProgress: (amount: number) => void;
    userId?: string;
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const clampEase = (value: number) => Math.min(3, Math.max(1.3, value));

const getReviewOutcome = (card: Flashcard, rating: ReviewRating) => {
    const currentEase = clampEase(card.easeFactor || 2.5);

    if (rating === 'again') {
        return {
            interval: 0,
            nextReviewDate: Date.now() + (10 * MINUTE_MS),
            easeFactor: clampEase(currentEase - 0.2),
            difficulty: Difficulty.Hard,
            countsAsSuccess: false,
        };
    }

    if (card.interval === 0) {
        if (rating === 'hard') {
            return {
                interval: 0,
                nextReviewDate: Date.now() + (8 * HOUR_MS),
                easeFactor: clampEase(currentEase - 0.05),
                difficulty: Difficulty.Hard,
                countsAsSuccess: true,
            };
        }

        if (rating === 'easy') {
            return {
                interval: 3,
                nextReviewDate: Date.now() + (3 * DAY_MS),
                easeFactor: clampEase(currentEase + 0.15),
                difficulty: Difficulty.Easy,
                countsAsSuccess: true,
            };
        }

        return {
            interval: 1,
            nextReviewDate: Date.now() + DAY_MS,
            easeFactor: currentEase,
            difficulty: Difficulty.Medium,
            countsAsSuccess: true,
        };
    }

    if (rating === 'hard') {
        const interval = Math.max(card.interval + 1, Math.round(card.interval * 1.2));
        return {
            interval,
            nextReviewDate: Date.now() + (interval * DAY_MS),
            easeFactor: clampEase(currentEase - 0.15),
            difficulty: Difficulty.Hard,
            countsAsSuccess: true,
        };
    }

    if (rating === 'easy') {
        const interval = Math.max(card.interval + 2, Math.round(card.interval * currentEase * 1.3));
        return {
            interval,
            nextReviewDate: Date.now() + (interval * DAY_MS),
            easeFactor: clampEase(currentEase + 0.15),
            difficulty: Difficulty.Easy,
            countsAsSuccess: true,
        };
    }

    const interval = Math.max(card.interval + 1, Math.round(card.interval * currentEase));
    return {
        interval,
        nextReviewDate: Date.now() + (interval * DAY_MS),
        easeFactor: currentEase,
        difficulty: Difficulty.Medium,
        countsAsSuccess: true,
    };
};

const StudyContainer: React.FC<StudyContainerProps> = ({
    cards, onComplete, onUpdateCard, onProgress, userId
}) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFinished, setIsFinished] = useState(false);

    const handleResult = async (rating: ReviewRating) => {
        const currentCard = cards[currentIndex];
        const outcome = getReviewOutcome(currentCard, rating);

        const updatedCard = {
            ...currentCard,
            interval: outcome.interval,
            nextReviewDate: outcome.nextReviewDate,
            easeFactor: outcome.easeFactor,
            difficulty: outcome.difficulty,
        };

        onUpdateCard(updatedCard);

        if (outcome.countsAsSuccess) onProgress(1);

        if (userId && userId !== 'offline') {
            updateFlashcardSrs(
                currentCard.id,
                outcome.interval,
                outcome.nextReviewDate,
                outcome.easeFactor,
                outcome.difficulty
            ).then(({ error }) => {
                if (error) console.error('Failed to update card SRS:', error);
            });
        }

        if (currentIndex < cards.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            setIsFinished(true);
        }
    };

    if (isFinished) {
        return (
            <div className="relative flex h-full flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-700 dark:bg-slate-800 md:mx-auto md:h-96 md:w-96">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 animate-bounce dark:bg-emerald-900/30 dark:text-emerald-400">
                    <TrophyIcon className="h-10 w-10" />
                </div>
                <h2 className="mb-2 text-2xl font-bold text-slate-800 dark:text-white">Сессия завершена!</h2>
                <p className="mb-8 max-w-xs text-slate-500 dark:text-slate-400">
                    Вы повторили {cards.length} слов(а). Отличная работа!
                </p>
                <button
                    onClick={onComplete}
                    className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                >
                    <HomeIcon className="h-5 w-5" /> На главную
                </button>
            </div>
        );
    }

    return (
        <div className="h-full w-full max-w-md md:h-auto md:max-h-[85vh] md:max-w-lg md:aspect-[3/4] lg:max-w-xl">
            <FlashcardView
                card={cards[currentIndex]}
                onResult={handleResult}
                onBack={onComplete}
                onUpdate={onUpdateCard}
            />
        </div>
    );
};

export default StudyContainer;
