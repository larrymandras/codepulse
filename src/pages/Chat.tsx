/**
 * Chat — Ástríðr's home. A full-page presence: her AvatarAura hero, the live
 * conversation, and the input. This is the ONLY place she lives (she is not in
 * the app shell / other routes).
 *
 * Conversation engine: useAstridrChat (streaming/dedup/TTS/approval).
 * Voice engine: useAstridrVoice (wake-word armed — "Hey Ástríðr" opens a live
 * conversation with interim barge-in, warm gate, follow-up window; an
 * end-phrase / 14s window expiry / 30s silence re-arms the wake word).
 *
 * The mic toggle gates EVERYTHING that can hold the mic: OFF = wake engine
 * stopped + recognizer aborted — text-only chat, avatar dims. Persisted.
 * Strict Mode lives here too (moved from the app shell when she became
 * page-scoped): manual switch + spoken "strict mode on/off", server-synced
 * via config voice-prefs.
 */

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import * as jsYaml from "js-yaml";
import { Send, Mic, MicOff, WifiOff, AlertCircle } from "lucide-react";
import { AvatarAura } from "@/components/voice/AvatarAura";
import { ChatBubble } from "@/components/ChatBubble";
import { StrictModeToggle } from "@/components/voice/StrictModeToggle";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAstridrChat } from "@/hooks/useAstridrChat";
import { useAstridrVoice, VOICE_DEBUG_ENABLED } from "@/hooks/useAstridrVoice";
import { useAstridrWS } from "@/contexts/AstridrWSContext";
import type { VoiceState } from "@/components/voice/voiceState";

const LS_LISTENING = "codepulse-astridr-listening";
const LS_STRICT = "codepulse-strict-mode";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

// ─── Follow-up countdown bar (CONV-02) — duration is stay-hot aware ──────────

function FollowUpCountdownBar({ active, durationMs }: { active: boolean; durationMs: number }) {
  const [collapsed, setCollapsed] = useState(false);
  const reducedMotion = prefersReducedMotion();

  useEffect(() => {
    if (!active) {
      setCollapsed(false);
      return;
    }
    if (reducedMotion) return;
    const id = requestAnimationFrame(() => setCollapsed(true));
    return () => cancelAnimationFrame(id);
  }, [active, reducedMotion]);

  if (!active) return null;

  return (
    <div className="mx-auto w-full max-w-2xl" aria-hidden="true">
      <div className="h-[3px] w-full rounded-full bg-primary/15 overflow-hidden">
        <div
          className="h-full bg-primary shadow-[0_0_8px_var(--primary)]"
          style={
            reducedMotion
              ? { width: "50%" }
              : {
                  width: collapsed ? "0%" : "100%",
                  transitionProperty: "width",
                  transitionDuration: `${durationMs}ms`,
                  transitionTimingFunction: "linear",
                }
          }
        />
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Chat() {
  const chat = useAstridrChat();
  const {
    status,
    messages,
    sendMessage,
    isStreaming,
    playAudio,
    handleApprove,
    handleReject,
  } = chat;
  const { sendCommand } = useAstridrWS();

  // ── Mic toggle (persisted) ──────────────────────────────────────────────
  const [listening, setListening] = useState<boolean>(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_LISTENING) ?? "true");
    } catch {
      return true;
    }
  });
  const setListen = (v: boolean) => {
    setListening(v);
    try {
      localStorage.setItem(LS_LISTENING, JSON.stringify(v));
    } catch {
      /* localStorage unavailable — keep the optimistic in-memory value */
    }
  };

  // ── Strict Mode (CONV-02, D-04) — localStorage instant paint, server truth ──
  const [strictMode, setStrictMode] = useState<boolean>(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_STRICT) ?? "false");
    } catch {
      return false;
    }
  });

  useEffect(() => {
    (async () => {
      try {
        const ack = await sendCommand({ type: "config.get", section: "voice-prefs" });
        if (ack.status === "ok") {
          const content = ((ack.data as Record<string, unknown>)?.content ??
            (ack as Record<string, unknown>).content ??
            "") as string;
          const parsed = (jsYaml.load(content) as Record<string, unknown>) ?? {};
          if (typeof parsed.strict_mode === "boolean") {
            setStrictMode(parsed.strict_mode);
            localStorage.setItem(LS_STRICT, JSON.stringify(parsed.strict_mode));
          }
        } else {
          console.warn("Failed to hydrate strict mode from server:", ack.error);
        }
      } catch (err) {
        // Offline fallback (183-RESEARCH A4/A5): keep the optimistic mirror.
        console.warn("Failed to hydrate strict mode from server:", err);
      }
    })();
    // Mount-only hydration — sendCommand identity is stable per AstridrWSContext.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStrictModeChange = useCallback(
    (v: boolean) => {
      setStrictMode(v);
      localStorage.setItem(LS_STRICT, JSON.stringify(v));
      sendCommand({
        type: "config.update",
        request_id: crypto.randomUUID(),
        section: "voice-prefs",
        changes: { strict_mode: v },
        dry_run: false,
      })
        .then((ack) => {
          if (ack.status !== "ok") console.warn("Failed to persist strict mode:", ack.error);
        })
        .catch((err) => {
          console.warn("Failed to persist strict mode:", err);
        });
    },
    [sendCommand]
  );

  // ── Voice engine ────────────────────────────────────────────────────────
  const voice = useAstridrVoice({
    enabled: listening,
    strictMode,
    onStrictModeChange: handleStrictModeChange,
    chat,
  });

  const voiceError = listening && voice.wakeWordStatus === "error-disabled";

  // ── Input / scroll ──────────────────────────────────────────────────────
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const disconnected = status !== "connected";

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const submit = () => {
    const text = draft.trim();
    if (!text || isStreaming || disconnected) return;
    void sendMessage(text);
    setDraft("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  // ── State → presentation ────────────────────────────────────────────────
  // Avatar reacts to the REAL voice state; a typed turn still gets the
  // thinking shimmer; mic off pins it calm (and dims it below).
  const avatarState: VoiceState = !listening
    ? "idle"
    : voice.conversationActive
      ? voice.voiceState
      : isStreaming
        ? "processing"
        : "idle";

  const stateLabel = !listening
    ? "Listening off — typing only"
    : voiceError
      ? "Voice unavailable"
      : voice.conversationActive
        ? voice.voiceState === "speaking"
          ? "Ástríðr speaking"
          : voice.voiceState === "transcribing"
            ? "Hearing you"
            : voice.voiceState === "processing" || isStreaming
              ? "Thinking…"
              : voice.followUpOpen
                ? "Still listening…"
                : "Listening…"
        : isStreaming
          ? "Thinking…"
          : "Say “Hey Ástríðr”";

  const pill = disconnected
    ? { text: "OFFLINE", cls: "text-muted-foreground bg-muted border-border", dot: false }
    : !listening
      ? { text: "LISTENING OFF", cls: "text-muted-foreground bg-muted border-border", dot: false }
      : voiceError
        ? { text: "VOICE ERROR", cls: "text-(--status-warn) bg-(--status-warn)/10 border-(--status-warn)/30", dot: false }
        : voice.conversationActive
          ? voice.voiceState === "speaking"
            ? { text: "SPEAKING", cls: "text-primary bg-primary/10 border-primary/30", dot: true }
            : voice.voiceState === "processing" || isStreaming
              ? { text: "THINKING", cls: "text-primary bg-primary/10 border-primary/30", dot: true }
              : { text: "LIVE", cls: "text-primary bg-primary/10 border-primary/30", dot: true }
          : { text: "ARMED", cls: "text-primary/80 bg-primary/5 border-primary/20", dot: true };

  const showBars =
    listening &&
    voice.conversationActive &&
    (voice.voiceState === "listening" || voice.voiceState === "transcribing");

  return (
    <div className="presence-ambient flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="font-mono font-bold tracking-[0.15em] text-lg">ÁSTRÍÐR</h1>
          <p className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground">
            {!listening
              ? "LISTENING OFF"
              : voice.conversationActive
                ? "IN CONVERSATION"
                : "WAKE-WORD ARMED"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {disconnected ? (
            <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-wide text-muted-foreground px-2.5 py-1 rounded-full bg-muted border border-border">
              <WifiOff className="w-3 h-3" /> OFFLINE
            </span>
          ) : (
            <span
              className={`flex items-center gap-1.5 font-mono text-[10px] tracking-wide px-2.5 py-1 rounded-full border ${pill.cls}`}
            >
              {pill.dot && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_10px_var(--primary)] animate-pulse" />
              )}
              {pill.text}
            </span>
          )}
          {/* TEMP repro instrumentation — copies the voice lifecycle trace */}
          {VOICE_DEBUG_ENABLED && (
            <button
              type="button"
              onClick={() => {
                const buf = window.__astridrVoiceTrace ?? [];
                void navigator.clipboard.writeText(
                  buf.map((e) => `${e.t} ${e.ev} ${e.d ? JSON.stringify(e.d) : ""}`).join("\n")
                );
              }}
              title="Copy the voice lifecycle trace (temporary debug)"
              className="font-mono text-[10px] tracking-wide px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground"
            >
              COPY TRACE
            </button>
          )}
          <TooltipProvider delayDuration={300}>
            <StrictModeToggle enabled={strictMode} onToggle={handleStrictModeChange} />
          </TooltipProvider>
          {/* Listening on/off — full off = text-only */}
          <button
            type="button"
            onClick={() => setListen(!listening)}
            title={listening ? "Turn listening off (text-only)" : "Turn listening on"}
            aria-label={listening ? "Turn listening off" : "Turn listening on"}
            aria-pressed={listening}
            className={`flex items-center gap-2 h-9 px-3 rounded-lg border text-sm transition-colors ${
              listening
                ? "border-primary/45 bg-primary/10 text-primary hover:bg-primary/20"
                : "border-border bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {listening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            <span className="font-mono text-[11px] tracking-wide">
              {listening ? "ON" : "OFF"}
            </span>
          </button>
        </div>
      </div>

      {/* Avatar hero */}
      <div className="flex flex-col items-center pt-5 pb-2 shrink-0">
        <div
          className={`w-[172px] transition-[opacity,filter] duration-300 ${
            listening ? "" : "opacity-45 saturate-50"
          }`}
        >
          <AvatarAura state={avatarState} ttsAnalyser={null} />
        </div>

        <div className="mt-2 flex items-center gap-2 text-sm text-foreground/90">
          {showBars && (
            <span className="flex items-end gap-[3px] h-4" aria-hidden="true">
              <span className="w-[3px] h-1.5 bg-primary rounded-full animate-pulse" />
              <span className="w-[3px] h-3.5 bg-primary rounded-full animate-pulse [animation-delay:120ms]" />
              <span className="w-[3px] h-2 bg-primary rounded-full animate-pulse [animation-delay:240ms]" />
              <span className="w-[3px] h-4 bg-primary rounded-full animate-pulse [animation-delay:360ms]" />
            </span>
          )}
          <span
            aria-live="polite"
            className={listening ? "" : "text-muted-foreground"}
          >
            {stateLabel}
          </span>
        </div>

        {/* Live transcript — what she's hearing right now */}
        {(voice.interimText || voice.finalText || voice.showInterruptFlash) && (
          <div className="mt-1.5 max-w-xl px-4 text-center font-mono text-[11px] tracking-wide min-h-[16px]">
            {voice.showInterruptFlash && (
              <span className="text-(--status-warn) font-semibold mr-2">
                — interrupted —
              </span>
            )}
            {voice.finalText && (
              <span className="text-foreground/90">“{voice.finalText}</span>
            )}
            {voice.interimText && (
              <span className="text-muted-foreground italic">
                {voice.finalText ? " " : "“"}
                {voice.interimText}
              </span>
            )}
            {(voice.finalText || voice.interimText) && (
              <span className="text-muted-foreground">”</span>
            )}
          </div>
        )}

        {/* Follow-up window countdown (CONV-02, stay-hot aware) */}
        <div className="w-full mt-2 px-4">
          <FollowUpCountdownBar active={voice.followUpOpen} durationMs={voice.followUpMs} />
        </div>

        {/* Wake engine failure — recovery is toggle off → on */}
        {voiceError && (
          <div className="mt-2 flex items-start gap-2 max-w-md text-left">
            <AlertCircle className="w-3.5 h-3.5 text-(--status-warn) mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Wake-word engine failed
              {voice.wakeWordError ? ` (${voice.wakeWordError})` : ""}. Toggle the
              mic off and on to retry — typing still works.
            </p>
          </div>
        )}
      </div>

      {/* Conversation thread */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4">
        <div className="mx-auto w-full max-w-2xl space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground text-center leading-relaxed">
                {listening
                  ? "Say “Hey Ástríðr” or type below to talk to her."
                  : "Listening is off — type below to talk to Ástríðr."}
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <ChatBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                blocks={msg.blocks}
                streaming={msg.streaming}
                timestamp={msg.timestamp}
                audioUrl={msg.audioUrl}
                onPlayAudio={playAudio}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))
          )}
        </div>
      </div>

      {/* Input */}
      <div className="pt-3 border-t border-border shrink-0">
        <div className="mx-auto w-full max-w-2xl flex items-end gap-2">
          <textarea
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={disconnected}
            placeholder={disconnected ? "Reconnecting…" : "Type or speak to Ástríðr…"}
            className="flex-1 resize-none max-h-32 rounded-xl bg-background border border-border px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary/50 focus:shadow-[var(--glow-xs)]"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!draft.trim() || isStreaming || disconnected}
            title="Send"
            aria-label="Send message"
            className="w-11 h-11 shrink-0 rounded-xl grid place-items-center bg-primary/15 border border-primary/40 text-primary hover:bg-primary/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="mx-auto w-full max-w-2xl mt-2 font-mono text-[10px] tracking-[0.08em] text-muted-foreground/70 text-center">
          {listening
            ? "SAY “HEY ÁSTRÍÐR” TO START · “STOP” INTERRUPTS · “GOODBYE” ENDS"
            : "LISTENING OFF — NOTHING HOLDS THE MIC"}
        </p>
      </div>
    </div>
  );
}
