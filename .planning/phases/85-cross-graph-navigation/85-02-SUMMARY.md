---
phase: 85-cross-graph-navigation
plan: "02"
subsystem: navigation
tags: [cross-graph, deep-link, tool-galaxy, focus-param, return-chip, react-router]
dependency_graph:
  requires:
    - src/lib/focus-url.ts (Plan 01 — buildFocusUrl, focusKeysMatch)
    - src/hooks/useFocusParam.ts (Plan 01 — useFocusParam)
    - src/hooks/useProjectGraph.ts (Phase 83/84 — code/vault node data)
  provides:
    - src/pages/ToolGalaxy.tsx (selectedNodeId detail panel, RELATED ACROSS GRAPHS link, inbound focus, return chip)
  affects:
    - Plan 03 (CodeVaultGraph — receives ?focus=<id>&from=<galaxy-url> from Tool Galaxy outbound link)
    - Plan 04 (KnowledgeGraph — return chip pattern reused)
    - Phase 86 (search-to-focus targets /tool-galaxy?focus=<id>)
tech_stack:
  added: []
  patterns:
    - eager owning-agent match: focusKeysMatch(agentNode.name, codeVaultNode.label) — no fuzzy
    - RELATED ACROSS GRAPHS section conditionally absent (SC#3/D-04)
    - useFocusParam one-shot inbound focus — generic hook from Plan 01
    - return chip gated on fromParam (T-85-01 same-origin-guarded)
    - surfaceLabel() helper maps URL path prefix to friendly copy
key_files:
  created: []
  modified:
    - src/pages/ToolGalaxy.tsx
decisions:
  - "Both tasks committed in one atomic change — all new state (selectedNodeId, owningAgentName, ownerMatch, useFocusParam, fromParam) lives inside GalaxyCanvas; splitting across two commits would leave an intermediate broken state"
  - "Side-panel layout (grid-cols-[1fr_280px]) toggles only when selectedNodeId is set — canvas stays full-width on default load, matching existing behavior"
  - "node.x/node.y guard in onFocus callback (x != null) degrades gracefully when force layout hasn't placed the node yet — selection still opens the panel"
metrics:
  duration: "~18 minutes"
  completed: "2026-06-22"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 1
  tests_added: 0
---

# Phase 85 Plan 02: Tool Galaxy Cross-Graph Navigation Summary

**One-liner:** Tool Galaxy wired end-to-end for cross-graph navigation — selected tool nodes show an eager "Owning agent: {label} →" link (only when a confirmed code/vault match exists), inbound ?focus selects+centers the node on mount, and a same-origin-guarded return chip renders when ?from is present.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Selected-node detail panel + eager tool→agent RELATED ACROSS GRAPHS link | a6a6405 | src/pages/ToolGalaxy.tsx |
| 2 | Inbound focus param handling + return chip on Tool Galaxy | a6a6405 | src/pages/ToolGalaxy.tsx (same commit — same function, indivisible) |

## What Was Built

### Task 1: Detail panel + RELATED ACROSS GRAPHS link

Added to `GalaxyCanvas`:

- `selectedNodeId` state + `selectedNode` memo — clicking any node opens a side panel showing name/kind/call count
- `useProjectGraph()` loaded for code/vault nodes; `codeVaultNodes = projectGraph?.nodes ?? []` — empty while loading (link simply doesn't resolve until data arrives; SC#3 safe degrade)
- `owningAgentName` — finds the `agent-tool` link whose `target === selectedNode.id`, resolves the agent node's bare `name` (no `agent:` prefix — matching `normalizeFocusKey` contract from Plan 01)
- `ownerMatch` — `focusKeysMatch(owningAgentName, cv.label)` over codeVaultNodes; exact normalized match only (D-04)
- Detail panel rendered alongside canvas in `grid-cols-[1fr_280px]` when `selectedNodeId` set
- RELATED ACROSS GRAPHS section: absent when `ownerMatch` is null (SC#3); present only when confirmed match found
- Link row: `ArrowRight` + "Owning agent:" + `{ownerMatch.label}` + `ExternalLink`; full row is `<button>` with `hover:bg-primary/5`, wrapped in `<SectionErrorBoundary name="Cross-graph links">`
- On click: `buildFocusUrl({ surface: 'graphs', nodeId: ownerMatch.id }, '/tool-galaxy?focus=<selectedNode.id>')` → navigates to /graphs with both ?focus and ?from set
- T-85-05: all node labels/names rendered as React text children (auto-escaped); `from` value is `encodeURIComponent`-wrapped in `buildFocusUrl`

### Task 2: Inbound focus param + return chip

- `useFocusParam({ nodes: loading ? undefined : graph.nodes, getId, onFocus })` — one-shot on mount; waits for loading to resolve; silent no-op when node absent (SC#3)
- `onFocus` callback: `setSelectedNodeId(node.id)` + `fgRef.current?.centerAt(node.x, node.y, 800)` + `fgRef.current?.zoom(3, 800)` with `x != null` guard
- `fromParam` from hook — T-85-01 same-origin-guarded via `decodeFromParam` in Plan 01
- `surfaceLabel(fromUrl)` helper: maps `/graphs` → "Code/Vault Graph", `/knowledge-graph` → "KG Explorer", `/tool-galaxy` → "Tool Galaxy", else "previous graph"
- Return chip: `<button>` with `ChevronLeft` + "Back to {label}"; `border-l-2 border-primary/40 pl-2`; `aria-label="Return to {label}"`; `onClick={() => navigate(fromParam)}`; wrapped in `<SectionErrorBoundary name="Return navigation">`; rendered only when `fromParam` is non-null

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Implementation Notes

**Tasks 1 and 2 committed atomically:** Both tasks modify the same `GalaxyCanvas` component and share state (`selectedNodeId`, `useFocusParam`, `fromParam`). Splitting them would produce an intermediate state where `useFocusParam` references `setSelectedNodeId` before it exists. Single commit a6a6405 delivers both tasks cleanly with tsc exit 0.

## Verification

- `npx tsc --noEmit` — 0 errors (TSC_CLEAN)
- Source assertions (Task 1):
  - `RELATED ACROSS GRAPHS` — present at line 430
  - `Owning agent:` — present at line 449
  - `focusKeysMatch(` — present at line 144
  - `buildFocusUrl({ surface: "graphs"` — present at lines 440-442
  - `aria-label="Related across graphs navigation links"` — present at line 427
  - RELATED ACROSS GRAPHS section guarded by `ownerMatch &&` — present at line 423
  - Section inside `<SectionErrorBoundary name="Cross-graph links">` — line 432
- Source assertions (Task 2):
  - `useFocusParam(` — present at line 150
  - `fgRef.current?.centerAt(` inside onFocus — line 157
  - `fgRef.current?.zoom(3, 800)` inside onFocus — line 158
  - `fromParam &&` — line 278
  - `ChevronLeft` — lines 11 + 285
  - `Back to ` copy — line 286
  - `border-l-2 border-primary/40` — line 283
  - `aria-label` starting "Return to " — line 281
  - `navigate(fromParam)` — line 282
- Behavior (human verification required on real Convex data): tool with backing agent shows "Owning agent →"; tool with no backing agent shows no link; inbound ?focus selects+centers; absent focus node → silent default view; return chip present only with ?from; clicking chip returns to decoded origin

## Known Stubs

None. All functionality is fully wired — no placeholder text, hardcoded empty values, or unresolved TODOs.

## Threat Surface Scan

No new network endpoints or auth paths introduced. The two threat mitigations from the plan's register are confirmed implemented:
- T-85-01 (open-redirect): `fromParam` is the output of `useFocusParam` which routes through `decodeFromParam` (same-origin guard from Plan 01); the return chip navigates only to that guarded value — never to raw `searchParams.get('from')`
- T-85-04 (misleading link): link renders only when `focusKeysMatch` confirms an exact normalized match against a real code/vault node
- T-85-05 (XSS): all labels/names rendered as React text children; outbound `from` value is `encodeURIComponent`-wrapped by `buildFocusUrl`

No new threat surface beyond what the plan's threat model covers.

## Self-Check: PASSED

- [x] src/pages/ToolGalaxy.tsx — modified, exists
- [x] Commit a6a6405 — verified in git log
- [x] npx tsc --noEmit — 0 errors
- [x] All Task 1 source assertions present in file
- [x] All Task 2 source assertions present in file
