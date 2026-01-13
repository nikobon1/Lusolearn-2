import React from 'react';
import { Quest } from '../types';
import { TargetIcon, CheckCircleIcon } from './Icons';

interface DailyQuestsWidgetProps {
    quests?: Quest[];
}

const DailyQuestsWidget: React.FC<DailyQuestsWidgetProps> = ({ quests }) => {
    if (!quests || quests.length === 0) return null;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 relative overflow-hidden">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <TargetIcon className="w-5 h-5 text-amber-500" /> Цели на сегодня
                </h3>
                <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-1 rounded-lg font-bold">
                    {quests.filter(q => q.completed).length}/{quests.length}
                </span>
            </div>
            <div className="space-y-4">
                {quests.map(quest => (
                    <div key={quest.id}>
                        <div className="flex justify-between items-center mb-1.5">
                            <span className={`text-sm font-medium ${quest.completed ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-700 dark:text-slate-200'}`}>{quest.description}</span>
                            {quest.completed ? (
                                <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
                            ) : (
                                <span className="text-xs font-bold text-amber-500">+{quest.xpReward} XP</span>
                            )}
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                            <div 
                                className={`h-full rounded-full transition-all duration-500 ${quest.completed ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
                                style={{ width: `${Math.min((quest.progress / quest.target) * 100, 100)}%` }}
                            ></div>
                        </div>
                        <div className="text-[10px] text-right mt-1 text-slate-400">
                            {Math.min(quest.progress, quest.target)}/{quest.target}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DailyQuestsWidget;