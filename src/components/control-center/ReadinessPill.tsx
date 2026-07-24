/**
 * ReadinessPill — 4-state control-center readiness pill (D-17).
 *
 * WARMING UP (`--status-warn`, pulsing) until the backend's `readiness.get`
 * WS signal (Task 1, `astridr/api/ws_commands.py`) returns `ready: true` —
 * the exact same `mark_ready()` gate the 300s Docker `start_period` waits
 * on. Once ready, the pill mirrors the live voice/turn state: LISTENING
 * (`--primary`) → THINKING (`--status-info`, pulsing) → SPEAKING
 * (`--primary`, pulsing). `transcribing`/`idle`/`error-disabled` all read
 * as LISTENING (armed, waiting) — the 4-state ceiling doesn't need a 5th
 * "hearing you" state for this compact pill (`Chat.tsx`'s main state label
 * already carries that nuance).
 *
 * @see 186-UI-SPEC.md "ReadinessPill" (Component Inventory + Color +
 *      Accessibility Contract — "fire once per state transition, not per
 *      render")
 *
 * DEVIATION (186-08, post-checkpoint live feedback): UI-SPEC pins this
 * mono-label role to 10-11px. Larry's live review found the whole panel
 * too small to read comfortably alongside the enlarged AvatarAura — this
 * pill (and the rest of ControlCenterPanel's labels) now render at the
 * existing "Caption" scale step (14px/`text-sm`) instead of introducing a
 * new pixel value. Still exactly one pinned size within this panel — the
 * step is reassigned, not a 5th size added to the app-wide type scale.
 */

import { useEffect, useRef, useState } from "react";
import type { VoiceState } from "@/components/voice/voiceState";

export type ReadinessDisplayState = "warming up" | "listening" | "thinking" | "speaking";

export interface ReadinessPillProps {
  /** True once the backend has completed full bootstrap (readiness.get). */
  ready: boolean;
  /** The current avatar/voice state, used once ready to pick LISTENING/THINKING/SPEAKING. */
  voiceState: VoiceState;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

function resolveDisplayState(ready: boolean, voiceState: VoiceState): ReadinessDisplayState {
  if (!ready) return "warming up";
  if (voiceState === "speaking") return "speaking";
  if (voiceState === "processing") return "thinking";
  // idle | listening | transcribing | error-disabled — all read as LISTENING
  return "listening";
}

const STATE_META: Record<
  ReadinessDisplayState,
  { label: string; cls: string; pulsing: boolean }
> = {
  "warming up": {
    label: "WARMING UP",
    cls: "text-(--status-warn) bg-(--status-warn)/10 border-(--status-warn)/30",
    pulsing: true,
  },
  listening: {
    label: "LISTENING",
    cls: "text-primary bg-primary/10 border-primary/30",
    pulsing: false,
  },
  thinking: {
    label: "THINKING",
    cls: "text-(--status-info) bg-(--status-info)/10 border-(--status-info)/30",
    pulsing: true,
  },
  speaking: {
    label: "SPEAKING",
    cls: "text-primary bg-primary/10 border-primary/30",
    pulsing: true,
  },
};

export function ReadinessPill({ ready, voiceState }: ReadinessPillProps) {
  const displayState = resolveDisplayState(ready, voiceState);
  const meta = STATE_META[displayState];
  const reducedMotion = prefersReducedMotion();

  // Fire the aria-live announcement once per transition, not per render.
  const [announcement, setAnnouncement] = useState("");
  const prevStateRef = useRef<ReadinessDisplayState | null>(null);
  useEffect(() => {
    if (prevStateRef.current !== displayState) {
      prevStateRef.current = displayState;
      setAnnouncement(meta.label);
    }
  }, [displayState, meta.label]);

  return (
    <>
      <span
        className={`flex items-center gap-2 font-mono text-sm tracking-[0.1em] px-3 py-1.5 rounded-full border ${meta.cls}`}
      >
        {meta.pulsing && (
          <span
            className={`w-2 h-2 rounded-full bg-current ${
              reducedMotion ? "" : "animate-pulse"
            }`}
            aria-hidden="true"
          />
        )}
        {meta.label}
      </span>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
    </>
  );
}
