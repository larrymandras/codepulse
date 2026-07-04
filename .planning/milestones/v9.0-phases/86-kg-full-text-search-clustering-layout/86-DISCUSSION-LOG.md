# Phase 86: KG Full-Text Search + Clustering Layout - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-22
**Phase:** 86-kg-full-text-search-clustering-layout
**Areas discussed:** Endpoint gating, Result-click behavior, Search scope, Clustering surface scope

> Note: the four visual/interaction decisions (results-list panel, 5th Search lens, color+spatial encoding, auto-hide legend) were settled in the parallel `/gsd-ui-phase` run and are locked in `86-UI-SPEC.md` — not re-litigated here. This discussion covered the backend-wiring decisions only.

---

## Endpoint gating (SC#2)

| Option | Description | Selected |
|--------|-------------|----------|
| Graceful-degrade gate | Ship full Search lens; `fetchSearch()` in kgApi.ts; 404/501/network-fail → info copy + entity-name fallback; lights up when Ástríðr deploys | ✓ |
| Contract + mock first | Shared contract doc + local mock fetcher + flag-gated live call | |
| Block until Ástríðr ships | Don't build consumer until endpoint live; clustering-only until then | |

**User's choice:** Graceful-degrade gate
**Notes:** Confirmed `/api/kg/search` does not exist on Ástríðr yet (no fetcher, no live `search` route). Matches the UI-SPEC mandate. Becomes CONTEXT D-01.

---

## Result-click behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Focus entity in ego lens | Reuse Phase 85 `buildFocusUrl`/`useFocusParam` to center the result's subject entity + switch to Entity (ego) lens | ✓ |
| Highlight in-place | Highlight matched nodes/edges in current graph; no lens switch | |
| Both (highlight + open ego) | Highlight in-place plus a secondary "open ego graph" row action | |

**User's choice:** Focus entity in ego lens
**Notes:** Reuses shipped Phase 85 infra (which explicitly flagged "search-to-focus reuses the same focus mechanism"). Becomes CONTEXT D-02.

---

## Search scope

| Option | Description | Selected |
|--------|-------------|----------|
| Respect active filters | Search lens honors shared entity-type + agent-id filters; passes to `/api/kg/search` | ✓ |
| Always global | Ignore filters, search entire KG | |
| Global + optional scope toggle | Global by default with a "scope to current filters" toggle | |

**User's choice:** Respect active filters
**Notes:** Consistent with the shared filter row; agent scope matters in a multi-agent KG. SC#1 distinctness comes from searching fact text + relationship labels, not from scope. Becomes CONTEXT D-03.

---

## Clustering surface scope

| Option | Description | Selected |
|--------|-------------|----------|
| Generic, data-gated | Cluster renderer in ForceGraphCanvas keyed on `node.community`; activates wherever data exists (code/vault now; KG when Ástríðr adds field) | ✓ |
| Code/vault only, defer KG | Same renderer, explicitly scoped to code/vault; KG clustering deferred | |
| Push KG community now | Treat KG-graph community as a 2nd Ástríðr delta this phase | |

**User's choice:** Generic, data-gated
**Notes:** Code/vault snapshot nodes already carry `community` (`schema.ts:1685`); KG overview does not. Matches the UI-SPEC gate `nodes.some(n => n.community != null)`. No hard KG dependency. Becomes CONTEXT D-04 (+ D-05 threading `community` through `KgNode`).

---

## Claude's Discretion

- Search ergonomics (debounce, min query length, result cap/pagination, result-row fields beyond UI-SPEC copy).
- `/api/kg/search` request/response wire shape (consumer contract; Ástríðr emitter is source of truth once live).
- d3-force cluster tuning (strength, gravity wells, collision) and halo geometry/opacity within the UI-SPEC contract.
- Search-lens layout fork (own result-driven subgraph vs. existing overview canvas + results panel) — flagged by UI-SPEC for plan-time resolution.
- Inbound search→ego `hops` default (1 to start).

## Deferred Ideas

- Ástríðr `/api/kg/search` endpoint — net-new astridr-repo work (cross-repo dependency; gated consumer here).
- `community` on Ástríðr `/api/kg/overview` — astridr-repo delta; KG graph clusters automatically once it lands.
- Saved/named/shareable views + temporal diff — Phase 87 (KG-10/KG-11).
