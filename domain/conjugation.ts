/**
 * European Portuguese conjugator for the trainer: presente, pretérito perfeito,
 * pretérito imperfeito and futuro do presente; persons eu / tu / ele / nós / eles.
 * Regular -ar/-er/-ir rules + spelling changes + hand-written irregular forms,
 * so the trainer never relies on AI-generated tables.
 */

export type Person = 'eu' | 'tu' | 'ele' | 'nos' | 'eles';
export type Tense = 'presente' | 'perfeito' | 'imperfeito' | 'futuro';
export type TenseTable = Record<Person, string>;
export type Conjugation = Record<Tense, TenseTable>;

export const PERSONS: Person[] = ['eu', 'tu', 'ele', 'nos', 'eles'];
export const TENSES: Tense[] = ['presente', 'perfeito', 'imperfeito', 'futuro'];

export const PERSON_LABELS: Record<Person, { pt: string; ru: string }> = {
    eu: { pt: 'eu', ru: 'я' },
    tu: { pt: 'tu', ru: 'ты' },
    ele: { pt: 'ele / ela / você', ru: 'он / она / вы' },
    nos: { pt: 'nós', ru: 'мы' },
    eles: { pt: 'eles / elas / vocês', ru: 'они / вы (мн.)' },
};

export const TENSE_LABELS: Record<Tense, { pt: string; ru: string; hint: string }> = {
    presente: { pt: 'Presente', ru: 'настоящее', hint: 'что делаю сейчас / обычно' },
    perfeito: { pt: 'Pretérito perfeito', ru: 'прошедшее (сделал)', hint: 'законченное действие: ontem, ontem à noite' },
    imperfeito: { pt: 'Pretérito imperfeito', ru: 'прошедшее (делал, бывало)', hint: 'фон, привычка в прошлом: quando era criança…' },
    futuro: { pt: 'Futuro', ru: 'будущее', hint: 'в речи чаще «vou + инфинитив», но форму полезно узнавать' },
};

type Row = [string, string, string, string, string];
type Override = Partial<Record<Tense, Row | Partial<TenseTable>>>;

const row = (r: Row): TenseTable => ({ eu: r[0], tu: r[1], ele: r[2], nos: r[3], eles: r[4] });

/** Verbs used only in the 3rd person (weather, "happen", "hurt", "há"). */
export const IMPERSONAL = new Set(['haver', 'chover', 'nevar', 'acontecer', 'doer', 'bastar']);

const IRREGULAR: Record<string, Override> = {
    ser: {
        presente: ['sou', 'és', 'é', 'somos', 'são'],
        perfeito: ['fui', 'foste', 'foi', 'fomos', 'foram'],
        imperfeito: ['era', 'eras', 'era', 'éramos', 'eram'],
    },
    estar: {
        presente: ['estou', 'estás', 'está', 'estamos', 'estão'],
        perfeito: ['estive', 'estiveste', 'esteve', 'estivemos', 'estiveram'],
    },
    ter: {
        presente: ['tenho', 'tens', 'tem', 'temos', 'têm'],
        perfeito: ['tive', 'tiveste', 'teve', 'tivemos', 'tiveram'],
        imperfeito: ['tinha', 'tinhas', 'tinha', 'tínhamos', 'tinham'],
    },
    haver: {
        presente: ['hei', 'hás', 'há', 'havemos', 'hão'],
        perfeito: ['houve', 'houveste', 'houve', 'houvemos', 'houveram'],
    },
    ir: {
        presente: ['vou', 'vais', 'vai', 'vamos', 'vão'],
        perfeito: ['fui', 'foste', 'foi', 'fomos', 'foram'],
        imperfeito: ['ia', 'ias', 'ia', 'íamos', 'iam'],
    },
    fazer: {
        presente: ['faço', 'fazes', 'faz', 'fazemos', 'fazem'],
        perfeito: ['fiz', 'fizeste', 'fez', 'fizemos', 'fizeram'],
        futuro: ['farei', 'farás', 'fará', 'faremos', 'farão'],
    },
    dizer: {
        presente: ['digo', 'dizes', 'diz', 'dizemos', 'dizem'],
        perfeito: ['disse', 'disseste', 'disse', 'dissemos', 'disseram'],
        futuro: ['direi', 'dirás', 'dirá', 'diremos', 'dirão'],
    },
    trazer: {
        presente: ['trago', 'trazes', 'traz', 'trazemos', 'trazem'],
        perfeito: ['trouxe', 'trouxeste', 'trouxe', 'trouxemos', 'trouxeram'],
        futuro: ['trarei', 'trarás', 'trará', 'traremos', 'trarão'],
    },
    poder: {
        presente: ['posso', 'podes', 'pode', 'podemos', 'podem'],
        perfeito: ['pude', 'pudeste', 'pôde', 'pudemos', 'puderam'],
    },
    querer: {
        presente: ['quero', 'queres', 'quer', 'queremos', 'querem'],
        perfeito: ['quis', 'quiseste', 'quis', 'quisemos', 'quiseram'],
    },
    saber: {
        presente: { eu: 'sei' },
        perfeito: ['soube', 'soubeste', 'soube', 'soubemos', 'souberam'],
    },
    caber: {
        presente: { eu: 'caibo' },
        perfeito: ['coube', 'coubeste', 'coube', 'coubemos', 'couberam'],
    },
    ver: {
        presente: ['vejo', 'vês', 'vê', 'vemos', 'veem'],
        perfeito: ['vi', 'viste', 'viu', 'vimos', 'viram'],
    },
    vir: {
        presente: ['venho', 'vens', 'vem', 'vimos', 'vêm'],
        perfeito: ['vim', 'vieste', 'veio', 'viemos', 'vieram'],
        imperfeito: ['vinha', 'vinhas', 'vinha', 'vínhamos', 'vinham'],
    },
    dar: {
        presente: ['dou', 'dás', 'dá', 'damos', 'dão'],
        perfeito: ['dei', 'deste', 'deu', 'demos', 'deram'],
    },
    'pôr': {
        presente: ['ponho', 'pões', 'põe', 'pomos', 'põem'],
        perfeito: ['pus', 'puseste', 'pôs', 'pusemos', 'puseram'],
        imperfeito: ['punha', 'punhas', 'punha', 'púnhamos', 'punham'],
        futuro: ['porei', 'porás', 'porá', 'poremos', 'porão'],
    },
    supor: {
        presente: ['suponho', 'supões', 'supõe', 'supomos', 'supõem'],
        perfeito: ['supus', 'supuseste', 'supôs', 'supusemos', 'supuseram'],
        imperfeito: ['supunha', 'supunhas', 'supunha', 'supúnhamos', 'supunham'],
    },
    ler: {
        presente: ['leio', 'lês', 'lê', 'lemos', 'leem'],
        perfeito: ['li', 'leste', 'leu', 'lemos', 'leram'],
    },
    crer: {
        presente: ['creio', 'crês', 'crê', 'cremos', 'creem'],
        perfeito: ['cri', 'creste', 'creu', 'cremos', 'creram'],
    },
    rir: { presente: ['rio', 'ris', 'ri', 'rimos', 'riem'] },
    sorrir: { presente: ['sorrio', 'sorris', 'sorri', 'sorrimos', 'sorriem'] },
    sair: {
        presente: ['saio', 'sais', 'sai', 'saímos', 'saem'],
        perfeito: ['saí', 'saíste', 'saiu', 'saímos', 'saíram'],
        imperfeito: ['saía', 'saías', 'saía', 'saíamos', 'saíam'],
    },
    cair: {
        presente: ['caio', 'cais', 'cai', 'caímos', 'caem'],
        perfeito: ['caí', 'caíste', 'caiu', 'caímos', 'caíram'],
        imperfeito: ['caía', 'caías', 'caía', 'caíamos', 'caíam'],
    },
    ouvir: { presente: { eu: 'ouço' } },
    pedir: { presente: { eu: 'peço' } },
    impedir: { presente: { eu: 'impeço' } },
    despedir: { presente: { eu: 'despeço' } },
    medir: { presente: { eu: 'meço' } },
    perder: { presente: { eu: 'perco' } },
    valer: { presente: { eu: 'valho' } },
    dormir: { presente: { eu: 'durmo' } },
    cobrir: { presente: { eu: 'cubro' } },
    descobrir: { presente: { eu: 'descubro' } },
    sentir: { presente: { eu: 'sinto' } },
    mentir: { presente: { eu: 'minto' } },
    preferir: { presente: { eu: 'prefiro' } },
    servir: { presente: { eu: 'sirvo' } },
    vestir: { presente: { eu: 'visto' } },
    despir: { presente: { eu: 'dispo' } },
    repetir: { presente: { eu: 'repito' } },
    divertir: { presente: { eu: 'divirto' } },
    seguir: { presente: { eu: 'sigo' } },
    conseguir: { presente: { eu: 'consigo' } },
    subir: { presente: ['subo', 'sobes', 'sobe', 'subimos', 'sobem'] },
    fugir: { presente: ['fujo', 'foges', 'foge', 'fugimos', 'fogem'] },
    construir: { presente: { tu: 'constróis', ele: 'constrói', eles: 'constroem' } },
    destruir: { presente: { tu: 'destróis', ele: 'destrói', eles: 'destroem' } },
    odiar: { presente: ['odeio', 'odeias', 'odeia', 'odiamos', 'odeiam'] },
    doer: { presente: { ele: 'dói' }, imperfeito: { ele: 'doía', eles: 'doíam' } },
    manter: {
        presente: ['mantenho', 'manténs', 'mantém', 'mantemos', 'mantêm'],
        perfeito: ['mantive', 'mantiveste', 'manteve', 'mantivemos', 'mantiveram'],
        imperfeito: ['mantinha', 'mantinhas', 'mantinha', 'mantínhamos', 'mantinham'],
    },
    obter: {
        presente: ['obtenho', 'obténs', 'obtém', 'obtemos', 'obtêm'],
        perfeito: ['obtive', 'obtiveste', 'obteve', 'obtivemos', 'obtiveram'],
        imperfeito: ['obtinha', 'obtinhas', 'obtinha', 'obtínhamos', 'obtinham'],
    },
};

const futuro = (inf: string): Row => [inf + 'ei', inf + 'ás', inf + 'á', inf + 'emos', inf + 'ão'];

/** Regular conjugation incl. spelling changes (-car/-gar/-çar, -cer/-ger/-gir, -ear, -uir, -uzir). */
const regular = (inf: string): Conjugation | null => {
    const ending = inf.slice(-2);
    const stem = inf.slice(0, -2);
    if (!['ar', 'er', 'ir'].includes(ending)) return null;
    if (!stem && inf !== 'ir') return null; // "ir" has an empty stem; all its forms come from IRREGULAR

    let presente: Row;
    let perfeito: Row;
    let imperfeito: Row;

    if (ending === 'ar') {
        presente = [stem + 'o', stem + 'as', stem + 'a', stem + 'amos', stem + 'am'];
        if (inf.endsWith('ear')) {
            const s = inf.slice(0, -3);
            presente = [s + 'eio', s + 'eias', s + 'eia', s + 'eamos', s + 'eiam'];
        }
        let euPerf = stem + 'ei';
        if (inf.endsWith('car')) euPerf = inf.slice(0, -3) + 'quei';
        else if (inf.endsWith('gar')) euPerf = inf.slice(0, -3) + 'guei';
        else if (inf.endsWith('çar')) euPerf = inf.slice(0, -3) + 'cei';
        perfeito = [euPerf, stem + 'aste', stem + 'ou', stem + 'ámos', stem + 'aram'];
        imperfeito = [stem + 'ava', stem + 'avas', stem + 'ava', stem + 'ávamos', stem + 'avam'];
    } else if (inf.endsWith('uir') && !inf.endsWith('guir') && !inf.endsWith('quir')) {
        // incluir, construir, diminuir ("gu"/"qu" in seguir, conseguir are one sound → regular)
        const base = inf.slice(0, -2);
        presente = [base + 'o', base + 'is', base + 'i', base + 'ímos', base + 'em'];
        perfeito = [base + 'í', base + 'íste', base + 'iu', base + 'ímos', base + 'íram'];
        imperfeito = [base + 'ía', base + 'ías', base + 'ía', base + 'íamos', base + 'íam'];
    } else {
        const isEr = ending === 'er';
        presente = isEr
            ? [stem + 'o', stem + 'es', stem + 'e', stem + 'emos', stem + 'em']
            : [stem + 'o', stem + 'es', stem + 'e', stem + 'imos', stem + 'em'];
        // eu: conheço, protejo, dirijo
        if (/c$/.test(stem)) presente[0] = stem.slice(0, -1) + 'ço';
        else if (/g$/.test(stem)) presente[0] = stem.slice(0, -1) + 'jo';
        // -uzir: conduz (no final -e)
        if (inf.endsWith('uzir')) presente[2] = stem;
        perfeito = isEr
            ? [stem + 'i', stem + 'este', stem + 'eu', stem + 'emos', stem + 'eram']
            : [stem + 'i', stem + 'iste', stem + 'iu', stem + 'imos', stem + 'iram'];
        imperfeito = [stem + 'ia', stem + 'ias', stem + 'ia', stem + 'íamos', stem + 'iam'];
    }

    return { presente: row(presente), perfeito: row(perfeito), imperfeito: row(imperfeito), futuro: row(futuro(inf)) };
};

/** Full conjugation, or null if the word isn't a verb in infinitive (or uses an unsupported pattern). */
export const conjugate = (infinitive: string): Conjugation | null => {
    const inf = infinitive.trim().toLowerCase();
    if (!/^[a-zà-ÿ]+$/.test(inf)) return null;
    const base = inf;
    // pôr and its compounds (supor, compor…) don't end in -ar/-er/-ir: start from the futuro and overrides
    const isPor = base === 'pôr' || base.endsWith('por');
    const reg: Conjugation | null = isPor
        ? (() => {
            const fut = row(futuro(base.replace('pôr', 'por')));
            return { presente: fut, perfeito: fut, imperfeito: fut, futuro: fut };
        })()
        : regular(base);
    if (!reg) return null;
    const over = IRREGULAR[base];
    if (isPor && !over) return null;
    if (!over) return reg;
    const result = { ...reg };
    for (const tense of TENSES) {
        const o = over[tense];
        if (!o) continue;
        result[tense] = Array.isArray(o) ? row(o as Row) : { ...reg[tense], ...(o as Partial<TenseTable>) };
    }
    return result;
};

export const personsFor = (infinitive: string): Person[] =>
    IMPERSONAL.has(infinitive) ? ['ele'] : PERSONS;
