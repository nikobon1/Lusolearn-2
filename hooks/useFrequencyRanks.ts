import { useEffect, useState } from 'react';
import { FrequencyEntry, entryKey, loadFrequencyDictionary } from '../domain/frequencyDictionary';

let cached: Map<string, number> | null = null;

/** Word → rank in the frequency dictionary (1 = most common). null while loading. */
export const useFrequencyRanks = () => {
    const [ranks, setRanks] = useState<Map<string, number> | null>(cached);
    useEffect(() => {
        if (cached) return;
        let alive = true;
        loadFrequencyDictionary()
            .then((dict: FrequencyEntry[]) => {
                cached = new Map(dict.map(e => [entryKey(e), e.r]));
                if (alive) setRanks(cached);
            })
            .catch(() => { if (alive) setRanks(new Map()); });
        return () => { alive = false; };
    }, []);
    return ranks;
};
