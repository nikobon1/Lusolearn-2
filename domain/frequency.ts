const NORMALIZED_FREQUENCIES = ["Top 500", "Top 1000", "Top 3000", "Top 5000", "10000+"] as const;

export type NormalizedFrequency = typeof NORMALIZED_FREQUENCIES[number];

export const normalizeFrequency = (freq?: string): NormalizedFrequency => {
    if (!freq) return "10000+";
    if (NORMALIZED_FREQUENCIES.includes(freq as NormalizedFrequency)) return freq as NormalizedFrequency;
    if (freq === "High") return "Top 1000";
    if (freq === "Medium") return "Top 3000";
    if (freq === "Low") return "10000+";
    return "10000+";
};

