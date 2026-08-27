---
id: TODO-tool-galaxy-getprojectgraph-timeout
status: closed
planted: 2026-08-21
planted_during: Phase 124 — operator hit it during the 124-11 checkpoint while visiting /tool-galaxy, one of the five routes that moved domain in the regroup
trigger_when: Next Convex-touching phase, batched with the other Convex items so they share ONE operator deploy. /tool-galaxy is fully non-functional today, so this is the highest-value of the three.
scope: Medium (one plan) — bound the read; may need an index or a precomputed snapshot rather than a cap
source: convex/graphSnapshots.ts (getProjectGraph); observed live on /tool-galaxy
resolves_phase: 128
last_reviewed: 2026-08-27
closed: 2026-08-27
closed_by: 128-01 (D-04 re-derivation)
---

## Resolution (128-01, 2026-08-27)

Re-derived against live code, not inherited from the scoping sweep (D-04). `getProjectGraph`
(`convex/graphSnapshots.ts:676-794`) reads `graphSnapshotBlobChunks` via
`.withIndex("by_snapshot_version_seq", (q) => q.eq("snapshotId", snapshotId).eq("version", meta.activeVersion)).order("asc").take(GRAPH_BLOB_MAX_CHUNKS + 1)`
at `:693-699` — the bound is inside the index range/take, not a post-read `.filter()`.
`GRAPH_BLOB_MAX_CHUNKS = 16` (`:101`). The old two-`.collect()` entity-table read this todo was
filed against is retired (`:293-306`). `src/hooks/useProjectGraph.ts:25` confirms `/tool-galaxy`
actually calls `api.graphSnapshots.getProjectGraph`. Full ledger:
`.planning/phases/128-planning-reconciliation/128-TODO-CLOSURES.md`.

# `/tool-galaxy` fails to load — `graphSnapshots:getProjectGraph` times out

## What was observed (2026-08-21, live, operator screenshot)

`/tool-galaxy` renders an error card in place of the page:

```
Tool Galaxy failed to load
[CONVEX Q(graphSnapshots:getProjectGraph)] [Request ID: ca4679bc1fc77d14]
Server Error Your request timed out performing too many system operations.
Called by client
```

The page shell, breadcrumb (`System / Tool Galaxy`), and filter controls render fine —
only the graph query fails. The route itself is healthy; this is purely the backend read.

## NOT caused by Phase 124

`git log --grep="(124-" -- convex/graphSnapshots.ts` returns **0 commits**. Phase 124 made
no Convex deploy at all (124-03's plan explicitly forbade it). The regroup moved this page
into the System domain, which is how the operator came to open it.

## Diagnosis: HYPOTHESIS, not established

**Not root-caused.** The symptom matches CodePulse's documented Convex read-limit class,
but nobody has read `getProjectGraph` yet. State it as a hypothesis until someone does.

The class, for whoever picks this up:

- The real ceiling is a **~4,096 READ limit**, *not* the 16,000-document **write** ceiling
  that Convex's published limits table and this repo's own comments both point at.
  `ctx.db.delete()` counts as a read, and a query issued after N inserts in the same
  mutation must merge that transaction's pending write set at ~N extra reads.
- The tell that it is the read limit and not a cap you can tune: bisecting a cap produces
  **identical** failures at every value. When several values of a parameter all fail the
  same way, the parameter is not the cause — find the variable that discriminates.
- Prior art in this repo: `heroStats` hit the same wall and was fixed by **range-bounding
  a descending index scan** to the window the code already filtered to, not by lowering a
  cap. See also `unbounded-analytics-scans-timeout.md`, which tracks four sibling queries.

## First step when picked up

Read `convex/graphSnapshots.ts` and find what `getProjectGraph` actually reads before
proposing any fix — do not assume it is one unbounded `.collect()`. A graph query may be
doing N+1 edge lookups, which needs a different remedy than a cap.

## Verification when fixed

- `/tool-galaxy` renders its topology against live data.
- Assert on the real observable (the graph renders, node count > 0), not on the absence of
  an error string.
- Requires an operator `npx convex deploy --env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile`.
