/**
 * Role-play scenarios for everyday life in Portugal. The AI plays the other person;
 * the learner has a few goals to reach, answering by voice or text.
 */

export interface Scenario {
    id: string;
    emoji: string;
    title: string;
    /** Who the AI plays and where (instructions for the model, English) */
    role: string;
    /** What the learner is told (Russian) */
    setting: string;
    goals: string[];
    /** The AI's first line */
    opening: { pt: string; ru: string };
}

export const SCENARIOS: Scenario[] = [
    {
        id: 'cafe', emoji: '☕', title: 'Заказ в кафе',
        role: 'Sr. Manuel, the friendly owner of a small café in Lisbon, behind the counter.',
        setting: 'Вы в кафе у дома. Закажите завтрак и расплатитесь.',
        goals: ['Поздороваться', 'Заказать кофе и что-нибудь поесть', 'Спросить, сколько стоит', 'Расплатиться и попрощаться'],
        opening: { pt: 'Bom dia! O que vai ser?', ru: 'Доброе утро! Что будете?' },
    },
    {
        id: 'pharmacy', emoji: '💊', title: 'В аптеке',
        role: 'A pharmacist (farmacêutica) in a Portuguese pharmacy.',
        setting: 'У вас болит горло и небольшая температура. Попросите лекарство.',
        goals: ['Описать, что болит', 'Сказать, сколько дней это длится', 'Спросить, как принимать лекарство', 'Расплатиться'],
        opening: { pt: 'Boa tarde. Em que posso ajudar?', ru: 'Добрый день. Чем могу помочь?' },
    },
    {
        id: 'market', emoji: '🍅', title: 'На рынке',
        role: 'A cheerful fruit and vegetable seller at a Lisbon market.',
        setting: 'Купите фрукты и овощи на ужин.',
        goals: ['Попросить 1 кг помидоров', 'Спросить цену фруктов', 'Попросить пакет', 'Расплатиться и получить сдачу'],
        opening: { pt: 'Bom dia! Hoje temos tudo fresquinho. O que vai levar?', ru: 'Доброе утро! Сегодня всё свеженькое. Что возьмёте?' },
    },
    {
        id: 'directions', emoji: '🧭', title: 'Спросить дорогу',
        role: 'A friendly local passer-by in Baixa, Lisbon.',
        setting: 'Вы ищете станцию метро Baixa-Chiado. Спросите дорогу у прохожего.',
        goals: ['Вежливо обратиться', 'Спросить, где метро', 'Уточнить, далеко ли это', 'Поблагодарить'],
        opening: { pt: 'Sim? Precisa de ajuda?', ru: 'Да? Вам нужна помощь?' },
    },
    {
        id: 'neighbour', emoji: '🏠', title: 'Разговор с соседкой',
        role: 'Ana, the learner\'s neighbour (around 30, works in a pharmacy), meeting them on the stairs.',
        setting: 'Вы встретили соседку Ana на лестнице. Поболтайте немного.',
        goals: ['Поздороваться и спросить, как дела', 'Рассказать, откуда вы', 'Рассказать, чем занимаетесь', 'Договориться выпить кофе'],
        opening: { pt: 'Olá! Tudo bem? Há quanto tempo!', ru: 'Привет! Как дела? Давно не виделись!' },
    },
    {
        id: 'doctor', emoji: '📞', title: 'Записаться к врачу',
        role: 'A receptionist at a centro de saúde (public health centre) answering the phone.',
        setting: 'Позвоните в поликлинику и запишитесь к семейному врачу.',
        goals: ['Сказать, что хотите записаться', 'Назвать имя', 'Выбрать день и время', 'Уточнить, что взять с собой'],
        opening: { pt: 'Centro de Saúde da Estrela, bom dia. Diga, por favor.', ru: 'Поликлиника Эштрела, доброе утро. Слушаю вас.' },
    },
    {
        id: 'financas', emoji: '📄', title: 'Finanças: получить NIF',
        role: 'A clerk at the Finanças office (tax office) helping with a NIF (tax number).',
        setting: 'Вы в налоговой. Нужно получить NIF — налоговый номер.',
        goals: ['Сказать, что нужен NIF', 'Ответить, какие документы есть', 'Назвать адрес', 'Спросить, когда будет готово'],
        opening: { pt: 'Bom dia. Senha número 42? Faça favor, sente-se.', ru: 'Доброе утро. Талон номер 42? Пожалуйста, садитесь.' },
    },
    {
        id: 'restaurant', emoji: '🍽️', title: 'Ужин в ресторане',
        role: 'A waiter in a traditional Portuguese restaurant (tasca).',
        setting: 'Вы пришли поужинать. Закажите блюдо дня и попросите счёт.',
        goals: ['Попросить столик', 'Спросить, какое блюдо дня', 'Заказать еду и напиток', 'Попросить счёт'],
        opening: { pt: 'Boa noite! Mesa para quantas pessoas?', ru: 'Добрый вечер! Столик на сколько человек?' },
    },
    {
        id: 'flat', emoji: '🔑', title: 'Снять квартиру',
        role: 'A landlord (senhorio) showing a T1 flat in Lisbon.',
        setting: 'Вы смотрите квартиру. Узнайте условия аренды.',
        goals: ['Спросить цену аренды', 'Узнать, входят ли счета', 'Спросить про депозит', 'Договориться о следующем шаге'],
        opening: { pt: 'Então, aqui está o apartamento. O que acha?', ru: 'Ну вот, это квартира. Что скажете?' },
    },
    {
        id: 'shop-return', emoji: '🛍️', title: 'Вернуть покупку',
        role: 'A shop assistant at a clothes store.',
        setting: 'Вы купили куртку, но она мала. Обменяйте или верните её.',
        goals: ['Объяснить проблему', 'Попросить другой размер', 'Спросить о возврате денег', 'Поблагодарить'],
        opening: { pt: 'Olá, boa tarde! Posso ajudar?', ru: 'Здравствуйте, добрый день! Могу помочь?' },
    },
];

export interface DialogueTurn {
    who: 'ai' | 'me';
    pt: string;
    ru?: string;
    /** Feedback on the learner's line */
    check?: { ok: boolean; corrected: string; correctedRu?: string; note: string };
}
