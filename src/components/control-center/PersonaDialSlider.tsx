/**
 * PersonaDialSlider — one persona dial axis (Humor or Candor): band-
 * segmented slider + live band label + numeric readout + per-axis status
 * line (D-05, D-06, D-07, D-08, D-09).
 *
 * Controlled component, structurally the same shape as
 * `FocusModeToggle.tsx` — props in, callback out, no internal source of
 * truth. `value` is the parent's LAST CONFIRMED value; this component
 * holds exactly two pieces of local state: the in-flight drag value and
 * a transient status line. `PersonaDialControl` (plan 195-03) owns both
 * the WS write and resending the full `{humor, candor}` pair.
 *
 * Deliberately does NOT clone `useProactivePrefs.ts`'s
 * `onFocusModeChange` shape (lines 129-148: sets state optimistically,
 * `console.warn`s on failure, never reverts) or `BrainControl.tsx`'s
 * `dispatchSelection` (same defect). D-03 requires the opposite: a
 * rejected/thrown `onCommit` clears the local drag value — which makes
 * the displayed value fall back to the unchanged `value` prop, i.e. the
 * thumb visibly snaps back to the last confirmed position — and surfaces
 * the per-axis error copy in a `role="status"` live region. There is no
 * optimistic-then-toast path here.
 *
 * @see 195-UI-SPEC.md "Interaction States" + "Copywriting Contract"
 * @see codepulse/src/components/control-center/FocusModeToggle.tsx (controlled shape cloned)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { resolveBand } from "@/lib/dialBands";

export interface PersonaDialSliderProps {
  axisLabel: "HUMOR" | "CANDOR";
  /** 0-100, controlled — the last confirmed value, owned by the parent. */
  value: number;
  /** Fires on release. Rejects (or throws) on failure. */
  onCommit: (v: number) => Promise<void>;
  /** True until `persona_dials.get_context` resolves a profileId. */
  disabled?: boolean;
}

const SAME_BAND_COPY = "Saved — same range, no tone change.";
const STATUS_CLEAR_MS = 3000;

type Status = { text: string; kind: "saved" | "error" };

export function PersonaDialSlider({
  axisLabel,
  value,
  onCommit,
  disabled = false,
}: PersonaDialSliderProps) {
  // The in-flight drag value. `null` means "no pending drag" — the display
  // falls back to the confirmed `value` prop. Cleared on BOTH a successful
  // commit (the parent will shortly re-render with the new confirmed
  // value) and a failed one (this IS the D-03 revert: `value` never
  // changed, so falling back to it is the snap-back).
  const [dragValue, setDragValue] = useState<number | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    },
    []
  );

  const displayValue = dragValue ?? value;
  const band = resolveBand(displayValue);

  const errorCopy =
    axisLabel === "HUMOR"
      ? "Couldn’t save that humor change — try again in a moment."
      : "Couldn’t save that candor change — try again in a moment.";

  const handleValueChange = useCallback((values: number[]) => {
    // Drag: local state only, zero network cost. Step is 1 — no snapping
    // to band midpoints or floors (D-06).
    setDragValue(values[0]);
  }, []);

  const handleValueCommit = useCallback(
    (values: number[]) => {
      const committed = values[0];
      // Captured from the props value BEFORE awaiting — `value` is the
      // last CONFIRMED number, not whatever this component's local state
      // currently shows.
      const previousBand = resolveBand(value);
      const nextBand = resolveBand(committed);

      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }
      // Error copy persists until the next drag begins (no auto-clear
      // timer for the error branch), so clear any prior error status the
      // instant a new commit starts.
      setStatus(null);

      onCommit(committed)
        .then(() => {
          setDragValue(null);
          if (previousBand === nextBand) {
            setStatus({ text: SAME_BAND_COPY, kind: "saved" });
            clearTimerRef.current = setTimeout(() => {
              setStatus(null);
              clearTimerRef.current = null;
            }, STATUS_CLEAR_MS);
          } else {
            // Band changed: no extra message — the band label already
            // shows the new band. Explicit clear (not just the leading
            // `setStatus(null)` above) because a still-in-flight EARLIER
            // commit's resolution can land after this one and must not
            // leave a stale "same range" message on screen — e.g. OS
            // key-repeat firing several discrete keyboard commits that
            // ping-pong across a band boundary.
            setStatus(null);
          }
        })
        .catch(() => {
          // D-03: revert the thumb to the last confirmed value and
          // surface the per-axis error. No optimistic-then-toast path.
          setDragValue(null);
          setStatus({ text: errorCopy, kind: "error" });
        });
    },
    [value, onCommit, errorCopy]
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          {axisLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-sm font-semibold">{band}</span>
          <span className="text-sm text-muted-foreground tabular-nums">{displayValue}</span>
        </span>
      </div>

      <div className="relative py-1">
        <Slider
          value={[displayValue]}
          min={0}
          max={100}
          step={1}
          disabled={disabled}
          onValueChange={handleValueChange}
          onValueCommit={handleValueCommit}
          aria-label={axisLabel === "HUMOR" ? "Humor dial, 0 to 100" : "Candor dial, 0 to 100"}
          aria-valuetext={`${displayValue}, ${band}`}
        />
        {/* Boundary tick marks at 30/60/90% of track width — monochrome
            hairlines, not colored segment fills (rejected alternative,
            195-UI-SPEC "Band Segment Visual Treatment"). Purely visual;
            pointer-events-none so they never intercept the drag. */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {[30, 60, 90].map((pct) => (
            <span
              key={pct}
              className="absolute top-1/2 h-[calc(100%+6px)] w-px -translate-x-1/2 -translate-y-1/2 bg-border"
              style={{ left: `${pct}%` }}
            />
          ))}
        </div>
      </div>

      <div
        role="status"
        aria-live="polite"
        className="min-h-4 text-xs text-muted-foreground transition-opacity duration-normal ease-house"
      >
        {status?.text ?? ""}
      </div>
    </div>
  );
}
