# Phase 117 — Bifröst Link Hub: Context

**Source of truth:** `docs/proposals/2026-08-07-seidr-suite-design.md` §4.2 (Seiðr Suite,
approved 2026-08-08). No REQ-IDs; the acceptance-bearing units are the decisions below.

**Routing:** ROADMAP flags this phase `/gsd-quick`-shaped. Executed at quick tier — atomic
commits and state tracking, no research/planner/checker agents.

---

## Decisions (locked 2026-08-10)

- **D-01: `links` schema per the design doc** — `title`, `url`, `description`, `category`,
  `icon` (lucide icon NAME, never inline SVG), `pinned`, `order`, `isLocalService`,
  `createdAt`. Icons are names so the registry stays the single icon source, matching
  `navRegistry.ts`'s `iconComponents` map.

- **D-02: Liveness is resolved by CONTAINER NAME, not by host:port.** The design doc says the
  dots reuse "the Infrastructure page's existing probe data (join on host:port; no new
  probing)". **That mechanism does not exist and cannot be built as described.** Verified
  2026-08-10 against the live schema and backend:
  - no field named `port`/`host`/`endpoint` exists anywhere in `convex/schema.ts`;
  - the only three occurrences of the word "port" in `convex/*.ts` are comment prose;
  - `dockerContainers` carries `containerId`, `name`, `image`, `status`, `health`,
    `cpuPercent`, `memoryMb`, `updatedAt` — and no address of any kind;
  - the only URL-bearing table in the schema is `mcpServers.url`.

  What DOES exist is live and already rendered as exactly this dot:
  `docker:currentStatus` returns `{name, status, health}` per container (sampled live), and
  `DockerPanel.tsx:70` renders a status-coloured dot from it.

  So `links` gains an optional **`containerName`**, and a link's dot reads that container's
  `status`. This keeps the phase at quick tier and satisfies the design doc's own gate.

- **D-03: A link with no `containerName` renders NO dot — never a green one.** Absence of a
  liveness signal must not read as "up". This is the same honest-absent-state rule Phase 109
  settled on for engine telemetry (`"Not reported"` rather than a fabricated value).

- **D-04: Non-containerised local services are out of scope this phase.** A bare Vite dev
  server on `:5173` is not a container and therefore gets no dot under D-02. Covering it
  requires real per-URL probing — a new ingest route, a new field, and a scheduled runner —
  which is a separate phase, not a quick one. `isLocalService` is still stored (design doc
  field list) but drives only presentation, not probing.

- **D-05: Command-palette registration follows the existing aggregation seam.**
  `CommandPalette.tsx` already composes several sources via `useCommandPaletteSearch`
  (agents, sessions, alerts, cronJobs). Links join that seam. Opening a link navigates for
  internal paths and `window.open` for external URLs.

- **D-06: Deferred from this phase, stated so the absence reads as a decision** —
  drag-reorder within a category (the `order` field ships and is respected; the drag UI does
  not), and the `/bifrost-scan` + `/link-add` curation skills. Both are additive and neither
  blocks daily use of the hub.

---

## Gate (from the design doc, adjusted for D-02)

Palette-open works end to end, and a link bound to a container shows a red dot when that
container is stopped — **with a running container's link showing green in the same view as
the control.** A red dot alone proves nothing; a missing join renders identically.

---

## Verified pre-flight facts

| Claim | Status |
|---|---|
| `CommandPalette` can take another source | ✓ `useCommandPaletteSearch` already aggregates 4 |
| Infrastructure has host:port probe data | ✗ **false** — see D-02 |
| Container status is live and queryable | ✓ `docker:currentStatus`, fresh `updatedAt` |
| `DockerPanel.tsx` already renders a status dot | ✓ `:70` |

**Known gotcha to respect (memory `cmdk-and-global-hotkey-gotchas`):** cmdk selection is
value-keyed — duplicate item values cause a double-highlight and an ArrowDown loop — and
`DashboardLayout` owns the global Ctrl+K binding. Give every link item a unique palette value
and do not bind a new global shortcut.
