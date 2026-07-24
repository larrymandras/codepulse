/**
 * QuietHoursIndicator — read-only DND state indicator (D-05, GOV-01).
 *
 * NOT a toggle — quiet hours is config + the "good night"/"I'm up" spoken
 * override only (Plan 03's `quiet_hours.py`), never a manual UI flip this
 * phase. Renders only while the current time is inside the governor's
 * quiet-hours window; absence of the element IS the signal (no "not quiet"
 * pill), matching Phase 92's quiet-degradation precedent.
 *
 * @see 186-UI-SPEC.md "QuietHoursIndicator" (Component Inventory + Color)
 *
 * DEVIATION (186-08, post-checkpoint live feedback): rendered at the
 * existing "Caption" scale step (14px/`text-sm`) instead of the UI-SPEC's
 * pinned 10-11px mono-label value — see ReadinessPill.tsx's matching note.
 */

import { Moon } from "lucide-react";

export interface QuietHoursIndicatorProps {
  /** Whether the current time is inside the governor's quiet-hours window. */
  active: boolean;
}

export function QuietHoursIndicator({ active }: QuietHoursIndicatorProps) {
  if (!active) return null;

  return (
    <span
      className="flex items-center gap-2 font-mono text-sm tracking-[0.1em] px-3 py-1.5 rounded-full border border-border bg-muted text-muted-foreground"
      title="Quiet hours — only money/high-priority events interrupt you"
    >
      <Moon className="w-4 h-4" aria-hidden="true" />
      QUIET HOURS
    </span>
  );
}
