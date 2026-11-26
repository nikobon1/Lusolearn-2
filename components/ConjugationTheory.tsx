import React from 'react';
import { PERSONS, PERSON_LABELS, Tense, conjugate, isIrregularIn } from '../domain/conjugation';
import { MODEL_VERBS, THEORY, TheoryTopic } from '../domain/conjugationTheory';
import { BookIcon, GridIcon } from './Icons';

/** Minimal inline formatting: **bold** and *italic*. */
const Rich: React.FC<{ text: string }> = ({ text }) => {
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
    return (
        <>
            {parts.map((p, i) => p.startsWith('**')
                ? <b key={i} className="text-slate-800 dark:text-white">{p.slice(2, -2)}</b>
                : p.startsWith('*') ? <i key={i} className="font-serif text-indigo-700 dark:text-indigo-300">{p.slice(1, -1)}</i>
                : <React.Fragment key={i}>{p}</React.Fragment>)}
        </>
    );
};

/** Regular endings for -ar / -er / -ir, with the ending highlighted. */
const ModelTable: React.FC<{ tense: Tense }> = ({ tense }) => (
    <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] text-sm">
            <thead>
                <tr className="text-left text-xs text-slate-400">
                    <th className="py-1 pr-3 font-medium" />
                    {MODEL_VERBS.map(v => <th key={v} className="py-1 pr-3 font-bold text-slate-600 dark:text-slate-300">{v}</th>)}
                </tr>
            </thead>
            <tbody>
                {PERSONS.map(p => (
                    <tr key={p} className="border-t border-slate-100 dark:border-slate-700">
                        <td className="py-1.5 pr-3 text-slate-400">{PERSON_LABELS[p].pt.split(' / ')[0]}</td>
                        {MODEL_VERBS.map(v => {
                            const form = conjugate(v)![tense][p];
                            const stem = tense === 'futuro' ? v : v.slice(0, -2);
                            return (
                                <td key={v} className="py-1.5 pr-3 font-serif text-base text-slate-700 dark:text-slate-200">
                                    {stem}<b className="text-indigo-600 dark:text-indigo-300">{form.slice(stem.length)}</b>
                                </td>
                            );
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const VerbCard: React.FC<{ verb: string; tense: Tense }> = ({ verb, tense }) => {
    const table = conjugate(verb);
    if (!table) return null;
    const irregular = isIrregularIn(verb, tense);
    return (
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-700/40">
            <p className="mb-1 font-serif font-bold text-slate-800 dark:text-white">
                {verb} {irregular && <span className="ml-1 rounded bg-amber-100 px-1 font-sans text-[10px] font-bold uppercase text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">неправ.</span>}
            </p>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {PERSONS.map(p => table[tense][p]).join(' · ')}
            </p>
        </div>
    );
};

const Section: React.FC<{ topic: TheoryTopic }> = ({ topic }) => (
    <div className="space-y-4">
        {topic.blocks.map((block, i) => (
            <section key={i} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
                <h4 className="font-bold text-slate-800 dark:text-white">{block.title}</h4>
                {block.text?.map((t, j) => <p key={j} className="leading-relaxed text-slate-600 dark:text-slate-300"><Rich text={t} /></p>)}
                {block.examples && (
                    <ul className="space-y-1 rounded-xl bg-indigo-50/60 p-3 dark:bg-indigo-900/10">
                        {block.examples.map(([pt, ru], j) => (
                            <li key={j}><span className="font-serif text-slate-800 dark:text-slate-100">{pt}</span> <span className="text-sm text-slate-500">— {ru}</span></li>
                        ))}
                    </ul>
                )}
                {block.modelTable && topic.tense && <ModelTable tense={topic.tense} />}
                {block.verbs && topic.tense && (
                    <div className="grid gap-2 sm:grid-cols-2">
                        {block.verbs.map(v => <VerbCard key={v} verb={v} tense={topic.tense!} />)}
                    </div>
                )}
            </section>
        ))}
    </div>
);

interface Props {
    openId: TheoryTopic['id'] | null;
    onOpen: (id: TheoryTopic['id'] | null) => void;
    onPractice: (tense: Tense) => void;
}

const ConjugationTheory: React.FC<Props> = ({ openId, onOpen, onPractice }) => {
    const topic = THEORY.find(t => t.id === openId);

    if (topic) {
        return (
            <div className="space-y-4">
                <button onClick={() => onOpen(null)} className="text-sm font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400">← Все темы</button>
                <header>
                    <h3 className="serif text-2xl font-bold text-slate-800 dark:text-white">{topic.title}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{topic.subtitle}</p>
                </header>
                <Section topic={topic} />
                {topic.tense ? (
                    <button onClick={() => onPractice(topic.tense!)} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-4 text-lg font-bold text-white shadow-lg hover:bg-indigo-700">
                        <GridIcon className="h-5 w-5" /> Практиковать: {topic.title.split(' — ')[0]}
                    </button>
                ) : (
                    <button onClick={() => onOpen('presente')} className="w-full rounded-2xl bg-indigo-600 py-4 text-lg font-bold text-white shadow-lg hover:bg-indigo-700">
                        Дальше: Presente →
                    </button>
                )}
            </div>
        );
    }

    return (
        <ul className="space-y-2">
            {THEORY.map((t, i) => (
                <li key={t.id}>
                    <button onClick={() => onOpen(t.id)} className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                            {i === 0 ? <BookIcon className="h-5 w-5" /> : i}
                        </span>
                        <span>
                            <span className="block font-bold text-slate-800 dark:text-white">{t.title}</span>
                            <span className="block text-sm text-slate-500 dark:text-slate-400">{t.subtitle}</span>
                        </span>
                    </button>
                </li>
            ))}
        </ul>
    );
};

export default ConjugationTheory;
