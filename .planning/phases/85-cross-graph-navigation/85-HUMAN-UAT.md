---
status: partial
phase: 85-cross-graph-navigation
source: [85-VERIFICATION.md]
started: 2026-06-22T00:00:00Z
updated: 2026-06-22T00:00:00Z
method: playwright-automated (no-Clerk dev instance on :5180 against live Convex; KG API :8181 CORS-blocked from dev origin)
---

## Current Test

[automated pass complete — 2 PASS, 2 PARTIAL (return-chip side passes), 4 BLOCKED by environment]

## Tests

### 1. Tool node with backing code/vault agent shows 'Owning agent' link
expected: Selecting a tool node whose owning agent matches a code/vault snapshot label renders "Owning agent: {label} →"; a tool with no match shows nothing.
result: BLOCKED (data) — focus-select works (panel opens for Read/Write/Edit/Bash/Grep/Glob/WebFetch/WebSearch) but every tool reports CALLS=0 and there are no agent→tool call edges in this Convex deployment, so no owning agent can resolve. Link mechanism verified by code review; positive case needs real call-graph data.

### 2. Tool→agent navigation preserves Tool Galaxy state in ?from
expected: Clicking "Owning agent" navigates to /graphs?focus=<nodeId>&from=<encoded Galaxy URL>; "Back to Tool Galaxy" chip renders on /graphs and returns with the tool still selected.
result: PARTIAL — return chip side PASSES: arriving at /graphs?from=<tool-url> renders "Back to Tool Galaxy" (aria "Return to Tool Galaxy"). Forward click not exercisable (no owning-agent link to click, see #1).

### 3. Agent node with KG relationships shows 'N KG entities' link
expected: Selecting a code/vault node with ≥1 KG entity shows "N KG entities →"; zero entities shows nothing.
result: BLOCKED (env) — Ástríðr KG API (http://localhost:8181/api/kg/overview) is CORS-blocked from the dev origin ("No Access-Control-Allow-Origin"), so useKnowledgeGraph returns no entities. Cannot exercise the positive link here.

### 4. Agent→KG navigation and KG return chip
expected: Clicking "N KG entities →" navigates to /knowledge-graph?focus=<entity>&lens=entity&hops=1&from=...; KG selects+centers; "Back to Code/Vault Graph" chip returns to /graphs.
result: PARTIAL — KG return chip PASSES: arriving at /knowledge-graph?...&from=<graphs-url> renders "Back to Code/Vault Graph" (aria "Return to Code/Vault Graph"). Forward nav blocked by KG CORS (see #3).

### 5. KG inbound focus: idb saved-state does not clobber the inbound override
expected: Arriving with ?focus&lens=entity from fresh and from saved-idb sessions both end on the entity lens with the focused entity.
result: BLOCKED (env) — KG cannot load data (CORS, see #3), so the entity-lens hydration path cannot be observed end-to-end.

### 6. WR-02 (deferred): focus centering may fire before force layout assigns x/y
expected: On first arrival via ?focus, the node is selected (panel opens) even when centering does not fire.
result: PASS — ?focus=tool:<name> reliably opens the detail panel (selection-only degrade confirmed); no NaN/crash. Visual "does it visibly recenter" is the only remaining eyeball check.

### 7. WR-04 (deferred): KG inbound-focus effect ordering
expected: setLens/setFilter fires before useFocusParam matches, so the entity is present when matching occurs.
result: BLOCKED (env) — KG cannot load data (CORS, see #3); effect ordering not observable end-to-end here.

### 8. SC#3 zero-false-positive: no broken nav appears anywhere
expected: ?focus values matching no node show no error, no broken link, no dead button — just the default surface view.
result: PASS — /tool-galaxy?focus=tool:NonExistent_ZZZ, /graphs?focus=graphify:codepulse:NonExistent_ZZZ, /knowledge-graph?focus=NonExistent_ZZZ, and unknown tools (Task, TodoWrite) all render the default view with no crash, no console errors (except the env KG CORS), no link section.

## Summary

total: 8
passed: 2
partial: 2
issues: 0
pending: 0
blocked: 4
note: 0 defects found. All non-passing items are blocked by environment (no agent→tool call-graph edges in Convex; KG API CORS from dev origin), not by Phase 85 code. Re-run on the authenticated prod-origin app with the KG API allowing the origin to close the 4 blocked + 2 partial items.

## Gaps

(none — no Phase 85 defects surfaced.)

### Definitive root cause for the un-demonstrable forward links (data, not code)
Confirmed by direct Convex query on the live deployment (2026-06-22):
- `graphSnapshots:listSnapshots` returns exactly ONE project-graph snapshot,
  `astridr-project-graph`, with **nodeCount 3**: `graphSnapshots.ts`,
  `runtimeIngest.ts`, `Graph Snapshot Receiver`. (The full astridr-repo graph,
  ~4200 nodes per the snapshot's `sources`, was truncated to this seed.)
- `callGraphEdges:listEdges` has 69 edges across 6 agents:
  `astridr, urdhr, hildr, hervor, skuld, gondul`.
- **None of those 6 agent names appear among the 3 code/vault node labels.**

Therefore:
- **SC#1** (Tool Galaxy "Owning agent →"): a tool owned by e.g. `skuld` finds no
  code/vault node matching `skuld` → no link. Correct per SC#3 (no link without a
  real match) — the gate is firing as designed.
- **SC#2** (Code/Vault "N KG entities →"): none of the 3 code/vault nodes is an
  agent name, so scoping the KG by those labels returns 0 entities → no link.

To DEMONSTRATE the positive links, ingest a project-graph snapshot whose node
labels include agent names (e.g. a vault note "Skuld"/"Ástríðr", or the full
astridr-repo graphify graph) via the Phase 83 ingest receiver. This is a
data-coverage task, independent of the GH-04 wiring (which is verified correct).
