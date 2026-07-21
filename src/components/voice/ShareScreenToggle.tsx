/**
 * ShareScreenToggle — top-bar 3-state screen-share control (VISION-01).
 *
 * Controlled component driven by `useScreenShare`'s `state`: mirrors the
 * existing Mic on/off BUTTON pattern (`h-9 px-3 rounded-lg border`, icon +
 * `gap-2` + mono label — see `Chat.tsx`'s listening toggle), NOT
 * `StrictModeToggle`'s `Switch` pattern, because a share is a gesture-gated
 * action (opens/closes a real picker/stream) rather than an instant boolean
 * flip (184-UI-SPEC.md).
 *
 * This component itself never calls `getDisplayMedia` — it only dispatches
 * `onStart`/`onStop`, which the caller wires to `useScreenShare`'s
 * `start`/`stop` (the sole caller of the picker API, D-09/D-10).
 *
 * @see 184-UI-SPEC.md "1. Share-control (three states)"
 * @see codepulse/src/hooks/useScreenShare.ts
 */

import { ScreenShare, ScreenShareOff } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ScreenShareState } from "@/hooks/useScreenShare";

export interface ShareScreenToggleProps {
  /** Current lifecycle state, owned by `useScreenShare`. */
  state: ScreenShareState;
  /** Opens the share picker (idle/armed → click) — the real user gesture (D-09). */
  onStart: () => unknown;
  /** Stops the live share (active → click, D-12). */
  onStop: () => void;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

export function ShareScreenToggle({ state, onStart, onStop }: ShareScreenToggleProps) {
  const active = state === "active";
  const armed = state === "armed";

  const Icon = active ? ScreenShare : ScreenShareOff;
  const label = active ? "SHARING" : "SHARE";
  const ariaLabel = active ? "Stop sharing your screen" : "Share your screen";
  const tooltipText = active
    ? "Sharing your screen — click to stop"
    : armed
      ? "Click to share your screen"
      : "Share your screen so I can see it";

  // Color reservations (184-UI-SPEC.md): --status-ok = active icon/label ONLY,
  // --status-info = armed ring ONLY. Idle stays muted-foreground.
  const colorClass = active
    ? "text-(--status-ok)"
    : armed
      ? "text-(--status-info)"
      : "text-muted-foreground";

  const ringClass = armed
    ? prefersReducedMotion()
      ? "ring-2 ring-(--status-info)"
      : "ring-2 ring-(--status-info) animate-pulse"
    : "";

  const handleClick = () => {
    if (active) onStop();
    else void onStart();
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleClick}
          aria-pressed={active}
          aria-label={ariaLabel}
          className={`flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-muted text-sm transition-colors hover:bg-muted/70 ${colorClass} ${ringClass}`}
        >
          <Icon className="w-4 h-4" aria-hidden="true" />
          <span className="font-mono text-[11px] tracking-wide">{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>
        <p className="text-xs">{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
}
