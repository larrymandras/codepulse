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
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Send, Mic, MicOff, AlertCircle, Eye } from "lucide-react";
import { AvatarAura } from "@/components/voice/AvatarAura";
import { ChatBubble } from "@/components/ChatBubble";
import { ControlCenterPanel } from "@/components/control-center/ControlCenterPanel";
import VitalsRail from "@/components/chat/VitalsRail";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import { useAstridrChat } from "@/hooks/useAstridrChat";
import { useAstridrVoice, VOICE_DEBUG_ENABLED, speakSystemLine } from "@/hooks/useAstridrVoice";
import { useScreenShare } from "@/hooks/useScreenShare";
import { useAstridrWS } from "@/contexts/AstridrWSContext";
import { runLostScreenAck, type VoiceState } from "@/components/voice/voiceState";
import { extractProactiveAlertBody } from "@/lib/proactiveAlert";
import type { AutoSendHandoff } from "@/lib/skillRun";

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
  const { sendCommand, subscribeEvent } = useAstridrWS();

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

  // ── Brain/voice swap badge (SWAP-01/02, D-04/D-16) ──────────────────────
  // In-memory-only backend state (Pitfall 6) — never persisted, never read
  // from localStorage/config. Seeded on mount/reconnect via `swap.get_state`
  // (the pull) and kept live via the `swap.state` push (fired by the
  // chat.send fast-path right after a swap executes, 185-05). A restart
  // resets both fields to null server-side, so a fresh mount's pull hides
  // the badge again — proving it never survives a restart.
  const [swapState, setSwapState] = useState<{
    modelOverride: string | null;
    voiceOverride: string | null;
  }>({ modelOverride: null, voiceOverride: null });

  useEffect(() => {
    (async () => {
      try {
        const ack = await sendCommand({ type: "swap.get_state" });
        if (ack.status === "ok") {
          setSwapState({
            modelOverride: (ack.model_override as string | null | undefined) ?? null,
            voiceOverride: (ack.voice_override_name as string | null | undefined) ?? null,
          });
        } else {
          console.warn("Failed to hydrate swap state from server:", ack.error);
        }
      } catch (err) {
        console.warn("Failed to hydrate swap state from server:", err);
      }
    })();
    // Mount-only hydration — sendCommand identity is stable per AstridrWSContext.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const unsubSwapState = subscribeEvent("swap.state", (event) => {
      const data = (event as { data?: Record<string, unknown> }).data;
      if (!data) return;
      setSwapState({
        modelOverride: (data.model_override as string | null | undefined) ?? null,
        voiceOverride: (data.voice_override_name as string | null | undefined) ?? null,
      });
    });
    return unsubSwapState;
  }, [subscribeEvent]);

  // Live effective model (185-08): run.completed now carries the resolved
  // model of each finished turn, so the Brain pill can show what actually
  // answered instead of the "Auto" umbrella. Swap overrides still win in
  // SwapBadge's display; this only feeds the unswapped (muted) state. The
  // fast-path's zero-LLM run.completed has no/empty model — keep the last
  // real one.
  const [lastTurnModel, setLastTurnModel] = useState<string | null>(null);
  useEffect(() => {
    const unsubCompleted = subscribeEvent("run.completed", (event) => {
      const data = (event as { data?: Record<string, unknown> }).data;
      const model = data?.model as string | undefined;
      if (model) setLastTurnModel(model);
    });
    return unsubCompleted;
  }, [subscribeEvent]);

  // ── Proactive governor delivery (Phase 186 checkpoint round 4, D-09 fix) ──
  // The governor's WS-tier presence-cascade delivery (astridr/automation/
  // governor.py's _resolve_presence_target -> channel_id "codepulse") now
  // pushes an observable "proactive_alert" event instead of silently
  // no-op'ing (root cause of Larry seeing zero alerting for money/high pulse
  // cards despite their intents reaching status=complete).
  //
  // Checkpoint round 5 (page-scoping fix): the sonner TOAST now fires from
  // an APP-LEVEL mount (ProactiveAlertListener.tsx, App.tsx) so it's visible
  // on ANY page — the round-4 version wired it here only, so it only ever
  // fired while /chat happened to be mounted (Larry was on /inbox and never
  // saw it). This Chat-scoped subscription now ONLY appends the visible
  // assistant chat-timeline message (can only append to a message list that
  // exists, which requires Chat to be mounted) — mirrors the
  // runLostScreenAck (speak + appendLocalAssistantMessage) split pattern
  // below, one channel each.
  useEffect(() => {
    const unsubProactiveAlert = subscribeEvent("proactive_alert", (event) => {
      const data = (event as { data?: Record<string, unknown> }).data;
      if (!data) return;
      const body = extractProactiveAlertBody(data);
      if (!body) return;
      chat.appendLocalAssistantMessage(body);
    });
    return unsubProactiveAlert;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribeEvent]);

  // ── Screen share (VISION-01) — sole caller of getDisplayMedia (D-09) ─────
  // D-11: on a native track `ended` (Chrome's "Stop sharing" bar, tab/window
  // close — never fires for our own ShareScreenToggle stop() click), speak
  // AND write the lost-screen acknowledgement so the next vision question
  // correctly hits the D-03 refusal path.
  const screenShare = useScreenShare({
    onEnded: () => {
      runLostScreenAck({
        speak: speakSystemLine,
        appendLocalAssistantMessage: chat.appendLocalAssistantMessage,
      });
    },
  });

  // ── Voice engine ────────────────────────────────────────────────────────
  const voice = useAstridrVoice({
    enabled: listening,
    strictMode,
    onStrictModeChange: handleStrictModeChange,
    chat,
    screenShare,
  });

  const voiceError = listening && voice.wakeWordStatus === "error-disabled";

  // ── Skill launch auto-send (LAUNCH-01/03, D-05/D-06) ────────────────────
  // A Run→Chat/Ástríðr handoff (Skills page → navigate('/chat', { state })
  // per Plan 03) always produces an executed chat.send — never a
  // prefilled-and-waiting composer (D-05). Guarded by firedRef so a
  // StrictMode double-mount (mount→cleanup→remount, same fiber/refs) cannot
  // double-fire (mirrors AstridrWSContext's guarded-connect precedent). When
  // the WS settles to a terminal disconnected state before ever connecting,
  // this surfaces an honest toast instead of silently dropping the launch
  // (Pitfall 3) — never a silent no-op while still reconnecting.
  const location = useLocation();
  const navigate = useNavigate();
  const handoff = location.state?.autoSend as AutoSendHandoff | undefined;
  const recordSkillLaunch = useMutation(api.registry.recordSkillLaunch);
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current || !handoff) return;

    if (status === "connected") {
      firedRef.current = true;
      void (async () => {
        // CR-01 (99-07): "resolved" is not "succeeded" — sendMessage now
        // reports true only on a confirmed ok ack. D-12: recordSkillLaunch
        // fires exactly once, ONLY on that confirmed success, for both the
        // Chat and Ástríðr targets (both navigate here). A dropped/rejected/
        // errored send clears the router state honestly without recording.
        try {
          const sent = await sendMessage(
            handoff.text,
            handoff.profile ? { profile: handoff.profile } : undefined
          );
          if (sent) {
            await recordSkillLaunch({ name: handoff.skillName });
          } else {
            toast.error("Couldn't run — Ástríðr rejected the send.");
          }
        } catch (err) {
          // WR-02: a recordSkillLaunch rejection (network/Convex error) must
          // not strand the consumed router state — surface it honestly and
          // still clear it below.
          console.warn("recordSkillLaunch failed", err);
        } finally {
          navigate(location.pathname, { replace: true, state: {} });
        }
      })();
    } else if (status === "disconnected") {
      firedRef.current = true;
      toast.error("Couldn't send — Ástríðr isn't connected. Try again.");
      navigate(location.pathname, { replace: true, state: {} });
    }
    // "reconnecting" — wait for status to settle; deliberately scoped to
    // [handoff, status] only (sendMessage/navigate/location are stable-enough
    // for this one-shot guard, per the firedRef latch above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoff, status]);

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
        ? voice.isLooking
          ? "Looking…"
          : voice.voiceState === "speaking"
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

  const showBars =
    listening &&
    voice.conversationActive &&
    (voice.voiceState === "listening" || voice.voiceState === "transcribing");

  return (
    <div className="presence-ambient flex flex-col h-full">
      {/* Phase 186-13 (D-07) "you're back" focus-exit digest toast now
          mounts app-level (App.tsx, checkpoint round 5 page-scoping fix)
          -- previously only fired while /chat happened to be mounted. */}
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
          {/* Repro instrumentation — copies the voice lifecycle trace */}
          {VOICE_DEBUG_ENABLED && (
            <button
              type="button"
              onClick={() => {
                const buf = window.__astridrVoiceTrace ?? [];
                void navigator.clipboard.writeText(
                  buf.map((e) => `${e.t} ${e.ev} ${e.d ? JSON.stringify(e.d) : ""}`).join("\n")
                );
              }}
              title="Copy the voice lifecycle trace (debug)"
              className="font-mono text-[10px] tracking-wide px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground"
            >
              COPY TRACE
            </button>
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

      {/* ── 3-column command center ─────────────────────────────────────────
          ① chat + history · ② her AvatarAura + Control Center · ③ vitals.
          Everything from the prior presence screen is preserved verbatim; the
          vitals column (③) is additive. Stacks to one column below lg. */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_clamp(320px,27vw,400px)_minmax(0,1fr)] gap-4 pt-4">

        {/* ── COLUMN 1 — chat + history ────────────────────────────────── */}
        <div className="flex flex-col min-h-0 rounded-xl border border-border/60 bg-card/20 overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
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
          <div className="border-t border-border/60 p-3">
            <div className="flex items-end gap-2">
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
            <p className="mt-2 font-mono text-[10px] tracking-[0.08em] text-muted-foreground/70 text-center">
              {listening
                ? "SAY “HEY ÁSTRÍÐR” TO START · “STOP” INTERRUPTS · “GOODBYE” ENDS"
                : "LISTENING OFF — NOTHING HOLDS THE MIC"}
            </p>
          </div>
        </div>

        {/* ── COLUMN 2 — AvatarAura + Control Center (preserved) ─────────── */}
        <div className="flex flex-col gap-3 min-h-0 overflow-y-auto pr-0.5">
          <div className="flex flex-col items-center rounded-xl border border-border/60 bg-card/20 pt-5 pb-4 px-3">
            <div
              className={`w-full max-w-[340px] transition-[opacity,filter] duration-300 ${
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
              {voice.isLooking && (
                <Eye
                  className={`w-3 h-3 text-muted-foreground ${
                    prefersReducedMotion() ? "" : "animate-pulse"
                  }`}
                  aria-hidden="true"
                />
              )}
              <span aria-live="polite" className={listening ? "" : "text-muted-foreground"}>
                {stateLabel}
              </span>
            </div>

            {/* Live transcript — what she's hearing right now */}
            {(voice.interimText || voice.finalText || voice.showInterruptFlash) && (
              <div className="mt-1.5 w-full px-2 text-center font-mono text-[11px] tracking-wide min-h-[16px]">
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
            <div className="w-full mt-2 px-2">
              <FollowUpCountdownBar active={voice.followUpOpen} durationMs={voice.followUpMs} />
            </div>

            {/* Wake engine failure — recovery is toggle off → on */}
            {voiceError && (
              <div className="mt-2 flex items-start gap-2 text-left">
                <AlertCircle className="w-3.5 h-3.5 text-(--status-warn) mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Wake-word engine failed
                  {voice.wakeWordError ? ` (${voice.wakeWordError})` : ""}. Toggle the
                  mic off and on to retry — typing still works.
                </p>
              </div>
            )}
          </div>

          {/* Control Center (D-17) — now stacked under the aura in column ② */}
          <ControlCenterPanel
            disconnected={disconnected}
            voiceState={avatarState}
            strictMode={strictMode}
            onStrictModeChange={handleStrictModeChange}
            screenShareState={screenShare.state}
            onScreenShareStart={screenShare.start}
            onScreenShareStop={screenShare.stop}
            swapModelOverride={swapState.modelOverride}
            swapVoiceOverride={swapState.voiceOverride}
            lastTurnModel={lastTurnModel}
          />
        </div>

        {/* ── COLUMN 3 — vitals (additive) ──────────────────────────────── */}
        <SectionErrorBoundary name="Vitals">
          <VitalsRail lastTurnModel={lastTurnModel} disconnected={disconnected} />
        </SectionErrorBoundary>
      </div>
    </div>
  );
}
