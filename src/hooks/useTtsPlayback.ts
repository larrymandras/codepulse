/**
 * useTtsPlayback — shared TTS audio playback hook.
 *
 * Extracted from Chat.tsx (Phase 92, Plan 02).
 * Consumed by:
 *   - Chat.tsx (existing TTS auto-play behavior)
 *   - VoiceModePanel.tsx / palette voice mode (92-04)
 *
 * Exposes isPlaying for the feedback guard (pause STT recognition during TTS).
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
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTtsPlayback(): UseTtsPlaybackReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const play = useCallback((url: string) => {
    // Replace any currently playing audio first
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Normalize relative URL against the Ástríðr API base
    const fullUrl = url.startsWith("http") ? url : `${ASTRIDR_API_URL}${url}`;

    const audio = new Audio(fullUrl);
    audioRef.current = audio;

    // Set isPlaying true before calling play()
    setIsPlaying(true);

    audio.play().catch((err) => {
      console.warn("TTS playback failed:", err);
      setIsPlaying(false);
    });

    audio.onended = () => {
      audioRef.current = null;
      setIsPlaying(false);
    };
  }, []);

  return { play, stop, isPlaying };
}
