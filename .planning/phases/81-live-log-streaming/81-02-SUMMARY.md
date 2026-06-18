---
phase: 81-live-log-streaming
plan: 02
subsystem: api
tags: [convex, internalMutation, cron, retention, tdd, forge, log-sweep]

# Dependency graph
requires:
  - phase: 81-live-log-streaming
    plan: 01
    provides: forgeLogChunks table with by_host_job index + LOG_CHUNK_LIMIT const (sweep targets these)
provides:
  - chunkByteSize / selectTtlDeletes / selectCapDeletes pure helpers (exported, unit-tested)
  - sweepForgeLogChunks internalMutation (7-day TTL + per-job ~1 MB cap, drop-oldest)
  - sweep-forge-log-chunks daily cron entry at 03:30 UTC in crons.ts
  - Retention test suite: 14 tests covering TTL boundary + per-job byte-cap drop-oldest
affects: [81-03-log-viewer-ui, 81-04-forge-handoff]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure helper export pattern: chunkByteSize/selectTtlDeletes/selectCapDeletes exported from forge.ts for unit-testability without Convex runtime (mirrors simulateForgeLogIngestDispatch)"
    - "Retention sweep: TTL pass (filter by _creationTime < now - 7d) then per-job cap pass (group by hostId::forgeJobId, sort by seq asc, drop oldest until total <= cap)"
    - "selectCapDeletes accumulates from oldest (chunks[0]) until total <= capBytes — newest chunks always survive"
    - "crons.daily cadence for storage sweep (not interval) — mirrors archive-stale-events + evaluate-memory-quality"

key-files:
  created: []
  modified:
    - convex/forge.ts
    - convex/crons.ts
    - convex/forgeLogIngest.test.ts

key-decisions:
  - "Pure helper extraction: sweepForgeLogChunks logic split into chunkByteSize + selectTtlDeletes + selectCapDeletes — exported so forgeLogIngest.test.ts can unit-test without a live Convex DB"
  - "LOG_BYTE_CAP_PER_JOB = 1_000_000 (~1 MB, D-01 discretion) placed alongside SEVEN_DAYS_MS near the Phase 81 section header"
  - "Pass 1 (TTL) then Pass 2 (byte cap): TTL deletes first, then surviving chunks are grouped and capped — correct ordering avoids counting soon-to-be-deleted bytes against the cap"
  - "Per-job grouping key is hostId::forgeJobId string — avoids a nested Map and stays readable"
  - "crons.daily at hourUTC:3 minuteUTC:30 — offset from evaluate-memory-quality (03:00) to avoid scheduler contention"

requirements-completed: [FI-11]

# Metrics
duration: 2min
completed: 2026-06-16
---

# Phase 81 Plan 02: sweepForgeLogChunks Retention Sweep Summary

**Daily-scheduled internalMutation enforcing 7-day TTL + per-job ~1 MB drop-oldest byte cap on forgeLogChunks, with 14 unit tests proving both behaviors — FI-11 / D-2 retention contract**

## Performance

- **Duration:** 2 min
- **Started:** 2026-06-16T18:09:00Z
- **Completed:** 2026-06-16T18:11:00Z
- **Tasks:** 1 (TDD: RED + GREEN, no refactor needed)
- **Files modified:** 3

## Accomplishments

- Added three exported pure helpers to `convex/forge.ts`: `chunkByteSize`, `selectTtlDeletes`, `selectCapDeletes` — unit-testable without a Convex runtime, mirroring the `simulateForgeLogIngestDispatch` pattern from plan 01
- Implemented `sweepForgeLogChunks` internalMutation with a two-pass strategy: (1) TTL pass — delete chunks older than 7 days; (2) per-job byte-cap pass — group surviving chunks by `hostId::forgeJobId`, sort by `seq` ascending, drop oldest until total bytes ≤ 1 MB
- Added `sweep-forge-log-chunks` daily cron entry at 03:30 UTC in `crons.ts` wired to `internal.forge.sweepForgeLogChunks`
- Replaced the `it.todo` retention stub in `convex/forgeLogIngest.test.ts` with a real `describe("retention sweep")` block containing 14 tests covering: `chunkByteSize` (3 cases), TTL boundary (5 cases), per-job byte-cap drop-oldest (5 cases including per-job independence assertion)

## Task Commits

Each TDD gate committed atomically:

1. **RED gate: failing retention tests** — `bd0221c` (test)
2. **GREEN gate: sweepForgeLogChunks + cron + helpers** — `68a6a58` (feat)

## TDD Gate Compliance

- RED gate commit: `bd0221c` (test(81-02): add failing retention sweep tests (RED gate))
- GREEN gate commit: `68a6a58` (feat(81-02): sweepForgeLogChunks internalMutation + daily cron + pure helpers)
- REFACTOR: not needed — implementation was clean on first pass

## Files Created/Modified

- `convex/forge.ts` — SEVEN_DAYS_MS + LOG_BYTE_CAP_PER_JOB consts; chunkByteSize / selectTtlDeletes / selectCapDeletes pure exports; sweepForgeLogChunks internalMutation (Phase 81 retention section)
- `convex/crons.ts` — sweep-forge-log-chunks daily cron entry at 03:30 UTC
- `convex/forgeLogIngest.test.ts` — describe("retention sweep") with 14 real tests replacing the it.todo stub

## Verification Results

- `npx vitest run convex/forgeLogIngest.test.ts` — **36 passed, 4 todo** (the 4 todos are the DB round-trip integration stubs preserved from plan 01)
- `npx tsc --noEmit` — **0 errors**
- `npx convex codegen` — **succeeded**; sweepForgeLogChunks in generated internal api

## Decisions Made

- `chunkByteSize` counts `line.length` (UTF-16 code units) as the byte-accounting method — matches D-01 "discretion" with the simplest approximation consistent with the ~1 MB intent
- `selectCapDeletes` iterates chunks in ascending seq order (oldest first), accumulating deletes until `total <= capBytes` — newest chunks always survive by construction
- Pass ordering (TTL first, then cap) ensures TTL-expired bytes are not counted against the cap before being removed

## Deviations from Plan

None — plan executed exactly as written. Pure helper extraction was explicitly specified in the plan's `<action>` block. All patterns matched the analogs precisely.

## Threat Surface Scan

All mitigations from plan 02's threat model are implemented:
- T-81-07 (DoS / unbounded log storage): `sweepForgeLogChunks` enforces both the 7-day TTL and the per-job ~1 MB cap, verified by the retention test suite
- T-81-08 (EoP): `sweepForgeLogChunks` is `internalMutation` — invokable only by the cron scheduler, never client-callable
- T-81-09 (Tampering / cross-job eviction): `selectCapDeletes` is called separately per job; job-B's chunks are never passed to job-A's cap calculation — asserted by the independence test

No new threat surface beyond what the plan's threat model covers.

## Next Phase Readiness

- **Plan 03 (log viewer UI):** `listJobLogs` reactive query is bounded and retention-swept — safe for the `useForgeJobLogs` hook + `ForgeJobDetail` log pane
- **Plan 04 (Forge handoff):** retention sweep in place before the live round-trip verification — no runaway-job risk during UAT
- No blockers. FI-11 retention contract is complete and typechecked.

## Self-Check

- `convex/forge.ts` contains `sweepForgeLogChunks` declared as `internalMutation`: confirmed (grep returns 1)
- `convex/crons.ts` contains `sweep-forge-log-chunks` inside a `crons.daily(` call before `export default crons`: confirmed
- `convex/forgeLogIngest.test.ts` contains "retention" (case-insensitive): confirmed (grep -ci returns 2)
- All 3 pure helpers (`chunkByteSize`, `selectTtlDeletes`, `selectCapDeletes`) exported from forge.ts: confirmed
- RED commit `bd0221c` exists: confirmed
- GREEN commit `68a6a58` exists: confirmed

## Self-Check: PASSED

---
*Phase: 81-live-log-streaming*
*Completed: 2026-06-16*
