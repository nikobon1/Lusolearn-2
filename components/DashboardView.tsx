
import React, { useEffect, useMemo, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { Flashcard, UserProfile, Folder, ViewState } from '../types';
import { suggestSmartSorting, SmartSortSuggestion } from '../services/geminiService';
import { regenerateMissingImages } from '../services';
import { simpleHash } from '../lib/hash';
import { notifyError, notifyInfo, notifySuccess } from '../lib/notifications';
import { createFolderRecord, deleteFolderRecord } from '../services/repositories/foldersRepository';
import { deleteFlashcardsByIds, updateFlashcardFolders } from '../services/repositories/flashcardsRepository';
import StatsWidget from './StatsWidget';
import DailyQuestsWidget from './DailyQuestsWidget';
import {
    FolderIcon, EditIcon, SunIcon, MoonIcon,
    LoaderIcon, SparklesIcon, ClockIcon,
    SortAlphaIcon, ChartIcon, BookIcon, BrainIcon,
    PlusIcon, SearchIcon, ShuffleIcon, XIcon
} from './Icons';

interface DashboardProps {
    session: Session | null;
    user: UserProfile;
    cards: Flashcard[];
    setCards: React.Dispatch<React.SetStateAction<Flashcard[]>>;
    folders: Folder[];
    setFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
    setView: (view: ViewState) => void;
    onStartStudy: (mode: 'srs' | 'frequency', filters: Set<string>) => void;
    onShowStudyConfig: () => void;
    onOpenList: (config: { title: string; filter: 'learned' | 'learning' }) => void;
    onStudySingleCard: (id: string) => void;
    theme: 'light' | 'dark';
    toggleTheme: () => void;
}

const DashboardView: React.FC<DashboardProps> = ({
    session, user, cards, setCards, folders, setFolders,
    setView, onStartStudy, onShowStudyConfig, onOpenList, onStudySingleCard,
    theme, toggleTheme
}) => {
    // Local State for Dashboard UI
    const [activeFolderId, setActiveFolderId] = useState<string>('all');
    const [showNewFolderInput, setShowNewFolderInput] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'due' | 'new' | 'learned'>('all');
    const [cardSortMode, setCardSortMode] = useState<'newest' | 'oldest' | 'alpha' | 'due'>('newest');
    const [isShuffled, setIsShuffled] = useState(false);
    const [shuffleSeed, setShuffleSeed] = useState(0);
    const [visibleCount, setVisibleCount] = useState(Number.MAX_SAFE_INTEGER);
    const [folderSortMode, setFolderSortMode] = useState<'date' | 'alpha'>('date');
    const [isEditingFolders, setIsEditingFolders] = useState(false);
    const [folderToDelete, setFolderToDelete] = useState<string | null>(null);

    // Smart Sort UI State
    const [showSortModal, setShowSortModal] = useState(false);
    const [isSorting, setIsSorting] = useState(false);
    const [sortSuggestions, setSortSuggestions] = useState<SmartSortSuggestion[]>([]);
    const [selectedSortItems, setSelectedSortItems] = useState<Set<string>>(new Set());
    const [isProactiveSort, setIsProactiveSort] = useState(false);

    // Image Regeneration State
    const [isRegeneratingImages, setIsRegeneratingImages] = useState(false);
    const [regenerationProgress, setRegenerationProgress] = useState({ current: 0, total: 0, word: '' });
    const [showImageRegenConfirm, setShowImageRegenConfirm] = useState(false);

    // Derived State
    const filteredCards = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        let filtered = cards.filter(c => {
            if (activeFolderId === 'all') return true;
            if (activeFolderId === 'default') return c.folderIds.length === 0 || c.folderIds.includes('default');
            return c.folderIds.includes(activeFolderId);
        });

        if (query) {
            filtered = filtered.filter(card => {
                const searchableText = [
                    card.originalTerm,
                    card.translation,
                    card.definition,
                    ...(card.tags || []),
                    ...(card.examples || []).map(example => example.sentence),
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();

                return searchableText.includes(query);
            });
        }

        if (statusFilter === 'due') {
            filtered = filtered.filter(card => card.interval > 0 && card.nextReviewDate <= Date.now());
        } else if (statusFilter === 'new') {
            filtered = filtered.filter(card => card.interval === 0);
        } else if (statusFilter === 'learned') {
            filtered = filtered.filter(card => card.interval > 0);
        }

        const sorted = [...filtered];
        if (isShuffled) {
            sorted.sort((a, b) => simpleHash(a.id + shuffleSeed) - simpleHash(b.id + shuffleSeed));
            return sorted;
        }

        if (cardSortMode === 'oldest') {
            sorted.sort((a, b) => a.createdAt - b.createdAt);
        } else if (cardSortMode === 'alpha') {
            sorted.sort((a, b) => a.originalTerm.localeCompare(b.originalTerm, 'pt'));
        } else if (cardSortMode === 'due') {
            sorted.sort((a, b) => a.nextReviewDate - b.nextReviewDate);
        } else {
            sorted.sort((a, b) => b.createdAt - a.createdAt);
        }

        return sorted;
    }, [cards, activeFolderId, searchQuery, statusFilter, cardSortMode, isShuffled, shuffleSeed]);

    useEffect(() => {
        setVisibleCount(Number.MAX_SAFE_INTEGER);
    }, [activeFolderId, searchQuery, statusFilter, cardSortMode, isShuffled]);

    const sortedFolders = useMemo(() => {
        const others = [...folders];
        if (folderSortMode === 'alpha') others.sort((a, b) => a.name.localeCompare(b.name));
        else others.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        return others;
    }, [folders, folderSortMode]);

    const dueCount = cards.filter(c => c.nextReviewDate <= Date.now()).length;
    const dueReviewCount = cards.filter(c => c.interval > 0 && c.nextReviewDate <= Date.now()).length;
    const newCardsCount = cards.filter(c => c.interval === 0).length;
    const learnedCardsCount = cards.filter(c => c.interval > 0).length;
    const visibleCards = filteredCards.slice(0, visibleCount);
    const hasMoreCards = visibleCount < filteredCards.length;

    // Folder Handlers
    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        if (folders.some(f => f.name.toLowerCase() === newFolderName.trim().toLowerCase())) return;

        const newFolder = { id: self.crypto.randomUUID(), name: newFolderName.trim(), createdAt: Date.now() };
        setFolders(prev => [...prev, newFolder]);
        setNewFolderName('');
        setShowNewFolderInput(false);

        if (session && session.user.email !== 'offline@demo.com') {
            await createFolderRecord(newFolder.id, session.user.id, newFolder.name);
        }
    };

    const handleDeleteFolder = (folderId: string) => setFolderToDelete(folderId);

    const confirmDeleteFolder = async (deleteContent: boolean) => {
        if (!folderToDelete) return;
        const folderId = folderToDelete;
        setFolderToDelete(null);

        setFolders(prev => prev.filter(f => f.id !== folderId));
        if (activeFolderId === folderId) setActiveFolderId('all');

        if (deleteContent) {
            const cardsInFolder = cards.filter(c => c.folderIds.includes(folderId));
            const idsToDelete = new Set(cardsInFolder.map(c => c.id));
            setCards(prev => prev.filter(c => !idsToDelete.has(c.id)));
            if (session && session.user.email !== 'offline@demo.com') {
                await deleteFolderRecord(folderId);
                await deleteFlashcardsByIds(Array.from(idsToDelete));
            }
        } else {
            setCards(prev => prev.map(c => {
                if (c.folderIds.includes(folderId)) {
                    return { ...c, folderIds: c.folderIds.filter(id => id !== folderId) };
                }
                return c;
            }));
            if (session && session.user.email !== 'offline@demo.com') {
                await deleteFolderRecord(folderId);
                const changedCards = cards.filter(c => c.folderIds.includes(folderId));
                for (const c of changedCards) {
                    const newIds = c.folderIds.filter(id => id !== folderId);
                    await updateFlashcardFolders(c.id, newIds);
                }
            }
        }
    };

    // Smart Sort Handlers
    const runSmartSort = async (cardsToSort: Flashcard[]) => {
        setIsSorting(true);
        try {
            const suggestions = await suggestSmartSorting(cardsToSort, folders);
            if (suggestions.length > 0) {
                setSortSuggestions(suggestions);
                const allIds = new Set<string>();
                suggestions.forEach(s => s.cardIds.forEach(id => allIds.add(id)));
                setSelectedSortItems(allIds);
                setShowSortModal(true);
            } else if (!isProactiveSort) {
                notifyInfo('ИИ не нашел очевидных категорий.');
            }
        } catch (e) {
            console.error(e);
            if (!isProactiveSort) notifyError('Ошибка при сортировке.');
        } finally {
            setIsSorting(false);
        }
    };

    const confirmAutoSort = async () => {
        let newCards = [...cards];
        let newFolders = [...folders];
        const updates = [];

        try {
            for (const sugg of sortSuggestions) {
                let targetId = sugg.targetFolderId;
                const validCardIds = sugg.cardIds.filter(id => selectedSortItems.has(id));
                if (validCardIds.length === 0) continue;

                if (sugg.action === 'create' || targetId === 'NEW_FOLDER') {
                    const existing = newFolders.find(f => f.name.toLowerCase() === sugg.suggestedFolderName?.toLowerCase());
                    if (existing) {
                        targetId = existing.id;
                    } else {
                        const newId = self.crypto.randomUUID();
                        const name = sugg.suggestedFolderName || 'Новая папка';
                        const folderObj = { id: newId, name, createdAt: Date.now() };
                        newFolders = [...newFolders, folderObj];
                        if (session && session.user.email !== 'offline@demo.com') {
                            await createFolderRecord(newId, session.user.id, name);
                        }
                        targetId = newId;
                    }
                }

                for (const cardId of validCardIds) {
                    const cardIndex = newCards.findIndex(c => c.id === cardId);
                    if (cardIndex >= 0) {
                        const card = { ...newCards[cardIndex] };
                        const oldFolders = card.folderIds.filter(fid => fid !== 'default');
                        if (!oldFolders.includes(targetId)) oldFolders.push(targetId);
                        card.folderIds = oldFolders;
                        newCards[cardIndex] = card;

                        if (session && session.user.email !== 'offline@demo.com') {
                            updates.push(updateFlashcardFolders(cardId, oldFolders));
                        }
                    }
                }
            }

            if (updates.length > 0) await Promise.all(updates);

            setCards(newCards);
            setFolders(newFolders);
            setShowSortModal(false);
            setSortSuggestions([]);
            setSelectedSortItems(new Set());
            setIsProactiveSort(false);
        } catch (err) {
            console.error("Auto sort failed", err);
            notifyError('Ошибка при сохранении сортировки.');
        }
    };

    const handleAutoSort = () => {
        setIsProactiveSort(false);
        const candidates = cards.filter(c => c.folderIds.includes('default') || c.folderIds.length === 0);
        if (candidates.length === 0) { notifyInfo('Все карточки уже отсортированы.'); return; }
        runSmartSort(candidates);
    };

    const toggleSortSelection = (id: string) => {
        const newSet = new Set(selectedSortItems);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedSortItems(newSet);
    };

    // Image Regeneration Handler
    const handleRegenerateImages = async () => {
        const cardsWithoutImages = cards.filter(c => !c.imageUrl || c.imageUrl === '');
        if (cardsWithoutImages.length === 0) {
            notifyInfo('Все карточки уже имеют изображения.');
            return;
        }

        setShowImageRegenConfirm(true);
    };

    const startRegenerateImages = async () => {
        setShowImageRegenConfirm(false);

        setIsRegeneratingImages(true);
        try {
            await regenerateMissingImages(
                cards,
                (current, total, word) => setRegenerationProgress({ current, total, word }),
                (cardId, imageUrl) => {
                    setCards(prev => prev.map(c =>
                        c.id === cardId ? { ...c, imageUrl } : c
                    ));
                }
            );
            notifySuccess('Изображения сгенерированы.');
        } catch (error) {
            console.error("Regeneration error:", error);
            notifyError('Ошибка при генерации изображений.');
        } finally {
            setIsRegeneratingImages(false);
            setRegenerationProgress({ current: 0, total: 0, word: '' });
        }
    };

    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin">
            <div className="max-w-7xl mx-auto">
                <header className="mb-8 flex items-end justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 dark:text-white serif mb-1">Привет, Студент</h1>
                        <p className="text-slate-500 dark:text-slate-400">Готовы учить португальский?</p>
                    </div>
                    <div className="md:hidden flex gap-2">
                        <button onClick={toggleTheme} className="p-2 bg-white dark:bg-slate-700 rounded-xl text-slate-500 dark:text-slate-400 shadow-sm">
                            {theme === 'dark' ? <SunIcon className="w-6 h-6" /> : <MoonIcon className="w-6 h-6" />}
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column: Stats & Actions */}
                    <div className="lg:col-span-4 space-y-6">
                        <DailyQuestsWidget quests={user.quests} />
                        <StatsWidget cards={cards} user={user} onOpenList={(type) => onOpenList({ title: type === 'learned' ? 'Выучено' : 'На изучении', filter: type })} />

                        {/* Study Actions */}
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 space-y-3">
                            <button onClick={() => onStartStudy('srs', new Set())} className="w-full p-4 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-bold rounded-2xl hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors flex items-center gap-3 border border-indigo-100 dark:border-indigo-800/30">
                                <div className="p-2 bg-white dark:bg-indigo-900/50 rounded-full shadow-sm"><BrainIcon className="w-5 h-5" /></div>
                                <span>Умное повторение</span>
                                <span className="ml-auto text-xs bg-white dark:bg-indigo-900/50 px-2 py-1 rounded-lg text-indigo-600 dark:text-indigo-300">{dueCount}</span>
                            </button>
                            <button onClick={onShowStudyConfig} className="w-full p-4 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-2xl border border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 transition-all flex items-center gap-3">
                                <div className="p-2 bg-slate-50 dark:bg-slate-600 rounded-full"><ChartIcon className="w-5 h-5" /></div>
                                <span>Частотное</span>
                            </button>
                            <button onClick={() => setView(ViewState.StoryList)} className="w-full p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 font-bold rounded-2xl border border-amber-100 dark:border-amber-800/30 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all flex items-center gap-3">
                                <div className="p-2 bg-white dark:bg-amber-900/50 rounded-full shadow-sm"><BookIcon className="w-5 h-5" /></div>
                                <span>История</span>
                            </button>
                        </div>

                        {/* Folders Widget */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><FolderIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> Папки</h3>
                                <div className="flex gap-2">
                                    <button onClick={() => setFolderSortMode(prev => prev === 'date' ? 'alpha' : 'date')} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600">
                                        {folderSortMode === 'date' ? <ClockIcon className="w-4 h-4" /> : <SortAlphaIcon className="w-4 h-4" />}
                                    </button>
                                    <button onClick={() => setIsEditingFolders(!isEditingFolders)} className={`w-8 h-8 rounded-full flex items-center justify-center ${isEditingFolders ? 'bg-emerald-500 text-white' : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700'}`}>
                                        <EditIcon className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => setShowNewFolderInput(!showNewFolderInput)} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200"><PlusIcon className="w-4 h-4" /></button>
                                </div>
                            </div>
                            {showNewFolderInput && (
                                <div className="flex gap-2 mb-4">
                                    <input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="Имя..." className="flex-1 p-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm bg-white dark:bg-slate-700" />
                                    <button onClick={handleCreateFolder} className="px-3 bg-emerald-600 text-white rounded-lg text-sm font-bold">OK</button>
                                </div>
                            )}
                            <div className="flex flex-wrap gap-2">
                                <button onClick={() => setActiveFolderId('all')} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${activeFolderId === 'all' ? 'bg-emerald-600 text-white' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600'}`}>Все</button>
                                <button onClick={() => setActiveFolderId('default')} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${activeFolderId === 'default' ? 'bg-emerald-600 text-white' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200'}`}>Без категории</button>
                                {sortedFolders.map(f => (
                                    <div key={f.id} className="relative group">
                                        <button onClick={() => setActiveFolderId(f.id)} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all max-w-full truncate ${activeFolderId === f.id ? 'bg-emerald-600 text-white' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600'}`}>{f.name}</button>
                                        {isEditingFolders && (
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(f.id); }} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center"><XIcon className="w-3 h-3" /></button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Cards Grid */}
                    <div className="lg:col-span-8">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col h-[calc(100vh-140px)] md:h-auto md:min-h-[600px]">
                            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-800 rounded-t-2xl z-10">
                                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <span>Мои слова ({filteredCards.length})</span>
                                    {activeFolderId !== 'all' && <span className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded">{activeFolderId === 'default' ? 'Без категории' : folders.find(f => f.id === activeFolderId)?.name}</span>}
                                </h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { setShuffleSeed(Date.now()); setIsShuffled(prev => !prev); }}
                                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isShuffled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                                        title="Перемешать карточки"
                                    >
                                        <ShuffleIcon className="w-4 h-4" />
                                    </button>
                                    {/* Regenerate missing images button */}
                                    <button
                                        onClick={handleRegenerateImages}
                                        disabled={isRegeneratingImages}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-colors bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100 border border-purple-200 disabled:opacity-50"
                                        title="Сгенерировать недостающие изображения"
                                    >
                                        {isRegeneratingImages ? (
                                            <>
                                                <LoaderIcon className="w-3 h-3 animate-spin" />
                                                <span>{regenerationProgress.current}/{regenerationProgress.total}</span>
                                            </>
                                        ) : (
                                            <>
                                                <SparklesIcon className="w-3 h-3" />
                                                <span>🖼️</span>
                                            </>
                                        )}
                                    </button>
                                    {activeFolderId === 'default' && (
                                        <button onClick={handleAutoSort} disabled={isSorting} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-colors bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 border border-indigo-200">
                                            {isSorting ? <LoaderIcon className="w-3 h-3 animate-spin" /> : <SparklesIcon className="w-3 h-3" />} Сорт.
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 space-y-3">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                                    <label className="relative flex-1">
                                        <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                        <input
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            placeholder="Поиск по слову, переводу, тегу или примеру"
                                            className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 py-2.5 pl-10 pr-3 text-sm text-slate-700 dark:text-slate-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
                                        />
                                    </label>

                                    <select
                                        value={cardSortMode}
                                        onChange={e => { setCardSortMode(e.target.value as 'newest' | 'oldest' | 'alpha' | 'due'); setIsShuffled(false); }}
                                        className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
                                    >
                                        <option value="newest">Сначала новые</option>
                                        <option value="oldest">Сначала старые</option>
                                        <option value="alpha">По алфавиту</option>
                                        <option value="due">По дате повтора</option>
                                    </select>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <button onClick={() => setStatusFilter('all')} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${statusFilter === 'all' ? 'bg-emerald-600 text-white' : 'border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500 hover:text-slate-700 dark:hover:text-white'}`}>Все ({filteredCards.length})</button>
                                    <button onClick={() => setStatusFilter('due')} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${statusFilter === 'due' ? 'bg-emerald-600 text-white' : 'border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500 hover:text-slate-700 dark:hover:text-white'}`}>К повторению ({dueReviewCount})</button>
                                    <button onClick={() => setStatusFilter('new')} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${statusFilter === 'new' ? 'bg-emerald-600 text-white' : 'border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500 hover:text-slate-700 dark:hover:text-white'}`}>Новые ({newCardsCount})</button>
                                    <button onClick={() => setStatusFilter('learned')} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${statusFilter === 'learned' ? 'bg-emerald-600 text-white' : 'border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500 hover:text-slate-700 dark:hover:text-white'}`}>Выученные ({learnedCardsCount})</button>
                                </div>

                                <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                                    <span>Показано {Math.min(visibleCount, filteredCards.length)} из {filteredCards.length}</span>
                                    {isShuffled && <span>Случайный порядок</span>}
                                </div>
                            </div>

                            <div className="p-4 overflow-y-auto flex-1">
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {visibleCards.map(card => (
                                        <div key={card.id} onClick={() => onStudySingleCard(card.id)} className="flex flex-col p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-800 transition-all relative cursor-pointer group">
                                            <div className="flex items-start gap-3 mb-2">
                                                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex-shrink-0 overflow-hidden">
                                                    {card.imageUrl ? <img src={card.imageUrl} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-400">{card.originalTerm?.slice(0, 2)}</div>}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-slate-800 dark:text-white truncate text-sm mb-0.5">{card.originalTerm}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{card.translation}</p>
                                                </div>
                                            </div>
                                            <div className="mt-auto pt-2 border-t border-slate-50 dark:border-slate-700 flex gap-1">
                                                <span className={`text-[9px] px-1.5 py-0.5 rounded border ${card.interval > 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>{card.interval > 0 ? `${card.interval}д` : 'New'}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {filteredCards.length === 0 && <div className="text-center py-10 text-slate-400">В этой папке пусто.</div>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {showSortModal && (
                <div className="absolute inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[80vh]">
                        <div className="flex justify-between items-center mb-4 flex-shrink-0">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2"><SparklesIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Умная сортировка</h3>
                            <button onClick={() => setShowSortModal(false)} className="text-slate-400"><XIcon className="w-5 h-5" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                            {sortSuggestions.map((group, idx) => {
                                const isNewFolder = group.action === 'create';
                                const folderName = isNewFolder ? (group.suggestedFolderName || 'Новая папка') : (folders.find(f => f.id === group.targetFolderId)?.name || 'Unknown');
                                const groupCards = cards.filter(c => group.cardIds.includes(c.id));
                                if (groupCards.length === 0) return null;
                                return (
                                    <div key={idx}>
                                        <div className={`flex items-center gap-2 mb-2 font-bold px-3 py-1.5 rounded-lg w-fit ${isNewFolder ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-50 text-indigo-700'}`}>{isNewFolder ? <PlusIcon className="w-4 h-4" /> : <FolderIcon className="w-4 h-4" />}{folderName}</div>
                                        <div className="space-y-1 pl-2 border-l-2 border-slate-200">
                                            {groupCards.map(card => (
                                                <div key={card.id} onClick={() => toggleSortSelection(card.id)} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded cursor-pointer">
                                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedSortItems.has(card.id) ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'}`}>{selectedSortItems.has(card.id) && <PlusIcon className="w-3 h-3 rotate-45" />}</div>
                                                    <span className="text-slate-800 dark:text-slate-200 font-medium">{card.originalTerm}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-6 pt-4 border-t border-slate-100 flex gap-3 flex-shrink-0">
                            <button onClick={() => setShowSortModal(false)} className="flex-1 py-3 text-slate-500 font-bold">Отмена</button>
                            <button onClick={confirmAutoSort} className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl">Применить</button>
                        </div>
                    </div>
                </div>
            )}

            {folderToDelete && (
                <div className="absolute inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                        <h3 className="text-lg font-bold text-rose-600 mb-4">Удалить папку?</h3>
                        <p className="text-sm text-slate-500 mb-6">Что сделать со словами внутри?</p>
                        <div className="space-y-3">
                            <button onClick={() => confirmDeleteFolder(true)} className="w-full py-3 bg-rose-600 text-white font-bold rounded-xl">Удалить всё</button>
                            <button onClick={() => confirmDeleteFolder(false)} className="w-full py-3 bg-white border-2 border-slate-200 font-bold rounded-xl">Оставить слова</button>
                            <button onClick={() => setFolderToDelete(null)} className="w-full py-2 text-sm text-slate-400 font-medium">Отмена</button>
                        </div>
                    </div>
                </div>
            )}

            {showImageRegenConfirm && (
                <div className="absolute inset-0 z-[85] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Сгенерировать изображения?</h3>
                        <p className="text-sm text-slate-500 mb-6">Будут обработаны карточки без изображения.</p>
                        <div className="space-y-3">
                            <button onClick={startRegenerateImages} className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl">Начать</button>
                            <button onClick={() => setShowImageRegenConfirm(false)} className="w-full py-3 bg-white border-2 border-slate-200 font-bold rounded-xl">Отмена</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardView;
