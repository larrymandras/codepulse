# Phase 75: Agent Console - Context

**Gathered:** 2026-06-10
**Reconciled:** 2026-06-10 (gate-lift — see section below)
**Status:** ✅ READY TO PLAN. Gate lifted (Ástríðr v18.0 shipped M1.P0 + M1.P3); the assumed gateway `/tasks` drive surface is confirmed to exist in code. One small paired Ástríðr change remains (add `model` to gateway `TaskRequest`) — see reconciliation.

## Gate-Lift Reconciliation (2026-06-10) — supersedes provisional assumptions

The original capture was provisional against an unbuilt `POST /tasks` contract. Verified against Ástríðr ground truth (`C:\Users\mandr\astridr-repo\gateway/gateway/`), the drive surface **already exists** — the discuss-seed's "no `POST /tasks`" claim was stale. **Phase 75 is CodePulse-only** (no paired Ástríðr phase) **except one small field add.**

**Confirmed gateway contract (`gateway/gateway/app.py` + `models.py`):**
- `POST /tasks` (Bearer `require_gateway_key`) → `{task_id}`. `TaskRequest` = `prompt · provider · working_dir · max_turns · timeout_seconds · context_brief · system_prompt_append · allowed_tools · sdk_capabilities · resume_session_id`.
- `GET /tasks/{task_id}` → `TaskResponse` (status, output, duration, events).
- `DELETE /tasks/{task_id}` (Bearer) → `task_manager.cancel()` → `TaskStatus.CANCELLED`. **A real per-run cancel route.**
- `WS /tasks/{task_id}/stream` → streams `TaskEvent` JSON (`task_id`, `event_type`, `provider`, `data`) until a `None` sentinel.
- `Provider` enum: `auto · claude-cli · claude-sdk · codex · antigravity`. Auth: `gateway/gateway/auth.py` (Bearer, SEC-01) + Ástríðr Phase 133 scoped token for browser-direct.

**Decision updates from this reconciliation (override the provisional D-* below where they conflict):**
- **D-04 (REVISED — "keep persona + model pickers"):** v1 launch fields = **engine (`provider`) + workdir (`working_dir`) + prompt + rounds (`max_turns`) + timeout + model + agent/persona**. `model` is **NOT** a gateway field today → **PAIRED ÁSTRÍÐR CHANGE: add `model` to `TaskRequest` + thread it through the claude/codex adapters** (small). Agent/persona → injected as `system_prompt_append` (no gateway change). `fetchAgents()` already feeds the persona selector.
- **D-06 (CONFIRMED):** `task_id` returned by `POST /tasks` IS the runId; subscribe `WS /tasks/{task_id}/stream` filtered to it. Replaces LiveRun's latest-active-session heuristic.
- **D-07 (CONFIRMED — "multiple concurrent runs" for v1):** gateway supports many `task_id`s concurrently → run-reducer keyed `Map<task_id, RunState>`, per-run tabs/list, WS demux, global e-stop. Full command-center scope in v1.
- **D-08 (REVISED):** per-run Stop = **`DELETE /tasks/{task_id}`** (the gateway cancel route), NOT a direct `estop.py` poke. Global e-stop = iterate `DELETE` over all active `task_id`s (optionally also trip `estop.py` for a hard kill). Confirm.
- **D-09 (NARROWED):** terminal `TaskStatus.CANCELLED` + stream `None` sentinel make `Stopping… → Stopped` feasible; planner must confirm the exact cancel-ack `event_type` in the adapters.
- **D-12 (NARROWED — "research adapter events first"):** `TaskEvent.data` is a generic dict; no first-class files/diff field. Planner/researcher reads `gateway/gateway/adapters/{claude_cli,codex_cli}.py` to see if any event carries diff data; if not, derive post-run via the M1.P3 `/browse` routes or drop from the v1 summary.

**Still-open research flags for the planner:** exact WS `event_type` taxonomy (incl. cancel-ack + any file/diff event) from the adapters; precise token/scope for browser-direct `POST`/`DELETE` (`require_gateway_key` Bearer vs Phase 133 scoped write token).

<domain>
## Phase Boundary

Drive Claude Code + Codex coding runs from the CodePulse dashboard: an operator POSTs a task to the Ástríðr gateway (`POST :8200/tasks`), watches the run stream **live over a local-direct WebSocket** (not via Convex — Convex is cloud and cannot reach localhost) into a run-reducer visualization, can **Stop** a run via Ástríðr's `estop.py` cancellation flag (graceful, NOT pid-kill), and the completed run's **summary persists to Convex** for history.

**Net-new work** is the *drive/launch* path and concurrency — the *watch-a-run* half largely already exists in `src/pages/LiveRun.tsx` (v4.0 Phase 3). This phase evolves LiveRun into a multi-run Agent Console.

### ✅ Gate — LIFTED 2026-06-10 (Ástríðr v18.0 shipped)
- **M1.P0** — access & auth spike → shipped (Ástríðr Phase 133: scoped token `POST /api/access/token`, `gateway:read` HMAC). ✅
- **M1.P3** — read-only gateway file/worktree browse → shipped (Ástríðr Phase 136: `:8200` `/browse/{repos,tree,file}`, `.env`-blocked, path-contained). ✅
- **Drive surface** — `POST/GET/DELETE /tasks` + `WS /tasks/{id}/stream` confirmed present in `gateway/gateway/app.py`. ✅

Planning may proceed. **One small paired Ástríðr change remains:** add a `model` field to the gateway `TaskRequest` (D-04). Not a blocker for starting plan-phase — it can be sequenced as the phase's first paired step.

### In scope
- Launch modal that POSTs a task to the gateway (engine toggle, workdir, prompt, model, budget, agent/persona)
- Correlating a launched task to its live WS stream via a returned runId
- Multiple concurrent runs, each with its own run-reducer state
- Per-run Stop + a global e-stop wired to `estop.py` cancellation flags
- Persisting a reproducible run summary to Convex on terminal states

### Out of scope (deferred / other phases)
- Live editing of files in a worktree (browse is **read-only** per M1.P3)
- Antigravity CLI as a launch engine (toggle is designed to extend to it later, but Claude Code + Codex only for v1)
- Mid-run summary checkpointing (terminal-state persistence only for v1)

</domain>

<decisions>
## Implementation Decisions

### Launch surface
- **D-01:** Single launch surface with a **per-task engine toggle** (Claude Code / Codex; designed to extend to Antigravity later). Engine is a field on the `POST /tasks` payload, not a separate launcher. Aligns with the existing 7-provider gateway registry.
- **D-02:** Launch UI is a **modal dialog**, reusing the `WarRoomLaunchDialog.tsx` pattern. The console page stays focused on the live stream + history; "New Run" opens the modal.
- **D-03:** Workdir is chosen via the **M1.P3 read-only browse picker** (repo/worktree tree). **Fallback (pre-M1.P3): a free-text absolute path validated against a gateway allowlist** — so the rest of the console is not blocked if M1.P3 slips.
- **D-04:** Task payload ceiling = **engine + workdir + prompt + model + budget/max-rounds cap + agent/persona**. These six are the complete v1 field set — no additional fields. (`fetchAgents()` already exists for the agent/persona selector; the budget cap ties into the v5.0 Phase 69 SDK spend guard.)

### Console vs LiveRun
- **D-05:** **Evolve `src/pages/LiveRun.tsx`** into the Agent Console rather than creating a separate page — add the launch modal + run correlation to the surface that already streams `RunTimeline`/`RunSummary`/history. One run surface, least duplication. (Lives under the new Agents/Console IA cluster from Phase 71.)
- **D-06:** A launched task is correlated to its WS stream via a **runId/sessionId returned by `POST /tasks`**; the UI subscribes the WS stream filtered to that id. (Replaces LiveRun's current "latest-active session" heuristic, which is fragile under concurrency.)
- **D-07:** **Multiple concurrent runs** are supported. The run-reducer must key state by runId — LiveRun's single `liveSessionId` / `RunMeta` becomes a `Map<runId, RunState>` with per-run WS demux and a run list/tabs.

### Stop & safety
- **D-08:** **Per-run Stop + a global e-stop.** Each run has its own Stop (flags that runId); plus one global emergency-stop that flags all active runs. Both wire to `estop.py` via a **cancellation flag, NOT pid-kill** (CON-03).
- **D-09:** Because the cancellation flag is async (the agent stops at its next checkpoint), the UI shows a **`Stopping…` pending state** — Stop button disables, run keeps streaming until a gateway **cancel-acked** event flips it to `Stopped`. (Requires that ack event — see research flags.)
- **D-10:** Per-run Stop is **one-click, no confirm** (graceful, non-destructive — work-so-far persists). The **global e-stop should confirm** (it halts everything) — minor planning call, lean confirm.

### History & summary
- **D-11:** Persist the run summary to Convex on **terminal states only** (completed / errored / stopped). Mid-run checkpointing deferred.
- **D-12:** Summary captures a **full reproducible record**: cost + input/output tokens, started/completed timestamps + rounds + final status, **files touched / diff**, and the originating prompt + engine + model + agent/persona + workdir. (`RunMeta` already tracks cost/tokens/timing live; files/diff depends on a gateway file-change event — see research flags.)
- **D-13:** **Reuse `RunHistorySelector` + `RunSummary`** as-is, fed the richer summary. A small extension to `RunSummary` is expected to render the files-touched/diff field. No new filterable history table for v1.

### Claude's Discretion
- Exact run-list/tabs layout for concurrent runs (D-07) — left to UI design/planning, within the "evolve LiveRun" constraint.
- Whether the global e-stop confirm is a dialog vs an inline hold-to-confirm (D-10).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 75: Agent Console" — goal, success criteria (CON-01..04), and the M1.P0/M1.P3 external dependency + Convex-is-cloud note
- `.planning/REQUIREMENTS.md` §"Agent Console (CON) — Phase 75" (lines ~47-54, 124-127) — CON-01..CON-04 and the gating note
- `.planning/PROJECT.md` §"Current Milestone: v6.0 Agentic OS Front-End" — Phase 75 framing within the two-milestone Agentic OS plan

### Companion / upstream plan (Ástríðr side — the gate)
- `C:\Users\mandr\html-out\agentic-os-milestones.md` — the companion Agentic OS milestone plan defining M1.P0 (access/auth spike), M1.P3 (read-only file/worktree browse), and the gateway task model. **Read before planning** — it defines the `POST /tasks` contract, the auth model, and `estop.py` cancellation semantics this phase depends on.
- Ástríðr repo: `C:\Users\mandr\astridr-repo` — WebSocket endpoint, CLI gateway, and `estop.py` live here. The gateway task POST + WS event shapes are the upstream contract.
- **`C:\Users\mandr\astridr-repo\gateway\gateway\app.py`** — the live gateway routes: `POST /tasks`, `GET /tasks/{id}`, `DELETE /tasks/{id}` (cancel), `WS /tasks/{id}/stream`. **The authoritative drive contract — read before planning.**
- **`C:\Users\mandr\astridr-repo\gateway\gateway\models.py`** — `TaskRequest`, `TaskResponse`, `TaskEvent`, `TaskStatus`, `Provider` enum. The exact request/response/event shapes.
- **`C:\Users\mandr\astridr-repo\gateway\gateway\adapters\claude_cli.py` + `codex_cli.py`** — what `event_type`s each engine emits over the stream (D-09 cancel-ack, D-12 files/diff research flags).
- **`C:\Users\mandr\astridr-repo\gateway\gateway\auth.py`** — `require_gateway_key` Bearer auth + Phase 133 scoped-token model for browser-direct calls.
- `C:\Users\mandr\astridr-repo\gateway\gateway\task_manager.py` — submit/cancel/subscribe lifecycle backing the routes.

### Design system (Phase 71)
- `.planning/phases/071-unified-design-system/UI-SPEC.md` — the formal design system (Matrix Emerald dark theme, tokens, primitives) the console must render against; also the Agents/Console IA cluster this page lives under

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/pages/LiveRun.tsx` — **the surface to evolve.** Already streams agent runs over `useAstridrWS()`, maintains live blocks (dedup, `BLOCK_CAP=500`), tracks `RunMeta` (status/rounds/tokens/cost/timestamps), has a Stop (`Square`) button, renders `RunTimeline`/`RunSummary`/`RunHistorySelector`, and queries Convex history via `useQuery`.
- `src/components/RunTimeline.tsx` — round-based timeline viz (the run-reducer render target).
- `src/components/RunSummary.tsx` — completed-run summary render (extend for files/diff).
- `src/components/RunHistorySelector.tsx` — history picker (reuse as-is).
- `src/contexts/AstridrWSContext.tsx` / `useAstridrWS()` — WS client: `sendCommand(cmd)`, `subscribe(topic, cb)`, `subscribeEvent(eventType, cb)`, `WSStatus`. The local-direct WS transport.
- `src/lib/astridrApi.ts` — gateway HTTP layer: `ASTRIDR_API_BASE`, `apiRequest<T>()`, `authHeaders()`, `fetchAgents()`. The base for `POST /tasks` and the agent/persona selector.
- `src/components/hr/WarRoomLaunchDialog.tsx` — launch-dialog pattern to model the New Run modal on.
- shadcn primitives: `Dialog`, `Button`, `Select`, `Input`, `StatusBadge`.

### Established Patterns
- **WS event → topic fan-out:** `AstridrWSContext` maps `event_type → topics` and fans out to subscribers. New run-correlation subscribes filtered to a runId.
- **Block dedup + cap:** `appendBlocksWithDedup` (drops `tool_use`/`tool_result`, caps at 500) — reuse per-run.
- **Convex history via `useQuery`:** LiveRun already reads run history from Convex; CON-04 writes into the same store.

### Integration Points
- **New:** a `POST /tasks` call (build on `apiRequest`/`authHeaders`) that returns a runId → seeds a new entry in the runId-keyed run map.
- **Refactor:** LiveRun's single-run state (`liveSessionId`, `runMeta`) → `Map<runId, RunState>` for concurrency (D-07).
- **New Convex mutation:** persist the run summary on terminal state (D-11/D-12).
- **Wire Stop → gateway estop endpoint** (per-run flag + global), replacing/extending the current Stop button (D-08).

</code_context>

<specifics>
## Specific Ideas

- "Command center" intent: multiple Claude Code/Codex runs visible/streaming at once (D-07), with a single panic button to halt everything (global e-stop, D-08).
- Honest async-stop UX: `Stopping…` until the agent actually acknowledges the cancellation flag — don't lie with an optimistic "Stopped" (D-09).

## Research flags for the planner (all against the M1.P0/M1.P3 upstream contract)
- **`POST /tasks` schema** — fields accepted; does it echo a `runId`/`sessionId` for WS correlation (D-06)?
- **WS cancel-ack event** — does the gateway emit a "cancellation acknowledged" event so the UI can flip `Stopping… → Stopped` (D-09)?
- **WS file-change event** — does any event expose files-touched/diff for the summary (D-12)?
- **`estop.py` scopes** — does it support per-run cancellation vs only global, and via what gateway route (D-08)?
- **Auth model** — scoped token / localhost-direct vs tunnel from M1.P0 (affects how `astridrApi`/WS authenticate to the gateway).
- **M1.P3 browse routes** — shape of the read-only file/worktree browse API for the workdir picker (D-03).

</specifics>

<deferred>
## Deferred Ideas

- **Antigravity CLI as a launch engine** — engine toggle is designed to extend, but Claude Code + Codex only for v1.
- **Filterable runs history table** (by engine/repo/status/date) — reuse existing components for v1; revisit if concurrent multi-engine history gets unwieldy.
- **Mid-run summary checkpointing** (partial record for crashed/disconnected runs) — terminal-state persistence only for v1.
- **Writable worktree editing** — browse is read-only (M1.P3); any in-dashboard editing is a separate future capability.

</deferred>

---

*Phase: 75-agent-console*
*Context gathered: 2026-06-10*
