import type { Tense } from './conjugation';

/**
 * Theory for the conjugation trainer (Russian explanations, European Portuguese).
 * Tables are rendered from the conjugator, so theory and practice always agree.
 */

export interface TheoryBlock {
    title: string;
    /** Paragraphs; **bold** is supported */
    text?: string[];
    /** Portuguese example → Russian */
    examples?: [string, string][];
    /** Render endings tables for model verbs */
    modelTable?: boolean;
    /** Render full tables for these verbs */
    verbs?: string[];
}

export interface TheoryTopic {
    id: 'basics' | Tense;
    title: string;
    subtitle: string;
    tense?: Tense;
    blocks: TheoryBlock[];
}

export const MODEL_VERBS = ['falar', 'comer', 'partir'];

export const THEORY: TheoryTopic[] = [
    {
        id: 'basics',
        title: 'Основы спряжения',
        subtitle: 'Группы глаголов, основа и окончание, местоимения',
        blocks: [
            {
                title: 'Три группы глаголов',
                text: [
                    'Каждый глагол в словаре стоит в инфинитиве и заканчивается на **-ar**, **-er** или **-ir**: *falar* (говорить), *comer* (есть), *partir* (уезжать).',
                    'Чтобы проспрягать правильный глагол, отбрасываем **-ar/-er/-ir** — остаётся **основа** (*fal-*, *com-*, *part-*), — и добавляем **окончание** нужного времени и лица. Окончания зависят от группы.',
                    'Самая большая группа — **-ar**: почти все новые глаголы образуются по ней (*clicar*, *estacionar*). Группы **-er** и **-ir** отличаются всего в паре форм.',
                ],
            },
            {
                title: 'Лица и местоимения',
                text: [
                    'В тренажёре 5 форм: **eu** (я), **tu** (ты), **ele / ela / você** (он, она, вы — одна форма), **nós** (мы), **eles / elas / vocês** (они, вы во множественном числе).',
                    '**Tu** в Португалии — обычное «ты» с друзьями, семьёй, ровесниками. **Você** формально «вы», но в Португалии может звучать холодно или резко; вежливее сказать **o senhor / a senhora** или просто опустить местоимение: *Quer um café?* — «Хотите кофе?».',
                    '**Местоимение часто опускают**: окончание уже показывает лицо. *Falo português* — «Я говорю по-португальски». Местоимение ставят для ясности или контраста: *Eu falo, ele não.*',
                    '**Vós** (вы) — устаревшая форма, в обычной речи её заменяет **vocês**. В тренажёре её нет.',
                ],
                examples: [
                    ['Falo português.', 'Я говорю по-португальски.'],
                    ['O senhor fala inglês?', 'Вы говорите по-английски? (вежливо)'],
                    ['Vocês moram aqui?', 'Вы (мн.) здесь живёте?'],
                ],
            },
            {
                title: 'Что учить в первую очередь',
                text: [
                    '1. **Presente** правильных глаголов + 10 самых частых неправильных (*ser, estar, ter, ir, fazer, poder, querer, saber, dizer, ver*).',
                    '2. **Pretérito perfeito** — чтобы рассказывать, что произошло.',
                    '3. **Pretérito imperfeito** — для описаний прошлого и вежливого *Queria…*.',
                    '4. **Futuro** — в основном узнавать; в речи будущее обычно выражают через *vou + инфинитив*.',
                ],
            },
        ],
    },
    {
        id: 'presente',
        tense: 'presente',
        title: 'Presente — настоящее время',
        subtitle: 'Что делаю сейчас, обычно, всегда',
        blocks: [
            {
                title: 'Когда употребляется',
                text: [
                    'Привычки и факты: *Trabalho em Lisboa.* — «Я работаю в Лиссабоне».',
                    'Ближайшее будущее, о котором договорились: *Amanhã vou ao médico.* — «Завтра иду к врачу».',
                    'Слова-маркеры: **hoje, agora, todos os dias, sempre, normalmente, às vezes**.',
                    '**Важно для Португалии:** действие «прямо сейчас» передают конструкцией **estar a + инфинитив**: *Estou a trabalhar.* — «Я (сейчас) работаю». Бразильское *estou trabalhando* в Португалии звучит чуждо.',
                ],
                examples: [
                    ['Normalmente almoço à uma.', 'Обычно я обедаю в час.'],
                    ['Estou a cozinhar, ligo-te depois.', 'Я готовлю, перезвоню тебе позже.'],
                ],
            },
            { title: 'Окончания правильных глаголов', modelTable: true },
            {
                title: 'Изменения на письме',
                text: [
                    'Звук должен сохраниться, поэтому перед **-o** (форма eu) меняется буква: **c → ç** (*conhecer → conheço*), **g → j** (*proteger → protejo*, *dirigir → dirijo*).',
                    'У некоторых глаголов на -ir меняется гласная основы только в форме eu: *dormir → durmo*, *sentir → sinto*, *preferir → prefiro*, *seguir → sigo*, *pedir → peço*, *ouvir → ouço*.',
                ],
            },
            {
                title: 'Самые частые неправильные',
                text: ['Эти формы нужно просто запомнить — зато они встречаются в каждом разговоре.'],
                verbs: ['ser', 'estar', 'ter', 'ir', 'fazer', 'poder', 'querer', 'dizer', 'ver', 'vir', 'dar', 'saber'],
            },
            {
                title: 'Ser или estar?',
                text: [
                    '**Ser** — постоянное: кто или что это, откуда, профессия, характер, время. *Sou russo. É médico. São três horas.*',
                    '**Estar** — состояние и местонахождение сейчас: *Estou cansado. Estou em Lisboa. O café está frio.*',
                ],
            },
        ],
    },
    {
        id: 'perfeito',
        tense: 'perfeito',
        title: 'Pretérito perfeito — что сделал',
        subtitle: 'Законченные действия в прошлом',
        blocks: [
            {
                title: 'Когда употребляется',
                text: [
                    'Действие произошло и закончилось: *Ontem jantei fora.* — «Вчера я поужинал в ресторане».',
                    'Слова-маркеры: **ontem, anteontem, na semana passada, no ano passado, há dois dias, já, ainda não**.',
                    'Это главное прошедшее время для рассказа о событиях: что сделал, куда пошёл, что купил.',
                ],
                examples: [
                    ['Paguei a renda ontem.', 'Я вчера заплатил за аренду.'],
                    ['Já comeste?', 'Ты уже поел?'],
                ],
            },
            { title: 'Окончания правильных глаголов', modelTable: true },
            {
                title: 'Особенность Португалии: falámos / falamos',
                text: [
                    'В Португалии форма **nós** глаголов на -ar в прошедшем пишется и звучит иначе, чем в настоящем: **falámos** (мы поговорили) — с открытым «а» и ударением на письме, **falamos** (мы говорим). В Бразилии обе формы — *falamos*.',
                    'У глаголов на -er и -ir формы nós совпадают: *comemos* — «мы едим» и «мы поели»; понятно из контекста.',
                ],
            },
            {
                title: 'Изменения на письме (форма eu)',
                text: [
                    'Перед **-ei**: **-car → -quei** (*ficar → fiquei*, *tocar → toquei*), **-gar → -guei** (*pagar → paguei*, *chegar → cheguei*), **-çar → -cei** (*começar → comecei*).',
                ],
            },
            {
                title: 'Неправильные — главные',
                text: [
                    '**Ser** и **ir** в этом времени совпадают: *fui* — «я был» и «я ходил». Различают по смыслу: *Fui ao médico* — «Я сходил к врачу».',
                    'У многих неправильных нет ударения в формах eu и ele: *fiz, fez; pude, pôde; disse, disse*.',
                ],
                verbs: ['ser', 'ir', 'estar', 'ter', 'fazer', 'dizer', 'poder', 'querer', 'ver', 'vir', 'dar', 'trazer'],
            },
        ],
    },
    {
        id: 'imperfeito',
        tense: 'imperfeito',
        title: 'Pretérito imperfeito — что делал, бывало',
        subtitle: 'Фон, описания и привычки в прошлом; вежливые просьбы',
        blocks: [
            {
                title: 'Когда употребляется',
                text: [
                    'Описание прошлого и фон: *Estava sol e havia muita gente.* — «Было солнечно и было много людей».',
                    'Повторявшиеся действия, привычки: *Quando era criança, ia à praia todos os verões.* — «В детстве я каждое лето ездил на пляж».',
                    'Возраст и время в прошлом: *Eram dez horas. Tinha vinte anos.*',
                    '**Вежливая просьба** — очень частая в Португалии: *Queria um café, se faz favor.* — «Мне, пожалуйста, кофе». Звучит мягче, чем *Quero*.',
                ],
                examples: [
                    ['Queria marcar uma consulta.', 'Я хотел бы записаться на приём.'],
                    ['Antes morava no Porto.', 'Раньше я жил в Порту.'],
                ],
            },
            { title: 'Окончания правильных глаголов', modelTable: true },
            {
                title: 'Только 4 неправильных',
                text: ['Imperfeito — самое простое время: неправильных глаголов всего четыре.'],
                verbs: ['ser', 'ter', 'vir', 'pôr'],
            },
            {
                title: 'Perfeito или imperfeito?',
                text: [
                    '**Perfeito** — событие, точка: что произошло. **Imperfeito** — фон, процесс, обстановка: что происходило.',
                    'Часто вместе: *Estava a jantar quando o telefone tocou.* — «Я ужинал (фон, imperfeito), когда зазвонил телефон (событие, perfeito)».',
                ],
            },
        ],
    },
    {
        id: 'futuro',
        tense: 'futuro',
        title: 'Futuro — будущее время',
        subtitle: 'В основном узнавать; в речи — «vou + инфинитив»',
        blocks: [
            {
                title: 'Как говорят о будущем на самом деле',
                text: [
                    'В разговоре будущее почти всегда выражают через **ir + инфинитив**: *Vou fazer o jantar.* — «Я приготовлю ужин». Или просто настоящим временем: *Amanhã trabalho.*',
                    'Простое будущее (*farei, falarei*) встречается в письменной речи, официальных текстах, обещаниях и **предположениях**: *Onde estará o João?* — «Где же, интересно, Жуан?».',
                ],
                examples: [
                    ['Vou ligar-te à noite.', 'Я позвоню тебе вечером.'],
                    ['O comboio partirá às 10h.', 'Поезд отправится в 10:00 (объявление).'],
                ],
            },
            {
                title: 'Образование',
                text: [
                    'Самое простое правило: окончания **-ei, -ás, -á, -emos, -ão** добавляются **к целому инфинитиву**, одинаково для всех трёх групп.',
                ],
                modelTable: true,
            },
            {
                title: 'Неправильные',
                text: ['Только три частых глагола теряют слог **-ze-**, плюс *pôr*.'],
                verbs: ['fazer', 'dizer', 'trazer', 'pôr'],
            },
        ],
    },
];
