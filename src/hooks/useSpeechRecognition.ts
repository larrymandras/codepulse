/**
 * useSpeechRecognition — shared Web Speech API hook.
 *
 * Extracted from ChatInput.tsx (Phase 92, Plan 02).
 * Consumed by:
 *   - ChatInput.tsx (continuous: false, interimResults: false)
 *   - VoiceModePanel.tsx / palette voice mode (continuous: true, interimResults: true)
 */

import { useState, useRef, useCallback, useEffect } from "react";

// ─── Web Speech API types ─────────────────────────────────────────────────────

export interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

export interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

// ─── Hook options / return ────────────────────────────────────────────────────

export interface UseSpeechRecognitionOptions {
  continuous?: boolean;
  interimResults?: boolean;
  lang?: string;
  onFinalResult: (transcript: string) => void;
  onInterimResult?: (transcript: string) => void;
  onEnd?: () => void;
}

export interface UseSpeechRecognitionReturn {
  start: () => void;
  stop: () => void;
  abort: () => void;
  isListening: boolean;
  speechAvailable: boolean;
}

// ─── Feature detection ────────────────────────────────────────────────────────

export function getSpeechRecognitionClass(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions
): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Use refs for callbacks to avoid stale closure issues
  const onFinalResultRef = useRef(options.onFinalResult);
  const onInterimResultRef = useRef(options.onInterimResult);
  const onEndRef = useRef(options.onEnd);

  useEffect(() => {
    onFinalResultRef.current = options.onFinalResult;
  }, [options.onFinalResult]);

  useEffect(() => {
    onInterimResultRef.current = options.onInterimResult;
  }, [options.onInterimResult]);

  useEffect(() => {
    onEndRef.current = options.onEnd;
  }, [options.onEnd]);

  const speechAvailable =
    typeof window !== "undefined" && getSpeechRecognitionClass() !== null;

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const abort = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const start = useCallback(() => {
    // Guard against starting while already listening (avoids InvalidStateError)
    if (isListening) return;

    const SpeechRecognitionClass = getSpeechRecognitionClass();
    if (!SpeechRecognitionClass) return;

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = options.continuous ?? false;
    recognition.interimResults = options.interimResults ?? false;
    recognition.lang = options.lang ?? "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.resultIndex];
      const transcript = result?.[0]?.transcript;
      if (!transcript) return;

      if (result.isFinal) {
        onFinalResultRef.current(transcript);
      } else if (options.interimResults) {
        onInterimResultRef.current?.(transcript);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      onEndRef.current?.();
    };

    recognition.onerror = (event: { error: string }) => {
      // "aborted" and "no-speech" are non-error situations — ignore silently
      if (event.error !== "aborted" && event.error !== "no-speech") {
        console.warn("Speech recognition error:", event.error);
      }
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, options.continuous, options.interimResults, options.lang]);

  return {
    start,
    stop,
    abort,
    isListening,
    speechAvailable,
  };
}
