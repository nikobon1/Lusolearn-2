import React from 'react';
import { Flashcard } from '../types';
import { XIcon } from './Icons';

interface WordListModalProps {
    title: string;
    cards: Flashcard[];
    onClose: () => void;
    onCardClick: (id: string) => void;
}

const WordListModal: React.FC<WordListModalProps> = ({ title, cards, onClose, onCardClick }) => {
    return (
        <div className="absolute inset-0 z-[70] bg-white dark:bg-slate-800 flex flex-col animate-in slide-in-from-bottom duration-300 md:animate-in md:fade-in md:zoom-in md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[500px] md:h-[600px] md:rounded-2xl md:shadow-2xl md:border md:border-slate-200 dark:md:border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 shadow-sm z-10">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">{title} ({cards.length})</h2>
                <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600">
                    <XIcon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50 dark:bg-slate-900">
                {cards.length === 0 ? (
                    <p className="text-center text-slate-400 mt-10">Список пуст.</p>
                ) : (
                    cards.map(card => (
                        <div 
                            key={card.id} 
                            onClick={() => onCardClick(card.id)}
                            className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex justify-between items-center cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors"
                        >
                            <div>
                                <p className="font-bold text-slate-800 dark:text-slate-200">{card.originalTerm}</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{card.translation}</p>
                            </div>
                            {card.interval > 0 ? (
                                <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded-full">
                                    {card.interval}д
                                </span>
                            ) : (
                                <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] font-bold rounded-full">
                                    New
                                </span>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default WordListModal;