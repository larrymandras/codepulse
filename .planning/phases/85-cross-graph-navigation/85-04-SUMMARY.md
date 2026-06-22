---
phase: 85-cross-graph-navigation
plan: "04"
subsystem: navigation
tags: [deep-link, url-params, focus, cross-graph, react-router, knowledge-graph, entity-lens, return-chip]
dependency_graph:
  requires:
    - src/lib/focus-url.ts (decodeFromParam, Plan 01)
    - src/hooks/useFocusParam.ts (Plan 01)
    - src/hooks/useKnowledgeGraph.ts (setLens, setFilter, selectNode)
  provides:
    - src/pages/KnowledgeGraph.tsx (inbound entity-lens focus handling + return chip)
    - src/components/kg/KGDetailsPanel.tsx (returnTo/returnLabel/onReturnNav props + chip render)
  affects:
    - CodeVaultGraph agent→KG jump (Plan 03 forward link lands here)
    - Phase 86 (KG surface established as focus destination)
tech_stack:
  added: []
  patterns:
    - hydratedRef + appliedFocusRef one-shot guard for post-idb-hydration override
    - useFocusParam with getId: n => n.name for name-driven KG entity match
    - PanelShell returnTo prop propagation pattern for return chip in all panel states
    - SectionErrorBoundary wrapping return chip for isolation
key_files:
  created: []
  modified:
    - src/pages/KnowledgeGraph.tsx
    - src/components/kg/KGDetailsPanel.tsx
decisions:
  - "hydratedRef tracks first kg.loading===false transition rather than exposing internal hydrated state from useKnowledgeGraph — keeps hook interface minimal while satisfying the post-hydration ordering requirement"
  - "useFocusParam nodes gated on focusEntity presence (nodes: focusEntity ? kg.graph.nodes : undefined) so the hook stays a no-op on direct nav without a focus param"
  - "Return chip rendered in all KGDetailsPanel branches (node, edge, not-in-view, no-selection) so the chip is always reachable when ?from is present — critical for SC#3 not-found arrival"
  - "onReturnNav injected as prop (not using useNavigate inside KGDetailsPanel directly) to keep the panel presentational and avoid coupling it to router context"
  - "No 'RELATED ACROSS GRAPHS' section added — KG is destination-only this phase (D-03)"
metrics:
  duration: "~18 minutes"
  completed: "2026-06-22"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 2
  tests_added: 0
---

# Phase 85 Plan 04: KnowledgeGraph Destination Wiring Summary

**One-liner:** KnowledgeGraph wired as cross-graph focus destination — inbound ?focus=entity&lens=entity&hops=1 applies entity-lens override after idb hydration (one-shot), centers the resolved node, and renders a "Back to {Surface}" return chip via KGDetailsPanel when ?from is present.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Inbound entity-lens override (post-hydration) + center the focused entity | 1372f15 | src/pages/KnowledgeGraph.tsx |
| 2 | Return chip in KGDetailsPanel | 425b345 | src/components/kg/KGDetailsPanel.tsx |

## What Was Built

### Task 1: `src/pages/KnowledgeGraph.tsx`

- Added `useSearchParams` + `useNavigate` from react-router-dom; `ChevronLeft` from lucide-react; `useFocusParam` from the Plan 01 hook
- Reads `?focus`, `?lens`, `?hops` params directly via `useSearchParams`
- Two-ref idb-hydration guard:
  - `hydratedRef` — set true on first `kg.loading === false` observation (idb restore complete)
  - `appliedFocusRef` — one-shot guard ensures the override fires exactly once
  - Override effect: gates on `hydratedRef.current` to ensure saved-state restore cannot clobber the inbound entity-lens, then calls `setLens("entity")` + `setFilter("entityName", focusEntity)` + `setFilter("hops", hopsParam || 1)` to trigger the name-driven entity fetch
- `useFocusParam({ nodes: focusEntity ? kg.graph.nodes : undefined, getId: n => n.name, onFocus })` — matches entity by name, calls `kg.selectNode(node.id)` + `fgRef.current?.centerAt(x, y, 800)` + `fgRef.current?.zoom(3, 800)` once the entity node appears
- Silent no-op when entity not found (SC#3) — useFocusParam's built-in absent-node no-op
- Derives `returnLabel` from `fromParam` path segment: `/tool-galaxy` → "Tool Galaxy", `/graphs` → "Code/Vault Graph", `/knowledge-graph` → "KG Explorer", else "previous graph"
- No "RELATED ACROSS GRAPHS" section (KG is destination-only, D-03)

### Task 2: `src/components/kg/KGDetailsPanel.tsx`

- Added `returnTo?: string | null`, `returnLabel?: string | null`, `onReturnNav?: (url: string) => void` to `KGDetailsPanelProps`
- `PanelShell` renders a return chip above the panel title when `returnTo && onReturnNav`: `<button>` with `ChevronLeft`, copy `"Back to {label}"`, classes `inline-flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground border-l-2 border-primary/40 pl-2 py-1.5 hover:border-primary/70 transition-colors duration-200`, `aria-label="Return to {label}"`, wrapped in `<SectionErrorBoundary name="Return navigation">`
- All `PanelShell` call sites pass `returnTo` / `returnLabel` / `onReturnNav` through (node, edge, "entity not in view", "edge not in view")
- No-selection state: when `returnTo` is set but no node is selected (not-found arrival), mounts a panel variant with the chip + placeholder text so the return affordance is always reachable regardless of entity resolution
- Chip absent without `?from` (standard direct nav)

## Deviations from Plan

### Auto-fixed Issues

None.

### Rule 2 — Missing critical functionality applied

**Return chip in no-selection panel state**
- **Found during:** Task 2 implementation
- **Issue:** The plan specified "keep the panel mounted when `returnTo` is set" so the chip remains reachable on not-found arrival. The existing no-selection branch returned a simple `<div>` without using `PanelShell`, so the chip would be absent when an unresolved entity left the panel in the placeholder state.
- **Fix:** Added a `returnTo && onReturnNav` guard in the no-selection branch that renders a panel variant with the return chip + placeholder copy (same chip styles as PanelShell). Existing no-selection behavior (no `?from`) is unchanged.
- **Files modified:** src/components/kg/KGDetailsPanel.tsx

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced.

**T-85-01 (open-redirect):** Return chip navigates via `onReturnNav(returnTo)` where `returnTo` is the `fromParam` returned by `useFocusParam` — already guarded through `decodeFromParam` (same-origin-path guard, Plan 01). Raw `searchParams.get("from")` is never used as a navigate target.

**T-85-08 (filter injection):** `focusEntity` flows to `setFilter("entityName", ...)` — same path as the KG search box; no new sink. `hopsParam` coerced via `Number(...) || 1` (NaN defaults to 1); no string interpolated into DOM/HTML.

**T-85-05 (XSS via entity name):** Entity name and focus param are React text children (auto-escaped); no `dangerouslySetInnerHTML`.

## Known Stubs

None. Both modules are fully implemented.

## Self-Check: PASSED

- [x] src/pages/KnowledgeGraph.tsx — reads `searchParams.get("focus")`, contains `kg.setLens("entity")`, `kg.setFilter("entityName"`, `appliedFocusRef`, `hydratedRef`-style guard, `useFocusParam(` with `getId` returning `n.name`, `kg.selectNode(`, `fgRef.current?.centerAt(`, no "RELATED ACROSS GRAPHS" string
- [x] src/components/kg/KGDetailsPanel.tsx — KGDetailsPanel renders chip gated on `returnTo &&`, uses `ChevronLeft`, copy `Back to `, `border-l-2 border-primary/40`, `aria-label` starting `Return to `, `navigate(` via `onReturnNav`, chip wrapped in `<SectionErrorBoundary`
- [x] Commit 1372f15 (Task 1) — verified in git log
- [x] Commit 425b345 (Task 2) — verified in git log
- [x] `npx tsc --noEmit` exits 0
