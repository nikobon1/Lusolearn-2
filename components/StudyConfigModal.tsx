import React, { useState } from 'react';
import { XIcon } from './Icons';

interface StudyConfigModalProps {
    onClose: () => void;
    onStart: (mode: 'srs' | 'frequency', filters: Set<string>) => void;
}

const StudyConfigModal: React.FC<StudyConfigModalProps> = ({ onClose, onStart }) => {
    const [mode, setMode] = useState<'srs' | 'frequency'>('srs');
    const [selectedFilters, setSelectedFilters] = useState<Set<string>>(new Set());

    const toggleFilter = (f: string) => {
        const newSet = new Set(selectedFilters);
        if (newSet.has(f)) newSet.delete(f);
        else newSet.add(f);
        setSelectedFilters(newSet);
    };

    const buckets = ["Top 500", "Top 1000", "Top 3000", "Top 5000", "10000+"];

    return (
        <div className="absolute inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Настройки обучения</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><XIcon className="w-5 h-5" /></button>
                </div>

                <div className="space-y-4 mb-8">
                    <div 
                        onClick={() => setMode('srs')}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${mode === 'srs' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                    >
                        <h4 className={`font-bold ${mode === 'srs' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>Интервальное повторение</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Умный алгоритм. Показывает только те слова, которые пора повторить.</p>
                    </div>

                    <div 
                        onClick={() => setMode('frequency')}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${mode === 'frequency' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                    >
                        <h4 className={`font-bold ${mode === 'frequency' ? 'text-blue-700 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>По частотности</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Учить слова от самых частых к редким. Выберите диапазоны:</p>
                        
                        {mode === 'frequency' && (
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                {buckets.map(b => (
                                    <div 
                                        key={b} 
                                        onClick={(e) => { e.stopPropagation(); toggleFilter(b); }}
                                        className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors flex items-center gap-2 cursor-pointer select-none ${selectedFilters.has(b) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-500'}`}
                                    >
                                        <div className={`w-3 h-3 rounded-full border border-white dark:border-slate-800 flex-shrink-0 ${selectedFilters.has(b) ? 'bg-white' : 'bg-transparent'}`}></div>
                                        {b}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <button 
                    onClick={() => onStart(mode, selectedFilters)}
                    disabled={mode === 'frequency' && selectedFilters.size === 0}
                    className="w-full py-3.5 bg-slate-900 dark:bg-emerald-600 text-white font-bold rounded-xl hover:bg-slate-800 dark:hover:bg-emerald-700 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Начать сессию
                </button>
             </div>
        </div>
    );
};

export default StudyConfigModal;