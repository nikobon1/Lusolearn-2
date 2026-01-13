import React, { useEffect, useState } from 'react';
import { Flashcard, SavedStory } from '../types';
import { VolumeIcon, LoaderIcon, BookIcon, PlusIcon, HomeIcon, BookmarkIcon } from './Icons';
import { generateStoryFromWords, generateAudio, playAudio } from '../services/geminiService';

interface Props {
    cards?: Flashcard[]; // For generating new
    initialStory?: SavedStory; // For viewing saved
    onBack: () => void;
    onNext?: () => void; // Only for generator mode
    onSave?: (story: { pt: string, ru: string }, audioBase64: string) => Promise<void>;
}

const StoryView: React.FC<Props> = ({ cards, initialStory, onBack, onNext, onSave }) => {
    const [story, setStory] = useState<{ pt: string, ru: string } | null>(initialStory ? { pt: initialStory.contentPt, ru: initialStory.contentRu } : null);
    const [loading, setLoading] = useState(!!cards); 
    const [audioLoading, setAudioLoading] = useState(false);
    const [audioBase64, setAudioBase64] = useState<string | null>(null);
    const [isSaved, setIsSaved] = useState(!!initialStory);
    const [isSaving, setIsSaving] = useState(false);

    // Fixed playback speed for stories: 1.0 (Natural generation speed without pitch distortion)
    const PLAYBACK_RATE = 1.0;

    useEffect(() => {
        if (initialStory?.audioUrl) {
            setAudioBase64(initialStory.audioUrl);
        }
    }, [initialStory]);

    useEffect(() => {
        if (initialStory || !cards) return;

        const fetchStory = async () => {
            setLoading(true);
            setStory(null);
            setAudioBase64(null);
            setIsSaved(false);
            try {
                const words = cards.map(c => c.originalTerm);
                const result = await generateStoryFromWords(words);
                setStory(result);
            } catch (e) {
                console.error(e);
                alert("Не удалось создать историю. Попробуйте еще раз.");
            } finally {
                setLoading(false);
            }
        };
        fetchStory();
    }, [cards, initialStory]);

    const handlePlay = async () => {
        if (!story) return;
        
        if (audioBase64) {
            playAudio(audioBase64, PLAYBACK_RATE);
            return;
        }

        setAudioLoading(true);
        try {
            // Use 'story' mode for generation (Better prosody, natural speed)
            const audio = await generateAudio(story.pt, 'story');
            setAudioBase64(audio);
            playAudio(audio, PLAYBACK_RATE);
        } catch (e) {
            console.error(e);
        } finally {
            setAudioLoading(false);
        }
    };

    const handleSave = async () => {
        if (!story || !onSave || isSaved) return;
        setIsSaving(true);
        try {
            let audioToSave = audioBase64;
            if (!audioToSave) {
                audioToSave = await generateAudio(story.pt, 'story');
                setAudioBase64(audioToSave);
            }
            await onSave(story, audioToSave!);
            setIsSaved(true);
        } catch (e) {
            console.error(e);
            alert("Ошибка при сохранении");
        } finally {
            setIsSaving(false);
        }
    };

    const renderHighlightedStory = (text: string) => {
        const parts = text.split(/(\s+)/);
        const targetWords = initialStory ? initialStory.wordsUsed : (cards ? cards.map(c => c.originalTerm) : []);

        return parts.map((part, i) => {
            const cleanPart = part.toLowerCase().replace(/[.,!?]/g, '');
            const isMatch = targetWords.some(term => {
                const cleanTerm = term.toLowerCase().replace(/^(o|a|os|as)\s+/, '');
                return cleanPart.includes(cleanTerm) && cleanTerm.length > 2;
            });

            if (isMatch) {
                return <span key={i} className="font-bold text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-200 dark:border-emerald-800">{part}</span>;
            }
            return <span key={i}>{part}</span>;
        });
    };

    return (
        <div className="h-full flex items-center justify-center p-4 bg-amber-50/50 dark:bg-slate-900">
            <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-amber-100 dark:border-slate-700 overflow-hidden flex flex-col md:aspect-[3/4] md:h-auto h-full max-h-[85vh]">
                <div className="p-6 bg-amber-50 dark:bg-slate-800 border-b border-amber-100 dark:border-slate-700 flex justify-between items-center">
                    <button onClick={onBack} className="p-2 hover:bg-amber-100 dark:hover:bg-slate-700 rounded-full text-amber-800 dark:text-amber-500 transition-colors">
                        <HomeIcon className="w-5 h-5" />
                    </button>
                    <h2 className="font-serif font-bold text-amber-900 dark:text-amber-400 flex items-center gap-2">
                        <BookIcon className="w-5 h-5" />
                        История
                    </h2>
                    {!initialStory && onSave && (
                        <button 
                            onClick={handleSave} 
                            disabled={isSaved || isSaving || loading}
                            className={`p-2 rounded-full transition-all ${isSaved ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30' : 'text-amber-800 dark:text-amber-500 hover:bg-amber-100 dark:hover:bg-slate-700'}`}
                        >
                            {isSaving ? <LoaderIcon className="w-5 h-5 animate-spin" /> : <BookmarkIcon className="w-5 h-5" filled={isSaved} />}
                        </button>
                    )}
                    {initialStory && <div className="w-9" />} 
                </div>

                <div className="flex-1 p-8 overflow-y-auto flex flex-col">
                    <div className="mb-8">
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-3 tracking-wider text-center">Слова в истории</p>
                        <div className="flex flex-wrap justify-center gap-2">
                            {(initialStory ? initialStory.wordsUsed : (cards || []).map(c => c.originalTerm)).map((word, i) => (
                                <span key={i} className="px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 shadow-sm">
                                    {word}
                                </span>
                            ))}
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-amber-600/50 dark:text-amber-400/50 gap-3">
                            <LoaderIcon className="w-10 h-10 animate-spin" />
                            <p className="text-sm font-medium animate-pulse">Сочиняем историю...</p>
                        </div>
                    ) : story ? (
                        <div className="flex-1 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="bg-white dark:bg-slate-700/30 p-6 rounded-2xl border-2 border-amber-100 dark:border-slate-600 shadow-sm relative">
                                <button 
                                    onClick={handlePlay}
                                    className="absolute -top-4 -right-4 w-12 h-12 bg-emerald-500 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-emerald-600 hover:scale-105 transition-all"
                                >
                                    {audioLoading ? <LoaderIcon className="w-5 h-5 animate-spin" /> : <VolumeIcon className="w-6 h-6" />}
                                </button>
                                <p className="text-2xl text-slate-800 dark:text-slate-200 font-serif leading-relaxed">
                                    {renderHighlightedStory(story.pt)}
                                </p>
                            </div>
                            <div className="px-4 text-center">
                                <p className="text-slate-500 dark:text-slate-400 italic text-lg leading-relaxed">
                                    "{story.ru}"
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-slate-400">Ошибка загрузки</div>
                    )}
                </div>

                <div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
                    {initialStory ? (
                         <button 
                            onClick={onBack}
                            className="w-full py-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
                        >
                            Назад к списку
                        </button>
                    ) : (
                        <button 
                            onClick={onNext}
                            disabled={loading}
                            className="w-full py-4 bg-slate-900 dark:bg-emerald-600 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 dark:hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                        >
                            <PlusIcon className="w-5 h-5" />
                            Следующая история
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StoryView;