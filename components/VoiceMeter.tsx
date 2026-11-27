import React from 'react';

/**
 * Live feedback while the microphone is on: bars follow the loudness of your voice,
 * the caption changes as soon as speech is heard.
 */
const VoiceMeter: React.FC<{ level: number; voiceDetected: boolean; processing?: boolean; autoStop?: boolean }> = ({ level, voiceDetected, processing, autoStop }) => {
    if (processing) {
        return (
            <div className="flex items-center justify-center gap-2 py-1 text-sm font-medium text-violet-600 dark:text-violet-300">
                <span className="flex gap-1">
                    {[0, 1, 2].map(i => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-violet-500" style={{ animationDelay: `${i * 120}ms` }} />)}
                </span>
                Распознаю…
            </div>
        );
    }
    const weights = [0.5, 0.8, 1, 0.8, 0.5, 0.7, 0.9];
    return (
        <div className="flex flex-col items-center gap-1 py-1">
            <div className="flex h-8 items-center gap-1" aria-hidden>
                {weights.map((w, i) => (
                    <span
                        key={i}
                        className={`w-1.5 rounded-full transition-[height] duration-75 ${voiceDetected ? 'bg-emerald-500' : 'bg-rose-400'}`}
                        style={{ height: `${Math.max(12, Math.min(100, level * w * 140 + 12))}%` }}
                    />
                ))}
            </div>
            <p className={`text-sm font-medium ${voiceDetected ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {voiceDetected
                    ? (autoStop ? 'Слышу вас ✓ — сделайте паузу, и я проверю' : 'Слышу вас ✓ — нажмите, чтобы закончить')
                    : 'Говорите…'}
            </p>
        </div>
    );
};

export default VoiceMeter;
