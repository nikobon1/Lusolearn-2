import { useState, useRef, useCallback } from 'react';
import { transcribeAudio, comparePronunciation, PronunciationScore, TranscriptionResult } from '../services/speechRecognition';

interface UseSpeechRecordingResult {
    isRecording: boolean;
    isProcessing: boolean;
    error: string | null;
    result: PronunciationScore | null;
    transcription: TranscriptionResult | null;
    startRecording: () => Promise<void>;
    stopAndEvaluate: (expectedText: string) => Promise<PronunciationScore | null>;
    reset: () => void;
}

export function useSpeechRecording(): UseSpeechRecordingResult {
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<PronunciationScore | null>(null);
    const [transcription, setTranscription] = useState<TranscriptionResult | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);

    const startRecording = useCallback(async () => {
        try {
            setError(null);
            setResult(null);
            setTranscription(null);
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

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.start(100); // Collect data every 100ms
            setIsRecording(true);

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
    }, []);

    const stopAndEvaluate = useCallback(async (expectedText: string): Promise<PronunciationScore | null> => {
        return new Promise((resolve) => {
            if (!mediaRecorderRef.current || !isRecording) {
                resolve(null);
                return;
            }

            const mediaRecorder = mediaRecorderRef.current;

            mediaRecorder.onstop = async () => {
                console.log('[Speech] ⏹️ Recording stopped, processing...');
                setIsRecording(false);
                setIsProcessing(true);

                // Stop all tracks
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                    streamRef.current = null;
                }

                try {
                    const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' });

                    if (audioBlob.size < 1000) {
                        setError('Запись слишком короткая. Попробуйте говорить громче.');
                        setIsProcessing(false);
                        resolve(null);
                        return;
                    }

                    const transcriptionResult = await transcribeAudio(audioBlob);
                    setTranscription(transcriptionResult);

                    if (!transcriptionResult.transcript) {
                        setError('Речь не распознана. Попробуйте говорить чётче.');
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
                    setIsProcessing(false);
                    resolve(null);
                }
            };

            mediaRecorder.stop();
        });
    }, [isRecording]);

    const reset = useCallback(() => {
        setError(null);
        setResult(null);
        setTranscription(null);
        setIsProcessing(false);
        setIsRecording(false);

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    }, []);

    return {
        isRecording,
        isProcessing,
        error,
        result,
        transcription,
        startRecording,
        stopAndEvaluate,
        reset
    };
}
