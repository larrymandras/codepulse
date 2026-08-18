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

## D-09/D-10: Motion tokens and the `@utility` correction

`@theme` carries D-10's block verbatim:

```css
--duration-fast:   120ms;
--duration-normal: 200ms;
--duration-slow:   320ms;
--ease-house: cubic-bezier(0.22, 1, 0.36, 1);
```

**Mandatory correction applied, and re-verified independently of `122-RESEARCH.md`'s isolated
compile test.** `122-RESEARCH.md` Pattern 2 compiled a minimal `theme.css`+`utilities.css`
snippet by hand and reported `--duration-fast`/`--duration-normal` absent entirely from `:root`.
Re-verified against THIS repo's real Vite build (not an isolated `compile()` call): the plain
`@theme` block above by itself left the custom properties alive in `:root` (Tailwind/Lightning
CSS keeps a theme variable if the authored stylesheet references it via `var()` anywhere, which
the `@utility` bodies below do) but generated **no** `.duration-fast{}`/`.duration-normal{}`/
`.ease-house{}` utility CLASS rules -- Tailwind's content scanner only emits a rule for a class
name it finds used somewhere, and nothing in this plan's file scope (`src/index.css` + this doc)
is a scannable component file. Confirmed by a clean build+grep before adding any fix:
`.duration-fast{` / `.duration-normal{` / `.ease-house{` all absent from `dist/assets/*.css`,
while `--duration-fast`/`--duration-normal`/`--duration-slow` (unit-converted to `.12s`/`.2s`/
`.32s`) were present and `--ease-house` was absent (nothing referenced it via `var()` yet).

**The fix:** `@source inline("duration-fast duration-normal duration-slow ease-house");` --
Tailwind v4's documented mechanism (confirmed present in the installed `tailwindcss@4.3.2`
compiler's source, the `@source ... inline(...)` branch in `dist/lib.js`) for forcing specific
utility class names to be generated regardless of whether a scanned file's content contains
them. This keeps the entire fix inside `src/index.css` (the plan's only editable source file --
this plan is explicitly forbidden from touching any component file), and is also the correct
long-term choice independent of that restriction: some of the ~187 motion call sites the later
sweep waves will touch build their class strings dynamically (`motion/react` props), which
Tailwind's static scanner can never see -- `@source inline(...)` guarantees these three
utilities exist in the compiled CSS regardless of how later call sites reference them.

**Positive proof, built stylesheet (`dist/assets/index-*.css`), after the fix:**

```
.duration-fast{transition-duration:var(--duration-fast)}     PRESENT
.duration-normal{transition-duration:var(--duration-normal)} PRESENT
.duration-slow{transition-duration:var(--duration-slow)}     PRESENT
.ease-house{--tw-ease:var(--ease-house);transition-timing-function:var(--ease-house)} PRESENT
```

**Control -- the search discriminates:** `.duration-nonsense-9x7q2{` searched in the same built
file -- ABSENT. This string was never added to `@source inline(...)` or anywhere else, so a
search that found it would mean the search itself was broken (e.g. matching everything).

**Live-DOM proof (not just built-CSS text):** a throwaway Playwright page loaded the built
stylesheet, created a real `<div class="duration-normal ease-house">`, and read
`getComputedStyle`:

```
transitionDuration:       0.2s      (== 200ms, the --duration-normal value; non-zero)
transitionTimingFunction: cubic-bezier(0.22, 1, 0.36, 1)  (== --ease-house, not the UA default)
```

This is the "call site resolving to a non-zero computed transition-duration" the plan requires
-- proven against a live DOM element, not inferred from the CSS text alone.

`grep -cF '@utility duration-fast' src/index.css` / `duration-normal` / `duration-slow` each = 1.
`grep -cF -- '--ease-house: cubic-bezier(0.22, 1, 0.36, 1)' src/index.css` = 1.
`grep -v '^\s*/\*' src/index.css | grep -cE 'transition-timing-function:\s*cubic-bezier'` = 0
(the only remaining `cubic-bezier(...)` text is the token definition itself plus explanatory
comments, both excluded by the filter).

## `src/index.css`'s own motion, retimed onto the tokens

Every `animation:`/`transition:`/`transition-duration:`/`transition-timing-function:`
declaration in the file was swept and classified:

| site | before | after | reasoning |
|---|---|---|---|
| `.privacy-demo [data-sensitive]` transition | `filter 0.2s` | `filter var(--duration-normal) var(--ease-house)` | 0.2s was exactly `--duration-normal`; no easing was specified, `--ease-house` added explicitly |
| `.activity-entry-new` (slide-in-entry) | `520ms ease-out` | `520ms var(--ease-house)` | 520ms is not a house-timing near-neighbour (120/200/320ms); the settle-into-place `ease-out` IS what `--ease-house` means, so only easing centralises, duration stays authored |
| `.live-update-flash` (live-update-pulse) | `600ms ease-out` | `600ms var(--ease-house)` | same rationale as above |
| `.msg-turn` (msg-materialize) | `0.34s cubic-bezier(0.22, 1, 0.36, 1)` | `var(--duration-slow) var(--ease-house)` | 340ms is a house-timing near-neighbour of 320ms (6% off), AND the cubic-bezier was already byte-identical to `--ease-house` -- strong evidence this was authored as the house curve before the token existed. Both centralise. |

**Deliberately left untouched, with an inline comment naming why (the plan's own escape hatch
for "the curve is deliberately different"):**

| site | duration | easing | why not `--ease-house` |
|---|---|---|---|
| `.eq-bar-1/2/3`, `.eq-bar-fast-1/2/3` (eq-bounce-*) | 0.4-0.9s | `ease-in-out` | symmetric 0%/50%/100% oscillation; `--ease-house`'s asymmetric settle curve would visibly distort the bounce |
| `.ping-indicator` (ping-pulse) | 1.5s | `ease-in-out` | same symmetric-oscillation rationale |
| `.voice-listening-dot` (voice-listen-pulse) | 1.5s | `ease-in-out` | same symmetric-oscillation rationale |
| `.stream-cursor` (stream-cursor-blink) | 1s | `step-end` | discrete on/off blink, not a continuous curve |
| `.aura-ring-1/2` (aura-orbit) | 26s/34s | `linear` | ambient loop (design law: 4s+); continuous rotation needs constant angular velocity -- `--ease-house` would visibly speed up/slow down every lap |
| `.aura-float` | 6s | `ease-in-out` | ambient loop, symmetric bob -- same oscillation rationale as eq-bar |

None of these are house-timing near-neighbours either, so their durations were never candidates
for retargeting regardless of the easing decision.

`0ms !important` suppressors inside `@media (prefers-reduced-motion: reduce)` blocks were left
completely untouched, per the plan's explicit instruction -- they are suppressors, not timings.

## D-11: `readable`'s blanket no-effects rule

Added ONE new blanket suppressor immediately after the existing (untouched) `crt-scanline-bar`
display rule, mirroring the shape of the existing global `prefers-reduced-motion` suppressor:

```css
[data-theme="readable"] *,
[data-theme="readable"] *::before,
[data-theme="readable"] *::after {
  animation: none !important;
  transition-duration: 0ms !important;
}
```

`[data-theme="readable"] .crt-scanline-bar { display: none }` (shared with aubergine in the same
comma-selector rule) is kept exactly as it was -- a display rule, not a motion rule, per the
plan's explicit instruction not to fold it in.

**Proof the rule can actually fire (not merely exist):** per the 2026-08-18 lesson that "a rule
that cannot fire is indistinguishable from one never violated," a throwaway Playwright page
rendered a real element carrying both an authored `animation` (`.msg-turn`, now
`var(--duration-slow)` = 320ms) and `data-theme` on `<html>`:

```
cyan (control, motion allowed):      animationName = msg-materialize, animationDuration = 0.32s
readable (D-11 blanket rule active): animationName = none,            transitionDuration = 0s
```

The control (cyan) shows real motion on the identical element/class; the same element under
`readable` shows none -- the blanket rule is not vacuous, it demonstrably suppresses.

`grep -cF 'crt-scanline-bar' src/index.css` = 2 (readable + aubergine selectors, unchanged).

## Verification (Task 2)

- `npm run build` -> exit 0
- `npx tsc --noEmit` -> exit 0
- `npx vitest run` -> **4772 passed | 0 failed** (338 files passed, 17 skipped, 197 todo) --
  identical to the pre-task baseline recorded in `122-02-SUMMARY.md`, zero new failures
