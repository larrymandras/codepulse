/**
 * VoiceModePanel.tsx — Voice mode UI rendered inside CommandDialog.
 *
 * Rendered by CommandPalette when voiceMode=true. Implements:
 *   - Continuous turn loop (listening → transcribing → processing → speaking → listening)
 *   - Live transcript via useSpeechRecognition (continuous + interimResults)
 *   - Streamed reply via AstridrWSContext subscribeEvent run.text / run.tts / run.completed
 *   - TTS auto-play via useTtsPlayback
 *   - Feedback guard: pause STT while isPlaying, resume after (T-92-10 mitigation)
 *   - End-phrase exit ("stop", "goodbye", etc.) via isEndPhrase
 *   - ~30s silence timeout dispatches END + calls onClose
 *
 * Barge-in (speaking state allows STT interrupt) is deferred to a follow-on
 * (RESEARCH Open Question 2) — mic pauses while isPlaying.
 *
 * Phase 92, Plan 04 — VOX-02, VOX-03.
 */

import { useReducer, useEffect, useRef, useState, useCallback } from "react";
import { X, Volume2, Loader2, AlertCircle } from "lucide-react";
import { useAstridrWS } from "@/contexts/AstridrWSContext";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useTtsPlayback } from "@/hooks/useTtsPlayback";
import { voiceReducer, isEndPhrase, type VoiceState } from "./voiceState";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VoiceModePanelProps {
  /** Initial voice state (defaults to 'listening' if not provided). */
  voiceState?: VoiceState;
  /** Called when the panel should close (end-phrase, X button, silence timeout, Escape). */
  onClose: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SILENCE_TIMEOUT_MS = 30_000; // 30 seconds (UI-SPEC §"Silence timeout (30s)")

// ─── State label / dot class mappings (UI-SPEC §"State → visual rendering table") ─

function stateLabel(state: VoiceState): string {
  switch (state) {
    case "listening":
      return "Listening…"; // "Listening…"
    case "transcribing":
      return "Hearing you";
    case "processing":
      return "Thinking…";
    case "speaking":
      return "Ástríðr speaking"; // "Ástríðr speaking"
    case "error-disabled":
      return "Voice unavailable";
    case "idle":
    default:
      return "Idle";
  }
}

function stateDotClass(state: VoiceState): string {
  switch (state) {
    case "listening":
    case "processing":
    case "speaking":
      return "w-2 h-2 rounded-full bg-primary animate-pulse shadow-[var(--glow-md)]";
    case "transcribing":
      return "w-2 h-2 rounded-full bg-yellow-400";
    case "error-disabled":
      return "w-2 h-2 rounded-full bg-red-500";
    case "idle":
    default:
      return "w-2 h-2 rounded-full bg-muted-foreground";
  }
}

// ─── Inline sub-components ────────────────────────────────────────────────────

function VoiceStateBadge({ state }: { state: VoiceState }) {
  return (
    <div className="flex items-center gap-2">
      <span className={stateDotClass(state)} />
      <span
        aria-live="assertive"
        aria-atomic="true"
        aria-label="Voice mode status"
        className="text-xs font-semibold text-foreground transition-colors duration-200"
      >
        {stateLabel(state)}
      </span>
    </div>
  );
}

function VoiceTranscriptArea({
  interimText,
  finalText,
  state,
}: {
  interimText: string;
  finalText: string;
  state: VoiceState;
}) {
  const isEmpty = !interimText && !finalText;
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      aria-label="Live transcript"
      className="min-h-[48px] px-4 py-3 font-mono text-[10px] uppercase tracking-wide"
    >
      {isEmpty && state === "listening" ? (
        <span className="text-muted-foreground">Say a command…</span>
      ) : (
        <>
          {finalText && (
            <span className="text-foreground not-italic">{finalText}</span>
          )}
          {interimText && (
            <span className="text-muted-foreground italic">{interimText}</span>
          )}
        </>
      )}
    </div>
  );
}

function VoiceReplyStream({ replyText }: { replyText: string }) {
  if (!replyText) return null;
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      aria-label="Ástríðr response"
      className="px-4 py-3 border-t border-border"
    >
      <div className="text-xs text-muted-foreground font-semibold font-mono uppercase tracking-widest mb-2">
        ÁSTRÍÐR
      </div>
      <div className="text-sm text-foreground leading-relaxed">{replyText}</div>
    </div>
  );
}

function VoiceWaveform({ state }: { state: VoiceState }) {
  if (state === "processing") {
    return (
      <Loader2 className="h-4 w-4 text-primary animate-spin" aria-hidden="true" />
    );
  }

  if (state === "listening" || state === "transcribing" || state === "speaking") {
    return (
      <span className="flex items-end gap-0.5 h-4 text-primary" aria-hidden="true">
        <span className="eq-bar eq-bar-1" />
        <span className="eq-bar eq-bar-2" />
        <span className="eq-bar eq-bar-3" />
      </span>
    );
  }

  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VoiceModePanel({
  voiceState: initialVoiceState = "listening",
  onClose,
}: VoiceModePanelProps) {
  const { sendCommand, subscribeEvent } = useAstridrWS();

  // Internal state machine — initialised from prop (caller controls initial state)
  const [voiceState, dispatch] = useReducer(voiceReducer, initialVoiceState);

  // Transcript state
  const [interimText, setInterimText] = useState("");
  const [finalText, setFinalText] = useState("");

  // Reply stream
  const [replyText, setReplyText] = useState("");

  // Active session for routing run.text/run.tts/run.completed
  const activeSessionRef = useRef<string | null>(null);

  // Silence timeout ref
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Silence timer helpers ──────────────────────────────────────────────────

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    silenceTimerRef.current = setTimeout(() => {
      dispatch({ type: "END" });
      onClose();
    }, SILENCE_TIMEOUT_MS);
  }, [onClose]);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  // ─── Speech recognition ─────────────────────────────────────────────────────

  const handleInterimResult = useCallback(
    (text: string) => {
      setInterimText(text);
      dispatch({ type: "INTERIM_RESULT" });
      resetSilenceTimer();
    },
    [resetSilenceTimer]
  );

  const handleFinalResult = useCallback(
    async (text: string) => {
      setInterimText("");
      setFinalText(text);
      resetSilenceTimer();

      // End-phrase: dispatch END + close (T-92-13 mitigation — D-01)
      if (isEndPhrase(text)) {
        dispatch({ type: "END" });
        clearSilenceTimer();
        onClose();
        return;
      }

      // Normal command: send to Ástríðr via existing WS transport
      dispatch({ type: "FINAL_RESULT" });
      setReplyText("");

      try {
        const ack = await sendCommand({ type: "chat.send", message: text });
        // Capture session_id for routing streaming events (PATTERNS §sendCommand+session_id)
        const sessionId =
          (ack.session_id as string | undefined) ??
          (ack.data?.session_id as string | undefined) ??
          String(Date.now());
        activeSessionRef.current = sessionId;
      } catch (err) {
        console.warn("VoiceModePanel: sendCommand failed:", err);
        dispatch({ type: "ERROR" });
      }
    },
    [sendCommand, onClose, clearSilenceTimer, resetSilenceTimer]
  );

  const handleEnd = useCallback(() => {
    // Recognition ended naturally — only restart if we're not in a terminal state
    if (
      voiceState !== "idle" &&
      voiceState !== "error-disabled" &&
      voiceState !== "speaking"
    ) {
      resetSilenceTimer();
    }
  }, [voiceState, resetSilenceTimer]);

  const { start: recognitionStart, stop: recognitionStop } = useSpeechRecognition({
    continuous: true,
    interimResults: true,
    onFinalResult: handleFinalResult,
    onInterimResult: handleInterimResult,
    onEnd: handleEnd,
  });

  // ─── TTS playback ───────────────────────────────────────────────────────────

  const { play: ttsPlay, isPlaying } = useTtsPlayback();

  // ─── Feedback guard (T-92-10 mitigation) ───────────────────────────────────
  // When TTS starts playing: pause STT (recognition.stop)
  // When TTS ends (isPlaying → false): resume STT (recognition.start)
  // This prevents Ástríðr's spoken reply from being self-transcribed.

  const wasPlayingRef = useRef(false);

  useEffect(() => {
    if (isPlaying && !wasPlayingRef.current) {
      // TTS just started — pause STT
      recognitionStop();
      dispatch({ type: "TTS_START" });
      wasPlayingRef.current = true;
    } else if (!isPlaying && wasPlayingRef.current) {
      // TTS just ended — resume STT for next turn
      recognitionStart();
      dispatch({ type: "TTS_END" });
      wasPlayingRef.current = false;
      resetSilenceTimer();
    }
  }, [isPlaying, recognitionStop, recognitionStart, resetSilenceTimer]);

  // ─── Subscribe to streaming events ─────────────────────────────────────────
  // Follows PATTERNS §subscribeEvent cleanup (Chat.tsx lines 186-300)

  useEffect(() => {
    const unsubText = subscribeEvent("run.text", (event) => {
      const data = event.data as {
        session_id?: string;
        text?: string;
        text_chunk?: string;
        done?: boolean;
      } | undefined;

      if (!data) return;
      if (data.session_id && data.session_id !== activeSessionRef.current) return;

      const chunk = data.text_chunk ?? data.text ?? "";
      if (chunk) {
        setReplyText((prev) => prev + chunk);
      }
    });

    const unsubTts = subscribeEvent("run.tts", (event) => {
      const data = event.data as {
        session_id?: string;
        audio_url?: string;
      } | undefined;

      if (!data?.audio_url) return;
      // Only filter by session_id when we have an active session to compare against
      if (
        activeSessionRef.current !== null &&
        data.session_id &&
        data.session_id !== activeSessionRef.current
      ) return;

      ttsPlay(data.audio_url);
      dispatch({ type: "TTS_START" });
    });

    const unsubCompleted = subscribeEvent("run.completed", (event) => {
      const data = event.data as { session_id?: string } | undefined;
      if (data?.session_id && data.session_id !== activeSessionRef.current) return;
      // run.completed — next turn will begin once TTS ends (feedback guard handles restart)
    });

    return () => {
      unsubText();
      unsubTts();
      unsubCompleted();
    };
  }, [subscribeEvent, ttsPlay]);

  // ─── Lifecycle: start recognition + silence timer on mount ─────────────────

  useEffect(() => {
    if (voiceState !== "error-disabled" && voiceState !== "idle") {
      recognitionStart();
      resetSilenceTimer();
    }

    return () => {
      clearSilenceTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // ─── Handle close ───────────────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    clearSilenceTimer();
    recognitionStop();
    dispatch({ type: "END" });
    onClose();
  }, [onClose, clearSilenceTimer, recognitionStop]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col p-0" role="region" aria-label="Voice mode">
      {/* Header row: state badge + close button */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <VoiceStateBadge state={voiceState} />
        <button
          autoFocus
          onClick={handleClose}
          aria-label="Close voice mode"
          className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Transcript area */}
      <VoiceTranscriptArea
        interimText={interimText}
        finalText={finalText}
        state={voiceState}
      />

      {/* Reply stream */}
      <VoiceReplyStream replyText={replyText} />

      {/* Footer: end-phrase hint + waveform/indicator */}
      {voiceState !== "error-disabled" && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-border mt-auto">
          <span className="text-xs text-muted-foreground font-normal">
            Say &lsquo;stop&rsquo; or &lsquo;goodbye&rsquo; to exit
          </span>
          {voiceState === "processing" ? (
            <Loader2 className="h-4 w-4 text-primary animate-spin" aria-hidden="true" />
          ) : voiceState === "speaking" ? (
            <Volume2 className="h-4 w-4 text-primary animate-pulse" aria-hidden="true" />
          ) : (
            <span className="flex items-end gap-0.5 h-4 text-primary" aria-hidden="true">
              <span className="eq-bar eq-bar-1" />
              <span className="eq-bar eq-bar-2" />
              <span className="eq-bar eq-bar-3" />
            </span>
          )}
        </div>
      )}

      {/* Error state extra body */}
      {voiceState === "error-disabled" && (
        <div className="px-4 py-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-foreground">Voice mode is unavailable</p>
            <p className="text-xs text-muted-foreground mt-1">
              The wake-word model could not be loaded. Voice mode requires ONNX
              runtime support in your browser.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
