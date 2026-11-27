import { useState, useRef, useCallback, useEffect } from 'react';
import { sounds } from '../lib/sounds';
import { transcribeAudio, comparePronunciation, PronunciationScore, TranscriptionResult } from '../services/speechRecognition';

interface UseSpeechRecordingResult {
    isRecording: boolean;
    isProcessing: boolean;
    error: string | null;
    result: PronunciationScore | null;
    transcription: TranscriptionResult | null;
    recordingUrl: string | null;
    /** Microphone loudness 0..1 while recording (for the live animation) */
    level: number;
    /** Speech has been heard in the current recording */
    voiceDetected: boolean;
    /**
     * Starts recording. With `autoStopText`, recording stops by itself after a pause
     * once speech was heard, and is evaluated against that text.
     */
    startRecording: (options?: { autoStopText?: string }) => Promise<void>;
    stopAndEvaluate: (expectedText: string) => Promise<PronunciationScore | null>;
    playRecording: () => void;
    reset: () => void;
}

export function useSpeechRecording(): UseSpeechRecordingResult {
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<PronunciationScore | null>(null);
    const [transcription, setTranscription] = useState<TranscriptionResult | null>(null);
    const [recordingUrl, setRecordingUrl] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [level, setLevel] = useState(0);
    const [voiceDetected, setVoiceDetected] = useState(false);
    const isRecordingRef = useRef(false);
    const meterRef = useRef<{ ctx: AudioContext; raf: number } | null>(null);
    const stopRef = useRef<((text: string) => Promise<PronunciationScore | null>) | null>(null);

    const stopMeter = useCallback(() => {
        const m = meterRef.current;
        if (!m) return;
        cancelAnimationFrame(m.raf);
        m.ctx.close().catch(() => undefined);
        meterRef.current = null;
        setLevel(0);
    }, []);

    /**
     * Live loudness for the animation + simple voice activity detection:
     * once speech was heard, ~1.2 s of quiet ends the recording (when auto-stop is on).
     */
    const startMeter = useCallback((stream: MediaStream, autoStopText?: string) => {
        try {
            const Ctx = window.AudioContext || (window as any).webkitAudioContext;
            const ctx: AudioContext = new Ctx();
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 512;
            ctx.createMediaStreamSource(stream).connect(analyser);
            const data = new Uint8Array(analyser.fftSize);
            const startedAt = performance.now();
            let noise = 0.01;
            let heard = false;
            let lastLoud = startedAt;
            let lastUi = 0;
            const tick = (now: number) => {
                analyser.getByteTimeDomainData(data);
                let sum = 0;
                for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
                const rms = Math.sqrt(sum / data.length);
                // Learn the background level during the first moments
                if (!heard && now - startedAt < 400) noise = Math.max(noise, rms);
                const loud = rms > Math.max(0.02, noise * 2.5);
                if (loud) {
                    lastLoud = now;
                    if (!heard && now - startedAt > 150) { heard = true; setVoiceDetected(true); }
                }
                if (now - lastUi > 50) { lastUi = now; setLevel(Math.min(1, rms * 6)); }
                const stopFn = stopRef.current;
                if (autoStopText && stopFn && isRecordingRef.current
                    && ((heard && now - lastLoud > 1200) || now - startedAt > 15000)) {
                    stopFn(autoStopText);
                    return;
                }
                if (meterRef.current) meterRef.current.raf = requestAnimationFrame(tick);
            };
            meterRef.current = { ctx, raf: requestAnimationFrame(tick) };
        } catch (err) {
            console.warn('[Speech] Level meter unavailable', err);
        }
    }, []);

    useEffect(() => () => stopMeter(), [stopMeter]);

    const startRecording = useCallback(async (options?: { autoStopText?: string }) => {
        try {
            setError(null);
            setVoiceDetected(false);
            setResult(null);
            setTranscription(null);
            // Clean up previous recording URL
            if (recordingUrl) {
                URL.revokeObjectURL(recordingUrl);
                setRecordingUrl(null);
            }
            chunksRef.current = [];

            console.log('[Speech] 🎤 Requesting microphone access...');

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 48000
                }
            });

            streamRef.current = stream;

            // Safari/iPhone can't record WebM — use whatever the browser supports
            const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
            const mimeType = preferred.find(t => typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(t));
            const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current = mediaRecorder;
            sounds.recordStart();
            mediaRecorder.start(100); // Collect data every 100ms
            isRecordingRef.current = true;
            setIsRecording(true);
            startMeter(stream, options?.autoStopText);

            console.log('[Speech] 🔴 Recording started');

        } catch (err: any) {
            console.error('[Speech] ❌ Microphone error:', err);
            if (err.name === 'NotAllowedError') {
                setError('Доступ к микрофону запрещён. Разрешите доступ в настройках браузера.');
            } else if (err.name === 'NotFoundError') {
                setError('Микрофон не найден. Подключите микрофон и попробуйте снова.');
            } else {
                setError('Ошибка при доступе к микрофону: ' + err.message);
            }
        }
    }, [recordingUrl, startMeter]);

    const stopAndEvaluate = useCallback(async (expectedText: string): Promise<PronunciationScore | null> => {
        return new Promise((resolve) => {
            if (!mediaRecorderRef.current || !isRecordingRef.current) {
                resolve(null);
                return;
            }
            isRecordingRef.current = false;
            stopMeter();
            sounds.recordStop();

            const mediaRecorder = mediaRecorderRef.current;

            // Collect the final chunk when it arrives
            const handleFinalData = (event: BlobEvent) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                    console.log('[Speech] 📦 Final chunk received:', event.data.size, 'bytes');
                }
            };

            mediaRecorder.addEventListener('dataavailable', handleFinalData);

            mediaRecorder.onstop = async () => {
                console.log('[Speech] ⏹️ Recording stopped, chunks:', chunksRef.current.length);
                mediaRecorder.removeEventListener('dataavailable', handleFinalData);
                setIsRecording(false);
                setIsProcessing(true);

                // Stop all tracks
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                    streamRef.current = null;
                }

                try {
                    // Wait a moment for any pending data
                    await new Promise(r => setTimeout(r, 50));

                    const audioBlob = new Blob(chunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' });
                    console.log('[Speech] 💾 Total blob size:', audioBlob.size, 'bytes');

                    if (audioBlob.size < 1000) {
                        setError('Запись слишком короткая. Попробуйте говорить громче.');
                        sounds.error();
                        setIsProcessing(false);
                        resolve(null);
                        return;
                    }

                    // Save recording URL for playback
                    const url = URL.createObjectURL(audioBlob);
                    setRecordingUrl(url);
                    console.log('[Speech] 💾 Recording saved for playback');

                    const transcriptionResult = await transcribeAudio(audioBlob);
                    setTranscription(transcriptionResult);

                    if (!transcriptionResult.transcript) {
                        setError('Речь не распознана. Попробуйте говорить чётче.');
                        sounds.error();
                        setIsProcessing(false);
                        resolve(null);
                        return;
                    }

                    const score = comparePronunciation(expectedText, transcriptionResult.transcript);
                    setResult(score);
                    setIsProcessing(false);
                    resolve(score);

                } catch (err: any) {
                    console.error('[Speech] ❌ Processing error:', err);
                    setError('Ошибка обработки: ' + err.message);
                    sounds.error();
                    setIsProcessing(false);
                    resolve(null);
                }
            };

            // Stop the recorder - this will trigger final dataavailable, then onstop
            mediaRecorder.stop();
        });
    }, [stopMeter]);
    stopRef.current = stopAndEvaluate;

    const playRecording = useCallback(() => {
        if (!recordingUrl) return;

        // Stop previous playback if any
        if (audioRef.current) {
            audioRef.current.pause();
        }

        const audio = new Audio(recordingUrl);
        audioRef.current = audio;
        audio.play().catch(err => {
            console.error('[Speech] ❌ Playback error:', err);
        });
        console.log('[Speech] 🔊 Playing user recording');
    }, [recordingUrl]);

    const reset = useCallback(() => {
        setError(null);
        setResult(null);
        setTranscription(null);
        setIsProcessing(false);
        setIsRecording(false);
        isRecordingRef.current = false;
        setVoiceDetected(false);
        stopMeter();

        // Clean up recording URL
        if (recordingUrl) {
            URL.revokeObjectURL(recordingUrl);
            setRecordingUrl(null);
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
    }, [recordingUrl, stopMeter]);

    return {
        isRecording,
        isProcessing,
        error,
        result,
        transcription,
        recordingUrl,
        level,
        voiceDetected,
        startRecording,
        stopAndEvaluate,
        playRecording,
        reset
    };
}
