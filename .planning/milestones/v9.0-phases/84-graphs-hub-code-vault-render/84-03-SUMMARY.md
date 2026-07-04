---
phase: 84
plan: 03
subsystem: graphs-hub
tags: [page, composition, route, nav, tdd, GH-03]
requires: [CodeVaultGraph (84-02), useToolGalaxySources, useMcpHealthSources, useKgSummary, MetricCard, SectionErrorBoundary, GlassPanel]
provides: [GraphsHub page, /graphs route, Graphs Hub nav entry (live)]
affects: [src/pages/, src/App.tsx, src/layouts/DashboardLayout.tsx]
tech_stack_added: []
tech_stack_patterns:
  - tile sub-components (one hook + MetricCard per function component) to keep SectionErrorBoundary scopes self-contained
  - buildGalaxy() called in useMemo for authoritative orphanCount (Pitfall 1 pattern)
  - mcpServers.filter(s => s.status === "error") for errorCount (no buildMcpHealth needed)
  - CodeVaultGraph mounted as named export (default also exists)
  - lazy route added first in GRAPHS cluster in App.tsx
  - navItems placeholder flip auto-registers route in CommandPalette
key_files_created:
  - src/pages/GraphsHub.tsx
key_files_modified:
  - src/pages/GraphsHub.test.tsx
  - src/App.tsx
  - src/layouts/DashboardLayout.tsx
decisions:
  - "Tile sub-components (ToolGalaxyTile, McpInventoryTile, KgExplorerTile) extracted from the page to scope each hook + SectionErrorBoundary independently — keeps page body thin per HivePage pattern"
  - "Used mcpServers.filter(s => s.status === 'error').length for errorCount rather than calling buildMcpHealth() — simpler, no extra import, correct for the tile display"
  - "Tests click via .closest('.glow-card') — MetricCard renders a div.glow-card with the onClick; this avoids fragile child-element click routing without adding data-testid to MetricCard"
metrics:
  duration_minutes: 10
  completed_date: "2026-06-22"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 3
---

# Phase 84 Plan 03: Graphs Hub Assembly — Route + Nav + Page Summary

**One-liner:** GraphsHub page mounts three live summary tiles (Tool Galaxy, MCP Inventory, KG Explorer) above the CodeVaultGraph hero at /graphs, with the Graphs Hub nav entry flipped from placeholder to live link auto-registering in the CommandPalette.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | GraphsHub test scaffold — failing tests for GH-03 tile render + click navigation | 85e1a7f | src/pages/GraphsHub.test.tsx |
| 1 (GREEN) | GraphsHub page — three live summary tiles + CodeVaultGraph hero | 9a88275 | src/pages/GraphsHub.tsx (created, 127 lines), src/pages/GraphsHub.test.tsx (filled, 4 tests) |
| 2 | Wire /graphs route + flip the nav placeholder | 28f8dbe | src/App.tsx, src/layouts/DashboardLayout.tsx |

## What Was Built

### `GraphsHub` page (`src/pages/GraphsHub.tsx`)

127-line thin-composition page. Three tile sub-components (each hooks into its domain, wrapped in its own SectionErrorBoundary) above the CodeVaultGraph hero (wrapped in SectionErrorBoundary + GlassPanel).

**Tile sub-components:**
- `ToolGalaxyTile` — calls `useToolGalaxySources()` + `buildGalaxy({...}).stats` via `useMemo` → `stats.toolCount` / `stats.orphanCount` → value string `"{toolCount} tools · {orphanCount} orphans"`. onClick → `navigate("/tool-galaxy")`.
- `McpInventoryTile` — calls `useMcpHealthSources()` → `mcpServers.length` / `mcpServers.filter(s => s.status === "error").length` → `"{serverCount} servers · {errorCount} errors"`. onClick → `navigate("/mcp-inventory")`.
- `KgExplorerTile` — calls `useKgSummary()` → `summary?.totalEntities ?? 0` / `summary?.currentTripleCount ?? 0` → `"{entities} entities · {triples} triples"`. onClick → `navigate("/knowledge-graph")`.

**Page structure:**
- Header: H1 `text-[10px] font-mono uppercase tracking-widest font-bold text-primary` with Network icon (h-5 w-5) and InfoTooltip.
- Tile row: `grid grid-cols-1 md:grid-cols-3 gap-4` — each tile in its own `SectionErrorBoundary`.
- Hero: `SectionErrorBoundary name="Code/Vault Graph"` → `GlassPanel className="rounded-xl"` → `<CodeVaultGraph />`.

**D-12 compliance:** Summary tiles use independent hooks; none depend on the graph snapshot state. Hero renders null/loading/data states via CodeVaultGraph's own branching.

### Route + Nav wiring (`src/App.tsx`, `src/layouts/DashboardLayout.tsx`)

`App.tsx`: Added `const GraphsHub = lazy(() => import("./pages/GraphsHub"))` (Phase 84 comment) and `<Route path="/graphs" ...>` as the first entry in the GRAPHS cluster (before `/tool-galaxy`).

`DashboardLayout.tsx`: Changed `{ label: "Graphs Hub", icon: "network", group: "GRAPHS", placeholder: true }` to `{ to: "/graphs", label: "Graphs Hub", icon: "network", group: "GRAPHS" }`. The `navItems` auto-exclude (checks `placeholder: true` || `!item.to`) now includes this entry — the route is automatically registered in the CommandPalette with no further edit. `iconComponents["network"] = Network` already present at line 105.

### Test coverage (`src/pages/GraphsHub.test.tsx`)

4 tests (converted from 4 `it.todo` Wave 0 scaffolds):
1. Renders three MetricCard tiles: TOOL GALAXY, MCP INVENTORY, KG EXPLORER
2. Clicking TOOL GALAXY navigates to `/tool-galaxy`
3. Clicking MCP INVENTORY navigates to `/mcp-inventory`
4. Clicking KG EXPLORER navigates to `/knowledge-graph`

## Verification

```
npx vitest run src/pages/GraphsHub.test.tsx
→ 4 passed | 0 failed (0 it.todo remaining)

npx tsc --noEmit
→ clean (no errors)

npm test
→ 114 test files passed | 0 failed (1124 tests, 187 todo)

npm run build
→ ✓ built in 11.61s (all chunks resolved, GraphsHub lazy chunk emitted)
```

## Deviations from Plan

None — plan executed exactly as written.

The plan specified `buildGalaxy()` for Tool Galaxy tile counts (authoritative `stats.toolCount`/`stats.orphanCount`) and `mcpServers.length` + `mcpServers.filter(s => s.status === "error").length` for MCP Inventory counts. Both match the Pitfall 1 guidance and the plan's `<action>` text.

Test click strategy: The plan's `<behavior>` required "clicking each tile triggers navigation." MetricCard renders an `onClick` on a `div.glow-card`. Tests use `.closest(".glow-card")` to reach the clickable element — this is the correct idiom given MetricCard's internal structure and avoids requiring a `data-testid` on MetricCard (which would have changed a shared component out of this plan's scope).

## Known Stubs

None — all three tiles derive live counts from real Convex hooks. The MetricCard value strings will render `"0 tools · 0 orphans"` etc. when the underlying Convex queries have not resolved yet (loading state), which is correct and matches the UI-SPEC's "MetricCard renders with a numeric 0 while its hook is loading" guidance.

## Threat Flags

None — GraphsHub is a read-only composition of existing public Convex queries (useToolGalaxySources, useMcpHealthSources, useKgSummary, useProjectGraph via CodeVaultGraph). No new network endpoints, auth paths, file access patterns, or schema changes introduced. The nav flip exposes no new data class (T-84-04: accepted in plan threat model).

## Self-Check: PASSED

- [x] src/pages/GraphsHub.tsx — exists (127 lines), contains `<CodeVaultGraph`, `TOOL GALAXY`, `MCP INVENTORY`, `KG EXPLORER`, `navigate("/tool-galaxy")`, `navigate("/mcp-inventory")`, `navigate("/knowledge-graph")`, three `SectionErrorBoundary` tile wrappers, one `SectionErrorBoundary` + `GlassPanel` hero wrapper
- [x] src/pages/GraphsHub.test.tsx — exists, 4 tests (0 it.todo remaining), all pass
- [x] src/App.tsx — contains `lazy(() => import("./pages/GraphsHub"))` and `path="/graphs"`
- [x] src/layouts/DashboardLayout.tsx — GRAPHS group contains `to: "/graphs"` for "Graphs Hub", no `placeholder: true`
- [x] src/layouts/DashboardLayout.tsx — `iconComponents["network"]` = `Network` (line 105, pre-existing)
- [x] Commit 85e1a7f (RED), 9a88275 (GREEN), 28f8dbe (Task 2) all present in git log
- [x] `npx vitest run src/pages/GraphsHub.test.tsx` → 4 passed
- [x] `npm test` → 114 test files passed, 0 failed
- [x] `npx tsc --noEmit` → clean
- [x] `npm run build` → succeeded
