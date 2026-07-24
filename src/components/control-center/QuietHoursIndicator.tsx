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
      className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.15em] px-2.5 py-1 rounded-full border border-border bg-muted text-muted-foreground"
      title="Quiet hours — only money/high-priority events interrupt you"
    >
      <Moon className="w-3 h-3" aria-hidden="true" />
      QUIET HOURS
    </span>
  );
}
