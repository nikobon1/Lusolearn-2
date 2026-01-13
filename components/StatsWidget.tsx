import React, { useState } from 'react';
import { Flashcard, UserProfile } from '../types';
import { ChartIcon } from './Icons';

interface StatsWidgetProps {
    cards: Flashcard[];
    user: UserProfile;
    onOpenList: (type: 'learned' | 'learning') => void;
}

const StatsWidget: React.FC<StatsWidgetProps> = ({ cards, user, onOpenList }) => {
    const [range, setRange] = useState<'7d' | '30d'>('7d');
    
    const days = range === '7d' ? 7 : 30;
    const now = new Date();
    
    const cutoffDate = new Date();
    cutoffDate.setDate(now.getDate() - days);
    const addedCount = cards.filter(c => c.createdAt >= cutoffDate.getTime()).length;
    const learnedCountTotal = cards.filter(c => c.interval > 0).length;

    const graphData = [];
    let maxVal = 0;
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const key = d.toISOString().split('T')[0];
        const val = user.learningHistory[key] || 0;
        if (val > maxVal) maxVal = val;
        graphData.push(val);
    }
    
    const points = graphData.map((val, idx) => {
        const x = (idx / (days - 1)) * 100;
        const y = maxVal > 0 ? 50 - ((val / maxVal) * 40) : 50; 
        return `${x},${y}`;
    }).join(' ');

    const areaPath = `M0,50 ${points} L100,50 Z`;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 relative overflow-hidden">
             <div className="flex justify-between items-center mb-6">
                 <div className="flex items-center gap-2">
                     <ChartIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                     <h3 className="font-bold text-slate-800 dark:text-white">Статистика</h3>
                 </div>
                 <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
                     <button 
                        onClick={() => setRange('7d')}
                        className={`text-[10px] font-bold px-2 py-1 rounded-md transition-all ${range === '7d' ? 'bg-white dark:bg-slate-600 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}
                     >
                         7 дн
                     </button>
                     <button 
                        onClick={() => setRange('30d')}
                        className={`text-[10px] font-bold px-2 py-1 rounded-md transition-all ${range === '30d' ? 'bg-white dark:bg-slate-600 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}
                     >
                         30 дн
                     </button>
                 </div>
             </div>

             <div className="flex gap-6 mb-6">
                 <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-700 flex-1">
                     <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Добавлено</p>
                     <p className="text-2xl font-bold text-slate-800 dark:text-white">{addedCount}</p>
                     <p className="text-[10px] text-slate-400">за {days} дней</p>
                 </div>
                 <div 
                    onClick={() => onOpenList('learned')}
                    className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/30 flex-1 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                 >
                     <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 uppercase font-bold mb-1">Выучено слов</p>
                     <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{learnedCountTotal}</p>
                     <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70">всего</p>
                 </div>
             </div>
             
             <div className="relative h-24 w-full">
                 {maxVal > 0 ? (
                    <svg viewBox="0 0 100 50" className="w-full h-full preserve-3d" preserveAspectRatio="none">
                        <defs>
                            <linearGradient id="grad" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor="#10b981" stopOpacity="0.2"/>
                                <stop offset="100%" stopColor="#10b981" stopOpacity="0"/>
                            </linearGradient>
                        </defs>
                        <path d={areaPath} fill="url(#grad)" />
                        <polyline points={points} fill="none" stroke="#10b981" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                 ) : (
                     <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-300 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                         Нет активности за этот период
                     </div>
                 )}
                 <div className="absolute bottom-0 left-0 right-0 h-px bg-slate-100 dark:bg-slate-700"></div>
             </div>

             <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 text-center">
                 <button onClick={() => onOpenList('learning')} className="text-xs font-bold text-slate-400 hover:text-emerald-600 transition-colors">
                     Показать невыученные ({cards.length - learnedCountTotal})
                 </button>
             </div>
        </div>
    );
};

export default StatsWidget;