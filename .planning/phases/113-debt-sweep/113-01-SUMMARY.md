---
phase: 113-debt-sweep
plan: 01
subsystem: infra
tags: [convex, skills, scanner, coverage-guard, tech-debt]

# Dependency graph
requires: []
provides:
  - "hooks/skillScan.mjs: PLUGIN_ORIGIN (\"claude-code:plugin\") isolates plugin skills from the personal claude-code origin"
  - "hooks/skillScan.mjs: collectClaudeCodeSkillsWithCoverage({ home, cwd, platform }) returning { skills, coveredOrigins } derived from real enumeration outcomes"
  - "hooks/scanner.mjs: /scan payload carries snapshot.scannedOrigins + snapshot.scannedOriginsComplete on a successful scan, neither key on an aborted scan"
affects: [113-02-server-side-prune-guard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sub-source read helpers return an honest success boolean (false only on a genuine read failure, true even for an existing-but-empty directory) instead of undefined"
    - "A producer-side coverage manifest (coveredOrigins) travels the same fire-and-forget try/catch shape as the existing skill-scan error handling — no retry/backoff added"

key-files:
  created: []
  modified:
    - hooks/skillScan.mjs
    - hooks/scanner.mjs
    - hooks/__tests__/skillScan.test.mjs

key-decisions:
  - "Dedup rule 2 (personal-dir-wins across the plugin split) computed from the fully-populated acc array in one filter pass rather than tracked incrementally during collection — same result, no second pass over acc, matches the plan's constraint"
  - "walkPluginCache's coverage boolean is derived strictly from statSync/recursive-call failures per the plan's literal spec; a readSkillDir failure inside a plugin cache 'skills' leaf is not separately tracked into the walk's own boolean (not required by D-07's contract, and doing so would need a second signal path)"

patterns-established:
  - "Coverage-declaration return shape ({ skills, coveredOrigins }) with a thin bare-array wrapper preserving the old signature for existing callers"

requirements-completed: [DEBT-05]

# Metrics
duration: 6min
completed: 2026-08-11
---

# Phase 113 Plan 01: Skill-Scan Origin Split & Coverage Manifest (Producer Half) Summary

**Plugin skills split onto their own `claude-code:plugin` origin and `hooks/skillScan.mjs`/`hooks/scanner.mjs` now declare per-sub-source read coverage on the `/scan` wire, closing the structural gap that let a partial plugin read silently prune ~56-57 live skill rows.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-08-11T12:55:44-04:00
- **Completed:** 2026-08-11T13:00:35-04:00
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Plugin-sourced skills now carry `origin === "claude-code:plugin"`, never `"claude-code"`; a name present in both the personal skills dir and an installed plugin still yields exactly one row (the personal-dir copy) — verified live: 57 real plugin rows now isolated, `deep-research` (personal + plugin fixture collision) collapses to one row.
- `readSkillDir` and `walkPluginCache` now return honest per-source success booleans instead of `undefined`; `collectClaudeCodeSkillsWithCoverage` aggregates them into a `coveredOrigins` manifest that reflects real enumeration outcomes, never assumption. A failed plugin read (no manifest, no cache dir) omits only `claude-code:plugin` from coverage while every other source's rows still emit — proven with a dedicated `REGRESSION:`-named control fixture.
- `hooks/scanner.mjs` puts `scannedOrigins` + `scannedOriginsComplete: true` on the `/scan` wire for the first time (previously sent by neither producer); both keys are assigned only inside the existing skill-scan `try` block, so a thrown scan leaves them unset and the pre-existing `snap.skills.length > 0` guard in `convex/registry.ts` already makes that snapshot incapable of pruning anything.
- Live-verified end to end on this machine: `collectClaudeCodeSkillsWithCoverage` returns `coveredOrigins: claude-code, claude-code:plugin, claude-code:available, claude-code:project:35dcd75e840a` and 57 real `claude-code:plugin` rows; `node hooks/scanner.mjs --dry-run` exits 0, prints the covered-origins line, and performs no network POST.

## Task Commits

Each task was committed atomically:

1. **Task 1: Split plugin skills onto claude-code:plugin and preserve personal-dir-wins (D-02)** - `854b2640` (feat)
2. **Task 2: Report per-sub-source coverage from the collector (D-01 producer half, D-07)** - `2e4a0eff` (feat)
3. **Task 3: Put the manifest on the /scan wire at both scanner call sites (D-03 producer half)** - `c0530ad8` (feat)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified
- `hooks/skillScan.mjs` - `PLUGIN_ORIGIN` constant, plugin-origin split with personal-dir-wins dedup, `readSkillDir`/`walkPluginCache` honest boolean returns, new `collectClaudeCodeSkillsWithCoverage` export, `collectClaudeCodeSkills` reduced to a thin wrapper
- `hooks/scanner.mjs` - both call sites (`runScan`, dry-run branch) switched to `collectClaudeCodeSkillsWithCoverage`; `snapshot.scannedOrigins`/`scannedOriginsComplete` assigned inside the existing try/catch
- `hooks/__tests__/skillScan.test.mjs` - updated 2 stale origin assertions, added a disjoint-origins regression test, added a `collectClaudeCodeSkillsWithCoverage` describe block (4 tests: complete-fixture coverage, failed-plugin-read D-07 control, missing-personal-dir, samePath-guard skip) — 8 tests added net, 24 total in file (was 16)

## Decisions Made
- Computed the personal-dir-wins dedup set (`claudeCodeNames`) from the fully-populated `acc` array in a single pass after all sub-sources are collected, rather than incrementally tracking it during collection as the plan's action text suggested ("track the set... as you go"). Behaviorally identical since `acc` is complete before the dedup filter runs regardless of visitation order, and it avoids a second pass over `acc` per the plan's explicit constraint ("Do not add a second pass over `acc`").
- `walkPluginCache`'s coverage boolean tracks only `statSync` throws and recursive-call failures, per the plan's literal spec — it does not separately fold in a `readSkillDir` failure at a `"skills"` leaf directory into the walk's own boolean. This matches the acceptance criteria and behavior spec verbatim; no gap was found in verification.

## Deviations from Plan

None - plan executed exactly as written. All three tasks' acceptance criteria were verified directly (grep counts, live node invocations, full test suite, tsc) rather than assumed.

## Issues Encountered

None. `.planning/STATE.md` showed as locally modified (`M`) throughout this session from a concurrent session's in-flight work — per the shared-checkout protocol, it was never staged or touched by any commit in this plan. Every commit's `git show --stat HEAD` was checked immediately after committing and contained only the intended files.

## User Setup Required

None - no external service configuration required. This is the producer half only; the server-side prune guard (D-01's other half) and the D-04 origin-reassignment migration for the ~188 existing live rows are 113-02's responsibility, not this plan's.

## Next Phase Readiness

- The wire contract (`scannedOrigins: string[]`, `scannedOriginsComplete: true`) is live and matches the LOCKED interface spec plan 113-02 depends on: `convex/scan.ts` already forwards the POST body untouched, so `snap.scannedOrigins` reaches `syncInventory` with no HTTP-layer change required.
- 113-02 can now build the server-side guard (`sanitizeScannedOrigins` extension, per-origin prune eligibility keyed on `coveredOrigins`) and the D-05 `alerts` refusal-visibility write against a real, tested producer signal — this plan shipped no server-side changes.
- D-17 (frontend origin-coupling: `Skills.tsx`, `skills.ts`, `SkillLifecycleMenu.tsx`, `OriginBadge.tsx`) is explicitly out of this plan's scope per the plan's task list — those 4 files still compare against the bare `"claude-code"` string and will silently drop the 57 now-isolated `claude-code:plugin` rows from the Skills page's Global tab until a later 113-0N plan closes it. Not a regression introduced here (those files already existed with this coupling); flagged so it isn't lost.

---
*Phase: 113-debt-sweep*
*Completed: 2026-08-11*

## Self-Check: PASSED

All claimed files and commit hashes verified present:
- FOUND: hooks/skillScan.mjs
- FOUND: hooks/scanner.mjs
- FOUND: hooks/__tests__/skillScan.test.mjs
- FOUND: .planning/phases/113-debt-sweep/113-01-SUMMARY.md
- FOUND: 854b2640, 2e4a0eff, c0530ad8, 40dad2a9
