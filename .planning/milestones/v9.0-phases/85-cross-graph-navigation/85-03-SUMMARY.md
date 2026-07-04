---
phase: 85-cross-graph-navigation
plan: "03"
subsystem: navigation
tags: [cross-graph, deep-link, kg, focus-param, return-chip, CodeVaultGraph]
dependency_graph:
  requires:
    - plan 01 (useFocusParam, buildFocusUrl, normalizeFocusKey, decodeFromParam)
  provides:
    - src/components/graph/CodeVaultGraph.tsx (agent→KG outbound link, inbound focus handling, return chip)
  affects:
    - /graphs route — now deep-linkable via ?focus=<nodeId>&from=<encoded>
    - plan 04 (KnowledgeGraph.tsx) — landing destination for the KG entity-lens jump initiated here
tech_stack:
  added: []
  patterns:
    - useKnowledgeGraph agentId-scoped overview for eager agent→KG join (no new Convex query)
    - useFocusParam one-shot mount hook for inbound ?focus param (Plan 01 hook reused)
    - normalizeFocusKey for agentId scoping (bare label, prefix stripped)
    - SectionErrorBoundary isolation for cross-graph link section and return chip
    - Skeleton placeholder when ?from present but no node selected
key_files:
  created: []
  modified:
    - src/components/graph/CodeVaultGraph.tsx
decisions:
  - "isAgentNode discriminator not applied — live snapshot has only code/note node types (no explicit agent type); the SC#3 eager-match gate (kgCount > 0) is the sole guard; if a node has no KG relations the link is silently absent regardless of type"
  - "Both tasks committed atomically — useFocusParam (Task 2) and useKnowledgeGraph (Task 1) are both declared in GraphContent; splitting into two commits would leave a non-compiling intermediate state"
  - "from param encodes /graphs?focus=<selectedNodeId> — serializes the code/vault selection into the URL so the KG return chip can restore it (D-06 / SC#4)"
  - "Panel stays open (chip-only + Skeleton) when ?from is set but no node resolves — return affordance never lost (plan Task 2 spec)"
metrics:
  duration: "~25 minutes"
  completed: "2026-06-22"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 1
  tests_added: 0
---

# Phase 85 Plan 03: CodeVaultGraph Cross-Graph Navigation Summary

**One-liner:** CodeVaultGraph gains eager agent→KG entity link (via agentId-scoped useKnowledgeGraph), inbound ?focus param handling (select+center on mount), and a same-origin-guarded return chip in the panel header — completing the code/vault surface as both origin and destination for GH-04 forward navigation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Eager agent→KG resolution + RELATED ACROSS GRAPHS link in the detail panel | f691d56 | src/components/graph/CodeVaultGraph.tsx |
| 2 | Inbound focus param handling + return chip on CodeVaultGraph | f691d56 | src/components/graph/CodeVaultGraph.tsx |

## What Was Built

### Task 1: Eager agent→KG resolution + link section

- `useKnowledgeGraph()` called once in `GraphContent`; a `useEffect` keyed on `selectedNodeId` calls `kg.setLens("overview")` + `kg.setFilter("agentId", normalizeFocusKey(node.label))` to scope the KG overview to the selected node.
- `kgEntities` derived from `kg.graph.nodes` only when `!kg.loading && !kg.error` (SC#3 degrade on KG unavailable).
- Entities sorted by normalized name; `firstKgEntity` is the jump target.
- **RELATED ACROSS GRAPHS** section renders inside `SectionErrorBoundary` after the neighbors block, separated by `<Separator className="mt-6 mb-4" />`, only when `firstKgEntity && kgCount > 0`.
- Link row: `ArrowRight` (emerald), count label ("1 KG entity" / "N KG entities"), `ExternalLink` trailing icon; `hover:bg-primary/5` hover; full-width `<button>` with `aria-label="Related across graphs navigation links"` on the containing div.
- On click: `navigate(buildFocusUrl({ surface: "knowledge-graph", entityName: firstKgEntity.name, hops: 1 }, "/graphs?focus=<selectedNodeId>"))` — encodes current selection as `from` so KG can show the return chip.
- No new Convex query, no new `fetch()` — existing hook reuse only.

### Task 2: Inbound focus param + return chip

- `useFocusParam({ nodes: snapshot.nodes, getId: n => n.id, onFocus: ... })` called in `GraphContent`; `onFocus` sets `selectedNodeId` and calls `fgRef.current?.centerAt(..., 800)` + `fgRef.current?.zoom(3, 800)`.
- Returns `{ fromParam }` — same-origin-guarded via `decodeFromParam` (T-85-01 open-redirect guard from Plan 01).
- Return chip: `<button>` in the panel header before "Node Details" label, gated on `fromParam && returnLabel`; `ChevronLeft` icon + "Back to {Surface}" copy; `border-l-2 border-primary/40`; `aria-label="Return to {Surface}"`; `navigate(fromParam)` on click.
- `returnLabel` derived from `fromParam` path segment: `/tool-galaxy` → "Tool Galaxy", `/knowledge-graph` → "KG Explorer", `/graphs` → "Code/Vault Graph", fallback → "previous graph".
- Panel opens (chip-only + `<Skeleton>`) even when `fromParam` is set but no node is selected — return affordance is never lost when arriving with `?from` but an absent focus target.

## Deviations from Plan

### Auto-handled decisions

**1. [Deviation — Design decision] No isAgentNode type discriminator**
- **Reason:** Live snapshot data contains only `code` and `note` node types (from graphify + Obsidian vault). There is no `agent` type in the current snapshot. The plan explicitly says "use the real field" and "do NOT invent one." The SC#3 eager-match gate (`kgCount > 0`) is the correct guard — only nodes that actually have KG relations show the link. Any non-agent node will return zero KG entities and show no link. This is the correct behavior per SC#3.
- **Impact:** The KG query runs for any selected node but is trivially cheap (existing hook, no new fetch); only renders the link when genuinely > 0 entities relate to that node.

**2. [Deviation — Atomic commit] Tasks 1 and 2 committed together**
- **Reason:** Both tasks modify the same function (`GraphContent`) and their hook declarations are interleaved (`useFocusParam` in Task 2 and `useKnowledgeGraph` in Task 1 are both called at the top of `GraphContent`). Splitting would produce a non-compiling intermediate. Both tasks verified green (tsc 0 errors) in the single commit.

## Verification

- `npx tsc --noEmit` — 0 errors
- Source assertions (all pass):
  - `RELATED ACROSS GRAPHS` present ✓
  - `KG entit` (matches "1 KG entity" and "N KG entities") present ✓
  - `useKnowledgeGraph(` call present ✓
  - `buildFocusUrl({ surface: "knowledge-graph"` call present ✓
  - `aria-label="Related across graphs navigation links"` present ✓
  - `firstKgEntity && kgCount > 0` gate present ✓
  - Inside `<SectionErrorBoundary` ✓
  - No new `api.` Convex query import ✓
  - No new `fetch(` call ✓
  - `useFocusParam(` call present ✓
  - `onFocus` calls `setSelectedNodeId(` + `fgRef.current?.centerAt(` + `fgRef.current?.zoom(3, 800)` ✓
  - `fromParam &&` gate on return chip ✓
  - `ChevronLeft` icon present ✓
  - `Back to ` copy present ✓
  - `border-l-2 border-primary/40` present ✓
  - `aria-label` starting `Return to ` present ✓
  - `navigate(fromParam)` on chip click ✓

## Known Stubs

None. The agent→KG link renders only when confirmed KG entities exist (no placeholder count, no hardcoded value). The return chip renders only when `fromParam` is non-null. No TODO or FIXME in modified code.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. Specific threat mitigations verified:

| Threat | Status |
|--------|--------|
| T-85-01 (open-redirect via fromParam) | Mitigated — `fromParam` comes from `useFocusParam` → `decodeFromParam` (same-origin guard from Plan 01; tested by 9 hook tests) |
| T-85-06 (misleading agent→KG link) | Mitigated — link renders only when `kgCount > 0` (real data from agentId-scoped fetch; SC#3) |
| T-85-05 (XSS via param/label/entity name) | Mitigated — all text is React children (auto-escaped); `from` is `encodeURIComponent`-wrapped in `buildFocusUrl` |
| T-85-07 (KG hook reuse info disclosure) | Accepted — existing auth posture unchanged; same hook used by KnowledgeGraph.tsx |

## Self-Check: PASSED

- [x] src/components/graph/CodeVaultGraph.tsx — exists and contains all required source assertions
- [x] Commit f691d56 — verified in git log
- [x] `npx tsc --noEmit` — 0 errors confirmed
- [x] No new Convex api. or fetch() calls in modified file
