// hooks/useStudyState.ts
import { useState } from 'react';
import { Flashcard, ViewState } from '../types';

// Helper for frequency normalization
const normalizeFrequency = (freq?: string): string => {
    if (!freq) return "10000+";
    if (["Top 500", "Top 1000", "Top 3000", "Top 5000", "10000+"].includes(freq)) return freq;
    if (freq === "High") return "Top 1000"; 
    if (freq === "Medium") return "Top 3000";
    if (freq === "Low") return "10000+";
    return "10000+"; 
};

export const useStudyState = (cards: Flashcard[], setView: (v: ViewState) => void) => {
    const [studyQueue, setStudyQueue] = useState<Flashcard[]>([]);
    const [showStudyConfig, setShowStudyConfig] = useState(false);
    const [listModalConfig, setListModalConfig] = useState<{ title: string; filter: 'learned' | 'learning' } | null>(null);
    const [specificStudyCardId, setSpecificStudyCardId] = useState<string | null>(null);

    const handleStartStudy = (mode: 'srs' | 'frequency', filters: Set<string>) => {
        let queue: Flashcard[] = [];
        
        if (mode === 'srs') {
            // SRS logic: due cards first, then new cards if queue is empty
            queue = cards
                .filter(c => c.nextReviewDate <= Date.now())
                .sort((a, b) => a.nextReviewDate - b.nextReviewDate);
            
            if (queue.length === 0) {
                // Fallback to new cards
                queue = cards.filter(c => c.interval === 0).slice(0, 10);
            }
        } else {
            // Frequency logic
            queue = cards
                .filter(c => filters.has(normalizeFrequency(c.frequency)))
                .sort(() => Math.random() - 0.5);
        }

        if (queue.length === 0) { 
            alert("Нет карточек для изучения."); 
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