/**
 * ControlCenterPanel — the stacked-pill control center on the aura's right
 * side (D-17, Larry's verbatim ask: "make it look amazing like a real
 * control center… plenty of real estate on the right side of her aura").
 *
 * Replaces the old inline "Vital Signs" `<div>` in `Chat.tsx` AND relocates
 * the header control cluster (StrictModeToggle, ShareScreenToggle) here —
 * the header keeps only title, COPY TRACE, and the mic toggle. `AvatarAura`
 * stays the page's primary visual anchor; this panel is a supporting
 * side-column, not a competing focal point (186-UI-SPEC checker flag 2).
 *
 * Stacks (top to bottom): ReadinessPill, BRAIN (+ VOICE when overridden) —
 * a prominent, clearly-labeled read-only box showing the live effective
 * model (Plan 09 will wrap these in interactive dropdowns; this plan is
 * display-only, no selection UI), labeled StrictModeToggle (relocated),
 * labeled FocusModeToggle (new, D-04), QuietHoursIndicator (new, D-05),
 * labeled ShareScreenToggle (relocated).
 *
 * Owns focus_mode + quiet-hours state: hydrates from `config.get`
 * section:"proactive-prefs" on mount (mirrors `Chat.tsx`'s `strictMode`
 * hydrate exactly), persists focus_mode via `config.update` (optimistic +
 * localStorage), and converges live with the "focus mode on/off"/"good
 * night"/"I'm up" spoken verbs (186-03) via the `proactive_prefs.state`
 * live push the backend's chat.send fast-path now emits (D-04 WS-synced).
 *
 * DEVIATIONS (186-08, post-checkpoint live feedback from Larry's first
 * visual pass — see 186-08-SUMMARY.md "Deviations" for the full record):
 *  1. The BRAIN row was a tiny `SwapBadge` chip that read "Brain: Auto"
 *     before any turn had completed — correct per spec, but Larry couldn't
 *     find it / couldn't read it. Replaced with a bigger, bordered,
 *     explicitly-labeled box (still `swapModelOverride ?? lastTurnModel ??
 *     "Auto"`, same live wiring — no behavior change, just legibility).
 *  2. Every row gained a persistent text label (STRICT MODE / FOCUS MODE /
 *     SCREEN) — the toggles previously relied on icon+hover-tooltip only,
 *     which read as unlabeled bare switches once pulled out of the header's
 *     tight icon row into a labeled panel.
 *  3. All panel typography bumped from the UI-SPEC's pinned 10-11px
 *     mono-label value to the existing 14px "Caption" scale step (see
 *     ReadinessPill.tsx/QuietHoursIndicator.tsx notes) — still one pinned
 *     size within this panel, reassigned rather than a new 5th size added.
 *
 * @see 186-UI-SPEC.md "Control Center (D-17)" + "Copywriting Contract"
 */

import { useState, useEffect, useCallback } from "react";
import * as jsYaml from "js-yaml";
import { WifiOff } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StrictModeToggle } from "@/components/voice/StrictModeToggle";
import { ShareScreenToggle } from "@/components/voice/ShareScreenToggle";
import { FocusModeToggle } from "./FocusModeToggle";
import { QuietHoursIndicator } from "./QuietHoursIndicator";
import { ReadinessPill } from "./ReadinessPill";
import { BrainControl } from "./BrainControl";
import { VoiceControl } from "./VoiceControl";
import { useAstridrWS } from "@/contexts/AstridrWSContext";
import type { VoiceState } from "@/components/voice/voiceState";
import type { ScreenShareState } from "@/hooks/useScreenShare";

const LS_FOCUS = "codepulse-focus-mode";
const READINESS_POLL_MS = 3000;

export interface ProactivePrefs {
  focus_mode: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  quiet_hours_override: boolean | null;
}

export const DEFAULT_PROACTIVE_PREFS: ProactivePrefs = {
  focus_mode: false,
  quiet_hours_start: "22:00",
  quiet_hours_end: "06:00",
  quiet_hours_override: null,
};

/**
 * Mirrors `astridr/automation/governor.py::_compute_quiet_hours_active`
 * exactly (client-side DISPLAY only — the governor is the server-side
 * enforcement point; this uses the browser's local time as an approximation
 * of `ASTRIDR_TIMEZONE`, which is acceptable for a read-only indicator).
 */
export function isWithinQuietHours(
  prefs: ProactivePrefs,
  now: Date = new Date()
): boolean {
  if (prefs.quiet_hours_override !== null && prefs.quiet_hours_override !== undefined) {
    return prefs.quiet_hours_override;
  }
  const [startH, startM] = (prefs.quiet_hours_start ?? "").split(":").map(Number);
  const [endH, endM] = (prefs.quiet_hours_end ?? "").split(":").map(Number);
  if ([startH, startM, endH, endM].some((n) => Number.isNaN(n))) return false;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    // Same-day window (e.g. 09:00 -> 17:00).
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }
  // Overnight window (e.g. 22:00 -> 06:00).
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

export interface ControlCenterPanelProps {
  /** WS status is disconnected — shows an OFFLINE pill instead of ReadinessPill. */
  disconnected: boolean;
  /** The current avatar/voice state (Chat.tsx's `avatarState`). */
  voiceState: VoiceState;
  strictMode: boolean;
  onStrictModeChange: (v: boolean) => void;
  screenShareState: ScreenShareState;
  onScreenShareStart: () => unknown;
  onScreenShareStop: () => void;
  swapModelOverride: string | null;
  swapVoiceOverride: string | null;
  lastTurnModel: string | null;
}

export function ControlCenterPanel({
  disconnected,
  voiceState,
  strictMode,
  onStrictModeChange,
  screenShareState,
  onScreenShareStart,
  onScreenShareStop,
  swapModelOverride,
  swapVoiceOverride,
  lastTurnModel,
}: ControlCenterPanelProps) {
  const { sendCommand, subscribeEvent } = useAstridrWS();

  // ── Readiness (D-17 warm-up pill) — poll readiness.get until true ───────
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const ack = await sendCommand({ type: "readiness.get" });
        if (cancelled) return;
        if (ack.status === "ok" && ack.ready === true) {
          setReady(true);
          return;
        }
      } catch {
        // Transient send failure — keep polling, not a terminal state.
      }
      if (!cancelled) timer = setTimeout(poll, READINESS_POLL_MS);
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // sendCommand identity is stable per AstridrWSContext.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Focus mode + quiet hours (D-04/D-05) — localStorage instant paint,
  // server truth, mirrors Chat.tsx's strictMode pattern exactly ───────────
  const [prefs, setPrefs] = useState<ProactivePrefs>(() => {
    try {
      const storedFocus = JSON.parse(localStorage.getItem(LS_FOCUS) ?? "false");
      return { ...DEFAULT_PROACTIVE_PREFS, focus_mode: Boolean(storedFocus) };
    } catch {
      return DEFAULT_PROACTIVE_PREFS;
    }
  });

  useEffect(() => {
    (async () => {
      try {
        const ack = await sendCommand({ type: "config.get", section: "proactive-prefs" });
        if (ack.status === "ok") {
          const content = ((ack.data as Record<string, unknown>)?.content ??
            (ack as Record<string, unknown>).content ??
            "") as string;
          const parsed = (jsYaml.load(content) as Partial<ProactivePrefs>) ?? {};
          setPrefs((prev) => ({ ...prev, ...parsed }));
          if (typeof parsed.focus_mode === "boolean") {
            localStorage.setItem(LS_FOCUS, JSON.stringify(parsed.focus_mode));
          }
        } else {
          console.warn("Failed to hydrate proactive prefs from server:", ack.error);
        }
      } catch (err) {
        console.warn("Failed to hydrate proactive prefs from server:", err);
      }
    })();
    // Mount-only hydration — sendCommand identity is stable per AstridrWSContext.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live convergence: a spoken "focus mode on/off"/"good night"/"I'm up"
  // verb (186-03) persists to the SAME config file server-side — the
  // chat.send fast-path pushes it back so this tab updates without a reload.
  useEffect(() => {
    const unsub = subscribeEvent("proactive_prefs.state", (event) => {
      const data = (event as { data?: Partial<ProactivePrefs> }).data;
      if (!data) return;
      setPrefs((prev) => ({ ...prev, ...data }));
      if (typeof data.focus_mode === "boolean") {
        localStorage.setItem(LS_FOCUS, JSON.stringify(data.focus_mode));
      }
    });
    return unsub;
  }, [subscribeEvent]);

  const handleFocusModeChange = useCallback(
    (v: boolean) => {
      setPrefs((prev) => ({ ...prev, focus_mode: v }));
      localStorage.setItem(LS_FOCUS, JSON.stringify(v));
      sendCommand({
        type: "config.update",
        request_id: crypto.randomUUID(),
        section: "proactive-prefs",
        changes: { focus_mode: v },
        dry_run: false,
      })
        .then((ack) => {
          if (ack.status !== "ok") console.warn("Failed to persist focus mode:", ack.error);
        })
        .catch((err) => {
          console.warn("Failed to persist focus mode:", err);
        });
    },
    [sendCommand]
  );

  // Quiet-hours-active is a clock-window computation, not just a config
  // read — re-derive on every prefs change AND every 30s so the indicator
  // flips even if nothing else pushed an update while the window rolled over.
  const [quietHoursActive, setQuietHoursActive] = useState(() => isWithinQuietHours(prefs));
  useEffect(() => {
    setQuietHoursActive(isWithinQuietHours(prefs));
    const id = setInterval(() => setQuietHoursActive(isWithinQuietHours(prefs)), 30_000);
    return () => clearInterval(id);
  }, [prefs]);

  return (
    <div
      className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-md p-5 flex flex-col gap-3 min-w-[240px]"
      data-testid="control-center-panel"
    >
      <span className="font-mono text-sm tracking-[0.1em] text-muted-foreground">
        CONTROL CENTER
      </span>

      {disconnected ? (
        <span className="flex items-center gap-2 font-mono text-sm tracking-[0.1em] text-muted-foreground px-3 py-1.5 rounded-full bg-muted border border-border">
          <WifiOff className="w-4 h-4" aria-hidden="true" /> OFFLINE
        </span>
      ) : (
        <ReadinessPill ready={ready} voiceState={voiceState} />
      )}

      <TooltipProvider delayDuration={300}>
        {/* Brain/Voice — live effective model/voice in a prominent labeled
            box, now read + write (Plan 09, D-17): each wraps a Popover
            listing the live catalogue (swap.catalogue) and dispatches a
            selection through swap.set — the same swap_model/swap_voice
            executor a spoken swap uses. VoiceControl is always visible
            (unlike the prior swapVoiceOverride-gated box) so the live
            catalogue is browsable even with no active override. */}
        <BrainControl override={swapModelOverride} lastTurnModel={lastTurnModel} />
        <VoiceControl override={swapVoiceOverride} />

        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-sm text-muted-foreground">STRICT MODE</span>
          <StrictModeToggle enabled={strictMode} onToggle={onStrictModeChange} />
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-sm text-muted-foreground">FOCUS MODE</span>
          <FocusModeToggle enabled={prefs.focus_mode} onToggle={handleFocusModeChange} />
        </div>

        <QuietHoursIndicator active={quietHoursActive} />

        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-sm text-muted-foreground">SCREEN</span>
          <ShareScreenToggle
            state={screenShareState}
            onStart={onScreenShareStart}
            onStop={onScreenShareStop}
          />
        </div>
      </TooltipProvider>
    </div>
  );
}
