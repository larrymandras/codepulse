/**
 * useAstridrVoice — the wake-word-armed voice conversation engine for the
 * Ástríðr presence page (/chat).
 *
 * Composes:
 *   - useWakeWord      (openwakeword ONNX engine — "Hey Ástríðr" arms a turn)
 *   - useSpeechRecognition (Web Speech, continuous + interim)
 *   - voiceReducer     (the 6-state conversation machine)
 *   - useAstridrChat   (send / interrupt — the ONE conversation engine)
 *
 * Lifecycle (all gated by `enabled` — the page's mic toggle):
 *   enabled=false → nothing holds the mic. Toggling off aborts the recognizer,
 *     stops the wake engine (releases tracks), and tears the conversation down.
 *   enabled=true  → wake engine armed (state: idle). On wake: conversation
 *     opens (listening) and Web Speech runs continuously — through `speaking`,
 *     so a barge-in phrase can act on INTERIM results (instant interrupt).
 *     The conversation ends (re-arms the wake word) on an end-phrase
 *     ("goodbye", "thanks", "that's all" — NOT "stop", which only interrupts),
 *     the 14s follow-up window expiring, or 30s of silence.
 *
 * Behavior ported from VoiceModePanel.tsx (Phase 92/183 — CONV-01/02/03,
 * D-05..D-12): echo guard, interim barge-in, swallow-trailing-final,
 * conversational warm gate, noise/banter gate, pause-to-send debounce,
 * follow-up window, spoken strict-mode toggle. The panel's separate flushSend
 * path is gone — all sends go through chat.sendMessage, and barge-in goes
 * through chat.interrupt() (D-12: the partial reply rides into the next send).
 *
 * Voice-timing caution: changes here must be verified LIVE (restart-storm
 * lesson) — the recognizer is deliberately NOT auto-restarted on `onend`,
 * matching the live-verified panel behavior.
 */

import { useReducer, useEffect, useRef, useState, useCallback } from "react";
import { useWakeWord, type WakeWordStatus } from "@/hooks/useWakeWord";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import type { AstridrChat } from "@/hooks/useAstridrChat";
import {
  voiceReducer,
  isEndPhrase,
  isBargeInPhrase,
  isPureBargeInPhrase,
  isStrictModeCommand,
  type VoiceState,
} from "@/components/voice/voiceState";

// ─── Constants (UI-SPEC-pinned; identical to VoiceModePanel) ─────────────────

const SILENCE_TIMEOUT_MS = 30_000;
const SEND_DEBOUNCE_MS = 2_000;
const FOLLOW_UP_WINDOW_MS = 14_000;
const INTERRUPT_FLASH_MS = 1_500;

// ─── TEMPORARY live-repro instrumentation (2026-07-20) ───────────────────────
// Traces the full recognizer/state lifecycle so voice-timing bugs are fixed
// from a real trace, never from reasoning blind (restart-storm lesson).
// Console `[voice]` lines + window.__astridrVoiceTrace ring buffer (the Chat
// page shows a COPY TRACE chip while this is on). Remove once the natural-
// conversation pack is live-verified.

const VOICE_DEBUG = true;
/** Chat page shows a COPY TRACE chip while instrumentation is on. */
export const VOICE_DEBUG_ENABLED = VOICE_DEBUG;

declare global {
  interface Window {
    __astridrVoiceTrace?: Array<{ t: string; ev: string; d?: unknown }>;
  }
}

function trace(ev: string, d?: unknown) {
  if (!VOICE_DEBUG || typeof window === "undefined") return;
  const entry = { t: new Date().toISOString().slice(11, 23), ev, d };
  // eslint-disable-next-line no-console
  console.log(`[voice] ${entry.t} ${ev}`, d ?? "");
  const buf = (window.__astridrVoiceTrace ??= []);
  buf.push(entry);
  if (buf.length > 500) buf.shift();
}

// ─── Noise/banter gate (CONV-03, D-07/D-08/D-09/D-10) ────────────────────────

function shouldReject(
  text: string,
  isFollowUpWindowOpen: boolean,
  confidence?: number
): boolean {
  // D-08: barge-in phrases always bypass the gate, in any state.
  if (isBargeInPhrase(text)) return false;

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const minWords = isFollowUpWindowOpen ? 1 : 3; // D-07
  if (wordCount < minWords) return true;

  // D-09: confidence is a lenient tiebreaker only — near-zero floor, never a
  // hard reject of real speech (Chrome's confidence is bimodal).
  if (confidence !== undefined && confidence > 0 && confidence < 0.01) return true;

  return false;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UseAstridrVoiceOptions {
  /** The page's mic toggle. false = nothing may hold the mic. */
  enabled: boolean;
  /** Strict Mode (CONV-02): TTS end goes straight to idle, no follow-up window. */
  strictMode?: boolean;
  /** Spoken "strict mode on/off" command recognized (D-05). */
  onStrictModeChange?: (v: boolean) => void;
  /** The page's chat engine instance — sends and interrupts go through it. */
  chat: AstridrChat;
}

export interface UseAstridrVoiceReturn {
  voiceState: VoiceState;
  /** Live (unfinalized) speech. */
  interimText: string;
  /** Accumulated finalized utterance awaiting the pause-to-send debounce. */
  finalText: string;
  /** CONV-02: the 14s follow-up window is open. */
  followUpOpen: boolean;
  /** CONV-01: "— interrupted —" flash (~1.5s after a barge-in). */
  showInterruptFlash: boolean;
  /** A conversation is live (wake word already spoken). */
  conversationActive: boolean;
  wakeWordStatus: WakeWordStatus;
  wakeWordError: string | null;
  speechAvailable: boolean;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAstridrVoice({
  enabled,
  strictMode = false,
  onStrictModeChange = () => {},
  chat,
}: UseAstridrVoiceOptions): UseAstridrVoiceReturn {
  const [voiceState, dispatch] = useReducer(voiceReducer, "idle");

  // Latest chat/state/strictMode inside stable callbacks & timers.
  const chatRef = useRef(chat);
  chatRef.current = chat;
  const voiceStateRef = useRef<VoiceState>(voiceState);
  voiceStateRef.current = voiceState;
  const strictModeRef = useRef(strictMode);
  strictModeRef.current = strictMode;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const [interimText, setInterimText] = useState("");
  const [finalText, setFinalText] = useState("");
  const [showInterruptFlash, setShowInterruptFlash] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);

  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const followUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interruptFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pause-to-send accumulator (final segments joined until true silence).
  const accumulatedRef = useRef("");

  // D-11/D-12: the partial reply a barge-in interrupted — rides into the NEXT
  // chat.send as interrupted_reply, then clears.
  const interruptedReplyRef = useRef("");

  // Conversational warm gate (CONV-03): once she replied or you barged in,
  // short follow-ups ("continue", "yes") are accepted. Ref, not state — an
  // interim-triggered re-render must not wipe it (the "she freezes when I say
  // continue" bug).
  const conversationWarmRef = useRef(false);

  // Barge-in latches (see VoiceModePanel history): fire once per speaking turn;
  // swallow the trailing FINAL of the barge-in utterance so "stop" doesn't
  // fall through to the end-phrase check.
  const bargeInFiredRef = useRef(false);
  const bargeInSwallowFinalRef = useRef(false);

  // ─── Timer helpers ─────────────────────────────────────────────────────────

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

  const clearFollowUpWindow = useCallback(() => {
    if (followUpTimerRef.current) {
      clearTimeout(followUpTimerRef.current);
      followUpTimerRef.current = null;
    }
    setFollowUpOpen(false);
  }, []);

  // ─── Recognition (declared before teardown/handlers that reference it) ─────

  const handleInterimResultRef = useRef<(text: string) => void>(() => {});
  const handleFinalResultRef = useRef<(text: string, confidence?: number) => void>(
    () => {}
  );

  const {
    start: recognitionStart,
    stop: recognitionStop,
    abort: recognitionAbort,
    speechAvailable,
  } = useSpeechRecognition({
    continuous: true,
    interimResults: true,
    onFinalResult: (t, c) => handleFinalResultRef.current(t, c),
    onInterimResult: (t) => handleInterimResultRef.current(t),
    onEnd: () => {
      // Natural recognizer end mid-conversation: deliberately NO auto-restart
      // (restart-storm lesson — live-verified panel parity). The 30s silence
      // timer re-arms the wake word; the next wake restarts recognition.
      trace("recognizer.end", { state: voiceStateRef.current });
    },
    onError: (error) => {
      trace("recognizer.error", { error, state: voiceStateRef.current });
    },
  });

  // ─── Conversation teardown (end-phrase / silence / follow-up expiry / off) ─

  const teardownConversation = useCallback(
    (mode: "stop" | "abort") => {
      trace("conversation.teardown", { mode, state: voiceStateRef.current });
      clearSilenceTimer();
      clearSendTimer();
      clearFollowUpWindow();
      accumulatedRef.current = "";
      interruptedReplyRef.current = "";
      conversationWarmRef.current = false;
      bargeInFiredRef.current = false;
      bargeInSwallowFinalRef.current = false;
      setInterimText("");
      setFinalText("");
      if (mode === "abort") recognitionAbort();
      else recognitionStop();
    },
    [clearSilenceTimer, clearSendTimer, clearFollowUpWindow, recognitionAbort, recognitionStop]
  );

  const endConversation = useCallback(
    (mode: "stop" | "abort" = "stop") => {
      teardownConversation(mode);
      dispatch({ type: "END" });
    },
    [teardownConversation]
  );

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      trace("silence.timeout → re-arm");
      endConversation();
    }, SILENCE_TIMEOUT_MS);
  }, [endConversation]);

  // ─── Send (end-of-turn flush) ──────────────────────────────────────────────

  const flushSend = useCallback(async () => {
    clearSendTimer();
    const message = accumulatedRef.current.trim();
    trace("flushSend", { message });
    if (!message) return;
    accumulatedRef.current = "";
    setFinalText("");
    dispatch({ type: "FINAL_RESULT" });

    // D-12: thread the barged-in partial (if any) into this turn, then clear.
    // interrupt() is also called unconditionally: if a turn is still in flight
    // (speaking over her "thinking", or right after a barge-in) it cancels it
    // and returns any partial we don't already hold; when idle it's a no-op "".
    const prior = interruptedReplyRef.current;
    interruptedReplyRef.current = "";
    const partial = chatRef.current.interrupt();
    const interruptedReply = prior || partial || undefined;

    await chatRef.current.sendMessage(message, { interruptedReply });
  }, [clearSendTimer]);

  // ─── Barge-in (CONV-01, D-06/D-08/D-11/D-12) ──────────────────────────────

  const handleBargeIn = useCallback(() => {
    if (bargeInFiredRef.current) return;
    trace("barge-in.fired");
    bargeInFiredRef.current = true;
    bargeInSwallowFinalRef.current = true;
    // You interrupted her mid-reply — clearly mid-conversation: accept whatever
    // comes next, however short.
    conversationWarmRef.current = true;

    // Cuts TTS instantly, cancels the server turn, returns the partial reply.
    const partial = chatRef.current.interrupt();
    if (partial) interruptedReplyRef.current = partial;

    dispatch({ type: "BARGE_IN" });

    setShowInterruptFlash(true);
    if (interruptFlashTimerRef.current) clearTimeout(interruptFlashTimerRef.current);
    interruptFlashTimerRef.current = setTimeout(() => {
      setShowInterruptFlash(false);
      interruptFlashTimerRef.current = null;
    }, INTERRUPT_FLASH_MS);
  }, []);

  // ─── Recognition handlers (latest-closure via refs) ────────────────────────

  handleInterimResultRef.current = (text: string) => {
    // Echo guard + interim barge-in (D-06/CONV-01): while she's speaking the
    // recognizer stays live but ONLY a barge-in phrase may act — checked on
    // INTERIM results so the interrupt fires the instant the phrase is heard
    // (Chrome takes seconds to finalize under continuous TTS).
    if (voiceStateRef.current === "speaking") {
      if (isBargeInPhrase(text)) {
        trace("interim.barge-in", { text });
        handleBargeIn();
      } else {
        trace("interim.echo-dropped", { text });
      }
      return;
    }

    trace("interim", { text, state: voiceStateRef.current });
    setInterimText(text);
    dispatch({ type: "INTERIM_RESULT" });
    resetSilenceTimer();
    clearSendTimer(); // still talking — defer the end-of-turn send
    clearFollowUpWindow(); // CONV-02: a new interim consumes the window
  };

  handleFinalResultRef.current = (text: string, confidence?: number) => {
    trace("final", { text, confidence, state: voiceStateRef.current });

    // Echo guard (CONV-01, D-06/D-08): during speaking, only barge-in acts.
    if (voiceStateRef.current === "speaking") {
      if (isBargeInPhrase(text)) {
        trace("final.barge-in", { text });
        handleBargeIn();
      } else {
        trace("final.echo-dropped", { text });
      }
      return;
    }

    // Swallow the trailing final of the barge-in utterance ("stop" would
    // otherwise be re-processed after the interim already fired the interrupt).
    if (bargeInSwallowFinalRef.current) {
      bargeInSwallowFinalRef.current = false;
      if (isBargeInPhrase(text)) {
        trace("final.barge-swallowed", { text });
        return;
      }
    }

    setInterimText("");
    resetSilenceTimer();

    // Pure interrupt reflex outside `speaking` ("stop", "wait", "hold on" with
    // no content around it): cancel a thinking turn if one is in flight,
    // otherwise ignore — NEVER send it to Ástríðr as a literal message.
    if (isPureBargeInPhrase(text)) {
      trace("final.pure-barge", { text, inFlight: chatRef.current.isStreaming });
      if (chatRef.current.isStreaming) {
        conversationWarmRef.current = true;
        const partial = chatRef.current.interrupt();
        if (partial) interruptedReplyRef.current = partial;
        dispatch({ type: "BARGE_IN" });
        setShowInterruptFlash(true);
        if (interruptFlashTimerRef.current) clearTimeout(interruptFlashTimerRef.current);
        interruptFlashTimerRef.current = setTimeout(() => {
          setShowInterruptFlash(false);
          interruptFlashTimerRef.current = null;
        }, INTERRUPT_FLASH_MS);
      }
      return;
    }

    // Spoken strict-mode toggle (D-05): client fast-path, no LLM turn.
    const strictCommand = isStrictModeCommand(text);
    if (strictCommand) {
      trace("final.strict-command", { text, to: strictCommand });
      onStrictModeChange(strictCommand === "on");
      clearFollowUpWindow();
      return;
    }

    // End-phrase ("goodbye"/"thanks"/"that's all" — NOT "stop"): end the
    // conversation and re-arm the wake word. Discard accumulated text (an
    // abort, not a message — D-01).
    if (isEndPhrase(text)) {
      trace("final.end-phrase", { text });
      endConversation();
      return;
    }

    // Noise/banter gate (CONV-03): reject cold fragments <3 words; warm
    // conversations accept short replies. Zero UI trace on reject.
    if (shouldReject(text, conversationWarmRef.current || followUpOpen, confidence)) {
      trace("final.noise-rejected", {
        text,
        confidence,
        warm: conversationWarmRef.current,
        followUpOpen,
      });
      return;
    }
    trace("final.accepted", { text, warm: conversationWarmRef.current });

    // CONV-02: a real accepted utterance consumes the follow-up window.
    clearFollowUpWindow();

    // Accumulate; send only after SEND_DEBOUNCE_MS of true silence (a
    // mid-thought pause must not chop the message).
    accumulatedRef.current = `${accumulatedRef.current} ${text}`.trim();
    setFinalText(accumulatedRef.current);

    clearSendTimer();
    sendTimerRef.current = setTimeout(() => {
      void flushSend();
    }, SEND_DEBOUNCE_MS);
  };

  // ─── TTS lifecycle → state machine (echo guard arming, follow-up window) ──

  const wasPlayingRef = useRef(false);
  useEffect(() => {
    if (chat.ttsIsPlaying && !wasPlayingRef.current) {
      wasPlayingRef.current = true;
      trace("tts.start", { state: voiceStateRef.current });
      // Re-arm barge-in for this speaking turn; the session is now warm.
      bargeInFiredRef.current = false;
      conversationWarmRef.current = true;
      dispatch({ type: "TTS_START" });
    } else if (!chat.ttsIsPlaying && wasPlayingRef.current) {
      wasPlayingRef.current = false;
      trace("tts.end", { state: voiceStateRef.current, strict: strictModeRef.current });
      dispatch({ type: "TTS_END", strictMode: strictModeRef.current });

      // Only a live conversation gets a follow-up window / silence countdown —
      // a typed-turn TTS while armed-idle must not start conversation timers.
      if (voiceStateRef.current === "idle") return;
      resetSilenceTimer();

      if (followUpTimerRef.current) clearTimeout(followUpTimerRef.current);
      if (!strictModeRef.current) {
        trace("followup.open", { ms: FOLLOW_UP_WINDOW_MS });
        setFollowUpOpen(true);
        followUpTimerRef.current = setTimeout(() => {
          trace("followup.expire → re-arm");
          dispatch({ type: "FOLLOW_UP_EXPIRE" });
          setFollowUpOpen(false);
          followUpTimerRef.current = null;
          // Window closed silently — conversation over, re-arm the wake word.
          teardownConversation("stop");
        }, FOLLOW_UP_WINDOW_MS);
      } else {
        // Strict mode: reducer already went to idle — tear down to re-arm.
        setFollowUpOpen(false);
        teardownConversation("stop");
      }
    }
  }, [chat.ttsIsPlaying, resetSilenceTimer, teardownConversation]);

  // ─── Wake word engine ─────────────────────────────────────────────────────

  const {
    status: wakeWordStatus,
    errorReason: wakeWordError,
    start: wakeWordStart,
    stop: wakeWordStop,
  } = useWakeWord({
    baseUrl: "/openwakeword",
    onWake: () => {
      if (!enabledRef.current) return;
      if (voiceStateRef.current !== "idle") {
        trace("wake.ignored", { state: voiceStateRef.current });
        return; // already in a conversation
      }
      trace("wake → conversation open");
      dispatch({ type: "WAKE" });
      setInterimText("");
      setFinalText("");
      recognitionStart();
      resetSilenceTimer();
    },
  });

  // Gate the wake engine on `enabled` (VOX-04 — no mic unless explicitly on).
  // Start only from a clean 'idle'; NEVER auto-retry from 'error-disabled'
  // (stop() would reset to idle → start → fail → … an infinite retry storm).
  // Recovery from error: toggle off (resets to idle), then on.
  useEffect(() => {
    if (!enabled) {
      trace("mic.off → release everything");
      wakeWordStop();
      endConversation("abort"); // release the recognizer mic instantly
    } else if (wakeWordStatus === "idle") {
      trace("mic.on → wake engine start");
      void wakeWordStart();
    }
    // loading / ready / error-disabled while enabled → do nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, wakeWordStatus]);

  // Mic toggle drives spoken replies: ON → her TTS auto-plays; OFF → silent.
  useEffect(() => {
    chatRef.current.setTtsEnabled(enabled);
  }, [enabled]);

  // Unmount: release everything (wake engine cleans itself up in useWakeWord).
  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (sendTimerRef.current) clearTimeout(sendTimerRef.current);
      if (followUpTimerRef.current) clearTimeout(followUpTimerRef.current);
      if (interruptFlashTimerRef.current) clearTimeout(interruptFlashTimerRef.current);
    };
  }, []);

  return {
    voiceState,
    interimText,
    finalText,
    followUpOpen,
    showInterruptFlash,
    conversationActive: voiceState !== "idle" && voiceState !== "error-disabled",
    wakeWordStatus,
    wakeWordError,
    speechAvailable,
  };
}
