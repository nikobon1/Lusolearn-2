import React, { useState, useMemo } from 'react';
import { Folder } from '../types';
import { BookIcon, XIcon, PlusIcon } from './Icons';

interface StoryConfigModalProps {
    folders: Folder[];
    currentFolderId: string;
    totalCards: number;
    onClose: () => void;
    onGoToCreate: () => void;
    onStart: (config: { count: number; source: 'folder' | 'frequency' | 'recent'; folderId?: string; frequency?: string; recentDays?: number }) => void;
}

const StoryConfigModal: React.FC<StoryConfigModalProps> = ({ folders, currentFolderId, totalCards, onClose, onGoToCreate, onStart }) => {
    const [count, setCount] = useState(3);
    const [source, setSource] = useState<'folder' | 'frequency' | 'recent'>('folder');
    const [selectedFolder, setSelectedFolder] = useState(currentFolderId === 'all' ? 'all' : currentFolderId);
    const [selectedFreq, setSelectedFreq] = useState('Top 500');
    const [recentDays, setRecentDays] = useState<number>(7);

    const freqOptions = ["Top 500", "Top 1000", "Top 3000", "Top 5000"];

    const uniqueFolders = useMemo(() => {
        const seen = new Set<string>();
        const result: Folder[] = [];
        const sortedInput = [...folders].sort((a, b) => a.name.localeCompare(b.name));
        for (const f of sortedInput) {
            const lowerName = f.name.toLowerCase();
            if (!seen.has(lowerName)) {
                seen.add(lowerName);
                result.push(f);
            }
        }
        return result;
    }, [folders]);

    if (totalCards < 3) {
        return (
            <div className="absolute inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm p-8 shadow-2xl animate-in fade-in zoom-in duration-200 text-center">
                    <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600 dark:text-amber-400">
                        <BookIcon className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Начните с малого</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed">
                        Чтобы ИИ мог сочинить историю, нам нужно хотя бы 3 слова. В вашем словаре пока пустовато. Добавим первые слова?
                    </p>
                    <div className="space-y-3">
                        <button 
                            onClick={() => { onClose(); onGoToCreate(); }}
                            className="w-full py-3.5 bg-emerald-600 text-white font-bold rounded-xl shadow-lg hover:bg-emerald-700 transition-all"
                        >
                            <PlusIcon className="w-5 h-5 inline-block mr-2" />
                            Добавить слова
                        </button>
                        <button onClick={onClose} className="w-full py-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm font-bold">
                            Позже
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="absolute inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2"><BookIcon className="w-5 h-5 text-amber-600" /> Параметры истории</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><XIcon className="w-5 h-5" /></button>
                </div>

                <div className="mb-6">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Откуда брать слова?</label>
                    <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg mb-4">
                        <button onClick={() => setSource('folder')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${source === 'folder' ? 'bg-white dark:bg-slate-600 text-emerald-600 dark:text-emerald-400 shadow' : 'text-slate-500 dark:text-slate-400'}`}>Папки</button>
                        <button onClick={() => setSource('frequency')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${source === 'frequency' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow' : 'text-slate-500 dark:text-slate-400'}`}>Частота</button>
                        <button onClick={() => setSource('recent')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${source === 'recent' ? 'bg-white dark:bg-slate-600 text-amber-600 dark:text-amber-400 shadow' : 'text-slate-500 dark:text-slate-400'}`}>Недавние</button>
                    </div>

                    {source === 'folder' && (
                        <select 
                            value={selectedFolder} 
                            onChange={(e) => setSelectedFolder(e.target.value)}
                            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-600 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        >
                            <option value="all">Все папки</option>
                            <option value="default">Без категории</option>
                            {uniqueFolders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                    )}

                    {source === 'frequency' && (
                        <div className="grid grid-cols-2 gap-2">
                            {freqOptions.map(f => (
                                <button 
                                    key={f} 
                                    onClick={() => setSelectedFreq(f)}
                                    className={`py-2 rounded-lg text-xs font-bold border transition-all ${selectedFreq === f ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-400' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    )}

                    {source === 'recent' && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 rounded-xl">
                            <p className="text-xs font-bold text-amber-800 dark:text-amber-200 mb-2 uppercase">За какой период?</p>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setRecentDays(1)}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all border ${recentDays === 1 ? 'bg-amber-500 text-white border-amber-500 shadow-md' : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-amber-300'}`}
                                >
                                    24 часа
                                </button>
                                <button 
                                    onClick={() => setRecentDays(7)}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all border ${recentDays === 7 ? 'bg-amber-500 text-white border-amber-500 shadow-md' : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-amber-300'}`}
                                >
                                    7 дней
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mb-8">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Количество слов</label>
                        <span className="text-sm font-bold text-slate-800 dark:text-white bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">{count}</span>
                    </div>
                    <input 
                        type="range" min="2" max="10" step="1" 
                        value={count} 
                        onChange={(e) => setCount(parseInt(e.target.value))}
                        className="w-full accent-emerald-600 h-2 bg-slate-100 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer" 
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                        <span>2 (Просто)</span>
                        <span>10 (Сложно)</span>
                    </div>
                </div>

                <button 
                    onClick={() => onStart({ count, source, folderId: selectedFolder, frequency: selectedFreq, recentDays })}
                    className="w-full py-3.5 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30 hover:bg-emerald-700 transition-all"
                >
                    Создать историю
                </button>
            </div>
        </div>
    );
};

export default StoryConfigModal;