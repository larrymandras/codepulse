---
phase: 123-accessibility-remediation
plan: 08
subsystem: testing
tags: [accessibility, wcag, contrast, axe-core, playwright, measurement]

requires:
  - phase: 123-accessibility-remediation
    provides: "123-02's shared rasteriser (e2e/lib/contrast.ts) and contrast-isolation.spec.ts scaffold; 123-03's widened 47-route table (e2e/a11y-routes.ts) and D-13/D-14 gates; 123-04/05/06's contrast and aria fixes on the 5 criterion pages"
provides:
  - "188-cell widened axe scan attempted (4 themes x 47 routes); 140 cells completed with captures, 48 (12 routes x 4 themes) unmeasured due to an isolated Vite dev-server '504 Outdated Optimize Dep' defect -- root-caused live, not guessed at"
  - "20 criterion cells reconfirmed 0 violations of any rule id, holding 123-04/05/06's fixes under the widened harness"
  - "Full pass-2 isolation matrix (248 rows) and a complete pass-labelled classification of all 161 real (non-test) text-*/NN occurrences into measured-passing (74), measured-failing (7), and not-reached (80, of which 77 adjudicated REMEDIATE and 3 LEAVE-ALONE)"
  - "123-CONTRAST-RESULT.md: the file-and-line-explicit 84-occurrence remediation list plan 123-11 executes, plus the full population accounting D-01's gate and plan 123-09's decision need"
affects: [123-09, 123-11, 123-12]

tech-stack:
  added: []
  patterns:
    - "Real pass-1 axe data on a genuinely-rendered element is authoritative over the generic pass-2 isolation table, even when they disagree: several text-primary/70 sites measured passing (~4.0-4.4:1) against a real ancestor despite the class failing broadly (min 3.395:1) on all 4 generic DEFAULT_SURFACES -- the real ancestor these sites sit on isn't one of the 4 generic surfaces the isolation harness probes."
    - "Route reachability for a shared component cannot be assumed from directory convention; traced via a real import-closure BFS (following both relative and @/-alias imports) from every src/pages/**/*.tsx entry, which is what distinguished, e.g., InfoTooltip.tsx (used on 13 pages) from a page-scoped component."
    - "An occurrence's DOM presence at scan time cannot be inferred from route capture alone: static top-level JSX was credited passing only when axe genuinely scanned it and raised no violation; anything inside a .map(), a loading/error branch, or a conditional-render gate was pushed to not-reached rather than assumed rendered, because the captured axe payload stores only violations, not passes."

key-files:
  created:
    - .planning/phases/123-accessibility-remediation/a11y-widened/ (140 capture JSONs)
  modified:
    - .planning/phases/123-accessibility-remediation/123-CONTRAST-RESULT.md

key-decisions:
  - "Did not restart the shared dev:noauth server to chase the 48 unmeasured cells: the dispatch explicitly said to reuse it and never start a competing one, this executor does not own the process, and per this plan's own measurement discipline an unmeasured cell must be reported as its own category rather than force-fit into a false 188/47. Root-caused live instead (three independent navigation probes) and recorded as a named residual with exact route list, so plan 123-09's decision is made on real data about the gap, not a guess."
  - "Classified all 161 real occurrences (not just the plan's named calibration cases) into the three plan-defined buckets using a documented, conservative methodology: real axe violation cross-reference for measured-failing (7, exact ratios), a real import-closure trace + conditional-render heuristic for measured-passing (74) vs not-reached (80) -- the heuristic defaults uncertain cases to not-reached, which is the safe direction (77 of 80 not-reached sites end up in the remediation list via the isolation table rather than being silently credited passing)."
  - "Did not extend contrast-isolation.spec.ts's CLASS_MATRIX: the widened scan's 7 confirmed measured-failing nodes all sit on one of the 4 existing DEFAULT_SURFACES, so no new surface needed adding. This is a legitimate no-op outcome, not a skipped task -- git diff confirms the spec file is untouched."
  - "Caught and corrected a fabricated arithmetic claim before committing: the not-reached reason breakdown was first written as summing to 86 (with an unverified 'some sites overlap two reasons' explanation) instead of the true 80; a machine re-derivation from the same classification data the tables were built from found the real breakdown (53+18+7+1+1=80, zero overlap) and the doc was corrected in place before the Task 2 commit."

requirements-completed: []
# A11Y-02 is NOT completed by this plan -- it spans most of Phase 123's 13 plans (per
# 123-04/05/06/07-SUMMARY.md's identical note). This plan produces the measurement ledger
# D-01's remediation gate is judged against; the requirement stays open pending 123-11's
# actual edits and the phase's final verification.

duration: ~3h (includes root-causing the dev-server defect and building the classification tooling)
completed: 2026-08-20
---

# Phase 123 Plan 08: The pass-labelled contrast/accessibility ledger (D-02, D-16, C4, C5) Summary

**Ran the widened 47x4 axe scan (130s measured, 140/188 cells completed, 48 cells isolated to a live dev-server defect rather than silently dropped) and the pass-2 isolation matrix, then classified all 161 real `text-*/NN` occurrences into a reconciled, pass-labelled ledger producing an 84-occurrence file-and-line remediation list.**

## Performance

- **Duration:** ~3h
- **Tasks:** 2/2
- **Files modified:** 1 doc (`123-CONTRAST-RESULT.md`, 2 commits) + 140 new capture JSONs

## Accomplishments

- **Task 1 (pass 1, the widened scan).** Reused the already-running `dev:noauth` server on 5181
  (probed 200 before starting; never started a competing server). Ran
  `A11Y_SCAN_ALL=1 A11Y_MEASURE_ONLY=1 A11Y_CAPTURE_DIR=... PW_BASE_URL=http://localhost:5181
  node_modules/.bin/playwright test e2e/theme-contrast.spec.ts`. Measured wall-clock: **130s
  (2.1m)** -- the first real measurement of the widened matrix, replacing `123-RESEARCH.md`'s
  extrapolated "minutes" estimate. Exit code 1, as designed (D-14's measure-only throw); documented
  as a measurement run, not a red verification.
  - **140 of 188 declared cells completed and wrote a capture. 48 did not** -- exactly 12 routes
    (`Infrastructure, ConfigPage, Chat, Settings, Tasks, Reminders, InsightsChat, WarRoom,
    DocComments, HrOnboarding, HrRoster, HrTeams`) x all 4 themes. Root-caused live via three
    independent navigation probes (fresh `goto`, `reload`, fresh `goto` again -- all three
    identical): a Vite dev-server "504 Outdated Optimize Dep" causing a dynamic-import failure,
    caught by React's `ErrorBoundary`, leaving only the app shell rendered. Recorded as its own
    **UNMEASURED** category (never folded into any violation count or the pass/fail population),
    per this plan's explicit measurement-discipline instruction.
  - C5 satisfied structurally: the route table declares 47 (not 62), the loop generated 188 test
    calls (confirmed by the spec's own self-check test, which passed). The achieved capture
    population (140 files, 35 distinct routes) falls short of 188/47 for the isolated,
    root-caused dev-server reason above -- not a scan-enumeration defect.
  - The 20 criterion cells (all present, none fell in the 48-cell gap) aggregate to **0**
    violations of any rule id, reconfirming 123-04/05/06's fixes hold under the widened harness.
    Must-differ control satisfied: the full 140-cell aggregate is non-zero (71 objects / 883
    nodes across 8 rule ids), as expected for 35 previously-unscanned routes.
  - A genuine, un-asked-for finding recorded rather than smoothed over: `Ideation`'s
    `button-name` violation swung from 0 nodes (cyan/emerald/readable) to 474 nodes (aubergine
    only) -- flagged as theme-unstable / likely a live-data timing race, not adjudicated further
    (out of this task's scope).
  - Captures scanned for home-directory paths and API tokens with a fixed-string matcher before
    commit: 0 hits, paired with a 4-hit known-present control proving the scan discriminates.
- **Task 2 (pass 2, isolation + full classification).** `contrast-isolation.spec.ts` run unmodified
  (8/8 passed, 6.4s); C3, sentinel discipline, and the C6 before-control all reconfirmed live this
  run. No `CLASS_MATRIX` extension was needed -- documented as a legitimate no-op, not a skipped
  step.
  - Cross-referenced all 140 captures' `color-contrast` violations against the 15 tracked class
    strings by regex over the raw violation HTML: **7 confirmed measured-failing occurrences**,
    each mapped to an exact source `file:line` via a source grep on the violating text content.
  - Traced route reachability for every remaining occurrence via a real import-closure BFS
    (following both relative and `@/`-alias imports) from all `src/pages/**/*.tsx` entries, then
    applied a conservative conditional-render heuristic (`.map(`, loading/error branches,
    `{cond && ...}` gates) to separate genuinely-static occurrences from ones whose DOM presence
    at scan time isn't established.
  - Final reconciled classification of all 161 real (non-test) occurrences: **74
    measured-passing, 7 measured-failing, 80 not-reached** (74+7+80=161, exact). The 80
    not-reached were adjudicated against the Section-2 isolation table per the plan's own rule:
    **77 REMEDIATE**, **3 LEAVE-ALONE** (all three `text-primary/90`, the one tracked class that
    passes the isolation table on every surface/theme measured, min 4.626:1).
  - Section 3's remediation list totals **84 occurrences** (7 measured-failing + 77
    not-reached/REMEDIATE), each with file, line, exact class string, measured or isolation-table
    ratio, and remedy -- plan 123-11's edit list.
  - Caught and fixed a self-authored error before committing: the first draft of the not-reached
    reason breakdown claimed the reason counts summed to 86 with an unverified "6 sites overlap
    two reasons" explanation. A machine re-derivation from the actual classification data (not
    hand counting) found the true breakdown sums to exactly 80 with zero overlap
    (53 unmeasured-route + 18 list-item + 7 loading/error + 1 state-gated + 1
    conditionally-rendered). Corrected in place before commit.

## Task Commits

1. **Task 1: Run the widened 47x4 axe scan (pass 1)** -- `65399b1b` (docs)
2. **Task 2: Run the class-level isolation table (pass 2) and classify all 176 occurrences** -- `e539a446` (docs)

## Files Created/Modified

- `.planning/phases/123-accessibility-remediation/a11y-widened/*.json` -- New, 140 files. Raw
  per-cell axe capture from the widened scan (140 of the attempted 188 -- see the 48-cell
  dev-server-defect finding above).
- `.planning/phases/123-accessibility-remediation/123-CONTRAST-RESULT.md` -- New, 2 commits.
  The two-pass ledger: Section 1 (pass-1 run record, per-rule/per-route tables, unmeasured-cell
  accounting), Section 2 (pass-2 run record, class-level ratio table, C3/C6/sentinel controls),
  Section 3 (methodology, full occurrence classification, 84-occurrence remediation list, D-17
  quantification).
- `e2e/contrast-isolation.spec.ts` -- **Not modified.** Listed in the plan's `files_modified`
  as a conditional ("extend ... if the widened scan revealed a surface ... the matrix does not
  cover"); the condition did not trigger, confirmed via `git diff --stat` showing no changes.

## Deviations from Plan

### Auto-fixed Issues

None -- no code was broken or missing that this plan's own scope required fixing.

### Escalations / genuine findings (not auto-fixed, per plan's own measurement discipline)

**1. [Environment defect, out of this task's authority to fix] 48 of 188 declared cells never reached axe**
- **Found during:** Task 1, first run of the widened scan.
- **Issue:** A Vite dev-server "504 Outdated Optimize Dep" state, isolated to exactly 12 routes,
  causes a dynamic-import failure on those routes' lazy-loaded page chunks, caught by
  `ErrorBoundary`. Persisted across a `page.reload()` and a second fresh `page.goto()`.
- **Why not fixed here:** The dispatch instructed reusing the already-running shared server and
  never starting a competing one; restarting it is outside this executor's authority over a
  process it does not own, and risks leaving no server running for any concurrent session.
- **Disposition:** Recorded as UNMEASURED (48 cells, 12 named routes) in
  `123-CONTRAST-RESULT.md` Section 1, excluded from every violation aggregate, with the root
  cause and probe methodology documented. Plan 123-09's D-16 checkpoint decision should account
  for this residual explicitly.
- **Files modified:** None (finding, not a fix).

**2. [Self-caught documentation error] Fabricated arithmetic in the first draft of the D-17 breakdown**
- **Found during:** Task 2, final review pass before commit.
- **Issue:** Wrote "sums to 86, not 80" with a speculative overlap explanation, without actually
  re-deriving the reason-count breakdown from the classification data already on disk.
- **Fix:** Ran a machine count against the same JSON the tables were generated from; corrected
  the document to the verified 53+18+7+1+1=80 breakdown before the Task 2 commit -- the wrong
  claim never reached a committed state.
- **Files modified:** `.planning/phases/123-accessibility-remediation/123-CONTRAST-RESULT.md`
  (corrected in the same working session, before Task 2's commit).

**Impact on plan:** Neither required a plan or scope change. Both are documented in
`123-CONTRAST-RESULT.md` itself as well as here.

## Known Stubs

None. No UI code was modified by this plan.

## Threat Flags

None beyond what the plan's own threat model already covers (T-123-21 through T-123-24, all
addressed as designed: route count re-derived from capture filenames not the config table;
every ledger row pass-labelled; bucket counts reconciled against a live-re-derived population;
captures scanned for home paths/tokens before commit).
