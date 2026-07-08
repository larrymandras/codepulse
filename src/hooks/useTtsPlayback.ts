/**
 * useTtsPlayback — shared TTS audio playback hook.
 *
 * Extracted from Chat.tsx (Phase 92, Plan 02).
 * Consumed by:
 *   - Chat.tsx (existing TTS auto-play behavior)
 *   - VoiceModePanel.tsx / palette voice mode (92-04)
 *
 * Exposes isPlaying for the feedback guard (pause STT recognition during TTS),
 * and an optional `analyser` (Web Audio AnalyserNode tapping her voice) so the
 * voice avatar's aura can react to Ástríðr's TTS amplitude while she speaks.
 *
 * Robustness contract (avatar work, 2026-07-08):
 *   The analyser is best-effort and MUST NEVER break playback. TTS is served
 *   cross-origin from the Ástríðr backend; analysing a media element requires
 *   `crossOrigin="anonymous"` + a matching CORS header on the audio response.
 *   If that isn't available (or the AudioContext can't run), we transparently
 *   fall back to plain, un-analysed playback — identical to the pre-avatar
 *   behavior. The aura synthesises a gentle pulse when real data is absent, so
 *   "speaking" still looks alive either way.
 */

import { useState, useRef, useCallback, useEffect } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const ASTRIDR_API_URL = import.meta.env.VITE_ASTRIDR_API_URL ?? "http://localhost:8181";

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UseTtsPlaybackReturn {
  /** Play audio at the given URL (relative or absolute). Normalizes relative paths internally. */
  play: (url: string) => void;
  /** Pause and discard the current audio. */
  stop: () => void;
  /** True while the <audio> element is playing; false after onended or stop(). */
  isPlaying: boolean;
  /**
   * AnalyserNode tapping the currently-playing TTS audio, or null when Web Audio
   * analysis is unavailable (playback still works). Frequency/time data drives
   * the avatar aura while Ástríðr speaks.
   */
  analyser: AnalyserNode | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTtsPlayback(): UseTtsPlaybackReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Web Audio graph (lazy). One AudioContext + one AnalyserNode reused across
  // plays; a fresh MediaElementSourceNode is created per <audio> element
  // (createMediaElementSource may only be called once per element).
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
    // Disconnect the per-element source so the element can be GC'd. The shared
    // analyser stays connected to destination for the next play.
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

  /** Plain, guaranteed-working playback path (pre-avatar behavior, no analysis). */
  const playPlain = useCallback(
    (fullUrl: string, token: number) => {
      // Superseded by a newer play()/stop()? Abort.
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

  /** Analysed playback path — routes the element through an AnalyserNode. */
  const playAnalysed = useCallback(
    async (fullUrl: string, token: number) => {
      // Lazily build the AudioContext + shared analyser.
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

      // A suspended context outputs silence through the graph → would be a
      // regression. Only take the analysed path if we can get it running.
      if (ctx.state !== "running") {
        await ctx.resume();
      }
      if (ctx.state !== "running") throw new Error("AudioContext suspended");
      if (token !== playTokenRef.current) return;

      teardownAudioEl();

      const audio = new Audio();
      // Opt into CORS so the media is analysable (not tainted). If the server
      // doesn't send matching CORS headers, the load errors → onerror fallback.
      audio.crossOrigin = "anonymous";
      audioRef.current = audio;

      const source = ctx.createMediaElementSource(audio);
      source.connect(analyserRef.current!); // analyser is already → destination
      sourceRef.current = source;

      setAnalyser(analyserRef.current);
      setIsPlaying(true);

      // If the analysed load fails (typically CORS), fall back to plain audio.
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
      // Try the analysed path; any failure transparently degrades to plain.
      void playAnalysed(fullUrl, token).catch((err) => {
        if (token !== playTokenRef.current) return;
        console.warn("TTS analyser unavailable; plain playback:", err);
        playPlain(fullUrl, token);
      });
    },
    [playAnalysed, playPlain],
  );

  return { play, stop, isPlaying, analyser };
}
