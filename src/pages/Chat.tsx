/**
 * Chat — Ástríðr's home. A full-page presence: her AvatarAura hero, the live
 * conversation, and the input. This is the ONLY place she lives (she is not in
 * the app shell / other routes).
 *
 * Conversation engine is useAstridrChat (shared streaming/dedup/TTS/approval
 * logic). Listening can be turned fully OFF — mic disabled, text-only chat —
 * via the mic toggle; the choice persists.
 *
 * Voice recognition (wake word, barge-in, live transcript) is wired in next.
 */

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { Send, Mic, MicOff, WifiOff } from "lucide-react";
import { AvatarAura } from "@/components/voice/AvatarAura";
import { ChatBubble } from "@/components/ChatBubble";
import { useAstridrChat } from "@/hooks/useAstridrChat";
import type { VoiceState } from "@/components/voice/voiceState";

const LS_LISTENING = "codepulse-astridr-listening";

export default function Chat() {
  const {
    status,
    messages,
    sendMessage,
    isStreaming,
    playAudio,
    handleApprove,
    handleReject,
  } = useAstridrChat();

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

  // Avatar stays calm until real voice recognition is wired (next step) — using
  // the mic-reactive "listening" state now would acquire the mic and imply she's
  // hearing you when she isn't yet. Thinking shimmer while she responds.
  const avatarState: VoiceState = isStreaming ? "processing" : "idle";
  const stateLabel = !listening
    ? "Listening off — typing only"
    : isStreaming
      ? "Thinking…"
      : "Listening…";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="font-mono font-bold tracking-[0.15em] text-lg">ÁSTRÍÐR</h1>
          <p className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground">
            {listening ? "ALWAYS LISTENING" : "LISTENING OFF"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {disconnected ? (
            <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-wide text-muted-foreground px-2.5 py-1 rounded-full bg-muted border border-border">
              <WifiOff className="w-3 h-3" /> OFFLINE
            </span>
          ) : listening ? (
            <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-wide text-primary px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30">
              <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_10px_var(--primary)] animate-pulse" />
              {isStreaming ? "THINKING" : "LISTENING"}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-wide text-muted-foreground px-2.5 py-1 rounded-full bg-muted border border-border">
              LISTENING OFF
            </span>
          )}
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
        <div className={`w-[172px] ${listening ? "" : "opacity-45 saturate-50 transition-[opacity,filter] duration-300"}`}>
          <AvatarAura state={avatarState} ttsAnalyser={null} />
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm text-foreground/90">
          {listening && !isStreaming && (
            <span className="flex items-end gap-[3px] h-4" aria-hidden="true">
              <span className="w-[3px] h-1.5 bg-primary rounded-full animate-pulse" />
              <span className="w-[3px] h-3.5 bg-primary rounded-full animate-pulse [animation-delay:120ms]" />
              <span className="w-[3px] h-2 bg-primary rounded-full animate-pulse [animation-delay:240ms]" />
              <span className="w-[3px] h-4 bg-primary rounded-full animate-pulse [animation-delay:360ms]" />
            </span>
          )}
          <span className={listening ? "" : "text-muted-foreground"}>{stateLabel}</span>
        </div>
      </div>

      {/* Conversation thread */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4">
        <div className="mx-auto w-full max-w-2xl space-y-3">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground text-center leading-relaxed">
                {listening
                  ? "Say the wake word or type below to talk to Ástríðr."
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
      </div>
    </div>
  );
}
