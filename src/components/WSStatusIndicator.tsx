/**
 * WSStatusIndicator — 8px status dot + label showing WebSocket connection state.
 *
 * Colors:
 *   connected     → green dot + "Connected"
 *   reconnecting  → yellow dot (animated pulse) + "Reconnecting..."
 *   disconnected  → red dot + "Disconnected"
 *
 * Phase 56: used in all 5 new command center panels.
 */

import type { WSStatus } from "../contexts/AstridrWSContext";
import { prefersReducedMotion } from "@/lib/prefersReducedMotion";

const statusConfig: Record<
  WSStatus,
  { dotClass: string; label: string }
> = {
  connected: {
    dotClass: "bg-(--status-ok)",
    label: "Connected",
  },
  reconnecting: {
    dotClass: "bg-(--status-warn) animate-pulse",
    label: "Reconnecting...",
  },
  disconnected: {
    dotClass: "bg-(--status-error)",
    label: "Disconnected",
  },
};

export function WSStatusIndicator({ status }: { status: WSStatus }) {
  const { dotClass, label } = statusConfig[status];
  // D-11 (Phase 120): `reconnecting` is a genuine activity signal, so its pulse
  // SURVIVES — but every surviving pulse must be gated per-site on
  // prefers-reduced-motion. Gated at the consumption site rather than in the
  // Record, matching BlackboardPanel/CostBreakdown; the Record value stays
  // literal so Phase 122's TOKEN-03 audit can still find it.
  // Added at phase close after an external review found this survivor ungated
  // while the phase artifacts claimed all survivors were gated.
  const reducedMotion = prefersReducedMotion();
  const motionSafeDotClass = reducedMotion
    ? dotClass.replace(/\s*animate-pulse/, "")
    : dotClass;
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-2 h-2 rounded-full ${motionSafeDotClass}`}
        aria-hidden="true"
      />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
