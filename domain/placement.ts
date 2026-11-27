import { FUNCTION_POS, FrequencyEntry, entryKey } from './frequencyDictionary';

/**
 * Quick vocabulary check for learners who already know some Portuguese:
 * a few words from each frequency band, "know / don't know" with a self-check of the meaning.
 * Bands that are clearly known are marked as known, so the path starts at the first gap.
 */

export const PLACEMENT_BANDS: [number, number][] = [[1, 100], [101, 250], [251, 500], [501, 900], [901, 1300], [1301, 1700]];
export const WORDS_PER_BAND = 5;
/** A band counts as known when at least this share of its sample was known */
export const KNOWN_BAND_SHARE = 0.8;

export interface PlacementItem {
    entry: FrequencyEntry;
    band: number;
}

export const buildPlacementSample = (dictionary: FrequencyEntry[], random: () => number = Math.random): PlacementItem[] => {
    const items: PlacementItem[] = [];
    PLACEMENT_BANDS.forEach(([lo, hi], band) => {
        // Content words only: "de", "o", "que" say little about vocabulary
        const pool = dictionary.filter(e => e.r >= lo && e.r <= hi && !FUNCTION_POS.includes(e.p) && e.p !== 'phrase' && e.p !== 'num');
        const picked = [...pool].sort(() => random() - 0.5).slice(0, WORDS_PER_BAND);
        picked.sort((a, b) => a.r - b.r).forEach(entry => items.push({ entry, band }));
    });
    return items;
};

export interface PlacementResult {
    /** Share known per band (null if the band had no answers) */
    bandShares: (number | null)[];
    /** Estimated number of the dictionary's words the learner knows */
    estimatedKnown: number;
    /** Every word up to this rank is marked as known (0 = none) */
    frontierRank: number;
    /** Keys to mark as known */
    knownKeys: string[];
}

export const evaluatePlacement = (
    dictionary: FrequencyEntry[],
    answers: { item: PlacementItem; known: boolean }[]
): PlacementResult => {
    const bandShares = PLACEMENT_BANDS.map((_, band) => {
        const inBand = answers.filter(a => a.item.band === band);
        return inBand.length ? inBand.filter(a => a.known).length / inBand.length : null;
    });

    let frontierRank = 0;
    for (let band = 0; band < PLACEMENT_BANDS.length; band++) {
        const share = bandShares[band];
        if (share === null || share < KNOWN_BAND_SHARE) break;
        frontierRank = PLACEMENT_BANDS[band][1];
    }

    const maxRank = dictionary.reduce((m, e) => Math.max(m, e.r), 0);
    const estimatedKnown = Math.round(PLACEMENT_BANDS.reduce((sum, [lo, hi], band) => {
        const size = Math.max(0, Math.min(hi, maxRank) - lo + 1);
        return sum + (bandShares[band] ?? 0) * size;
    }, 0));

    const unknown = new Set(answers.filter(a => !a.known).map(a => entryKey(a.item.entry)));
    const known = new Set<string>();
    for (const e of dictionary) if (e.r <= frontierRank) known.add(entryKey(e));
    for (const a of answers) if (a.known) known.add(entryKey(a.item.entry));
    unknown.forEach(k => known.delete(k));

    return { bandShares, estimatedKnown, frontierRank, knownKeys: [...known] };
};
