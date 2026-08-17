# Phase 111: Mission Board - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn the leftover `JobsPanel`/`subagentJobs` surface into a **truthful post-hoc history board**
of background subagent missions, and remove every affordance across the app that asserts a
mission state the data cannot support.

**This boundary is a deliberate narrowing of ROADMAP.md's original text, made 2026-08-10 on
evidence.** The roadmap (`ROADMAP.md:806-808`) described a *live* mission board "built entirely
on data that streams today", frontend-only. A live probe of the self-hosted instance falsified
that premise: nothing has streamed for ~34 days, duration is not derivable, and one requirement
has no data path at all. See `<constraints>` for the evidence. The live board is not abandoned —
it moves to a new cross-repo phase that first repairs the astridr emitter (D-02).

</domain>

<decisions>
## Implementation Decisions

### Scope

- **D-01:** Phase 111 ships a **history** board over terminal-state rows only, frontend-only,
  no astridr-repo work. Operator-chosen 2026-08-10 over the cross-repo alternative.
- **D-02:** Emitter revival — real `submittedAt`, non-terminal (`queued`/`running`) states, and a
  mission↔tool correlation key — is **out of scope here** and becomes its own cross-repo phase,
  logged to the backlog. That phase, not this one, owns the genuinely live board.

### Requirement dispositions

- **D-03:** **MISSION-02 is deferred**, not attempted. It is marked blocked-on-astridr in
  REQUIREMENTS.md with the evidence inline, and reassigned to the D-02 emitter phase. Leaving it
  `Pending` against a phase that provably cannot deliver it would make the traceability table lie.
- **D-04:** **MISSION-01 splits.** Its satisfiable half — honest per-mission status and history
  rendering — ships here. Its *duration* and *orphan-recovery* halves defer with D-02: duration is
  unbackable (`submittedAt` is a synthetic copy of `finishedAt`), and orphan recovery is vacuous
  while no `running` row can exist.
- **D-05:** **MISSION-03 is this phase's acceptance spine** and is fully satisfiable. Where D-04
  and D-03 defer work, MISSION-03 governs what the UI may claim in the meantime.

### The honesty fixes (the actual build)

- **D-06:** The fix is applied as a **class, to every consumer of this data**, not to `JobsPanel`
  alone. There are two live consumers, and the second is the more visible: `LiveRun.tsx:251`
  (`<JobsPanel />`) and `Chat.tsx:1054` (`<ActiveAgentsPanel />`).
- **D-07:** `ActiveAgentsPanel.tsx:35` filters `job.status === "running"` against a table that
  structurally never receives a `running` row, so it renders **"No agents running." permanently and
  unconditionally** — a positive claim its data source cannot falsify. This is a live defect on the
  Chat page, and closing it is in scope. It must stop asserting a state it cannot know (either
  removed, or re-sourced from a feed that does carry liveness).
- **D-08:** The `queued` and `running` entries in `JobsPanel.tsx:26-32`'s `stateIcon` map are
  removed — dead affordances for states the emitter never sends.
- **D-09:** **No duration is rendered anywhere.** `formatElapsed` (`JobsPanel.tsx:37-48`) currently
  means "time since finished" for terminal rows and "elapsed" for running ones under one label; it
  is replaced by an explicit, single-meaning "finished X ago".
- **D-10:** The surface is **labelled as history**, not live. The pulsing dot and "BACKGROUND JOBS"
  live chrome (`JobsPanel.tsx:62-64`) go, because they imply streaming that is not happening.

### Deliberate non-goals

- **D-11:** **Do NOT add `subagentJobs` to `RETENTION_DAYS`** in this phase. Verified absent from
  `convex/retention.ts` (control: `toolExecutions` present) both before and after 110-03 landed.
  The table is not growing — 7 rows, none since 2026-07-07 — so bounding buys nothing today, and
  `retention.ts` is Phase 110's active file. Bounding moves to the D-02 emitter phase, where a
  revived firehose makes it necessary. Pre-emptive bounding of *live* new tables remains the house
  precedent (`retention.ts:39-48, 79-91`); this is the case that precedent does not cover.
- **D-12:** `listRecent`'s unbounded `.collect()` (`subagentJobs.ts:88`) is **left as-is** and noted
  for the D-02 phase. It is a real hazard only once the emitter revives; at 7 rows it is not worth
  a change that would collide with 110's surface.
- **D-13:** `MissionTimelinePanel` (`Chat.tsx:1124`) is **not this phase's surface** despite the
  name — it renders reminders and events, not `subagentJobs`. Any new naming for the mission board
  must not collide with it.

### Claude's Discretion

Visual treatment of the history board (grouping, ordering beyond newest-first, empty-state copy)
and the specific resolution of D-07 — whether `ActiveAgentsPanel` is deleted outright or re-sourced
from a feed that genuinely carries liveness — are open at planning time, provided MISSION-03 holds.

</decisions>

<specifics>
## Specific Ideas

The honesty standard is the one already set by v13.0's `{profileId:"unknown"}` catch and reaffirmed
in MISSION-03: **absent, not fabricated.** A panel that says "No agents running." when it cannot
know is a stronger version of the same defect than a zeroed figure — it is an unfalsifiable
positive claim, not merely an empty one.

</specifics>

<constraints>
## Evidence Behind the Boundary Narrowing

Probe: `npx convex run subagentJobs:listRecent --url http://127.0.0.1:3210`, 2026-08-10T20:49Z.
`listRecent` collects the whole table then slices 50, so 7 rows returned = 7 rows total.

| Fact | Value | Consequence |
|---|---|---|
| Rows in `subagentJobs` | 7, ever | — |
| Status distribution | `{failed:2, cancelled:3, completed:2}` | zero `queued`, zero `running` |
| `submittedAt === finishedAt` | 7 of 7 | duration not derivable |
| Newest row | 2026-07-07 (13h window on 07-06/07) | nothing emitted in ~34 days |
| Rows with `sessionId`/`traceId` | 0 | no join key to tool activity |
| `subagentJobs` in `retention.ts` | absent (control: `toolExecutions` present) | the 7 rows are lifetime history, not a pruned window |

Corroborating code — the comments agreed with the data, but the data is the evidence:

- `convex/runtimeIngest.ts:594-596` — routes a background `delegate_task` **TERMINAL-state** event
  ("completed/failed/cancelled — never queued/running, those live only in Supabase").
- `convex/subagentJobs.ts:13-16` — "the live emitter does not currently populate" `submittedAt`;
  the upsert falls back to `finishedAt ?? now`.
- `convex/schema.ts:562-586` — `toolExecutions` carries `sessionId`/`toolName`/`traceId`/`round`
  but **no `jobId`**; `schema.ts:1028-1041` — `subagentJobs` carries no `sessionId`/`traceId`.
  `jobId` exists in only two tables repo-wide (`jobLifecycle:439`, `subagentJobs:1029`).
- `convex/retention.ts:34` — `toolExecutions: 14`, so even a retroactive join key could not recover
  tool activity for the July missions.

</constraints>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and scope
- `.planning/REQUIREMENTS.md` lines 48-50 — MISSION-01/02/03 as originally written; lines 93-95 the
  traceability rows this phase must correct per D-03/D-04.
- `.planning/ROADMAP.md:804-817` — Phase 111's original entry. **Its "Depends on: Nothing
  (frontend-only)" and "data that streams today" claims are falsified** — correct in place per the
  Stale Docs rule when this phase's scope is recorded.

### Surfaces being changed
- `src/components/JobsPanel.tsx` — the board itself (D-08, D-09, D-10).
- `src/components/control-center/ActiveAgentsPanel.tsx` — the permanently-false panel (D-07).
- `src/pages/LiveRun.tsx:251` and `src/pages/Chat.tsx:1054` — the two mount sites (D-06).
- `src/hooks/useSubagentJobs.ts` — shared hook both consumers read.

### Backend contract (read-only for this phase)
- `convex/subagentJobs.ts`, `convex/runtimeIngest.ts:593-625`, `convex/schema.ts:1028-1041`.
- `astridr-repo/docs/astridr-contract.md` §2.31 — the emitter contract. **Note the path: this doc
  lives in astridr-repo, not codepulse**, despite codepulse code comments citing it bare.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `EntityRow` + `StatusBadge`: already compose the row; the history board keeps this shape.
- `useSubagentJobs()`: defaults to `[]` internally, never returns `undefined` — both consumers
  already rely on this, so no loading-state work is needed.
- `BlackboardPanel`: `JobsPanel` was built from its header/empty-state/list template; the history
  variant should stay within that idiom.

### Landmines
- **Two consumers, one query.** `ActiveAgentsPanel` reuses `api.subagentJobs.listRecent` directly
  rather than going through `JobsPanel`. Fixing one leaves the other lying (D-06).
- **Seconds-vs-ms epoch.** `subagentJobs` timestamps are Unix **seconds** (~1.78e9), unlike
  `swarmTasks`. `JobsPanel.tsx:40` and `MissionTimelinePanel.tsx:70` both carry defensive
  `< 1e12` normalization; keep it. Dividing by 1000 yields 1970 dates and makes threshold
  comparisons pass vacuously.
- **`status: d.status ?? "unknown"`** (`runtimeIngest.ts:616`) — an `"unknown"` status can reach the
  table. The board must render it honestly rather than mapping it to a plausible-looking state.

</code_context>

## Open Questions for Planning

1. D-07's resolution — delete `ActiveAgentsPanel`, or re-source it from a feed that genuinely
   carries liveness? If re-sourced, which feed, and does that pull astridr work back into scope
   (which D-01 excludes)?
2. Does the history board keep its current mount at `LiveRun.tsx:251`, move to its own route, or
   both? No nav-registry decision has been made.
