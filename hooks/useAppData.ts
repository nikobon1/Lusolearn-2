import { useState, useEffect, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase, uploadBase64File } from '../services/supabase';
import { UserProfile, Flashcard, Folder, SavedStory, QuestType, Quest, Difficulty } from '../types';
import { notifySuccess } from '../lib/notifications';

const INITIAL_USER: UserProfile = {
    xp: 0, level: 1, streak: 0, lastStudyDate: '', cardsLearned: 0, learningHistory: {}, quests: []
};

const generateDailyQuests = (): Quest[] => {
    return [
        { id: 'q1', type: 'review_cards', description: 'Повторить 10 слов', target: 10, progress: 0, completed: false, xpReward: 50 },
        { id: 'q2', type: 'add_cards', description: 'Добавить 5 новых слов', target: 5, progress: 0, completed: false, xpReward: 50 },
        { id: 'q3', type: 'create_story', description: 'Создать одну историю', target: 1, progress: 0, completed: false, xpReward: 100 },
    ];
};

export const useAppData = (session: Session | null, offlineMode: boolean) => {
    const [user, setUser] = useState<UserProfile>(INITIAL_USER);
    const [cards, setCards] = useState<Flashcard[]>([]);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [savedStories, setSavedStories] = useState<SavedStory[]>([]);
    const [loading, setLoading] = useState(true);

    // --- Helpers ---
    const updateQuestProgress = async (type: QuestType, amount: number = 1) => {
        if (!user.quests) return;
        let xpGained = 0;
        let hasUpdates = false;
        const newQuests = user.quests.map(q => {
            if (q.type === type && !q.completed) {
                const newProgress = q.progress + amount;
                if (newProgress >= q.target) {
                    xpGained += q.xpReward;
                    hasUpdates = true;
                    return { ...q, progress: newProgress, completed: true };
                }
                hasUpdates = true;
                return { ...q, progress: newProgress };
            }
            return q;
        });

        if (hasUpdates) {
            const newUser = { ...user, quests: newQuests, xp: user.xp + xpGained };
            const calculatedLevel = Math.floor(newUser.xp / 500) + 1;
            if (calculatedLevel > newUser.level) {
                newUser.level = calculatedLevel;
                notifySuccess(`Уровень повышен! Теперь ваш уровень: ${newUser.level}`);
            }
            setUser(newUser);
            if (session && session.user.email !== 'offline@demo.com') {
                await supabase.from('profiles').update({ quests: newQuests, xp: newUser.xp, level: newUser.level }).eq('id', session.user.id);
            }
        }
    };

    // --- Actions ---
    const addCards = async (newCards: Flashcard[]) => {
        setCards(prev => [...newCards, ...prev]);
        updateQuestProgress('add_cards', newCards.length);

        if (session && session.user.email !== 'offline@demo.com') {
            try {
                const rows = await Promise.all(newCards.map(async (c) => {
                    let audioUrl = c.audioBase64;
                    // If audio is big base64 (not URL), upload it
                    if (c.audioBase64 && c.audioBase64.length > 500 && !c.audioBase64.startsWith('http')) {
                        const fileName = `${session.user.id}/${c.id}.mp3`;
                        const publicUrl = await uploadBase64File('media', `audio/${fileName}`, c.audioBase64, 'audio/mp3');
                        if (publicUrl) audioUrl = publicUrl;
                    }

                    let imageUrl = c.imageUrl;
                    // If image is big base64, upload it
                    if (c.imageUrl && c.imageUrl.length > 500 && !c.imageUrl.startsWith('http')) {
                        const fileName = `${session.user.id}/${c.id}.png`;
                        const publicUrl = await uploadBase64File('media', `images/${fileName}`, c.imageUrl, 'image/png');
                        if (publicUrl) imageUrl = publicUrl;
                    }

                    return {
                        id: c.id, user_id: session.user.id, original_term: c.originalTerm, translation: c.translation, folder_ids: c.folderIds, tags: c.tags, frequency: c.frequency, interval: c.interval, ease_factor: c.easeFactor, next_review_date: c.nextReviewDate, definition: c.definition, examples: c.examples, grammar_notes: c.grammarNotes, conjugation: c.conjugation, image_url: imageUrl, audio_url: audioUrl,
                    };
                }));

                const { error } = await supabase.from('flashcards').insert(rows);
                if (error) console.error("Error saving cards:", error);
            } catch (e) {
                console.error("Failed to save cards", e);
            }
        }
    };

    const saveStoryToDb = async (story: { pt: string, ru: string }, audioBase64: string, wordsUsed: string[]) => {
        if (!session) return;

        const storyId = self.crypto.randomUUID();
        let audioUrl = null;

        // Save audio to user storage
        if (audioBase64 && !audioBase64.startsWith('http') && session.user.email !== 'offline@demo.com') {
            const publicUrl = await uploadBase64File('media', `audio/${session.user.id}/stories/${storyId}.mp3`, audioBase64, 'audio/mp3');
            if (publicUrl) audioUrl = publicUrl;
        } else if (audioBase64) {
            audioUrl = audioBase64;
        }

        const newStory: SavedStory = {
            id: storyId, contentPt: story.pt, contentRu: story.ru, audioUrl: audioUrl || undefined, wordsUsed: wordsUsed, createdAt: Date.now()
        };

        setSavedStories(prev => [newStory, ...prev]);
        updateQuestProgress('create_story');

        if (session.user.email !== 'offline@demo.com') {
            await supabase.from('stories').insert({
                id: storyId, user_id: session.user.id, content_pt: story.pt, content_ru: story.ru, audio_url: audioUrl, words_used: wordsUsed
            });
        }
    };

    // --- Data Fetching ---
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            if (session && session.user.email !== 'offline@demo.com') {
                // Profile
                const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
                if (profile) {
                    const today = new Date().toISOString().split('T')[0];
                    let currentQuests = profile.quests || [];
                    if (profile.last_quest_date !== today) {
                        currentQuests = generateDailyQuests();
                        await supabase.from('profiles').update({ quests: currentQuests, last_quest_date: today }).eq('id', session.user.id);
                    }
                    setUser({ xp: profile.xp, level: profile.level, streak: profile.streak, lastStudyDate: new Date().toISOString(), cardsLearned: 0, learningHistory: profile.learning_history || {}, quests: currentQuests, lastQuestDate: profile.last_quest_date || today });
                } else {
                    const today = new Date().toISOString().split('T')[0];
                    const defaultUser = { ...INITIAL_USER, quests: generateDailyQuests(), lastQuestDate: today };
                    await supabase.from('profiles').upsert({ id: session.user.id, ...defaultUser, last_quest_date: today, learning_history: {} });
                    setUser(defaultUser);
                }
                // Folders
                const { data: dbFolders, error: foldersError } = await supabase.from('folders').select('*').eq('user_id', session.user.id);
                if (foldersError) console.error('[Data] Folders fetch error:', foldersError);
                if (dbFolders) setFolders(dbFolders.map(f => ({ id: f.id, name: f.name, createdAt: new Date(f.created_at).getTime() })));
                console.log('[Data] Loaded folders:', dbFolders?.length || 0);

                // Cards
                const { data: dbCards, error: cardsError } = await supabase.from('flashcards').select('*').eq('user_id', session.user.id);
                if (cardsError) console.error('[Data] Cards fetch error:', cardsError);
                if (dbCards) setCards(dbCards.map(row => ({ id: row.id, folderIds: row.folder_ids || [], tags: row.tags || [], originalTerm: row.original_term, translation: row.translation, frequency: row.frequency, imageUrl: row.image_url, audioBase64: row.audio_url, interval: row.interval, easeFactor: row.ease_factor, nextReviewDate: row.next_review_date, createdAt: new Date(row.created_at).getTime(), difficulty: row.difficulty || Difficulty.New, definition: row.definition, examples: row.examples, grammarNotes: row.grammar_notes, conjugation: row.conjugation, imagePrompt: row.image_prompt })));
                console.log('[Data] Loaded cards:', dbCards?.length || 0);

                // Stories
                const { data: dbStories } = await supabase.from('stories').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
                if (dbStories) setSavedStories(dbStories.map(s => ({ id: s.id, contentPt: s.content_pt, contentRu: s.content_ru, audioUrl: s.audio_url, wordsUsed: s.words_used, createdAt: new Date(s.created_at).getTime() })));

            } else if (offlineMode || session?.user.email === 'offline@demo.com') {
                const savedCards = JSON.parse(localStorage.getItem('luso_cards') || '[]');
                const savedFolders = JSON.parse(localStorage.getItem('luso_folders') || '[]');
                const savedUser = JSON.parse(localStorage.getItem('luso_user') || JSON.stringify(INITIAL_USER));
                const today = new Date().toISOString().split('T')[0];
                if (savedUser.lastQuestDate !== today) {
                    savedUser.quests = generateDailyQuests();
                    savedUser.lastQuestDate = today;
                    localStorage.setItem('luso_user', JSON.stringify(savedUser));
                }
                setCards(savedCards);
                const customFolders = savedFolders.filter((f: any) => f.id !== 'default');
                setFolders(customFolders);
                setUser(savedUser);
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    }, [session, offlineMode]);

    useEffect(() => {
        if ((offlineMode || session?.user.email === 'offline@demo.com')) {
            localStorage.setItem('luso_cards', JSON.stringify(cards));
            localStorage.setItem('luso_folders', JSON.stringify(folders));
            localStorage.setItem('luso_user', JSON.stringify(user));
        }
    }, [cards, folders, user, offlineMode, session]);

    useEffect(() => { fetchData(); }, [fetchData]);

    return {
        user, setUser, cards, setCards, folders, setFolders, savedStories, setSavedStories,
        loading, fetchData, updateQuestProgress, addCards, saveStoryToDb
    };
};

