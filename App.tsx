import React, { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { Auth } from './components/Auth';
import Layout from './components/Layout';
import NotificationCenter from './components/NotificationCenter';
import DashboardView from './components/DashboardView';
import StudyContainer from './components/StudyContainer';
import Creator from './components/Creator';
import StoryView from './components/StoryView';
import WordListModal from './components/WordListModal';
import StudyConfigModal from './components/StudyConfigModal';
import StoryConfigModal from './components/StoryConfigModal';
import { useAppData } from './hooks/useAppData';
import { useTheme } from './hooks/useTheme';
import { useStudyState } from './hooks/useStudyState';
import { useStoryState } from './hooks/useStoryState';
import { LoaderIcon } from './components/Icons';
import { Flashcard, ViewState } from './types';
import { getCurrentSession, signOutUser, subscribeAuthState } from './services/repositories/authRepository';

export default function App() {
    const [session, setSession] = useState<Session | null>(null);
    const [offlineMode, setOfflineMode] = useState(false);
    const [view, setView] = useState<ViewState>(ViewState.Dashboard);

    const {
        user, cards, setCards, folders, setFolders, savedStories, setSavedStories,
        loading, fetchData, updateQuestProgress, addCards, saveStoryToDb
    } = useAppData(session, offlineMode);

    const { theme, toggleTheme } = useTheme();

    const {
        studyQueue, showStudyConfig, setShowStudyConfig, listModalConfig, setListModalConfig,
        handleStartStudy, handleStudySingleCard
    } = useStudyState(cards, setView);

    const {
        storyCards, viewingStory, setViewingStory, showStoryConfig, setShowStoryConfig, storyGenIndex,
        handleStartStory, handleSaveStory
    } = useStoryState(cards, setView, saveStoryToDb);

    useEffect(() => {
        getCurrentSession().then(currentSession => setSession(currentSession));
        const subscription = subscribeAuthState(nextSession => setSession(nextSession));
        return () => subscription.unsubscribe();
    }, []);

    const handleOfflineMode = () => {
        setSession({
            access_token: 'mock', refresh_token: 'mock', expires_in: 3600, token_type: 'bearer',
            user: { id: 'offline', aud: 'authenticated', role: 'authenticated', email: 'offline@demo.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }
        });
        setOfflineMode(true);
    };

    const handleLogout = () => {
        if (session) signOutUser();
        else setOfflineMode(false);
    };

    const onCardsCreated = async (newCards: Flashcard[]) => {
        await addCards(newCards);
        setView(ViewState.Dashboard);
    };

    const dueCount = cards.filter(c => c.nextReviewDate <= Date.now()).length;

    if (loading) return (
        <>
            <NotificationCenter />
            <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900"><LoaderIcon className="animate-spin w-8 h-8 text-emerald-600" /></div>
        </>
    );
    if (!session && !offlineMode) return (
        <>
            <NotificationCenter />
            <Auth onLoginSuccess={() => fetchData()} onOfflineMode={handleOfflineMode} />
        </>
    );

    return (
        <>
            <NotificationCenter />
            <Layout view={view} setView={setView} user={user} theme={theme} toggleTheme={toggleTheme} onLogout={handleLogout} dueCount={dueCount}>
                {view === ViewState.Dashboard && (
                <DashboardView
                    session={session} user={user} cards={cards} setCards={setCards} folders={folders} setFolders={setFolders}
                    setView={setView} onStartStudy={handleStartStudy} onShowStudyConfig={() => setShowStudyConfig(true)}
                    onOpenList={setListModalConfig} onStudySingleCard={handleStudySingleCard} theme={theme} toggleTheme={toggleTheme}
                />
            )}

            {view === ViewState.Study && studyQueue.length > 0 && (
                <div className="h-full flex items-center justify-center p-4 bg-slate-100/50 dark:bg-slate-900">
                    <StudyContainer
                        cards={studyQueue}
                        onComplete={() => setView(ViewState.Dashboard)}
                        onUpdateCard={(updated) => setCards(prev => prev.map(c => c.id === updated.id ? updated : c))}
                        onProgress={(amount) => updateQuestProgress('review_cards', amount)}
                        userId={session?.user.id}
                    />
                </div>
            )}

            {view === ViewState.Create && (
                <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-900 p-0 md:p-8 flex items-center justify-center">
                    <div className="w-full h-full md:h-[85vh] md:max-w-4xl bg-white dark:bg-slate-800 md:rounded-2xl md:shadow-2xl md:border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
                        <Creator
                            onCardsCreated={onCardsCreated}
                            onCancel={() => setView(ViewState.Dashboard)}
                            folders={folders}
                            onCreateFolder={(newFolder) => setFolders(prev => [...prev, newFolder])}
                        />
                    </div>
                </div>
            )}

            {view === ViewState.StoryList && (
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-4xl mx-auto">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-3xl font-bold text-slate-800 dark:text-white serif">Истории</h2>
                            <div className="flex gap-2">
                                <button onClick={() => setView(ViewState.Dashboard)} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 font-bold">Назад</button>
                                <button onClick={() => setShowStoryConfig(true)} className="px-6 py-3 bg-amber-600 text-white rounded-xl font-bold shadow-lg">Новая</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {savedStories.map(story => (
                                <div key={story.id} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all">
                                    <p className="font-serif text-lg text-slate-800 dark:text-slate-200 line-clamp-3 mb-4">{story.contentPt}</p>
                                    <div className="flex justify-between items-center pt-4 border-t border-slate-50 dark:border-slate-700">
                                        <span className="text-xs text-slate-400">{new Date(story.createdAt).toLocaleDateString()}</span>
                                        <button onClick={() => { setViewingStory(story); setView(ViewState.Story); }} className="px-4 py-2 bg-slate-900 dark:bg-emerald-600 text-white text-xs font-bold rounded-lg">Открыть</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {view === ViewState.Story && (
                <StoryView
                    key={storyGenIndex}
                    cards={viewingStory ? undefined : storyCards}
                    initialStory={viewingStory || undefined}
                    onBack={() => { setViewingStory(null); setView(viewingStory ? ViewState.StoryList : ViewState.Dashboard); }}
                    onNext={() => { setViewingStory(null); setShowStoryConfig(true); }}
                    onSave={handleSaveStory}
                />
            )}

            {/* MODALS */}
            {listModalConfig && (
                <div className="absolute inset-0 z-[60] bg-black/50 backdrop-blur-sm">
                    <WordListModal title={listModalConfig?.title || ''} cards={listModalConfig?.filter === 'learned' ? cards.filter(c => c.interval > 0) : cards.filter(c => c.interval === 0)} onClose={() => setListModalConfig(null)} onCardClick={handleStudySingleCard} />
                </div>
            )}

            {showStudyConfig && (<StudyConfigModal onClose={() => setShowStudyConfig(false)} onStart={handleStartStudy} />)}

            {showStoryConfig && (
                <StoryConfigModal
                    folders={folders}
                    currentFolderId={'all'}
                    totalCards={cards.length}
                    onClose={() => setShowStoryConfig(false)}
                    onGoToCreate={() => setView(ViewState.Create)}
                    onStart={handleStartStory}
                />
            )}
            </Layout>
        </>
    );
}
