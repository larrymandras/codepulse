---
phase: 120-polish-verified-defects
plan: 07
status: complete — 5/5 tasks
subsystem: ui
tags: [tailwind, flexbox, e2e, playwright, geometry, header]

# Dependency graph
requires:
  - phase: 120-02
    provides: DashboardLayout.tsx nav-glow/wordmark/matrix-bg removal (line numbers below the header shifted as a result)
  - phase: 120-06
    provides: Settings.tsx pulse gating, prefersReducedMotion.ts (unrelated area, no conflict)
provides:
  - "e2e/polish-geometry.spec.ts — permanent in-page geometry regression guard for the E-Stop control and the shared header row"
  - "src/components/EStopButton.tsx fixed geometry (shrink-0 + whitespace-nowrap), measurement-justified"
  - "src/layouts/DashboardLayout.tsx header flex-wrap fix for the 900px collision — root cause was the shared header, not Settings.tsx"
  - ".planning/phases/120-polish-verified-defects/120-GEOMETRY-EVIDENCE.md — BEFORE/AFTER/control/corrections/attended/handoff evidence, complete"
affects: [124-shell-01, 124-shell-02]

tech-stack:
  added: []
  patterns:
    - "Text-node Range().getClientRects() for wrap detection on a flex-item label, since a flex item's computed display is CSS-blockified and its own getClientRects() always returns 1 rect even when its text content wraps"
    - "document.body-wide (not <main>-scoped) overflow walk, gated to rect.right > innerWidth only (not scrollWidth mismatch), excluding sr-only elements, as the correct 'nothing cut off at the viewport edge' observable"

key-files:
  created:
    - e2e/polish-geometry.spec.ts
    - .planning/phases/120-polish-verified-defects/120-GEOMETRY-EVIDENCE.md
  modified:
    - src/components/EStopButton.tsx
    - src/components/__tests__/EStopButton.test.tsx
    - src/layouts/DashboardLayout.tsx

key-decisions:
  - "POLISH-02's wrap detector was rewritten mid-task: labelSpan.getClientRects() is structurally blind to the wrap it was meant to catch (a flex item's span is CSS-blockified to display:block, so a block box always reports 1 client rect regardless of internal line wraps). Switched to a Range over the label's text node, which is never blockified and correctly reports 2 rects at the hyphen break."
  - "POLISH-06's actual root cause is NOT in Settings.tsx (TabsList/Sheet, the plan's own top candidates) — it is in the SHARED <header> in DashboardLayout.tsx, present on every route. The plan's own <main>-scoped, document.scrollWidth-gated reproduction check legitimately finds nothing, because a distant ancestor's overflow-hidden invisibly clips the real overflow before it reaches document-level scrollWidth. Settings.tsx was left completely unedited."
  - "Block 2's culprit-detection criterion was narrowed from (scrollWidth>clientWidth OR right>innerWidth) to right>innerWidth only, and sr-only elements are excluded from the walk — the scrollWidth half fired on two benign, pre-existing, unrelated patterns (Radix/shadcn's sr-only 1px-clip a11y technique, and the sidebar nav's own already-declared overflow-x-auto) once the walk was widened from <main> to <body>."
  - "Fix is header-only: h-14 -> min-h-14, added flex-wrap + gap-y-1. No sidebar width change, no literal 900 breakpoint, no Settings.tsx edit — proven load-bearing by a revert-and-refail control (fails with 15 culprits and a 256px overflow when reverted, passes cleanly across 3 independent runs when restored)."

requirements-completed: [POLISH-02, POLISH-06]
requirements-partial: []

# Metrics
duration: ~110min (Tasks 1-3) + Task 5 evidence write-up (this continuation)
completed: 2026-08-17
---

# Phase 120 Plan 07: E-Stop & 900px Collision Geometry Fixes Summary

**Reproduced and fixed both geometry defects by in-page measurement: the E-Stop label was wrapping at its hyphen under header-row compression (fixed with `shrink-0` + `whitespace-nowrap`), and the true 900px collision was a shared, unbounded `<header>` flex row — not Settings' own TabsList/Sheet as the plan's draft candidates suggested — fixed with `flex-wrap` on the header alone. Human operator returned a bare `approved` for Task 4 with no specific observations reported, so the substantive proof rests on the measurements and the revert-and-refail control, not the attended pass.**

## Status: COMPLETE (5/5 tasks)

Tasks 1-3 (reproduce, E-Stop fix, 900px-collision fix) were executed and committed by a prior
session. Task 4 (`checkpoint:human-verify`, `gate="blocking"`) was resolved by the human operator
returning the plan's own resume signal, `approved`, with no further detail. This continuation
performed Task 5: appended `§ AFTER`, `§ The load-bearing control`, `§ Corrections to
CONTEXT.md` (three corrections, including a new third one this continuation added — the plan's
own predicted 900px culprit, `Settings.tsx`, was wrong), `§ Attended verification`, and
`§ Handoff` to `120-GEOMETRY-EVIDENCE.md`, using only verbatim evidence already in the file plus
two fresh greps re-run directly for the Corrections section. The plan is complete.

## Performance

- **Duration:** ~110 min (Tasks 1-3, prior session, includes methodology corrections found
  live — see Deviations) + this continuation's Task 5 write-up
- **Tasks:** 5 of 5 complete (Task 1 reproduce, Task 2 E-Stop fix, Task 3 900px-collision fix,
  Task 4 human-verify checkpoint resolved, Task 5 evidence formalization)
- **Files modified:** 3 existing (`EStopButton.tsx`, `EStopButton.test.tsx`, `DashboardLayout.tsx`)
  + 2 new (`e2e/polish-geometry.spec.ts`, `120-GEOMETRY-EVIDENCE.md`)

## Accomplishments

- Wrote `e2e/polish-geometry.spec.ts` (279 lines, 7 tests across 2 describe blocks) and ran it
  against `npm run dev:noauth` on port 5181 (Git Bash, per the invocation contract) BEFORE any
  source change, per Task 1's reproduction-first requirement.
- **Found and fixed a defect in the reproduction methodology itself, live, before trusting the
  first pass's green result.** The original wrap detector (`labelSpan.getClientRects().length`)
  passed vacuously at every width because the label span is a flex item and gets CSS-blockified to
  `display:block` — a block box's `getClientRects()` always returns 1 rect regardless of internal
  line wraps. Rewrote it to use a `Range` over the label's text node (never blockified), which
  correctly reproduced the wrap: `labelTextNodeRectsLength: 2` ("E-" / "Stop") at 360/640/900px,
  and intermittently at 1440px depending on async header-content timing. Only 2560px avoided it.
- **Widened the 900px-collision probe per Task 1's own fallback instruction** after the plan's own
  `<main>`-scoped, `document.scrollWidth`-gated check found nothing (culprits empty, scrollWidth ==
  innerWidth, at a plain 900x900 `/settings` load). A document-body-wide walk across 820-1000px
  found a real, severe (204-384px) overflow — not in Settings' content at all, but in the shared
  `<header>`'s icon cluster, invisibly clipped by a distant ancestor's `overflow-hidden` before it
  could ever reach `document.documentElement.scrollWidth`. Traced to root cause: none of the
  header's three row groups (left cluster / search box / icon cluster) has a shrink guard or its
  own `overflow` set, so each keeps its full content-driven minimum width (981px combined) against
  the header's own correctly-bounded 660px box.
- Fixed `EStopButton.tsx`: `shrink-0` on the trigger button and icon, `whitespace-nowrap` on the
  label — each justified by the specific measurement that showed it (compression width delta,
  text-node rect count). Added one contract-guard unit test, explicitly labeled as not a proof of
  geometry (jsdom doesn't lay out text); all nine pre-existing behavioural tests pass UNEDITED.
- Fixed `DashboardLayout.tsx`'s `<header>` (only): `h-14` → `min-h-14`, added `flex-wrap` +
  `gap-y-1`. Nothing in `Settings.tsx` needed to change — `git diff --stat src/pages/Settings.tsx`
  is empty. No sidebar width change, no literal `900` breakpoint introduced.
- Refined the culprit-detection criterion after the header fix surfaced two benign,
  pre-existing false positives (a Radix/shadcn `sr-only` a11y-hiding pattern, and the sidebar
  nav's own already-declared `overflow-x-auto` internal scroll) — narrowed to `rightOverflow > 1`
  only (an element's box genuinely extending past the viewport edge), which is the literal "cut
  off at the right edge" observable the plan and Task 4's checklist describe.
- Performed the Task 3-mandated revert-and-refail control by hand-editing the header's className
  back to its exact original string, confirming the spec FAILS again (256px overflow, 15
  culprits), then restoring the fix byte-for-byte (`diff` confirmed identical) and confirming it
  PASSES again, across 3 independent re-runs.
- Full-suite verification: `npx tsc --noEmit` exit 0; `npx vitest run` 336 files / 4690 tests
  passed (baseline 336/4689 + 1 new contract-guard test), 0 failing; `npm run build` exit 0.

## Task Commits

Per the orchestrator's `CRITICAL_COMMIT_OVERRIDE`: **no commits were made by this executor.** All
work is left uncommitted in the working tree; the orchestrator commits with explicit paths.

## Files Created/Modified

- `e2e/polish-geometry.spec.ts` — new. Two describe blocks: E-Stop fixed geometry (5 widths +
  1 cross-width comparison test) and the 900px collision (1 test, document-body-wide walk).
- `.planning/phases/120-polish-verified-defects/120-GEOMETRY-EVIDENCE.md` — new, PARTIAL. Covers
  `§ BEFORE` (both the flawed first pass and the corrected reproduction), `§ Task 2`, `§ Task 3`
  including the load-bearing control, full-suite verification output, and a `§ Not yet done`
  section listing exactly what Task 5 still needs to formalize.
- `src/components/EStopButton.tsx` — `shrink-0` (button + icon), `whitespace-nowrap` (label),
  plus an explanatory comment on the trigger button documenting the measured mechanism.
- `src/components/__tests__/EStopButton.test.tsx` — one new contract-guard test (10th test,
  9 pre-existing UNEDITED).
- `src/layouts/DashboardLayout.tsx` — `<header>` className only: `h-14`→`min-h-14`, added
  `flex-wrap gap-y-1`, plus an explanatory comment documenting the measured root cause.

## Decisions Made

See `key-decisions` in frontmatter. In summary: two methodology corrections found live during
Task 1 (the E-Stop wrap detector was measuring the wrong DOM node; the 900px culprit walk was
scoped too narrowly to `<main>` and missed the real defect in the shared header), and one
criterion refinement found live during Task 3 (narrowing the culprit gate to `rightOverflow`
only, after widening the walk surfaced unrelated benign patterns). All three are documented in
full, with raw measurement evidence, in `120-GEOMETRY-EVIDENCE.md`.

## Deviations from Plan

### 1. [Rule 1 - Bug in own instrumentation] E-Stop wrap detector measured the wrong DOM node

- **Found during:** Task 1, first pass
- **Issue:** `labelSpan.getClientRects().length` always returned 1 because the span is a flex
  item and gets CSS-blockified to `display:block`; a block box's own client rects never fragment
  per visual line even when its text content wraps. The per-width assertion passed vacuously at
  every width while `buttonHeight` (48 vs 28) already proved a real defect existed.
- **Fix:** Switched the wrap-detection assertion to a `Range` over the label's text node, which is
  never blockified. Confirmed via a standalone probe: `getComputedStyle(labelSpan).display ===
  "block"`, and the text-node range reported 2 rects at 640px where the span reported 1.
- **Files modified:** `e2e/polish-geometry.spec.ts`
- **Verification:** Re-ran the spec; the corrected per-width assertion now correctly FAILS at
  360/640/900/1440px pre-fix (matching the height anomaly) and PASSES at 2560px, then passes at
  all five widths post-fix.

### 2. [Rule 1/Rule 4-adjacent — measurement scope, not architecture] 900px culprit walk was scoped too narrowly

- **Found during:** Task 1, after the plain `<main>`-scoped check found nothing
- **Issue:** Per the plan's own <interfaces> text, the culprit walk was scoped to "every element
  under the main content region." At a plain 900x900 `/settings` load this legitimately finds zero
  culprits and `document.documentElement.scrollWidth === window.innerWidth`, because the real
  overflow lives in the shared `<header>` (outside `<main>`) and is invisibly clipped by a distant
  ancestor's `overflow-hidden` before it can ever propagate to document-level `scrollWidth`.
- **Fix:** Per Task 1's own "widen the probe once" instruction, widened the walk to `document.body`
  and confirmed a severe, real (204-384px) overflow across 820-1000px, all in the header's icon
  cluster. This is a measurement-scope correction, not an architectural change — no code outside
  the walk's own JS logic was touched to make this discovery; the resulting FIX (Task 3) still
  lives entirely inside the file the plan already permitted (`DashboardLayout.tsx`).
- **Files modified:** `e2e/polish-geometry.spec.ts` (Block 2's evaluate scope)
- **Verification:** Full widened-probe matrix recorded in `120-GEOMETRY-EVIDENCE.md § BEFORE
  (900px collision)`.

### 3. [Rule 1 - false positive in own instrumentation] Culprit criterion over-fired on benign patterns once widened

- **Found during:** Task 3, immediately after applying the header fix
- **Issue:** The widened, document-body-wide walk's `scrollWidth > clientWidth` half fired on a
  Radix/shadcn `sr-only` accessibility-hiding element (deliberately clipped to 1px by design) and
  on the sidebar `<nav>`'s own already-declared `overflow-x-auto` internal children — neither is a
  page-edge collision (both had deeply negative `rightOverflow`, nowhere near the viewport edge).
- **Fix:** Narrowed the assertion to gate strictly on `rightOverflow > 1` (an element's own box
  genuinely extending past `window.innerWidth`) and excluded `sr-only` elements from the walk
  entirely. `scrollWidth` is still captured per element in the evidence payload for the record.
- **Files modified:** `e2e/polish-geometry.spec.ts` (Block 2's culprit-collection logic)
- **Verification:** Re-ran 3 times post-refinement; `culprits: []` identically every time.

**Total deviations:** 3, all found live during Tasks 1 and 3, all self-corrections to this plan's
own new instrumentation (not to any existing source file's behaviour). None required Rule 4
(architectural) escalation — every fix stayed inside the files the plan already scoped, and the
final source-code fixes (Task 2, Task 3) are exactly what the corrected measurements justified.

## Issues Encountered

None blocking. One non-blocking timing note: the E-Stop wrap at 1440px was reproducible in the
isolated per-width test but not always in the sequential cross-width test — attributed to
async header content (e.g. `systemResources`-driven "SYS/LAT" info) affecting how much the
header's siblings have rendered by measurement time, additional evidence for "compression by
unshrinkable siblings" as the mechanism (documented in `120-GEOMETRY-EVIDENCE.md`). Did not block
reproduction, fix, or verification, since 360/640/900px reproduced consistently across every run.

## User Setup Required

None. `npm run dev:noauth` was started and stopped by this executor for measurement purposes only;
no persistent service configuration was introduced.

## Verification Evidence (literal output)

**tsc (final, after both fixes):**
```
$ npx tsc --noEmit
(no output, exit 0)
```

**EStopButton unit tests (final):**
```
$ npx vitest run src/components/__tests__/EStopButton.test.tsx
 Test Files  1 passed (1)
      Tests  10 passed (10)
```

**Full suite (final):**
```
$ npx vitest run
 Test Files  336 passed | 17 skipped (353)
      Tests  4690 passed | 197 todo (4887)
```
Baseline (per dispatch): 336 files / 4689 tests. Delta: +1 test, exactly the new EStopButton
contract-guard test. 0 failing.

**Build:**
```
$ npm run build
✓ built in 1.10s
```

**e2e spec, final state, 3 consecutive independent runs (all clean):**
```
SETTINGS-900-EVIDENCE {"innerWidth":900,"scrollWidth":900, ...,"culprits":[]}
7 passed (4.0s)
```
(identical across all 3 runs)

**Revert-and-refail control (Task 3):**
```
# reverted:  1 failed, 6 passed — icon cluster right edge at x=1156.5 vs 900px viewport (256px overflow), 15 culprits
# restored (diff-confirmed byte-identical to pre-revert): 7 passed — culprits: []
```
Full raw JSON for both halves is in `120-GEOMETRY-EVIDENCE.md § Task 3 § The load-bearing control`.

**Acceptance-criteria greps:**
```
$ grep -c 'aria-label="Emergency Stop"' src/components/EStopButton.tsx        → 1
$ grep -cE 'whitespace-nowrap|shrink-0|flex-none' src/components/EStopButton.tsx → 5
$ grep -c 'bg-red-600' src/components/EStopButton.tsx                          → 2 (unchanged)
$ grep -n '900' src/pages/Settings.tsx src/layouts/DashboardLayout.tsx         → only in explanatory comment prose, never a class
$ grep -c 'w-60' src/layouts/DashboardLayout.tsx                                → 2 (unchanged)
$ git diff --stat src/pages/Settings.tsx                                        → (empty — not touched)
```

## Known Stubs

None. This plan fixes rendered geometry; it introduces no new data-fetching surface, no
placeholder values, and no "coming soon" text.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern, or schema change was introduced.
The one trust boundary named in this plan's own threat model (`dev:noauth` bound to
`127.0.0.1` only) was respected throughout — `--host 127.0.0.1` was never dropped, and the server
was stopped at the end of this session.

## Next Phase Readiness — READY

- Task 4 (human-verify, `gate="blocking"`) is resolved: operator returned `approved`. Recorded as
  APPROVED-WITHOUT-DETAIL in `120-GEOMETRY-EVIDENCE.md § Attended verification` — no specific
  observation was reported, so that section states plainly that the substantive proof rests on
  the automated measurements and the revert-and-refail control, not the attended pass. 120-03's
  and 120-04's attended checks, folded into this same checkpoint, are recorded the same way.
- Task 5 is done: `120-GEOMETRY-EVIDENCE.md` now carries `§ AFTER`, `§ The load-bearing control`,
  `§ Corrections to CONTEXT.md` (three corrections — the E-Stop single-render-site correction and
  the sidebar-width correction, each re-verified with a fresh grep run in this continuation rather
  than copied from the plan, plus a new third correction stating the plan's own predicted 900px
  culprit, `Settings.tsx`, measured clean and was never the fix site), `§ Attended verification`,
  and `§ Handoff`.
- **The orchestrator's phase-level CRITERION-1 AGGREGATE check** (appended to this plan's
  `<verification>` section, checking `hover:scale-[1.01]` / `glitch-text` / `matrix-bg` /
  `nav-active-shadow` / `nav-hover-shadow` are 0 and `crt-scanline-bar` / `glow-card` survived at
  their expected counts, across ALL of 120-01..06) was **not run by this continuation** — it
  depends on all of 120-01..06 having landed and is explicitly scoped to whichever agent finishes
  last across the whole phase, not to this single plan's Task 5. Left for the orchestrator or a
  phase-level closure step.

## Task Commits (this continuation)

Per the same `CRITICAL_COMMIT_OVERRIDE` that governed the prior session: **no commits were made
by this continuation either.** Only `120-GEOMETRY-EVIDENCE.md` and this `120-07-SUMMARY.md` were
edited (both append/update-only); `.planning/STATE.md` and `.planning/ROADMAP.md` were not read as
ground truth, not edited, and not staged. All work remains uncommitted for the orchestrator.

---
*Phase: 120-polish-verified-defects*
*Status: COMPLETE — 5/5 tasks*

## Self-Check: PASSED (updated by Task 5 continuation)

- FOUND: `e2e/polish-geometry.spec.ts`
- FOUND: `.planning/phases/120-polish-verified-defects/120-GEOMETRY-EVIDENCE.md`
- FOUND: `src/components/EStopButton.tsx`
- FOUND: `src/components/__tests__/EStopButton.test.tsx`
- FOUND: `src/layouts/DashboardLayout.tsx`
- FOUND: `.planning/phases/120-polish-verified-defects/120-07-SUMMARY.md` (this file)
- No commit hashes to verify for this continuation's own work — per `CRITICAL_COMMIT_OVERRIDE`,
  this continuation made zero commits. Tasks 1-3's five files (`EStopButton.tsx`,
  `EStopButton.test.tsx`, `DashboardLayout.tsx`, `polish-geometry.spec.ts`, and this evidence
  file's Tasks 1-3 content) were already committed by the orchestrator in a prior single commit
  before this continuation was dispatched (per the dispatch's `<completed_state>`), confirmed
  live: `git status --short` at the start of this continuation showed only
  `.planning/STATE.md` modified (a concurrent session, out of scope, untouched) — none of the
  five source/spec files appeared as modified or untracked, confirming they are already committed.
- `git status --short` at the end of this continuation shows exactly two files changed beyond the
  pre-existing `.planning/STATE.md` concurrent-session drift: `120-GEOMETRY-EVIDENCE.md` (appended
  §§ AFTER / control / corrections / attended / handoff) and `120-07-SUMMARY.md` (this file,
  updated PARTIAL → complete). Nothing else in the working tree was touched by this continuation.
  `.planning/ROADMAP.md` was not touched.
- The Task 5 acceptance-criteria automated check, re-run directly: `grep -c 'AFTER'
  120-GEOMETRY-EVIDENCE.md` → `4` (the § AFTER heading plus three prose references to "AFTER"
  within it and the load-bearing-control section), confirming the section was written.
- Both `§ Corrections to CONTEXT.md` greps (`estop` render-site search, `w-60` sidebar-width
  search) were re-run directly in this continuation (not copied from the plan or from Task 1's
  prior run) and their literal output is pasted in `120-GEOMETRY-EVIDENCE.md § Corrections to
  CONTEXT.md`.
- `dev:noauth` background server was not started by this continuation (no live measurement was
  needed — all evidence quoted was already captured verbatim by the prior session); port 5181 was
  not touched.
