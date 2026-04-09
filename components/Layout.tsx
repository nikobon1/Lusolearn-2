import React, { useState } from 'react';
import { UserProfile, ViewState } from '../types';
import {
    HomeIcon, PlusIcon, BookIcon, TrophyIcon,
    FireIcon, SunIcon, MoonIcon, XIcon, BrainIcon, SettingsIcon
} from './Icons';

interface LayoutProps {
    children: React.ReactNode;
    view: ViewState;
    setView: (view: ViewState) => void;
    user: UserProfile;
    theme: 'light' | 'dark';
    toggleTheme: () => void;
    onLogout: () => void;
    onOpenStudy: () => void;
    dueCount: number;
}

const Layout: React.FC<LayoutProps> = ({
    children, view, setView, user, theme, toggleTheme, onLogout, onOpenStudy, dueCount
}) => {
    const [showMobileMenu, setShowMobileMenu] = useState(false);

    const handleViewChange = (nextView: ViewState) => {
        setShowMobileMenu(false);
        setView(nextView);
    };

    const handleStudyOpen = () => {
        setShowMobileMenu(false);
        onOpenStudy();
    };

    const handleThemeToggle = () => {
        toggleTheme();
        setShowMobileMenu(false);
    };

    const handleLogout = () => {
        setShowMobileMenu(false);
        onLogout();
    };

    return (
        <div className="flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-900 transition-colors dark:bg-slate-900 dark:text-white">
            <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 md:flex">
                <div className="flex items-center gap-3 p-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30">
                        <BrainIcon className="h-6 w-6" />
                    </div>
                    <h1 className="serif text-xl font-bold tracking-tight text-slate-800 dark:text-white">LusoLearn</h1>
                </div>

                <nav className="mt-4 flex-1 space-y-2 px-4">
                    <button onClick={() => setView(ViewState.Dashboard)} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 transition-all ${view === ViewState.Dashboard ? 'bg-emerald-50 font-bold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700'}`}>
                        <HomeIcon className="h-5 w-5" /> Главная
                    </button>
                    <button onClick={() => setView(ViewState.Create)} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 transition-all ${view === ViewState.Create ? 'bg-emerald-50 font-bold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700'}`}>
                        <PlusIcon className="h-5 w-5" /> Создать
                    </button>
                    <button onClick={handleStudyOpen} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 transition-all ${view === ViewState.Study ? 'bg-emerald-50 font-bold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700'}`}>
                        <TrophyIcon className="h-5 w-5" /> Учить
                        {dueCount > 0 && <span className="ml-auto rounded-full bg-rose-500 px-1.5 text-[10px] text-white">{dueCount}</span>}
                    </button>
                    <button onClick={() => setView(ViewState.StoryList)} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 transition-all ${view === ViewState.StoryList || view === ViewState.Story ? 'bg-emerald-50 font-bold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700'}`}>
                        <BookIcon className="h-5 w-5" /> Истории
                    </button>

                    <div className="my-4 border-t border-slate-100 pt-4 dark:border-slate-700">
                        <button onClick={() => setView(ViewState.Create)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-bold text-white shadow-lg transition-all hover:bg-emerald-700">
                            <PlusIcon className="h-5 w-5" /> Добавить слова
                        </button>
                    </div>

                    <div className="mt-auto space-y-2 border-t border-slate-100 pt-4 dark:border-slate-700">
                        <button onClick={toggleTheme} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-500 transition-all hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700">
                            {theme === 'dark' ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
                            {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
                        </button>
                        <button onClick={onLogout} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-rose-500 transition-all hover:bg-rose-50 dark:hover:bg-rose-900/20">
                            Выйти
                        </button>
                    </div>
                </nav>

                <div className="p-6">
                    <div className="mb-2 flex items-end justify-between">
                        <div className="flex items-center gap-1 font-bold text-amber-500"><FireIcon className="h-5 w-5" /><span>{user.streak}</span></div>
                        <p className="text-xs font-bold uppercase text-slate-400">Lvl {user.level}</p>
                    </div>
                    <div className="overflow-hidden rounded-full border border-slate-200 bg-slate-50 p-1 dark:border-slate-600 dark:bg-slate-700">
                        <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${Math.min(((user.xp % 500) / 500) * 100, 100)}%` }}></div>
                    </div>
                </div>
            </aside>

            <main className="relative flex flex-1 flex-col overflow-hidden pb-24 md:pb-0">
                {children}

                <nav className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2 md:hidden">
                    <div className="mx-auto grid max-w-md grid-cols-5 items-end rounded-[28px] border border-slate-200 bg-white/95 px-2 py-2 shadow-[0_-10px_30px_rgba(15,23,42,0.12)] backdrop-blur dark:border-slate-700 dark:bg-slate-800/95">
                        <button onClick={() => handleViewChange(ViewState.Dashboard)} className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 transition-colors ${view === ViewState.Dashboard ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                            <HomeIcon className="h-5 w-5" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Главная</span>
                        </button>

                        <button onClick={handleStudyOpen} className={`relative flex flex-col items-center gap-1 rounded-2xl px-2 py-2 transition-colors ${view === ViewState.Study ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                            <span className="relative">
                                <TrophyIcon className="h-5 w-5" />
                                {dueCount > 0 && <span className="absolute -right-2 -top-2 min-w-[18px] rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-[18px] text-white">{dueCount}</span>}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider">Учить</span>
                        </button>

                        <button onClick={() => handleViewChange(ViewState.Create)} className="flex flex-col items-center gap-1 rounded-2xl px-2 py-1 text-slate-500 transition-colors hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400">
                            <span className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg transition-transform active:scale-95 ${view === ViewState.Create ? 'bg-emerald-700' : 'bg-emerald-600'}`}>
                                <PlusIcon className="h-6 w-6" />
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider">Создать</span>
                        </button>

                        <button onClick={() => handleViewChange(ViewState.StoryList)} className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 transition-colors ${view === ViewState.StoryList || view === ViewState.Story ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                            <BookIcon className="h-5 w-5" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Истории</span>
                        </button>

                        <button onClick={() => setShowMobileMenu(true)} className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 transition-colors ${showMobileMenu ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                            <SettingsIcon className="h-5 w-5" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Ещё</span>
                        </button>
                    </div>
                </nav>

                {showMobileMenu && (
                    <div className="fixed inset-0 z-[60] bg-slate-950/35 backdrop-blur-sm md:hidden" onClick={() => setShowMobileMenu(false)}>
                        <div className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] mx-auto max-w-md rounded-[28px] border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-700 dark:bg-slate-800" onClick={(e) => e.stopPropagation()}>
                            <button onClick={handleThemeToggle} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-slate-600 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700">
                                {theme === 'dark' ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
                                <span className="font-semibold">{theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}</span>
                            </button>
                            <button onClick={handleLogout} className="mt-1 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-rose-500 transition-colors hover:bg-rose-50 dark:hover:bg-rose-900/20">
                                <XIcon className="h-5 w-5" />
                                <span className="font-semibold">Выйти</span>
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Layout;
