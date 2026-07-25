---
phase: 97-skill-lifecycle-management
plan: 03
subsystem: infra
tags: [forge, daemon, command-poller, rescan, capability-negotiation, vitest]

# Dependency graph
requires:
  - phase: 97-skill-lifecycle-management (Plan 01)
    provides: intake-exec.ts's mapExitCodeToResult resolving status 'done' for exit 0 and 8/9 (skill on disk)
  - phase: 97-skill-lifecycle-management (Plan 02)
    provides: skill-rescan.ts's rescanAndSync/buildSkillSnapshot/postSkillSnapshot module
provides:
  - command-poller.ts fires skill-rescan.ts's rescanAndSync (fire-and-forget) after a successful intake write
  - PollCfg.rescanCfg injectable seam (optional, D-P8-03 fail-safe shape) for the DAEMON-03 trigger
  - DAEMON-04 supportedTypes capability-negotiation regression guard at the command-poller unit-test seam
affects: [97-06 (live end-to-end verification), any future forge index.ts wiring of rescanCfg]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional dependency-injection seam on PollCfg (rescanCfg) mirroring intakeFn's own fail-safe-absent shape"
    - "Module-level vi.mock('./skill-rescan.js') to spy on a directly-imported function without real fs/network I/O"

key-files:
  created: []
  modified:
    - C:\Users\mandr\forge\src\emit\command-poller.ts
    - C:\Users\mandr\forge\src\emit\command-poller.test.ts

key-decisions:
  - "rescanCfg is an optional RescanAndSyncDeps field on PollCfg (not a generic callback) so executeIntake's source literally calls `rescanAndSync(this.rescanCfg)` — satisfies the plan's grep acceptance criterion and keeps every existing `new CommandPoller({...})` call site (including production index.ts, unmodified by this plan) compiling"
  - "Production wiring of rescanCfg (resolving apiKey from ASTRIDR_INGEST_API_KEY, home from os.homedir(), workspaces from listWorkspaces(db)) is deferred — index.ts is not in this plan's files_modified and no other 97-* plan touches it either; flagged for follow-up before Plan 97-06's live E2E round-trip can exercise the rescan for real"
  - "Split Task 1 and Task 2 into two separate forge commits (894ac2e, 14babef) on the same two files, verifying the file compiled/passed tests at each intermediate state, to preserve one-commit-per-task even though both tasks touch identical files"

requirements-completed: [DAEMON-03, DAEMON-04]

# Metrics
duration: 15min
completed: 2026-07-18
---

# Phase 97 Plan 03: Rescan Trigger + Capability Negotiation Regression Guard Summary

**command-poller.ts now fires skill-rescan.ts's rescanAndSync fire-and-forget on a successful intake write, and DAEMON-04's already-shipped supportedTypes capability negotiation is pinned behind two new unit tests.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-18T11:05Z (approx.)
- **Completed:** 2026-07-18T11:08:33-04:00
- **Tasks:** 2 completed
- **Files modified:** 2 (forge repo only)

## Accomplishments
- `executeIntake` in `command-poller.ts` calls `void rescanAndSync(this.rescanCfg)` exactly once when the intake result's status is `'done'` — including exit-8/9's "loud, not rolled back" partial-success case — and never when status is `'failed'`
- The rescan call is never awaited, so it cannot stall `drainIntakeQueue`'s serial `await this.executeIntake(cmd)` or delay the ack (T-97-08/T-97-09, verified by a test where the mocked `rescanAndSync` rejects and the ack still fires)
- `PollCfg.rescanCfg` is a new optional injectable field (`RescanAndSyncDeps` from Plan 02's `skill-rescan.ts`), documented with an explicit warning that production wiring must resolve `apiKey` from `ASTRIDR_INGEST_API_KEY` — never `resolveEmitCfg()`'s `apiKey` (`FORGE_INGEST_API_KEY`), which gates a different auth check on `/scan` and would silently 401 every rescan
- DAEMON-04's capability negotiation (`supportedTypes` gated on `probeIntakeCli()`, already shipped in `index.ts`/`intake-probe.ts`) is now regression-pinned at the command-poller unit level: a poller built without `intakeFn` never advertises `'intake'` and its `executeIntake` not-supported guard acks any claimed intake command as `'failed'` without performing a write or triggering a rescan; a poller built with `intakeFn` present advertises `'intake'` and dispatches normally

## Task Commits

Each task was committed atomically in the forge repo:

1. **Task 1: Fire rescan after a successful intake write** - `894ac2e` (feat) — command-poller.ts insertion + tests 20-22
2. **Task 2: DAEMON-04 supportedTypes regression guard** - `14babef` (test) — tests 23-24 only

**Plan metadata:** committed in codepulse (this file + STATE/ROADMAP handled by orchestrator)

## Files Created/Modified
- `C:\Users\mandr\forge\src\emit\command-poller.ts` - imports `rescanAndSync`/`RescanAndSyncDeps` from `./skill-rescan.js`; adds optional `rescanCfg` to `PollCfg`; `executeIntake` fires `void rescanAndSync(this.rescanCfg)` when `status === 'done' && this.rescanCfg` is set
- `C:\Users\mandr\forge\src\emit\command-poller.test.ts` - mocks `./skill-rescan.js` at module level (`vi.mock`); adds a `RESCAN_CFG` fixture; extends `makePoller` to accept `rescanCfg`; adds tests 20-24 (rescan-trigger gating x3, DAEMON-04 regression guard x2)

## Decisions Made
- Chose a data-injection seam (`rescanCfg: RescanAndSyncDeps`) over a callback-injection seam (`rescanFn: () => Promise<void>`) specifically so the source retains a literal `rescanAndSync(...)` call site inside `executeIntake` — this was required by the plan's own acceptance-criteria grep (`grep -n "void rescanAndSync\|rescanAndSync(" src/emit/command-poller.ts`) and keeps the module-mock testing pattern (`vi.mock('./skill-rescan.js', ...)`) fully isolated from real filesystem/network I/O regardless of what `rescanCfg` values a test supplies
- `rescanCfg` is optional and the trigger is gated on its presence (`this.rescanCfg` truthy), mirroring `intakeFn`'s own D-P8-03 fail-safe-when-absent shape — this means the trigger is dormant everywhere in production until a future plan wires `index.ts` to supply a real `rescanCfg` sourced from `ASTRIDR_INGEST_API_KEY`. This is a deliberate scope boundary: this plan's `files_modified` is `command-poller.ts` + its test only, and no plan in Phase 97 (checked 97-01/02/04/05/06) touches `index.ts`
- Task 1 and Task 2 both land on the same two files; committed them as two atomic commits by temporarily removing the Task-2-only test additions, verifying Task 1's tests passed standalone, committing, then restoring the Task-2 tests and committing separately — preserves the plan's one-commit-per-task contract despite the file overlap

## Deviations from Plan

None functionally — the plan's `<action>` and `<acceptance_criteria>` were followed exactly. One scope-boundary note, not a deviation:

### Out-of-scope discovery (logged, not fixed)

**Pre-existing `tsc --noEmit` strict-null errors in `skill-rescan.ts`/`skill-rescan.test.ts` (Plan 02's files)**
- **Found during:** Task 1 verification, running `npx tsc --noEmit` to confirm the new import in `command-poller.ts` compiled cleanly
- **Issue:** 12 pre-existing strict-null-check errors in `skill-rescan.ts`'s `parseFrontmatter` (array indexing) and 3 in `skill-rescan.test.ts`, all from Plan 02 (committed at `7e076fd`/`8322b1e`, before this plan touched anything)
- **Scope determination:** Not in this plan's `files_modified`; `npm test` (`vitest run` — what this plan's `<verify>` and success criteria actually gate on) does not run `tsc` and passes cleanly
- **Not fixed** — logged to `.planning/phases/97-skill-lifecycle-management/deferred-items.md` per the scope-boundary rule (same precedent as 97-01's `verifyDriveMount` timeout entry)

## Issues Encountered
None — both tasks proceeded on the first implementation pass; all 24 tests in `command-poller.test.ts` passed, and the full forge suite (`npm test`) passed 895/898 with only the 3 pre-existing, already-documented `verifyDriveMount` timeouts failing (unrelated to this plan, confirmed unchanged from 97-01's deferred-items.md entry).

## User Setup Required

None — no external service configuration required. Note for a future plan/operator: `index.ts` does not yet construct a real `rescanCfg` (no `ASTRIDR_INGEST_API_KEY` resolution wired), so DAEMON-03's rescan trigger is currently dormant in production until that wiring lands — Plan 97-06's live end-to-end round-trip will need this before it can observe an automatic Skills-page refresh.

## Next Phase Readiness
- `command-poller.ts` + tests are ready for Plan 97-06's live E2E verification, EXCEPT that `index.ts` still needs a follow-up wiring pass (out of this plan's scope) to construct a real `PollCfg.rescanCfg` from `ASTRIDR_INGEST_API_KEY` + `os.homedir()` + `listWorkspaces(db)` before an install on a real host will actually trigger a rescan
- DAEMON-04's capability negotiation is now regression-pinned; a future command-type addition to `supportedTypes` in `index.ts` cannot silently break the "old daemon never claims a command it can't run" guarantee without failing test 24

---
*Phase: 97-skill-lifecycle-management*
*Completed: 2026-07-18*

## Self-Check: PASSED

- FOUND: C:\Users\mandr\forge\src\emit\command-poller.ts
- FOUND: C:\Users\mandr\forge\src\emit\command-poller.test.ts
- FOUND: C:\Users\mandr\codepulse\.planning\phases\97-skill-lifecycle-management\97-03-SUMMARY.md
- FOUND: forge commit 894ac2e
- FOUND: forge commit 14babef
