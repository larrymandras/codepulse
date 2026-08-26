# Phase 122 Plan 02: Surface Ramp Derivation

Per-theme record of where every one of the 30 values (5 themes x 6 tokens) came from, per D-03.
All arithmetic below was re-verified against the browser's own CSS colour parser (canvas
`fillStyle` -> `fillRect` -> `getImageData` round-trip), not trusted from hand HSL math alone —
see "Measurement method" below.

## Measurement method

Tailwind v4 computes colours as `oklch()`/`oklab()`, and a regex scrape of `getComputedStyle`
reads the hue angle as a colour channel (the tell: an impossible value like `rgb(0,0,262)` —
`[[tailwind-v4-oklch-defeats-css-color-scraping]]`). This derivation instead used a one-off
Playwright + canvas script (not committed — a throwaway probe, run from the repo root so
`@playwright/test` resolves): for each hex literal, prime `ctx.fillStyle` with a magenta
sentinel (`#ff00ff`), then set it to the literal under test, `fillRect`, and read the pixel back
with `getImageData`. If the sentinel survives, the input was unparseable and no value is
quoted for it (null, not a guess).

**Known-value control:** `#ffffff` round-tripped to exactly `rgb(255,255,255)` — the probe
itself is trustworthy. **Known-invalid control:** the literal string `not-a-color-9x7q2` left the
magenta sentinel in place (`SENTINEL SURVIVED`), proving the sentinel-preservation branch
actually fires rather than sitting as unreached code — a probe that never demonstrates its own
failure mode is not proof against one.

All five ramps' four `--surface-N` steps were then re-measured through the same round-trip and
confirmed **pairwise distinct** within each theme (no ramp collapses to one colour):

```
cyan ramp round-trip:      5,6,10 / 11,13,18 / 18,21,28 / 25,29,38        DISTINCT-OK
emerald ramp round-trip:   2,6,23 / 3,10,37 / 4,13,51 / 6,17,65           DISTINCT-OK
amber ramp round-trip:     10,10,10 / 18,18,18 / 25,25,25 / 33,33,33     DISTINCT-OK
readable ramp round-trip:  17,19,24 / 24,28,36 / 29,33,48 / 36,41,59     DISTINCT-OK
aubergine ramp round-trip: 18,13,24 / 26,19,36 / 30,23,42 / 37,28,52     DISTINCT-OK
```

## cyan — verbatim (D-03)

Source: `.claude/skills/sketch-findings-codepulse/sources/themes/default.css:8-13`, taken
byte-for-byte, no adjustment.

| Token | Value |
|---|---|
| `--surface-0` | `#05060a` |
| `--surface-1` | `#0b0d12` |
| `--surface-2` | `#12151c` |
| `--surface-3` | `#191d26` |
| `--hairline` | `#1c2029` |
| `--hairline-strong` | `#2a2f3b` |

These are darker than today's `#040405`/`#0a0a0c`/`#1e1e24` on some steps and lighter on
others — that is the intended visual change (D-03), not drift.

## emerald — derived mechanically (D-03)

Anchored on the theme's existing `--background: #020617` so the page colour does not shift.
`#020617` measured (via the browser round-trip, confirming the hand HSL conversion below) as
**H=228.57deg, S=84%, L=4.9%**. Held H and S fixed (same hue/chroma direction) and stepped L
upward in even +3.0-percentage-point increments for four surface steps, then two more steps
for hairline/hairline-strong:

| Token | L (target) | Value | RGB (measured round-trip) |
|---|---|---|---|
| `--surface-0` | 4.9% (anchor) | `#020617` | `2,6,23` |
| `--surface-1` | 7.9% | `#030a25` | `3,10,37` |
| `--surface-2` | 10.9% | `#040d33` | `4,13,51` |
| `--surface-3` | 13.9% | `#061141` | `6,17,65` |
| `--hairline` | 16.9% | `#07154f` | (one step above surface-3, per Task 1 instruction) |
| `--hairline-strong` | 19.9% | `#08185d` | |

## amber — derived mechanically (D-03/D-04)

Anchored on the theme's existing `--background: #0a0a0a`, a true neutral gray (H undefined,
S=0%, L=3.92%). Kept the neutral direction (R=G=B throughout, no hue introduced) and stepped L
upward in the same even +3.0-point increments:

| Token | L (target) | Value | RGB (measured round-trip) |
|---|---|---|---|
| `--surface-0` | 3.92% (anchor) | `#0a0a0a` | `10,10,10` |
| `--surface-1` | 6.92% | `#121212` | `18,18,18` |
| `--surface-2` | 9.92% | `#191919` | `25,25,25` |
| `--surface-3` | 12.92% | `#212121` | `33,33,33` |
| `--hairline` | 15.92% | `#292929` | |
| `--hairline-strong` | 18.92% | `#303030` | |

Amber receives the full token set per D-04 so the block never rots, but stays unexposed in
`ThemeSwitcher.tsx` (untouched by this plan) and is **not** part of the A11Y-01 contrast matrix
— an unreachable theme cannot be measured against a rendered page. That is a stated limitation,
not an omission: no rendered-page contrast figure for amber exists or is claimed here.

## readable — hand-tuned (D-03)

WCAG-AA-constrained; a mechanical lightness step would flatten that tuning, so `--surface-0/1/2`
and `--hairline` reuse the theme's existing `--background`/`--card`/`--popover`/`--border`
verbatim. `--surface-3` and `--hairline-strong` are invented steps continuing the same
lightness trend (H~=227deg, S~=25%, computed from the existing `--popover`/`--border`) above
`--surface-2` and `--hairline` respectively, keeping strict ordering
surface-0 < surface-1 < surface-2 < surface-3 < hairline < hairline-strong verified by RGB
channel comparison, not just lightness arithmetic:

| Token | Source | Value | RGB |
|---|---|---|---|
| `--surface-0` | existing `--background` | `#111318` | `17,19,24` |
| `--surface-1` | existing `--card` | `#181c24` | `24,28,36` |
| `--surface-2` | existing `--popover` | `#1d2130` | `29,33,48` |
| `--surface-3` | invented (+3.5pt L above surface-2) | `#24293b` | `36,41,59` |
| `--hairline` | existing `--border` | `#2a3144` | `42,49,68` |
| `--hairline-strong` | invented (+6.5pt L above hairline) | `#374059` | `55,64,89` |

**Measured contrast — `--foreground` (`#e8eaf0`) against `--surface-1` (`#181c24`):**

```
readable: fg #e8eaf0 -> rgb(232,234,240), surface-1 #181c24 -> rgb(24,28,36),
contrast = 14.189:1
```

14.19:1 clears WCAG AA (4.5:1) and AAA (7:1) by a wide margin — the hand-tuning did not erode
the theme's core guarantee.

## aubergine — hand-tuned (D-03)

Same approach as readable, preserving the deliberate violet cast (H~=262-267deg across the
existing four values, S~=29-33%) rather than neutralising it toward the cyan ramp.
`--surface-0/1/2` and `--hairline` reuse the existing literals verbatim; `--surface-3` and
`--hairline-strong` are invented, continuing the violet hue:

| Token | Source | Value | RGB |
|---|---|---|---|
| `--surface-0` | existing `--background` | `#120d18` | `18,13,24` |
| `--surface-1` | existing `--card` | `#1a1324` | `26,19,36` |
| `--surface-2` | existing `--popover` | `#1e172a` | `30,23,42` |
| `--surface-3` | invented (+3.0pt L above surface-2) | `#251c34` | `37,28,52` |
| `--hairline` | existing `--border` | `#2e2040` | `46,32,64` |
| `--hairline-strong` | invented (+6.0pt L above hairline) | `#3d2a54` | `61,42,84` |

**Measured contrast — `--foreground` (`#f0e8dc`) against `--surface-1` (`#1a1324`):**

```
aubergine: fg #f0e8dc -> rgb(240,232,220), surface-1 #1a1324 -> rgb(26,19,36),
contrast = 14.865:1
```

14.87:1, comfortably clearing AA/AAA.

## The semantic alias re-point (Task 2, D-01)

In every theme, `--background`/`--card`/`--popover`/`--border` were replaced with
`var(--surface-0)`/`var(--surface-1)`/`var(--surface-2)`/`var(--hairline)`, and `--input` was
re-pointed to `var(--hairline)` (it previously carried the same literal as `--border` in
cyan/readable/aubergine — leaving it behind would have reintroduced the exact per-token drift
TOKEN-01 exists to end). `emerald` and `amber` previously declared **none** of these four tokens
of their own and silently inherited cyan's literals (`#0a0a0c`/`#0a0a0c`/`#1e1e24`) through the
shared `.dark, [data-theme="cyan"] { ... }` selector list (`src/index.css:134-135` pre-edit) —
both now declare all four aliases explicitly. `--sidebar-border` is untouched in every theme;
Phase 124 owns the sidebar (D-17).

Zero literal hex values survive on `--background`/`--card`/`--popover`/`--border` anywhere below
the `.dark,` selector (line 134) after this edit — the sole `grep` hit in that range is inside
this plan's own Task-1 derivation *comment* in the amber block (documenting the source literal
for readers), not a live declaration.

## Verification

- `npm run build` -> exit 0
- `npx tsc --noEmit` -> exit 0
- `npx vitest run` -> **4772 passed | 0 failed** (338 files passed, 17 skipped, 197 todo),
  identical to the pre-plan baseline recorded in `PROJECT.md`'s Phase 121 close-out
  ("Suite 4772 passed | 0 failed") — zero new failures introduced by this plan.
