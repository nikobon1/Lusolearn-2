/**
 * Home-screen greeting in European Portuguese, by time of day.
 * In Portugal "Bom dia" is used until lunch, "Boa tarde" until it gets dark, "Boa noite" after.
 */
export interface Greeting {
    pt: string;
    ru: string;
    subtitlePt: string;
    subtitleRu: string;
}

export const getGreeting = (date = new Date()): Greeting => {
    const h = date.getHours();
    if (h >= 5 && h < 12) {
        return { pt: 'Bom dia', ru: 'Доброе утро', subtitlePt: 'Vamos começar o dia com português?', subtitleRu: 'Начнём день с португальского?' };
    }
    if (h >= 12 && h < 20) {
        return { pt: 'Boa tarde', ru: 'Добрый день', subtitlePt: 'Que tal uns minutos de português?', subtitleRu: 'Как насчёт пары минут португальского?' };
    }
    if (h >= 20) {
        return { pt: 'Boa noite', ru: 'Добрый вечер', subtitlePt: 'Uma revisão antes de dormir?', subtitleRu: 'Повторим перед сном?' };
    }
    return { pt: 'Boa noite', ru: 'Доброй ночи', subtitlePt: 'Ainda por aqui? Só um bocadinho de português.', subtitleRu: 'Ещё здесь? Совсем немного португальского.' };
};

/** First name from the Google profile, if there is one. */
export const firstName = (fullName?: string | null) => (fullName || '').trim().split(/\s+/)[0] || '';
