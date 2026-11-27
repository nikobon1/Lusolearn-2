import React, { useState } from 'react';
import type { Topic } from '../domain/frequencyDictionary';

export type StartChoice =
    | { kind: 'basics' }
    | { kind: 'situation'; topic: Topic }
    | { kind: 'placement' }
    | { kind: 'create' }
    | { kind: 'lessons' };

const SITUATIONS: { topic: Topic; label: string; emoji: string }[] = [
    { topic: 'food', label: 'Кафе и еда', emoji: '☕' },
    { topic: 'shop', label: 'Магазин и деньги', emoji: '🛒' },
    { topic: 'transport', label: 'Транспорт и город', emoji: '🚌' },
    { topic: 'health', label: 'Врач и аптека', emoji: '💊' },
    { topic: 'admin', label: 'Документы и работа', emoji: '📄' },
    { topic: 'home', label: 'Дом и жильё', emoji: '🏠' },
    { topic: 'social', label: 'Общение и вежливость', emoji: '💬' },
    { topic: 'time', label: 'Время и погода', emoji: '🌤️' },
];

const Option: React.FC<{ emoji: string; title: string; text: string; badge?: string; open?: boolean; onClick: () => void; children?: React.ReactNode }> = ({ emoji, title, text, badge, open, onClick, children }) => (
    <div className={`rounded-2xl border-2 transition-colors ${open ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-900/10' : 'border-slate-200 dark:border-slate-600'}`}>
        <button onClick={onClick} className="flex w-full items-start gap-3 p-4 text-left">
            <span className="text-2xl">{emoji}</span>
            <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 font-bold text-slate-800 dark:text-white">
                    {title}
                    {badge && <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">{badge}</span>}
                </span>
                <span className="block text-sm text-slate-500 dark:text-slate-400">{text}</span>
            </span>
        </button>
        {open && children && <div className="px-4 pb-4">{children}</div>}
    </div>
);

/** «С чего начнём?» — four ways in, for different kinds of beginners. */
const StartChooser: React.FC<{ onPick: (choice: StartChoice) => void }> = ({ onPick }) => {
    const [open, setOpen] = useState<'situation' | 'own' | null>(null);
    return (
        <div className="space-y-2">
            <Option emoji="🎯" title="Самые нужные слова" badge="для нуля" text="Частотный словарь: от самых частых слов к редким, с уклоном в быт." onClick={() => onPick({ kind: 'basics' })} />
            <Option emoji="🧭" title="Конкретная ситуация" text="Нужно срочно: кафе, магазин, врач, документы… Слова темы + готовые фразы." open={open === 'situation'} onClick={() => setOpen(open === 'situation' ? null : 'situation')}>
                <div className="grid grid-cols-2 gap-2">
                    {SITUATIONS.map(s => (
                        <button key={s.topic} onClick={() => onPick({ kind: 'situation', topic: s.topic })} className="rounded-xl bg-white px-3 py-2 text-left text-sm font-bold text-slate-700 shadow-sm hover:bg-emerald-50 dark:bg-slate-700 dark:text-slate-200">
                            {s.emoji} {s.label}
                        </button>
                    ))}
                </div>
            </Option>
            <Option emoji="📈" title="Я уже знаю основы" text="Проверка за 2 минуты: отметим знакомые слова и начнём с первого пробела." onClick={() => onPick({ kind: 'placement' })} />
            <Option emoji="📚" title="Свои материалы" text="Учебник, курс, сериал — добавьте свои слова, текст или видео." open={open === 'own'} onClick={() => setOpen(open === 'own' ? null : 'own')}>
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => onPick({ kind: 'create' })} className="rounded-xl bg-white px-3 py-2 text-left text-sm font-bold text-slate-700 shadow-sm hover:bg-emerald-50 dark:bg-slate-700 dark:text-slate-200">➕ Слова или текст</button>
                    <button onClick={() => onPick({ kind: 'lessons' })} className="rounded-xl bg-white px-3 py-2 text-left text-sm font-bold text-slate-700 shadow-sm hover:bg-emerald-50 dark:bg-slate-700 dark:text-slate-200">🎬 Видео по расшифровке</button>
                </div>
            </Option>
        </div>
    );
};

export default StartChooser;
