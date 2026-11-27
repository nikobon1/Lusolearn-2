/**
 * Everyday phrase templates (European Portuguese), hand-written — no AI generation.
 * Each template is a reusable chunk with a slot and ready-made fillers.
 */

export type Situation = 'cafe' | 'shop' | 'transport' | 'health' | 'admin' | 'talk';

export const SITUATIONS: { id: Situation; label: string; emoji: string }[] = [
    { id: 'cafe', label: 'Кафе и ресторан', emoji: '☕' },
    { id: 'shop', label: 'Магазин', emoji: '🛒' },
    { id: 'transport', label: 'Транспорт и город', emoji: '🚌' },
    { id: 'health', label: 'Врач и аптека', emoji: '💊' },
    { id: 'admin', label: 'Документы и услуги', emoji: '📄' },
    { id: 'talk', label: 'Общение', emoji: '💬' },
];

export interface PhraseFiller {
    pt: string;
    ru: string;
}

export interface PhraseTemplate {
    id: string;
    situation: Situation;
    /** Pattern with a slot: "Queria …, se faz favor." */
    pt: string;
    ru: string;
    note: string;
    examples: PhraseFiller[];
}

export const TEMPLATES: PhraseTemplate[] = [
    // ---------- Кафе ----------
    {
        id: 'queria', situation: 'cafe', pt: 'Queria …, se faz favor.', ru: 'Мне, пожалуйста, … / Я бы хотел …',
        note: 'Главная фраза для заказа в Португалии. «Queria» (imperfeito от querer) звучит мягче, чем «Quero». «Se faz favor» — типично португальское «пожалуйста».',
        examples: [
            { pt: 'Queria um café, se faz favor.', ru: 'Мне кофе, пожалуйста.' },
            { pt: 'Queria uma água sem gás, se faz favor.', ru: 'Мне воду без газа, пожалуйста.' },
            { pt: 'Queria a conta, se faz favor.', ru: 'Счёт, пожалуйста.' },
            { pt: 'Queria uma mesa para dois, se faz favor.', ru: 'Столик на двоих, пожалуйста.' },
            { pt: 'Queria um pastel de nata, se faz favor.', ru: 'Мне паштел-де-ната, пожалуйста.' },
        ],
    },
    {
        id: 'e-para', situation: 'cafe', pt: 'É para …', ru: 'Это … (с собой / здесь)',
        note: 'Ответ на вопрос кассира, будете ли вы есть на месте.',
        examples: [
            { pt: 'É para levar.', ru: 'Это с собой.' },
            { pt: 'É para comer aqui.', ru: 'Буду есть здесь.' },
            { pt: 'É para partilhar.', ru: 'Это на двоих (поделимся).' },
        ],
    },
    {
        id: 'pode-trazer', situation: 'cafe', pt: 'Pode trazer …?', ru: 'Можете принести …?',
        note: 'Просьба к официанту. Можно добавить «se faz favor» в конце.',
        examples: [
            { pt: 'Pode trazer a ementa?', ru: 'Можете принести меню?' },
            { pt: 'Pode trazer mais pão?', ru: 'Можете принести ещё хлеба?' },
            { pt: 'Pode trazer um copo de água?', ru: 'Можете принести стакан воды?' },
            { pt: 'Pode trazer a conta?', ru: 'Можете принести счёт?' },
        ],
    },
    {
        id: 'tem', situation: 'cafe', pt: 'Tem …?', ru: 'У вас есть …?',
        note: 'Вежливое «у вас есть» без местоимения: форма tem подходит и к «вы».',
        examples: [
            { pt: 'Tem wi-fi?', ru: 'У вас есть вайфай?' },
            { pt: 'Tem opções vegetarianas?', ru: 'У вас есть вегетарианские блюда?' },
            { pt: 'Tem leite sem lactose?', ru: 'У вас есть безлактозное молоко?' },
            { pt: 'Tem mesa na esplanada?', ru: 'Есть столик на террасе?' },
        ],
    },
    // ---------- Магазин ----------
    {
        id: 'quanto-custa', situation: 'shop', pt: 'Quanto custa …?', ru: 'Сколько стоит …?',
        note: 'Про всю покупку на кассе спрашивают коротко: «Quanto é?» — «Сколько с меня?».',
        examples: [
            { pt: 'Quanto custa isto?', ru: 'Сколько это стоит?' },
            { pt: 'Quanto custa este casaco?', ru: 'Сколько стоит эта куртка?' },
            { pt: 'Quanto custa um quilo de tomates?', ru: 'Сколько стоит килограмм помидоров?' },
            { pt: 'Quanto é?', ru: 'Сколько с меня?' },
        ],
    },
    {
        id: 'procura', situation: 'shop', pt: 'Estou à procura de …', ru: 'Я ищу …',
        note: 'Типично португальская конструкция «estar à procura de». Подходит и в магазине, и на улице.',
        examples: [
            { pt: 'Estou à procura de um carregador.', ru: 'Я ищу зарядку.' },
            { pt: 'Estou à procura de sapatos de inverno.', ru: 'Я ищу зимнюю обувь.' },
            { pt: 'Estou à procura de uma farmácia.', ru: 'Я ищу аптеку.' },
        ],
    },
    {
        id: 'posso', situation: 'shop', pt: 'Posso …?', ru: 'Можно …? / Могу я …?',
        note: '«Posso» + инфинитив — просьба о разрешении.',
        examples: [
            { pt: 'Posso pagar com cartão?', ru: 'Можно оплатить картой?' },
            { pt: 'Posso experimentar?', ru: 'Можно примерить?' },
            { pt: 'Posso ver aquele?', ru: 'Можно посмотреть вон тот?' },
        ],
    },
    {
        id: 'fico-com', situation: 'shop', pt: 'Fico com …', ru: 'Я возьму …',
        note: 'Когда выбрали товар: «Fico com este» — «Беру этот».',
        examples: [
            { pt: 'Fico com este.', ru: 'Я возьму этот.' },
            { pt: 'Fico com os dois.', ru: 'Возьму оба.' },
            { pt: 'Fico com o maior.', ru: 'Возьму тот, что побольше.' },
        ],
    },
    // ---------- Транспорт и город ----------
    {
        id: 'onde-fica', situation: 'transport', pt: 'Onde fica …?', ru: 'Где находится …?',
        note: '«Ficar» здесь значит «находиться». Можно начать с «Desculpe, …» — «Извините, …».',
        examples: [
            { pt: 'Onde fica a casa de banho?', ru: 'Где туалет?' },
            { pt: 'Onde fica a estação?', ru: 'Где вокзал?' },
            { pt: 'Onde fica a paragem do autocarro?', ru: 'Где автобусная остановка?' },
            { pt: 'Onde fica o centro de saúde?', ru: 'Где поликлиника?' },
        ],
    },
    {
        id: 'ha-perto', situation: 'transport', pt: 'Há … aqui perto?', ru: 'Здесь рядом есть …?',
        note: '«Há» — «есть, имеется» (от haver).',
        examples: [
            { pt: 'Há um multibanco aqui perto?', ru: 'Здесь рядом есть банкомат?' },
            { pt: 'Há uma farmácia aqui perto?', ru: 'Здесь рядом есть аптека?' },
            { pt: 'Há um supermercado aqui perto?', ru: 'Здесь рядом есть супермаркет?' },
        ],
    },
    {
        id: 'a-que-horas', situation: 'transport', pt: 'A que horas …?', ru: 'Во сколько …?',
        note: 'Время отправления, открытия, закрытия.',
        examples: [
            { pt: 'A que horas fecha?', ru: 'Во сколько закрывается?' },
            { pt: 'A que horas abre amanhã?', ru: 'Во сколько открывается завтра?' },
            { pt: 'A que horas parte o próximo comboio?', ru: 'Во сколько уходит следующий поезд?' },
        ],
    },
    {
        id: 'como-se-vai', situation: 'transport', pt: 'Como é que se vai para …?', ru: 'Как добраться до …?',
        note: '«Como é que…» — очень частое в Португалии начало вопроса, звучит естественно.',
        examples: [
            { pt: 'Como é que se vai para o aeroporto?', ru: 'Как добраться до аэропорта?' },
            { pt: 'Como é que se vai para a Baixa?', ru: 'Как добраться до центра (Байши)?' },
            { pt: 'Como é que se vai para a praia?', ru: 'Как добраться до пляжа?' },
        ],
    },
    // ---------- Врач и аптека ----------
    {
        id: 'doi-me', situation: 'health', pt: 'Dói-me …', ru: 'У меня болит …',
        note: 'Буквально «мне болит». Если больное во множественном числе — «Doem-me»: «Doem-me as costas».',
        examples: [
            { pt: 'Dói-me a cabeça.', ru: 'У меня болит голова.' },
            { pt: 'Dói-me a garganta.', ru: 'У меня болит горло.' },
            { pt: 'Dói-me a barriga.', ru: 'У меня болит живот.' },
            { pt: 'Doem-me as costas.', ru: 'У меня болит спина.' },
        ],
    },
    {
        id: 'estou-com', situation: 'health', pt: 'Estou com …', ru: 'У меня … (состояние) / Я …',
        note: '«Estar com» + существительное — временное состояние: температура, голод, спешка.',
        examples: [
            { pt: 'Estou com febre.', ru: 'У меня температура.' },
            { pt: 'Estou com tosse.', ru: 'У меня кашель.' },
            { pt: 'Estou com fome.', ru: 'Я голоден.' },
            { pt: 'Estou com pressa.', ru: 'Я спешу.' },
        ],
    },
    {
        id: 'marcar-consulta', situation: 'health', pt: 'Gostava de marcar …', ru: 'Я хотел бы записаться …',
        note: '«Gostava de» — ещё одна вежливая форма «я бы хотел», очень частая в Португалии.',
        examples: [
            { pt: 'Gostava de marcar uma consulta.', ru: 'Я хотел бы записаться на приём.' },
            { pt: 'Gostava de marcar uma consulta para amanhã.', ru: 'Я хотел бы записаться на приём на завтра.' },
            { pt: 'Gostava de marcar uma vacina.', ru: 'Я хотел бы записаться на прививку.' },
        ],
    },
    {
        id: 'alguma-coisa-para', situation: 'health', pt: 'Tem alguma coisa para …?', ru: 'У вас есть что-нибудь от …?',
        note: 'В аптеке: «para» здесь — «от» (против).',
        examples: [
            { pt: 'Tem alguma coisa para a tosse?', ru: 'У вас есть что-нибудь от кашля?' },
            { pt: 'Tem alguma coisa para as dores de cabeça?', ru: 'У вас есть что-нибудь от головной боли?' },
            { pt: 'Tem alguma coisa para a alergia?', ru: 'У вас есть что-нибудь от аллергии?' },
        ],
    },
    // ---------- Документы и услуги ----------
    {
        id: 'preciso-de', situation: 'admin', pt: 'Preciso de …', ru: 'Мне нужно / нужен …',
        note: 'После «precisar» всегда «de»: «Preciso de ajuda». С глаголом: «Preciso de falar…».',
        examples: [
            { pt: 'Preciso de ajuda.', ru: 'Мне нужна помощь.' },
            { pt: 'Preciso de um comprovativo de morada.', ru: 'Мне нужно подтверждение адреса.' },
            { pt: 'Preciso de falar com alguém.', ru: 'Мне нужно с кем-нибудь поговорить.' },
        ],
    },
    {
        id: 'era-possivel', situation: 'admin', pt: 'Era possível …?', ru: 'А можно было бы …? (очень вежливо)',
        note: 'Мягкая просьба через imperfeito — так в Португалии говорят в учреждениях.',
        examples: [
            { pt: 'Era possível enviar por email?', ru: 'А можно отправить по электронной почте?' },
            { pt: 'Era possível marcar para outro dia?', ru: 'А можно записаться на другой день?' },
            { pt: 'Era possível falar mais devagar?', ru: 'А можно говорить помедленнее?' },
        ],
    },
    {
        id: 'o-que-e-preciso', situation: 'admin', pt: 'O que é preciso para …?', ru: 'Что нужно, чтобы …?',
        note: 'Вопрос о документах и условиях.',
        examples: [
            { pt: 'O que é preciso para abrir uma conta?', ru: 'Что нужно, чтобы открыть счёт?' },
            { pt: 'O que é preciso para pedir o NIF?', ru: 'Что нужно, чтобы получить NIF?' },
            { pt: 'O que é preciso para alugar um apartamento?', ru: 'Что нужно, чтобы снять квартиру?' },
        ],
    },
    {
        id: 'onde-posso', situation: 'admin', pt: 'Onde é que posso …?', ru: 'Где я могу …?',
        note: '«Onde é que…» — естественное разговорное начало вопроса.',
        examples: [
            { pt: 'Onde é que posso pagar?', ru: 'Где я могу оплатить?' },
            { pt: 'Onde é que posso tirar uma senha?', ru: 'Где я могу взять талончик?' },
            { pt: 'Onde é que posso deixar este documento?', ru: 'Где я могу оставить этот документ?' },
        ],
    },
    // ---------- Общение ----------
    {
        id: 'pode-por-favor', situation: 'talk', pt: 'Pode …, por favor?', ru: 'Можете …, пожалуйста?',
        note: 'Спасательная фраза, когда вы не поняли.',
        examples: [
            { pt: 'Pode repetir, por favor?', ru: 'Можете повторить, пожалуйста?' },
            { pt: 'Pode falar mais devagar, por favor?', ru: 'Можете говорить медленнее, пожалуйста?' },
            { pt: 'Pode escrever, por favor?', ru: 'Можете написать, пожалуйста?' },
        ],
    },
    {
        id: 'o-que-quer-dizer', situation: 'talk', pt: 'O que quer dizer …?', ru: 'Что значит …?',
        note: 'Спросить значение слова.',
        examples: [
            { pt: 'O que quer dizer «esplanada»?', ru: 'Что значит «esplanada»?' },
            { pt: 'O que quer dizer isto?', ru: 'Что это значит?' },
        ],
    },
    {
        id: 'nao-percebi', situation: 'talk', pt: 'Desculpe, não percebi …', ru: 'Извините, я не понял …',
        note: 'В Португалии «понимать» в разговоре — «perceber», а не «entender».',
        examples: [
            { pt: 'Desculpe, não percebi.', ru: 'Извините, я не понял.' },
            { pt: 'Desculpe, não percebi o seu nome.', ru: 'Извините, я не расслышал ваше имя.' },
            { pt: 'Desculpe, não percebi a última parte.', ru: 'Извините, я не понял последнюю часть.' },
        ],
    },
    {
        id: 'acabei-de', situation: 'talk', pt: 'Acabei de …', ru: 'Я только что …',
        note: '«Acabar de» + инфинитив — «только что сделать».',
        examples: [
            { pt: 'Acabei de chegar.', ru: 'Я только что пришёл.' },
            { pt: 'Acabei de chegar a Lisboa.', ru: 'Я только что приехал в Лиссабон.' },
            { pt: 'Acabei de começar a aprender português.', ru: 'Я только начал учить португальский.' },
        ],
    },
    {
        id: 'estou-a', situation: 'talk', pt: 'Estou a …', ru: 'Я (сейчас) … — процесс',
        note: '«Estar a» + инфинитив — действие прямо сейчас или в этот период. Так говорят в Португалии.',
        examples: [
            { pt: 'Estou a aprender português.', ru: 'Я учу португальский.' },
            { pt: 'Estou a procurar casa.', ru: 'Я ищу жильё.' },
            { pt: 'Estou a trabalhar, ligo-te depois.', ru: 'Я работаю, перезвоню тебе позже.' },
        ],
    },
];

export const templatesBySituation = (situation: Situation) => TEMPLATES.filter(t => t.situation === situation);

export interface PhraseDrillItem {
    key: string; // templateId|index
    template: PhraseTemplate;
    example: PhraseFiller;
}

export type PhraseStats = Record<string, { right: number; wrong: number }>;

/** Weighted pick: weak sentences more often, unseen before well-known; no template twice in a row. */
export const buildPhraseDrill = (
    situations: Situation[],
    count: number,
    stats: PhraseStats,
    random: () => number = Math.random
): PhraseDrillItem[] => {
    const pool = TEMPLATES
        .filter(t => situations.includes(t.situation))
        .flatMap(t => t.examples.map((example, i) => {
            const key = `${t.id}|${i}`;
            const s = stats[key] || { right: 0, wrong: 0 };
            return { item: { key, template: t, example }, weight: (1 + 3 * s.wrong) / (1 + 0.8 * s.right) };
        }));
    const picked: PhraseDrillItem[] = [];
    while (picked.length < count && pool.length > 0) {
        const last = picked[picked.length - 1];
        const candidates = pool.filter(p => !last || p.item.template.id !== last.template.id);
        const list = candidates.length ? candidates : pool;
        const total = list.reduce((sum, p) => sum + p.weight, 0);
        let r = random() * total;
        let chosen = list[list.length - 1];
        for (const c of list) { r -= c.weight; if (r <= 0) { chosen = c; break; } }
        picked.push(chosen.item);
        pool.splice(pool.indexOf(chosen), 1);
    }
    return picked;
};

export type PhraseVerdict = 'correct' | 'almost' | 'wrong';

const norm = (s: string) => s.toLowerCase().replace(/[.,!?¿¡;:"«»()…]/g, ' ').replace(/\s+/g, ' ').trim();
const noAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const distance = (a: string, b: string) => {
    const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let diag = prev[0];
        prev[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const tmp = prev[j];
            prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
            diag = tmp;
        }
    }
    return prev[b.length];
};

const compare = (given: string, expected: string): PhraseVerdict => {
    const g = norm(given), e = norm(expected);
    if (!g || !e) return 'wrong';
    if (g === e) return 'correct';
    const ga = noAccents(g), ea = noAccents(e);
    if (ga === ea) return 'almost';
    return distance(ga, ea) <= Math.max(1, Math.floor(ea.length / 15)) ? 'almost' : 'wrong';
};

/** The part of the example that fills the template's «…» ("Queria …, se faz favor." → "uma mesa para dois"). */
export const slotFiller = (templatePt: string, examplePt: string): string | null => {
    const parts = templatePt.split('…');
    if (parts.length !== 2) return null;
    const pre = norm(parts[0]), post = norm(parts[1]), e = norm(examplePt);
    if (!e.startsWith(pre) || !e.endsWith(post)) return null;
    const filler = e.slice(pre.length, e.length - post.length).trim();
    return filler || null;
};

/**
 * Accepts the whole sentence or just the words that go in place of «…» (the template is on screen).
 * Punctuation/case ignored; accents or a couple of typos → "almost".
 * `bySlot` = the learner answered with the filler only.
 */
export const checkSentence = (given: string, expected: string, templatePt?: string): PhraseVerdict => {
    return checkSentenceDetailed(given, expected, templatePt).verdict;
};

export const checkSentenceDetailed = (given: string, expected: string, templatePt?: string): { verdict: PhraseVerdict; bySlot: boolean } => {
    const whole = compare(given, expected);
    if (whole === 'correct' || !templatePt) return { verdict: whole, bySlot: false };
    const filler = slotFiller(templatePt, expected);
    if (!filler) return { verdict: whole, bySlot: false };
    const slot = compare(given, filler);
    const rank = { correct: 2, almost: 1, wrong: 0 } as const;
    if (rank[slot] > rank[whole]) return { verdict: slot, bySlot: true };
    // Started the frame but dropped its other half ("Queria uma mesa para dois" without "se faz favor") → almost
    const [pre, post] = templatePt.split('…').map(norm);
    const partial = [pre ? `${pre} ${filler}` : '', post ? `${filler} ${post}` : ''].filter(Boolean);
    if (whole === 'wrong' && partial.some(p => compare(given, p) !== 'wrong')) return { verdict: 'almost', bySlot: false };
    return { verdict: whole, bySlot: false };
};
