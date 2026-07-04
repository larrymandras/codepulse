---
phase: 84
plan: 01
subsystem: graphs-hub
tags: [hook, fixture, test-scaffold, wave-0, tdd]
requires: [convex/graphSnapshots.ts, api.graphSnapshots.getProjectGraph]
provides: [useProjectGraph hook, ProjectGraphData type, projectGraphFixture, Wave 0 test files]
affects: [src/hooks/, src/test/, src/components/graph/, src/pages/]
tech_stack_added: []
tech_stack_patterns: [useQuery thin wrapper, raw three-state passthrough, vi.mock convex/react, it.todo scaffold]
key_files_created:
  - src/hooks/useProjectGraph.ts
  - src/hooks/useProjectGraph.test.ts
  - src/test/projectGraphFixture.ts
  - src/components/graph/CodeVaultGraph.test.tsx
  - src/pages/GraphsHub.test.tsx
key_files_modified: []
decisions:
  - "Raw three-state passthrough: useProjectGraph returns useQuery result verbatim (no ?? null / ?? [] coercion) so CodeVaultGraph can distinguish loading from empty per D-12"
  - "Fixture overrides via flat args (truncated, staleGeneratedAt, storedNodeCountOverride) rather than deep Partial to keep caller sites simple"
  - "GraphsHub.test.tsx has 4 todos (3 tile-click + 1 tile-render) rather than the minimum 2 per plan, matching the actual 3-tile navigation surface"
metrics:
  duration_minutes: 12
  completed_date: "2026-06-22"
  tasks_completed: 2
  tasks_total: 2
  files_created: 5
  files_modified: 0
---

# Phase 84 Plan 01: Data-Access Seam + Wave 0 Test Scaffolding Summary

**One-liner:** useProjectGraph raw-passthrough hook over api.graphSnapshots.getProjectGraph, plus a faithfully-shaped fixture and 3 Wave 0 test files with 13 pending behaviors enumerated for plans 02/03.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | useProjectGraph hook + three-state test | 0318dc9 | src/hooks/useProjectGraph.ts, src/hooks/useProjectGraph.test.ts |
| 2 | Shared fixture/mock + component/page test scaffolds | 3217680 | src/test/projectGraphFixture.ts, src/components/graph/CodeVaultGraph.test.tsx, src/pages/GraphsHub.test.tsx |

## What Was Built

### `useProjectGraph` hook (`src/hooks/useProjectGraph.ts`)

Thin wrapper over `useQuery(api.graphSnapshots.getProjectGraph, ...)`. Returns the raw Convex result — the three-state signal is preserved without coercion:
- `undefined` — Convex subscription still resolving (loading pulse)
- `null` — query resolved, no snapshot ingested yet (D-12 explainer state)
- `object` — live snapshot data

Exports `ProjectGraphData` as `NonNullable<ReturnType<typeof useQuery<typeof api.graphSnapshots.getProjectGraph>>>` — the inferred type picks up all fields from the handler's return shape without duplicating them.

5-test suite covers: loading passthrough, null passthrough, object reference identity (no wrapping), `{ snapshotId }` forwarding when arg provided, `{}` forwarding when omitted.

### `projectGraphFixture.ts` (`src/test/projectGraphFixture.ts`)

`makeProjectGraphFixture(overrides?)` returns an object exactly matching the `getProjectGraph` handler shape (convex/graphSnapshots.ts:260-281):
- 2 graphify-source nodes (`graphify:codepulse:src/a.ts`, `graphify:codepulse:src/b.ts`, source `graphify:codepulse:`)
- 1 vault-source node (`vault:Note.md`, source `vault:`)
- 2 links (imports + references)
- `sources[]` with one graphify entry and one vault entry
- `generatedAt` defaults to `Date.now()/1000` (fresh); overridable via `staleGeneratedAt` for the stale-badge test
- `storedNodeCount/storedLinkCount` equal `nodeCount/linkCount` by default; overridable via `storedNodeCountOverride`/`storedLinkCountOverride` for the integrity-warning case
- `truncated` flag toggles `emittedNodeCount/emittedLinkCount` on the graphify source entry

`mockGetProjectGraph(value)` sets `vi.mocked(useQuery).mockReturnValue(value)` — consumer test files import and call this inside `beforeEach`.

### Wave 0 test scaffolds

`CodeVaultGraph.test.tsx` — 9 `it.todo` entries covering all GH-02 rows from 84-VALIDATION.md:
render-with-data, loading-on-undefined, empty-on-null, source-filter-drops-vault+dangling, truncation X-of-Y, stale-badge, integrity-warning, detail-panel-on-click, colorFn emerald/violet.

`GraphsHub.test.tsx` — 4 `it.todo` entries covering GH-03 rows: three tiles render, three tile-click navigations (KG Explorer, Tool Galaxy, MCP Inventory).

All three Phase 84 test files run clean: `5 pass | 13 todos | 0 failures`.

## Verification

```
npx vitest run src/hooks/useProjectGraph.test.ts src/test/projectGraphFixture.ts \
  src/components/graph/CodeVaultGraph.test.tsx src/pages/GraphsHub.test.tsx
→ 5 passed | 13 todo | 0 failed

npx tsc --noEmit
→ clean (no errors)
```

## Deviations from Plan

None — plan executed exactly as written.

The GraphsHub scaffold has 4 `it.todo` entries (3 tile-click + 1 tile-render) rather than the stated minimum of 2. This is additive: the plan specified "at least 2" and the actual hub surface has 3 clickable tiles requiring separate navigation assertions.

## Known Stubs

None — this plan creates test scaffolding only. No UI components or data paths introduced; stubs are not applicable.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes. This plan creates client-side hook + test files only, consuming the existing public read-only `getProjectGraph` query established in Phase 83 (T-84-01: accepted, no PII/secrets, matches established public-read telemetry posture).

## Self-Check: PASSED

- [x] src/hooks/useProjectGraph.ts — exists, contains `useQuery(api.graphSnapshots.getProjectGraph` and exports `useProjectGraph` and `ProjectGraphData`; no `?? null` coercion
- [x] src/hooks/useProjectGraph.test.ts — exists, 5 tests green
- [x] src/test/projectGraphFixture.ts — exists, contains `makeProjectGraphFixture`, `storedNodeCount`, `generatedAt`, `vault:`, `graphify:`
- [x] src/components/graph/CodeVaultGraph.test.tsx — exists, contains `CodeVaultGraph`, 9 `it.todo` entries
- [x] src/pages/GraphsHub.test.tsx — exists, contains `GraphsHub`, 4 `it.todo` entries
- [x] Commits 0318dc9 and 3217680 both present in git log
