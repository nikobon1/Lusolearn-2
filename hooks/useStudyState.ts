import { useState } from 'react';
import { Flashcard, ViewState } from '../types';
import { notifyInfo } from '../lib/notifications';
import { normalizeFrequency } from '../domain/frequency';

export const useStudyState = (cards: Flashcard[], setView: (v: ViewState) => void) => {
    const [studyQueue, setStudyQueue] = useState<Flashcard[]>([]);
    const [showStudyConfig, setShowStudyConfig] = useState(false);
    const [listModalConfig, setListModalConfig] = useState<{ title: string; filter: 'learned' | 'learning' } | null>(null);
    const [specificStudyCardId, setSpecificStudyCardId] = useState<string | null>(null);

    const handleStartStudy = (mode: 'srs' | 'frequency', filters: Set<string>) => {
        let queue: Flashcard[] = [];

        if (mode === 'srs') {
            queue = cards
                .filter(c => c.nextReviewDate <= Date.now())
                .sort((a, b) => a.nextReviewDate - b.nextReviewDate);

            if (queue.length === 0) {
                queue = cards.filter(c => c.interval === 0).slice(0, 10);
            }
        } else {
            queue = cards
                .filter(c => filters.has(normalizeFrequency(c.frequency)))
                .sort(() => Math.random() - 0.5);
        }

        if (queue.length === 0) {
            notifyInfo('Нет карточек для изучения.');
            return;
        }

        setStudyQueue(queue);
        setSpecificStudyCardId(null);
        setView(ViewState.Study);
        setShowStudyConfig(false);
    };

    const handleStudySingleCard = (id: string) => {
        const card = cards.find(c => c.id === id);
        if (card) {
            setStudyQueue([card]);
            setSpecificStudyCardId(id);
            setView(ViewState.Study);
            setListModalConfig(null);
        }
    };

    return {
        studyQueue,
        setStudyQueue,
        showStudyConfig,
        setShowStudyConfig,
        listModalConfig,
        setListModalConfig,
        specificStudyCardId,
        handleStartStudy,
        handleStudySingleCard
    };
};
