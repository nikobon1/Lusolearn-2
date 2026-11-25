/**
 * Parsing of pasted video transcripts.
 * Supports YouTube "Show transcript" copies (timestamp on its own line or before the text),
 * [mm:ss] / (hh:mm:ss) prefixes, SRT/VTT cues and plain text without timestamps.
 */

export interface TranscriptLine {
    index: number;
    /** Seconds from the start of the video, when known */
    time?: number;
    text: string;
}

export interface ParsedTranscript {
    lines: TranscriptLine[];
    hasTimestamps: boolean;
}

const TIME = String.raw`(\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?`;
const ONLY_TIME = new RegExp(String.raw`^[\[(]?(${TIME})[\])]?$`);
const TIME_PREFIX = new RegExp(String.raw`^[\[(]?(${TIME})[\])]?\s*[-–—:]?\s+(.+)$`);
const SRT_CUE = new RegExp(String.raw`^(${TIME})\s*-->\s*(${TIME}).*$`);
const SRT_INDEX = /^\d+$/;

export const parseTime = (raw: string): number => {
    const clean = raw.replace(',', '.');
    const parts = clean.split(':').map(Number);
    return Math.floor(parts.reduce((acc, p) => acc * 60 + p, 0));
};

export const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
    return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
};

/** Splits a long paragraph without line breaks into sentences. */
const splitSentences = (text: string): string[] =>
    text.split(/(?<=[.!?…])\s+(?=[A-ZÀ-ÚÂÊÔÃÕÇ«"—-])/).map(s => s.trim()).filter(Boolean);

export const parseTranscript = (raw: string): ParsedTranscript => {
    const rawLines = raw.replace(/\r\n?/g, '\n').split('\n').map(l => l.trim());
    const out: { time?: number; text: string }[] = [];
    let pendingTime: number | undefined;
    let sawTime = false;

    for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i];
        if (!line || line === 'WEBVTT') continue;

        const cue = SRT_CUE.exec(line);
        if (cue) { pendingTime = parseTime(cue[1]); sawTime = true; continue; }

        // SRT cue number directly followed by a cue line
        if (SRT_INDEX.test(line) && SRT_CUE.test(rawLines[i + 1] || '')) continue;

        const only = ONLY_TIME.exec(line);
        if (only) { pendingTime = parseTime(only[1]); sawTime = true; continue; }

        const prefixed = TIME_PREFIX.exec(line);
        if (prefixed) {
            out.push({ time: parseTime(prefixed[1]), text: prefixed[3].trim() });
            sawTime = true;
            pendingTime = undefined;
            continue;
        }

        const text = line.replace(/<[^>]+>/g, '').trim(); // VTT inline tags
        if (!text) continue;
        if (pendingTime !== undefined) {
            out.push({ time: pendingTime, text });
            pendingTime = undefined;
        } else if (sawTime && out.length > 0 && out[out.length - 1].time !== undefined) {
            // continuation of a multi-line cue
            out[out.length - 1].text += ` ${text}`;
        } else {
            out.push({ text });
        }
    }

    let lines = out;
    // Plain text pasted as one big paragraph: split into sentences
    if (!sawTime && lines.length <= 3 && lines.some(l => l.text.length > 300)) {
        lines = lines.flatMap(l => splitSentences(l.text).map(text => ({ text })));
    }

    return {
        lines: lines.map((l, index) => ({ index, time: l.time, text: l.text })),
        hasTimestamps: sawTime,
    };
};

/** YouTube video id from any common link form, or null. */
export const extractYouTubeId = (url: string): string | null => {
    const s = url.trim();
    if (!s) return null;
    const patterns = [
        /youtu\.be\/([A-Za-z0-9_-]{11})/,
        /[?&]v=([A-Za-z0-9_-]{11})/,
        /youtube\.com\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/,
    ];
    for (const p of patterns) {
        const m = p.exec(s);
        if (m) return m[1];
    }
    return /^[A-Za-z0-9_-]{11}$/.test(s) ? s : null;
};

export const youtubeLink = (videoId: string, seconds?: number) =>
    `https://www.youtube.com/watch?v=${videoId}${seconds ? `&t=${seconds}s` : ''}`;

/** Transcript lines numbered for the AI prompt ("L12: ..."), trimmed to a character budget. */
export const numberedForPrompt = (lines: TranscriptLine[], maxChars = 40_000): { text: string; truncated: boolean } => {
    let text = '';
    for (const l of lines) {
        const row = `L${l.index}: ${l.text}\n`;
        if (text.length + row.length > maxChars) return { text, truncated: true };
        text += row;
    }
    return { text, truncated: false };
};
