# Phase 75: Agent Console - Research

**Researched:** 2026-06-10
**Domain:** React SPA multi-run console; WebSocket demux; gateway task API; Convex run-summary persistence
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Launch surface**
- D-01: Single launch surface with a per-task engine toggle (Claude Code / Codex; designed to extend to Antigravity later). Engine is a field on the `POST /tasks` payload, not a separate launcher.
- D-02: Launch UI is a modal dialog, reusing the `WarRoomLaunchDialog.tsx` pattern. The console page stays focused on the live stream + history; "New Run" opens the modal.
- D-03: Workdir is chosen via the M1.P3 read-only browse picker (repo/worktree tree). Fallback (pre-M1.P3): a free-text absolute path validated against a gateway allowlist — so the rest of the console is not blocked if M1.P3 slips.
- D-04 (REVISED): v1 launch fields = engine (`provider`) + workdir (`working_dir`) + prompt + rounds (`max_turns`) + timeout + model + agent/persona. `model` is NOT a gateway field today → PAIRED ÁSTRÍÐR CHANGE: add `model` to `TaskRequest` + thread through claude/codex adapters (small). Agent/persona → injected as `system_prompt_append` (no gateway change). `fetchAgents()` already feeds the persona selector.

**Console vs LiveRun**
- D-05: Evolve `src/pages/LiveRun.tsx` into the Agent Console rather than creating a separate page — add the launch modal + run correlation to the surface that already streams `RunTimeline`/`RunSummary`/history.
- D-06: A launched task is correlated to its WS stream via a runId/sessionId returned by `POST /tasks`; the UI subscribes the WS stream filtered to that id. (Replaces LiveRun's current "latest-active session" heuristic.)
- D-07: Multiple concurrent runs are supported. The run-reducer must key state by runId — LiveRun's single `liveSessionId`/`RunMeta` becomes a `Map<runId, RunState>` with per-run WS demux and a run list/tabs.

**Stop & safety**
- D-08 (REVISED): Per-run Stop = `DELETE /tasks/{task_id}` (the gateway cancel route), NOT a direct `estop.py` poke. Global e-stop = iterate `DELETE` over all active `task_id`s (optionally also trip `estop.py` for a hard kill). Confirm.
- D-09 (NARROWED): Terminal `TaskStatus.CANCELLED` + stream `None` sentinel make `Stopping… → Stopped` feasible; planner must confirm exact cancel-ack `event_type` in the adapters.
- D-10: Per-run Stop is one-click, no confirm (graceful, non-destructive). Global e-stop should confirm.

**History & summary**
- D-11: Persist the run summary to Convex on terminal states only (completed / errored / stopped). Mid-run checkpointing deferred.
- D-12 (NARROWED): Summary captures a full reproducible record: cost + input/output tokens, started/completed timestamps + rounds + final status, files touched / diff, and the originating prompt + engine + model + agent/persona + workdir.
- D-13: Reuse `RunHistorySelector` + `RunSummary` as-is, fed the richer summary. A small extension to `RunSummary` is expected to render the files-touched/diff field.

### Claude's Discretion
- Exact run-list/tabs layout for concurrent runs (D-07) — left to UI design/planning, within the "evolve LiveRun" constraint.
- Whether the global e-stop confirm is a dialog vs an inline hold-to-confirm (D-10).

### Deferred Ideas (OUT OF SCOPE)
- Antigravity CLI as a launch engine
- Filterable runs history table (by engine/repo/status/date)
- Mid-run summary checkpointing (partial record for crashed/disconnected runs)
- Writable worktree editing — browse is read-only
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CON-01 | A task POSTed from the dashboard reaches the gateway (`POST :8200/tasks`) and starts a Claude Code or Codex run | Gateway `POST /tasks` contract fully verified; `apiRequest` + `authHeaders` pattern in `astridrApi.ts` provides the transport layer |
| CON-02 | The live run streams to the UI over a local-direct WS (not via Convex) into a run-reducer visualization | `WS /tasks/{task_id}/stream` confirmed; `AstridrWSContext` provides the WS demux infrastructure; run-reducer refactor pattern documented below |
| CON-03 | A cross-request Stop wires to Ástríðr `estop.py` via a cancellation flag (NOT pid-kill) | `DELETE /tasks/{task_id}` calls `task_manager.cancel()` which calls `state._task.cancel()` (asyncio CancelledError, not SIGKILL); this IS the flag-based graceful cancel |
| CON-04 | The completed run's summary persists to Convex for history | New `agentRuns` Convex table + `saveRunSummary` mutation; no existing table fits without schema pollution |
</phase_requirements>

---

## Summary

Phase 75 evolves `src/pages/LiveRun.tsx` into a multi-run Agent Console. The research confirms that all upstream gateway infrastructure (POST/DELETE /tasks, WS stream) is live in `C:\Users\mandr\astridr-repo\gateway\` and fully understood. The CodePulse side has strong reuse assets (AstridrWSContext, RunTimeline, RunSummary, astridrApi.ts) but they are all single-run scoped — the central refactor is lifting single-run state into a `Map<string, RunState>` run-reducer.

The gateway WS stream (`WS /tasks/{id}/stream`) is **separate from** the existing Ástríðr telemetry WS (`/ws/telemetry` via `AstridrWSContext`). This is the critical architectural distinction: the gateway stream is a per-task, per-connection WS that delivers `TaskEvent` JSON objects directly, not event-typed messages through the existing topic fan-out. The UI needs a **new per-run WS hook** (`useTaskStream`) that opens a raw WebSocket to `:8200/tasks/{id}/stream`, not a subscription to `AstridrWSContext`.

CON-03 (cancellation flag, not pid-kill) is satisfied by the existing implementation: `task_manager.cancel()` calls `state._task.cancel()` which raises `asyncio.CancelledError` in the running coroutine — a cooperative cancellation. The adapters' `cancel()` methods call `proc.kill()` on the subprocess, but the **task_manager-level cancel** does NOT call the adapter cancel method directly — it cancels the asyncio Task wrapping `_run()`, which catches `CancelledError` and sets status to `CANCELLED`. This is the cancellation flag model (flag the asyncio task, agent stops at its next await checkpoint).

Convex is cloud and cannot reach localhost. Only the completed run summary (not the live stream) lands in Convex. A new `agentRuns` table is needed — no existing table fits the run-summary schema without ugly repurposing. The `gatewayTasks` table is observability-only and does not carry prompt/model/workdir/persona/tokens/cost.

**Primary recommendation:** Build the run-reducer as a React `useReducer` + per-run WS hook outside `AstridrWSContext`; reuse AstridrWSContext only for existing telemetry events (not gateway task streams).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Launch task (POST /tasks) | Browser / Client | — | Direct browser-to-gateway HTTP; Convex is cloud and cannot proxy to localhost |
| Live stream consumption (WS /tasks/id/stream) | Browser / Client | — | Direct browser-to-gateway WS; cannot route through Convex |
| Run-reducer state machine | Browser / Client | — | In-memory React state; Map<runId, RunState> keyed on task_id |
| Per-run Stop (DELETE /tasks/id) | Browser / Client | — | Same localhost-direct auth as POST |
| Global e-stop (iterate DELETE) | Browser / Client | — | Client orchestrates multiple DELETE calls |
| Run summary persistence | Convex / Cloud | — | Terminal-state write only; cloud accessible |
| History query (past runs) | Convex / Cloud | — | useQuery on agentRuns table |
| Workdir browse picker | Browser / Client → Gateway | — | GET /browse/repos + /browse/{repo}/tree via gateway:read scoped token |

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React + TypeScript | 19 / 5.9 | UI + type safety | Project baseline |
| Convex | ^1.39.1 | Cloud DB + mutations | Project baseline; agentRuns table goes here |
| shadcn/ui (Radix) | ^1.4.3 | Dialog, Select, Button, AlertDialog, Tabs | Already in src/components/ui/ — 30 primitives present |
| lucide-react | ^1.8.0 | Icons (Square, Play, OctagonX) | Project standard |
| sonner | in package.json | Toast notifications | Used throughout project |
| Tailwind CSS 4 | via @tailwindcss/vite | Styling | Project baseline |

### New shadcn Primitive (Wave 0 install)

| Primitive | Purpose | Status |
|-----------|---------|--------|
| `AlertDialog` | Global e-stop confirmation dialog | Not yet in src/components/ui/ — needs `npx shadcn add alert-dialog` |

**Note:** All other components referenced in the UI-SPEC are already present in `src/components/ui/`. Only `AlertDialog` is new.

**Installation:**
```bash
npx shadcn@latest add alert-dialog
```

### No New npm Packages

This phase adds zero new npm dependencies beyond the AlertDialog shadcn primitive install. The gateway WS connection uses the native browser `WebSocket` API. All other needed libraries are already installed.

---

## Package Legitimacy Audit

No new npm packages are introduced. AlertDialog is from the official shadcn registry, not a third-party registry — no vetting required per UI-SPEC §"Registry Safety".

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (localhost:5173)
        │
        │  1. POST :8200/tasks  (Bearer GATEWAY_API_KEY)
        │  ──────────────────────────────────────────►  Gateway (:8200)
        │  ◄───────────────── { task_id } ────────────  /tasks
        │
        │  2. WS ws://:8200/tasks/{task_id}/stream
        │  ──────────────────────────────────────────►  Gateway (:8200)
        │  ◄────── TaskEvent JSON frames until null ──  /tasks/{id}/stream
        │
        │  3. DELETE :8200/tasks/{task_id}  (stop)
        │  ──────────────────────────────────────────►  Gateway (:8200)
        │
        │  4. useMutation(api.agentRuns.saveRunSummary)
        │  ──────────────────────────────────────────►  Convex Cloud
        │
        │  5. useQuery(api.agentRuns.listRecent)
        │  ◄────────────── agentRun records ──────────  Convex Cloud
        │
        │  [AstridrWSContext /ws/telemetry — existing, unchanged]
        │  ──────────────────────────────────────────►  Ástríðr (:8181)
```

**Key separation:** The gateway task stream (`ws://:8200/tasks/{id}/stream`) is entirely separate from `AstridrWSContext` (`ws://:8181/ws/telemetry`). They serve different purposes and must not be conflated.

### Recommended Project Structure

```
src/
├── pages/
│   └── LiveRun.tsx              # Evolve → AgentConsole (rename or in-place)
├── components/
│   ├── RunTimeline.tsx          # Reuse as-is
│   ├── RunSummary.tsx           # Extend with RunConfig + FilesTouched props
│   ├── RunHistorySelector.tsx   # Reuse as-is
│   ├── RunBlock.tsx             # Reuse as-is
│   ├── console/                 # New Phase 75 components
│   │   ├── NewRunModal.tsx      # Launch dialog
│   │   ├── RunCard.tsx          # Single-run entry in list
│   │   ├── RunList.tsx          # Concurrent-run list
│   │   ├── GlobalEStopButton.tsx # Header panic button
│   │   └── WorkdirPicker.tsx    # M1.P3 browse picker + fallback
│   └── ui/
│       └── alert-dialog.tsx     # Wave 0: npx shadcn add alert-dialog
├── hooks/
│   └── useTaskStream.ts         # New: per-run WS hook for gateway stream
├── lib/
│   └── astridrApi.ts            # Extend: add submitTask(), cancelTask()
└── contexts/
    └── AstridrWSContext.tsx     # Unchanged
convex/
├── schema.ts                    # Extend: add agentRuns table
└── agentRuns.ts                 # New: saveRunSummary mutation + listRecent query
```

### Pattern 1: Gateway Task API (HTTP layer)

**What:** HTTP functions for POST/DELETE /tasks, built on existing `apiRequest` + `authHeaders`.

**Source:** Verified from `C:\Users\mandr\astridr-repo\gateway\gateway\app.py` + `auth.py` [VERIFIED: live codebase]

```typescript
// src/lib/astridrApi.ts — extend with these additions

export interface TaskRequest {
  prompt: string;
  provider: "claude-cli" | "codex" | "auto";
  working_dir?: string;
  max_turns?: number;
  timeout_seconds?: number;
  system_prompt_append?: string;
  // model: string  — PAIRED ÁSTRÍÐR CHANGE: add after gateway update
}

export interface TaskSubmitResponse {
  task_id: string;
}

export async function submitTask(req: TaskRequest): Promise<TaskSubmitResponse> {
  // Uses VITE_ASTRIDR_API_URL (default: http://localhost:8181 — BUT gateway is :8200)
  // The gateway runs on a DIFFERENT port than Ástríðr main API.
  // Need VITE_GATEWAY_URL env var OR derive from VITE_ASTRIDR_API_URL by port swap.
  // See "Critical: Two Base URLs" pitfall section.
  return apiRequest<TaskSubmitResponse>("/tasks", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function cancelTask(taskId: string): Promise<void> {
  await apiRequest<unknown>(`/tasks/${taskId}`, { method: "DELETE" });
}
```

**Critical:** Auth for POST and DELETE is `Bearer GATEWAY_API_KEY` (from `GATEWAY_API_KEY` env var on the gateway). On the CodePulse side, the existing `VITE_ASTRIDR_API_KEY` is the Ástríðr main API key for `:8181`. The gateway Bearer key may be a DIFFERENT value. Research flag confirmed: the gateway's `require_gateway_key` reads `GATEWAY_API_KEY`; the browse routes read `GATEWAY_BROWSE_SECRET`. The CodePulse `.env` must expose the gateway key as a separate env var (e.g., `VITE_GATEWAY_API_KEY`).

### Pattern 2: Per-Run WebSocket Hook

**What:** A React hook that opens a single `WebSocket` to `ws://:8200/tasks/{task_id}/stream`, reads `TaskEvent` JSON frames, dispatches to a run-reducer, and closes on sentinel `null` or component unmount.

**Key facts from verified gateway code** [VERIFIED: live codebase]:
- The WS endpoint is `ws://:8200/tasks/{task_id}/stream` (NOT `:8181`)
- Auth: the WS route has NO `Depends(require_gateway_key)` in app.py — it is **unauthenticated** (read-only stream; GET /tasks/{id} is also open)
- The stream sends `TaskEvent` JSON objects until a `None` sentinel (closes the WS)
- `TaskEvent` shape: `{ task_id, timestamp, event_type, provider, data }`

```typescript
// src/hooks/useTaskStream.ts

type TaskEvent = {
  task_id: string;
  timestamp: string;  // ISO datetime
  event_type: string;
  provider: string;
  data: Record<string, unknown>;
};

type RunAction =
  | { type: "EVENT"; taskId: string; event: TaskEvent }
  | { type: "CLOSED"; taskId: string }
  | { type: "ERROR"; taskId: string; error: string };

// Called from AgentConsole with dispatch from the run-reducer
export function useTaskStream(
  taskId: string | null,
  dispatch: (action: RunAction) => void,
) {
  const gatewayWsBase = import.meta.env.VITE_GATEWAY_WS_URL ?? "ws://localhost:8200";

  useEffect(() => {
    if (!taskId) return;
    const ws = new WebSocket(`${gatewayWsBase}/tasks/${taskId}/stream`);

    ws.onmessage = (e: MessageEvent<string>) => {
      try {
        const event = JSON.parse(e.data) as TaskEvent;
        dispatch({ type: "EVENT", taskId, event });
      } catch {
        // malformed frame — ignore
      }
    };
    ws.onclose = () => dispatch({ type: "CLOSED", taskId });
    ws.onerror = () => dispatch({ type: "ERROR", taskId, error: "WS error" });

    return () => {
      ws.onclose = null; // prevent dispatch after unmount
      ws.close();
    };
  }, [taskId, dispatch, gatewayWsBase]);
}
```

**Multiple concurrent runs:** Each `RunCard` or the parent console mounts one `useTaskStream` per active `task_id`. No multiplexing needed — the gateway supports many concurrent WS connections, one per task.

### Pattern 3: Run-Reducer State Machine

**What:** A `useReducer` holding `Map<string, RunState>` keyed on `task_id`. Each action targets a specific task by ID.

**Run state shape** (derived from UI-SPEC state machine + gateway TaskStatus enum) [VERIFIED: live codebase]:

```typescript
type GatewayRunStatus = "queued" | "running" | "stopping" | "completed" | "error" | "stopped";

interface RunState {
  taskId: string;
  status: GatewayRunStatus;
  provider: string;           // "claude-cli" | "codex"
  prompt: string;             // from the original TaskRequest (stored client-side)
  workdir: string;
  model?: string;
  agentPersona?: string;
  blocks: Block[];            // live stream blocks (capped at BLOCK_CAP=500)
  rounds: number;
  startedAt: number;          // Date.now() at submission
  completedAt?: number;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  filesTouched?: string[];    // from "completed" event data (if gateway emits it)
  autoScroll: boolean;
}

type RunMapAction =
  | { type: "ADD_RUN"; taskId: string; request: TaskRequest }
  | { type: "EVENT"; taskId: string; event: TaskEvent }
  | { type: "SET_STOPPING"; taskId: string }
  | { type: "CLOSED"; taskId: string }
  | { type: "ERROR"; taskId: string; error: string }
  | { type: "SET_AUTOSCROLL"; taskId: string; value: boolean };

function runMapReducer(
  state: Map<string, RunState>,
  action: RunMapAction,
): Map<string, RunState> {
  const next = new Map(state);
  switch (action.type) {
    case "ADD_RUN": {
      next.set(action.taskId, {
        taskId: action.taskId,
        status: "queued",
        provider: action.request.provider,
        prompt: action.request.prompt,
        workdir: action.request.working_dir ?? "",
        model: action.request.model,
        agentPersona: action.request.system_prompt_append,
        blocks: [],
        rounds: 0,
        startedAt: Date.now(),
        autoScroll: true,
      });
      return next;
    }
    case "EVENT": {
      const run = state.get(action.taskId);
      if (!run) return state;
      const updated = foldEvent(run, action.event);
      next.set(action.taskId, updated);
      return next;
    }
    case "SET_STOPPING": {
      const run = state.get(action.taskId);
      if (!run) return state;
      next.set(action.taskId, { ...run, status: "stopping" });
      return next;
    }
    case "CLOSED": {
      const run = state.get(action.taskId);
      if (!run) return state;
      // WS closed but status not yet terminal — treat as completed
      if (run.status === "running" || run.status === "queued") {
        next.set(action.taskId, { ...run, status: "completed", completedAt: Date.now() });
      }
      return next;
    }
    // ... etc
  }
}
```

**`foldEvent` logic** maps `TaskEvent.event_type` to state mutations:

| event_type | Action |
|-----------|--------|
| `"started"` | status → `"running"` |
| `"progress"` / `"output"` | append to blocks (via `appendBlocksWithDedup`) |
| `"completed"` | status → `"completed"`, set completedAt, extract tokens/cost from data if present |
| `"error"` | status → `"error"`, append error block |
| Any `event_type` that arrives when status is `"stopping"` | remain `"stopping"` until WS closes or explicit completed/cancelled |

**Cancel-ack finding (CRITICAL):** The gateway adapters do NOT emit a dedicated `"cancelled"` event_type when a task is cancelled via `DELETE`. `task_manager.cancel()` cancels the asyncio Task, which raises `CancelledError` in `_run()`, which sets `state.status = CANCELLED` and sends a `None` sentinel to all subscriber queues. The WS route loop breaks on `None` and closes the WS. **There is no explicit "cancelled" TaskEvent** — the cancellation is signaled by the WS closing (normal close code). The UI's `stopping → stopped` transition should be driven by the `CLOSED` action (WS onclose), not by an event_type.

### Pattern 4: Convex agentRuns Table + Mutation

**What:** New Convex table for persisting completed run summaries. Triggered client-side when the run-reducer reaches a terminal state.

**Schema addition to convex/schema.ts:**

```typescript
agentRuns: defineTable({
  taskId: v.string(),               // gateway task_id / run correlation key
  provider: v.string(),             // "claude-cli" | "codex"
  status: v.string(),               // "completed" | "failed" | "stopped"
  prompt: v.string(),               // originating prompt
  workdir: v.optional(v.string()),  // working directory
  model: v.optional(v.string()),    // model used (after paired Ástríðr change)
  agentPersona: v.optional(v.string()),
  rounds: v.optional(v.float64()),
  inputTokens: v.optional(v.float64()),
  outputTokens: v.optional(v.float64()),
  costUsd: v.optional(v.float64()),
  filesTouched: v.optional(v.array(v.string())),
  startedAt: v.float64(),           // epoch ms
  completedAt: v.optional(v.float64()),
  durationMs: v.optional(v.float64()),
  errorMessage: v.optional(v.string()),
})
  .index("by_taskId", ["taskId"])
  .index("by_status", ["status", "startedAt"])
  .index("by_startedAt", ["startedAt"]),
```

**New file convex/agentRuns.ts:**

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const saveRunSummary = mutation({
  args: {
    taskId: v.string(),
    provider: v.string(),
    status: v.string(),
    prompt: v.string(),
    workdir: v.optional(v.string()),
    model: v.optional(v.string()),
    agentPersona: v.optional(v.string()),
    rounds: v.optional(v.float64()),
    inputTokens: v.optional(v.float64()),
    outputTokens: v.optional(v.float64()),
    costUsd: v.optional(v.float64()),
    filesTouched: v.optional(v.array(v.string())),
    startedAt: v.float64(),
    completedAt: v.optional(v.float64()),
    durationMs: v.optional(v.float64()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Idempotent: upsert by taskId (skip if already persisted)
    const existing = await ctx.db
      .query("agentRuns")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("agentRuns", args);
  },
});

export const listRecent = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("agentRuns")
      .withIndex("by_startedAt")
      .order("desc")
      .take(50);
  },
});
```

### Pattern 5: WorkdirPicker (M1.P3 Browse)

**What:** A Popover-wrapped tree picker calling `GET /browse/repos` then `GET /browse/{repo}/tree?path=...` on the gateway. Degrades to a free-text `Input` when M1.P3 is unavailable (D-03).

**Auth for browse routes:** `GATEWAY_BROWSE_SECRET` scoped token (Phase 133 `gateway:read` HMAC). This is a **different auth mechanism** from the Bearer `GATEWAY_API_KEY` used for POST/DELETE /tasks. The browse routes require a time-limited scoped token from `POST /api/access/token` on the Ástríðr main API, not the raw gateway key.

**Practical approach for v1:** Since the scoped-token flow requires a client-side token fetch + expiry management, the simplest v1 implementation is:
1. Try `GET /browse/repos` with the scoped token (from `POST /api/access/token` using `VITE_ASTRIDR_API_KEY`)
2. On 401/503 (GATEWAY_BROWSE_SECRET unconfigured), fall back to free-text Input

Browse route shapes [VERIFIED: live codebase]:
- `GET /browse/repos` → `[{ name: string, path: string }]`
- `GET /browse/{repo}/tree?path=` → `[{ name: string, type: "file"|"dir", size: number }]`
- Auth: `Authorization: Bearer <scoped-token>` (gateway:read scope)

### Anti-Patterns to Avoid

- **Using AstridrWSContext for gateway task streams:** `AstridrWSContext` connects to `:8181/ws/telemetry` and expects Ástríðr telemetry event shapes. Gateway task streams are separate connections to `:8200/tasks/{id}/stream`. Do not add gateway event types to `TOPIC_EVENT_MAP` or route them through `subscribeEvent`.
- **Optimistic "Stopped" on click:** D-09 requires the UI to show `Stopping…` until the WS closes. Do not immediately set status to `"stopped"` on the DELETE call succeeding.
- **Persisting live blocks to Convex:** Convex is cloud; it cannot stream NDJSON from localhost. Only terminal-state summaries go to Convex. Never write raw block events to Convex from the gateway stream.
- **Using the same env var for Ástríðr main API and gateway:** Two separate URLs and two separate auth keys. See pitfall below.
- **Calling adapter.cancel() instead of task_manager.cancel():** The adapter `cancel()` calls `proc.kill()` (hard kill). The task_manager `cancel()` calls `state._task.cancel()` (asyncio CancelledError = graceful). CON-03 requires the latter. The gateway `DELETE /tasks/{id}` route correctly calls `task_manager.cancel()`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket reconnect backoff | Custom retry logic | Detect WS close in `useTaskStream` and expose `reconnect()` | Task streams are intentionally terminal — they close when the task ends; reconnect is only needed for the telemetry WS which already has it |
| Run-list scrollable container | Custom scroll | `overflow-y-auto` + Tailwind | Simple CSS; no library needed |
| Confirmation dialog | Custom modal | `AlertDialog` from shadcn | Already exists in official registry |
| Token counting / cost from stream | Parse custom format | Read directly from `TaskEvent.data` on `completed` event | If gateway emits token data in `data`, use it; if not, leave as undefined in summary |
| HMAC scoped token generation | Custom crypto | Call `POST /api/access/token` on Ástríðr main API | Token generation lives in Ástríðr `access_token.py`; CodePulse only consumes |

---

## Runtime State Inventory

Not applicable — this is a greenfield addition (new page/components/table). No rename/refactor/migration.

---

## Common Pitfalls

### Pitfall 1: Two Base URLs, Two Auth Keys

**What goes wrong:** The gateway runs on `:8200`; the Ástríðr main API runs on `:8181`. `VITE_ASTRIDR_API_URL` points to `:8181`. POST/DELETE /tasks must go to `:8200`. Using `apiRequest()` (which prepends `VITE_ASTRIDR_API_URL`) for gateway calls will hit the wrong port.

**Why it happens:** The existing `astridrApi.ts` is built around `VITE_ASTRIDR_API_URL` (Ástríðr main, `:8181`). The gateway is a separate FastAPI process on `:8200`.

**How to avoid:** Introduce `VITE_GATEWAY_URL` (e.g., `http://localhost:8200`) as a separate env var. Add a `gatewayRequest<T>()` helper in `astridrApi.ts` that uses `VITE_GATEWAY_URL` + `VITE_GATEWAY_API_KEY` (the gateway Bearer key).

**Warning signs:** 404 or connection refused on task submit; health check hits wrong service.

### Pitfall 2: WS URL Port for Task Streams

**What goes wrong:** `useTaskStream` constructs the WS URL from the wrong base, connecting to `ws://localhost:8181/tasks/{id}/stream` instead of `ws://localhost:8200/tasks/{id}/stream`.

**Why it happens:** Same as Pitfall 1 — conflating the two services.

**How to avoid:** Derive `VITE_GATEWAY_WS_URL` from `VITE_GATEWAY_URL` by replacing `http` → `ws` (or provide it separately). Default: `ws://localhost:8200`.

### Pitfall 3: Cancel-Ack is WS Close, Not an Event

**What goes wrong:** The UI waits for a `"cancelled"` event_type from the stream that never arrives, leaving the run stuck in `"stopping"` forever.

**Why it happens:** The gateway does not emit a dedicated cancelled event. `task_manager.cancel()` cancels the asyncio Task → `CancelledError` in `_run()` → `None` sentinel → WS closes.

**How to avoid:** In `useTaskStream`, the `ws.onclose` handler fires the `CLOSED` dispatch. In `runMapReducer`, `CLOSED` on a `"stopping"` run transitions to `"stopped"`.

### Pitfall 4: No `model` Field in Current TaskRequest

**What goes wrong:** The NewRunModal sends `model` in the TaskRequest, but the current gateway `models.py` `TaskRequest` has no `model` field. Pydantic will ignore the extra field silently (default behavior) — the model selection is lost.

**Why it happens:** The paired Ástríðr change (add `model` to `TaskRequest`) has not yet been made.

**How to avoid:** The planner must sequence this as Wave 0 or Wave 1 — make the Ástríðr change first, then build the model selector in NewRunModal. Until the Ástríðr change lands, the model field can be in the UI but should be omitted from the POST body.

**Current TaskRequest fields** [VERIFIED: live codebase]: `prompt`, `provider`, `working_dir`, `max_turns`, `timeout_seconds`, `context_brief`, `checkpoint_mode`, `allowed_tools`, `system_prompt_append`, `sdk_capabilities`, `resume_session_id`. No `model` field.

### Pitfall 5: WS Route Has No Auth

**What goes wrong:** Developer adds auth to `useTaskStream` that the gateway doesn't validate, causing unnecessary complexity, OR assumes auth is required and blocks on key availability.

**Why it happens:** POST/DELETE /tasks require Bearer auth; WS /tasks/{id}/stream does not (verified: `app.py:205` — no `dependencies=[Depends(require_gateway_key)]` on the WS route).

**How to avoid:** `useTaskStream` opens the WebSocket with no auth headers or protocols. Auth is only needed for POST/DELETE.

### Pitfall 6: React Reducer + `Map` Mutation

**What goes wrong:** Directly mutating the `Map` in the reducer without creating a new `Map` instance, causing React to skip re-renders (referential equality check fails to detect change).

**Why it happens:** `Map` is mutable; `state.get(id).status = "running"` mutates in place.

**How to avoid:** Always `const next = new Map(state); next.set(id, updated); return next;` — return a new Map reference. The existing `LiveRun.tsx` uses simple `useState`; the refactor to `useReducer` + `Map` requires this discipline.

### Pitfall 7: Multiple useTaskStream Mounts for Same Run

**What goes wrong:** Multiple components call `useTaskStream` with the same `taskId`, opening duplicate WS connections to the gateway.

**Why it happens:** If `RunCard` and the detail panel both call `useTaskStream(taskId, dispatch)` the gateway gets two WS subscribers.

**How to avoid:** Mount `useTaskStream` exactly once per `taskId`, in a single manager component (e.g., `AgentConsole` page). Sub-components receive state from the run map via props/context.

---

## Code Examples

### Confirmed Gateway Route Shapes

```
POST   /tasks                        → { task_id: string }
GET    /tasks/{task_id}              → TaskResponse (no auth)
DELETE /tasks/{task_id}              → { status: "cancelled" }
WS     /tasks/{task_id}/stream       → TaskEvent[] until null sentinel (no auth)
GET    /browse/repos                 → RepoInfo[] (gateway:read scoped token)
GET    /browse/{repo}/tree?path=     → TreeEntry[] (gateway:read scoped token)
GET    /browse/{repo}/file?path=     → FileContent (gateway:read scoped token)
```

### TaskEvent Shape (Verified)

```typescript
// Source: C:\Users\mandr\astridr-repo\gateway\gateway\models.py
interface TaskEvent {
  task_id: string;
  timestamp: string;  // ISO UTC datetime
  event_type: string; // see taxonomy below
  provider: string;   // e.g., "claude-cli"
  data: Record<string, unknown>;
}
```

### Confirmed event_type Taxonomy (from adapters)

**ClaudeCLIAdapter** emits [VERIFIED: live codebase]:
- `"started"` — data: `{ command: "claude", working_dir: string|null }`
- `"progress"` — data: the raw parsed JSON from claude --output-format stream-json (pass-through)
- `"output"` — data: `{ text: string }` (non-JSON lines from claude stdout)
- `"completed"` — data: `{ returncode: 0 }` (no token/cost data in current impl)
- `"error"` — data: `{ error: string, returncode?: number }`

**CodexCLIAdapter** emits [VERIFIED: live codebase]:
- `"started"` — data: `{ command: "codex exec" }`
- `"output"` — data: parsed JSON or `{ text: string }`
- `"completed"` — data: `{ returncode: 0 }`
- `"error"` — data: `{ error: string, returncode?: number }`

**CRITICAL D-12 FINDING:** Neither adapter emits file-change or diff events. The `"completed"` event only carries `{ returncode: 0 }`. Token counts and cost are NOT present in any gateway stream event — they would need to come from parsing the claude CLI's `stream-json` output (which passes through as `"progress"` events with `event_type` set from the JSON `type` field). The summary's `filesTouched` and token/cost fields cannot be derived from the gateway stream alone in v1. Options: (a) parse `"progress"` events for `result_type: "result"` from claude CLI output, (b) leave `filesTouched` as undefined for v1, (c) fetch `GET /tasks/{id}` on terminal state for any accumulated data.

### CORS Requirement for Gateway POST/DELETE

**What:** The gateway adds CORS middleware only when `CODEPULSE_GATEWAY_ORIGIN` env var is set on the **gateway** side.

```python
# Source: C:\Users\mandr\astridr-repo\gateway\gateway\app.py lines 148-167
# allow_methods=["GET", "OPTIONS"] only — POST and DELETE NOT included by default!
```

**CRITICAL:** The current CORS config in `_configure_cors()` only allows `GET` and `OPTIONS`. POST and DELETE from the browser will be blocked by CORS preflight. **The gateway CORS config must be updated** to include `POST` and `DELETE` in `allow_methods` before browser-direct task submission can work. This is a paired Ástríðr change (same scope as adding `model` to TaskRequest).

[VERIFIED: live codebase — `app.py:165` `allow_methods=["GET", "OPTIONS"]`]

### Existing `appendBlocksWithDedup` (Reuse as-is)

```typescript
// Source: src/pages/LiveRun.tsx:23-32 [VERIFIED: live codebase]
export function appendBlocksWithDedup(prev: Block[], incoming: Block[]): Block[] {
  const filtered = incoming.filter(
    (b) => b.type !== "tool_use" && b.type !== "tool_result"
  );
  const combined = [...prev, ...filtered];
  if (combined.length > BLOCK_CAP) {
    return combined.slice(combined.length - BLOCK_CAP);
  }
  return combined;
}
// BLOCK_CAP = 500
```

This function is already exported from `LiveRun.tsx` and tested. Extract it to a shared utility (e.g., `src/lib/runUtils.ts`) so the run-reducer can use it.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-run `liveSessionId` heuristic (LiveRun) | `Map<taskId, RunState>` keyed on gateway-returned `task_id` | Phase 75 | Enables concurrent runs; eliminates fragile "latest session" guess |
| AstridrWSContext for all WS | AstridrWSContext for telemetry; `useTaskStream` for gateway task streams | Phase 75 | Correct separation of concerns; gateway is a different host/port/protocol |
| `run.stop` sendCommand (LiveRun) | `DELETE /tasks/{id}` HTTP call | Phase 75 | Gateway-backed cancel replaces the telemetry WS command |

**Deprecated/outdated:**
- `handleStop` sending `{ type: "run.stop" }` via `sendCommand` in LiveRun.tsx: replaced by `cancelTask(taskId)` HTTP call to gateway. The old pattern used AstridrWSContext; Phase 75 uses the gateway REST API instead.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Token counts and cost are NOT present in the gateway stream's `"completed"` event — only `{ returncode: 0 }` is emitted | Code Examples / D-12 finding | If wrong: tokens/cost could be auto-populated in RunSummary from stream; if correct (as verified): must leave as undefined unless parsing claude CLI stream-json progress events |
| A2 | The gateway WS route (`/tasks/{id}/stream`) requires no auth (bearer token) | Pitfall 5 | If wrong: WS connections silently fail with 4xx close code; easy to debug |
| A3 | `VITE_ASTRIDR_API_KEY` (used for `:8181` Ástríðr API) is different from `GATEWAY_API_KEY` (used for `:8200` gateway) | Pitfall 1 | If they happen to be the same value in Larry's setup, this simplifies the env var count but the separation should still be maintained in code |
| A4 | Scoped token for browse (`gateway:read`) must be fetched from `POST /api/access/token` at runtime | Pattern 5 / WorkdirPicker | If Larry has the token minted differently (e.g., stored in env), the WorkdirPicker can simplify auth |

---

## Open Questions (RESOLVED)

1. **CORS for POST/DELETE on gateway**
   - What we know: `_configure_cors()` currently allows only `GET, OPTIONS` — POST and DELETE from browser will be blocked
   - What's unclear: Is Larry running CodePulse and gateway on the same origin (localhost:5173 → localhost:8200), or does cross-origin CORS apply?
   - Recommendation: Confirm whether `CODEPULSE_GATEWAY_ORIGIN` is set in the gateway env; if yes, also add `POST, DELETE` to `allow_methods`. This is a required paired Ástríðr change.

2. **`model` field timeline**
   - What we know: `model` is not in the current `TaskRequest`; it's a PAIRED ÁSTRÍÐR CHANGE
   - What's unclear: Does this change land before Phase 75 execution or is it done as the first task of Phase 75?
   - Recommendation: Plan it as Wave 0, Task 0 of Phase 75 — a tiny 2-line Ástríðr change. CodePulse can build with the model selector but skip the field in POST body until confirmed.

3. **filesTouched from claude CLI progress events**
   - What we know: claude `--output-format stream-json` emits structured JSON including file operations; these pass through as `"progress"` events with `event_type` from the JSON `type` field
   - What's unclear: Which `type` values from claude's stream-json carry file paths?
   - Recommendation: Parse `data.type === "result"` from progress events (which claude emits at the end with a summary); if the summary includes file paths, extract them. If not in v1, leave `filesTouched: undefined` and note in the summary as a v1 limitation.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | Build, tests | ✓ | (project is running) | — |
| Vitest | Tests | ✓ | in package.json | — |
| Convex dev | Schema changes | ✓ | ^1.39.1 | — |
| Gateway (:8200) | CON-01 to CON-03 | ✓ (Ástríðr v18.0 shipped) | gateway/gateway/app.py | — |
| `AlertDialog` shadcn primitive | GlobalEStopButton | ✗ (not yet in src/components/ui/) | — | Wave 0: `npx shadcn@latest add alert-dialog` |
| VITE_GATEWAY_URL env var | POST/DELETE /tasks | ✗ (not yet defined in .env) | — | Wave 0: add to .env and .env.example |
| GATEWAY_API_KEY on gateway side | Bearer auth for POST/DELETE | Assumed configured (Ástríðr v18.0 shipped) | — | 503 from gateway if unset |

**Missing dependencies with no fallback:** None that block core work.

**Missing dependencies with fallback or Wave 0 fix:**
- `AlertDialog`: install via shadcn in Wave 0
- `VITE_GATEWAY_URL` / `VITE_GATEWAY_WS_URL` / `VITE_GATEWAY_API_KEY`: add to .env in Wave 0
- CORS `allow_methods` fix on gateway: paired Ástríðr change, Wave 0

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (jsdom) |
| Config file | vite.config.ts (vitest configured inline via `package.json` test script) |
| Setup file | `src/test/setup.ts` (mocks Clerk, Recharts, Three.js, etc.) |
| Quick run command | `npx vitest run src/pages/LiveRun.test.tsx` (once created) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CON-01 | `submitTask()` calls `POST /tasks` with correct payload and returns `task_id` | unit | `npx vitest run src/lib/astridrApi.test.ts -t "submitTask"` | ❌ Wave 0 |
| CON-01 | `cancelTask()` calls `DELETE /tasks/{id}` | unit | `npx vitest run src/lib/astridrApi.test.ts -t "cancelTask"` | ❌ Wave 0 |
| CON-02 | `runMapReducer` correctly folds `EVENT/CLOSED/ERROR` actions onto RunState | unit | `npx vitest run src/lib/runReducer.test.ts` | ❌ Wave 0 |
| CON-02 | `appendBlocksWithDedup` (extracted to runUtils.ts) caps at 500, deduplicates | unit | `npx vitest run src/lib/runUtils.test.ts` | ❌ Wave 0 (extract existing logic) |
| CON-02 | `stopping → stopped` transition on WS close (no cancel event) | unit | `npx vitest run src/lib/runReducer.test.ts -t "stopping to stopped"` | ❌ Wave 0 |
| CON-03 | Stop button dispatches `SET_STOPPING` + calls `cancelTask` | unit | `npx vitest run src/components/console/RunCard.test.tsx` | ❌ Wave 0 |
| CON-03 | Global e-stop iterates DELETE over all active task IDs | unit | `npx vitest run src/components/console/GlobalEStopButton.test.tsx` | ❌ Wave 0 |
| CON-04 | `saveRunSummary` mutation upserts by taskId (idempotent) | unit (Convex) | `npx vitest run convex/agentRuns.test.ts` | ❌ Wave 0 |
| CON-04 | Terminal state change triggers `saveRunSummary` mutation call | unit | `npx vitest run src/pages/AgentConsole.test.tsx -t "persists on terminal"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/lib/runReducer.test.ts src/lib/runUtils.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/lib/runUtils.ts` — extract `appendBlocksWithDedup` + `BLOCK_CAP` from LiveRun.tsx
- [ ] `src/lib/runUtils.test.ts` — covers dedup/cap logic (migrate existing implicit test)
- [ ] `src/lib/runReducer.ts` — `runMapReducer` + `RunState` types
- [ ] `src/lib/runReducer.test.ts` — covers ADD_RUN, EVENT fold, SET_STOPPING, CLOSED, stopping→stopped
- [ ] `src/lib/astridrApi.test.ts` (extend) — covers `submitTask`, `cancelTask`
- [ ] `convex/agentRuns.test.ts` — covers `saveRunSummary` idempotency, `listRecent`
- [ ] Wave 0 component stubs: `src/components/console/` directory

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Bearer `GATEWAY_API_KEY` for POST/DELETE; scoped HMAC token for browse — both implemented by gateway |
| V3 Session Management | no | No session state for gateway tasks beyond task_id |
| V4 Access Control | yes | Gateway enforces key on mutating endpoints; read-only WS/GET are open by design (only accessible on localhost) |
| V5 Input Validation | yes | Prompt, workdir, max_turns validated client-side (required fields, number range); Pydantic validates server-side |
| V6 Cryptography | yes | Browse scoped token uses PBKDF2/HMAC-SHA256 — do not hand-roll; use the `POST /api/access/token` endpoint |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via task prompt field | Tampering | Gateway passes prompt to claude/codex CLI as `--prompt` arg; no shell injection possible (subprocess exec, not shell=True) |
| Path traversal via working_dir | Tampering | Gateway `_validate_working_dir()` checks against `allowed_working_dirs` allowlist |
| Replay of task_id to cancel another user's run | Tampering | N/A — single-user localhost deployment; no multi-tenancy |
| XSS via stream content rendered as HTML | Tampering | RunBlock renders text content as React children (escaped), not dangerouslySetInnerHTML |
| GATEWAY_API_KEY exposure in bundle | Information Disclosure | Use `VITE_GATEWAY_API_KEY` in env; note it IS exposed in browser (localhost-only deployment mitigates risk) |

---

## Sources

### Primary (HIGH confidence)

- `C:\Users\mandr\astridr-repo\gateway\gateway\app.py` — live gateway routes; POST/DELETE/WS contracts; CORS config
- `C:\Users\mandr\astridr-repo\gateway\gateway\models.py` — TaskRequest, TaskEvent, TaskStatus, Provider enum
- `C:\Users\mandr\astridr-repo\gateway\gateway\task_manager.py` — cancel semantics (asyncio CancelledError, not pid-kill)
- `C:\Users\mandr\astridr-repo\gateway\gateway\adapters\claude_cli.py` — ClaudeCLI event_type taxonomy
- `C:\Users\mandr\astridr-repo\gateway\gateway\adapters\codex_cli.py` — Codex event_type taxonomy
- `C:\Users\mandr\astridr-repo\gateway\gateway\auth.py` — Bearer auth, require_gateway_key
- `C:\Users\mandr\astridr-repo\gateway\gateway\browse.py` — browse routes, scoped token auth
- `C:\Users\mandr\codepulse\src\pages\LiveRun.tsx` — existing surface to evolve
- `C:\Users\mandr\codepulse\src\lib\astridrApi.ts` — existing HTTP layer
- `C:\Users\mandr\codepulse\src\contexts\AstridrWSContext.tsx` — existing WS context
- `C:\Users\mandr\codepulse\convex\schema.ts` — existing Convex tables (no agentRuns yet)
- `C:\Users\mandr\codepulse\convex\runBlocks.ts` — existing run persistence pattern
- `C:\Users\mandr\codepulse\.planning\phases\75-agent-console\75-CONTEXT.md` — locked decisions
- `C:\Users\mandr\codepulse\.planning\phases\75-agent-console\75-UI-SPEC.md` — visual contract

### Secondary (MEDIUM confidence)

- `C:\Users\mandr\codepulse\src\components\RunSummary.tsx` — extension point confirmed
- `C:\Users\mandr\codepulse\src\components\hr\WarRoomLaunchDialog.tsx` — launch modal pattern source

---

## Project Constraints (from CLAUDE.md)

From `C:\Users\mandr\codepulse\CLAUDE.md`:

1. **Auth header required:** All `fetch()` calls to Ástríðr backend MUST include `Authorization: Bearer` using `VITE_ASTRIDR_API_KEY`. For gateway calls, use a separate `VITE_GATEWAY_API_KEY`.
2. **shadcn/ui New York:** Compose existing primitives; don't hand-roll. AlertDialog must come from official shadcn registry.
3. **Icons: Lucide only.** No other icon libraries.
4. **Tailwind CSS 4:** Use `bg-(--token)` syntax (not `bg-[var(--token)]`).
5. **Path alias `@/`** resolves to `./src/` — use in imports.
6. **Adding a new page pattern:** Create `src/pages/NewPage.tsx` → import in `App.tsx` → add `<Route>` → add nav entry in `src/layouts/DashboardLayout.tsx`. For Phase 75: LiveRun.tsx is evolved in-place; the route already exists.
7. **Convex patterns:** `useQuery(api.domain.fn)` + `useMutation(api.domain.fn)`. New Convex functions in `convex/agentRuns.ts`.
8. **Error boundaries:** Wrap new console sections with `<SectionErrorBoundary name="...">`.
9. **Test:** `npm test` (Vitest, jsdom). Run single file: `npx vitest run <path>`.
10. **No `.env` edits via Claude tools** — Larry edits `.env` manually.

---

## Metadata

**Confidence breakdown:**
- Gateway API contract: HIGH — verified from live source files
- Cancel semantics (CON-03): HIGH — task_manager.cancel() flow verified
- Event type taxonomy: HIGH — verified from adapter source
- CORS issue (allow_methods): HIGH — verified from app.py line 165
- No model field yet: HIGH — verified from models.py TaskRequest
- No token/cost in completed event: HIGH — verified from adapter code
- Convex schema addition: HIGH — no agentRuns table exists, pattern established
- WorkdirPicker scoped token flow: MEDIUM — browse.py verified, but token-fetch flow in Ástríðr access_token.py not read
- filesTouched from claude stream-json: LOW — depends on claude CLI output format not directly verified

**Research date:** 2026-06-10
**Valid until:** 2026-07-10 (stable — gateway contract is live code, not docs)
