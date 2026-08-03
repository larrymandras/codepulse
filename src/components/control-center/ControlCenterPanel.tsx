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
 * Focus_mode + quiet-hours state (hydrate/persist/live-push) lives in the
 * shared `useProactivePrefs()` hook (188-13) — this panel is one of its two
 * consumers (the other is `QuickCommandsPanel` via `Chat.tsx`'s command-center
 * mode), so both surfaces write through the exact same `config.update`
 * call and converge via the same `proactive_prefs.state` live push the
 * backend's chat.send fast-path emits for the "focus mode on/off"/"good
 * night"/"I'm up" spoken verbs (186-03).
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

import { useState, useEffect } from "react";
import { WifiOff, MicOff } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StrictModeToggle } from "@/components/voice/StrictModeToggle";
import { ShareScreenToggle } from "@/components/voice/ShareScreenToggle";
import { FocusModeToggle } from "./FocusModeToggle";
import { QuietHoursIndicator } from "./QuietHoursIndicator";
import { ReadinessPill } from "./ReadinessPill";
import { BrainControl } from "./BrainControl";
import { VoiceControl } from "./VoiceControl";
import { useAstridrWS } from "@/contexts/AstridrWSContext";
import {
  useProactivePrefs,
  isWithinQuietHours,
  DEFAULT_PROACTIVE_PREFS,
  type ProactivePrefs,
} from "@/hooks/useProactivePrefs";
import type { VoiceState } from "@/components/voice/voiceState";
import type { ScreenShareState } from "@/hooks/useScreenShare";

const READINESS_POLL_MS = 3000;

// 188-13 (D-18): focus-mode/quiet-hours state now lives in the shared
// `useProactivePrefs` hook so QuickCommandsPanel's Focus Mode button (Chat.tsx,
// command-center mode) can write through the SAME persist call this panel's
// own FocusModeToggle uses — never a second focus-mode mutation. Re-exported
// here unchanged so existing importers of this module keep working.
export { isWithinQuietHours, DEFAULT_PROACTIVE_PREFS, type ProactivePrefs };

export interface ControlCenterPanelProps {
  /** WS status is disconnected — shows a DISCONNECTED pill instead of ReadinessPill. */
  disconnected: boolean;
  /** Mic/listening toggled off (text-only) — shows a MIC OFF pill, since an
   * idle voiceState otherwise reads as "LISTENING" even with the mic off. */
  micOff?: boolean;
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
  micOff = false,
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
  const { sendCommand } = useAstridrWS();

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

  // ── Focus mode + quiet hours (D-04/D-05) — 188-13: now owned by the
  // shared useProactivePrefs() hook (localStorage instant paint, server
  // truth, live-push convergence) so QuickCommandsPanel's Focus Mode button
  // reuses the SAME persist call as this panel's own FocusModeToggle. ─────
  const { prefs, quietHoursActive, onFocusModeChange: handleFocusModeChange } =
    useProactivePrefs();

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
          <WifiOff className="w-4 h-4" aria-hidden="true" /> DISCONNECTED
        </span>
      ) : micOff ? (
        <span className="flex items-center gap-2 font-mono text-sm tracking-[0.1em] text-muted-foreground px-3 py-1.5 rounded-full bg-muted border border-border">
          <MicOff className="w-4 h-4" aria-hidden="true" /> MIC OFF
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
