import React from 'react';
import { UserProfile, ViewState } from '../types';
import { 
    HomeIcon, PlusIcon, BookIcon, TrophyIcon, 
    FireIcon, SunIcon, MoonIcon, XIcon, BrainIcon
} from './Icons';

interface LayoutProps {
    children: React.ReactNode;
    view: ViewState;
    setView: (view: ViewState) => void;
    user: UserProfile;
    theme: 'light' | 'dark';
    toggleTheme: () => void;
    onLogout: () => void;
    dueCount: number;
}

const Layout: React.FC<LayoutProps> = ({ 
    children, view, setView, user, theme, toggleTheme, onLogout, dueCount 
}) => {
    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-sans overflow-hidden transition-colors">
            
            {/* DESKTOP SIDEBAR */}
            <aside className="hidden md:flex w-64 flex-col bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 z-30 flex-shrink-0">
                <div className="p-6 flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30">
                        <BrainIcon className="w-6 h-6" />
                    </div>
                    <h1 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight serif">LusoLearn</h1>
                </div>
                
                <nav className="flex-1 px-4 space-y-2 mt-4">
                    <button onClick={() => setView(ViewState.Dashboard)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === ViewState.Dashboard ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                        <HomeIcon className="w-5 h-5" /> Главная
                    </button>
                    <button onClick={() => setView(ViewState.Create)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === ViewState.Create ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                        <PlusIcon className="w-5 h-5" /> Создать
                    </button>
                    <button onClick={() => setView(ViewState.Study)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === ViewState.Study ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                        <TrophyIcon className="w-5 h-5" /> Учить {dueCount > 0 && <span className="ml-auto bg-rose-500 text-white text-[10px] px-1.5 rounded-full">{dueCount}</span>}
                    </button>
                    <button onClick={() => setView(ViewState.StoryList)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === ViewState.StoryList || view === ViewState.Story ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                        <BookIcon className="w-5 h-5" /> Истории
                    </button>

                    {/* Add Words Button inside Sidebar */}
                    <div className="my-4 border-t border-slate-100 dark:border-slate-700 pt-4">
                        <button onClick={() => setView(ViewState.Create)} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg hover:bg-emerald-700 flex items-center justify-center gap-2 transition-all">
                            <PlusIcon className="w-5 h-5" /> Добавить слова
                        </button>
                    </div>

                    <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-700 space-y-2">
                        <button onClick={toggleTheme} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all text-sm font-medium">
                            {theme === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
                            {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
                        </button>
                        <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all text-sm font-bold">
                            Выйти
                        </button>
                    </div>
                </nav>
                
                <div className="p-6">
                    <div className="flex justify-between items-end mb-2">
                        <div className="flex items-center text-amber-500 font-bold gap-1"><FireIcon className="w-5 h-5" /><span>{user.streak}</span></div>
                        <p className="text-xs text-slate-400 uppercase font-bold">Lvl {user.level}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-700 p-1 rounded-full border border-slate-200 dark:border-slate-600 overflow-hidden">
                        <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${Math.min(((user.xp % 500) / 500) * 100, 100)}%` }}></div>
                    </div>
                </div>
            </aside>

            {/* MAIN CONTENT AREA */}
            <main className="flex-1 flex flex-col relative overflow-hidden">
                {children}

                {/* MOBILE BOTTOM NAV */}
                <nav className="md:hidden absolute bottom-0 left-0 w-full bg-white/90 dark:bg-slate-800/90 backdrop-blur border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex justify-between items-center z-50">
                    <button onClick={() => setView(ViewState.Dashboard)} className={`flex flex-col items-center ${view === ViewState.Dashboard ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}><HomeIcon className="w-6 h-6 mb-1" /><span className="text-[10px] font-bold uppercase tracking-wider">Главная</span></button>
                    <button onClick={() => setView(ViewState.Create)} className="flex flex-col items-center text-slate-400 hover:text-emerald-600 transition-colors">
                        <div className="w-12 h-12 -mt-8 bg-emerald-600 text-white rounded-full shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30 flex items-center justify-center transform transition-transform active:scale-95 border-4 border-slate-50 dark:border-slate-900"><PlusIcon className="w-6 h-6" /></div>
                    </button>
                    <button onClick={onLogout} className="flex flex-col items-center text-slate-400 hover:text-rose-600 transition-colors"><XIcon className="w-6 h-6 mb-1" /><span className="text-[10px] font-bold uppercase tracking-wider">Выйти</span></button>
                </nav>
            </main>
        </div>
    );
};

export default Layout;