export interface TranscriptionResult {
    transcript: string;
    confidence: number;
    words?: { word: string; confidence: number }[];
}

export interface PronunciationScore {
    isCorrect: boolean;
    score: number; // 0-100
    expected: string;
    heard: string;
    feedback: string;
}

// Normalize text for comparison (remove punctuation, lowercase)
function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics for comparison
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .trim();
}

// Calculate similarity between two strings (Levenshtein-based)
function calculateSimilarity(str1: string, str2: string): number {
    const s1 = normalizeText(str1);
    const s2 = normalizeText(str2);

    if (s1 === s2) return 100;
    if (s1.length === 0 || s2.length === 0) return 0;

    const matrix: number[][] = [];

    for (let i = 0; i <= s1.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= s2.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= s1.length; i++) {
        for (let j = 1; j <= s2.length; j++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }

    const distance = matrix[s1.length][s2.length];
    const maxLength = Math.max(s1.length, s2.length);
    return Math.round((1 - distance / maxLength) * 100);
}

// Find differences between words
function findWordDifferences(expected: string, heard: string): { missing: string[]; extra: string[]; matched: string[] } {
    const expectedWords = normalizeText(expected).split(/\s+/).filter(w => w.length > 0);
    const heardWords = normalizeText(heard).split(/\s+/).filter(w => w.length > 0);

    const matched: string[] = [];
    const missing: string[] = [];
    const heardSet = new Set(heardWords);
    const expectedSet = new Set(expectedWords);

    for (const word of expectedWords) {
        if (heardSet.has(word)) {
            matched.push(word);
        } else {
            missing.push(word);
        }
    }

    const extra = heardWords.filter(w => !expectedSet.has(w));

    return { missing, extra, matched };
}

// Compare pronunciation and generate score
export function comparePronunciation(expected: string, heard: string): PronunciationScore {
    const score = calculateSimilarity(expected, heard);
    const { missing, extra, matched } = findWordDifferences(expected, heard);

    let feedback: string;
    let isCorrect: boolean;

    // More lenient thresholds for encouragement
    if (score >= 85) {
        feedback = "Превосходно! 🎉 Вы отлично справились!";
        isCorrect = true;
    } else if (score >= 65) {
        isCorrect = true;
        if (missing.length > 0 && missing.length <= 2) {
            feedback = `Хорошо! 👍 Проверьте слова: «${missing.join('», «')}»`;
        } else {
            feedback = "Хорошо! 👍 Небольшие отличия, но вас понимают.";
        }
    } else if (score >= 45) {
        isCorrect = false;
        if (missing.length > 0) {
            const tips = missing.slice(0, 3).join('», «');
            feedback = `Почти! 🔄 Обратите внимание на: «${tips}»`;
        } else if (extra.length > 0) {
            feedback = "Почти! 🔄 Попробуйте говорить медленнее.";
        } else {
            feedback = "Почти! 🔄 Послушайте оригинал и повторите.";
        }
    } else {
        isCorrect = false;
        if (heard.length < 3) {
            feedback = "Не расслышал 🎧 Говорите громче и чётче.";
        } else {
            feedback = "Попробуйте ещё! 🎯 Послушайте оригинал внимательно.";
        }
    }

    return { isCorrect, score, expected, heard, feedback };
}

// Transcribe audio using Google Cloud Speech-to-Text API
export async function transcribeAudio(audioBlob: Blob): Promise<TranscriptionResult> {
    // Convert blob to base64
    const arrayBuffer = await audioBlob.arrayBuffer();
    const base64Audio = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    console.log(`[Speech] 🎙️ Transcribing audio (${Math.round(audioBlob.size / 1024)}KB)...`);

    const response = await fetch('/api/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            config: {
                encoding: 'WEBM_OPUS',
                sampleRateHertz: 48000,
                languageCode: 'pt-PT',
                enableWordConfidence: true,
                model: 'default',
            },
            audio: { content: base64Audio }
        })
    });

    if (!response.ok) {
        const error = await response.json();
        console.error('[Speech] ❌ API Error:', error);
        throw new Error(error.error?.message || 'Speech recognition failed');
    }

    const data = await response.json();
    console.log('[Speech] ✅ Transcription result:', data);

    return {
        transcript: data.transcript || '',
        confidence: data.confidence || 0,
        words: Array.isArray(data.words) ? data.words.map((w: any) => ({
            word: w.word,
            confidence: w.confidence || 0
        })) : []
    };
}
