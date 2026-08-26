# Phase 124: Shell & Information Architecture - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `124-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-08-20
**Phase:** 124-shell-information-architecture
**Areas discussed:** Regroup map, Header height vs the Phase 120 overflow fix, Count badges + system chip data, Collapse behaviour + breadcrumb source

---

## Findings presented before the discussion

Three live-code findings reframed the phase before any option was offered:

1. **A fixed 48px header collides with a control-proven fix.** `DashboardLayout.tsx:551` is
   `min-h-14` + `flex-wrap`, changed *from* a fixed `h-14` by POLISH-06 (120-07). The in-code
   comment records the measurement: 981px combined min-content vs 660px available at a 900px
   viewport, with the excess silently clipped by a distant ancestor. `120-GEOMETRY-EVIDENCE.md`
   holds a revert-and-refail control.
2. **The sidebar is 5 groups, not 4, and System does not exist.** Live count from
   `navRegistry.ts`: COMMAND 12, GRAPHS 7, AGENTS 5, OBSERVE 13, ACTIVITY 7 = 44 items.
3. **TOKEN-05 was falsely marked Partial.** `REQUIREMENTS.md:119` and
   `todos/pending/forgepage-pageheader-adoption.md` both described a gap that 123-06 had already
   closed at `ForgePage.tsx:154`.

---

## Pre-phase bookkeeping — TOKEN-05

| Option | Description | Selected |
|--------|-------------|----------|
| Fix it now, outside the phase | Mark Complete with evidence, move the todo, one commit | ✓ |
| Fold into Phase 124 | Carry as a folded todo and close during the phase | |
| Leave it, note only | Record the discrepancy and defer to a milestone-close audit | |

**User's choice:** Fix it now, outside the phase.
**Notes:** Done before the discussion continued. Re-derived the requirement's whole population
rather than only its named gap — all 47 non-test page files scanned, exactly one (`Chat.tsx`, a
documented out-of-scope exclusion) lacks `PageHeader`; `EmptyState.tsx` ships as a shared
primitive. Both halves hold, so the mark is `[x]` not `[~]`. Commit `4f1e386`, 2 files.

---

## Regroup map

### Where the GRAPHS cluster (7 items) lands

| Option | Description | Selected |
|--------|-------------|----------|
| Split by intent | Viz (Graphs Hub, Loom, KG Explorer, Workspace Map) → Observe; inventory (Tool Galaxy, MCP Inventory, Capabilities) → System | ✓ |
| All 7 into Observe | Simplest, preserves adjacency, but Observe becomes 20 of 44 items | |
| All 7 into System | Keeps Observe lean, but buries surfaces you actually browse | |

### Where the ACTIVITY cluster (7 items) lands

| Option | Description | Selected |
|--------|-------------|----------|
| Mostly Agents, Automation to System | Her output and channels go to Agents; schedules/crons are plumbing | ✓ |
| All 7 into Agents | One clean move, Agents becomes 12 | |
| Split Agents / Command | Sharper semantics, pushes Command to 15, scatters the cluster three ways | |

### What System contains, and whether Settings moves

| Option | Description | Selected |
|--------|-------------|----------|
| Health + inventory, Settings stays footer | Sketch §8 keeps the footer in the flex column; POLISH-06 already fixed the 900px collision | ✓ |
| Health + inventory, Settings moves in | More discoverable, at the cost of re-testing proven geometry | |
| Health only, keep it small | 4-5 items; pushes the imbalance back onto Observe | |

### How much of the mapping is locked

| Option | Description | Selected |
|--------|-------------|----------|
| Lock all 44 rows explicitly | Planner transcribes; gives criterion 3 an exact expected value | ✓ |
| Lock the domain rules, planner assigns | Less context now, one more review round later | |
| Lock rules + within-domain ordering | Most complete, largest CONTEXT | |

### The duplicate `Analytics` label

Surfaced mid-area: `uniq -d` over `navRegistry.ts` returns exactly one duplicated label, and the
regroup puts the two items in *different* domains. `CommandPalette.tsx:66` renders nav items with
no `value` prop, so cmdk falls back to identical text content.

| Option | Description | Selected |
|--------|-------------|----------|
| Rename both, verify palette | Label-only change plus a real before/after reproduction of the cmdk behaviour | ✓ |
| Rename only, palette out of scope | Disambiguate labels, file the palette question as a todo | |
| Leave both as-is | Domains already disambiguate them visually | |

**Notes:** The palette half was explicitly framed as a *reading of the code, not a measurement*.
CONTEXT.md D-05 carries a rider requiring the plan to reproduce the behaviour before and after,
and to drop the palette half rather than claim a fix if the repro shows no defect.

---

## Header height vs the Phase 120 overflow fix

### Fixed 48px vs the proven wrap

| Option | Description | Selected |
|--------|-------------|----------|
| Hard 48px, gated on measurement | Build the consolidated header, re-run 120's measurement, go hard only if it clears with margin | ✓ |
| Hard 48px unconditionally | Trust that 8 controls → 3 removes the overflow by construction | |
| Keep min-height + wrap | Preserves 120's mechanism; 48px in practice but not by contract | |

### Where brain badge / bell / user menu go

| Option | Description | Selected |
|--------|-------------|----------|
| Brain badge, bell and user menu stay visible | Right zone of six; only theme/privacy/audio/CRT/help move into `⋯` | ✓ |
| Strict sketch: everything else into `⋯` | Chip + E-STOP + `⋯` only; buries live state one click deep | |
| Fold brain + alerts into the system chip | Right zone of three, nothing buried; couples independent concerns | |

### The telemetry pill and the SYS/LAT readouts

| Option | Description | Selected |
|--------|-------------|----------|
| Pill dies, SYS/LAT relocate | Pill is kill-list shape twice (pulse dot + cyan wallpaper), already banned by POLISH-01; SYS/LAT are real data and move rather than die | ✓ |
| Pill dies, SYS/LAT die too | Simplest left zone; removes numbers you may read at a glance | |
| Pill dies, SYS/LAT feed the chip | Numbers become the chip's tooltip | |

### The 375px contract

| Option | Description | Selected |
|--------|-------------|----------|
| Hamburger + E-STOP + `⋯`, command bar hidden | Mirrors today's breakpoints, so the mobile drawer keeps working unchanged | ✓ |
| Breadcrumb collapses to leaf only | Keeps orientation, costs width | |
| Defer — measure first, decide in the plan | Fewer assumptions now | |

---

## Count badges + system chip data

Two scouting findings were presented first: `convex/health.ts` exposes **no public query** (only
two `internalMutation`s and an `httpAction`), so the system chip has nothing to read; and
`convex/alerts.ts:109 countBySeverity` does an unbounded `.collect()`, which at *shell* level can
blank the whole app rather than one page (Phase 121's `useQuery`-throw finding).

### Which items get badges

| Option | Description | Selected |
|--------|-------------|----------|
| Inbox and Alerts only | The two that mean "something is waiting for you"; two shell subscriptions | ✓ |
| Inbox, Alerts, Tasks, Forge | More at-a-glance state; four subscriptions; conflates activity with demands | |
| Rule-based, planner derives | CONTEXT states the rule, planner enumerates | |

### The system chip's source

| Option | Description | Selected |
|--------|-------------|----------|
| Compose client-side from what exists | `alerts.countBySeverity` + `useConvex().connectionState()`; follows 122 D-16's precedent | ✓ |
| New derived Convex query | Cleaner long-term; real backend work in a presentation-only phase | |
| Render the chip, defer its logic | Minimal now; a chip that under-reports at first | |

### Badge honesty

| Option | Description | Selected |
|--------|-------------|----------|
| No badge until resolved, dimmed on failure | A `0` that means "not loaded" is the fabricated-confidence defect POLISH-04 exists to prevent | ✓ |
| Skeleton chip while loading | Avoids layout jitter; visible loading artefact in the shell | |
| Reuse the six-state vocabulary | Most consistent with the milestone; heaviest for a count | |

### Blast radius

| Option | Description | Selected |
|--------|-------------|----------|
| Boundary each **and** bound the query | Boundary stops the blanking, bounding stops the timeout that triggers it | ✓ |
| Boundary each, leave the query alone | No backend edits; relies on the net | |
| One boundary around the whole chrome | Simpler; a failure takes E-Stop's neighbours down too | |

---

## Collapse behaviour + breadcrumb source

Scouting fact presented first: six param routes (`/sessions/:id`, `/quality/:profileId`,
`/war-room/:roomId`, `/hr/roster/:agentId`, `/hr/onboarding/:catalogId`, `/hr/teams/:teamId`)
have no `navRegistry` entry to derive a breadcrumb from, and
`DashboardLayout.test.tsx:194` holds an abandoned `test.todo` asserting the old 240px width.

### Do both collapse mechanisms survive

| Option | Description | Selected |
|--------|-------------|----------|
| Both, rail collapse wins | Rail at 48px overrides and holds domain state; nothing in use today is removed | ✓ |
| Per-domain only, retire the rail | Simpler state model, closer to the sketch; removes a persisted behaviour | |
| Rail only, static domain headers | Smallest change, but would not satisfy SHELL-02 as written | |

### Persistence and default

| Option | Description | Selected |
|--------|-------------|----------|
| localStorage, all open by default | One key, matches the existing `try`/`catch` pattern; nothing hidden after the regroup | ✓ |
| localStorage, active domain only | Calmest first view; hides 30+ items from someone still learning the grouping | |
| Session-only, all open | No new persistence; loses the preference between sessions | |

### Breadcrumb resolution

| Option | Description | Selected |
|--------|-------------|----------|
| Derive from registry, route may override | 44 mapped routes free and self-correcting; six detail routes supply their own trail | ✓ |
| Pure registry, detail routes show the parent | Zero maintenance; doesn't name the record you're looking at | |
| Every route declares its own | Most control; maintains the domain name in two places and lets them drift | |

### Verifying the width change

| Option | Description | Selected |
|--------|-------------|----------|
| Implement the `test.todo` at 232px + re-check 900px | Turns an abandoned assertion into a real one; re-measures rather than infers | ✓ |
| Implement the todo only | Reasonable inference, one less browser run | |
| Delete the todo, verify visually | Fewest moving parts; leaves the width unguarded | |

---

## Claude's Discretion

- Whether 124 gets a blocking operator visual checkpoint before close. Recommended by default —
  122 and 123 both used one, and 123's D-18 surfaced two real defects beyond the question it
  asked. 124 touches every route's chrome.
- How the before/after route-list diff for success criterion 3 is produced. Must compare the
  **route set**, not the group structure, since the group structure is what changes.
- Within-domain item ordering. The domain assignment is locked; the order inside each domain is
  not, subject to preserving the adjacencies `navRegistry.ts` comments already defend.

## Deferred Ideas

- The Signal Horizon, the Pulse ECG hero, and Ástríðr's serif voice — SIGNAL-01/02/03, Phase 125.
  124 leaves the 2px slot under the header clean rather than absorbing it into the header border.
- SYS/LAT's final destination (overflow menu vs the Dashboard instrument cluster) — decided to
  relocate, but where is left to the plan and may sequence better with Phase 125's hero work.
