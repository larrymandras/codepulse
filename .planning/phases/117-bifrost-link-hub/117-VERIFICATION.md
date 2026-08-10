---
phase: 117-bifrost-link-hub
verified: 2026-08-10T21:40:00Z
status: passed
score: 4/4 goal clauses verified
overrides_applied: 0
---

# Phase 117: Bifröst Link Hub Verification Report

**Phase Goal (ROADMAP):** `links` table, command-palette jump, liveness dots.
**Design source:** `docs/proposals/2026-08-07-seidr-suite-design.md` §4.2.
**Verified:** 2026-08-10 · **Status:** passed · Initial verification.

## Goal Achievement

| # | Clause | Status | Evidence |
|---|---|---|---|
| 1 | A `links` table exists and is live | ✓ VERIFIED | `npx convex deploy` → `127.0.0.1:3210`, zero `.convex.cloud`, no indexes deleted, `[+] links.by_category` and `[+] links.by_order` added. `npx convex run bifrost:list` → `[]` then 2 rows, exit 0. |
| 2 | `/bifrost` is reachable and renders the library | ✓ VERIFIED | `e2e/navigation.spec.ts` 9/9 including a click-through to `/bifrost` — proving the registry entry renders as a real link, which no unit test shows. Live probe: both cards and the category heading render. |
| 3 | Command-palette jump works | ✓ VERIFIED | `e2e/bifrost.spec.ts`: Ctrl+K → search → Enter produced a **popup whose URL contains `8181`**. Asserted on the popup, not on the item being clickable. |
| 4 | Liveness dots reflect real service state | ✓ VERIFIED (one case unit-only) | Live: `GREEN_DOTS: 1`, `RED_DOTS: 0`, two cards → the container-bound link resolves green, the unbound one renders nothing. Red case unit-proven — see gaps. |

**Score:** 4/4

## Decision Coverage

| # | Decision | Status | Evidence |
|---|---|---|---|
| D-01 | `links` schema per the design doc | ✓ | `convex/schema.ts`, all specified fields; `icon` stores a lucide NAME, resolved through `iconComponents`. |
| D-02 | Liveness by container name, not host:port | ✓ | The doc's mechanism was disproven (no port/host field anywhere; only three "port" occurrences in `convex/*.ts`, all comment prose). Implemented against `docker:currentStatus`, sampled live. |
| D-03 | Absent signal renders no dot, never green | ✓ | Live: two cards, one dot. Unit: 4 tests incl. a control proving the same map does resolve a real name. Mutation: defaulting to `"up"` fails 2 of 7. |
| D-04 | Non-containerised services out of scope | ✓ | The seeded Vite link correctly shows no dot. Stated in CONTEXT as a decision. |
| D-05 | Palette joins the existing seam | ✓ | Added to `useCommandPaletteSearch`, not new plumbing. Explicit cmdk `value` guards the label-collision defect; mutation-tested. |
| D-06 | Drag-reorder and curation skills deferred | ✓ | `order` ships and is respected (`compareLinks`, 6 tests); no drag UI, no scan skill. Recorded, not silent. |

## Gates

`npx tsc --noEmit` exit 0 · `npx vitest run` 294 files / **3911 passed, 0
failures** · `e2e/navigation.spec.ts` 9/9 · `e2e/bifrost.spec.ts` 2/2.

## Gaps

1. **Red dot is unit-proven, not live.** All 19 containers were running;
   producing a red dot requires stopping a real service. Closing it live is one
   action: stop a container bound to a link, reload `/bifrost`.
2. **D-06 deferrals** — drag-reorder UI and `/bifrost-scan` + `/link-add`.
3. **Pre-existing `theme-contrast` e2e failures** remain outside this phase.
   Note `fee96b5d` landed separately, tightening that spec so it no longer
   passes vacuously behind the Clerk gate, and SEED-006 now tracks the
   remediation.

## Verdict

**PASSED.** All four goal clauses hold against the live system and all six
decisions carry evidence. The one incomplete item — a live red dot — is an
environment condition, not missing work, and is reproducible on demand.
