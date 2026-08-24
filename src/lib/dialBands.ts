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
 * ⚠ THIS COUPLING IS UNGUARDED. NOTHING DETECTS DRIFT.
 *
 * An earlier version of this comment claimed the boundary test in
 * `PersonaDialSlider.test.tsx` was what "has to fail" if `dial_bands.py`
 * drifted. That was FALSE and has been corrected. That test asserts the
 * 29/30, 59/60, 89/90 transitions against expectations hardcoded in the
 * test file itself — it proves this module and that test agree, which is
 * TS-internal consistency, not cross-language agreement. Verified by two
 * independent sweeps of the codepulse repo: the only references to
 * `dial_bands` anywhere are the three comments in this very file. Nothing
 * in `package.json`, `vitest.config.ts` or `.github/` reads the Python.
 * Change `dial_bands.py`'s 90 to 85 and every test here stays green.
 *
 * Why it is left unguarded rather than papered over: a test that reads
 * `astridr/engine/dial_bands.py` off disk would depend on the astridr repo
 * being checked out beside this one, which is true on Larry's machine and
 * not guaranteed anywhere else — an environment-dependent test that skips
 * silently is a guard that cannot fire, i.e. the same defect in a new
 * costume. An accurate warning beats a fake guarantee.
 *
 * KNOWN DIVERGENCE, currently harmless: the identifiers here are
 * capitalised (`"Max"`) while the canonical Python returns lowercase
 * (`"max"`). No live defect today — band strings are only ever compared
 * against other band strings produced by THIS module
 * (`PersonaDialSlider.tsx` compares `resolveBand()` to `resolveBand()`),
 * and `persona_dials.set`'s ack carries no band names. It becomes a real
 * bug the moment anything compares one of these against astridr's
 * lowercase `previous_band`/`new_band` telemetry.
 *
 * Note the irony worth remembering: `dial_bands.py` deduplicated its own
 * two threshold ladders precisely because "two hand-copied threshold
 * ladders would drift" — and mirroring it across the language boundary
 * reintroduced exactly that.
 *
 * If these values are edited, `astridr/engine/dial_bands.py` MUST be
 * edited in the same change, and vice versa.
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
