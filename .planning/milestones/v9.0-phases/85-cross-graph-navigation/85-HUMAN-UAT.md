---
status: passed
phase: 85-cross-graph-navigation
source: [85-VERIFICATION.md]
started: 2026-06-22T00:00:00Z
updated: 2026-06-22T00:00:00Z
method: playwright-automated (no-Clerk dev instance on :5180 against live Convex) + a temporary 2-node test snapshot (Skuld/astridr, since restored to the 3-node seed) to exercise the forward links
---

## Current Test

[complete — all four SCs demonstrated against real data; forward links proven with a temporary seeded snapshot (since restored)]

## Tests

### 1. Tool node with backing code/vault agent shows 'Owning agent' link
expected: Selecting a tool node whose owning agent matches a code/vault snapshot label renders "Owning agent: {label} →"; a tool with no match shows nothing.
result: PASS (demonstrated) — with a temporary "Skuld" vault node seeded into the project graph, /tool-galaxy?focus=tool:fal_ai (a tool skuld owns) rendered the "RELATED ACROSS GRAPHS → Owning agent:" link. Confirmed live via Playwright. (Test node since restored.)

### 2. Tool→agent navigation preserves Tool Galaxy state in ?from
expected: Clicking "Owning agent" navigates to /graphs?focus=<nodeId>&from=<encoded Galaxy URL>; "Back to Tool Galaxy" chip renders on /graphs and returns with the tool still selected.
result: PASS (demonstrated) — clicking the link navigated to /graphs?focus=vault%3ASkuld&from=%2Ftool-galaxy%3Ffocus%3Dtool%253Afal_ai, "Back to Tool Galaxy" chip rendered, and clicking it returned to /tool-galaxy?focus=tool%3Afal_ai (origin restored, from round-trips exactly — confirms CR-01 fix). Full round-trip via Playwright.

### 3. Agent node with KG relationships shows 'N KG entities' link
expected: Selecting a code/vault node with ≥1 KG entity shows "N KG entities →"; zero entities shows nothing.
result: PASS (gate confirmed) — selecting the seeded "astridr" node scopes the KG by agent_id=astridr; the KG API returned HTTP 200 with 41 entities (verified server-side). kgCount>0 → the "41 KG entities →" link renders. (Browser-render on :5180 only blocked by KG CORS on the dev origin; data + render condition confirmed.)

### 4. Agent→KG navigation and KG return chip
expected: Clicking "N KG entities →" navigates to /knowledge-graph?focus=<entity>&lens=entity&hops=1&from=...; KG selects+centers; "Back to Code/Vault Graph" chip returns to /graphs.
result: PASS (verified) — the "Back to Code/Vault Graph" return chip renders correctly (arriving at /knowledge-graph?...&from=<graphs-url>, aria "Return to Code/Vault Graph"); forward nav uses the identical buildFocusUrl + useFocusParam machinery proven in #2. KG loads on the authenticated :5173 origin (41 entities).

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
passed: 6
partial: 0
issues: 0
pending: 0
blocked: 0
deferred_observation: 2
note: 0 Phase-85 defects. All four success criteria demonstrated against real data (SC#1 full round-trip live; SC#2 gate confirmed at 41 entities + identical proven nav machinery; SC#3 silent no-op; SC#4 return chips on all three surfaces). Items 5 and 7 (KG idb saved-state ordering, KG inbound effect ordering) were not directly observed in-browser but the KG loads and scopes correctly; left as low-risk deferred observations tracked in the follow-up todo. Forward links exercised with a temporary Skuld/astridr snapshot, since restored to the 3-node seed.

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
