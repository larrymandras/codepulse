# Phase 79: Forge UI Tab (read-only render) - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a `/forge` route + sidebar nav entry in CodePulse that renders Forge jobs
and workspaces **read-only** from `useQuery(api.forge.listJobs / getJob /
listWorkspaces)` (the consumer contract stood up in Phase 78). Port
`StatusBadge`, `JobList`, and `JobDetail` from `forge/web/src` into the CodePulse
shell.

**View-only.** No launch, no stop, no delete, no log streaming, no file preview —
those are Phases 80 (command bridge), 81 (live log tail), 82 (file/artifact
preview). This phase consumes the P78 data path and proves the Surface render.

**Refines the ROADMAP's "port ~1:1":** structure/layout is ported 1:1; the *skin*
is adapted to CodePulse's design system (see D-09/D-10). It is not a byte-for-byte
visual copy.

</domain>

<decisions>
## Implementation Decisions

### Read-only boundary
- **D-01:** Strip ALL action controls from the ported components — `JobDetail`'s
  Stop Job button, `JobList`'s per-job delete-X and "Clear failed" button, and
  their handlers (`handleStop`, `handleDelete`, `handleClearFailed`) and the
  `apiFetch` mutation calls. No disabled stubs, no no-op buttons. P80 re-adds them
  when the command bridge lands. Result: cleanest read-only surface, zero dead
  affordances.
- **D-02:** `JobDetail` detail pane = **metadata-only fields panel**. Show the job
  header (agent + status badge + prompt) plus a fields panel rendering the
  persisted columns: agent, mode, status, pid, exitCode, startedAt, finishedAt,
  workspaceId, model, capabilities, artifactCount, createdAt, updatedAt. **Do NOT
  port the Logs tab or the Files & Preview tab** (their backends don't exist until
  P81/P82). Drop the `Tabs`/`LogsPanel`/`FilesPanel`/`useJobLog`/`useWorkspaceFiles`
  machinery entirely for now.

### Multi-host handling
- **D-03:** `JobList` renders a **single merged, newest-first list across all
  hosts** (Desktop + laptop, per P78 D-04). Each job card shows a small **host
  badge/label** so the source machine is distinguishable. Preserves forge's flat
  single-list layout; no host selector and no per-host grouping this phase.
- **D-04:** Empty state = port forge's `JobList` empty state ("No jobs yet") but
  **drop the "Launch your first job with the New Job button above" line** — there
  is no launch control in P79. Keep it neutral.

### Nav placement & route
- **D-05:** Route is **`/forge`**. Nav entry lives in the **CONSOLE** sidebar
  group (alongside Agent Console / Live Run / Executions / Build) — Forge is a job
  runner/monitor, so it belongs in the "driving agents" cluster, not OBSERVE.
- **D-06:** Nav label = **"Forge"**. Icon = a forge-ish Lucide glyph that does
  **NOT collide with Build's `hammer`** — planner to pick a distinct one
  (`flame` / `anvil` / similar) and register it in `iconComponents`/`iconMap` in
  `DashboardLayout.tsx`.

### Visual fidelity
- **D-09:** Re-skin the 6 `JobStatus` values to **CodePulse design tokens**
  (green / amber / red / blue + zinc neutrals) instead of forge's hard-coded hex
  palette — in both `StatusBadge` and `JobDetail`'s inline badge. **MUST preserve
  the `auth_failed` (amber) ≠ `failed` (red) distinction** (forge SC#4: amber +
  KeyRound vs red + XCircle). Map: queued→neutral/slate, running→blue (+spin),
  completed→green, failed→red, stopped→neutral/stone, auth_failed→amber.
- **D-10:** **CodePulse's design system is authoritative** where it conflicts with
  forge's styling (effective radius, Geist body / JetBrains Mono code fonts,
  spacing, Lucide-only icons, Matrix-Emerald theme per CLAUDE.md + Phase 71
  UI-SPEC). Preserve forge's component structure and master-detail layout; adapt
  the skin. Forge fidelity does not override the CodePulse design system.

### Layout (carried from the 1:1 port intent)
- **D-11:** Preserve forge's **master-detail layout**: `JobList` on the left
  (scrollable, ~280px), `JobDetail` on the right, with `selectedId` + `onSelect`
  driving selection — same interaction the forge `JobsRoute` uses. Wrap the page
  body in CodePulse's page conventions (`SectionErrorBoundary` around the
  list/detail regions; standard page header).

### Claude's Discretion
- Exact non-colliding Lucide icon for the Forge nav entry (D-06).
- Field ordering / grouping inside the metadata fields panel (D-02), and whether
  to format `capabilities` (JSON string) and timestamps for readability.
- Loading skeletons: reuse forge's `Skeleton`-based loading rows in `JobList`
  (already shadcn-compatible in CodePulse) vs CodePulse's standard loading idiom.
- Relative-time helper: keep forge's `relativeTime()` or swap to an existing
  CodePulse formatter in `src/lib/formatters.ts` if one fits.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 78 consumer contract (the data this UI renders)
- `.planning/phases/078-forge-emitter-convex-schema/078-CONTEXT.md` — locked
  decisions D-01..D-08; especially **D-04** (`forgeJobs` columns), **D-06**
  (`forgeWorkspaces` columns), **D-07** (read-query contract for P79), **D-08**
  (read-only / one-way).
- `convex/forge.ts` — live query API this phase consumes: `listJobs({hostId?})`
  (newest-first), `getJob({hostId, forgeJobId})` (**requires BOTH** — selection
  must carry `hostId`), `listWorkspaces({hostId?})`. Also the upsert mutations
  define the exact persisted row shape.
- `convex/schema.ts` — `forgeJobs` + `forgeWorkspaces` table definitions /
  indexes (`by_forgeJobId`, `by_host_status`, `by_updatedAt`, `by_host_workspaceId`).

### Components to port (source of truth for structure)
- `C:\Users\mandr\forge\web\src\components\StatusBadge.tsx` — 6-status
  color/icon/label map; the SC#4 auth_failed≠failed contract.
- `C:\Users\mandr\forge\web\src\components\JobList.tsx` — list/cards, empty state,
  loading skeletons, `relativeTime()`, `AgentIcon`. (Strip delete-X / Clear-failed.)
- `C:\Users\mandr\forge\web\src\components\JobDetail.tsx` — header + status badge.
  (Strip Stop Job, Logs tab, Files & Preview tab — keep header, add metadata panel.)
- `C:\Users\mandr\forge\web\src\types.ts` — `Job` / `JobStatus` / `Workspace`
  client type contracts the components expect.

### CodePulse integration points & design system
- `src/App.tsx` — route table (add `<Route path="/forge" ...>` inside
  `DashboardLayout`); follow lazy-load convention for heavy pages.
- `src/layouts/DashboardLayout.tsx` — `navItems` (add CONSOLE entry) +
  `iconComponents`/`iconMap` (register the chosen icon).
- `.planning/phases/071-unified-design-system/UI-SPEC.md` — CodePulse design
  tokens / conventions that are authoritative per D-10.
- `CLAUDE.md` (repo) — styling section: Matrix-Emerald theme, status colors,
  Geist/JetBrains Mono, Lucide-only, shadcn New York primitives.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- shadcn primitives already exist in BOTH repos with the same names —
  `src/components/ui/{button,scroll-area,skeleton,tabs}.tsx` — so the port is
  mechanically clean (imports resolve to CodePulse's `@/components/ui/*`).
- `useQuery(api.forge.*)` via Convex gives live auto-updating subscriptions for
  free — no polling needed (forge's original used `apiFetch` polling).
- `SectionErrorBoundary` (`src/components/`) — wrap the list/detail regions.
- `src/lib/formatters.ts` — candidate home for / replacement of `relativeTime()`.
- Per-domain hook convention: add `src/hooks/useForge.ts` wrapping
  `useQuery(api.forge.listJobs) ?? []` etc. (mirrors `useExecutions`, etc.).

### Established Patterns
- Page composition: `src/pages/<Page>.tsx` → import/lazy in `App.tsx` → `<Route>`
  → nav entry in `DashboardLayout`. Master-detail precedent: `Executions.tsx`,
  `Agents`.
- Hooks return `useQuery(...) ?? []` to absorb the undefined loading state.

### Integration Points
- **Type adapter (IMPLEMENTATION NOTE — planner decides the "how"):** Convex docs
  come back keyed on `forgeJobId` + `hostId` (plus Convex `_id`/`_creationTime`),
  while the ported forge components expect a `Job` keyed on `id` with a `logFile`
  field that the P78 schema does NOT persist. Plan a small adapter mapping Convex
  rows → the forge `Job`/`Workspace` shape (or adjust component props). Watch:
  `JobDetail`'s `FilesPanel` referenced `logFile`/workspace `rootPath` — both gone
  with the stripped tabs, so the adapter only needs the metadata fields.
- **Selection must carry `hostId`:** `getJob` requires `{hostId, forgeJobId}`, and
  cards from a merged multi-host list aren't unique by `forgeJobId` alone. Key
  selection on the `(hostId, forgeJobId)` pair (or just render detail from the
  already-loaded `listJobs` row and skip a `getJob` round-trip).
- Nav: register the new icon string in `DashboardLayout`'s `iconComponents` map or
  it renders blank.

</code_context>

<specifics>
## Specific Ideas

- auth_failed must stay visually distinct from failed (amber + KeyRound vs red +
  XCircle) — non-negotiable carry-over from forge SC#4, even after re-skinning to
  CodePulse tokens.
- Host badge on each job card so Desktop vs laptop is obvious at a glance (Larry
  runs both per P78 D-04).
- Page should feel native to CodePulse, not like an embedded forge iframe — same
  fonts, radius, spacing, status palette as the rest of the dashboard.

</specifics>

<deferred>
## Deferred Ideas

- **Stop / delete / clear-failed job controls** → Phase 80 (command bridge). The
  forge components already contain these; they were intentionally stripped here.
- **Live log tail (Logs tab)** → Phase 81. Needs a backend log-streaming path that
  doesn't exist yet.
- **Files & artifact preview (Files & Preview tab)** → Phase 82. Needs file
  listing + artifact endpoints.
- **Host selector / filter UI and per-host grouping** → possible later UX polish
  if the merged-list + badge approach gets noisy. Not needed now.
- **New Job launch (NewJobModal)** → P80+. No launch surface in a read-only phase.

</deferred>

---

*Phase: 79-forge-ui-tab-read-only-render*
*Context gathered: 2026-06-15*
