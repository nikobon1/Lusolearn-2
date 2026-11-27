/**
 * Every AI model the app uses, in one place. Google retires models on a schedule
 * (see https://ai.google.dev/gemini-api/docs/deprecations) — switching is a one-line change here.
 * Mutable object on purpose: test scripts can try other models.
 */
export const MODELS = {
    /** Quality-sensitive text: card details, stories, dialogues, video lessons (replaces gemini-2.5-flash, retired 2026-12-01) */
    text: 'gemini-3.8-flash',
    /** Simple text: translations, sorting — fast and cheap */
    textLite: 'gemini-3.5-flash-lite',
    /** Speech recognition fallback (audio → text). Not flash-lite: it "corrects" the learner's mistakes */
    transcribe: 'gemini-3.8-flash',
    /** Text-to-speech (replaces gemini-2.5-flash-preview-tts). Returns WAV — decoded natively in services/audio.ts */
    tts: 'gemini-3.8-flash-tts',
    /** Card pictures */
    image: 'gemini-2.5-flash-image',
};

/**
 * Gemini 3.x "thinks" before answering by default (a story took ~45 s); for our tasks
 * low thinking gives the same quality ~4× faster. Gemini 2.5 used a token budget instead.
 */
export const thinkingFor = (model: string): Record<string, unknown> =>
    /^gemini-[3-9]/.test(model) ? { thinkingConfig: { thinkingLevel: 'low' } } : {};
