---
phase: 83-graph-snapshot-receiver
plan: "01"
subsystem: convex-schema
tags: [schema, convex, graph-snapshots, backend]
dependency_graph:
  requires: []
  provides: [graphSnapshots-table, graphSnapshotNodes-table, graphSnapshotLinks-table]
  affects: [convex/_generated/dataModel.d.ts, convex/graphSnapshots.ts (plan 02)]
tech_stack:
  added: []
  patterns: [defineTable, v.optional(v.float64()), compound-index, by_snapshot_version]
key_files:
  created: []
  modified:
    - convex/schema.ts
decisions:
  - "community field uses v.optional(v.float64()) not v.number() — vault nodes emit community: null (T-83-04 / Pitfall 4)"
  - "generatedAt uses v.float64() not v.string() — producer emits Python time.time() float (Pitfall 6)"
  - "Row-based storage (D-01) avoids 8192-element array limit and ~1 MiB doc limit"
  - "Three tables appended after Forge tables, before closing defineSchema({})) brace"
metrics:
  duration: "~8 minutes"
  completed: "2026-06-18"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 1
---

# Phase 83 Plan 01: Schema Foundation — graphSnapshots Tables Summary

**One-liner:** Three Convex persistence tables for the graph-snapshot receiver — `graphSnapshots` meta doc plus `graphSnapshotNodes` and `graphSnapshotLinks` entity rows keyed by `(snapshotId, version)` with `by_snapshot_version` compound indexes — schema foundation for GH-01.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add graphSnapshots, graphSnapshotNodes, graphSnapshotLinks tables to schema | f88823e | convex/schema.ts |

## What Was Built

Added three new tables to `convex/schema.ts` in a new `GRAPH SNAPSHOT RECEIVER (Phase 83, GH-01)` section after the Forge tables:

**`graphSnapshots`** — Meta doc (one row per `snapshotId`). Fields: `snapshotId`, `activeVersion` (monotonic int), `sources[]` (all seven producer-source fields verbatim including `truncated: v.boolean()`), `nodeCount`, `linkCount`, `storedNodeCount`, `storedLinkCount`, `generatedAt: v.float64()`, `updatedAt: v.float64()`. Index: `by_snapshotId` on `["snapshotId"]`.

**`graphSnapshotNodes`** — Entity rows keyed by `(snapshotId, version)`. Fields: `snapshotId`, `version`, `nodeId`, `label`, `type`, `community: v.optional(v.float64())`, `source`. Index: `by_snapshot_version` on `["snapshotId", "version"]`.

**`graphSnapshotLinks`** — Entity rows keyed by `(snapshotId, version)`. Fields: `snapshotId`, `version`, `source`, `target`, `relation`. Index: `by_snapshot_version` on `["snapshotId", "version"]`.

## Verification

- `npx tsc --noEmit` exited 0 with no errors.
- All six acceptance criteria confirmed by direct file inspection:
  - Three `defineTable` declarations present
  - `community: v.optional(v.float64())` on `graphSnapshotNodes` (line 1652)
  - `generatedAt: v.float64()` on `graphSnapshots` (line 1640)
  - `by_snapshotId` index on `graphSnapshots`
  - Two `by_snapshot_version` indexes (lines 1654, 1663)
  - `sources: v.array(v.object(` block with all seven fields including `truncated: v.boolean()`

## Deviations from Plan

None — plan executed exactly as written.

## Threat Flags

None — schema-only plan. T-83-04 (`community: null` from vault nodes) is mitigated by `v.optional(v.float64())` as specified. T-83-05 (oversized snapshot) is mitigated by row-based storage design as specified.

## Known Stubs

None — this is a schema-only plan with no UI rendering or data-source wiring.

## Self-Check: PASSED

- `convex/schema.ts` modified and confirmed (lines 1624–1663 contain all three tables)
- Commit f88823e exists on branch `worktree-agent-a1151710d761cbd64`
- No files deleted
- `npx tsc --noEmit` clean
