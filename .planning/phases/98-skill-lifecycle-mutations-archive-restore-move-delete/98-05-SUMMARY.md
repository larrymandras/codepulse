---
phase: 98-skill-lifecycle-mutations-archive-restore-move-delete
plan: 05
subsystem: infra
tags: [convex, skill-registry, cross-repo, forge-daemon, prune, filesystem-scan]

# Dependency graph
requires:
  - phase: 98-skill-lifecycle-mutations-archive-restore-move-delete (plans 01-04)
    provides: Convex lifecycle substrate, Forge daemon executor, lifecycle UI (menu, dialogs) — the archive/restore/move/delete feature this gap closure fixes a residual data-consistency bug in
affects: [skill registry rescan, forge daemon skill-rescan, codepulse skillSync/registry]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Producer-declares-coverage manifest pattern: a scanner declares which origins it actually covered (scannedOrigins), letting the consumer distinguish covered-but-empty from unscanned/unreachable — avoids the classic 'absence of evidence vs evidence of absence' prune bug"

key-files:
  created: []
  modified:
    - C:/Users/mandr/forge/src/emit/skill-rescan.ts
    - C:/Users/mandr/forge/src/emit/skill-rescan.test.ts
    - convex/skillSync.ts
    - convex/__tests__/skillSync.test.ts
    - convex/registry.ts

key-decisions:
  - "Reachability keyed on the workspace ROOT via fs.statSync, not the .claude/skills subdir — an empty-but-reachable workspace is still declared (safe to prune), an unreachable root (unmounted drive) is declared nowhere (T-98-10 safety valve)"
  - "computeSkillPrunes's legacy no-arg path is byte-for-byte behavior-preserving — prunableOrigins defaults to exactly incomingByOrigin.keys() when scannedOrigins is undefined; the manifest only ever ADDS eligibility, never removes it"
  - "registry.ts's prune guard relaxed to skills.length>0 OR scannedOrigins.length>0 so a snapshot that emptied an origin still reconciles, while a fully-empty legacy snapshot still cannot wipe the registry (T-98-11)"

requirements-completed: [LIFE-03, LIFE-04, DAEMON-02, DAEMON-03]

# Metrics
duration: 35min
completed: 2026-07-22
---

# Phase 98 Plan 05: Stale-Origin Prune Gap Closure Summary

**Forge's `buildSkillSnapshot` now declares a `scannedOrigins` manifest of every reachable root it walked, and CodePulse's `computeSkillPrunes` prunes a declared-but-empty origin's rows — closing the bug where the last skill moved/deleted out of a project workspace left a permanent stale `claude-code:project:<key>` row that falsely rendered the skill as multi-scope.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-22T08:00:00Z (approx, session start)
- **Completed:** 2026-07-22T08:10:00Z (approx, post full-suite green)
- **Tasks:** 2/2 completed
- **Files modified:** 5 (2 forge, 3 codepulse)

## Accomplishments
- Forge's `buildSkillSnapshot` now returns `{ skills, scannedOrigins }` — home roots always declared, a reachable-but-empty workspace still declared (zero skills), an unreachable workspace root declared nowhere
- CodePulse's `computeSkillPrunes` gained an optional `scannedOrigins` param that makes a declared origin prunable even with zero incoming skills, while leaving the legacy no-manifest path byte-identical to today's behavior
- `registry.ts`'s `syncInventory`/`syncFullInventory` wired `snap.scannedOrigins` through both prune call sites with a relaxed but still-safe guard
- Full codepulse suite (204 test files, 2331 tests) green after the change — no regressions

## Task Commits

Each task was committed atomically, one commit per repo:

1. **Task 1: Forge — declare scannedOrigins manifest** - `360e8a5` (feat, C:\Users\mandr\forge) — `SkillSnapshot.scannedOrigins`, `isReachable()` root-stat guard, 4 new test cases + updated the one pre-existing bare `SkillSnapshot` literal
2. **Task 2: CodePulse — prune declared-but-empty origins + wire scannedOrigins** - `107e64d` (fix, C:\Users\mandr\codepulse) — `computeSkillPrunes` optional 3rd param, 4 new test cases (2 regression pairs + backward-compat + no-over-prune), both `registry.ts` call sites updated

_No TDD RED/GREEN split commits — tests and implementation were authored together per task and verified green in the same pass (plan's `tdd="true"` intent — behavior-first design — was honored via the plan's pre-specified test cases, not a literal separate RED commit)._

## Files Created/Modified

**Forge (C:\Users\mandr\forge):**
- `src/emit/skill-rescan.ts` - Added `scannedOrigins: string[]` to `SkillSnapshot`; `buildSkillSnapshot` accumulates it (home roots unconditional, project origins gated on `isReachable(ws.rootPath)`); new `isReachable()` helper
- `src/emit/skill-rescan.test.ts` - Updated the bare `SNAPSHOT` literal to include `scannedOrigins`; added 4 new `describe('buildSkillSnapshot')` cases for the manifest

**CodePulse (C:\Users\mandr\codepulse):**
- `convex/skillSync.ts` - `computeSkillPrunes` gained optional `scannedOrigins?: Array<string | null | undefined>`; prunable-origin set is now `incomingByOrigin.keys()` unioned with normalized `scannedOrigins` when provided
- `convex/__tests__/skillSync.test.ts` - Added 4 new `computeSkillPrunes` cases: declared-but-empty prunes (regression), undeclared untouched (regression), backward-compat (no 3rd arg), declared-and-populated no-over-prune
- `convex/registry.ts` - Both `syncInventory` (~line 171) and `syncFullInventory` (~line 329) prune blocks now pass `snap.scannedOrigins` and fire on `skills.length > 0 || (Array.isArray(snap.scannedOrigins) && snap.scannedOrigins.length > 0)`

## Decisions Made
- Reachability check is keyed on the workspace **root**, not `.claude/skills` — this is what makes an emptied-but-present workspace distinguishable from an unmounted one (see key-decisions above)
- `computeSkillPrunes`'s manifest is strictly additive to origin eligibility — the undefined-manifest code path is unchanged in every branch, so all 5 pre-existing tests stayed green with no rewrite
- The prune guard in `registry.ts` was relaxed from a single length check to an OR, not replaced — a totally empty, manifest-less snapshot (the historical "empty POST body" failure mode) still cannot delete anything

## Deviations from Plan

None — plan executed exactly as written, including both regression test pairs and the backward-compatibility test the plan specified.

## Issues Encountered

None. Both repos' scoped test suites and `tsc --noEmit` were green on first pass; the full codepulse suite (`npm test`) was run as an extra check since this is the closing plan of Phase 98's wave, and it passed with zero regressions (204/204 test files, 2331/2331 tests).

## Next Phase Readiness

- Phase 98 is now genuinely gap-closed: all 5 plans (98-01..05) are code-complete, and the one issue `98-HUMAN-UAT.md` flagged (stale-origin prune on move/delete of the last skill in a workspace) is fixed and unit-tested on both sides of the cross-repo boundary.
- **Still outstanding (unchanged from prior plans' notes):** the plan's own `<verification>` section calls for a MANUAL live re-run of the original UAT repro (delete the residual `uat-ws-placeholder` skill from the G: workspace, trigger a rescan, confirm the stale row disappears) and a MANUAL NEGATIVE check (pause the live G: mount mid-scan and confirm the workspace's origin is NOT declared/pruned) — both require a live Forge daemon + a live Google Drive mount and are explicitly out of scope for this automated executor pass.
- Once those two manual checks pass, Phase 98 (LIFE-01..06 + DAEMON-02/03) can be marked fully verified end-to-end and v11.0 can resume at Phase 99 (Skill Launch/Dispatch, independent of 97/98).

---
*Phase: 98-skill-lifecycle-mutations-archive-restore-move-delete*
*Plan: 05*
*Completed: 2026-07-22*

## Self-Check: PASSED

- FOUND: `.planning/phases/98-skill-lifecycle-mutations-archive-restore-move-delete/98-05-SUMMARY.md`
- FOUND: `convex/skillSync.ts`, `convex/registry.ts`
- FOUND (codepulse commits): `107e64d`, `ef306ac`
- FOUND: `C:\Users\mandr\forge\src\emit\skill-rescan.ts`
- FOUND (forge commit): `360e8a5`
