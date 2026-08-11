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
  - "SUPERSEDED by the Adversarial Verification section below (commit `96ae77d1`): this plan's original execution deliberately left a readSkillDir failure inside a plugin cache 'skills' leaf untracked in walkPluginCache's own boolean. The adversarial gate found this contradicted the function's own doc comment (\"true only when every entry was walked cleanly\") and required it as defect 2; the boolean now does propagate that failure."

patterns-established:
  - "Coverage-declaration return shape ({ skills, coveredOrigins }) with a thin bare-array wrapper preserving the old signature for existing callers"

requirements-completed: []

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
- `hooks/__tests__/skillScan.test.mjs` - updated 2 stale origin assertions, added a disjoint-origins regression test, added a `collectClaudeCodeSkillsWithCoverage` describe block (4 tests: complete-fixture coverage, failed-plugin-read D-07 control, missing-personal-dir, samePath-guard skip) — 5 tests added net, 24 total in file (was 19)

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

## Adversarial Verification

An adversarial verification gate ran against this plan's original execution (commits `854b2640`, `2e4a0eff`, `c0530ad8`, `40dad2a9`) and found 5 confirmed defects, fixed in two follow-up commits on top of that work:

1. **[HIGH] `hooks/skillScan.mjs:113`** — `readInstalledPluginSkills` incremented `found` (and therefore declared `claude-code:plugin` covered) regardless of whether `readSkillDir` actually enumerated the plugin's `skills/` dir, so an unreadable dir still declared coverage while emitting zero rows — the exact data-loss shape DEBT-05 exists to close. Fixed: `found` now only increments when `readSkillDir` returns `true`.
2. **[MEDIUM] `hooks/skillScan.mjs:136`** — `walkPluginCache`'s `if (e === "skills")` branch discarded `readSkillDir`'s boolean, contradicting its own doc comment ("true only when every entry was walked cleanly"). Fixed: the boolean now propagates into `ok`.
3. **[MEDIUM] `hooks/scanner.mjs`** — zero automated test coverage; a mutation hardcoding `snapshot.scannedOrigins` survived all 579 pre-existing tests. Fixed: new `hooks/__tests__/scanner.test.mjs` asserts on the real POST body against a local HTTP server (never the live Convex backend), including the D-07 abort path, using a minimal, behavior-preserving `deps` injection point added to `runScan` for testability.
4. **[MEDIUM] `walkPluginCache`'s `ok = false` propagation** — the `statSync` catch and recursive-call sites were untested; removing both left all tests green. Fixed: added a dedicated depth-cap-nesting regression test plus a real-OS-permission-denial test (icacls on win32, chmod on POSIX/CI) for the `"skills"`-leaf case, since `vi.doMock("node:fs", ...)` did not intercept the read for a dynamically re-imported module in this Vitest/Node setup and `vi.spyOn(fs, ...)` is blocked by the sealed ESM namespace (both verified empirically).
5. **[artifact] This file** — `requirements-completed` falsely claimed `[DEBT-05]` complete (DEBT-05 spans plans 113-01/02/03/04/06; only the producer half shipped here — corrected to `[]`) and the test-count sentence undercounted the net addition (was "8 tests added net... was 16"; the pre-plan file had 19 `it(` blocks per `git show 1d2e6342:hooks/__tests__/skillScan.test.mjs` (the commit immediately preceding this plan's Wave 1 execution), corrected to "5 tests added net... was 19").

Every fix was mutation-tested: the guarding code was manually reverted, the new/added test was confirmed to fail in isolation, then the fix was restored and the full suite re-verified green. Commits: `96ae77d1` (defects 1, 2, 4), `9b96fe22` (defect 3), this commit (defect 5).

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

## Adversarial verification round 2

A second adversarial verification pass (independently confirmed against live code by
two adversarial agents and the orchestrator) found the round-1 fix for defect 1 above
(`hooks/skillScan.mjs:113`, commit `96ae77d1`) closed only the ALL-plugins-fail case,
not the more likely PARTIAL-fail case.

**[HIGH] `hooks/skillScan.mjs:120` `readInstalledPluginSkills` — `return found > 0`
still declared coverage on a partial read.** Round 1 changed `found++` to
`if (readSkillDir(...)) found++`, so an all-plugins-fail scan correctly returned
`false`. It did not track failures independently, so with plugin A readable and
plugin B's `skills/` dir existing-but-unreadable, `found === 1` and the function still
returned `true` — declaring `claude-code:plugin` covered while a real sub-source read
had failed. The server-side prune guard (`convex/registry.ts`'s
`processSkillPruneHandler`, see 113-02 round-2 notes) then treated the origin as fully
scanned and would delete plugin B's rows with zero `alerts` written. Proven end-to-end
against the real producer with a two-plugin fixture (one readable, one whose `skills/`
path is a file, triggering a real `ENOTDIR` — no fs mocking).

**Fix:** `readInstalledPluginSkills` now tracks `found` and `anyFailed` independently
and returns `found > 0 && !anyFailed`. A missing/absent `skills/` dir is not counted
as a failure (plugins are not required to ship skills) — only a `readSkillDir` failure
on a directory that does exist counts. The pre-existing test at
`hooks/__tests__/skillScan.test.mjs` that exercised exactly this mixed shape had
locked in the old (wrong) behavior (`coveredOrigins.includes("claude-code:plugin")
=== true`); its assertion is corrected to `false`, and it still asserts plugin A's row
is emitted (D-07).

**Mutation-proof:** reverted the fix, re-ran `npx vitest run
hooks/__tests__/skillScan.test.mjs` — 1 test failed
(`expected true to be false`, exactly the corrected assertion). Restored the fix,
re-ran — 28/28 passed. Both outputs captured in the session transcript.

**Commit:** `2c7f6dd0` (`fix(113-01): close partial-plugin-read coverage defect in
skillScan.mjs`).

**Not closed by this round:** DEBT-05 is not marked complete anywhere by this fix — it
still spans plans 113-01/02/03/04, and 113-03/113-04 have not executed.
