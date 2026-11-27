import React, { useState } from 'react';
import { PlanSettings } from '../domain/dailyPlan';
import type { CefrLevel } from '../domain/reviewExercise';
import StartChooser, { StartChoice } from './StartChooser';

interface Props {
    settings: PlanSettings;
    hasCards: boolean;
    onChangeSettings: (patch: Partial<PlanSettings>) => void;
    /** Closes the walkthrough: back to the home screen, or into the chosen way to start */
    onFinish: (goTo: 'dashboard' | StartChoice) => void;
}

const LEVELS: { id: string; label: string; hint: string; level: CefrLevel }[] = [
    { id: 'zero', label: 'Совсем с нуля', hint: 'Знаю пару слов или ничего', level: 'A1' },
    { id: 'basic', label: 'Знаю основы', hint: 'Olá, obrigado, um café…', level: 'A1' },
    { id: 'a2', label: 'Объясняюсь в быту', hint: 'Магазин, кафе, транспорт', level: 'A2' },
    { id: 'b1', label: 'Говорю на простые темы', hint: 'Могу поддержать разговор', level: 'B1' },
];

const PACES: { n: number; label: string; time: string }[] = [
    { n: 5, label: 'Спокойно', time: '~10 мин в день' },
    { n: 10, label: 'Обычно', time: '~15 мин в день' },
    { n: 20, label: 'Интенсивно', time: '~25 мин в день' },
];

const Choice: React.FC<{ active: boolean; onClick: () => void; title: string; hint: string }> = ({ active, onClick, title, hint }) => (
    <button
        onClick={onClick}
        className={`w-full rounded-2xl border-2 px-4 py-3 text-left transition-colors ${active ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-200 hover:border-slate-300 dark:border-slate-600'}`}
    >
        <span className="block font-bold text-slate-800 dark:text-white">{title}</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span>
    </button>
);

const Point: React.FC<{ icon: string; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
    <li className="flex gap-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg dark:bg-slate-700">{icon}</span>
        <span>
            <span className="block font-bold text-slate-800 dark:text-white">{title}</span>
            <span className="block text-sm text-slate-500 dark:text-slate-400">{children}</span>
        </span>
    </li>
);

/**
 * First-run walkthrough: what the app is, a quick personal setup (level, pace),
 * how a day works, where words come from, how to answer. Can be reopened from the menu.
 */
const Onboarding: React.FC<Props> = ({ settings, hasCards, onChangeSettings, onFinish }) => {
    const [step, setStep] = useState(0);
    const [levelId, setLevelId] = useState<string>(() => LEVELS.find(l => l.level === settings.level)?.id || 'zero');

    const steps: { title: string; body: React.ReactNode }[] = [
        {
            title: 'Olá! 👋',
            body: (
                <div className="space-y-3 text-slate-600 dark:text-slate-300">
                    <p className="text-lg">LusoLearn помогает выучить <b>европейский португальский</b> для жизни: магазин, кафе, врач, документы, разговоры с соседями.</p>
                    <p>Главная идея — <b>интервальные повторения</b>: приложение показывает слово как раз тогда, когда вы начинаете его забывать. Так слова уходят в долгую память, а занятие занимает 10–20 минут в день.</p>
                    <p className="text-sm text-slate-400">Займёт минуту: настроим темп и покажем, где что.</p>
                </div>
            ),
        },
        {
            title: 'Ваш уровень',
            body: (
                <div className="space-y-2">
                    <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">От этого зависят примеры в упражнениях. Поменять можно в любой момент (⚙️ в «Занятии на сегодня»).</p>
                    {LEVELS.map(l => (
                        <Choice key={l.id} active={levelId === l.id} title={l.label} hint={l.hint}
                            onClick={() => { setLevelId(l.id); onChangeSettings({ level: l.level }); }} />
                    ))}
                </div>
            ),
        },
        {
            title: 'Сколько новых слов в день?',
            body: (
                <div className="space-y-2">
                    <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">Каждое новое слово потом вернётся на повторение ещё 5–8 раз за несколько недель. Лучше меньше, но каждый день.</p>
                    {PACES.map(p => (
                        <Choice key={p.n} active={settings.newPerDay === p.n} title={`${p.label} · ${p.n} слов`} hint={p.time}
                            onClick={() => onChangeSettings({ newPerDay: p.n })} />
                    ))}
                </div>
            ),
        },
        {
            title: 'Как устроен день',
            body: (
                <div className="space-y-4">
                    <p className="text-slate-600 dark:text-slate-300">На главной — <b>«Занятие на сегодня»</b>. Просто нажимайте большую зелёную кнопку: она сама ведёт по шагам.</p>
                    <ul className="space-y-3">
                        <Point icon="🔁" title="Повторить слова">Те, что пора вспомнить сегодня — самое важное.</Point>
                        <Point icon="✨" title="Новые слова">Небольшая порция по вашему темпу.</Point>
                        <Point icon="💬" title="Сказать фразами">5 готовых фраз для жизни: «Queria um café, se faz favor».</Point>
                        <Point icon="🔤" title="Глаголы">5 форм глаголов — через день.</Point>
                        <Point icon="📖" title="История (по желанию)">Короткий рассказ из ваших слов — сериал «Vida em Lisboa» про жизнь в Лиссабоне с соседкой Ana. Слова, которые вы сейчас учите, встречаются в живом тексте — так они запоминаются крепче.</Point>
                    </ul>
                </div>
            ),
        },
        {
            title: 'Откуда берутся слова',
            body: (
                <ul className="space-y-3">
                    <Point icon="🎯" title="«С нуля»">Самые частые слова португальского, по порядку и с уклоном в быт. Начните отсюда: первая 1000 слов покрывает большую часть обычной речи.</Point>
                    <Point icon="➕" title="«Создать»">Свои слова: услышали в магазине — добавили. Перевод, примеры и картинку приложение сделает само.</Point>
                    <Point icon="🎬" title="Видеоуроки">Вставьте расшифровку видео — получите слова из него с примерами из фильма.</Point>
                    <Point icon="⏸️" title="Пауза">Ненужные слова можно убрать из повторений: «Выучено» → «Выбрать» → «На паузу».</Point>
                </ul>
            ),
        },
        {
            title: 'Истории',
            body: (
                <div className="space-y-4">
                    <p className="text-slate-600 dark:text-slate-300">Чтение — второй способ закреплять слова. Каждая история — серия сериала <b>«Vida em Lisboa»</b>: вы недавно переехали в Лиссабон, рядом соседка Ana, кафе Sr. Manuel, рынок, трамвай 28.</p>
                    <ul className="space-y-3">
                        <Point icon="🎯" title="Из ваших слов">В текст попадают слова, которые сейчас закрепляются, а остальное написано словами, которые вы уже знаете. Сверху видно: «Вы знаете 92% слов». Сложно — кнопка «проще».</Point>
                        <Point icon="👆" title="Нажмите на слово">Покажется перевод, а незнакомое слово можно сразу добавить в карточки — с примером из истории. 🔊 у предложения — послушать и увидеть перевод.</Point>
                        <Point icon="❓" title="Проверьте себя">После текста — 3 вопроса и один ответ вслух: приложение подскажет, как сказать правильнее.</Point>
                    </ul>
                    <p className="text-sm text-slate-400">Найти: шаг «Прочитать историю» в «Занятии на сегодня» или меню → «Истории».</p>
                </div>
            ),
        },
        {
            title: 'Как отвечать',
            body: (
                <div className="space-y-4">
                    <ul className="space-y-3">
                        <Point icon="🃏" title="Карточка">Вспомните ответ, нажмите на карточку — она перевернётся. На обороте перевод, примеры и место слова в частотном словаре (#115).</Point>
                        <Point icon="🎤" title="Печатать или говорить">В заданиях можно напечатать ответ или сказать вслух. Говорите, сделайте паузу — приложение проверит само.</Point>
                        <Point icon="✅" title="Честная оценка">«Не вспомнил», «С трудом», «Вспомнил» или «Легко». От неё зависит, когда слово вернётся. Ошибаться — нормально: так и запоминается.</Point>
                    </ul>
                </div>
            ),
        },
        hasCards
            ? {
                title: 'Всё готово!',
                body: (
                    <div className="space-y-3 text-slate-600 dark:text-slate-300">
                        <p>Ваши карточки на месте. Нажмите <b>«Начать»</b> в «Занятии на сегодня» — и вперёд.</p>
                        <p className="text-sm text-slate-400">Это объяснение можно открыть снова: меню → «Как это работает».</p>
                    </div>
                ),
            }
            : {
                title: 'С чего начнём?',
                body: (
                    <div className="space-y-3">
                        <p className="text-sm text-slate-500 dark:text-slate-400">Выберите, что вам ближе. Остальное останется доступно в меню.</p>
                        <StartChooser onPick={choice => onFinish(choice)} />
                    </div>
                ),
            },
    ];

    const last = step === steps.length - 1;
    const current = steps[step];

    return (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/50 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Как устроено приложение">
            <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl dark:bg-slate-800 sm:rounded-3xl">
                <div className="flex items-center gap-2 px-6 pt-5">
                    {steps.map((_, i) => (
                        <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                    ))}
                    <button onClick={() => onFinish('dashboard')} className="ml-2 text-sm font-medium text-slate-400 hover:text-slate-600">Пропустить</button>
                </div>
                <div key={step} className="flex-1 overflow-y-auto px-6 pb-4 pt-5 animate-in fade-in slide-in-from-right-4 duration-300">
                    <h2 className="mb-4 font-serif text-2xl font-bold text-slate-800 dark:text-white">{current.title}</h2>
                    {current.body}
                </div>
                <div className="flex gap-2 border-t border-slate-100 p-4 dark:border-slate-700">
                    {step > 0 && (
                        <button onClick={() => setStep(s => s - 1)} className="rounded-2xl bg-slate-100 px-5 py-3 font-bold text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300">Назад</button>
                    )}
                    {last && !hasCards ? (
                        <button onClick={() => onFinish('dashboard')} className="flex-1 rounded-2xl py-3 font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700">
                            Решу позже
                        </button>
                    ) : (
                        <button
                            onClick={() => (last ? onFinish('dashboard') : setStep(s => s + 1))}
                            className="flex-1 rounded-2xl bg-emerald-600 py-3 font-bold text-white shadow-lg hover:bg-emerald-700"
                        >
                            {last ? 'К занятию' : step === 0 ? 'Поехали' : 'Дальше'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Onboarding;
