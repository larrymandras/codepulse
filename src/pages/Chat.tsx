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
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  Send,
  Mic,
  MicOff,
  AlertCircle,
  Eye,
  ChevronDown,
  Clock,
  Pin,
  LayoutGrid,
} from "lucide-react";
import { AvatarAura } from "@/components/voice/AvatarAura";
import { ChatBubble } from "@/components/ChatBubble";
import { ControlCenterPanel } from "@/components/control-center/ControlCenterPanel";
import { CompactControlStrip } from "@/components/control-center/CompactControlStrip";
import { IntelligenceFeedPanel } from "@/components/control-center/IntelligenceFeedPanel";
import { ActiveAgentsPanel } from "@/components/control-center/ActiveAgentsPanel";
import { MissionTimelinePanel } from "@/components/control-center/MissionTimelinePanel";
import { LlmStatusPanel } from "@/components/control-center/LlmStatusPanel";
import { SystemMonitorPanel } from "@/components/control-center/SystemMonitorPanel";
import { VoiceStatusPanel } from "@/components/control-center/VoiceStatusPanel";
import { QuickCommandsPanel } from "@/components/control-center/QuickCommandsPanel";
import { useProactivePrefs } from "@/hooks/useProactivePrefs";
import VitalsRail from "@/components/chat/VitalsRail";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import { BrainPicker } from "@/components/brains/BrainPicker";
import { useBrainFallbackNotice } from "@/components/brains/BrainFallbackNotice";
import {
  useGlobalBrainOverride,
  useGlobalModelNames,
  useResolvedBrain,
} from "@/hooks/useResolvedBrain";
import { useBrainCatalogue } from "@/hooks/useBrainCatalogue";
import { resolveModelDisplayName } from "@/lib/brainsApi";
import { PROVIDER_COLORS } from "@/lib/providers";
import { useAstridrChat } from "@/hooks/useAstridrChat";
import { useAstridrVoice, VOICE_DEBUG_ENABLED, speakSystemLine } from "@/hooks/useAstridrVoice";
import { useScreenShare, type ScreenShareState } from "@/hooks/useScreenShare";
import { useAstridrWS } from "@/contexts/AstridrWSContext";
import { runLostScreenAck, type VoiceState } from "@/components/voice/voiceState";
import { extractProactiveAlertBody } from "@/lib/proactiveAlert";
import type { AutoSendHandoff } from "@/lib/skillRun";

const LS_LISTENING = "codepulse-astridr-listening";
const LS_STRICT = "codepulse-strict-mode";
// 188-13 (D-18): command-center mode toggle, same read/write idiom as the
// two constants above.
const LS_COMMAND_CENTER = "codepulse-command-center";

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

// ─── Brain composer pill (103-07-T2, D-05 corrected host) ────────────────────
//
// D-05's host correction (103-CONTEXT.md, 2026-07-28): the pill lives HERE, on Chat.tsx's own
// inline composer — not on ChatInput.tsx (imported only by the unrelated InsightsChat.tsx). This
// page is single-persona and carries no profile switcher, so the pill scopes to Ástríðr's own
// resolved `default_profile_id` (103-CONTRACT.md §3), reported on the `swap.catalogue` ack and
// read via `useBrainCatalogue()` (Phase 109 D-01/D-03) — never an invented CodePulse-side
// active-profile mechanism, and never the Convex `profileConfigs` ordering fallback D-03 rejected.
//
// This page already renders BrainControl (the LIVE global runtime axis, seeded via the shared
// `useGlobalBrainOverride` — see `src/hooks/useResolvedBrain.ts` — above) inside
// ControlCenterPanel. 103-09: the pill now reads through the same shared resolver
// (`useResolvedBrain`) BrainControl's value and the header badge both read, so a global override
// can no longer disagree with what this pill shows — it deliberately never reuses BrainControl's
// `Brain` icon (T-103-29), using a provider-color dot instead so the two surfaces stay visually
// distinct even when they now agree.
function formatBrainTtl(expiresAt?: number): string {
  if (!expiresAt) return "soon";
  const remainingMs = expiresAt * 1000 - Date.now();
  const minutes = Math.max(0, Math.round(remainingMs / 60000));
  return `${minutes}m`;
}

/** Explains which axis the pill is actually showing, keyed off `resolved.source` — replaces the
 * pre-103-09 title string that claimed a per-profile-only reading regardless of whether a global
 * override was actually governing the turn. */
function pillTitle(source: "global" | "profile" | "mixed" | "lastTurn" | "none"): string {
  switch (source) {
    case "global":
      return "A global override is active — this surface reflects it, not the per-profile default";
    case "profile":
      return "This surface reflects the per-profile default";
    case "mixed":
      return "Multiple profiles report different engines";
    case "lastTurn":
      return "No per-profile engine reported yet — showing the model that answered the last completed turn";
    case "none":
      return "No engine reported for this profile yet";
  }
}

function BrainComposerPill() {
  // Phase 109 D-01/D-03: ONE useBrainCatalogue() call supplies both the display-metadata
  // catalogue (provider-identity dot color — never the engine truth itself, which comes
  // exclusively from useResolvedBrain below, D-14) AND the dispatch-scope profileId (Ástríðr's own
  // resolved default_profile_id), replacing what were previously two separate WS round trips
  // against the retired D-16 seam (one for the catalogue here, one for the default profile id at
  // this component's former call site in Chat()). No Convex-ordering fallback — an unresolved
  // defaultProfileId reads as "" and useResolvedBrain("") honestly falls through to its own "none"
  // rung.
  const { entries: catalogue, defaultProfileId: profileId } = useBrainCatalogue();
  const resolved = useResolvedBrain(profileId);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);

  const globalModelNames = useGlobalModelNames();
  const vendor = catalogue?.find((e) => e.id === resolved.model)?.vendor;
  const dotColor = vendor ? PROVIDER_COLORS[vendor] : undefined;
  const isGlobal = resolved.source === "global";
  // UAT cosmetic fix (2026-07-29): show the catalogue display name when one is known, instead of the
  // raw model id ("claude-sonnet-5" where the swap dialog said "Claude Sonnet 5"). Falls back to the
  // id unchanged when the catalogue has no entry — never a fabricated name.
  const baseLabel =
    resolved.source === "none"
      ? "Auto"
      : resolveModelDisplayName(resolved.model as string, catalogue, globalModelNames);

  return (
    <BrainPicker
      profileId={profileId}
      onPendingChange={setPendingLabel}
      trigger={
        <button
          type="button"
          aria-label={`Active brain: ${baseLabel}${isGlobal ? " (global)" : ""} — opens the brain picker`}
          title={pillTitle(resolved.source)}
          className="flex h-8 items-center gap-1.5 rounded-full border border-border px-2 text-sm hover:border-primary"
        >
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: dotColor ?? "var(--muted-foreground)" }}
          />
          <span data-testid="chat-brain-pill-label">{baseLabel}</span>
          {isGlobal && (
            <span
              data-testid="chat-brain-pill-global-chip"
              className="rounded border border-border px-1 text-xs uppercase text-muted-foreground"
            >
              Global
            </span>
          )}
          {pendingLabel ? (
            <>
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-(--status-info) animate-pulse"
              />
              <span data-testid="chat-brain-pill-pending" className="text-xs text-muted-foreground">
                {pendingLabel}
              </span>
            </>
          ) : (
            <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
          )}
          {!pendingLabel && resolved.source === "profile" && resolved.mode === "session" && (
            <span
              data-testid="chat-brain-pill-session"
              className="flex items-center gap-0.5 text-xs text-(--status-info)"
            >
              <Clock className="h-3 w-3" aria-hidden="true" />
              {formatBrainTtl(resolved.expiresAt)}
            </span>
          )}
          {!pendingLabel && resolved.source === "profile" && resolved.mode === "pinned" && (
            <span
              data-testid="chat-brain-pill-pinned"
              className="flex items-center gap-0.5 text-xs text-muted-foreground"
            >
              <Pin className="h-3 w-3" aria-hidden="true" />
            </span>
          )}
        </button>
      }
    />
  );
}

// ─── Quick Commands container (188-13, D-18) ─────────────────────────────
//
// Owns its own useProactivePrefs() instance so QuickCommandsPanel's Focus
// Mode button writes through the SAME persist call ControlCenterPanel's own
// FocusModeToggle uses (186-09 no-parallel-path rule; see
// src/hooks/useProactivePrefs.ts) — a thin adapter, not a lifted handler
// reference, because lifting focus-mode state into Chat.tsx itself would
// mean ControlCenterPanel and Chat.tsx holding two independently-hydrated
// copies of the exact same server state (the trap useResolvedBrain's own
// docstring warns about) rather than two instances of one shared hook.
//
// Rendered ONLY inside command-center mode (see the footer band below) so
// no `proactive_prefs.state` subscription opens while the mode is off —
// satisfies D-18's "no subscription opened while off" requirement, since a
// hook call itself (not just its JSX) is gated by whether this component is
// mounted, not by an internal conditional.
function QuickCommandsContainer(props: {
  strictMode: boolean;
  onStrictModeChange: (v: boolean) => void;
  screenShareState: ScreenShareState;
  onScreenShareStart: () => unknown;
  onScreenShareStop: () => void;
  onStop: () => void;
}) {
  const { prefs, onFocusModeChange } = useProactivePrefs();
  return (
    <QuickCommandsPanel
      strictMode={props.strictMode}
      onStrictModeChange={props.onStrictModeChange}
      focusMode={prefs.focus_mode}
      onFocusModeChange={onFocusModeChange}
      screenShareState={props.screenShareState}
      onScreenShareStart={props.onScreenShareStart}
      onScreenShareStop={props.onScreenShareStop}
      onStop={props.onStop}
    />
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
    ttsAnalyser,
  } = chat;
  const { sendCommand, subscribeEvent } = useAstridrWS();

  // ── CLI-to-API text-mode fallback notice (103-07-T3, D-04) ──────────────
  // Mounted once, alongside the composer pill — surfaces a silent CLI-brain
  // tool-needing-turn fallback as an honest warn-toned toast instead of a
  // silent degrade.
  useBrainFallbackNotice();

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

  // ── Command center mode (188-13, D-18) — persisted, instant toggle ──────
  const [commandCenter, setCommandCenterState] = useState<boolean>(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_COMMAND_CENTER) ?? "false");
    } catch {
      return false;
    }
  });
  const setCommandCenter = (v: boolean) => {
    setCommandCenterState(v);
    try {
      localStorage.setItem(LS_COMMAND_CENTER, JSON.stringify(v));
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
  //
  // 103-09: the pull+push pair that used to live inline here now lives once,
  // shared, in `useGlobalBrainOverride` (`src/hooks/useResolvedBrain.ts`) — the
  // same module the header badge and the composer pill below both read, so this
  // page cannot hold its own, potentially-disagreeing copy of the global axis.
  const swapState = useGlobalBrainOverride();

  // 186-09 deferred item option (b): a genuinely tag-triggered swap corrects
  // the already-rendered bubble in place (backend push from wiring.py's
  // _generate_chat_tts, chat.correction event). Never appends a new bubble.
  useEffect(() => {
    const unsubChatCorrection = subscribeEvent("chat.correction", (event) => {
      const data = (event as { data?: Record<string, unknown> }).data;
      const sessionId = data?.session_id as string | undefined;
      const correctedText = data?.corrected_text as string | undefined;
      if (!sessionId || !correctedText) return;
      chat.correctAssistantMessage(sessionId, correctedText);
    });
    return unsubChatCorrection;
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ── 188-13 (D-18) — the three calm-layout tracks, extracted ONCE and
  // reused byte-identically by both the calm branch and the command-center
  // branch below (never duplicated markup — the regression guard is the
  // "with the mode off" Chat.test.tsx assertion on the calm grid's own
  // className string). Command-center mode adds TWO additive conditional
  // fragments inside centerColumn: VoiceStatusPanel (panel f), and — 188-14
  // live finding — swapping the full stacked ControlCenterPanel for the
  // single-row CompactControlStrip (same five controls/click targets, see
  // its own docstring), since Control Center's ~230px stacked height was
  // crowding Voice Status out of the viewport in grid mode. The calm
  // branch's ControlCenterPanel is untouched. Everything else in these
  // three columns is identical in both modes. ─────────────────────────────
  const chatColumn = (
    // 188-14 live finding: self-start + a bounded height stops this column
    // from stretching to match whatever height centerColumn's content
    // needs (grid's default align-items:stretch was pulling the input box
    // far below the fold — chatColumn has almost no natural content when
    // the transcript is empty, so it was inheriting a much taller box than
    // it needed, and its composer sat at the bottom of THAT oversized box).
    <div
      data-testid="cc-chat-column"
      className="flex flex-col min-h-0 self-start h-[70vh] rounded-xl border border-border/60 bg-card/20 overflow-hidden"
    >
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

      {/* Brain composer pill (103-07-T2) — new row above the composer, does not touch the
          textarea/send row below it. */}
      <div className="flex items-center gap-2 px-3 pt-2">
        <BrainComposerPill />
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
  );

  const centerColumn = (
    <div
      data-testid="cc-center-column"
      className="flex flex-col gap-3 min-h-0 overflow-y-auto overflow-x-hidden pr-0.5"
    >
      <div className="flex flex-col items-center rounded-xl border border-border/60 bg-card/20 pt-5 pb-4 px-3">
        <div
          // No local width cap here on purpose. `AvatarAura` already self-sizes
          // with `aspect-[4/5] w-full max-w-[340px]` (AvatarAura.tsx:340), so
          // `w-full` alone makes her fluid up to that designed 340px and
          // strictly bounded by this card below it — she cannot overflow
          // horizontally.
          //
          // History (do not re-add a cap without re-reading this): 188-14
          // earlier cut this to 260px and then 190px, described as fixing an
          // "overflow". That overflow was VERTICAL, not horizontal — at 4:5,
          // 340px wide is 425px tall, and the stacked ControlCenterPanel
          // (~230px) plus Voice Status did not fit under it in the
          // command-center column. Shrinking width was only a lever to buy
          // height. Command-center mode now renders CompactControlStrip
          // (~44px) instead of that stacked panel, which returns ~185px of
          // column height — so the lever is no longer needed and cost her
          // ~44% of her rendered size in BOTH layouts, including calm, where
          // 340px had shipped fine since 188-13. Measured live at 1920px:
          // this card offers 372px of inner width against the 190px cap,
          // i.e. 182px of headroom sitting unused.
          //
          // Mode-aware, because the two layouts have genuinely different
          // budgets: calm has no footer band, so she runs at her full
          // designed 340px as the page's hero. Command-center mode also has
          // to fit Mission Timeline + Quick Commands below the grid, and at
          // 340px (425px tall) the footer band's bottom measured 29px below
          // the fold — so grid mode caps at 260px (325px tall), which buys
          // back the ~100px that puts the band fully on screen. Both numbers
          // are measured, not guessed; re-measure before changing either.
          data-testid="cc-aura-wrapper"
          className={`w-full ${commandCenter ? "max-w-[260px]" : ""} transition-[opacity,filter] duration-300 ${
            listening ? "" : "opacity-45 saturate-50"
          }`}
        >
          <AvatarAura state={avatarState} ttsAnalyser={ttsAnalyser} />
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

      {/* Voice Status (188-13, panel f) — 188-14 live finding: moved ABOVE
          Control Center (was below). Control Center's own row spacing is
          intentionally generous (an earlier Larry pass called out cramped,
          hard-to-read rows — shrinking it back down to fit Voice Status
          underneath would reverse that fix). Voice Status pairs naturally
          with the state pill right above it instead, and is now visible
          without scrolling past the whole Control Center panel first.
          Command-center mode only; bound to the SAME avatarState value
          ControlCenterPanel receives as voiceState (188-UI-SPEC.md panel
          table row f). */}
      {commandCenter && (
        <SectionErrorBoundary name="Voice Status">
          <VoiceStatusPanel state={avatarState} filteredCount={voice.filteredCount} />
        </SectionErrorBoundary>
      )}

      {/* Control Center (D-17) — stacked under the aura in column ②.
          188-14 live finding: command-center mode swaps this for the
          single-row CompactControlStrip (same five controls/click targets)
          so grid mode reclaims the ~185px Control Center's stacked layout
          cost. The calm layout below keeps ControlCenterPanel exactly as
          approved. */}
      {commandCenter ? (
        <CompactControlStrip
          swapModelOverride={swapState.modelOverride}
          swapVoiceOverride={swapState.voiceOverride}
          lastTurnModel={lastTurnModel}
          strictMode={strictMode}
          onStrictModeChange={handleStrictModeChange}
          screenShareState={screenShare.state}
          onScreenShareStart={screenShare.start}
          onScreenShareStop={screenShare.stop}
        />
      ) : (
        <ControlCenterPanel
          disconnected={disconnected}
          micOff={!listening}
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
      )}
    </div>
  );

  const vitalsColumn = (
    <SectionErrorBoundary name="Vitals">
      <VitalsRail lastTurnModel={lastTurnModel} disconnected={disconnected} />
    </SectionErrorBoundary>
  );

  return (
    <div className="presence-ambient flex flex-col h-full">
      {/* Phase 186-13 (D-07) "you're back" focus-exit digest toast now
          mounts app-level (App.tsx, checkpoint round 5 page-scoping fix)
          -- previously only fired while /chat happened to be mounted. */}
      {/* Header — 188-14 live finding: trimmed vertical footprint (pb-4→pb-2,
          the two-line title block condensed) so command-center mode has a
          bit more room for Voice Status without needing to scroll to see it. */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-baseline gap-2">
          <h1 className="font-mono font-bold tracking-[0.15em] text-base">ÁSTRÍÐR</h1>
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
          {/* Command center mode (188-13, D-18) — expands into the seven-panel
              JARVIS layout; the calm 3-column layout is never removed. */}
          <button
            type="button"
            onClick={() => setCommandCenter(!commandCenter)}
            title={commandCenter ? "Exit command center mode" : "Enter command center mode"}
            aria-label={commandCenter ? "Exit command center mode" : "Enter command center mode"}
            aria-pressed={commandCenter}
            className={`flex items-center gap-2 h-9 px-3 rounded-lg border text-sm transition-colors ${
              commandCenter
                ? "border-primary/45 bg-primary/10 text-primary hover:bg-primary/20"
                : "border-border bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            {/* UI-SPEC § Typography: pinned to the 14px Caption role
                (text-sm) — deliberately NOT the smaller mono size the mic
                button below uses; copying that would introduce an
                undeclared 5th type size. */}
            <span className="font-mono text-sm tracking-wide">
              {commandCenter ? "GRID ON" : "GRID"}
            </span>
          </button>
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

      {commandCenter ? (
        // 188-14 live finding: command-center mode adds real height (the
        // footer band below, plus VoiceStatusPanel inline inside the center
        // column) that the calm layout never had to accommodate. The page
        // itself has no scroll (presence-ambient is a fixed h-full column),
        // so without this wrapper the footer band was rendered with zero
        // remaining flex space and visually overlapped Control Center rather
        // than pushing the page taller. flex-1 min-h-0 lets this scroll
        // region fill the remaining page height; overflow-y-auto lets it
        // grow past that when the grid + footer band's combined content
        // needs more room than the viewport gives. The grid's own flex-1
        // min-h-0 (below) still governs the common case — Intelligence
        // Feed's internal scroll, not page scroll, handles a long item list
        // when there's enough vertical room.
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col">
          {/* ── 5-track command center (188-13, D-18) ───────────────────────
              LEFT RAIL / chat / center / RIGHT RAIL / vitals at ≥xl. The
              three calm tracks (chat/center/vitals) keep their EXACT
              existing sizing fragment — nothing in them reflows. Below xl
              down to lg, each rail collapses into its own horizontal-scroll
              strip flanking the still-3-column calm row (lg:order pins
              vitals into that row and pushes the right rail below it so the
              two rail strips never overlap the same grid cell). Below lg,
              everything stacks in reading order: left rail, chat, center,
              right rail, vitals — the DOM order below already matches this,
              so no reordering is needed at that breakpoint. */}
          <div
            data-testid="cc-grid"
            className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_clamp(320px,27vw,400px)_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1.1fr)_clamp(320px,27vw,400px)_240px_minmax(0,1fr)] gap-4 pt-4"
          >
            {/* LEFT RAIL — (a) Intelligence Feed, (b) Active Agents. min-h-0
                lets Intelligence Feed's own flex-1 scroll region actually
                bound to the grid row height instead of growing to fit its
                full unbounded item list (188-14 live finding: without this,
                Active Agents rendered 13000px+ below the fold, invisible).
                188-14 live finding #2: at xl this rail shares a grid ROW
                with chatColumn/centerColumn/RIGHT RAIL/vitals, and CSS
                grid's default align-items:stretch means the row's height is
                the TALLEST column's natural content height — an unbounded
                column here (or in vitals/RIGHT RAIL below) silently pushes
                the footer band (Mission Timeline/Quick Commands) far below
                the fold even though this rail's own content is short.
                xl:max-h-[70vh] xl:overflow-y-auto caps this rail at the
                SAME reference height chatColumn already uses (self-start
                h-[70vh]), so it can never be the column that stretches the
                row past that. Only at xl — at lg this rail is its own
                full-width strip (col-span-3), never row-mates with vitals. */}
            <div
              data-testid="cc-left-rail"
              className="flex flex-col gap-2 lg:flex-row lg:overflow-x-auto lg:gap-3 lg:col-span-3 xl:flex-col xl:overflow-visible xl:gap-2 xl:col-span-1 min-h-0 xl:max-h-[70vh] xl:overflow-y-auto"
            >
              <SectionErrorBoundary name="Intelligence Feed">
                <IntelligenceFeedPanel />
              </SectionErrorBoundary>
              <SectionErrorBoundary name="Active Agents">
                <ActiveAgentsPanel />
              </SectionErrorBoundary>
            </div>

            {chatColumn}
            {centerColumn}

            {/* RIGHT RAIL — (d) LLM Status, (e) System Monitor. Ordered
                after vitals at the lg tier (lg:order-5) so the still-3-column
                calm row (chat/center/vitals) stays intact as one row, with
                this rail rendering as its own strip below it; xl:order-none
                restores the natural leftrail/chat/center/rightrail/vitals
                column sequence. Same xl:max-h-[70vh] xl:overflow-y-auto cap
                as the LEFT RAIL above — see its comment; only relevant at
                xl, where this rail row-shares with chat/center/vitals. */}
            <div
              data-testid="cc-right-rail"
              className="flex flex-col gap-2 lg:flex-row lg:overflow-x-auto lg:gap-3 lg:col-span-3 lg:order-5 xl:flex-col xl:overflow-visible xl:gap-2 xl:col-span-1 xl:order-none xl:max-h-[70vh] xl:overflow-y-auto"
            >
              <SectionErrorBoundary name="LLM Status">
                <LlmStatusPanel />
              </SectionErrorBoundary>
              <SectionErrorBoundary name="System Monitor">
                <SystemMonitorPanel />
              </SectionErrorBoundary>
            </div>

            {/* 188-14 live finding #2: unlike the two rails above, vitals
                row-shares with chat/center at BOTH lg and xl (it joins the
                still-3-column calm row at lg — see the RIGHT RAIL comment
                above), so its cap applies from lg upward, not xl-only.
                VitalsRail itself already carries its own `overflow-y-auto`
                (calm layout relies on ITS ancestor — the calm grid's own
                `flex-1 min-h-0` — to bound that scroll region); this wrapper
                gives it the same self-contained bound IntelligenceFeedPanel
                already has for the SAME reason: command-center mode's outer
                scroll container never bounds the grid row's height, so
                nothing here was actually capping VitalsRail's growth. Before
                this, Container Health's live docker-container list alone
                pushed the whole row (and the footer band below it) to
                ~1900px, most of it blank space under the shorter columns.
                188.1-03 live finding: below `lg` the grid becomes
                `grid-cols-1`, so no row-sharing/stretch risk exists by
                construction (Part 3 of 188.1-UI-SPEC.md is correct about
                that) — but that observation only covers the STRETCH
                mechanism, not this column's own raw content height, which
                is independent of stretch. The cap above was `lg:`-prefixed,
                so it silently stopped applying below 1024px — measured live
                at 900x900, VitalsRail's uncapped natural height is 1283px,
                ballooning the whole single-column stack to ~3587px and
                pushing the footer band to y=3213 (188.1-03-SUMMARY.md /
                188.1-SMOKE.md have the full measurement). Dropping the
                `lg:` prefix so the same 70vh cap + internal scroll applies
                at EVERY tier (matching how this column already behaves at
                lg/xl) removes ~650px of unnecessary scroll distance and
                brings this column in line with every other self-bounding
                column in the grid. */}
            <div
              data-testid="cc-vitals"
              className="min-h-0 lg:order-4 xl:order-none max-h-[70vh] overflow-y-auto"
            >
              {vitalsColumn}
            </div>
          </div>

          {/* FOOTER BAND — (c) Mission Timeline (~60%), (g) Quick Commands
              (~40%), command-center mode only. */}
          <div data-testid="cc-footer-band" className="mt-4 flex flex-col lg:flex-row gap-4">
            <div className="min-w-0 lg:w-[60%]">
              <SectionErrorBoundary name="Mission Timeline">
                <MissionTimelinePanel />
              </SectionErrorBoundary>
            </div>
            <div className="min-w-0 lg:w-[40%]">
              <SectionErrorBoundary name="Quick Commands">
                <QuickCommandsContainer
                  strictMode={strictMode}
                  onStrictModeChange={handleStrictModeChange}
                  screenShareState={screenShare.state}
                  onScreenShareStart={screenShare.start}
                  onScreenShareStop={screenShare.stop}
                  onStop={voice.triggerBargeIn}
                />
              </SectionErrorBoundary>
            </div>
          </div>
        </div>
      ) : (
        /* ── 3-column calm layout (unchanged) ────────────────────────────
            ① chat + history · ② her AvatarAura + Control Center · ③ vitals.
            Byte-identical to the pre-188-13 render — this exact div, this
            exact className, these exact three children, no wrapper. */
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_clamp(320px,27vw,400px)_minmax(0,1fr)] gap-4 pt-4">
          {chatColumn}
          {centerColumn}
          {vitalsColumn}
        </div>
      )}
    </div>
  );
}
