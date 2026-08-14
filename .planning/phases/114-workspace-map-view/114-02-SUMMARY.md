---
phase: 114-workspace-map-view
plan: 02
subsystem: api
tags: [convex, react-hooks, workspace-map, graph-snapshots, typescript]

# Dependency graph
requires:
  - phase: 115-workspace-scanner
    provides: "getWorkspaceMap query (convex/workspace.ts:303) returning meta + dirs[] for a workspaceSnapshots row"
provides:
  - "graphSnapshots.listSnapshots' public return shape gains a sources field (D-13)"
  - "exported pure helper projectSnapshotRow for listSnapshots' row projection"
  - "useWorkspaceMap hook: three-state (undefined/null/payload) passthrough over api.workspace.getWorkspaceMap"
  - "useArmsProbe hook: live boolean|undefined derivation of kind:\"arms\" source presence"
affects: [114-workspace-map-view (later plans building the page/renderer that consume these hooks)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Extract a query's row-projection into an exported pure function (selectVersionDeletes precedent) so tests assert against the real production function"
    - "useFoo.ts wraps useQuery(...) and returns the raw three-state Convex result uncoerced when the consumer needs to branch on loading vs true-empty vs data"

key-files:
  created:
    - src/hooks/useWorkspaceMap.ts
    - src/hooks/useArmsProbe.ts
  modified:
    - convex/graphSnapshots.ts
    - convex/graphSnapshots.test.ts

key-decisions:
  - "D-13 implemented as a query-projection change only — no schema migration, no new public query, no auth added"
  - "Reworded useWorkspaceMap's doc comment to avoid the literal `?? []`/`?? null` substrings so it doesn't trip the plan's own acceptance-criteria grep, which can't distinguish code from prose"

patterns-established:
  - "projectSnapshotRow: pure, exported row-projection helper pattern for Convex list queries, directly testable without a DB round-trip"

requirements-completed: []  # design-doc-driven phase; traced to D-02, D-11, D-13 (see must_haves in PLAN.md frontmatter)

# Metrics
duration: 6min
completed: 2026-08-14
---

# Phase 114 Plan 02: Backend sources field + workspace map read hooks Summary

**`listSnapshots` now returns a `sources` field via an exported pure projection helper, and two new thin hooks (`useWorkspaceMap`, `useArmsProbe`) give the page a three-state workspace-map subscription plus a live arms-inventory probe — zero deploy, zero schema change.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-08-14T12:49:00Z (approx, first file read)
- **Completed:** 2026-08-14T12:55:57Z
- **Tasks:** 2
- **Files modified:** 4 (2 modified, 2 created)

## Accomplishments
- `convex/graphSnapshots.ts`'s `listSnapshots` query now returns a sixth field, `sources`, alongside its five original fields — proven byte-identical via a direct-import test on the real production projection function, not a hand-copied mirror.
- `src/hooks/useWorkspaceMap.ts` created: a thin `useQuery(api.workspace.getWorkspaceMap, ...)` wrapper that passes `undefined`/`null`/payload straight through uncoerced, matching `useProjectGraph.ts`'s established shape.
- `src/hooks/useArmsProbe.ts` created: derives `boolean | undefined` arms-presence from `listSnapshots`' new `sources` field, with a defensive array guard so a legacy row missing `sources` degrades to `false` instead of throwing.
- `npx tsc --noEmit` clean after both hooks were added, which is the strongest proof available that Task 1's `sources` field actually reached the generated Convex API types (the hooks compile against the real type, not `any`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the sources field to listSnapshots (D-13)** - `93ef0396` (feat)
2. **Task 2: Create useWorkspaceMap and useArmsProbe** - `5de4c1d2` (feat)

_No plan-metadata commit — orchestrator owns STATE.md/ROADMAP.md; this SUMMARY + its own commit is the plan-completion record._

## Files Created/Modified
- `convex/graphSnapshots.ts` — extracted `listSnapshots`'s row projection into exported pure helper `projectSnapshotRow`, which now includes `sources: r.sources` (6 fields total, up from 5)
- `convex/graphSnapshots.test.ts` — added a `projectSnapshotRow (114 D-13)` describe block: deep-equal sources with mixed kinds, byte-identical original 5 fields, exact 6-key `Object.keys().sort()` assertion, and an empty-sources-array guard
- `src/hooks/useWorkspaceMap.ts` (new) — `useWorkspaceMap(snapshotId?)`, three-state passthrough over `api.workspace.getWorkspaceMap`, exports `WorkspaceMapData` type
- `src/hooks/useArmsProbe.ts` (new) — `useArmsProbe()`, live probe over `api.graphSnapshots.listSnapshots` for `sources[].kind === "arms"`

## Decisions Made
- Followed the plan's `selectVersionDeletes` precedent exactly: extracted the projection into an exported pure function rather than inlining `sources` directly into the `.map()`, so the test proves the real production code path.
- Kept `listSnapshots`'s `args: {}` and `.collect()` unchanged, added no `ctx.auth`, added no new `query()`/`mutation()` export — per D-13's explicit rejection of a new public query and the plan's instruction not to reopen SEED-008.
- `useArmsProbe`'s defensive guard is `Array.isArray(r.sources) && r.sources.some(...)` rather than a top-level try/catch, keeping the "degrade to false, never throw" behavior localized to the one field that could be malformed on an older row.

## Deviations from Plan

**1. [Rule 1 - Bug/self-inflicted] Doc comment tripped the plan's own acceptance-criteria grep**
- **Found during:** Task 2 (writing `useWorkspaceMap.ts`)
- **Issue:** The plan's acceptance criteria requires `grep -c '?? \[\]\|?? null' src/hooks/useWorkspaceMap.ts` to return 0. My first draft of the doc comment explained the "do not coerce" rule by literally writing the strings `` `?? []` `` and `` `?? null` `` as examples of what not to write — which the acceptance-criteria grep (a blunt literal pattern match with no code/prose distinction) counted as a hit.
- **Fix:** Reworded the comment to describe the rule ("do NOT coerce or collapse the result with a fallback operator of any kind") without using the literal operator substrings. No functional code changed.
- **Files modified:** `src/hooks/useWorkspaceMap.ts`
- **Verification:** Re-ran `grep -c '?? \[\]\|?? null' src/hooks/useWorkspaceMap.ts` → 0. `npx tsc --noEmit` still clean.
- **Committed in:** `5de4c1d2` (part of Task 2 commit — caught before commit, no extra commit needed)

---

**Total deviations:** 1 auto-fixed (1 self-inflicted grep-pattern collision, Rule 1)
**Impact on plan:** No scope creep; purely a wording fix to satisfy the plan's own literal verification command.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required. This plan does not deploy (per plan and CLAUDE.md § Self-Hosted Convex — Operational Rules); the backend change lands live only when the operator deploys at the phase's operator checkpoint (a later plan).

## Next Phase Readiness
- Both hooks are ready for the page/renderer plan(s) to consume: `useWorkspaceMap` for the radial map's node/edge data, `useArmsProbe` for the lens switcher's live empty-state gate (D-10/D-11).
- The `sources` field is only live once this commit's Convex code is deployed — later plans that build against a running dev backend should confirm the deploy has happened, or run `npx convex dev` locally, before expecting `useArmsProbe` to resolve real data end-to-end.
- No blockers identified for subsequent plans in this phase.

---
*Phase: 114-workspace-map-view*
*Completed: 2026-08-14*
