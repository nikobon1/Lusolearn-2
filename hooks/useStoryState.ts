// hooks/useStoryState.ts
import { useState } from 'react';
import { Flashcard, SavedStory, ViewState } from '../types';

const normalizeFrequency = (freq?: string): string => {
    if (!freq) return "10000+";
    if (["Top 500", "Top 1000", "Top 3000", "Top 5000", "10000+"].includes(freq)) return freq;
    if (freq === "High") return "Top 1000"; 
    if (freq === "Medium") return "Top 3000";
    if (freq === "Low") return "10000+";
    return "10000+"; 
};

export const useStoryState = (
    cards: Flashcard[], 
    setView: (v: ViewState) => void,
    saveStoryToDb: (story: { pt: string, ru: string }, audioBase64: string, wordsUsed: string[]) => Promise<void>
) => {
    const [storyCards, setStoryCards] = useState<Flashcard[]>([]);
    const [viewingStory, setViewingStory] = useState<SavedStory | null>(null);
    const [showStoryConfig, setShowStoryConfig] = useState(false);
    const [storyGenIndex, setStoryGenIndex] = useState(0);

    const handleStartStory = (config: { count: number; source: 'folder' | 'frequency' | 'recent'; folderId?: string; frequency?: string; recentDays?: number }) => {
        let pool = cards;
        if (config.source === 'folder' && config.folderId !== 'all') {
            pool = pool.filter(c => c.folderIds.includes(config.folderId!));
        } else if (config.source === 'frequency') {
            pool = pool.filter(c => normalizeFrequency(c.frequency) === config.frequency);
        } else if (config.source === 'recent') {
            const cutoff = Date.now() - ((config.recentDays || 7) * 24 * 60 * 60 * 1000);
            pool = pool.filter(c => c.createdAt >= cutoff);
        }

        if (pool.length < config.count) { 
            alert("Недостаточно слов."); 
            return; 
        }

        const selected = pool.sort(() => Math.random() - 0.5).slice(0, config.count);
        setStoryCards(selected);
        setViewingStory(null); 
        setStoryGenIndex(prev => prev + 1); 
        setView(ViewState.Story);
        setShowStoryConfig(false);
    };

    const handleSaveStory = async (story: { pt: string, ru: string }, audioBase64: string) => {
        const wordsUsed = storyCards.map(c => c.originalTerm);
        await saveStoryToDb(story, audioBase64, wordsUsed);
    };

    return {
        storyCards,
        viewingStory,
        setViewingStory,
        showStoryConfig,
        setShowStoryConfig,
        storyGenIndex,
        handleStartStory,
        handleSaveStory
    };
};