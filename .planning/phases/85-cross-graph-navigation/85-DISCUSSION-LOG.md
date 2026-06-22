# Phase 85: Cross-Graph Navigation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-22
**Phase:** 85-cross-graph-navigation
**Areas discussed:** Nav mechanism, Param contract, Link directions, Match resolution, Link affordance, Return path

---

## Nav mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Cross-route focus param | Router-navigate to target's standalone route with a focus target in URL; page reads it on mount, selects + centers. Builds the missing deep-link infra once, reuses everywhere, keeps 84's standalone boundary, shareable/bookmarkable for free. | ✓ |
| In-hub tabs + shared focus | Pull surfaces into /graphs as tabs sharing one focus state; jump switches tab + sets focus. Slicker, but contradicts 84 D-01, big rebuild, loses standalone routes. | |
| Imperative ref/event, no URL | Cross-surface centerAt without touching URL. Lightest, but only works when both surfaces mounted; no shareable/back behavior. | |

**User's choice:** Cross-route focus param (recommended).
**Notes:** None — recommendation accepted directly.

---

## Param contract

| Option | Description | Selected |
|--------|-------------|----------|
| Per-surface params, one convention | Shared `?focus=<id>` for id-addressable surfaces (code/vault, Galaxy); KG jumps carry `?focus=<name>&lens=entity&hops=1` so the name-driven entity lens fetches. One helper builds URL per target type. | ✓ |
| Uniform `?focus=<id>` only | Every surface gets just `?focus=<id>`; KG must reverse-map id→name + switch lens itself. Cleaner URL but fragile; risks empty KG graph on arrival. | |

**User's choice:** Per-surface params, one convention (recommended).
**Notes:** Driven by the finding that `useKnowledgeGraph`'s entity lens only fetches when an entity name is present.

---

## Link directions

| Option | Description | Selected |
|--------|-------------|----------|
| Two forward links only | Tool → owning agent (code/vault); agent → related KG entities. Exactly GH-04/SC#1-2; forward chain tool→agent→KG walkable; no creep. | ✓ |
| Bidirectional | Add reverse: code/vault agent → Galaxy tools; KG entity → owning agent. Richer, but each reverse is its own match + affordance to build/verify; beyond GH-04. | |
| Forward + agent↔KG both ways | Tool→agent one-way; agent↔KG bidirectional. Middle ground. | |

**User's choice:** Two forward links only (recommended).
**Notes:** None.

---

## Match resolution

| Option | Description | Selected |
|--------|-------------|----------|
| Normalized-exact, eager render | Normalized key (strip namespace, case/whitespace-fold), exact hit only — no fuzzy/substring. Resolve eagerly: confirm destination exists before rendering the affordance → SC#3 silent absence. | ✓ |
| Exact-id/string only | Raw exact equality, no normalization. Zero false positives but namespaced ids/casing mean almost nothing matches — too brittle. | |
| Fuzzy / substring tolerant | Case-insensitive substring or Levenshtein to maximize links. Catches more but risks wrong destinations — conflicts with SC#3 and precision rule. | |

**User's choice:** Normalized-exact, eager render (recommended).
**Notes:** A wrong jump is worse than a missing one — precision over coverage.

---

## Link affordance

| Option | Description | Selected |
|--------|-------------|----------|
| Detail-panel link section | "Related across graphs" section at bottom of each surface's detail panel — the slot 84 D-10 left open. Renders a labeled link only when a match resolves. Consistent, discoverable, eager-match gates visibility. | ✓ |
| Right-click context menu | Jump options in a node context menu. Graph-native, uncluttered, but new interaction pattern, less discoverable, harder to show "no match = absent". | |
| Inline affordance on node/hover | Jump icon on node or in hover tooltip. Fast, but tooltip is label/type/source only (D-11), cramped, competes with selection clicks. | |

**User's choice:** Detail-panel link section (recommended).
**Notes:** None.

---

## Return path

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit return chip + origin in URL | Jump URL carries `&from=` with originating selection + filters; destination shows "← Back to X" chip that restores prior context. Most reliable SC#4 path without per-page idb persistence. | ✓ |
| Browser back only | Rely on back button + per-page URL/idb restore. Zero new UI but poor discoverability; only KG restores state today. Weakest on SC#4. | |
| Both: chip + back-button parity | Return chip AND back-button lands on restored state. Best UX, slightly more plumbing. | |

**User's choice:** Explicit return chip + origin in URL (recommended).
**Notes:** Code/vault hero and Tool Galaxy hold selection in volatile component state, so origin state must be serialized into the URL for return to restore it.

---

## Claude's Discretion

- Loading/empty state on arrival (skeleton + graceful fallback if focused node absent on arrival).
- Exact normalization rules; `from`-param encoding (nested query / router state / base64); return-chip copy/styling; KG inbound `hops` default; whether agent→KG link shows an entity count.
- Shape of the shared plumbing — `useFocusParam` hook + `buildFocusUrl` helper location.

## Deferred Ideas

- Reverse / bidirectional cross-graph links — out of scope for GH-04.
- Pulling standalone surfaces into the hub as tabs — rejected (84 D-01); cross-route focus param chosen instead.
- Shareable/saved graph views built on the focus-param infra — Phase 87 (KG-10).
- Search-to-focus — Phase 86 (KG-08), reuses the same focus mechanism.
