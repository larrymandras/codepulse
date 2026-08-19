---
phase: 122-tokens-primitives-contrast-measurement
plan: 18
subsystem: testing
tags: [playwright, canvas, wcag-contrast, tailwind-v4, e2e, rasterisation]

# Dependency graph
requires:
  - phase: 122-04..122-08
    provides: the sweep ledgers naming which sites were converted to --astridr and which were re-hued (122-07-LEDGER.md, 122-08-LEDGER.md)
  - phase: 122-10
    provides: the Forge failed badge's corrected fill/foreground token pair and 122-BADGE-LAW.md §8's rasterisation method precedent
  - phase: 122-01/122-02/122-03
    provides: the surface ramp, hue decouple and reduced-motion tokens this plan measures
provides:
  - "e2e/theme-reduced-motion.spec.ts extended with population-level no-motion checks (D-11/D-12), each paired with a must-differ control"
  - "e2e/theme-rendered-result.spec.ts: a new 47-test rasterised spec proving the token layer's rendered pixels, not just its source classes, per D-27"
  - "122-RENDERED-RESULT.md: full before/after measured values, anchored on the explicit pre-phase SHA 2ddc80f5516ed3312fa4e5537c639a971633d4ea"
affects: [123-a11y-remediation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sentinel-guarded canvas rasterisation (magenta #ff00ff, refuse/null on unparseable input) as the ONLY sanctioned colour-measurement technique in this repo -- never regex-scrape a computed colour string"
    - "Synthetic class-string injection (paintedColorOfClass): create a throwaway DOM element carrying a real, already-compiled Tailwind class string, read its computed style, remove it -- measures a token's true rendered resolution without depending on live Convex data being present to render a specific badge"
    - "Pre-phase git-blob token extraction: read a custom property's literal declared value out of `git show <SHA>:src/index.css` text (never a computed-colour regex) to build a control for a token that no longer exists live"

key-files:
  created:
    - e2e/theme-rendered-result.spec.ts
    - .planning/phases/122-tokens-primitives-contrast-measurement/122-RENDERED-RESULT.md
  modified:
    - e2e/theme-reduced-motion.spec.ts

key-decisions:
  - "amber excluded from the rendered-result matrix per D-04 (unreachable theme, cannot be measured against a rendered page) -- stated in a file-header comment, not silently dropped"
  - "SEPARATION_THRESHOLD=30 (Euclidean sRGB-byte distance) for status-ok/primary and astridr-exclusivity checks -- comfortably above rounding noise, comfortably below every measured real separation (min 45.5, typically 76-194)"
  - "Two distinct pre-phase control techniques, each labelled: direct git-blob token-text extraction for tokens/values still declared in some form pre-phase; Tailwind's own static theme.css palette literals for classes the sweep fully removed from the live compiled CSS (bg-red-900/60, purple-400/600/700, indigo-400)"
  - "structural-guarantee test (section 6) uses test.skip when a worker process recorded zero samples, documenting the Playwright multi-worker module-state limitation rather than presenting a false failure or silently forcing --workers=1"

patterns-established:
  - "Rasterised rendered-result spec as the closing gate for any future token/palette phase: source-level sweeps prove the class string changed, this pattern proves the pixel changed"

requirements-completed: [TOKEN-01, TOKEN-02, TOKEN-03]

# Metrics
duration: 70min
completed: 2026-08-19
---

# Phase 122 Plan 18: Rendered-Result Measurement Summary

**Rasterised Playwright spec (47 tests) proving the token layer's rendered pixels match its source across four themes, plus population-level reduced-motion checks with must-differ controls -- both against a pre-phase SHA control, never a regex over a computed colour string.**

## Performance

- **Duration:** ~70 min
- **Tasks:** 2
- **Files modified:** 3 (1 extended, 2 created)

## Accomplishments

- Extended `e2e/theme-reduced-motion.spec.ts` with 4 new tests (2 assertions + 2 required must-differ
  controls) proving D-11 (readable's blanket no-effects rule) and D-12 (reduced-motion population
  check) by population walk rather than trust, with the two failure-message shapes verified live by
  deliberately breaking each assertion and reading the printed output before reverting.
- Created `e2e/theme-rendered-result.spec.ts` (569 lines, 47 tests): a sentinel-guarded canvas
  rasterisation spec proving five D-27 claims per exposed theme (surface distinctness, body-paints-
  surface-0, status-ok/primary separation, Forge failed AA-clearance against `--card`, astridr
  exclusivity in both directions), each with a pre-phase control anchored on the explicit SHA
  `2ddc80f5516ed3312fa4e5537c639a971633d4ea`.
- Wrote `122-RENDERED-RESULT.md` recording every measured before/after value, the `git log`
  excerpt proving the pre-phase SHA anchor, and the two distinct control techniques used.
- Ran the full suite (47/47 e2e, both `--workers=1` and default parallel), `npx tsc --noEmit`
  (clean), `npm run build` (exit 0), and `npx vitest run` (346 files / 4873 passed / 0 failed --
  identical to the phase baseline, no regressions).

## Task Commits

1. **Task 1: Population-level reduced-motion and readable assertions, each with its must-differ
   control** - `a0d82823` (test)
2. **Task 2: The rasterised rendered-result spec with pre-phase controls** - `e53de762` (test)

**Plan metadata:** this file's own commit (docs: complete plan) will follow.

_Note: no test/feat split was required -- both tasks are TDD-neutral (`autonomous: true`,
`tdd_mode: false` per this plan's frontmatter), and both commits include their own verification
evidence in the commit message._

## Files Created/Modified

- `e2e/theme-reduced-motion.spec.ts` - extended with 2 paired describe blocks (4 new tests): a
  population-level `getComputedStyle` walk over every element + `::before`/`::after` (filtered on
  `content !== "none"` to exclude phantom pseudo-elements), asserting zero animation/transition
  offenders under `prefers-reduced-motion` (cyan) and under `readable` with no override, each paired
  with a control that must show non-zero offenders.
- `e2e/theme-rendered-result.spec.ts` - new. Defines `sampleColor`/`compositeSample` (sentinel-guarded
  canvas rasterisers), `paintedColorOfClass` (synthetic real-class-string injection),
  `getThemeTokenText` (live custom-property read), `extractPrePhaseToken` (git-blob token-text
  lookup), `contrastRatio`/`relativeLuminance`/`channelDistance`, and 47 tests across a probe
  self-control section, four per-theme surface/body-paint checks, four per-theme status-ok/primary
  separation checks, four per-theme Forge-failed-contrast checks, six per-theme astridr-exclusivity
  checks, and one cross-run structural guarantee.
- `.planning/phases/122-tokens-primitives-contrast-measurement/122-RENDERED-RESULT.md` - new. Full
  measured before/after values per theme for all five D-27 claims, the pre-phase SHA's `git log`
  excerpt, and an explicit method note distinguishing this file's stricter pre-phase-SHA-anchored
  control from `122-BADGE-LAW.md` §8's narrower Task-2-internal control.

## Decisions Made

- **`amber` excluded from the matrix, per D-04**, stated in the spec file's header comment: it
  carries the full token set but is not exposed in `ThemeSwitcher`, so it cannot be measured against
  a rendered page.
- **`SEPARATION_THRESHOLD = 30`** (Euclidean distance in sRGB byte space, 0-441.7 max range) for both
  the status-ok/primary separation check and the astridr-exclusivity "must not match" direction.
  Justified in-file: comfortably above single-digit rounding/anti-aliasing noise, comfortably below
  every real measured separation in this run (minimum 45.5, `DetailActivityTab.tsx`'s indigo vs.
  astridr; typical range 76-194).
- **Two distinct, explicitly-labelled pre-phase control techniques**, because a single technique
  could not cover both cases honestly: (1) direct extraction of a custom property's literal declared
  value from `git show <SHA>:src/index.css` text, used wherever the pre-phase token/value still
  exists in some declared form; (2) Tailwind's own static `node_modules/tailwindcss/theme.css`
  palette literals (`red-900`, `purple-400/600/700`, `indigo-400`), used only where the sweep fully
  removed the old class from the live compiled CSS, so there is no live element left to sample it
  from. Both are documented in the spec file's header and in `122-RENDERED-RESULT.md`'s "Method
  note" section, never silently mixed.
- **The Forge-failed AA-clearance check explicitly composites over `--card`** rather than only
  arguing the fill's opacity makes the backdrop moot -- proven by asserting the composited sample
  equals the raw-fill sample in every theme, satisfying the plan's "measured against `--card`, not
  the page background" instruction literally rather than by argument alone.
- **The astridr-exclusivity check names its ledger provenance per site** in code comments
  (`122-07-LEDGER.md` slice D for the two re-hued sites, `122-08-LEDGER.md` slice E for
  `Memory.tsx`'s converted site), and asserts both directions in separate tests so a reviewer can see
  exactly which real files and which adjudicated rows back each claim.
- **Section 6's structural-guarantee test uses `test.skip` when its worker recorded zero samples**,
  documenting -- rather than hiding -- that Playwright's default multi-worker config gives each
  worker process its own copy of the module-scope `allSamples` array; run with `--workers=1` (as
  this plan's verification did) to see every sample from a single run in one place.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' acceptance criteria were met without needing
Rule 1-4 auto-fixes; the only in-flight correction was the `test.skip` guard added to Task 2's
structural-guarantee test after discovering (by running the spec under Playwright's DEFAULT parallel
config, not just `--workers=1`) that a worker with no prior test in this file legitimately records
zero samples -- this is a measurement-honesty fix to the test itself (Rule 1, the check would
otherwise fail on a fact about worker scheduling, not about the app), verified by re-running both
`--workers=1` and default-parallel and confirming 47/47 in both.

## Issues Encountered

- **`bg-red-900/60` (the exact old Forge-failed opacity class) and the exact pre-phase
  `purple-400/600/700` class strings are no longer compiled anywhere in the live app** -- the
  phase's own sweep converted or removed every occurrence, confirmed via `git grep`. Resolved by
  reading the true, static Tailwind palette values directly from the installed `tailwindcss` package
  (`node_modules/tailwindcss/theme.css`), not by guessing or reconstructing them from memory --
  every such literal is cited by its source line in both the spec file and `122-RENDERED-RESULT.md`.
- **Module-scope state (`allSamples`) is per-worker-process under Playwright's default parallel
  config** -- discovered by running the new spec without `--workers=1` after first developing it
  serially, which surfaced a false failure in the structural-guarantee test. Fixed with a documented
  `test.skip` rather than forcing a config change or silently ignoring the gap; both run modes are
  green.

## User Setup Required

None - no external service configuration required. `dev:noauth` was started for verification and
explicitly stopped (`taskkill`) after the run, confirmed down via a post-kill probe returning no
response, per T-122-18-A.

## Next Phase Readiness

- 122-19 (D-05's human half, the after-measurement, and phase close) can proceed: this plan's
  rendered-pixel proof and its pre-phase control are both committed and available at
  `122-RENDERED-RESULT.md`.
- `.planning/STATE.md`, `.planning/ROADMAP.md`, `src/index.css`, `a11y-before/*.json`, and
  `122-CONTRAST-BASELINE.md`'s Before section were not touched, per this plan's shared-artifact
  ownership boundary.

---
*Phase: 122-tokens-primitives-contrast-measurement*
*Completed: 2026-08-19*

## Self-Check: PASSED

- FOUND: `e2e/theme-rendered-result.spec.ts`
- FOUND: `e2e/theme-reduced-motion.spec.ts`
- FOUND: `.planning/phases/122-tokens-primitives-contrast-measurement/122-RENDERED-RESULT.md`
- FOUND: `.planning/phases/122-tokens-primitives-contrast-measurement/122-18-SUMMARY.md`
- FOUND commit: `a0d82823` (Task 1)
- FOUND commit: `e53de762` (Task 2)
- FOUND commit: `432ff26e` (this summary)
