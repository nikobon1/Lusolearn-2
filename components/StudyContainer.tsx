import React, { useState } from 'react';
import { Flashcard, Difficulty } from '../types';
import { TrophyIcon, HomeIcon } from './Icons';
import FlashcardView from './FlashcardView';
import { updateFlashcardSrs } from '../services/repositories/flashcardsRepository';

interface StudyContainerProps {
    cards: Flashcard[];
    onComplete: () => void;
    onUpdateCard: (card: Flashcard) => void;
    onProgress: (amount: number) => void;
    userId?: string;
}

const StudyContainer: React.FC<StudyContainerProps> = ({ 
    cards, onComplete, onUpdateCard, onProgress, userId 
}) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFinished, setIsFinished] = useState(false);

    const handleResult = async (success: boolean) => {
        const currentCard = cards[currentIndex];
        
        // SM-2 Algorithm Logic
        const newInterval = success 
            ? (currentCard.interval === 0 ? 1 : Math.round(currentCard.interval * currentCard.easeFactor)) 
            : 1;
        
        const nextReview = Date.now() + (newInterval * 24 * 60 * 60 * 1000);
        
        const updatedCard = { 
            ...currentCard, 
            interval: newInterval, 
            nextReviewDate: nextReview, 
            difficulty: success ? Difficulty.Easy : Difficulty.Hard 
        };

        // Update local state
        onUpdateCard(updatedCard);
        
        // Update User Progress (XP)
        if (success) onProgress(1);

        // Update Database
        if (userId && userId !== 'offline') {
            updateFlashcardSrs(currentCard.id, newInterval, nextReview)
                .then(({ error }) => {
                    if (error) console.error("Failed to update card SRS:", error);
                });
        }

        // Navigate
        if (currentIndex < cards.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            setIsFinished(true);
        }
    };

    if (isFinished) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center relative bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 md:h-96 md:w-96 md:mx-auto">
                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-6 animate-bounce">
                    <TrophyIcon className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Сессия завершена!</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-xs">
                    Вы повторили {cards.length} слов(а). Отличная работа!
                </p>
                <button 
                    onClick={onComplete} 
                    className="px-6 py-3 bg-slate-900 dark:bg-emerald-600 text-white rounded-xl font-semibold hover:bg-slate-800 dark:hover:bg-emerald-700 transition-colors flex items-center gap-2"
                >
                    <HomeIcon className="w-5 h-5" /> На главную
                </button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md md:max-w-lg lg:max-w-xl h-full md:h-auto md:aspect-[3/4] md:max-h-[85vh]">
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
