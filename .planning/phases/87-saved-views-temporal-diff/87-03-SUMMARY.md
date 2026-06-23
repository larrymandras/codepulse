---
phase: 87-saved-views-temporal-diff
plan: "03"
subsystem: kg-temporal-diff
tags: [kg, temporal-diff, canvas-paint, set-arithmetic, graceful-degrade]
dependency_graph:
  requires: [fetchOverview, KGControls, KnowledgeGraph, paintNode]
  provides: [useKgDiff, computeDiff, KGDiffControls, temporalSubMode-toggle, paintNodeDiff, DIFF-legend]
  affects: [KnowledgeGraph.tsx, KGControls.tsx]
tech_stack:
  added: []
  patterns: [monotonic-reqRef-stale-drop, set-arithmetic-diff, canvas-alpha-dim, makeLinkColorDiffFn-factory, useMemo-edge-style-fns]
key_files:
  created:
    - src/hooks/useKgDiff.ts
    - src/hooks/useKgDiff.test.ts
    - src/components/kg/KGDiffControls.tsx
  modified:
    - src/components/kg/KGControls.tsx
    - src/components/kg/KGControls.test.tsx
    - src/pages/KnowledgeGraph.tsx
decisions:
  - "paintNodeDiff closes over `diff` state via useCallback dep — diff sets are accessed inline instead of passed as a param, which avoids changing the ForceGraphCanvas paintNode signature"
  - "linkColorDiffFn/linkLineDashDiffFn implemented as factory fns returning new closures (makeLinkColorDiffFn/makeLinkLineDashDiffFn) rather than inline closures — memoized with useMemo([diff]) to avoid ForceGraphCanvas re-mounts on every render"
  - "diffEdgeKey in KnowledgeGraph.tsx duplicates edgeKey from useKgDiff.ts — kept separate to avoid a circular import; comment documents the invariant that they must stay in sync"
  - "isEmpty replaced with activeGraph.nodes.length === 0 for the empty-state check so diff mode uses graphB node count not the main graph count"
  - "Details panel passes activeGraph (diffGraphB in diff mode) so the To-snapshot facts appear in the panel — consistent with D-11 independent edge classification"
metrics:
  duration_seconds: 519
  completed_date: "2026-06-23"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 3
---

# Phase 87 Plan 03: Temporal Diff — useKgDiff + KGDiffControls + paintNodeDiff Summary

**One-liner:** Client-side D-10/D-11 diff hook with monotonic stale-drop, Point|Diff|Animate sub-mode toggle, KGDiffControls From/To pickers, and paintNodeDiff canvas swap with green/red/amber/dimmed diff palette + DIFF legend.

## What Was Built

### Task 1 — useKgDiff hook + computeDiff pure fn + Wave 0 tests (commit `ec7bb98`)

Created `src/hooks/useKgDiff.ts`:
- **`computeDiff(graphA, graphB): KgDiffSets`** — pure function, exported for unit testing
  - Node sets via Set arithmetic over `node.id`: added (in B not A), removed (in A not B), changed (in both)
  - D-10: "changed" if `serializeAttrs()` differs OR incident current-edge key set differs between snapshots
  - D-11: edges classified independently — each edge added/removed/changed by its own identity
  - Edge identity: `link.id` when present, else composite `${source}|${target}|${predicate}` (Pitfall 6)
- **`useKgDiff(dateA, dateB)`** — returns `{ diff, graphB, loading, error, compare }`
  - `compare()` uses monotonic `reqRef` to drop stale in-flight fetches
  - `Promise.all([fetchOverview({asOf:dateA}), fetchOverview({asOf:dateB})])` 
  - D-08 graceful-degrade: `AstridrApiError` status 404 → `"Could not load snapshot for {dateA} or {dateB}."` — never throws
  - `diff` is `useMemo(() => computeDiff(graphA, graphB), [graphA, graphB])`

Created `src/hooks/useKgDiff.test.ts` — 12/12 tests green:
1. Node only in B → added
2. Node only in A → removed
3. Node in both with identical attributes and edges → not changed
4. Node in both with differing attributes → changed (D-10 attribute comparison)
5. Node in both, attributes identical, gains a current edge → changed (D-10 edge gain)
6. Edge only in B between unchanged nodes → edges.added (D-11 independent)
7. Edge only in A → edges.removed
8. Edge in both with flipped `current` → edges.changed (D-11)
9. Edge in both with identical current/validTo → not changed
10. Composite key fallback when link.id empty + current flips → edges.changed via composite key (Pitfall 6)
11. Composite key fallback — edge only in B via composite key → edges.added
12. `compare()` with AstridrApiError 404 → error set, loading false, diff null (D-08)

### Task 2 — KGDiffControls + Point|Diff|Animate sub-mode toggle in KGControls (commit `65124ba`)

Created `src/components/kg/KGDiffControls.tsx`:
- `From` and `To` `<Input type="date">` pickers with `text-[10px] uppercase tracking-wide` labels (matching existing `As of` label style)
- `Compare` button (`variant="secondary" size="sm" font-mono text-sm`): disabled when `!dateA || !dateB || dateA >= dateB || loading`
- Inline hint `"Select two different dates to compare."` shown when both dates set but From >= To
- ISO date handling consistent with existing as-of Input: value `dateX?.slice(0, 10) ?? ""`, onChange converts to ISO or null

Modified `src/components/kg/KGControls.tsx`:
- Added `TemporalSubMode` type export: `"point" | "diff" | "animate"`
- Extended `KGControlsProps` with: `temporalSubMode`, `onSubMode`, `diffDateA`, `diffDateB`, `onChangeDiffDateA`, `onChangeDiffDateB`, `onCompare`, `diffLoading`
- `TEMPORAL_SUB_MODES` constant array drives the chip rendering
- Sub-mode chip row appears only when `lens === "temporal"` (NOT a new lens tab — UI-SPEC Layout Contract)
- Chips use same active style as lens tabs: `bg-primary/15 border-primary/50 text-primary` active / `bg-card/60 border-border text-muted-foreground` idle
- Temporal body branches on `temporalSubMode`: "point" → existing as-of Input + Now (unchanged, regression guard); "diff" → `<KGDiffControls />`; "animate" → stub placeholder
- `setLens` never called with "diff"/"animate" — sub-modes are UI-local only (confirmed in tests)

Modified `src/components/kg/KGControls.test.tsx`:
- Updated `renderControls` helper to accept and default the 8 new props
- 11 new assertions: chip rendering when temporal, no chips for non-temporal lenses, onSubMode calls, aria-pressed states, regression guard (Point renders as-of Input), Diff does not render as-of Input, Diff renders From/To inputs, Compare disabled when dateA null
- 23/23 tests pass (12 existing + 11 new)

### Task 3 — Wire diff into KnowledgeGraph — paintNodeDiff, diff edges, DIFF legend (commit `ca7a9a2`)

Modified `src/pages/KnowledgeGraph.tsx`:

**New imports:** `useKgDiff` from `../hooks/useKgDiff`, `TemporalSubMode` type from `../components/kg/KGControls`

**New module-level helpers (diff edge styling):**
- `diffEdgeKey(l: KgLink)` — same edge identity logic as `useKgDiff.ts:edgeKey` (documented invariant)
- `makeLinkColorDiffFn(edges)` → returns `linkColorDiffFn`: added `rgba(34,197,94,0.55)` / removed `rgba(239,68,68,0.40)` / changed `rgba(234,179,8,0.55)` / unchanged `rgba(161,163,170,0.15)`
- `makeLinkLineDashDiffFn(edges)` → returns `linkLineDashDiffFn`: removed edges get `[4,3]` dash, all others `null`

**New component state:**
- `const [temporalSubMode, setTemporalSubMode] = useState<TemporalSubMode>("point")` — defaults "point", resets to "point" when `lens !== "temporal"` (via `useEffect([lens])`)
- `const [diffDateA, setDiffDateA] = useState<string | null>(null)`
- `const [diffDateB, setDiffDateB] = useState<string | null>(null)`
- `useKgDiff(diffDateA, diffDateB)` → `{ diff, graphB: diffGraphB, loading: diffLoading, error: diffError, compare }`

**`paintNodeDiff` useCallback:**
- Copies `paintNode` structure; color/alpha logic replaced with DIFF_COLORS lookup
- `state` = added/removed/changed from `diff` sets, else "unchanged"
- Unchanged nodes: `ctx.globalAlpha = 0.35` with `n.color` (Pitfall 3 — explicit dim)
- `ctx.globalAlpha = 1` reset after each node
- Closes over `diff` state via useCallback deps: `[selectedNodeId, diff]`

**Memoized diff edge fns:**
- `linkColorDiffFn = useMemo(() => diff ? makeLinkColorDiffFn(diff.edges) : linkColorFn, [diff])`
- `linkLineDashDiffFn = useMemo(() => diff ? makeLinkLineDashDiffFn(diff.edges) : linkLineDashFn, [diff])`

**`isDiffActive` flag:**
- `lens === "temporal" && temporalSubMode === "diff" && diff !== null && diffGraphB !== null`

**`activeGraph`:**
- `isDiffActive ? diffGraphB! : graph` — drives legend types, community ids, ForceGraphCanvas data, and KGDetailsPanel

**Canvas rendering fork:**
- `isDiffActive`: `ForceGraphCanvas` with `paintNodeDiff`, `linkColorDiffFn`, `linkLineDashDiffFn`, `data={activeGraph}`
- Otherwise: original `paintNode`, `linkColorFn`, `linkLineDashFn`, `data={graph}` — **no regression in Point mode**
- `diffLoading && temporalSubMode === "diff"`: "Diffing knowledge graph…" animate-pulse overlay
- `isDiffActive && diff.added/removed/changed all empty`: "No changes between these two snapshots." amber info banner

**DIFF legend:**
- Appended inside existing floating legend overlay conditional on `temporalSubMode === "diff" && diff`
- `border-t border-border mt-1 pt-1` separator + "DIFF" header + 4 swatch rows (added/removed/changed/unchanged with correct colors and opacity)

**KGControls call site:** all 8 new props passed (`temporalSubMode`, `onSubMode=setTemporalSubMode`, `diffDateA/B`, `onChangeDiffDateA/B=setDiffDateA/B`, `onCompare=compare`, `diffLoading`)

**Details panel:** now receives `activeGraph` (diffGraphB in diff mode) for To-snapshot facts display

## Verification Results

- `npx vitest run src/hooks/useKgDiff.test.ts` — 12/12 passed
- `npx vitest run src/components/kg/KGControls.test.tsx` — 23/23 passed (12 existing + 11 new sub-mode assertions)
- `npx tsc --noEmit` — clean, no errors
- `npm test` — 1276 passed / 2 failed (the 2 failures are pre-existing: SwarmTaskNode width class mismatch + KanbanCard label chip count — confirmed identical before and after these changes)

## Commits

| Hash | Message |
|------|---------|
| `ec7bb98` | feat(87-03): add useKgDiff hook + computeDiff pure fn + Wave 0 tests |
| `65124ba` | feat(87-03): add KGDiffControls + Point|Diff|Animate sub-mode toggle in KGControls |
| `ca7a9a2` | feat(87-03): wire diff into KnowledgeGraph — paintNodeDiff, diff edges, DIFF legend |

## Deviations from Plan

### Auto-fixed Issues

None.

### Architectural Choices (within-discretion)

**1. diffEdgeKey duplication in KnowledgeGraph.tsx**
- **Reason:** `useKgDiff.ts` exports `computeDiff` but not the internal `edgeKey`. Importing it would create a dependency from the page on the hook's internal helper, or require exporting it from the hook's public API.
- **Decision:** Duplicated the 8-line `diffEdgeKey` function in `KnowledgeGraph.tsx` with a comment documenting the invariant (must stay in sync with `useKgDiff.ts:edgeKey`).
- **Impact:** Minor — both are simple, stable functions. The comment makes the relationship explicit.

**2. `makeLinkColorDiffFn`/`makeLinkLineDashDiffFn` factory pattern**
- **Reason:** Cannot use `diff` directly in module-level functions (no access to component state). Using closure factories + `useMemo` avoids recreating the functions on every render while still updating when `diff` changes.
- **Impact:** Cleaner than inline lambdas in the JSX; no observable behavior change.

**3. `paintNodeDiff` closes over `diff` state**
- **Reason:** `ForceGraphCanvas` expects `paintNode` signature `(node, ctx, globalScale, opts)` — adding a `diffSets` param would require changing the shared canvas component. Closing over `diff` via `useCallback([selectedNodeId, diff])` is the correct React pattern.
- **Impact:** `paintNodeDiff` re-creates when `diff` changes (acceptable — diff changes only on `compare()` call).

## Known Stubs

- **Animate sub-mode placeholder** in `KGControls.tsx`: renders `"Animation controls coming in Plan 04."` text. Intentional per plan spec — Plan 04 (wave 4) builds `useKgAnimation` + `KGAnimateControls`. Not a stub that blocks the plan's goal (diff mode is fully functional).

## Threat Flags

No new threat surface beyond what the plan's threat model registers (T-87-08 through T-87-10). Mitigations verified:
- **T-87-08** (Tampering): `<Input type="date">` produces ISO strings; Compare disabled unless `dateA < dateB`. Values sent as `asOf` query params on the existing authed `fetchOverview` path — no new injection surface.
- **T-87-09** (Denial of Service): Monotonic `reqRef` drops stale in-flight fetches; only two parallel fetches per `compare()` call.
- **T-87-10** (Information Disclosure): Error copy names operation/date only (`"Could not load snapshot for {date}"`) — no stack trace or internal IDs surfaced (D-08).

## Self-Check: PASSED

- `src/hooks/useKgDiff.ts` — FOUND
- `src/hooks/useKgDiff.test.ts` — FOUND
- `src/components/kg/KGDiffControls.tsx` — FOUND
- `src/components/kg/KGControls.tsx` contains `temporalSubMode` — FOUND
- `src/components/kg/KGControls.tsx` contains `KGDiffControls` import — FOUND
- `src/pages/KnowledgeGraph.tsx` contains `paintNodeDiff` — FOUND
- `src/pages/KnowledgeGraph.tsx` contains `temporalSubMode === "diff"` — FOUND
- `src/pages/KnowledgeGraph.tsx` contains `globalAlpha = 0.35` — FOUND (Pitfall 3)
- `src/pages/KnowledgeGraph.tsx` contains DIFF legend conditional — FOUND
- Point sub-mode path uses original `paintNode`/`linkColorFn` — CONFIRMED (source regression assertion)
- Commit `ec7bb98` — FOUND
- Commit `65124ba` — FOUND
- Commit `ca7a9a2` — FOUND
- useKgDiff tests 12/12 green — CONFIRMED
- KGControls tests 23/23 green — CONFIRMED
- `npx tsc --noEmit` clean — CONFIRMED
