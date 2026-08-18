# Phase 122 Plan 02: Surface Ramp + Semantic Alias Re-point Summary

All five themes now declare a complete, internally distinct six-token Borealis surface ramp
(`--surface-0/1/2/3`, `--hairline`, `--hairline-strong`), and `--background`/`--card`/
`--popover`/`--border`/`--input` alias that ramp instead of carrying independent literals —
closing the silent cyan-surface inheritance emerald and amber had through the shared
`.dark, [data-theme="cyan"]` selector list.

## What Was Built

**Task 1 — the ramp itself, all five themes.** Added the six tokens to each `[data-theme]`
block: `cyan` verbatim from `.claude/skills/sketch-findings-codepulse/sources/themes/default.css`
(`#05060a`/`#0b0d12`/`#12151c`/`#191d26`, hairline `#1c2029`/`#2a2f3b`); `emerald` and `amber`
derived mechanically by holding hue/chroma fixed (emerald: H=228.6deg S=84% off its existing
`--background: #020617`; amber: neutral gray off `--background: #0a0a0a`) and stepping HSL
lightness +3.0 points per stop, anchoring `--surface-0` to the existing background so the page
colour does not shift; `readable` and `aubergine` hand-tuned, reusing their existing
background/card/popover/border verbatim for surface-0/1/2/hairline and inventing surface-3 +
hairline-strong as continuations of the same lightness trend. All 20 surface values (4 steps x 5
themes) verified pairwise distinct within their theme via a rasterised canvas round-trip, not
hand arithmetic alone — see the derivation doc's round-trip table.

**Task 2 — the alias re-point + derivation record.** In every theme, `--background`, `--card`,
`--popover`, `--border` were replaced with `var(--surface-0)`/`var(--surface-1)`/
`var(--surface-2)`/`var(--hairline)`, and `--input` was re-pointed to `var(--hairline)` (it
previously duplicated `--border`'s literal in cyan/readable/aubergine — left alone, that would
have reintroduced the exact per-token drift TOKEN-01 exists to end). `emerald` and `amber`
previously declared **none** of `--card`/`--popover`/`--border`/`--input` and silently inherited
cyan's literals (`#0a0a0c`/`#0a0a0c`/`#1e1e24`) through the shared `.dark, [data-theme="cyan"]`
selector list at `src/index.css:134-135` (pre-edit) — this is exactly the trap the plan's
`<interfaces>` section flagged, verified for real: both themes now declare all four aliases of
their own. `122-RAMP-DERIVATION.md` records the source and arithmetic for all 30 values, plus
the readable/aubergine contrast measurements.

**Contrast, measured not asserted.** A one-off Playwright + canvas script (throwaway, run from
the repo root so `@playwright/test` resolves — never committed) primed a magenta sentinel on
`canvas.fillStyle`, set it to each literal under test, `fillRect`'d, and read the pixel back with
`getImageData` — the browser's own CSS colour parser, not hand HSL conversion or a regex scrape
of `getComputedStyle` (which reads Tailwind v4's `oklch()` hue angle as a colour channel).
Known-value control `#ffffff` round-tripped to exactly `rgb(255,255,255)`; known-invalid control
`not-a-color-9x7q2` left the sentinel in place, proving the "return null, don't guess" branch
actually executes. Results: `readable` foreground (`#e8eaf0`) against `--surface-1` (`#181c24`)
= **14.189:1**; `aubergine` foreground (`#f0e8dc`) against `--surface-1` (`#1a1324`) =
**14.865:1**. Both clear WCAG AA (4.5:1) and AAA (7:1) by a wide margin — the hand-tuning
preserved the theme's core guarantee rather than eroding it.

## Deviations from Plan

None. Both tasks executed as specified. The plan's acceptance criteria for Task 2's literal-
survivor control ("print the line numbers and account for each") surfaced one hit
(`src/index.css:247`) that required inspection to resolve — it is inside this plan's own Task-1
derivation *comment* in the amber block, documenting the source literal for future readers, not
a live CSS declaration. Read in context and confirmed harmless rather than accepted on a bare
grep count, per the plan's own instruction not to accept counts without inspection.

## Verification

- `npm run build` → exit 0 (both after Task 1 and after Task 2)
- `npx tsc --noEmit` → exit 0
- `npx vitest run` → **4772 passed | 0 failed** (338 test files passed, 17 skipped, 197 todo) —
  identical to the pre-plan baseline recorded in `PROJECT.md`'s Phase 121 close-out, zero new
  failures
- `grep -c -- '--surface-0:' src/index.css` → 5, one per theme; same for `--surface-1:`,
  `--surface-2:`, `--surface-3:`, `--hairline:`, `--hairline-strong:` (all 5)
- Cyan verbatim: `#05060a`/`#0b0d12`/`#12151c`/`#191d26`/`#1c2029`/`#2a2f3b` each `grep -cF` → 1
- `grep -cF -- '--background: var(--surface-0)'` / `'--card: var(--surface-1)'` /
  `'--popover: var(--surface-2)'` / `'--border: var(--hairline)'` → 5 each
- `grep -cF -- '--input: var(--hairline)'` → 5
- Control for surviving literals: `grep -nE -- '--(background|card|popover|border):\s*#'` below
  the `.dark,` line (134) → exactly 1 hit, at `:247`, confirmed by reading the surrounding lines
  to be inside a `/* ... */` comment (opens `:246`, closes `:249`), not a declaration
- `git diff --name-only` for both task commits does not list `src/components/ThemeSwitcher.tsx`
- Each commit's `git show --stat HEAD` inspected immediately after committing: only the files
  this plan touched, nothing swept in from a concurrent session
- `.planning/STATE.md` / `.planning/ROADMAP.md` — confirmed untouched: `git status --short`
  clean at the start and end of this run, and `git log -- .planning/STATE.md
  .planning/ROADMAP.md` shows no commit from this executor
- The scratch measurement script (`measure-contrast-scratch.mjs`) was created inside the repo
  only to resolve Node module resolution for `@playwright/test`, run, and deleted before
  staging — confirmed absent from both commits and from the final `git status`

## Self-Check

- `src/index.css` — FOUND, contains all 30 ramp/alias tokens (verified above)
- `.planning/phases/122-tokens-primitives-contrast-measurement/122-RAMP-DERIVATION.md` — FOUND
- Commit `a4b02d56` — FOUND in `git log --oneline`
- Commit `eec4c710` — FOUND in `git log --oneline`

## Self-Check: PASSED

## Key Files

- `src/index.css` — modified, +104/-17 across both commits (six-token ramp added to all 5
  theme blocks; `--background`/`--card`/`--popover`/`--border`/`--input` re-pointed to `var()`
  aliases in all 5 theme blocks)
- `.planning/phases/122-tokens-primitives-contrast-measurement/122-RAMP-DERIVATION.md` — new
  file, per-theme derivation source, arithmetic, and measured contrast

## Metrics

- Duration: this session
- Tasks: 2/2 completed
- Commits: 2 (`a4b02d56`, `eec4c710`)
- Files touched: 2 (`src/index.css`, `122-RAMP-DERIVATION.md`)
