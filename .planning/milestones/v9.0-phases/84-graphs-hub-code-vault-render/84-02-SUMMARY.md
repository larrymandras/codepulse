---
phase: 84
plan: 02
subsystem: graphs-hub
tags: [component, force-graph, dual-palette, filter, detail-panel, fullscreen, tdd, GH-02]
requires: [useProjectGraph hook (84-01), projectGraphFixture (84-01), ForceGraphCanvas, api.graphSnapshots.getProjectGraph]
provides: [CodeVaultGraph component, GH-02 behaviors green]
affects: [src/components/graph/, src/pages/]
tech_stack_added: []
tech_stack_patterns:
  - dual-palette colorFn by node.source prefix (graphify:* → emerald, vault:* → violet)
  - client-side source filter with dangling-link drop via keptIds Set
  - three-state Convex hook branching (undefined/null/object)
  - paintNode selection ring keyed on selectedNodeId via useCallback closure
  - explicit className prop to ForceGraphCanvas for fullscreen height switch (Pitfall 6)
  - generatedAt * 1000 seconds-to-ms conversion (Pitfall 4)
  - vi.mock ForceGraphCanvas to capture colorFn/onNodeClick props for assertion
key_files_created:
  - src/components/graph/CodeVaultGraph.tsx
key_files_modified:
  - src/components/graph/CodeVaultGraph.test.tsx
decisions:
  - "Split stale and integrity 'negative case' assertions into separate it() blocks to avoid DOM leakage across renders in a single test"
  - "Captured colorFn via module-level lastForceGraphProps variable in the ForceGraphCanvas mock — allows Test 9 to call it directly without reaching into component internals"
  - "act() wrapping for onNodeClick state update in Test 8 — React update must be wrapped to suppress act() warning"
  - "GraphContent extracted as a sub-component to keep CodeVaultGraph top-level branching clean (undefined/null/object) without conditional hook calls"
metrics:
  duration_minutes: 18
  completed_date: "2026-06-22"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 1
---

# Phase 84 Plan 02: CodeVaultGraph — Dual-Palette Code/Vault Force Graph Summary

**One-liner:** CodeVaultGraph renders the code/vault snapshot via ForceGraphCanvas with emerald/violet colorFn, Code/Vault/Both client-side filter (no dangling links), truncation X-of-Y header, stale badge (generatedAt-seconds conversion), integrity warning (gated by storedNodeCount < nodeCount), and a node-click detail panel with neighbors.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | CodeVaultGraph — palette, filter, states, ForceGraphCanvas integration | 7adc879 | src/components/graph/CodeVaultGraph.tsx (created, 536 lines), src/components/graph/CodeVaultGraph.test.tsx (filled, 11 tests) |

## What Was Built

### `CodeVaultGraph` component (`src/components/graph/CodeVaultGraph.tsx`)

536-line component. Calls `useProjectGraph()` and branches on three states:

- `undefined` → loading pulse: `h-[600px] flex items-center justify-center` with `animate-pulse` text "Loading graph snapshot…" — matches KnowledgeGraph.tsx L217-219 pattern
- `null` → D-12 explainer: Network icon + "No graph snapshot received yet" + nightly-cron body
- `object` → `GraphContent` sub-component (all interactive logic)

**Module-level constants:**
- `CODE_COLOR = "#10b981"` (Matrix Emerald — graphify:* nodes)
- `VAULT_COLOR = "#8b5cf6"` (Violet-500 — vault:* nodes)
- `STALE_THRESHOLD_MS = 36 * 60 * 60 * 1000` (36h)

**colorFn:** `node.source?.startsWith("vault:")` → VAULT_COLOR, else CODE_COLOR.

**labelFn:** `` `${node.label} · ${node.type} · ${node.source}` `` (D-11).

**Source filter (D-06):** `useState<"code"|"vault"|"both">("both")`. `filteredData` in `useMemo([snapshot, sourceFilter])` — filters nodes by source prefix, then drops links whose source/target id is not in the keptIds Set (Pitfall 3 — no dangling links).

**Freshness (D-09):** `ageMs = Date.now() - snapshot.generatedAt * 1000` (Pitfall 4 — seconds conversion). Stale when `ageMs > STALE_THRESHOLD_MS`. Amber "stale" Badge with `aria-label`.

**Integrity warning (D-08):** `hasIntegrityWarning = storedNodeCount < nodeCount || storedLinkCount < linkCount`. Renders the red banner (KnowledgeGraph L159-170 styling + AlertTriangle) only when true; silent when counts match.

**Truncation header (D-07):** "Showing {filteredData.nodes.length} of {snapshot.nodeCount} nodes" + `snapshot.sources.map()` with `sourceLabel()` helper stripping `graphify:` → repo segment and `vault:` → "vault". "truncated" Badge (amber) when `src.truncated === true`.

**Filter chips (D-06):** `role="group"` + `aria-pressed` per chip. Active: `bg-primary/10 text-primary border-primary/40`. Inactive: transparent/muted.

**Detail panel (D-10):** `useState<string|null>(selectedNodeId)`. Grid `grid-cols-1 lg:grid-cols-[1fr_320px]` only when node selected. Panel shows 6 fields in locked order: id (mono truncate + title), label (bold), type (Badge), source (emerald/violet pill), community (with "—" fallback), neighbors (clickable list, ScrollArea if > 8). Close X has `aria-label="Close node details"`. Background click clears via `onBackgroundClick`.

**paintNode:** Selection ring (`size + 3` arc, strokeStyle = node color, lineWidth 1.5) keyed on `[selectedNodeId]` via `useCallback`. Glow on hover/select. Label at zoom > 1.3 or hover.

**Legend:** Absolute overlay `top-3 left-3 z-10` (bg-card/70 backdrop-blur) — two fixed entries Code/Vault.

**Fullscreen (D-03):** `useState<boolean>(fullscreen)`. When true: container `fixed inset-0 z-50 bg-[#09090b]`, canvas `h-[calc(100vh-48px)]`. ESC `useEffect` with cleanup (no `stopPropagation` — Pitfall 5). Maximize2/Minimize2 ghost icon Button with Tooltip. `className` always passed explicitly to ForceGraphCanvas (Pitfall 6).

**linkColorFn:** Vault-to-vault → violet 0.18α; code-to-code → emerald 0.18α; cross-source → white 0.08α.

### Test coverage (`src/components/graph/CodeVaultGraph.test.tsx`)

11 tests (9 original GH-02 behaviors + 2 split negative cases):

1. Render with data — canvas, legend, truncation header
2. Loading state on undefined — pulse text, no canvas
3. Empty state on null — D-12 explainer, no canvas
4. Source filter "code" — vault nodes dropped, no dangling links, node-count attribute verified
5. Truncation header — "X of Y nodes" + per-source chip + "truncated" badge
6. Stale badge — renders when generatedAt 48h ago (positive case)
7. Fresh — no stale badge (negative split)
8. Integrity warning — renders when storedNodeCount < nodeCount (positive)
9. No integrity warning — clean fixture suppresses banner (negative split)
10. Detail panel — node click opens panel; id/label/type/source/community/neighbors present; close X works
11. colorFn — captured from ForceGraphCanvas mock props; returns `#10b981` for graphify and `#8b5cf6` for vault

## Verification

```
npx vitest run src/components/graph/CodeVaultGraph.test.tsx src/hooks/useProjectGraph.test.ts
→ 16 passed | 0 failed

npm test
→ 113 test files passed | 0 failed (1120 tests)

npx tsc --noEmit
→ clean (no errors)
```

## Deviations from Plan

**1. [Rule 2 - Missing functionality] Split stale/integrity negative cases into separate tests**

The plan listed 9 `it.todo` behaviors. Tests 6 and 7 were originally written as single tests asserting both the positive (badge appears) and negative (badge absent) cases in one `it()` block, relying on a second render within the same test. DOM leakage from the first render caused the negative assertion to find the badge from the prior render. The fix: split each into two named `it()` blocks (positive + negative). This results in 11 tests total instead of 9. All 9 original behavioral descriptions are still covered; the extras are the complementary negative cases (no regression on "correct suppression" behavior).

**2. [Rule 1 - Bug] act() wrapping for node click in Test 8**

The plan's action specified calling `onNodeClick` directly on the captured prop. React 19 requires state updates in tests to be wrapped in `act()`. Added `act(() => { lastForceGraphProps.onNodeClick(nodeA); })` to suppress the warning and ensure the state update is flushed before assertions run.

**3. [Rule 3 - Blocking] afterEach cleanup**

Added `afterEach(() => { cleanup(); })` to ensure DOM is fully cleared between tests. Required for correctness when multiple renders of the same component are used across separate tests in the same describe block.

## Known Stubs

None — the component renders real data from the fixture in tests and will render real Convex data in production. No placeholder text that blocks the GH-02 goal flows to UI rendering.

## Threat Flags

None — CodeVaultGraph is a read-only client-side component consuming the existing public `getProjectGraph` query (T-84-02: accepted in plan threat model). No new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check: PASSED

- [x] src/components/graph/CodeVaultGraph.tsx — exists (536 lines), contains `CODE_COLOR = "#10b981"`, `VAULT_COLOR = "#8b5cf6"`, `36 * 60 * 60 * 1000`, `node.source?.startsWith("vault:")`, `snapshot.generatedAt * 1000`, `<ForceGraphCanvas` with explicit `className=`, `colorFn`, `labelFn`, `onNodeClick`, `aria-label="Close node details"`, `role="group"` + `aria-pressed`, `storedNodeCount < snapshot.nodeCount` integrity gate
- [x] src/components/graph/CodeVaultGraph.test.tsx — exists, 11 tests (no it.todo remaining for the 9 GH-02 behaviors), all pass
- [x] Commit 7adc879 present in git log
- [x] `npx vitest run src/components/graph/CodeVaultGraph.test.tsx src/hooks/useProjectGraph.test.ts` → 16 passed
- [x] `npm test` → 113 test files passed, 0 failed
- [x] `npx tsc --noEmit` → clean
