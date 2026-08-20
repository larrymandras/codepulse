---
phase: 123-accessibility-remediation
plan: 02
subsystem: testing
tags: [playwright, e2e, accessibility, wcag, contrast, rasterisation]

requires: []
provides:
  - "D-02 pass-2 isolation harness: e2e/contrast-isolation.spec.ts measures any class string against any theme's real surface tokens via canvas rasterisation, never hex+alpha arithmetic"
  - "D-03 font-metric-gated WCAG threshold: e2e/lib/contrast.ts's readTextMetrics + wcagThresholdFor (3:1 large text >=24px or >=18.66px bold, else 4.5:1 normal)"
  - "Shared e2e/lib/contrast.ts module: one rasteriser, one luminance formula, imported by both theme-rendered-result.spec.ts and contrast-isolation.spec.ts"
affects: [123-07]

tech-stack:
  added: []
  patterns:
    - "Extracted-module reuse: SENTINEL/sampleColor/compositeSample/paintedColorOfClass/getThemeTokenText/relativeLuminance/contrastRatio/channelDistance moved (cut, not copied) from theme-rendered-result.spec.ts into e2e/lib/contrast.ts, imported by both specs"
    - "Whole-matrix-in-one-test aggregation: the D-02 ledger (240 isolation + 8 isolation-before rows) is built and written from a single test function body rather than a module-scope array + afterAll, sidestepping the fullyParallel per-worker-process aggregation problem 123-01 hit with its own guard"
    - "Git-extraction idiom applied to a Tailwind utility class (not just a CSS custom property): confirmClassPresentAtSha anchors the C6 before-control on a hard-coded 40-char SHA via execSync, same pattern as extractPrePhaseToken but proving class presence in TSX source rather than reading a CSS token value"

key-files:
  created:
    - e2e/lib/contrast.ts
    - e2e/contrast-isolation.spec.ts
  modified:
    - e2e/theme-rendered-result.spec.ts
    - .gitignore

key-decisions:
  - "PRE_123_SHA (327cf92b47438ab0b1a5aca62a82663e745516ea) is the commit immediately after this plan's own Task 1 (shared-module extraction), captured via a one-time `git rev-parse HEAD`, not a value from before Phase 123 started. This is correct for what C6 needs here: D-01's text-*/NN sweep is a LATER plan in this phase (123-03..07), so at implementation time no sweep commit had yet touched DashboardLayout.tsx's two probed classes -- the live-rendered measurement IS the pre-sweep 'before' figure, and confirmClassPresentAtSha ties that claim to real git history rather than to an unverified assumption that nothing changed."
  - "C6's 'git-extracted pre-change value' idiom was adapted, not reused verbatim: extractPrePhaseToken (theme-rendered-result.spec.ts) reads a CSS custom property's literal text from a git blob. The two C6 probes are Tailwind utility classes in TSX source, not CSS custom properties -- there is no historical stylesheet to render them against. confirmClassPresentAtSha instead confirms the class string is literally present in the component file at the anchor SHA (a real git-extraction), then the actual colour is measured live, valid for exactly as long as that file hasn't changed since the anchor -- true at 123-02 time."
  - "C3's known-passing control is text-foreground (not text-primary or another token) because it needs zero opacity modifier and a documented near-white/near-black resolution in every theme -- measured 15.4:1-19.4:1 across all four themes, comfortably clear of the 4.5:1 floor being tested against."
  - "The main matrix test asserts EXACT row counts (240 isolation, 8 isolation-before) rather than only the >=60 floor the plan's acceptance criteria state as the minimum -- a stronger, more specific check that a silently truncated matrix (one skipped theme, one skipped surface) would fail loudly rather than merely dip below a floor with headroom to spare."

requirements-completed: []
# A11Y-02 is NOT completed by this plan -- it spans 12 of Phase 123's 13 plans
# (per STATE.md's requirements-coverage note) and closes only once the
# ratio-gated sweep (123-03..07) and the widened axe scan (123-08) land.
# This plan builds the measurement instrument the rest of A11Y-02 depends on.

duration: 18min
completed: 2026-08-20
---

# Phase 123 Plan 02: D-02 pass-2 isolation harness + D-03 font-metric threshold Summary

**A shared, sentinel-guarded rasterisation module plus a pass-2 isolation spec that measures any of the 15 unique `text-*/NN` opacity-modifier classes against any theme's real surface tokens, self-proven by a sub-AA fixture (C3) and a git-anchored before-control (C6).**

## Performance

- **Duration:** 18 min
- **Started:** 2026-08-20T14:36:00Z (first file read)
- **Completed:** 2026-08-20T14:54:00Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- `e2e/lib/contrast.ts` now holds the single rasteriser and the single WCAG luminance/contrast formula this project uses anywhere colour is measured — `SENTINEL`, `sampleColor`, `compositeSample`, `paintedColorOfClass`, `getThemeTokenText`, `relativeLuminance`, `contrastRatio`, `channelDistance` moved (cut, not copied) out of `theme-rendered-result.spec.ts` verbatim, plus two new exports: `readTextMetrics` (reads a TARGET element's own computed font-size/weight, `null` on no match — never `document.documentElement`) and `wcagThresholdFor` (D-03's 3:1-large/4.5:1-normal rule, mirroring axe exactly, verified against all five of Task 1's unit cases including the two shell elements this phase must fix: 14px normal and 12px bold both correctly resolve to 4.5, not 3).
- `theme-rendered-result.spec.ts` re-points at the shared module and still passes **47/47** — the identical figure Phase 122 closed TOKEN-01 on, proving the move altered nothing behaviourally.
- `e2e/contrast-isolation.spec.ts` is the new D-02 pass-2 instrument: a `CLASS_MATRIX` of all 15 unique `text-*/NN` class strings, each measured against all four default surface tokens (`--background`/`--card`/`--popover`/`--muted`) in all four themes — 240 rows — via real browser alpha-compositing (`measureClassOnSurface`: read the surface as opaque, read the class's own computed colour, composite the two, compute the WCAG ratio against the opaque surface). Every row carries `pass: "isolation"` and the threshold used (flat 4.5:1 at class level, since font size belongs to an occurrence, not a class).
- **C3** (harness discriminates sub-AA from compliant): `text-muted-foreground/30` on `--background` measured **1.557–1.651:1** across all four themes (well below 4.5), while `text-foreground` on `--background` measured **15.448–19.357:1** (well above) — both assertions in one test per theme, so a harness that flags nothing and one that flags everything both fail.
- **C6** (before/after control): `text-muted-foreground/80` and `text-primary/60` on `--card`, both sourced from `src/layouts/DashboardLayout.tsx` (the file STATE.md's scope narrative attributes 184 of 205 measured contrast nodes to), anchored to a hard-coded SHA `327cf92b47438ab0b1a5aca62a82663e745516ea` — the commit immediately after this plan's own Task 1, captured once via `git rev-parse HEAD`, never a relative ref. `confirmClassPresentAtSha` proves via `execSync git show <sha>:<path>` that the class literally exists in source at that anchor before the ratio is recorded under `pass: "isolation-before"`.
- Sentinel discipline re-verified independently in this new file: `sampleColor(page, "not-a-color-9x7q2")` → `null`; `sampleColor(page, "#ffffff")` → `[255,255,255]`.
- `e2e/.artifacts/123-isolation-pass2.json` (gitignored, regenerated per run) holds **248 rows exactly** (240 isolation + 8 isolation-before) — the row count is asserted exactly in the spec itself, not just floor-checked, so a silently truncated matrix fails loudly.
- All 55 tests across both specs pass (47 + 8); `npx tsc --noEmit` clean for every file this plan touched.

## Task Commits

1. **Task 1: Extract the shared contrast module and add the D-03 font-metric reader** — `327cf92b` (feat)
2. **Task 2: Build the pass-2 isolation spec with its C3 sub-AA fixture** — `f8751286` (feat)

## Files Created/Modified

- `e2e/lib/contrast.ts` — New. The shared rasteriser + WCAG module: 8 moved exports, 2 new (`readTextMetrics`, `wcagThresholdFor`).
- `e2e/theme-rendered-result.spec.ts` — Imports the 8 moved helpers from `./lib/contrast`, deletes its now-duplicate local definitions. `PRE_PHASE_SHA`, `extractPrePhaseToken`, `gotoWithTheme`, `TAILWIND_STATIC`, `allSamples`, `record`, and every `test.describe` block left exactly as they were.
- `e2e/contrast-isolation.spec.ts` — New. The D-02 pass-2 instrument: `CLASS_MATRIX` (15 classes), `measureClassOnSurface`, `confirmClassPresentAtSha`, C3/C6/sentinel-discipline/`wcagThresholdFor`-unit-cases tests, and the combined matrix+before-control test that writes the ledger.
- `.gitignore` — Added `e2e/.artifacts/` (the isolation ledger, regenerated per run, consumed by 123-07).

## Decisions Made

See `key-decisions` in frontmatter — summarized: PRE_123_SHA anchors "immediately after this plan's Task 1," not "before Phase 123 started" (D-01's sweep is later in this phase, so this is the correct pre-sweep anchor); C6's git-extraction idiom was adapted from CSS-custom-property lookup to TSX-class-presence confirmation since there's no historical build to render against; `text-foreground` chosen as C3's known-passing control for its zero-opacity, high-contrast resolution in every theme; exact row counts asserted, not just the >=60 floor.

## Deviations from Plan

None — plan executed exactly as written, both tasks' acceptance criteria satisfied on the first live run (after one grep-vs-comment-prose fix, see below).

### Auto-fixed Issues

**1. [Rule 1 - Bug] `grep -Fc "HEAD~1"` acceptance check tripped on explanatory prose, not code**
- **Found during:** Task 2, acceptance-criteria verification pass
- **Issue:** The plan's own acceptance criterion (`grep -Fc "HEAD~1" e2e/contrast-isolation.spec.ts` must return 0) is meant to prove the anchor SHA is hard-coded rather than dynamically resolved. My first draft's doc comments explained the anchoring rule by naming the rejected relative-ref form literally (`never HEAD~1`), which the naive grep cannot distinguish from actual code usage — it matched the comment text, not a resolution call.
- **Fix:** Reworded both comments to describe the same rule ("a relative ref one commit back") without spelling out the literal string, since the code never used `HEAD~1` in the first place — this was a prose-vs-grep mismatch, not a logic bug.
- **Files modified:** `e2e/contrast-isolation.spec.ts`
- **Verification:** `grep -Fc "HEAD~1" e2e/contrast-isolation.spec.ts` returns 0; full spec re-run, still 8/8 passing.
- **Committed in:** `f8751286` (Task 2 commit)

**Impact on plan:** Trivial, doc-comment-only; no logic changed.

## Issues Encountered

None beyond the one documented above.

## User Setup Required

None — no external service configuration required. Both new files are local test infrastructure only.

## Next Phase Readiness

- Wave 0 is now fully complete (`123-01` + `123-02`, both harness-only, no `src/` edits). The ratio-gated `text-*/NN` sweep (wave 1: `123-03`–`123-07`) can now proceed — it depends on this plan's C3/C6-proven measurement instrument to distinguish a fix from a regression.
- `123-07` is the declared consumer of `e2e/.artifacts/123-isolation-pass2.json`; the ledger schema (`pass`, `theme`, `className`, `surface`, `threshold`, `ratio`, `fg`, `bg`) is stable and documented in this file's header comment.
- No blockers.

---
*Phase: 123-accessibility-remediation*
*Completed: 2026-08-20*

## Self-Check: PASSED

Files confirmed present on disk via direct checks: `e2e/lib/contrast.ts` (YES), `e2e/contrast-isolation.spec.ts` (YES), `e2e/theme-rendered-result.spec.ts` (modified, present), `.gitignore` (modified, present). Both task commit hashes (`327cf92b`, `f8751286`) confirmed present via `git log --oneline --all | grep`. No missing items.
