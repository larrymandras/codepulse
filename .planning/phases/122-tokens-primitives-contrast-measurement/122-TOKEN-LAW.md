# Phase 122 Plan 03: Token Law -- Hue Decouple, `--astridr`, Forge Fill Pair, Motion

Per-theme record of the three-hue-owner law (TOKEN-02) and the motion vocabulary (TOKEN-03),
per D-05/D-06/D-08/D-09/D-10/D-11. All colour claims below were measured, not asserted, via a
rasterised canvas round-trip, the same method `122-RAMP-DERIVATION.md` established (never a
regex scrape of `getComputedStyle` -- Tailwind v4 emits `oklch()`/`oklab()`, which a regex
misreads).

## Measurement method and controls

One-off Playwright + canvas script (`measure-token-scratch.mjs`, throwaway, run from the repo
root, not committed): each literal was assigned to `ctx.fillStyle` after priming a magenta
sentinel, `fillRect`'d, and read back with `getImageData`.

**Known-value control:** `#ffffff` -> `rgb(255,255,255)`, `#000000` -> `rgb(0,0,0)`, both exact.
**Known-invalid control:** `not-a-color-9x7q2` left the sentinel in place (returned `null`),
proving the "return null, don't guess" branch fires rather than sitting as unreached code.

OKLCH hue angle (for the emerald exception's separation measurement, D-05) was computed by a
standard sRGB -> linear -> LMS -> OKLab -> OKLCH matrix conversion applied to the SAME
rasterised RGB bytes -- this is colour-science math on our own literal hex choices, not a parse
of a string Tailwind emitted, so the oklch-scraping trap does not apply here.

## D-05: `--status-ok` decoupled from `--primary`

| theme | old `--status-ok` | new `--status-ok` | collision before | separated after |
|---|---|---|---|---|
| cyan | `#06b6d4` (== `--primary`) | `#34d399` | YES | YES |
| emerald | `#10b981` (== `--primary`) | `#22d3ee` (hue-separated exception) | YES | YES |
| amber | `#f59e0b` (== `--primary`) | `#34d399` | YES | YES |
| readable | `#34d399` | unchanged | already decoupled | already decoupled |
| aubergine | `#34d399` | unchanged | already decoupled | already decoupled |

**Emerald's exception, measured:** emerald's own `--primary` (`#10b981`) is itself a green, so
`#34d399` (sea-green) would recreate the exact collision TOKEN-02 removes. Candidate `#22d3ee`
(cyan is not the machine hue inside the emerald theme, so it is free to carry state there):

```
--primary  #10b981 -> rgb(16,185,129), OKLCH hue = 162.48deg
candidate  #22d3ee -> rgb(34,211,238),  OKLCH hue = 211.53deg
hue separation = 49.05deg  (constraint: >= 30deg)  PASS

candidate vs emerald --surface-1 (#030a25 -> rgb(3,10,37)): contrast = 10.820:1
(constraint: >= 4.5:1)  PASS
```

Recorded as a deliberate per-theme exception, not an inconsistency -- the law is about
perceptible separation, not one literal hex.

## D-08: `--astridr` created in all five themes

`--astridr: #8b5cf6` added verbatim (from
`.claude/skills/sketch-findings-codepulse/sources/themes/default.css:23`) to all five
`[data-theme]` blocks. `--accent` and `--vault-node-color` (both also `#8b5cf6` in most themes)
are untouched -- different tokens, different jobs; the adjudication of the 43 raw violet call
sites happens in the sweep plans, not here. `grep -cF -- '--astridr: #8b5cf6' src/index.css` = 5.

## D-06: Forge `failed` fill/foreground pair

**Design choice:** the pair is **opaque** (not the old translucent `bg-red-900/60`), so its
contrast is a fixed number independent of what theme or surface sits behind it -- this is
simpler and more robust than tuning five separate alpha-composited pairs, and "filled" as a
visual idiom does not require translucency (D-06 only locks the filled treatment, not the exact
alpha).

```
--status-error-fill:    #7f1d1d  (opaque dark red)
--status-error-on-fill: #ffffff

contrast(on-fill, fill) = 10.020:1   (constraint: >= 4.5:1 against --card)  PASS
```

Because the fill is opaque, compositing it over any theme's `--card` is a no-op (an opaque
colour fully covers whatever is behind it) -- so the ratio is identical in all five themes:

| theme | `--card` | composited fill (== fill, opaque) | on-fill vs composited |
|---|---|---|---|
| cyan | `#0b0d12` | `#7f1d1d` | 10.020:1 |
| emerald | `#030a25` | `#7f1d1d` | 10.020:1 |
| amber | `#121212` | `#7f1d1d` | 10.020:1 |
| readable | `#181c24` | `#7f1d1d` | 10.020:1 |
| aubergine | `#1a1324` | `#7f1d1d` | 10.020:1 |

**Control -- the probe can fail:** the OLD pairing (`bg-red-900/60` = `rgba(127,29,29,0.6)`,
`text-[var(--status-error)]`), composited over each theme's `--card` (not the page background,
per the handoff's own correction) and measured against that theme's `--status-error`:

| theme | old fill composited over `--card` | `--status-error` | ratio | vs AA (4.5:1) |
|---|---|---|---|---|
| cyan | `rgb(81,23,25)` | `#ef4444` | 3.754:1 | below AA |
| emerald | `rgb(77,21,32)` | `#ef4444` (inherits `.dark` cascade, undeclared in this theme's block) | 3.865:1 | below AA |
| amber | `rgb(83,25,25)` | `#ef4444` (inherits `.dark` cascade, undeclared in this theme's block) | 3.669:1 | below AA |
| readable | `rgb(86,29,32)` | `#f87171` | 4.768:1 | at/above AA |
| aubergine | `rgb(87,25,32)` | `#f87171` | 4.851:1 | at/above AA |

This reproduces the SAME three-below/two-above bucketing `120-DESIGN-REVIEW-HANDOFF.md` reports
(3.92:1 "below AA" on the dark themes named there, 5.33:1 "above AA" on readable/aubergine) --
the small numeric differences from the handoff's own figures are the page-background-vs-card
difference the handoff itself flags, not a probe discrepancy. The probe correctly reports a
failure for cyan/emerald/amber, which is what the control requires; it is not required to (and
does not) report a failure for readable/aubergine, since those were never sub-AA.

`grep -c -- '--status-error-fill:' src/index.css` = 5, `grep -c -- '--status-error-on-fill:'
src/index.css` = 5.

<!-- D-09/D-10/D-11 (motion tokens, the @utility correction, and readable's blanket rule) are
recorded below once Task 2 lands. -->
