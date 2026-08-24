/**
 * dialBands — CodePulse's copy of astridr's persona-dial band ladder
 * (D-08: a DELIBERATE second source of truth).
 *
 * CodePulse must know the >=90 / >=60 / >=30 thresholds to draw the
 * segmented slider's tick marks and live band label. The canonical copy
 * lives at `astridr/engine/dial_bands.py:41-45` (`BAND_THRESHOLDS`). This
 * module mirrors ONLY the threshold ladder and the band identifier
 * strings ("Max"/"High"/"Mid"/"Low") — never the HUMOR_BANDS/CANDOR_BANDS
 * prose, which stays server-side per D-07.
 *
 * This coupling is NOT discharged by this docstring — a comment cannot
 * fail. It is discharged by the boundary test in
 * `PersonaDialSlider.test.tsx`, which asserts the 29/30, 59/60, 89/90
 * transitions through the rendered component: if `dial_bands.py`'s
 * thresholds ever drift from the values below, that test is the thing
 * that has to fail.
 */

export type DialBand = "Max" | "High" | "Mid" | "Low";

export const BAND_THRESHOLDS: ReadonlyArray<readonly [number, DialBand]> = [
  [90, "Max"],
  [60, "High"],
  [30, "Mid"],
] as const;

/**
 * Resolve a dial value (any int) to a band name.
 *
 * Out-of-range input is clamped to 0-100 rather than raising — mirrors
 * `dial_bands.resolve_band`'s own clamping behaviour (the Convex side
 * already clamps too).
 */
export function resolveBand(value: number): DialBand {
  const clamped = Math.max(0, Math.min(100, value));
  for (const [threshold, band] of BAND_THRESHOLDS) {
    if (clamped >= threshold) return band;
  }
  return "Low";
}
