import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { Auth } from './components/Auth';
import Layout from './components/Layout';
import NotificationCenter from './components/NotificationCenter';
import DashboardView from './components/DashboardView';
import { useAppData } from './hooks/useAppData';
import { useTheme } from './hooks/useTheme';
import { useStudyState } from './hooks/useStudyState';
import { useDailyPlan } from './hooks/useDailyPlan';
import { planRemaining } from './domain/dailyPlan';
import { notifyError, notifyInfo, notifySuccess } from './lib/notifications';
import { activeCards, withPaused } from './domain/paused';
import { usePracticeLog } from './hooks/usePracticeLog';
import { CONJUGATIONS_PER_DAY, PHRASES_PER_DAY, RouteStep, buildTodayRoute } from './domain/todayRoute';
import { answeredOn, dayKey } from './domain/practiceLog';
import type { Situation } from './domain/phraseTemplates';
import { Topic, loadFrequencyDictionary, normalizeTerm } from './domain/frequencyDictionary';
import { updateFlashcardTags } from './services/repositories/flashcardsRepository';
import { useStoryState } from './hooks/useStoryState';
import { LoaderIcon } from './components/Icons';
import { Flashcard, Folder, ViewState } from './types';
import { getCurrentSession, signOutUser, subscribeAuthState } from './services/repositories/authRepository';
import { createFolderRecord } from './services/repositories/foldersRepository';
import { FREQUENCY_FOLDER_NAME } from './domain/frequencyDictionary';

const StudyContainer = lazy(() => import('./components/StudyContainer'));
const Creator = lazy(() => import('./components/Creator'));
const StoryView = lazy(() => import('./components/StoryView'));
const FrequencyPathView = lazy(() => import('./components/FrequencyPathView'));
const LessonsView = lazy(() => import('./components/LessonsView'));
const ConjugationTrainer = lazy(() => import('./components/ConjugationTrainer'));
const PhrasesView = lazy(() => import('./components/PhrasesView'));
const WordListModal = lazy(() => import('./components/WordListModal'));
const PracticeConfigModal = lazy(() => import('./components/PracticeConfigModal'));
const StoryConfigModal = lazy(() => import('./components/StoryConfigModal'));

const ScreenFallback = ({ className = 'h-full flex items-center justify-center p-4' }: { className?: string }) => (
    <div className={className}>
        <LoaderIcon className="h-8 w-8 animate-spin text-emerald-600" />
    </div>
);

export default function App() {
    const [session, setSession] = useState<Session | null>(null);
    const [offlineMode, setOfflineMode] = useState(false);
    // Remember the open screen: if the phone unloads the tab in the background,
    // reopening it returns to the same section instead of the home screen
    const [view, setView] = useState<ViewState>(() => {
        try {
            const saved = sessionStorage.getItem('luso_view') as ViewState | null;
            const restorable = [ViewState.Dashboard, ViewState.Frequency, ViewState.Lessons, ViewState.Conjugation, ViewState.Phrases, ViewState.StoryList, ViewState.Create];
            return saved && restorable.includes(saved) ? saved : ViewState.Dashboard;
        } catch {
            return ViewState.Dashboard;
        }
    });
    useEffect(() => {
        try { sessionStorage.setItem('luso_view', view); } catch { /* storage unavailable */ }
    }, [view]);

    const {
        user, cards, setCards, folders, setFolders, savedStories, setSavedStories,
        loading, fetchData, updateQuestProgress, recordReviewProgress, addCards, saveStoryToDb
    } = useAppData(session, offlineMode);

    const { theme, toggleTheme } = useTheme();

    const {
        studyQueue, setStudyQueue, showStudyConfig, setShowStudyConfig, listModalConfig, setListModalConfig,
        handleStartStudy: startFilteredStudy, handleStudySingleCard: studySingleCardRaw
    } = useStudyState(cards, setView);

    // Paused cards (rare words set aside) never enter the plan or practice
    const studyableCards = useMemo(() => activeCards(cards), [cards]);
    const plan = useDailyPlan(studyableCards, session?.user.id);
    const practiceLog = usePracticeLog(session?.user.id);

    // «Занятие на сегодня»
    const [topicByTerm, setTopicByTerm] = useState<Map<string, Topic>>(new Map());
    useEffect(() => {
        loadFrequencyDictionary()
            .then(dict => setTopicByTerm(new Map(dict.filter(e => e.t).map(e => [normalizeTerm(e.w), e.t as Topic]))))
            .catch(() => { /* phrases fall back to the least practised situation */ });
    }, []);
    const routeSteps = useMemo(() => {
        const todayNew = new Set(plan.todayNewIds);
        const todayTopics = cards
            .filter(c => todayNew.has(c.id))
            .map(c => topicByTerm.get(normalizeTerm(c.originalTerm)))
            .filter((t): t is Topic => !!t);
        const hasVerbs = studyableCards.some(c => c.conjugation?.isVerb || c.tags?.includes('глагол'));
        return buildTodayRoute({ summary: plan.summary, settings: plan.settings, entries: practiceLog.entries, todayTopics, hasVerbs });
    }, [plan.summary, plan.settings, plan.todayNewIds, practiceLog.entries, cards, studyableCards, topicByTerm]);

    /** A short drill launched from the route; cleared when the learner goes elsewhere. */
    const [quick, setQuick] = useState<{ view: ViewState; situation?: Situation; count: number; key: number } | null>(null);
    useEffect(() => {
        if (quick && view !== quick.view) setQuick(null);
    }, [view, quick]);
    // Remount the study screen for every new session
    const [studySessionKey, setStudySessionKey] = useState(0);

    // Free practice: any set of cards, nothing is saved
    const [practiceMode, setPracticeMode] = useState(false);

    const openStudy = (queue: Flashcard[], practice = false) => {
        setPracticeMode(practice);
        setStudyQueue(queue);
        setStudySessionKey(k => k + 1);
        setView(ViewState.Study);
    };

    // "Учить": today's plan (reviews + new words); when it's done, an extra portion of due reviews
    const startPlanSession = () => {
        const queue = plan.getQueue();
        if (queue.length > 0) return openStudy(queue);
        const extra = plan.getExtraQueue();
        if (extra.length > 0) {
            notifyInfo('План на сегодня выполнен. Берём дополнительную порцию повторений.');
            return openStudy(extra);
        }
        notifyInfo(plan.summary.newAvailable === 0
            ? 'Сейчас нечего повторять. Добавьте новые слова в «С нуля» или «Создать».'
            : 'На сегодня всё! Новые слова появятся завтра (или увеличьте лимит на главной).');
    };

    const handleStartStudy = (mode: 'srs' | 'frequency', filters: Set<string>) => {
        if (mode === 'srs') return startPlanSession();
        startFilteredStudy(mode, filters);
        setPracticeMode(false);
        setStudySessionKey(k => k + 1);
    };

    const handleStudySingleCard = (id: string) => {
        studySingleCardRaw(id);
        setPracticeMode(false);
        setStudySessionKey(k => k + 1);
    };

    const {
        storyCards, viewingStory, setViewingStory, showStoryConfig, setShowStoryConfig, storyGenIndex,
        handleStartStory, handleSaveStory
    } = useStoryState(cards, setView, saveStoryToDb);

    useEffect(() => {
        // Supabase emits auth events on every return to the tab (token refresh, SIGNED_IN).
        // Keep the same session object while the user is the same, otherwise everything that
        // depends on it (data loading!) re-runs and the app looks like it reloads.
        const keepIfSameUser = (next: Session | null) =>
            setSession(prev => (prev && next && prev.user.id === next.user.id ? prev : next));
        getCurrentSession().then(keepIfSameUser);
        const subscription = subscribeAuthState(keepIfSameUser);
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

    const isRealSession = !!session && session.user.email !== 'offline@demo.com';

    // Finds a folder by name or creates it (and saves it for signed-in users)
    const ensureFolder = async (name: string): Promise<string> => {
        const existing = folders.find(f => f.name.toLowerCase() === name.toLowerCase());
        if (existing) return existing.id;
        const folder: Folder = { id: self.crypto.randomUUID(), name, createdAt: Date.now() };
        setFolders(prev => [...prev, folder]);
        if (isRealSession && session) {
            const { error } = await createFolderRecord(folder.id, session.user.id, folder.name);
            if (error) console.error('Failed to save folder', error);
        }
        return folder.id;
    };

    // Folder for cards created from the frequency dictionary (created on first use)
    const ensureFrequencyFolder = () => ensureFolder(FREQUENCY_FOLDER_NAME);

    const handleStudyCards = (toStudy: Flashcard[]) => {
        toStudy = activeCards(toStudy);
        if (toStudy.length === 0) return;
        openStudy(toStudy);
    };

    const remainingToday = (kind: 'phrase' | 'conjugation', perDay: number) =>
        Math.max(1, perDay - answeredOn(practiceLog.entries, kind, dayKey(Date.now())).length);

    const handleRouteStep = (step: RouteStep) => {
        if (step.id === 'reviews' || step.id === 'new') return startPlanSession();
        if (step.id === 'addWords') return setView(ViewState.Frequency);
        if (step.id === 'phrases') {
            setQuick({ view: ViewState.Phrases, situation: step.situation, count: step.done ? PHRASES_PER_DAY : remainingToday('phrase', PHRASES_PER_DAY), key: Date.now() });
            return setView(ViewState.Phrases);
        }
        if (step.id === 'conjugation') {
            setQuick({ view: ViewState.Conjugation, count: step.done ? CONJUGATIONS_PER_DAY : remainingToday('conjugation', CONJUGATIONS_PER_DAY), key: Date.now() });
            return setView(ViewState.Conjugation);
        }
    };
    const backToRoute = () => { setQuick(null); setView(ViewState.Dashboard); };

    /** Put cards on pause (or return them). Progress is kept; only the tag changes. */
    const handleSetPaused = async (ids: string[], paused: boolean) => {
        const idSet = new Set(ids);
        const updated = cards.filter(c => idSet.has(c.id)).map(c => withPaused(c, paused));
        const byId = new Map(updated.map(c => [c.id, c]));
        setCards(prev => prev.map(c => byId.get(c.id) || c));
        if (session && session.user.email !== 'offline@demo.com') {
            const results = await Promise.all(updated.map(c => updateFlashcardTags(c.id, c.tags || [])));
            if (results.some(r => r.error)) {
                notifyError('Не все изменения сохранились. Попробуйте ещё раз.');
                return;
            }
        }
        notifySuccess(paused ? `На паузе: ${updated.length}. Эти слова не будут попадаться в повторениях.` : `Возвращено в повторения: ${updated.length}`);
    };

    const dueCount = planRemaining(plan.summary);

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
            <Layout
                view={view}
                setView={setView}
                user={user}
                theme={theme}
                toggleTheme={toggleTheme}
                onLogout={handleLogout}
                onOpenStudy={startPlanSession}
                dueCount={dueCount}
            >
                {view === ViewState.Dashboard && (
                <DashboardView
                    session={session} user={user} cards={cards} setCards={setCards} folders={folders} setFolders={setFolders}
                    setView={setView} onStartStudy={handleStartStudy} onShowStudyConfig={() => setShowStudyConfig(true)}
                    onOpenList={setListModalConfig} onStudySingleCard={handleStudySingleCard} theme={theme} toggleTheme={toggleTheme}
                    planSummary={plan.summary} planSettings={plan.settings} onChangePlanSettings={plan.setSettings} onStartPlan={startPlanSession}
                    routeSteps={routeSteps} onRouteStep={handleRouteStep}
                />
            )}

            {view === ViewState.Study && studyQueue.length > 0 && (
                <div className="h-full flex items-center justify-center p-4 bg-slate-100/50 dark:bg-slate-900">
                    <Suspense fallback={<ScreenFallback className="h-full flex items-center justify-center p-4" />}>
                        <StudyContainer
                            key={studySessionKey}
                            cards={studyQueue}
                            onComplete={() => setView(ViewState.Dashboard)}
                            onUpdateCard={(updated) => setCards(prev => prev.map(c => c.id === updated.id ? updated : c))}
                            onProgress={recordReviewProgress}
                            onReviewed={plan.recordReview}
                            getMoreCards={plan.getQueue}
                            getExtraCards={plan.getExtraQueue}
                            level={plan.settings.level}
                            practice={practiceMode}
                            userId={session?.user.id}
                        />
                    </Suspense>
                </div>
            )}

            {view === ViewState.Create && (
                <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-900 p-0 md:p-8 flex items-center justify-center">
                    <div className="w-full h-full md:h-[85vh] md:max-w-4xl bg-white dark:bg-slate-800 md:rounded-2xl md:shadow-2xl md:border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
                        <Suspense fallback={<ScreenFallback className="h-full flex items-center justify-center p-4" />}>
                            <Creator
                                onCardsCreated={onCardsCreated}
                                onCancel={() => setView(ViewState.Dashboard)}
                                folders={folders}
                                onCreateFolder={(newFolder) => setFolders(prev => [...prev, newFolder])}
                            />
                        </Suspense>
                    </div>
                </div>
            )}

            {view === ViewState.Frequency && (
                <Suspense fallback={<ScreenFallback />}>
                    <FrequencyPathView
                        cards={cards}
                        userId={session?.user.id}
                        onCardsCreated={addCards}
                        ensureFolder={ensureFrequencyFolder}
                        onStudyCards={handleStudyCards}
                    />
                </Suspense>
            )}

            {view === ViewState.Lessons && (
                <Suspense fallback={<ScreenFallback />}>
                    <LessonsView
                        cards={cards}
                        userId={session?.user.id}
                        onCardsCreated={addCards}
                        ensureFolder={ensureFolder}
                        onStudyCards={handleStudyCards}
                    />
                </Suspense>
            )}

            {view === ViewState.Conjugation && (
                <Suspense fallback={<ScreenFallback />}>
                    <ConjugationTrainer key={quick?.view === ViewState.Conjugation ? quick.key : 'free'} cards={studyableCards} practice={practiceLog}
                        quickStart={quick?.view === ViewState.Conjugation ? { count: quick.count } : null} onQuickDone={backToRoute} />
                </Suspense>
            )}

            {view === ViewState.Phrases && (
                <Suspense fallback={<ScreenFallback />}>
                    <PhrasesView key={quick?.view === ViewState.Phrases ? quick.key : 'free'} cards={cards} userId={session?.user.id} onCardsCreated={addCards} ensureFolder={ensureFolder}
                        practice={practiceLog} quickStart={quick?.view === ViewState.Phrases && quick.situation ? { situation: quick.situation, count: quick.count } : null} onQuickDone={backToRoute} />
                </Suspense>
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
                <Suspense fallback={<ScreenFallback className="h-full flex items-center justify-center p-4" />}>
                    <StoryView
                        key={storyGenIndex}
                        cards={viewingStory ? undefined : storyCards}
                        initialStory={viewingStory || undefined}
                        onBack={() => { setViewingStory(null); setView(viewingStory ? ViewState.StoryList : ViewState.Dashboard); }}
                        onNext={() => { setViewingStory(null); setShowStoryConfig(true); }}
                        onSave={handleSaveStory}
                    />
                </Suspense>
            )}

            {/* MODALS */}
            {listModalConfig && (
                <div className="absolute inset-0 z-[60] bg-black/50 backdrop-blur-sm">
                    <Suspense fallback={<ScreenFallback className="h-full flex items-center justify-center" />}>
                        <WordListModal title={listModalConfig?.title || ''} cards={listModalConfig?.filter === 'learned' ? cards.filter(c => c.interval > 0) : cards.filter(c => c.interval === 0)} onClose={() => setListModalConfig(null)} onCardClick={handleStudySingleCard} onSetPaused={handleSetPaused} />
                    </Suspense>
                </div>
            )}

            {showStudyConfig && (
                <Suspense fallback={<ScreenFallback className="fixed inset-0 z-[60] flex items-center justify-center" />}>
                    <PracticeConfigModal
                        cards={studyableCards}
                        folders={folders}
                        onClose={() => setShowStudyConfig(false)}
                        onStart={(selected) => { setShowStudyConfig(false); openStudy(selected, true); }}
                    />
                </Suspense>
            )}

            {showStoryConfig && (
                <Suspense fallback={<ScreenFallback className="fixed inset-0 z-[60] flex items-center justify-center" />}>
                    <StoryConfigModal
                        folders={folders}
                        currentFolderId={'all'}
                        totalCards={cards.length}
                        onClose={() => setShowStoryConfig(false)}
                        onGoToCreate={() => setView(ViewState.Create)}
                        onStart={handleStartStory}
                    />
                </Suspense>
            )}
            </Layout>
        </>
    );
}
