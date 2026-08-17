# Phase 120 Plan 04 — Badge Inventory (D-17 work-list for Phase 122)

**Produced:** 2026-08-17, by 120-04. This is a measured work-list, not a discovery task — Phase
122's TOKEN-05 shared `StatusBadge` primitive should be able to start from this file instead of
re-deriving it.

**Correction to the plan's own numbers, made honest here rather than silently:** the plan and
`120-CONTEXT.md` both state `src/components/StatusBadge.tsx` has **19** consumers. Re-deriving the
import list against live code (§2 below) found **22** — the earlier count missed three files that
import via the `../components/StatusBadge` relative form (`pages/Security.tsx`,
`pages/Quality.tsx`, `pages/McpInventory.tsx`) because the original search pattern only matched
`@/components/StatusBadge`, `./StatusBadge` and `../StatusBadge`. §2's command and raw output are
below so this is checkable, not asserted.

---

## §1 — The two badge implementations, and what this phase did to each

| File | Render sites | Fill law (D-16) | Vocabulary (D-15) |
|---|---|---|---|
| `src/components/StatusBadge.tsx` (61 lines pre-edit) | 22 consumer files (re-derived, §2) | `ok`/`warn`/`info` semantics converted from `bg-(--status-*) text-white` to `text-(--status-*) border border-(--status-*)/40 bg-transparent`; `error` kept filled (`bg-(--status-error) text-white`); `idle` untouched (`bg-muted`, already quiet) | Exactly one label changed: `completed`'s `"DONE"` → `"SUCCEEDED"`. All 21 other `legacyMap` entries, across five vocabularies, are untouched. |
| `src/components/forge/ForgeStatusBadge.tsx` (123 lines pre-edit) | 3 files / 5 render call sites: `forge/ForgeJobList.tsx:109,235`, `forge/ForgeJobDetail.tsx:113,135`, `forge/ForgeMetadataPanel.tsx:95` | All 8 non-`failed` entries (`queued`, `running`, `completed`, `stopped`, `auth_failed`, `pending`, `stopping_pending`, `expired`) plus the unknown-status fallback chip converted from a saturated `bg-*-900/N` fill to `border border-[...]/N text-[...] bg-transparent`; `failed` kept filled (`bg-red-900/60`) | Two labels changed: `completed` "Completed"→"Succeeded", `stopped` "Stopped"→"Cancelled". Five labels kept as documented exceptions (§4). `colorScheme` derivation, `data-status`/`aria-label`, `animate-spin` condition and icon choices are byte-identical to before this plan. |

There is no third implementation of a **job-status** badge in the repo. `skills/IntakeStatusBadge.tsx`
and `src/components/WebhookStatusBadge.tsx` are separate, unrelated status-chip families — see §3.

---

## §2 — Sites that changed by PROPAGATION, not by direct edit

D-17, as written in `120-CONTEXT.md`, lists `JobsPanel`, `CronJobList`, `RosterTable`, `RoomListItem`,
`IdeationRow`, `FactsTable`, `hr/AgentCard`, `hr/detail/DetailRuntimeTab` and `BlackboardPanel` as
"remaining sites, inventory for 122." **That boundary could not hold as written** — all nine of them
render through the exact same `src/components/StatusBadge.tsx` that Executions renders through, and
there is no mechanism to give Executions the quiet law without every other consumer of the same
lookup table receiving it too. This is not a scope overrun this plan chose; it is a fact about the
component graph that D-17 did not account for when it was written. The FILL law (D-16) therefore
reached all 22 sites below as an unavoidable consequence of editing one shared component. The
VOCABULARY change (D-15) did NOT propagate the same way — only one label (`completed`) changed in
the shared file, so none of these files' actual wording changed except wherever they render a job
`completed` status.

**Command used to re-derive the consumer list** (fixed-string-safe form; run from repo root):

```
rg --no-heading -n "from [\"'][^\"']*\bStatusBadge[\"']" src
```

**Raw output** (23 lines; 22 are real consumers, 1 is this plan's own new same-directory test file,
which imports `StatusBadge` to test it rather than to render a domain status and is excluded from
the table below):

```
src\pages\Dreaming.tsx:17:import { StatusBadge } from "@/components/StatusBadge";
src\components\BlackboardPanel.tsx:21:import StatusBadge from "./StatusBadge";
src\pages\McpInventory.tsx:14:import StatusBadge from "../components/StatusBadge";
src\pages\Memory.tsx:28:import { StatusBadge } from "@/components/StatusBadge";
src\pages\MeetingBot.tsx:14:import { StatusBadge } from "@/components/StatusBadge";
src\pages\Security.tsx:14:import StatusBadge from "../components/StatusBadge";
src\pages\Quality.tsx:6:import { StatusBadge } from "../components/StatusBadge";
src\pages\WarRoom.tsx:29:import { StatusBadge } from "@/components/StatusBadge";
src\pages\WhatsApp.tsx:18:import StatusBadge from "@/components/StatusBadge";
src\components\CronJobList.tsx:5:import { StatusBadge } from "@/components/StatusBadge";
src\components\ExecutionTable.tsx:4:import StatusBadge from "./StatusBadge";
src\components\FactsTable.tsx:12:import { StatusBadge } from "@/components/StatusBadge";
src\components\IdeationRow.tsx:3:import { StatusBadge } from "@/components/StatusBadge";
src\components\hr\AgentCard.tsx:4:import { StatusBadge } from "@/components/StatusBadge";
src\components\hr\AgentDetailSheet.tsx:29:import { StatusBadge } from "@/components/StatusBadge";
src\components\hr\RosterOrgChart.tsx:16:import { StatusBadge } from "@/components/StatusBadge";
src\components\hr\RosterTable.tsx:11:import { StatusBadge } from "@/components/StatusBadge";
src\components\JobsPanel.tsx:25:import StatusBadge from "./StatusBadge";
src\components\hr\detail\DetailRuntimeTab.tsx:1:import { StatusBadge } from "@/components/StatusBadge";
src\components\RoomListItem.tsx:9:import { StatusBadge } from "@/components/StatusBadge";
src\components\StatusBadge.test.tsx:13:import { StatusBadge } from "./StatusBadge";   [EXCLUDED — this plan's own test file]
src\components\SwarmTaskDetail.tsx:18:import StatusBadge from "./StatusBadge";
src\components\WarRoomTaskCard.tsx:9:import { StatusBadge } from "@/components/StatusBadge";
```

**Per-site vocabulary table** (re-derived by reading each render call, not assumed from the import
alone — several sites pass a literal semantic value directly rather than a domain status string):

| File:line | Vocabulary fed to the badge | D-17 listed it as "remaining"? |
|---|---|---|
| `BlackboardPanel.tsx:105` | Swarm task state (`task.state`: `claimed`/`verifying`/`done`/`verify_rejected`) | Yes |
| `CronJobList.tsx:101` | Direct semantic literal (`"ok"`/`"idle"` + custom `ACTIVE`/`DISABLED` label) — bypasses `legacyMap` entirely | Yes |
| `ExecutionTable.tsx:171` | Job/execution status (`row.status`) | No — this is the milestone's named target (Executions) |
| `ExecutionTable.tsx:177` | Execution MODE (`modeData.mode`: `strict`/`adaptive`/`standard`/`filler`/`stalled`) — same component, second render per row | No, but shares the file with the target above |
| `FactsTable.tsx:120` | Direct semantic literal (`"idle"` + fact-category label) — not a status at all, a category tag | Yes |
| `WhatsApp.tsx:252,255,258,262,269,271,494` | Direct semantic literals (`"ok"`/`"error"`/`"warn"`/`"idle"` + custom connection-state labels) — bypasses `legacyMap` | No — not in D-17's list at all; found by re-derivation |
| `WarRoom.tsx:404` | Voice call state (`selectedRoom?.status`: `live`/`ended`/`joining`) | No — not in D-17's list; found by re-derivation |
| `IdeationRow.tsx:80` | Own severity mapping (`statusEntry.semantic`) — passes a resolved semantic, not a domain word | Yes |
| `hr/AgentCard.tsx:124` | Roster state (`agent.status`: `active`/`pending`/`idle`/`deregistered`) | Yes |
| `JobsPanel.tsx:105` | Job/execution status (`job.status`) | Yes |
| `hr/AgentDetailSheet.tsx:228` | Roster state | No — not in D-17's list; found by re-derivation |
| `hr/RosterOrgChart.tsx:105` | Roster state (`data.status`) | No — not in D-17's list; found by re-derivation |
| `hr/RosterTable.tsx:191` | Roster state (`agent.status`) | Yes |
| `Security.tsx:407,447` | Direct semantic literal (`"error"`/`"ok"` + `BLOCKED`/`ALLOWED` label) — security event allow/block, bypasses `legacyMap` | No — not in D-17's list; found by re-derivation |
| `Quality.tsx:62` | Quality vocabulary (hardcoded `"regression"`, Phase 93 EVAL-03) | No — not in D-17's list; found by re-derivation |
| `Dreaming.tsx:104,236,238` | `cycle.status` (dreaming-cycle state) plus direct semantic literals (`"warn"`/`"idle"` + `BACKFILL`/`NIGHTLY` label) | No — not in D-17's list; found by re-derivation |
| `Memory.tsx:746,752` | Direct semantic literal (`"idle"` + source label) and memory-import status (`imp.status`) | No — not in D-17's list; found by re-derivation |
| `MeetingBot.tsx:218,293,311` | Voice call state (`call.status`) | No — not in D-17's list; found by re-derivation |
| `McpInventory.tsx:64,163` | Own semantic mapping (`badge.semantic`, MCP tool health) — passes a resolved semantic, not a domain word | No — not in D-17's list; found by re-derivation |
| `hr/detail/DetailRuntimeTab.tsx:40` | Roster/runtime state (`status` prop) | Yes |
| `RoomListItem.tsx:43` | Voice call state (`room.status`) | Yes |
| `SwarmTaskDetail.tsx:66` | Swarm task state (`task.state`) | No — not in D-17's list; found by re-derivation |
| `WarRoomTaskCard.tsx:66` | **Not a status at all** — passes `task.priority`. `priority` values do not appear in `legacyMap`, so this site has always rendered through the `idle` fallback style with `status.toUpperCase()` as the label, never a real semantic. Worth flagging to 122 as a probable pre-existing bug/mismatch, not something this plan should touch (D-01 scope discipline). | No — not in D-17's list; found by re-derivation |

**Six distinct vocabularies now share the fill law via this one component**: job/execution status,
execution mode, voice call, roster, swarm task, quality — plus a seventh pattern worth flagging to
122: several sites (`CronJobList`, `FactsTable`, `WhatsApp`, `Security`, `Dreaming`, `Memory`) pass a
**direct semantic literal** (`"ok"`/`"error"`/`"warn"`/`"idle"`) with a custom `label` prop instead of
a domain status word looked up via `legacyMap`. A shared `StatusBadge` primitive in 122 has to serve
both calling conventions.

---

## §3 — Sites with their OWN badge implementation, genuinely remaining for 122

This is the part of D-17's inventory that is real: components that do **not** go through either
module in §1 and therefore still render filled after this plan.

| File:line | Status | Notes |
|---|---|---|
| `src/components/skills/IntakeStatusBadge.tsx:66-96` (`RowStatusBadge`, `ROW_STATUS_MAP`) | **Filled** | 5 entries, each `bg-[var(--status-*)]/20` or `bg-zinc-800/*` |
| `src/components/skills/IntakeStatusBadge.tsx:128-144` (`SeverityBadge`, `SEVERITY_MAP`) | **Filled** | 3 entries, `bg-[var(--status-*)]/20` |
| `src/components/skills/IntakeStatusBadge.tsx:173-189` (`VerdictBadge`, `VERDICT_MAP`) | **Filled** | 3 entries, `bg-[var(--status-*)]/20` |
| `src/components/skills/IntakeStatusBadge.tsx:225-262` (`DestinationBadge`) | Already quiet | Wraps `ui/badge.tsx` `variant="outline"`, no status colour at all — excluded, not a target |
| `src/components/WebhookStatusBadge.tsx:45-108` | Different shape | Renders a coloured **dot** (`w-2 h-2 rounded-full bg-[var(--status-*)]`) + plain text, not a filled pill/chip. It does use a saturated `bg-[var(--status-*)]` on the dot itself, which is the same "colour lives in a small fixed element, not a full-width fill" pattern `ReadinessPill`/`ConnectionPopover` already use elsewhere in the quiet parts of the app — 122 should confirm whether this counts as "filled" under the badge law or is a separate, already-acceptable affordance before touching it. |

**Count: 3 genuinely-filled sites remain** (all three named `*Map` exports in `IntakeStatusBadge.tsx`;
`DestinationBadge` in the same file is already compliant).

---

## §4 — The D-15 exceptions register

Every domain state that keeps its own label instead of a spine word, across both in-scope modules,
with the false claim the spine word would make.

### `src/components/forge/ForgeStatusBadge.tsx`

| State | Label kept | False claim a spine word would make |
|---|---|---|
| `auth_failed` | "Auth Failed" | Mapping it to Failed would claim the RUN failed, when the actual condition is a credential/auth problem that never let the run attempt — SC#4's whole reason to exist. |
| `queued` | "Queued" | Mapping it to Running would claim execution has started; nothing is executing yet. |
| `pending` | "Queued…" | Same as `queued` — the command has not started executing, it is waiting in the cloud command-bridge queue (Phase 80). |
| `stopping_pending` | "Stopping…" | Mapping it to Cancelled (the `stopped` spine word) would claim the stop has already completed; it is in flight. |
| `expired` | "Expired" | Mapping it to either terminal spine word (Failed/Cancelled) would misstate why the job ended — it never ran or timed out waiting, it was not stopped and did not fail a run. |

### `src/components/StatusBadge.tsx` (shared, 5 vocabularies)

| State | Label kept | Vocabulary | False claim a spine word would make |
|---|---|---|---|
| `queued` | "QUEUED" | job/execution | Same reasoning as Forge's `queued` above. |
| `timed_out` | "TIMEOUT" | job/execution | Mapping it to Failed or Cancelled would obscure the specific cause (exceeded a time budget) that timeout-handling logic elsewhere in the app keys off of. |
| `strict`, `adaptive`, `standard`, `filler`, `stalled` | own labels | execution mode (v6.0) | These are not job outcomes at all — they are the execution MODE a run is operating under. None of the four spine words describe a mode; collapsing them would conflate "how a run is behaving" with "whether a run succeeded." |
| `live`, `ended`, `joining` | own labels | voice call (Phase 72) | A voice call is not a job; `ended` collapsing to Cancelled/Failed would claim the call was terminated abnormally when it may have ended normally, and `joining` collapsing to Running would claim the call is already connected. |
| `active`, `pending`, `idle`, `deregistered` | own labels | agent roster (Phase 76) | Roster membership state is not a job outcome; `deregistered` collapsing to Failed would claim the agent's LAST RUN failed, when deregistration is an administrative removal unrelated to any run's result. |
| `claimed`, `verifying`, `done`, `verify_rejected` | own labels | swarm task (Phase 149) | `done` deliberately diverges from job `completed` in this phase (`DONE` vs `SUCCEEDED`) — they are different vocabularies that happen to share a word. Collapsing `verify_rejected` to Failed would obscure that a VERIFICATION rejected the result, not that the task itself failed to run. |
| `regression` | "REGRESSION" | quality (Phase 93 EVAL-03, D-13) | Not a job state; mapping it to Failed would conflate "a quality metric regressed" with "a run failed to execute." |

**`completed` (job/execution) and `done` (swarm task) diverged in this phase** — `completed` now reads
"SUCCEEDED" (the D-15 spine word) while `done` still reads "DONE." This is intentional: they are
different vocabularies that happened to share a label before this plan, and `BlackboardPanel.test.tsx`
already asserts on swarm `done` staying "DONE," which is now also the CONTROL test in
`StatusBadge.test.tsx` that proves the relabel was scoped correctly.

---

## Unscoped regression gate (orchestrator-added, 2026-08-17)

Baseline recorded before Task 1: `npx vitest run` — **334 files passed | 17 skipped (351)**,
**4668 tests passed | 197 todo (4865)**, 0 failing.

Full unscoped run after Tasks 1-3: `npx vitest run` — **335 files passed | 17 skipped (352)**,
**4684 tests passed | 197 todo (4881)**, 0 failing.

The delta is exactly the two new/expanded test files this plan touched: `+1` file
(`src/components/StatusBadge.test.tsx`, new) and `+16` tests (`StatusBadge.test.tsx`'s 7 new tests
plus `ForgeStatusBadge.test.tsx` growing from 28 to 37, i.e. +9). No pre-existing test file changed
pass/fail status, so the fill-law change did not regress any of the other 15 test files (of the 17
covering `StatusBadge.tsx`'s 22 real consumers) that Tasks 1-2's scoped runs did not touch directly.

## What I dropped and why

- **`ForgeHostBadge.tsx` and `voice/SwapBadge.tsx`** — both import `Badge` from `ui/badge.tsx` and
  were surfaced by a broad search for status-coloured badge usage, but neither maps a domain STATE to
  a colour: `ForgeHostBadge` is a neutral outline chip showing a raw hostname, and `SwapBadge` is a
  brain/voice override indicator already using a low-opacity `bg-primary/10` treatment, not a
  saturated status fill. Dropped — not status badges.
- **The other ~40 files matched by a broad `from "@/components/ui/badge"` import search, and the
  ~65 files matched by a broad `bg-(red|green|blue|amber|zinc|slate|emerald)-\d{3}/\d+` search** —
  spot-checked a sample and confirmed the large majority are generic tag/cost-tier/priority chips
  (`TagChipInput`, `CostBreakdownTable`, kanban severity tags, etc.) that do not carry a job/task
  STATUS vocabulary at all. Listing all of them here would bury the two real §3 sites in noise; a
  reviewer who wants the raw list can re-run the two commands above.
- **`WarRoomTaskCard.tsx:66`** — kept in §2's table rather than dropped, but flagged explicitly:
  it passes `task.priority` to `StatusBadge`, which is not a status word this badge's `legacyMap`
  has ever recognized, so it has always silently rendered through the `idle` fallback. This looks
  like a pre-existing bug unrelated to POLISH-05; out of scope to fix here (D-01/D-02 no-refactor
  discipline), noted for 122 or a future defect sweep.
