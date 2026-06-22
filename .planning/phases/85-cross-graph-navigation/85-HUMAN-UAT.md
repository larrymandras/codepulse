---
status: partial
phase: 85-cross-graph-navigation
source: [85-VERIFICATION.md]
started: 2026-06-22T00:00:00Z
updated: 2026-06-22T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Tool node with backing code/vault agent shows 'Owning agent' link
expected: Selecting a tool node whose owning agent matches a code/vault snapshot label renders "Owning agent: {label} →" in the RELATED ACROSS GRAPHS section. A tool with no match shows nothing.
result: [pending]

### 2. Tool→agent navigation preserves Tool Galaxy state in ?from
expected: Clicking the "Owning agent" link navigates to /graphs?focus=<nodeId>&from=%2Ftool-galaxy%3Ffocus%3D<tool-id>. The "Back to Tool Galaxy" return chip renders on /graphs and returns to Tool Galaxy with the tool still selected.
result: [pending]

### 3. Agent node with KG relationships shows 'N KG entities' link
expected: Selecting a code/vault node whose agentId-scoped useKnowledgeGraph returns ≥1 entity shows "N KG entities →" in RELATED ACROSS GRAPHS. A node with zero KG entities shows nothing.
result: [pending]

### 4. Agent→KG navigation and KG return chip
expected: Clicking "N KG entities →" navigates to /knowledge-graph?focus=<entityName>&lens=entity&hops=1&from=%2Fgraphs%3Ffocus%3D<nodeId>. KG switches to entity lens, fetches the entity, selects+centers it. "Back to Code/Vault Graph" chip renders and returns to /graphs.
result: [pending]

### 5. KG inbound focus: idb saved-state does not clobber the inbound override
expected: Arriving at /knowledge-graph?focus=<entity>&lens=entity&hops=1 from a fresh session AND from a session with prior saved idb state both end with the entity lens active and the focused entity selected — saved-state restore never wins over the inbound override.
result: [pending]

### 6. WR-02 (deferred): focus centering may fire before force layout assigns x/y
expected: On first arrival via ?focus, the node is selected (panel opens) even when centering does not fire because x/y are not yet set. The panel opens correctly regardless of whether the node visibly centers.
result: [pending]

### 7. WR-04 (deferred): KG inbound-focus effect ordering
expected: The entity-lens override effect and the useFocusParam center-on-resolve effect interact correctly — setLens/setFilter fires before useFocusParam matches node names, so the entity is present in kg.graph.nodes when matching occurs.
result: [pending]

### 8. SC#3 zero-false-positive: no broken nav appears anywhere
expected: Navigating to any surface with a ?focus that matches no node shows no error, no broken link, no dead button — just the default surface view. Test /tool-galaxy?focus=tool:NonExistent, /graphs?focus=graphify:codepulse:NonExistent, /knowledge-graph?focus=NonExistent&lens=entity&hops=1.
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
