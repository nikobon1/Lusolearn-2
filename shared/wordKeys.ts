/**
 * Keys for shared word entries. Used by the browser, the /api/word server function,
 * and mirrored in SQL (supabase/migrations/20261127_word_entries.sql) — keep them in sync.
 */

const LEADING_ARTICLE = /^(o|a|os|as|um|uma|uns|umas)\s+(?=\S)/;

/** Portuguese term → lookup key: "A Casa." → "casa". */
export const normalizeTerm = (term: string): string =>
    term
        .toLowerCase()
        .trim()
        .replace(/[.!?¿¡,;:"«»()]/g, '')
        .replace(/\s+/g, ' ')
        .replace(LEADING_ARTICLE, '')
        .trim();

/**
 * Russian translation → sense key (first meaning only), so that "дом" and "дом, здание"
 * are the same sense, while "счёт (в банке)" and "счёт в кафе" can be told apart later.
 */
export const senseKey = (translation: string): string =>
    translation
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[;(/]/g, ',')
        .split(',')[0]
        .replace(/[.!?¿¡:"«»)]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

/** Content words of a translation, for loose matching of senses ("банковский счёт" ~ "счёт"). */
export const senseWords = (translation: string): string[] =>
    translation
        .toLowerCase()
        .replace(/ё/g, 'е')
        .split(/[^a-zа-я]+/i)
        .filter(w => w.length >= 3);
