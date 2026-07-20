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
 *     so you can interrupt her. The conversation ends (re-arms the wake word)
 *     on an end-phrase ("goodbye", "thanks", "that's all" — NOT "stop", which
 *     only interrupts), the follow-up window expiring, or 30s of YOUR silence.
 *
 * Natural-conversation behaviors (2026-07-20, built from a live trace):
 *   - Recognizer keep-alive: Chrome silently ends its recognizer after ~14s
 *     without speech (the live trace showed it dying while she was thinking,
 *     deafening the whole conversation). An unexpected end during a live
 *     conversation now restarts it — storm-guarded (max 3 restarts/10s,
 *     never after an intentional stop), per the restart-storm lesson.
 *   - Talk-over with content: during `speaking`, recognized speech is
 *     fingerprinted against her own streamed reply text. Her mic echo is
 *     dropped (the echo guard); anything that is NOT her echo interrupts her
 *     AND becomes your message — no "stop" needed.
 *   - Turn-scoped silence clock: the 30s silence timeout only counts YOUR
 *     turn. It pauses when a message sends and resumes when her reply ends
 *     (the trace showed it tearing the conversation down mid-reply).
 *   - Adaptive send: short complete answers ("no", "yes", "the second one")
 *     in a warm conversation send after 800ms, not the full 2s pause.
 *   - Stay-hot on her question: if her reply ends with "?", the follow-up
 *     window is 30s instead of 14s — she asked, she's waiting.
 *   - Silent-turn watchdog: a turn that completes with no audio still closes
 *     properly (back to listening) instead of wedging in `processing`.
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

// ─── Constants ───────────────────────────────────────────────────────────────

const SILENCE_TIMEOUT_MS = 30_000;
const SEND_DEBOUNCE_MS = 2_000;
/** Adaptive send: a short complete answer in a warm conversation. */
const SHORT_SEND_DEBOUNCE_MS = 800;
const SHORT_ANSWER_MAX_WORDS = 3;
const FOLLOW_UP_WINDOW_MS = 14_000;
/** Stay-hot: she ended on a question — she's waiting for the answer. */
const QUESTION_FOLLOW_UP_MS = 30_000;
const INTERRUPT_FLASH_MS = 1_500;
/** Turn completed but no TTS arrived within this — close the turn silently. */
const SILENT_TURN_GRACE_MS = 3_000;
/** Keep-alive storm guard: max restarts inside the window, then give up. */
const RESTART_MAX = 3;
const RESTART_WINDOW_MS = 10_000;
const RESTART_DELAY_MS = 300;

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

// ─── Echo fingerprint (talk-over-with-content) ───────────────────────────────

function fingerprintWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * True if what the mic heard is (probably) Ástríðr's own TTS leaking back in.
 * Word-set overlap against her streamed reply text: if ≥75% of the heard
 * words appear in her reply, it's echo. Utterances under 2 words are treated
 * as echo (too little signal to overrule the guard — the explicit barge-in
 * phrases already cover short interrupts).
 */
export function isEchoOfReply(heard: string, reply: string): boolean {
  const heardWords = fingerprintWords(heard);
  if (heardWords.length < 2) return true;
  if (!reply) return false;
  const replySet = new Set(fingerprintWords(reply));
  const hits = heardWords.filter((w) => replySet.has(w)).length;
  return hits / heardWords.length >= 0.75;
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
  /** CONV-02: the follow-up window is open. */
  followUpOpen: boolean;
  /** Duration of the currently-open follow-up window (stay-hot aware). */
  followUpMs: number;
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
  const [followUpMs, setFollowUpMs] = useState(FOLLOW_UP_WINDOW_MS);

  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const followUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interruptFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silentTurnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Wake idempotency: the wake worker can deliver detections back-to-back in
  // one tick (the live trace showed a double "conversation open" racing two
  // recognizer starts). Synchronous latch; cleared on teardown.
  const conversationOpenRef = useRef(false);

  // Keep-alive bookkeeping: intentional stops must NOT trigger a restart, and
  // restarts are rate-limited (storm guard).
  const intentionalStopRef = useRef(false);
  const restartTimesRef = useRef<number[]>([]);

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

  const clearSilentTurnTimer = useCallback(() => {
    if (silentTurnTimerRef.current) {
      clearTimeout(silentTurnTimerRef.current);
      silentTurnTimerRef.current = null;
    }
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
      trace("recognizer.end", { state: voiceStateRef.current });
      // Keep-alive: Chrome ends its recognizer after ~14s without speech —
      // during a live conversation that deafens barge-in and follow-ups (the
      // live-trace bug: it died while she was thinking). Restart, but ONLY:
      //   - when the end was not one we asked for (intentionalStopRef),
      //   - while a conversation is live and the mic toggle is on,
      //   - within the storm guard (max RESTART_MAX per RESTART_WINDOW_MS).
      if (intentionalStopRef.current) {
        intentionalStopRef.current = false;
        return;
      }
      const active =
        voiceStateRef.current !== "idle" && voiceStateRef.current !== "error-disabled";
      if (!active || !enabledRef.current) return;

      const now = Date.now();
      restartTimesRef.current = restartTimesRef.current.filter(
        (t) => now - t < RESTART_WINDOW_MS
      );
      if (restartTimesRef.current.length >= RESTART_MAX) {
        trace("recognizer.restart-suppressed", { reason: "storm-guard" });
        return;
      }
      restartTimesRef.current.push(now);

      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      restartTimerRef.current = setTimeout(() => {
        restartTimerRef.current = null;
        const stillActive =
          voiceStateRef.current !== "idle" &&
          voiceStateRef.current !== "error-disabled";
        if (stillActive && enabledRef.current) {
          trace("recognizer.restart");
          recognitionStart();
        }
      }, RESTART_DELAY_MS);
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
      clearSilentTurnTimer();
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      accumulatedRef.current = "";
      interruptedReplyRef.current = "";
      conversationWarmRef.current = false;
      bargeInFiredRef.current = false;
      bargeInSwallowFinalRef.current = false;
      conversationOpenRef.current = false;
      restartTimesRef.current = [];
      setInterimText("");
      setFinalText("");
      intentionalStopRef.current = true; // the coming recognizer end is ours
      if (mode === "abort") recognitionAbort();
      else recognitionStop();
    },
    [
      clearSilenceTimer,
      clearSendTimer,
      clearFollowUpWindow,
      clearSilentTurnTimer,
      recognitionAbort,
      recognitionStop,
    ]
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

  // ─── Turn end (her reply finished — with or without audio) ─────────────────
  // Shared by the TTS-end path and the silent-turn watchdog. Opens the
  // follow-up window (strict off), stay-hot-extended when she asked a question.

  const onTurnEnd = useCallback(() => {
    if (voiceStateRef.current === "idle") return; // typed-turn TTS while armed
    resetSilenceTimer(); // her turn is over — YOUR silence clock resumes

    if (followUpTimerRef.current) clearTimeout(followUpTimerRef.current);
    if (!strictModeRef.current) {
      const reply = chatRef.current.streamingReplyRef.current;
      const askedQuestion = /\?\s*$/.test(reply.trim());
      const windowMs = askedQuestion ? QUESTION_FOLLOW_UP_MS : FOLLOW_UP_WINDOW_MS;
      trace("followup.open", { ms: windowMs, askedQuestion });
      setFollowUpMs(windowMs);
      setFollowUpOpen(true);
      followUpTimerRef.current = setTimeout(() => {
        trace("followup.expire → re-arm");
        dispatch({ type: "FOLLOW_UP_EXPIRE" });
        setFollowUpOpen(false);
        followUpTimerRef.current = null;
        // Window closed silently — conversation over, re-arm the wake word.
        teardownConversation("stop");
      }, windowMs);
    } else {
      // Strict mode: reducer already went to idle — tear down to re-arm.
      setFollowUpOpen(false);
      teardownConversation("stop");
    }
  }, [resetSilenceTimer, teardownConversation]);

  // ─── Send (end-of-turn flush) ──────────────────────────────────────────────

  const flushSend = useCallback(async () => {
    clearSendTimer();
    const message = accumulatedRef.current.trim();
    trace("flushSend", { message });
    if (!message) return;
    accumulatedRef.current = "";
    setFinalText("");
    dispatch({ type: "FINAL_RESULT" });

    // Her turn now — your silence clock pauses (the live trace showed it
    // firing mid-reply and tearing the conversation down under her).
    clearSilenceTimer();

    // D-12: thread the barged-in partial (if any) into this turn, then clear.
    // interrupt() is also called unconditionally: if a turn is still in flight
    // (speaking over her "thinking", or right after a barge-in) it cancels it
    // and returns any partial we don't already hold; when idle it's a no-op "".
    const prior = interruptedReplyRef.current;
    interruptedReplyRef.current = "";
    const partial = chatRef.current.interrupt();
    const interruptedReply = prior || partial || undefined;

    await chatRef.current.sendMessage(message, { interruptedReply, voice: true });
  }, [clearSendTimer, clearSilenceTimer]);

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
    // While she's speaking, the recognizer hears BOTH her TTS echo and you.
    // Explicit barge-in phrases act instantly; anything else is fingerprinted
    // against her own reply text — her echo is dropped, but a real user
    // interjection ("actually just tomorrow") interrupts her AND flows on as
    // your live utterance (talk-over-with-content).
    if (voiceStateRef.current === "speaking") {
      if (isBargeInPhrase(text)) {
        trace("interim.barge-in", { text });
        handleBargeIn();
        return;
      }
      if (isEchoOfReply(text, chatRef.current.streamingReplyRef.current)) {
        trace("interim.echo-dropped", { text });
        return;
      }
      trace("interim.talk-over", { text });
      handleBargeIn();
      // fall through — this interim is YOUR speech, show and track it
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

    // Echo guard + talk-over (see interim handler above).
    if (voiceStateRef.current === "speaking") {
      if (isBargeInPhrase(text)) {
        trace("final.barge-in", { text });
        handleBargeIn();
        return;
      }
      if (isEchoOfReply(text, chatRef.current.streamingReplyRef.current)) {
        trace("final.echo-dropped", { text });
        return;
      }
      trace("final.talk-over", { text });
      handleBargeIn();
      // fall through — this final is YOUR speech, process it normally
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

    // CONV-02: a real accepted utterance consumes the follow-up window.
    clearFollowUpWindow();

    // Accumulate; send after a pause. Adaptive: a short complete answer in a
    // warm conversation ("no", "yes", "the second one") goes out in 800ms —
    // human turn-gaps are sub-second; only open-ended clauses need the full
    // 2s mid-thought allowance.
    accumulatedRef.current = `${accumulatedRef.current} ${text}`.trim();
    setFinalText(accumulatedRef.current);

    const words = accumulatedRef.current.split(/\s+/).filter(Boolean).length;
    const debounceMs =
      conversationWarmRef.current && words <= SHORT_ANSWER_MAX_WORDS
        ? SHORT_SEND_DEBOUNCE_MS
        : SEND_DEBOUNCE_MS;
    trace("final.accepted", { text, warm: conversationWarmRef.current, debounceMs });

    clearSendTimer();
    sendTimerRef.current = setTimeout(() => {
      void flushSend();
    }, debounceMs);
  };

  // ─── TTS lifecycle → state machine (echo guard arming, follow-up window) ──

  const wasPlayingRef = useRef(false);
  useEffect(() => {
    if (chat.ttsIsPlaying && !wasPlayingRef.current) {
      wasPlayingRef.current = true;
      trace("tts.start", { state: voiceStateRef.current });
      clearSilentTurnTimer(); // audio arrived — the watchdog stands down
      // Re-arm barge-in for this speaking turn; the session is now warm.
      bargeInFiredRef.current = false;
      conversationWarmRef.current = true;
      // Her turn — your silence clock stays paused while she talks.
      clearSilenceTimer();
      dispatch({ type: "TTS_START" });
    } else if (!chat.ttsIsPlaying && wasPlayingRef.current) {
      wasPlayingRef.current = false;
      trace("tts.end", { state: voiceStateRef.current, strict: strictModeRef.current });
      dispatch({ type: "TTS_END", strictMode: strictModeRef.current });
      onTurnEnd();
    }
  }, [chat.ttsIsPlaying, onTurnEnd, clearSilenceTimer, clearSilentTurnTimer]);

  // ─── Silent-turn watchdog ──────────────────────────────────────────────────
  // A turn can complete with NO audio (error, empty reply, TTS hiccup). If
  // streaming ends while we're in `processing` and no TTS starts within the
  // grace window, close the turn so the conversation doesn't wedge.

  const prevStreamingRef = useRef(false);
  useEffect(() => {
    const was = prevStreamingRef.current;
    prevStreamingRef.current = chat.isStreaming;
    if (was && !chat.isStreaming && voiceStateRef.current === "processing") {
      clearSilentTurnTimer();
      silentTurnTimerRef.current = setTimeout(() => {
        silentTurnTimerRef.current = null;
        if (
          voiceStateRef.current === "processing" &&
          !chatRef.current.ttsIsPlaying
        ) {
          trace("turn.end-no-audio → back to listening");
          dispatch({ type: "TTS_END", strictMode: strictModeRef.current });
          onTurnEnd();
        }
      }, SILENT_TURN_GRACE_MS);
    }
  }, [chat.isStreaming, onTurnEnd, clearSilentTurnTimer]);

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
      // Synchronous latch — the worker can deliver detections back-to-back in
      // one tick, before the reducer state updates (live trace: double
      // "conversation open" raced two recognizer starts).
      if (conversationOpenRef.current || voiceStateRef.current !== "idle") {
        trace("wake.ignored", { state: voiceStateRef.current });
        return;
      }
      conversationOpenRef.current = true;
      trace("wake → conversation open");
      dispatch({ type: "WAKE" });
      setInterimText("");
      setFinalText("");
      restartTimesRef.current = [];
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
      if (silentTurnTimerRef.current) clearTimeout(silentTurnTimerRef.current);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    };
  }, []);

  return {
    voiceState,
    interimText,
    finalText,
    followUpOpen,
    followUpMs,
    showInterruptFlash,
    conversationActive: voiceState !== "idle" && voiceState !== "error-disabled",
    wakeWordStatus,
    wakeWordError,
    speechAvailable,
  };
}
