---
created: 2026-06-22
source: 85-REVIEW.md (WR-02, WR-04)
phase_origin: 85
priority: low
type: ux-robustness
---

# Phase 85 deferred code-review items (WR-02, WR-04)

Two non-blocking UX-robustness findings from the Phase 85 code review
(`85-REVIEW.md`) were deferred because they need tuning against the running
force-graph layout rather than a static edit:

## WR-02 — focus centering can fire before the force layout assigns x/y
`ToolGalaxy.tsx`, `CodeVaultGraph.tsx`, `KnowledgeGraph.tsx`: the one-shot
`useFocusParam` apply runs as soon as the matching node appears, but the force
layout may not have assigned `node.x`/`node.y` yet. The current code guards the
`centerAt` call (so it doesn't NaN-center) but never retries — so a deep-link
**selects** the node but may not **center** it. Consider re-attempting the
centerAt on the next layout tick / engine-stop, or polling once x/y are defined.

## WR-04 — KG inbound-focus effect relies on incidental loading-flip ordering
`KnowledgeGraph.tsx`: the inbound entity-lens override effect depends on a ref
mutation set in a sibling effect; correctness currently rides on the order in
which `loading` flips. Make the dependency explicit (single effect, or gate on a
derived "hydrated" value) so it can't silently break if effect order changes.

**Verify during human UAT:** deep-link into each surface (`?focus=...`) and
confirm the target node both selects AND centers on first arrival.
