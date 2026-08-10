---
phase: 117-bifrost-link-hub
plan: 01
subsystem: fullstack

tags: [convex, react, command-palette, docker, seidr-suite, gsd-quick]

# Dependency graph
requires: []
provides:
  - "convex/schema.ts `links` table + convex/bifrost.ts domain module"
  - "src/pages/Bifrost.tsx — categorised grid, pinned row, quick-add, liveness dots"
  - "command-palette link entries with collision-safe cmdk values"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Container-name liveness join: a link declares which container backs it and the dot reads dockerContainers.status. No probing, no new ingest — reuses the rows DockerPanel already renders."
    - "Explicit cmdk `value` on any palette item whose text can duplicate another group's. cmdk derives value from item text by default, so two items sharing a label collapse into one selection key."

key-files:
  created:
    - convex/bifrost.ts
    - convex/__tests__/bifrost.test.ts
    - src/hooks/useBifrostLinks.ts
    - src/pages/Bifrost.tsx
    - src/pages/Bifrost.test.tsx
    - e2e/bifrost.spec.ts
    - .planning/phases/117-bifrost-link-hub/117-CONTEXT.md
  modified:
    - convex/schema.ts
    - src/lib/navRegistry.ts
    - src/App.tsx
    - src/components/CommandPalette.tsx
    - src/components/__tests__/CommandPalette.test.tsx
    - src/hooks/useCommandPaletteSearch.ts
    - e2e/navigation.spec.ts

key-decisions:
  - "D-02: liveness joins CONTAINER NAME, not host:port. The design doc's specified mechanism does not exist — no port/host field anywhere in the schema."
  - "D-03: no containerName renders NO dot, never a green one."
  - "D-04: non-containerised local services are out of scope; isLocalService is stored but drives presentation only."
  - "D-06: drag-reorder and the /bifrost-scan + /link-add curation skills are deferred."

patterns-established: []

requirements-completed: []

# Metrics
duration: ~45min
completed: 2026-08-10
---

# 117: Bifröst Link Hub

Executed at `/gsd-quick` tier per the ROADMAP's own routing note. Single
execution unit, three atomic commits: backend (`3002418b`), frontend
(`d067ac0d`), this record.

## The design doc was wrong about liveness, and that was the whole risk

§4.2 specifies dots that reuse "the Infrastructure page's existing probe data
(join on **host:port**; no new probing)". Pre-flight established that mechanism
does not exist:

- no field named `port`/`host`/`endpoint` anywhere in `convex/schema.ts`
- the only three occurrences of "port" in `convex/*.ts` are comment prose
- `dockerContainers` carries no address of any kind
- the only URL-bearing table in the schema is `mcpServers.url`

Catching this before planning is what kept 117 a quick phase. Building what the
doc assumed exists — per-URL probing — would have meant a new ingest route, a
new field and a scheduled runner. Larry chose the container-name join.

## Gates

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx vitest run` | 294 files, **3911 passed, 0 failures** |
| `e2e/navigation.spec.ts` | 9/9 (includes the new `/bifrost` link test) |
| `e2e/bifrost.spec.ts` | 2/2 |
| `npx convex deploy` | `127.0.0.1:3210`, zero `.convex.cloud`, **no indexes deleted**, `[+] links.by_category`, `[+] links.by_order` |

**Design-doc gate, both halves:**

- *Palette-open works end to end* — ✓ Ctrl+K → search → Enter produced a popup
  whose URL contains `8181`. Asserted on the popup, not on the item being
  clickable.
- *A container-bound link's dot reflects its service, with a control* — ✓
  partially. Live: `GREEN_DOTS: 1`, `RED_DOTS: 0`, two cards, one dot — the
  bound link resolves green and the unbound one renders nothing. The **red**
  case is unit-proven only; see gaps.

## Mutation testing

Every rule with a plausible wrong implementation was inverted:

| Mutation | Result |
|---|---|
| `order ?? 0` instead of `?? Infinity` | 1 of 6 fails (the absent-order test) |
| unknown container → `"down"` instead of `null` | 1 of 7 fails |
| missing `containerName` → `"up"` instead of `null` | 2 of 7 fail |
| drop the explicit cmdk `value` on link items | 1 of 14 fails (the collision test) |

## Two things I got wrong mid-execution

**The palette test mock had drifted from its hook's contract.** Adding `links`
to `useCommandPaletteSearch` made all 12 existing palette tests fail, because
the mock returned no `links` key and `links.map` threw. The mock was the stale
artefact, so it grew a `links` fixture — no pre-existing assertion was rewritten.

**My first collision fixture broke three unrelated tests.** I titled the
duplicate link "Forge", which made `getByText("Forge")` ambiguous in three
pre-existing tests. Rewriting three tests to accommodate my fixture would have
been the wrong direction; I picked "Tasks", a nav label no assertion resolves.

## Gaps — stated, not buried

1. **The red dot is unit-proven, not live.** All 19 containers were running, and
   manufacturing a red dot means stopping one of Larry's real services. Covered
   in `src/pages/Bifrost.test.tsx` with a control; noted there so the unit
   coverage is not mistaken for a live observation. **To close it live:** stop
   any container bound to a link and reload `/bifrost`.
2. **D-06 deferrals ship as absences:** drag-reorder within a category (the
   `order` field ships and is respected; the drag UI does not) and the
   `/bifrost-scan` + `/link-add` curation skills. Links are added through the
   quick-add dialog until those exist.
3. **D-04's excluded case is real and visible:** the seeded "CodePulse dev
   server" link is a bare Vite server, not a container, so it correctly shows no
   dot. That is the honest rendering of "no signal", not a bug.

## Live state

Two links seeded and kept because they are genuinely useful rather than
fixtures: **Ástríðr API** (bound to `astridr-agent`) and **CodePulse dev
server** (unbound). `e2e/bifrost.spec.ts` reads them and creates nothing, so it
leaves no rows to clean up.
