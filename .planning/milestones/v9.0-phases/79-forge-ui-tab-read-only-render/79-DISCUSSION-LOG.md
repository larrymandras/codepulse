# Phase 79: Forge UI Tab (read-only render) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-15
**Phase:** 79-forge-ui-tab-read-only-render
**Areas discussed:** Read-only boundary, Multi-host handling, Nav placement & route, Visual fidelity

---

## Read-only boundary

### Action controls (Stop Job, delete-X, Clear failed)

| Option | Description | Selected |
|--------|-------------|----------|
| Strip entirely | Remove buttons/handlers from ported components; cleanest read-only surface; P80 re-adds them | ✓ |
| Render disabled | Keep buttons visible but disabled with a tooltip | |
| Keep, no-op | Keep buttons that do nothing / hit unwired endpoint | |

**User's choice:** Strip entirely

### JobDetail tabs (Logs → P81, Files & Preview → P82)

| Option | Description | Selected |
|--------|-------------|----------|
| Metadata only | Header + fields panel (agent, mode, status, pid, exitCode, timestamps, workspace, model, artifactCount); no Logs/Files tabs | ✓ |
| Tab shells 'coming soon' | Keep tabs as placeholder shells with a coming-in-P81/P82 message | |
| Header only | Just the JobDetail header; wastes detail pane | |

**User's choice:** Metadata only
**Notes:** Together these make P79 a pure render surface — all mutation/streaming machinery deferred to P80–82.

---

## Multi-host handling

### List presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Merged + host badge | One newest-first list across hosts; each card shows a host badge | ✓ |
| Host selector/filter | Dropdown/segmented control to filter to one host | |
| Grouped by host | Section headers per host | |

**User's choice:** Merged + host badge

### Empty state

| Option | Description | Selected |
|--------|-------------|----------|
| Port forge's empty state | Reuse "No jobs yet" but drop the "Launch your first job" line | ✓ |
| Forge-setup hint | "No Forge jobs yet — run a job in Forge with the emitter on." | |
| Keep as-is | Keep original launch-button copy (references nonexistent control) | |

**User's choice:** Port forge's empty state

---

## Nav placement & route

### Group + route

| Option | Description | Selected |
|--------|-------------|----------|
| CONSOLE group, /forge | Alongside Agent Console / Live Run / Executions / Build | ✓ |
| OBSERVE group, /forge | Alongside Dashboard / Analytics / Infrastructure | |
| New 'FORGE' group | Its own sidebar group | |

**User's choice:** CONSOLE group, /forge

### Label + icon

| Option | Description | Selected |
|--------|-------------|----------|
| 'Forge' + hammer-ish icon | Label "Forge"; distinct non-colliding Lucide glyph (hammer used by Build) | ✓ |
| 'Forge Jobs' + list icon | Label "Forge Jobs"; list/activity glyph | |
| You decide | Pick label + icon at planning time | |

**User's choice:** 'Forge' + hammer-ish icon
**Notes:** Build already uses `hammer` — planner must choose a distinct icon (flame/anvil/etc.).

---

## Visual fidelity

### Status colors

| Option | Description | Selected |
|--------|-------------|----------|
| Map to CodePulse tokens | Re-skin the 6 statuses to CodePulse status colors/tokens; keep auth_failed≠failed | ✓ |
| Keep forge palette 1:1 | Port exact hex values unchanged; off-theme | |
| You decide | Map where equivalents exist, keep hex elsewhere | |

**User's choice:** Map to CodePulse tokens

### Design authority on conflict

| Option | Description | Selected |
|--------|-------------|----------|
| CodePulse system wins | CodePulse design system authoritative; forge layout preserved, skin adapted | ✓ |
| Forge fidelity wins | Preserve forge look exactly; change only what's required to compile | |

**User's choice:** CodePulse system wins
**Notes:** Refines ROADMAP's "port ~1:1" to structure/layout 1:1, skin adapted to CodePulse.

---

## Claude's Discretion

- Exact non-colliding Lucide icon for the Forge nav entry.
- Field ordering/grouping in the metadata fields panel; formatting of `capabilities` JSON + timestamps.
- Loading skeletons: reuse forge's `Skeleton` rows vs CodePulse standard idiom.
- Relative-time helper: keep forge's `relativeTime()` vs an existing `src/lib/formatters.ts` formatter.
- Type adapter approach (Convex doc → forge `Job` shape) and whether detail renders from the loaded list row vs a `getJob` round-trip.

## Deferred Ideas

- Stop / delete / clear-failed controls → Phase 80 (command bridge).
- Live log tail (Logs tab) → Phase 81.
- Files & artifact preview (Files & Preview tab) → Phase 82.
- Host selector/filter UI and per-host grouping → later UX polish if merged list gets noisy.
- New Job launch (NewJobModal) → P80+.
