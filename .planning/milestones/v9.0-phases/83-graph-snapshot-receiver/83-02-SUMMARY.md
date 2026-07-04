---
phase: 83-graph-snapshot-receiver
plan: "02"
subsystem: convex-backend
tags: [convex, graph-snapshots, ingest-dispatch, retention-cron, vitest, backend]
dependency_graph:
  requires: [83-01]
  provides: [graph-snapshot-receiver, getProjectGraph-query, listSnapshots-query, sweep-cron]
  affects:
    - convex/runtimeIngest.ts (graph_snapshot case)
    - convex/crons.ts (sweep-graph-snapshot-versions)
    - convex/graphSnapshots.ts (new module)
    - convex/graphSnapshots.test.ts (new test file)
    - convex/_generated/api.d.ts (graphSnapshots module registration)
tech_stack:
  added: []
  patterns:
    - internalMutation for httpAction-driven writes (no Clerk identity)
    - versioned-swap with activeVersion pointer flip last
    - dangling-link guard via Set<string> of stored nodeIds
    - graceful-skip public query (returns null before first ingest)
    - pure-logic export + vitest mirror function test pattern
    - one-version-per-sweep retention with doc-count guard
key_files:
  created:
    - convex/graphSnapshots.ts
    - convex/graphSnapshots.test.ts
  modified:
    - convex/runtimeIngest.ts
    - convex/crons.ts
    - convex/_generated/api.d.ts
decisions:
  - "internalMutation for upsertGraphSnapshot and sweepGraphSnapshotVersions — httpAction has no Clerk identity (Pitfall 1 guard)"
  - "activeVersion flip is the last write in upsertGraphSnapshot — readers see complete previous version during insert (Pitfall 2 guard)"
  - "Set<string> dangling-link guard in upsertGraphSnapshot — drops links with missing endpoint before insert (D-05 / T-83-03)"
  - "Sweep processes at most one stale version per invocation with 15,000-doc guard — stays under 16,000-doc write limit (Pitfall 5 guard)"
  - "api.d.ts updated manually with graphSnapshots import — convex dev not available in worktree; anyApi proxy in api.js handles runtime"
  - "Cron offset: sweep-graph-snapshot-versions at 04:30 UTC, 30 min after sweep-forge-file-records (04:00) to avoid scheduler contention"
metrics:
  duration: "~8 minutes"
  completed: "2026-06-18"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 5
---

# Phase 83 Plan 02: Graph Snapshot Receiver Module Summary

**One-liner:** `convex/graphSnapshots.ts` internalMutation receiver with versioned-swap, dangling-link guard, public graceful-skip read queries, and one-version-per-sweep retention — wired into `runtimeIngest.ts` dispatch and `crons.ts`, stopping the silent drop of Ástríðr's nightly `graph_snapshot` events.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create convex/graphSnapshots.ts — receiver mutation, read queries, sweep, pure helper | ae0f7d8 | convex/graphSnapshots.ts |
| 2 | Wire dispatch case in runtimeIngest.ts and retention cron in crons.ts | 482a1b5 | convex/runtimeIngest.ts, convex/crons.ts, convex/_generated/api.d.ts |
| 3 | Pure-logic Vitest coverage in convex/graphSnapshots.test.ts | fabc29c | convex/graphSnapshots.test.ts |

## What Was Built

### convex/graphSnapshots.ts (new)

**`GRAPH_SNAPSHOT_KEEP_VERSIONS = 7`** — module-level constant exported for testability.

**`selectVersionDeletes(versions, keepN)`** — pure exported function: given all known versions for a snapshotId (any order), returns those to delete to bring the total to `keepN`. Sorts internally ascending (oldest first). Returns `[]` when no deletion needed.

**`upsertGraphSnapshot`** — `internalMutation`. Implements the full versioned-swap:
1. Reads existing meta doc via `by_snapshotId` index.
2. `newVersion = (existing?.activeVersion ?? 0) + 1` (monotonic).
3. Builds `Set<string>` of incoming node ids (dangling-link guard, D-05).
4. Filters links to those with both endpoints in the set.
5. Inserts `graphSnapshotNodes` rows chunked at 1,000 (defensive headroom), coercing `community: null → undefined`.
6. Inserts filtered `graphSnapshotLinks` rows chunked at 1,000.
7. **Last**: patch-or-insert `graphSnapshots` meta doc with `activeVersion = newVersion`.

**`sweepGraphSnapshotVersions`** — `internalMutation`. Per meta doc: derives distinct stored versions from `graphSnapshotNodes` by_snapshot_version index (scoped, not full table collect — Pitfall 5 guard). Calls `selectVersionDeletes`. Deletes AT MOST ONE stale version per invocation with a 15,000-doc guard (stays under 16,000-doc write limit).

**`getProjectGraph`** — public `query`. Args: `{ snapshotId?: string }`, defaults to `"astridr-project-graph"`. Returns `null` if no meta doc (graceful-skip). Otherwise reads active version's nodes + links via `by_snapshot_version` index and maps to clean output objects (strips `_id`/`_creationTime`).

**`listSnapshots`** — public `query`. Collects all `graphSnapshots` rows and maps to `{snapshotId, nodeCount, linkCount, generatedAt, updatedAt}`.

### convex/runtimeIngest.ts (modified)

Added `case "graph_snapshot":` before the switch's closing brace, mirroring the `kg_summary` case. Calls `internal.graphSnapshots.upsertGraphSnapshot` (not `api.*`) with full defensive access (`?? fallback` and `Array.isArray()` guards). No existing case modified.

### convex/crons.ts (modified)

Added `crons.daily("sweep-graph-snapshot-versions", { hourUTC: 4, minuteUTC: 30 }, internal.graphSnapshots.sweepGraphSnapshotVersions)` after `sweep-forge-file-records` (04:00) and before `export default crons`. Offset 30 min from the file sweep to avoid scheduler contention.

### convex/_generated/api.d.ts (modified)

Added `import type * as graphSnapshots from "../graphSnapshots.js"` and `graphSnapshots: typeof graphSnapshots` to the `fullApi` declaration so TypeScript resolves `internal.graphSnapshots.*` references in `runtimeIngest.ts` and `crons.ts`. `api.js` uses `anyApi` (dynamic proxy) and needed no change.

### convex/graphSnapshots.test.ts (new)

30 passing tests, 5 `it.todo` (DB round-trips deferred to plan 03):
- **GH-01a** `selectVersionDeletes`: 8 cases covering empty, under-keepN, exact-keepN, over-keepN with expected [1,2] result, unsorted input, keepN=1, constant value
- **GH-01b** dispatch mapping fallbacks: 9 cases covering snapshotId default, non-array guards, numeric defaults, generatedAt fallback
- **GH-01c** dangling-link guard: 7 cases covering drop-missing-source, drop-missing-target, keep-both-present, cross-type, all-dangling, mixed set, empty-node-list
- **GH-01d** community null + numeric: null coerces to undefined, numeric survives, vault and graphify nodes both pass dispatch mapping
- **GH-01e** generatedAt float64: Python `time.time()` float passes through unchanged, precision check, integer epoch

## Verification

- `npx vitest run convex/graphSnapshots.test.ts`: 30 passed, 5 todo.
- `npx tsc --noEmit`: clean (0 errors) across all modified files.
- `npm test`: 103 test files passed, 1014 tests passing — no regressions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Updated convex/_generated/api.d.ts for graphSnapshots module**
- **Found during:** Task 2 — `npx tsc --noEmit` failed with `Property 'graphSnapshots' does not exist on type` for both `internal.graphSnapshots` references in `runtimeIngest.ts` and `crons.ts`
- **Issue:** The Convex generated API types file `_generated/api.d.ts` did not include `graphSnapshots` because `npx convex dev` cannot run in a worktree environment (no live backend). Without the type entry, TypeScript cannot resolve `internal.graphSnapshots.*`.
- **Fix:** Added `import type * as graphSnapshots from "../graphSnapshots.js"` and `graphSnapshots: typeof graphSnapshots` to the `fullApi` declaration in `api.d.ts`. The `api.js` runtime uses `anyApi` (dynamic proxy) and needed no change — this fix is type-only.
- **Files modified:** `convex/_generated/api.d.ts`
- **Commit:** 482a1b5

## Threat Flags

None — all surfaces covered by the plan's threat model:
- T-83-01: bearer auth already enforced before switch (unchanged)
- T-83-02: both writers are `internalMutation` (T-83-02 mitigated)
- T-83-03: dangling-link guard implemented (T-83-03 mitigated)
- T-83-06: one-version-per-sweep + 15,000-doc guard (T-83-06 mitigated)
- T-83-07: public read queries — accepted, operational telemetry (non-secret)

## Known Stubs

None — this is a pure backend plan. No UI components, no data wiring. Phase 84 will consume `api.graphSnapshots.getProjectGraph` and `api.graphSnapshots.listSnapshots`.

## Self-Check: PASSED

- `convex/graphSnapshots.ts` exists and exports `selectVersionDeletes`, `GRAPH_SNAPSHOT_KEEP_VERSIONS`, `upsertGraphSnapshot`, `getProjectGraph`, `listSnapshots`, `sweepGraphSnapshotVersions`
- `convex/graphSnapshots.test.ts` exists with 30 passing + 5 todo tests
- `convex/runtimeIngest.ts` contains `case "graph_snapshot"` calling `internal.graphSnapshots.upsertGraphSnapshot`
- `convex/crons.ts` contains `sweep-graph-snapshot-versions` at `{ hourUTC: 4, minuteUTC: 30 }`
- Commits ae0f7d8, 482a1b5, fabc29c all exist on branch `worktree-agent-a63e712045259b5f5`
- `npx tsc --noEmit` clean
- `npm test` green (103 files, 1014 tests)
- No files deleted
