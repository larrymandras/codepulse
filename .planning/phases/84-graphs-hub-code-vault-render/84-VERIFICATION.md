---
phase: 84-graphs-hub-code-vault-render
verified: 2026-06-22T00:00:00Z
status: human_needed
score: 7/7 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Navigate to /graphs in npm run dev; click Graphs Hub in the sidebar"
    expected: "Page loads at /graphs; three MetricCard tiles (TOOL GALAXY, MCP INVENTORY, KG EXPLORER) render above the CodeVaultGraph hero; no console errors"
    why_human: "Route rendering, nav click, and Convex live-data plumbing cannot be verified in jsdom"
  - test: "With a live deployment, verify CommandPalette (Ctrl+K) lists 'Graphs Hub'"
    expected: "Graphs Hub appears in the command palette because the navItems auto-exclude no longer filters the entry (placeholder was removed)"
    why_human: "CommandPalette registration happens at runtime from the navItems export; cannot assert in unit tests"
  - test: "Click each summary tile (TOOL GALAXY, MCP INVENTORY, KG EXPLORER)"
    expected: "Each click navigates to /tool-galaxy, /mcp-inventory, /knowledge-graph respectively"
    why_human: "useNavigate routing in a real browser is not covered by the jsdom test (those tests mock useNavigate)"
  - test: "With a live snapshot in Convex: verify the code/vault force graph renders emerald nodes for graphify sources and violet nodes for vault sources"
    expected: "colorFn returns #10b981 for graphify:* nodes and #8b5cf6 for vault:* nodes; graph is visible on canvas"
    why_human: "ForceGraphCanvas renders on an HTML5 canvas; canvas content cannot be asserted in jsdom tests"
  - test: "With a snapshot older than 36 hours: verify the 'stale' amber badge appears in the header row"
    expected: "Badge with text 'stale' and aria-label 'Graph snapshot is stale — last updated Xh ago' is visible"
    why_human: "Integration with live generatedAt time from Convex; visual badge rendering requires a real browser"
  - test: "Click a graph node in the /graphs hero; verify the detail panel opens with id, label, type, source, community, and neighbors"
    expected: "Node details panel appears on the right; Close X button (aria-label='Close node details') dismisses it; background click also dismisses"
    why_human: "Canvas onNodeClick interaction requires a running force simulation; not testable in jsdom"
  - test: "Press Escape while graph is in fullscreen mode"
    expected: "Fullscreen overlay (fixed inset-0 z-50) collapses back to normal 600px height"
    why_human: "Window keydown ESC handler + CSS class toggling requires a real browser"
---

# Phase 84: Graphs Hub + Code/Vault Render Verification Report

**Phase Goal:** The code and vault graph from Convex is visible in the UI, and all graph surfaces are reachable from one unified hub.
**Verified:** 2026-06-22
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | useProjectGraph returns undefined while Convex loads, null when no snapshot, the data object once a snapshot exists | VERIFIED | `src/hooks/useProjectGraph.ts:23-27` — raw `useQuery` return, no coercion; confirmed no `?? null` / `?? []` present |
| 2 | A reusable fixture matching the getProjectGraph return shape is available to all three Phase 84 test files | VERIFIED | `src/test/projectGraphFixture.ts` — exports `makeProjectGraphFixture` with `storedNodeCount`, `generatedAt`, `vault:`, `graphify:codepulse:` nodes; `mockGetProjectGraph` helper present |
| 3 | CodeVaultGraph renders via ForceGraphCanvas with code nodes emerald and vault nodes violet | VERIFIED | `src/components/graph/CodeVaultGraph.tsx:47-48,84-86` — `CODE_COLOR="#10b981"`, `VAULT_COLOR="#8b5cf6"`, `colorFn` checks `node.source?.startsWith("vault:")` |
| 4 | Code/Vault/Both filter narrows the rendered set client-side with no reload and never leaves dangling links | VERIFIED | `CodeVaultGraph.tsx:128-142` — `useMemo` filter drops nodes by source prefix then rebuilds links via `keptIds` Set |
| 5 | Truncation header, stale badge, and integrity warning are gated correctly | VERIFIED | `CodeVaultGraph.tsx:145-158,248-285,339-348` — freshness uses `generatedAt * 1000` (seconds conversion); integrity gate is `droppedNodeCount > 0 \|\| droppedLinkCount > 0`; header shows "Showing N of M nodes" |
| 6 | Navigating to /graphs renders three live summary tiles above the code/vault hero | VERIFIED | `src/pages/GraphsHub.tsx:107-124` — three tile sub-components + `<CodeVaultGraph />` inside `SectionErrorBoundary` + `GlassPanel` |
| 7 | The Graphs Hub nav entry routes to /graphs and is no longer a placeholder stub | VERIFIED | `src/layouts/DashboardLayout.tsx:156` — `{ to: "/graphs", label: "Graphs Hub", icon: "network", group: "GRAPHS" }` with no `placeholder: true`; `src/App.tsx:74,122` — lazy import and `path="/graphs"` route registered |

**Score:** 7/7 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/hooks/useProjectGraph.ts` | Thin useQuery wrapper; ProjectGraphData type export | VERIFIED | 28 lines; exports `useProjectGraph` and `ProjectGraphData`; `useQuery(api.graphSnapshots.getProjectGraph,...)` at line 24 |
| `src/test/projectGraphFixture.ts` | Faithfully-shaped fixture + mockGetProjectGraph | VERIFIED | 183 lines; `makeProjectGraphFixture`, `mockGetProjectGraph`, all required fields present |
| `src/components/graph/CodeVaultGraph.tsx` | Dual-palette graph with filter/truncation/freshness/integrity/detail panel; min 150 lines | VERIFIED | 547 lines; all required patterns substantiated with file:line references |
| `src/pages/GraphsHub.tsx` | Route page: tile row + CodeVaultGraph hero; min 60 lines | VERIFIED | 127 lines; contains `<CodeVaultGraph`, three `MetricCard` tiles, `SectionErrorBoundary` wrappers |
| `src/App.tsx` | Lazy /graphs route | VERIFIED | Line 74: `const GraphsHub = lazy(() => import("./pages/GraphsHub"))`. Line 122: `<Route path="/graphs" ...>` (first in GRAPHS cluster) |
| `src/layouts/DashboardLayout.tsx` | Real Graphs Hub nav entry (placeholder flipped) | VERIFIED | Line 156: `{ to: "/graphs", label: "Graphs Hub", icon: "network", group: "GRAPHS" }`. `iconComponents["network"] = Network` at line 105. No `placeholder: true` on this entry. |

---

### Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `useProjectGraph.ts` | `api.graphSnapshots.getProjectGraph` | `useQuery` | WIRED | Line 24: `useQuery(api.graphSnapshots.getProjectGraph, ...)` |
| `CodeVaultGraph.tsx` | `useProjectGraph` | hook call | WIRED | Line 35 import; line 512 call `useProjectGraph()` |
| `CodeVaultGraph.tsx` | `ForceGraphCanvas` | `data + colorFn + labelFn + onNodeClick + explicit className` | WIRED | Lines 377-386: `<ForceGraphCanvas data={filteredData} colorFn={colorFn} labelFn={labelFn} ... className={canvasClass} />` |
| `GraphsHub.tsx` | `CodeVaultGraph` | hero composition inside SectionErrorBoundary + GlassPanel | WIRED | Lines 20 (import), 122: `<CodeVaultGraph />` |
| `GraphsHub.tsx` | `useToolGalaxySources / useMcpHealthSources / useKgSummary` | tile metric derivation | WIRED | Lines 21-23 imports; lines 33, 60, 76 hook calls; `useKgSummary()` at line 76 |
| `App.tsx` | `GraphsHub` | lazy route `/graphs` | WIRED | Line 74 lazy import; line 122 `path="/graphs"` route |
| `DashboardLayout.tsx` | `/graphs` | nav entry (placeholder flipped) | WIRED | Line 156: `to: "/graphs"` present; `placeholder: true` absent on this entry |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `CodeVaultGraph.tsx` | `snapshot` (return of `useProjectGraph()`) | `useQuery(api.graphSnapshots.getProjectGraph)` → Convex `graphSnapshots` table | Yes — production Convex query (Phase 83 established the table and handler) | FLOWING (by construction; null/loading states explicitly handled) |
| `GraphsHub.tsx` (ToolGalaxyTile) | `stats.toolCount`, `stats.orphanCount` | `useToolGalaxySources()` → Convex hooks; `buildGalaxy()` in `useMemo` | Yes — reads live Convex data | FLOWING |
| `GraphsHub.tsx` (McpInventoryTile) | `serverCount`, `errorCount` | `useMcpHealthSources()` → `mcpServers` array | Yes — reads live Convex data | FLOWING |
| `GraphsHub.tsx` (KgExplorerTile) | `summary?.totalEntities`, `summary?.currentTripleCount` | `useKgSummary()` → Convex | Yes — reads live Convex data | FLOWING |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| GH-02 | 84-02-PLAN.md | `/graphs` landing route renders code + vault graph via `useQuery` + `ForceGraphCanvas`, truncation indicated | SATISFIED | `CodeVaultGraph.tsx` substantively implements all GH-02 behaviors; 11 automated tests pass |
| GH-03 | 84-03-PLAN.md | All four graph surfaces reachable from one unified hub; `placeholder:true` nav stub replaced | SATISFIED | `GraphsHub.tsx` composes all four surfaces; `DashboardLayout.tsx` line 156 is a live `to:"/graphs"` route; `App.tsx` line 122 registers `/graphs` |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

Scanned: `CodeVaultGraph.tsx`, `GraphsHub.tsx`, `useProjectGraph.ts`, `projectGraphFixture.ts`, `App.tsx`, `DashboardLayout.tsx`. No TBD/FIXME/XXX markers, no empty return stubs, no hardcoded-empty data props in rendering paths.

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — a live Convex backend and running Vite dev server are required for runnable spot-checks. The test suite (1125 tests, 0 failures as stated in the prompt) covers the functional behaviors that can be asserted in jsdom.

---

### Human Verification Required

The automated evidence confirms every structural and behavioral requirement is implemented. The following checks require a real browser + running dev server because they involve canvas rendering, router navigation, live Convex subscriptions, or window keyboard events.

#### 1. /graphs route loads with three tiles and hero

**Test:** `npm run dev` → click "Graphs Hub" in the sidebar nav
**Expected:** Route navigates to `/graphs`; page renders the GRAPHS HUB header, three MetricCard tiles, and the CodeVaultGraph hero (loading pulse or data or D-12 explainer depending on Convex state); no console errors
**Why human:** Route rendering, Convex subscription, and MetricCard live values require a real browser

#### 2. CommandPalette auto-registration

**Test:** Open CommandPalette (Ctrl+K) on any page
**Expected:** "Graphs Hub" appears in the palette (the navItems auto-exclude no longer filters it out because `placeholder: true` was removed)
**Why human:** CommandPalette population is runtime behavior driven by the `navItems` export

#### 3. Tile click-through navigation

**Test:** On `/graphs`, click each of the three MetricCard tiles
**Expected:** TOOL GALAXY → `/tool-galaxy`; MCP INVENTORY → `/mcp-inventory`; KG EXPLORER → `/knowledge-graph`
**Why human:** `useNavigate` is mocked in jsdom tests; actual router navigation requires a browser

#### 4. CodeVaultGraph canvas renders with emerald/violet palette

**Test:** With a live Convex deployment that has a graph snapshot, open `/graphs`
**Expected:** Force graph canvas appears; graphify nodes are emerald (#10b981); vault nodes are violet (#8b5cf6); legend overlay shows Code / Vault entries
**Why human:** Canvas rendering requires a real browser; colorFn was verified in unit tests but visual output cannot be asserted in jsdom

#### 5. Stale badge (live time-based)

**Test:** With a graph snapshot older than 36 hours in Convex, open `/graphs`
**Expected:** Amber "stale" badge appears in the header row with the age string (e.g. "Updated 2d ago")
**Why human:** Depends on real `generatedAt` from Convex + `Date.now()` wall-clock comparison

#### 6. Node click — detail panel

**Test:** Click a node on the force graph
**Expected:** Detail panel appears on the right; shows id, label, type, source (color pill), community (or "—"), neighbors list; clicking X or the background closes it
**Why human:** Canvas `onNodeClick` fires from a running force simulation; not reproducible in jsdom

#### 7. Fullscreen ESC exit

**Test:** Click Maximize2 button on the graph → press Escape
**Expected:** Graph exits fullscreen (fixed overlay collapses back to 600px height)
**Why human:** `window.addEventListener("keydown", ...)` + CSS class toggle requires a real browser

---

### Gaps Summary

No automated gaps found. All 7 must-have truths are VERIFIED with file:line evidence. All required artifacts exist at substantive line counts (useProjectGraph: 28 lines, CodeVaultGraph: 547 lines, GraphsHub: 127 lines). All key links are wired. No debt markers or stub patterns detected.

Status is `human_needed` because 7 behavioral items require a running dev environment (canvas rendering, router navigation, live Convex data, keyboard events) — standard for any phase that ships a force-graph page with real-time subscriptions.

---

_Verified: 2026-06-22_
_Verifier: Claude (gsd-verifier)_
