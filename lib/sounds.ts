/**
 * Short interface sounds generated with Web Audio (no files to download).
 * Quiet on purpose; failures (autoplay policy, old browsers) are ignored.
 */
let ctx: AudioContext | null = null;

const audio = () => {
    try {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return null;
        ctx ||= new Ctx();
        if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
        return ctx;
    } catch {
        return null;
    }
};

const tone = (freq: number, start: number, duration: number, type: OscillatorType = 'sine', volume = 0.12) => {
    const c = audio();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t0 = c.currentTime + start;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
};

const vibrate = (pattern: number | number[]) => {
    try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
};

export const sounds = {
    /** Microphone is on */
    recordStart: () => { tone(880, 0, 0.09); vibrate(15); },
    /** Recording finished, recognising */
    recordStop: () => { tone(660, 0, 0.08); vibrate(10); },
    /** Answer accepted */
    success: () => { tone(784, 0, 0.12, 'sine', 0.14); tone(1175, 0.1, 0.18, 'sine', 0.14); vibrate(20); },
    /** Close, but not quite */
    almost: () => { tone(660, 0, 0.12, 'triangle'); tone(740, 0.1, 0.14, 'triangle'); },
    /** Wrong / not recognised */
    error: () => { tone(220, 0, 0.18, 'triangle', 0.14); vibrate([30, 40, 30]); },
};
