/**
 * useTtsPlayback — shared TTS audio playback hook.
 *
 * Extracted from Chat.tsx (Phase 92, Plan 02).
 * Consumed by:
 *   - Chat.tsx (existing TTS auto-play behavior) — default, plain playback
 *   - VoiceModePanel.tsx / palette voice mode (92-04) — opts into `analyser`
 *
 * Exposes `isPlaying` for the feedback guard (pause STT recognition during TTS).
 *
 * ─── Analyser is OPT-IN (avatar work, 2026-07-08) ──────────────────────────
 * Only the voice avatar needs to tap TTS amplitude, so the Web-Audio analyser
 * path is gated behind `options.analyser`. When it is NOT requested (the
 * default — Chat.tsx and every other caller), playback is the original
 * dead-simple `new Audio(url).play()`: NO AudioContext, NO crossOrigin, NO
 * MediaElementSource.
 *
 * This matters because routing the SHARED path through a second AudioContext +
 * `crossOrigin="anonymous"` regressed /chat: it contended with the wake-word
 * AudioContext (voice activation stalled) and, when the cross-origin TTS lacked
 * CORS headers, forced a failed-load-then-retry double fetch (laggy replies).
 * Keeping the analyser opt-in restores the known-good behavior everywhere the
 * avatar isn't mounted.
 *
 * Even in analyser mode, the analyser is best-effort and never breaks playback:
 * if the AudioContext can't run or the cross-origin media isn't analysable, it
 * transparently falls back to the same plain playback.
 */

import { useState, useRef, useCallback, useEffect } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const ASTRIDR_API_URL = import.meta.env.VITE_ASTRIDR_API_URL ?? "http://localhost:8181";

// ─── Options / return type ────────────────────────────────────────────────────

export interface UseTtsPlaybackOptions {
  /**
   * When true, route playback through a Web Audio AnalyserNode so `analyser`
   * exposes live amplitude (used by the voice avatar). Defaults to false, which
   * keeps the original plain-<audio> behavior with zero Web Audio overhead.
   */
  analyser?: boolean;
}

export interface UseTtsPlaybackReturn {
  /** Play audio at the given URL (relative or absolute). Normalizes relative paths internally. */
  play: (url: string) => void;
  /** Pause and discard the current audio. */
  stop: () => void;
  /** True while the <audio> element is playing; false after onended or stop(). */
  isPlaying: boolean;
  /**
   * AnalyserNode tapping the currently-playing TTS audio, or null when analysis
   * isn't enabled/available (playback still works). Only non-null when the hook
   * was created with `{ analyser: true }` and Web Audio analysis succeeded.
   */
  analyser: AnalyserNode | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTtsPlayback(options?: UseTtsPlaybackOptions): UseTtsPlaybackReturn {
  const analyserEnabled = options?.analyser ?? false;

  const [isPlaying, setIsPlaying] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Web Audio graph (lazy, analyser mode only). One AudioContext + AnalyserNode
  // reused across plays; a fresh MediaElementSourceNode per <audio> element.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Monotonic token so stale error/ended handlers from a superseded play() no-op.
  const playTokenRef = useRef(0);

  const normalizeUrl = (url: string) =>
    url.startsWith("http") ? url : `${ASTRIDR_API_URL}${url}`;

  const teardownAudioEl = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch {
        // already disconnected
      }
      sourceRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      playTokenRef.current += 1;
      teardownAudioEl();
      if (audioCtxRef.current) {
        void audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      analyserRef.current = null;
    };
  }, [teardownAudioEl]);

  const stop = useCallback(() => {
    playTokenRef.current += 1;
    teardownAudioEl();
    setIsPlaying(false);
  }, [teardownAudioEl]);

  /** Plain, guaranteed-working playback path — the original pre-avatar behavior. */
  const playPlain = useCallback(
    (fullUrl: string, token: number) => {
      if (token !== playTokenRef.current) return;
      teardownAudioEl();

      const audio = new Audio(fullUrl);
      audioRef.current = audio;
      setIsPlaying(true);

      audio.play().catch((err) => {
        console.warn("TTS playback failed:", err);
        if (token === playTokenRef.current) setIsPlaying(false);
      });
      audio.onended = () => {
        if (token !== playTokenRef.current) return;
        teardownAudioEl();
        setIsPlaying(false);
      };
    },
    [teardownAudioEl],
  );

  /** Analysed playback path — routes the element through an AnalyserNode (opt-in). */
  const playAnalysed = useCallback(
    async (fullUrl: string, token: number) => {
      let ctx = audioCtxRef.current;
      if (!ctx) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!Ctor) throw new Error("no AudioContext");
        ctx = new Ctor();
        audioCtxRef.current = ctx;
        const node = ctx.createAnalyser();
        node.fftSize = 256;
        node.smoothingTimeConstant = 0.8;
        node.connect(ctx.destination);
        analyserRef.current = node;
      }

      if (ctx.state !== "running") {
        await ctx.resume();
      }
      if (ctx.state !== "running") throw new Error("AudioContext suspended");
      if (token !== playTokenRef.current) return;

      teardownAudioEl();

      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      audioRef.current = audio;

      const source = ctx.createMediaElementSource(audio);
      source.connect(analyserRef.current!); // analyser is already → destination
      sourceRef.current = source;

      setAnalyser(analyserRef.current);
      setIsPlaying(true);

      audio.onerror = () => {
        if (token !== playTokenRef.current) return;
        console.warn("TTS analysed load failed; falling back to plain playback");
        playPlain(fullUrl, token);
      };
      audio.onended = () => {
        if (token !== playTokenRef.current) return;
        teardownAudioEl();
        setIsPlaying(false);
      };

      audio.src = fullUrl;
      try {
        await audio.play();
      } catch (err) {
        if (token !== playTokenRef.current) return;
        console.warn("TTS analysed playback failed; falling back:", err);
        playPlain(fullUrl, token);
      }
    },
    [teardownAudioEl, playPlain],
  );

  const play = useCallback(
    (url: string) => {
      const token = ++playTokenRef.current;
      const fullUrl = normalizeUrl(url);
      if (!analyserEnabled) {
        // Default: original plain playback, no Web Audio at all.
        playPlain(fullUrl, token);
        return;
      }
      // Opt-in: try the analysed path; any failure degrades to plain.
      void playAnalysed(fullUrl, token).catch((err) => {
        if (token !== playTokenRef.current) return;
        console.warn("TTS analyser unavailable; plain playback:", err);
        playPlain(fullUrl, token);
      });
    },
    [analyserEnabled, playAnalysed, playPlain],
  );

  return { play, stop, isPlaying, analyser };
}
