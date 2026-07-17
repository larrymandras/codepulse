/**
 * VoiceModePanel.tsx — Voice mode UI rendered inside CommandDialog.
 *
 * Rendered by CommandPalette when voiceMode=true. Implements:
 *   - Continuous turn loop (listening → transcribing → processing → speaking → listening)
 *   - Live transcript via useSpeechRecognition (continuous + interimResults)
 *   - Streamed reply via AstridrWSContext subscribeEvent run.text / run.tts / run.completed
 *   - TTS auto-play via useTtsPlayback
 *   - Feedback guard / echo guard: recognizer stays LIVE during `speaking`; only a
 *     recognized barge-in phrase acts (CONV-01, D-06) — all other recognized text
 *     is dropped with zero UI trace (this IS the echo guard: her own TTS is never
 *     treated as a real command).
 *   - Barge-in (CONV-01): a recognized barge-in phrase during `speaking` pauses TTS
 *     instantly, cancels the in-flight server turn (`agent.stop`), and marks the
 *     partial reply interrupted so it rides into the next `chat.send` (D-11/D-12).
 *   - 14s follow-up window + Strict Mode (CONV-02) and the noise/banter gate
 *     (CONV-03) are implemented alongside the above.
 *   - End-phrase exit ("stop", "goodbye", etc.) via isEndPhrase
 *   - ~30s silence timeout dispatches END + calls onClose
 *
 * Phase 92, Plan 04 — VOX-02, VOX-03.
 * Phase 183, Plan 03 — CONV-01, CONV-02, CONV-03.
 */

import { useReducer, useEffect, useRef, useState, useCallback } from "react";
import { X, Volume2, Loader2, AlertCircle } from "lucide-react";
import { useAstridrWS } from "@/contexts/AstridrWSContext";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useTtsPlayback } from "@/hooks/useTtsPlayback";
import { AvatarAura } from "./AvatarAura";
import {
  voiceReducer,
  isEndPhrase,
  isBargeInPhrase,
  isStrictModeCommand,
  type VoiceState,
} from "./voiceState";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VoiceModePanelProps {
  /** Initial voice state (defaults to 'listening' if not provided). */
  voiceState?: VoiceState;
  /** Called when the panel should close (end-phrase, X button, silence timeout, Escape). */
  onClose: () => void;
  /** Strict Mode: when true, TTS_END goes straight to idle (no follow-up window). Defaults false. */
  strictMode?: boolean;
  /** Called when a spoken "strict mode on/off" command is recognized (D-05), or the manual toggle changes (185 threads this to the toggle). */
  onStrictModeChange?: (v: boolean) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SILENCE_TIMEOUT_MS = 30_000; // 30 seconds (UI-SPEC §"Silence timeout (30s)")
// Pause-to-send: accumulate final speech segments and only send the whole
// utterance after this much true silence, so a mid-thought pause (e.g. while
// walking) no longer chops the message at the first pause.
const SEND_DEBOUNCE_MS = 2_000;
// CONV-02: follow-up window after a reply (strict mode off) — UI-SPEC pins 14s.
const FOLLOW_UP_WINDOW_MS = 14_000;
// CONV-01: interrupt flash duration (UI-SPEC §"Barge-in").
const INTERRUPT_FLASH_MS = 1_500;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

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

function VoiceStateBadge({
  state,
  labelOverride,
  instant,
}: {
  state: VoiceState;
  /** CONV-02: overrides the label with "Still listening…" while the follow-up window is open. */
  labelOverride?: string;
  /** CONV-01: skip the transition on a barge-in — speaking→transcribing must feel instantaneous. */
  instant?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={stateDotClass(state)} />
      <span
        aria-live="assertive"
        aria-atomic="true"
        aria-label="Voice mode status"
        className={
          instant
            ? "text-xs font-semibold text-foreground"
            : "text-xs font-semibold text-foreground transition-colors duration-200"
        }
      >
        {labelOverride ?? stateLabel(state)}
      </span>
    </div>
  );
}

function VoiceTranscriptArea({
  interimText,
  finalText,
  state,
  showInterruptFlash,
}: {
  interimText: string;
  finalText: string;
  state: VoiceState;
  /** CONV-01, D-11: transient "— interrupted —" message shown for ~1500ms after a barge-in. */
  showInterruptFlash?: boolean;
}) {
  const isEmpty = !interimText && !finalText;
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      aria-label="Live transcript"
      className="min-h-[48px] px-4 py-3 font-mono text-[10px] uppercase tracking-wide"
    >
      {showInterruptFlash && (
        <div className="text-[10px] font-semibold uppercase tracking-wide text-(--status-warn)">
          — interrupted —
        </div>
      )}
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

function FollowUpCountdownBar({ active }: { active: boolean }) {
  // Start at full width, then collapse to 0% on next paint so the CSS
  // `transition: width` actually animates (UI-SPEC §"Follow-up countdown bar").
  const [collapsed, setCollapsed] = useState(false);
  const reducedMotion = prefersReducedMotion();

  useEffect(() => {
    if (!active) {
      setCollapsed(false);
      return;
    }
    if (reducedMotion) return; // static half-filled bar, no animation
    const id = requestAnimationFrame(() => setCollapsed(true));
    return () => cancelAnimationFrame(id);
  }, [active, reducedMotion]);

  if (!active) return null;

  return (
    <>
      <div className="h-[3px] w-full bg-primary/20" aria-hidden="true">
        <div
          className="h-full bg-primary"
          style={
            reducedMotion
              ? { width: "50%" }
              : {
                  width: collapsed ? "0%" : "100%",
                  transitionProperty: "width",
                  transitionDuration: `${FOLLOW_UP_WINDOW_MS}ms`,
                  transitionTimingFunction: "linear",
                }
          }
        />
      </div>
      {/* One-shot announcement at window-open only — never per-tick (UI-SPEC §aria-live). */}
      <span className="sr-only" role="status" aria-live="polite">
        Follow-up window open — speak within 14 seconds, or say &lsquo;Hey
        Ástríðr&rsquo; again after.
      </span>
    </>
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
  strictMode = false,
  onStrictModeChange = () => {},
}: VoiceModePanelProps) {
  const { sendCommand, subscribeEvent } = useAstridrWS();

  // Internal state machine — initialised from prop (caller controls initial state)
  const [voiceState, dispatch] = useReducer(voiceReducer, initialVoiceState);

  // Transcript state
  const [interimText, setInterimText] = useState("");
  const [finalText, setFinalText] = useState("");

  // Reply stream
  const [replyText, setReplyText] = useState("");
  // Mirrors replyText for use inside callbacks without a stale closure
  // (barge-in needs the LATEST streamed reply text at the moment it fires).
  const replyTextRef = useRef("");
  useEffect(() => {
    replyTextRef.current = replyText;
  }, [replyText]);

  // Active session for routing run.text/run.tts/run.completed
  const activeSessionRef = useRef<string | null>(null);

  // Silence timeout ref
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pause-to-send: debounce timer + running transcript accumulator. Final
  // segments accumulate here; interim results (user resuming) cancel the pending
  // send; the send only fires after SEND_DEBOUNCE_MS of true silence.
  const sendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumulatedRef = useRef("");

  // CONV-01 (D-11/D-12): the partial reply text a barge-in interrupted, sourced
  // ONLY from replyTextRef (Ástríðr's own streamed text) — never user-editable
  // state. Rides into the NEXT chat.send as interrupted_reply, then is cleared.
  const interruptedReplyRef = useRef("");

  // CONV-01: transient "— interrupted —" flash shown ~1500ms after a barge-in.
  const [showInterruptFlash, setShowInterruptFlash] = useState(false);
  const interruptFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // CONV-01: skip the state-badge transition for one render on barge-in so
  // speaking→transcribing feels instantaneous (UI-SPEC).
  const [instantBadgeTransition, setInstantBadgeTransition] = useState(false);
  useEffect(() => {
    if (!instantBadgeTransition) return;
    const t = setTimeout(() => setInstantBadgeTransition(false), 50);
    return () => clearTimeout(t);
  }, [instantBadgeTransition]);

  // CONV-02: 14s follow-up window (strict mode off) opened on TTS_END. Bar
  // renders while open; a new interim result or expiry closes it.
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const followUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFollowUpWindow = useCallback(() => {
    if (followUpTimerRef.current) {
      clearTimeout(followUpTimerRef.current);
      followUpTimerRef.current = null;
    }
    setFollowUpOpen(false);
  }, []);

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

  const clearSendTimer = useCallback(() => {
    if (sendTimerRef.current) {
      clearTimeout(sendTimerRef.current);
      sendTimerRef.current = null;
    }
  }, []);

  // End-of-turn: send the full accumulated utterance to Ástríðr. No-op if empty.
  const flushSend = useCallback(async () => {
    clearSendTimer();
    const message = accumulatedRef.current.trim();
    if (!message) return;
    accumulatedRef.current = "";
    dispatch({ type: "FINAL_RESULT" });
    setReplyText("");
    // D-12: thread the prior interrupted partial (if any) into this turn, then
    // clear it — it only ever rides into the NEXT turn once.
    const interruptedReply = interruptedReplyRef.current || undefined;
    interruptedReplyRef.current = "";
    try {
      const ack = await sendCommand({
        type: "chat.send",
        message,
        ...(interruptedReply ? { interrupted_reply: interruptedReply } : {}),
      });
      const sessionId =
        (ack.session_id as string | undefined) ??
        (ack.data?.session_id as string | undefined) ??
        String(Date.now());
      activeSessionRef.current = sessionId;
    } catch (err) {
      console.warn("VoiceModePanel: sendCommand failed:", err);
      dispatch({ type: "ERROR" });
    }
  }, [sendCommand, clearSendTimer]);

  // ─── TTS playback ───────────────────────────────────────────────────────────

  // Analyser is intentionally NOT enabled: during a voice session it created an
  // extra AudioContext that (together with the removed avatar mic tap) could
  // disturb the wake-word engine. The avatar pulses synthetically for now; real
  // her-voice reactivity will be re-added via a contention-free path.
  const { play: ttsPlay, stop: ttsStop, isPlaying } = useTtsPlayback();
  const ttsAnalyser = null;

  // ─── Barge-in (CONV-01, D-06/D-08/D-11/D-12) ───────────────────────────────
  // Fires when a barge-in phrase is recognized while state === "speaking".
  // Cuts TTS instantly (no fade), cancels the in-flight server turn, marks the
  // partial reply interrupted, and shows the interrupt flash.

  const handleBargeIn = useCallback(() => {
    ttsStop(); // audio.pause() equivalent — instant, no fade
    dispatch({ type: "BARGE_IN" });
    setInstantBadgeTransition(true);

    void sendCommand({
      type: "agent.stop",
      request_id: crypto.randomUUID(),
      session_id: activeSessionRef.current,
    });

    if (replyTextRef.current) {
      interruptedReplyRef.current = replyTextRef.current;
      setReplyText((prev) => (prev ? `${prev} [interrupted]` : prev));
    }

    setShowInterruptFlash(true);
    if (interruptFlashTimerRef.current) clearTimeout(interruptFlashTimerRef.current);
    interruptFlashTimerRef.current = setTimeout(() => {
      setShowInterruptFlash(false);
      interruptFlashTimerRef.current = null;
    }, INTERRUPT_FLASH_MS);
  }, [sendCommand, ttsStop]);

  // ─── Speech recognition ─────────────────────────────────────────────────────

  const handleInterimResult = useCallback(
    (text: string) => {
      // Echo guard (D-06): while she's speaking, the recognizer stays live but
      // ONLY a barge-in phrase (checked on the final result) may act — any
      // other recognized text, interim or final, is dropped with zero UI trace.
      if (voiceState === "speaking") return;

      setInterimText(text);
      dispatch({ type: "INTERIM_RESULT" });
      resetSilenceTimer();
      // User is still speaking — defer the end-of-turn send.
      clearSendTimer();
      // CONV-02: a new interim result consumes the follow-up window (the bar
      // clears — a fresh turn has started, not a lingering countdown).
      clearFollowUpWindow();
    },
    [voiceState, resetSilenceTimer, clearSendTimer, clearFollowUpWindow]
  );

  const handleFinalResult = useCallback(
    (text: string) => {
      // Echo guard + barge-in (CONV-01, D-06/D-08): while she's speaking, the
      // recognizer stays live only to catch a barge-in phrase. Any other
      // recognized text is dropped silently — this IS the echo guard.
      if (voiceState === "speaking") {
        if (isBargeInPhrase(text)) {
          handleBargeIn();
        }
        return;
      }

      setInterimText("");
      resetSilenceTimer();

      // Spoken strict-mode toggle (CONV-02, D-05): intercepted BEFORE any turn
      // dispatch — a client regex fast-path, no LLM turn, no chat.send.
      const strictCommand = isStrictModeCommand(text);
      if (strictCommand) {
        onStrictModeChange(strictCommand === "on");
        clearFollowUpWindow();
        return;
      }

      // End-phrase: exit voice mode. Discard any accumulated text — saying
      // "stop"/"goodbye" is an abort, not a message. (T-92-13 mitigation — D-01)
      if (isEndPhrase(text)) {
        clearSendTimer();
        accumulatedRef.current = "";
        dispatch({ type: "END" });
        clearSilenceTimer();
        onClose();
        return;
      }

      // CONV-02: a real accepted utterance consumes the follow-up window.
      clearFollowUpWindow();

      // Accumulate this finalized segment and show the running transcript.
      // Do NOT send yet — a mid-thought pause finalizes a segment but the user
      // may still be talking. Debounce the send: it fires only after
      // SEND_DEBOUNCE_MS of true silence, and handleInterimResult cancels it if
      // the user resumes. This is what stops long messages being cut off.
      accumulatedRef.current = `${accumulatedRef.current} ${text}`.trim();
      setFinalText(accumulatedRef.current);

      clearSendTimer();
      sendTimerRef.current = setTimeout(() => {
        void flushSend();
      }, SEND_DEBOUNCE_MS);
    },
    [
      voiceState,
      handleBargeIn,
      onStrictModeChange,
      clearFollowUpWindow,
      resetSilenceTimer,
      clearSilenceTimer,
      clearSendTimer,
      onClose,
      flushSend,
    ]
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

  // ─── Feedback guard / echo guard (T-92-10, rewritten CONV-01/D-06) ─────────
  // TTS starting no longer stops the recognizer (recognitionStop() removed) —
  // it must stay LIVE through `speaking` so a barge-in phrase can be caught.
  // Normal accumulate/send is suppressed while speaking (handleFinalResult's
  // echo guard above); only isBargeInPhrase() matches act.

  const wasPlayingRef = useRef(false);

  useEffect(() => {
    if (isPlaying && !wasPlayingRef.current) {
      // TTS just started — recognizer stays live (echo guard handles the rest).
      dispatch({ type: "TTS_START" });
      wasPlayingRef.current = true;
    } else if (!isPlaying && wasPlayingRef.current) {
      // TTS just ended — recognizer was never stopped, so no restart needed.
      dispatch({ type: "TTS_END", strictMode });
      wasPlayingRef.current = false;
      resetSilenceTimer();

      // CONV-02: strict off → open the 14s follow-up window; strict on → the
      // reducer already went straight to idle, no window.
      if (followUpTimerRef.current) clearTimeout(followUpTimerRef.current);
      if (!strictMode) {
        setFollowUpOpen(true);
        followUpTimerRef.current = setTimeout(() => {
          dispatch({ type: "FOLLOW_UP_EXPIRE" });
          setFollowUpOpen(false);
          followUpTimerRef.current = null;
        }, FOLLOW_UP_WINDOW_MS);
      } else {
        setFollowUpOpen(false);
      }
    }
  }, [isPlaying, strictMode, resetSilenceTimer]);

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
      clearSendTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // ─── Handle close ───────────────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    clearSilenceTimer();
    clearSendTimer();
    accumulatedRef.current = "";
    recognitionStop();
    dispatch({ type: "END" });
    onClose();
  }, [onClose, clearSilenceTimer, clearSendTimer, recognitionStop]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col p-0" role="region" aria-label="Voice mode">
      {/* Header row: state badge + close button */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <VoiceStateBadge
          state={voiceState}
          instant={instantBadgeTransition}
          labelOverride={followUpOpen ? "Still listening…" : undefined}
        />
        <button
          autoFocus
          onClick={handleClose}
          aria-label="Close voice mode"
          className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Follow-up countdown bar (CONV-02) — between header and avatar */}
      <FollowUpCountdownBar active={followUpOpen} />

      {/* Audio-reactive avatar (the cyber-Norse Ástríðr) */}
      {voiceState !== "error-disabled" && (
        <div className="flex justify-center pt-5 pb-1">
          <AvatarAura state={voiceState} ttsAnalyser={ttsAnalyser} />
        </div>
      )}

      {/* Transcript area */}
      <VoiceTranscriptArea
        interimText={interimText}
        finalText={finalText}
        state={voiceState}
        showInterruptFlash={showInterruptFlash}
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
            <span className="flex items-center gap-1.5">
              {/* Barge-in-armed dot (CONV-01): dim, secondary cue — "still listening for an interrupt" */}
              <span
                className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse"
                aria-hidden="true"
              />
              <Volume2 className="h-4 w-4 text-primary animate-pulse" aria-hidden="true" />
            </span>
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
