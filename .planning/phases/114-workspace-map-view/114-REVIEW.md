---
phase: 114-workspace-map-view
reviewed: 2026-08-14T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - convex/graphSnapshots.ts
  - src/components/workspace/WorkspaceMapCanvas.tsx
  - src/components/workspace/WorkspaceMapPanel.tsx
  - src/components/workspace/WorkspaceCoverageStrip.tsx
  - src/components/workspace/AstridrLensEmptyState.tsx
  - src/lib/workspaceMapLayout.ts
  - src/pages/WorkspaceMap.tsx
  - src/hooks/useWorkspaceMap.ts
  - src/hooks/useArmsProbe.ts
  - src/hooks/useThemeColors.ts
  - src/lib/navRegistry.ts
  - src/App.tsx
  - src/index.css
  - src/test/workspaceMapFixture.ts
findings:
  critical: 1
  warning: 0
  info: 1
  total: 2
  resolved: 2
  open: 0
status: resolved
---

<!--
RESOLUTION, appended by the orchestrator 2026-08-14 after acting on this report.
BOTH findings are CLOSED in commit "fix(114): close code-review CR-01 and IN-01".
Neither was accepted on the reviewer's word; each mechanism was re-derived against
the live code first.

CR-01 (Critical) — CONFIRMED REAL, then fixed.
  Verified: src/pages/WorkspaceMap.tsx did pass `data={payload ?? undefined}`, and
  WorkspaceCoverageStrip's prop type was `WorkspaceMapData | undefined` branching
  `if (data === undefined)` into a Skeleton. getWorkspaceMap returns null for "no
  snapshot yet", so the strip would render a loading skeleton forever beside a
  canvas whose own `payload === null` branch correctly says "No workspace snapshot
  yet." It also violated the three-state contract useWorkspaceMap.ts documents in
  its own comment.
  Fix: the strip accepts all three states and renders an honest no-snapshot chip on
  null; the call site drops the coercion.
  Regression test MUTATION-PROVED: deleting the null branch turns exactly the new
  test RED (1 failed, 14 passed). The test asserts both that the honest copy appears
  AND that zero skeletons render — the second half is the discriminating one, since
  a component rendering both would pass the first half alone.

IN-01 (Info) — CONFIRMED REAL, then fixed.
  Verified: buildTree's loop inserts EVERY row into `byKey`, roots included, and
  `rootKeys` was built from a subset of those same rows, so `rootKeys.has(k)` implies
  `byKey.has(k)` and the disjunct could never change the outcome. It was also the only
  use of `rootKeys`. Both removed, with a comment recording the invariant, because the
  dead disjunct implied roots are tracked separately when they are not.

Gate after both fixes: tsc clean, build succeeds, 4397 passed / 197 todo / 0 failed
across 323 files.
-->

# Phase 114: Code Review Report

**Reviewed:** 2026-08-14
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Reviewed the Workspace Map view (Phase 114) at standard depth, reading every file in the
`files:` scope plus the additional cross-reference files in `<required_reading>` (test files,
`useThemeColors.ts`, `useArmsProbe.ts`, `useWorkspaceMap.ts`) to trace call chains into
`convex/workspace.ts` and `convex/graphSnapshots.ts` where needed to confirm field shapes and
return-value contracts.

`src/lib/workspaceMapLayout.ts` (the module explicitly flagged as highest-risk, built across two
plans) is solid: `buildTree`/`computeRollups`/`layoutNodes` are pure, non-mutating, O(n) or
O(n log n) over the supplied `dirs` array, degrade gracefully on zero roots/zero departments
(`allocateSectors`'s degenerate branch never divides by zero), and the recursive
`layoutDirChildren` traversal is bounded by the currently-visible node count via
`expandedSet`, never by the full 4,912-row payload — matching the module's own stated
anti-pattern guard. No off-by-one, NaN, or divide-by-zero was found in ring/angle allocation
across the fixture's boundary cases (0 roots, 0 files, single-department, degenerate weight
sums).

`WorkspaceMapCanvas.tsx`'s `expandedSet` handling does not use the React state-updater form
anywhere (`setExpandedSet(next)` / `setSelectedKey(key)` are called with plain values, never
`setX(cur => ...)`), so the StrictMode double-invoke side-effect class this codebase has hit
before does not apply here — `onNodeSelect` and other side effects run directly in the click
handler body, not inside an updater callback.

One confirmed functional defect was found in `src/pages/WorkspaceMap.tsx`, detailed below.

**Per the explicit instruction to check `convex/graphSnapshots.ts`'s pre-existing
`sweepGraphSnapshotVersions` defect (the `.collect()` bounded only by a delete cap, inert
because its cron is disabled):** this phase's change to that file — `projectSnapshotRow` and the
new `sources` field on `graphSnapshots`/`listSnapshots` — does **not** touch or worsen that path.
`sweepGraphSnapshotVersions` (lines 168–253) reads `meta.snapshotId` and node/link `version`
fields only; it never references `sources` or calls `projectSnapshotRow`. The pre-existing defect
is unchanged by this phase and remains correctly documented inert (cron disabled) in the file's
own comments (lines 175–190, 207–217).

## Critical Issues

### CR-01: `WorkspaceCoverageStrip` gets the "no snapshot yet" state coerced into "still loading" — shows a perpetual skeleton instead of the honest empty state

**File:** `src/pages/WorkspaceMap.tsx:90`

**Issue:** `convex/workspace.ts`'s `getWorkspaceMap` query explicitly returns `null` when no
`workspaceSnapshots` row exists yet (`convex/workspace.ts:311`, `if (!meta) return null; //
graceful-skip: no data yet`) — a real, expected, and already-anticipated state: the sibling
canvas component has a dedicated branch for it with the copy "The nightly scan (04:15) hasn't
produced one. Check `CodePulse-WorkspaceScan` in Task Scheduler, or wait for the next run."
(`WorkspaceMapCanvas.tsx:279-290`).

`useWorkspaceMap.ts`'s own doc comment states the contract explicitly:

```
 * Returns the RAW Convex result — three-state passthrough (do NOT coerce):
 *   undefined → Convex subscription still resolving (loading)
 *   null      → query resolved, no workspaceSnapshots row exists yet
 *               (true-empty state — e.g. the nightly scan hasn't run)
 *   object    → live workspace map data (meta fields + dirs[])
 * ...
 * Do NOT coerce or collapse the result with a fallback operator of any
 * kind — the consumer branches on all three states, and collapsing the
 * loading state into the empty state would render the "no snapshot yet,
 * check Task Scheduler" copy during ordinary loading
```

`WorkspaceMap.tsx:90` violates this contract in the opposite direction — it collapses the `null`
(true-empty) state into `undefined` (loading) for the coverage strip specifically:

```tsx
<WorkspaceCoverageStrip data={payload ?? undefined} />
```

`WorkspaceCoverageStripProps.data` is typed `WorkspaceMapData | undefined` (no `null` in its
signature, `WorkspaceCoverageStrip.tsx:105`), and the component's only branch on the loading state
is `if (data === undefined) { ...skeleton... }` (`WorkspaceCoverageStrip.tsx:113`) — there is no
separate branch for "resolved, no snapshot". Because `payload ?? undefined` maps `null` to
`undefined`, the coverage strip cannot distinguish "still loading" from "definitively no snapshot
exists" — in the true-empty state it renders the four skeleton pills forever, never resolving,
directly above a canvas that correctly shows "No workspace snapshot yet." This is the exact
first-run / pre-nightly-scan scenario the canvas's own copy anticipates, so it is not a rare edge
case — every fresh install or post-retention-gap visit to `/workspace-map` will show this
inconsistent, permanently-loading strip.

Confirmed untested: `WorkspaceCoverageStrip.test.tsx` only exercises `data={undefined}` for the
loading branch (`WorkspaceCoverageStrip.test.tsx:143-149`) and real fixture objects for the
healthy/degraded branches — no test passes `data={null}` or exercises `WorkspaceMap.tsx`'s
`payload === null` case at all (`WorkspaceMap.test.tsx`'s `mockGetWorkspaceMap` is called only
with `makeWorkspaceMapFixture()`, never `null`, across the whole file).

**Fix:** Give `WorkspaceCoverageStrip` (or a wrapper) a real third state instead of coercing.
Simplest fix that keeps `WorkspaceCoverageStripProps` honest:

```tsx
// WorkspaceCoverageStrip.tsx
export interface WorkspaceCoverageStripProps {
  data: WorkspaceMapData | null | undefined;
  now?: number;
}

export function WorkspaceCoverageStrip({ data, now }: WorkspaceCoverageStripProps) {
  const nowMs = now ?? Date.now();

  if (data === undefined) {
    return /* existing skeleton */;
  }
  if (data === null) {
    return (
      <Card className="flex flex-row flex-wrap items-center gap-2 px-6 py-4">
        <StripChip text="No workspace snapshot yet" warn />
      </Card>
    );
  }
  // ...existing object branch unchanged
}
```

```tsx
// WorkspaceMap.tsx:90
<WorkspaceCoverageStrip data={payload} />
```

## Info

### IN-01: Redundant/dead disjunct in `buildTree`'s orphan-detection guard

**File:** `src/lib/workspaceMapLayout.ts:113-114`

**Issue:** 

```ts
const parentPresent =
  byKey.has(candidateParentKey) || rootKeys.has(candidateParentKey);
```

`rootKeys` is built from `roots` (`workspaceMapLayout.ts:98`), and every row in `roots` was
already unconditionally inserted into `byKey` two lines above the `roots.push(row)` call
(`workspaceMapLayout.ts:94`, `byKey.set(nodeKey(row.rootId, row.dirPath), row)` runs for every
row in `dirs`, root or not, before the `if (row.dirPath === "")` check that populates `roots`).
So `rootKeys` is always a subset of `byKey`'s key set, and `rootKeys.has(candidateParentKey)` can
never be `true` while `byKey.has(candidateParentKey)` is `false` — the second disjunct is
unreachable dead logic. Not a functional bug (the `||` still evaluates correctly, just
redundantly), but it reads as if root-parent detection needs a separate path, which is
misleading for a future editor.

**Fix:** Drop the redundant check:

```ts
const parentPresent = byKey.has(candidateParentKey);
```

(Optionally: also remove the now-unused `rootKeys` construction at line 98, and the `rootKey`
lookup usage below it should be re-verified since `rootKeys` may still be needed elsewhere — a
quick grep shows it is also used at line 107 to compute `rootKey` for the orphan fallback, so
only the redundant `.has()` check itself should be removed, not the `rootKeys` set.)

---

## What I dropped and why

- **`.dark, [data-theme="cyan"]` vs `[data-theme="amber"]` missing `--dept-*` tokens**
  (`src/index.css:218-235`): investigated as a possible missing-CSS-variable defect for the
  `amber` theme (which lacks `--dept-personal`/`--dept-consulting`/`--dept-work`). Dropped:
  confirmed via `index.html`'s pre-paint script (`index.html:9`) that the valid-theme allowlist
  is `['cyan','emerald','readable','aubergine']` — `amber` can never be set by the app, and
  `<html class="dark">` is always present statically, so even if `data-theme="amber"` were forced
  via devtools, the `.dark` selector (which always matches) would still supply the dept-color
  fallback values via CSS cascade before the amber block's absence of those properties could
  produce an empty string. No live path reaches this gap. This matches CLAUDE.md's own note that
  amber "is defined in CSS but not exposed in the switcher."
- **`WorkspaceMapPanel`/`WorkspaceMapCanvas` duplicate unexported `deptColor` helper**: both files
  contain a near-identical department→color switch. Dropped as a finding: it's called out and
  justified in `WorkspaceMapCanvas.tsx`'s own header comment as a deliberate, small, acknowledged
  duplication rather than an oversight — flagging it would be re-reporting a decision already
  made and documented, not a defect.
- **Speculative StrictMode double-invoke risk in `WorkspaceMapCanvas`**: this codebase has a real
  history of side effects placed inside `setState` updater functions firing twice under
  StrictMode. Checked directly: `setExpandedSet`/`setSelectedKey` are called with plain
  precomputed values in `handleNodeClick`, never with the `(cur) => ...` updater form, and
  `onNodeSelect` is invoked directly in the handler body, not inside a state updater. No instance
  of this bug class found in the reviewed files.
- **`sweepGraphSnapshotVersions`'s pre-existing `.collect()` shape** (`convex/graphSnapshots.ts:
  191-196`): not re-reported as a new finding per the task instruction — it is unchanged by this
  phase, already fully diagnosed in the file's own comments, and inert (cron disabled).

---

_Reviewed: 2026-08-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
