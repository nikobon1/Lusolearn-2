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

const INLINE_TIME = new RegExp(String.raw`(?:^|\s)\[?((?:\d{1,2}:)?\d{1,2}:\d{2})\]?(?=\s|$)`, 'g');
const MAX_LINE = 300;
const CHUNK_WORDS = 25;

/**
 * "0:01 Bom dia 0:04 Queria abrir 0:08 …" pasted as one line → one line per timestamp.
 * Only when the line clearly is a timestamped transcript (3+ stamps, or 2+ starting with one),
 * so "das 9:00 às 17:00" inside a normal sentence is left alone.
 */
const splitInlineTimestamps = (line: string): string[] => {
    const matches = [...line.matchAll(INLINE_TIME)];
    const startsWithTime = matches.length > 0 && line.slice(0, matches[0].index! + matches[0][0].length).trim() === matches[0][0].trim();
    if (matches.length < 3 && !(matches.length >= 2 && startsWithTime)) return [line];
    const out: string[] = [];
    const head = line.slice(0, matches[0].index).trim();
    if (head) out.push(head);
    matches.forEach((m, i) => {
        const start = m.index! + m[0].length;
        const end = i + 1 < matches.length ? matches[i + 1].index! : line.length;
        out.push(`${m[1]} ${line.slice(start, end).trim()}`.trim());
    });
    return out;
};

/** Auto-generated subtitles have no punctuation: cut very long lines into ~25-word pieces. */
const chunkLongLine = (text: string): string[] => {
    if (text.length <= MAX_LINE) return [text];
    const sentences = splitSentences(text);
    const pieces: string[] = [];
    for (const s of sentences) {
        if (s.length <= MAX_LINE) { pieces.push(s); continue; }
        const words = s.split(/\s+/);
        for (let i = 0; i < words.length; i += CHUNK_WORDS) pieces.push(words.slice(i, i + CHUNK_WORDS).join(' '));
    }
    return pieces;
};

/** Splits a long paragraph without line breaks into sentences. */
const splitSentences = (text: string): string[] =>
    text.split(/(?<=[.!?…])\s+(?=[A-ZÀ-ÚÂÊÔÃÕÇ«"—-])/).map(s => s.trim()).filter(Boolean);

export const parseTranscript = (raw: string): ParsedTranscript => {
    const rawLines = raw.replace(/\r\n?/g, '\n').split('\n').map(l => l.trim()).flatMap(splitInlineTimestamps);
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

    // Very long lines (a pasted paragraph, unpunctuated auto-subtitles): split into readable pieces
    const lines = out.flatMap(l => chunkLongLine(l.text).map(text => ({ time: l.time, text })));

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
