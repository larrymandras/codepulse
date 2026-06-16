# Phase 75: Agent Console - Pattern Map

**Mapped:** 2026-06-10
**Files analyzed:** 11 new/modified files
**Analogs found:** 10 / 11

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/runUtils.ts` | utility | transform | `src/pages/LiveRun.tsx` lines 23-32 | extract-from-source |
| `src/lib/runReducer.ts` | utility/store | event-driven | `src/hooks/useLiveState.ts` | role-match |
| `src/lib/astridrApi.ts` (extend) | service | request-response | `src/lib/astridrApi.ts` itself | self-extend |
| `src/hooks/useTaskStream.ts` | hook | streaming | `src/contexts/AstridrWSContext.tsx` | pattern-match |
| `src/pages/LiveRun.tsx` (evolve) | page/controller | event-driven | `src/pages/LiveRun.tsx` itself | self-evolve |
| `src/components/console/NewRunModal.tsx` | component | request-response | `src/components/hr/WarRoomLaunchDialog.tsx` | exact |
| `src/components/console/RunCard.tsx` | component | event-driven | `src/pages/LiveRun.tsx` (stop button + status) | partial |
| `src/components/console/RunList.tsx` | component | transform | `src/pages/LiveRun.tsx` (layout section) | partial |
| `src/components/console/GlobalEStopButton.tsx` | component | request-response | `src/components/hr/WarRoomLaunchDialog.tsx` (confirm pattern) | partial |
| `src/components/console/WorkdirPicker.tsx` | component | request-response | `src/lib/astridrApi.ts` (apiRequest) | partial |
| `src/components/RunSummary.tsx` (extend) | component | transform | `src/components/RunSummary.tsx` itself | self-extend |
| `convex/schema.ts` (extend) | config | CRUD | `convex/schema.ts` `gatewayTasks` table | exact |
| `convex/agentRuns.ts` | service | CRUD | `convex/runBlocks.ts` | exact |

---

## Pattern Assignments

### `src/lib/runUtils.ts` (utility, transform)

**Analog:** `src/pages/LiveRun.tsx` lines 1-32 — extract and re-export the block utility.

**Extract this function verbatim** (LiveRun.tsx lines 23-32):
```typescript
// Move from LiveRun.tsx into src/lib/runUtils.ts
export const BLOCK_CAP = 500;

export type Block = { type: string; [key: string]: unknown };

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
```

**Import pattern for consumers** — use path alias:
```typescript
import { appendBlocksWithDedup, BLOCK_CAP, type Block } from "@/lib/runUtils";
```

**After extraction**, update `LiveRun.tsx` to import from `@/lib/runUtils` instead of defining locally.

---

### `src/lib/runReducer.ts` (utility/store, event-driven)

**Analog:** `src/hooks/useLiveState.ts` — same `useReducer` + discriminated-union action pattern.

**Imports pattern** (mirroring useLiveState.ts lines 1-13 and runUtils extract):
```typescript
import type { Block } from "@/lib/runUtils";
import { appendBlocksWithDedup, BLOCK_CAP } from "@/lib/runUtils";
```

**Discriminated union action pattern** (copy from useLiveState.ts lines 24-29):
```typescript
// useLiveState.ts lines 24-29 — same pattern, extended for run map
type LiveStateAction =
  | { type: "SET_AGENT_STATUS"; payload: LiveStateSlice["agentStatus"] }
  | { type: "SET_ACTIVE_RUN"; payload: { id: string | null; progress: number | null } }
  // ...
  | { type: "CLEAR_ALL" };
```

**Reducer immutability pattern** (critical — from RESEARCH.md Pitfall 6):
```typescript
// Always return a new Map reference — never mutate in place
function runMapReducer(
  state: Map<string, RunState>,
  action: RunMapAction,
): Map<string, RunState> {
  const next = new Map(state);   // ← new Map on every action
  switch (action.type) {
    case "ADD_RUN": {
      next.set(action.taskId, { /* initial RunState */ });
      return next;
    }
    case "EVENT": {
      const run = state.get(action.taskId);
      if (!run) return state;    // ← return original ref when no-op
      next.set(action.taskId, foldEvent(run, action.event));
      return next;
    }
    // ...
    default:
      return state;              // ← return original ref for unknown actions
  }
}
```

**INITIAL_STATE pattern** (from useLiveState.ts lines 31-37):
```typescript
const INITIAL_STATE: LiveStateSlice = {
  agentStatus: null,
  // ...
};
```

**RunState + GatewayRunStatus types** — defined in this file (not in the hook):
```typescript
export type GatewayRunStatus =
  | "queued" | "running" | "stopping" | "completed" | "error" | "stopped";

export interface RunState {
  taskId: string;
  status: GatewayRunStatus;
  provider: string;
  prompt: string;
  workdir: string;
  model?: string;
  agentPersona?: string;
  blocks: Block[];
  rounds: number;
  startedAt: number;
  completedAt?: number;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  filesTouched?: string[];
  autoScroll: boolean;
}
```

**`stopping → stopped` on WS close** — the only state transition driven by WS close (RESEARCH.md Pitfall 3):
```typescript
case "CLOSED": {
  const run = state.get(action.taskId);
  if (!run) return state;
  // stopping → stopped; running/queued → completed (stream ended cleanly)
  if (run.status === "stopping") {
    next.set(action.taskId, { ...run, status: "stopped", completedAt: Date.now() });
  } else if (run.status === "running" || run.status === "queued") {
    next.set(action.taskId, { ...run, status: "completed", completedAt: Date.now() });
  }
  return next;
}
```

---

### `src/lib/astridrApi.ts` (extend — add gateway helpers)

**Analog:** The file itself. Extension follows the exact same pattern as all existing functions.

**Existing base URL + auth pattern** (astridrApi.ts lines 1-2, 117-136):
```typescript
// EXISTING — for :8181 Ástríðr main API
const ASTRIDR_API_BASE = import.meta.env.VITE_ASTRIDR_API_URL ?? "";
const ASTRIDR_API_KEY = import.meta.env.VITE_ASTRIDR_API_KEY ?? "";

export function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (ASTRIDR_API_KEY) h["Authorization"] = `Bearer ${ASTRIDR_API_KEY}`;
  return h;
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${ASTRIDR_API_BASE}${path}`, {
    headers: authHeaders(),
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new AstridrApiError(res.status, body.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}
```

**New gateway section to append** — same structure as the "Phase 78: War Room Launch" and "Meeting Bot" sections already in the file (lines 236-286):
```typescript
// ---------------------------------------------------------------------------
// Phase 75: Agent Console — Gateway Task API (:8200)
// ---------------------------------------------------------------------------

const GATEWAY_API_BASE = import.meta.env.VITE_GATEWAY_URL ?? "http://localhost:8200";
const GATEWAY_API_KEY = import.meta.env.VITE_GATEWAY_API_KEY ?? "";

function gatewayAuthHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (GATEWAY_API_KEY) h["Authorization"] = `Bearer ${GATEWAY_API_KEY}`;
  return h;
}

async function gatewayRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${GATEWAY_API_BASE}${path}`, {
    headers: gatewayAuthHeaders(),
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new AstridrApiError(res.status, body.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export interface TaskRequest {
  prompt: string;
  provider: "claude-cli" | "codex" | "auto";
  working_dir?: string;
  max_turns?: number;
  timeout_seconds?: number;
  system_prompt_append?: string;
  // model?: string  — add after paired Ástríðr TaskRequest change lands
}

export interface TaskSubmitResponse {
  task_id: string;
}

export async function submitTask(req: TaskRequest): Promise<TaskSubmitResponse> {
  return gatewayRequest<TaskSubmitResponse>("/tasks", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function cancelTask(taskId: string): Promise<void> {
  await gatewayRequest<unknown>(`/tasks/${taskId}`, { method: "DELETE" });
}

/** Base URL for gateway WS streams — derive from VITE_GATEWAY_URL by replacing http→ws */
export const gatewayWsBase = (): string =>
  (import.meta.env.VITE_GATEWAY_WS_URL as string | undefined) ??
  GATEWAY_API_BASE.replace(/^http/, "ws");
```

**Error handling pattern** — reuse `AstridrApiError` (astridrApi.ts lines 107-115) — already defined; no new class needed.

---

### `src/hooks/useTaskStream.ts` (hook, streaming)

**Analog:** `src/contexts/AstridrWSContext.tsx` — same native `WebSocket` API, same `useEffect` cleanup, same `useRef` for the WS instance. The key difference: no reconnect logic (task streams are intentionally terminal), no auth (WS route is open per RESEARCH.md Pitfall 5).

**WS lifecycle pattern** (from AstridrWSContext.tsx lines 166-303, distilled):
```typescript
// From AstridrWSContext.tsx connect() — same pattern, simplified for single-task stream
import { useEffect } from "react";

// WS connection and cleanup
useEffect(() => {
  if (!taskId) return;
  const ws = new WebSocket(url);

  ws.onopen = () => { /* optional */ };
  ws.onmessage = (e: MessageEvent<string>) => { /* dispatch */ };
  ws.onclose = () => { /* dispatch CLOSED */ };
  ws.onerror = () => { /* dispatch ERROR — onclose fires after, no retry needed */ };

  return () => {
    ws.onclose = null;  // ← prevent CLOSED dispatch after unmount (from AstridrWSContext.tsx line 296)
    ws.close();
  };
}, [taskId, dispatch, gatewayWsBase]);
```

**StrictMode double-mount protection** (from AstridrWSContext.tsx lines 289-292):
```typescript
// AstridrWSContext delays connect by 50ms to survive StrictMode double-mount.
// useTaskStream should apply the same pattern:
const connectTimer = setTimeout(() => {
  const ws = new WebSocket(url);
  // ...
}, 50);
return () => {
  clearTimeout(connectTimer);
  ws?.close();
};
```

**Full imports pattern**:
```typescript
import { useEffect, useRef } from "react";
import { gatewayWsBase } from "@/lib/astridrApi";
import type { RunMapAction } from "@/lib/runReducer";
```

**No auth on WS** — confirmed from gateway `app.py` line 205, no `Depends(require_gateway_key)` on the WS route. Do not add auth headers or protocols to the WebSocket constructor.

---

### `src/pages/LiveRun.tsx` → AgentConsole (evolve, page/controller, event-driven)

**Analog:** The file itself. All imports, layout patterns, and hook usage are inherited.

**Current imports to retain and extend** (LiveRun.tsx lines 1-16):
```typescript
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useReducer,    // ← ADD: replace useState for run map
  type UIEvent,
} from "react";
import { useQuery, useMutation } from "convex/react";   // ← ADD useMutation for saveRunSummary
import { api } from "../../convex/_generated/api";
import { useAstridrWS } from "../contexts/AstridrWSContext"; // ← KEEP (telemetry only)
import { WSStatusIndicator } from "../components/WSStatusIndicator";
import { RunTimeline } from "../components/RunTimeline";
import { RunHistorySelector } from "../components/RunHistorySelector";
import { RunSummary } from "../components/RunSummary";
import { Square, Play, OctagonX } from "lucide-react";  // ← ADD Play, OctagonX
import { toast } from "sonner";                          // ← ADD
```

**Single-run → Map refactor pattern** — the `useState` → `useReducer` migration (LiveRun.tsx lines 57-65 become):
```typescript
// BEFORE (LiveRun.tsx lines 57-65):
const [liveBlocks, setLiveBlocks] = useState<Block[]>([]);
const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
const [runMeta, setRunMeta] = useState<RunMeta>(INITIAL_META);

// AFTER:
const [runMap, dispatch] = useReducer(runMapReducer, new Map<string, RunState>());
const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
```

**Auto-scroll pattern to preserve** (LiveRun.tsx lines 164-182) — per-run, keyed on selectedRunId:
```typescript
// This exact pattern must be preserved per run (LiveRun.tsx lines 164-182)
const scrollRef = useRef<HTMLDivElement>(null);
const scrollToBottom = useCallback(() => {
  const el = scrollRef.current;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}, []);

const handleScroll = useCallback(
  (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (!atBottom && autoScroll) setAutoScroll(false);
    if (atBottom && !autoScroll) setAutoScroll(true);
  },
  [autoScroll]
);
```

**"↓ Latest" pill** (LiveRun.tsx lines 266-273) — preserve exactly:
```typescript
{activeTab === "timeline" && !autoScroll && (
  <div className="flex justify-center py-2 shrink-0">
    <button
      className="text-xs px-3 py-1 bg-(--primary) text-(--primary-foreground) rounded-full"
      onClick={() => { setAutoScroll(true); scrollToBottom(); }}
    >↓ Latest</button>
  </div>
)}
```

**Convex history query pattern** (LiveRun.tsx lines 68-75):
```typescript
// Reuse this pattern for agentRuns history query:
const sessions = useQuery(api.runBlocks.listSessions) ?? [];
// New equivalent:
const agentRunHistory = useQuery(api.agentRuns.listRecent) ?? [];
```

**useAstridrWS telemetry stays** — keep all existing `subscribeEvent("run.*")` hooks as-is; they are for the Ástríðr telemetry WS (`:8181`), not the gateway. Do not remove them.

**Header layout pattern** (LiveRun.tsx lines 204-213):
```typescript
// Evolve this header section:
<div className="flex items-center justify-between p-4 border-b border-(--border) shrink-0">
  <h1 className="text-xl font-semibold text-(--foreground)">Live Run</h1>
  <div className="flex items-center gap-3">
    <RunHistorySelector ... />
    <WSStatusIndicator status={status} />
  </div>
</div>
// Add "New Run" CTA and GlobalEStopButton to the right side of this header.
```

---

### `src/components/console/NewRunModal.tsx` (component, request-response)

**Analog:** `src/components/hr/WarRoomLaunchDialog.tsx` — exact structural match.

**Imports pattern** (WarRoomLaunchDialog.tsx lines 1-21):
```typescript
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Play } from "lucide-react";           // ← Play instead of Zap
import { toast } from "sonner";
import { submitTask, fetchAgents, type TaskRequest } from "@/lib/astridrApi";
```

**Dialog shell pattern** (WarRoomLaunchDialog.tsx lines 194-202):
```typescript
// Copy this shell exactly — only change max-w from 500px to 520px (per UI-SPEC)
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent className="sm:max-w-[520px]">
    <DialogHeader>
      <DialogTitle>New Run</DialogTitle>
      <DialogDescription>Configure and launch a coding task.</DialogDescription>
    </DialogHeader>
    {/* fields */}
    <DialogFooter>...</DialogFooter>
  </DialogContent>
</Dialog>
```

**State reset on open** (WarRoomLaunchDialog.tsx lines 119-131) — copy this pattern:
```typescript
useEffect(() => {
  if (open) {
    setProvider("claude-cli");
    setWorkdir("");
    setPrompt("");
    setModel(undefined);
    setMaxTurns(undefined);
    setAgentPersona(undefined);
    setIsLaunching(false);
  }
}, [open]);
```

**Launch handler pattern** (WarRoomLaunchDialog.tsx lines 156-192):
```typescript
const handleLaunch = async () => {
  if (!prompt.trim() || !workdir.trim()) return;
  setIsLaunching(true);
  try {
    const result = await submitTask({
      prompt: prompt.trim(),
      provider,
      working_dir: workdir.trim(),
      max_turns: maxTurns,
      system_prompt_append: agentPersona,
    });
    onTaskSubmitted(result.task_id);  // ← callback informs parent to ADD_RUN
    toast.success(`Run ${result.task_id.slice(0, 8)}… launched`);
    onOpenChange(false);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Failed to launch run");
  } finally {
    setIsLaunching(false);
  }
};
```

**Footer buttons pattern** (WarRoomLaunchDialog.tsx lines 308-325):
```typescript
<DialogFooter>
  <Button variant="outline" onClick={() => onOpenChange(false)}>
    Cancel
  </Button>
  <Button
    className="bg-primary text-primary-foreground"  // ← emerald, not red (war room uses red)
    disabled={!prompt.trim() || !workdir.trim() || isLaunching}
    onClick={handleLaunch}
  >
    <Play className="h-4 w-4 mr-1" />
    {isLaunching ? "Launching…" : "Launch Run"}
  </Button>
</DialogFooter>
```

**Field pattern** (WarRoomLaunchDialog.tsx lines 253-275):
```typescript
// Each field follows this space-y-2 + Label + Input/Select stack:
<div className="space-y-2">
  <Label htmlFor="field-id">Field Label</Label>
  <Input id="field-id" value={value} onChange={(e) => setValue(e.target.value)} placeholder="..." />
</div>
```

---

### `src/components/console/RunCard.tsx` (component, event-driven)

**Analog:** `src/pages/LiveRun.tsx` — stop button + session ID + status display patterns.

**Stop button pattern** (LiveRun.tsx lines 226-231):
```typescript
// Source pattern — adapt: swap sendCommand for cancelTask; add "Stopping…" state
<button
  onClick={handleStop}
  disabled={!hasActiveRun}  // ← adapt: disabled when status !== "running"
  className="flex items-center gap-1 px-3 py-1 text-sm bg-(--destructive) text-white disabled:opacity-50"
  title="Stop Run"
>
  <Square className="h-4 w-4" />Stop
</button>
```

**Session ID chip pattern** (LiveRun.tsx lines 233-239):
```typescript
// Adapt for RunCard — show first 8 chars per UI-SPEC (LiveRun shows 16):
<span className="text-xs text-(--muted-foreground) font-mono uppercase tracking-widest">
  {taskId.slice(0, 8)}…
</span>
```

**shadcn Button for stop** (per UI-SPEC) — use shadcn `Button` rather than raw `<button>`:
```typescript
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";

// Stop button as shadcn Button:
<Button
  variant="destructive"
  size="sm"
  onClick={handleStop}
  disabled={status !== "running"}
>
  <Square className="h-4 w-4 mr-1" />
  {status === "stopping" ? "Stopping…" : "Stop"}
</Button>
```

---

### `src/components/console/RunList.tsx` (component, transform)

**No direct analog** — simple composition component. Pattern from LiveRun.tsx layout.

**Empty state pattern** (LiveRun.tsx lines 243-248):
```typescript
// Copy the empty state pattern:
<div className="flex items-center justify-center h-64">
  <p className="text-sm text-(--muted-foreground) text-center">
    No active runs. Launch a task to start a Claude Code or Codex run.
  </p>
</div>
```

**Scrollable list container** — from UI-SPEC:
```typescript
// Per UI-SPEC layout spec — run list is independently scrollable:
<div className="w-72 shrink-0 overflow-y-auto flex flex-col gap-0">
  <div className="space-y-3 p-3">
    {runs.map((run) => <RunCard key={run.taskId} run={run} ... />)}
  </div>
</div>
```

---

### `src/components/console/GlobalEStopButton.tsx` (component, request-response)

**Analog:** `src/components/hr/WarRoomLaunchDialog.tsx` — confirm-then-act pattern.

**AlertDialog confirm pattern** — new shadcn primitive; copy the Dialog structure from WarRoomLaunchDialog for the confirm modal wrapper:
```typescript
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { OctagonX } from "lucide-react";

// AlertDialog trigger wrapping the destructive button:
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive" disabled={activeCount === 0}>
      <OctagonX className="h-4 w-4 mr-1" />
      E-Stop All
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Emergency Stop All Runs</AlertDialogTitle>
      <AlertDialogDescription>
        This will cancel all {activeCount} active run(s). Agents will stop at
        their next safe checkpoint.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        onClick={handleEStopAll}
      >
        Stop All Runs
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Iterate cancel pattern** — mirroring the `for...of` loop in `flushCommandQueue` from AstridrWSContext.tsx line 153:
```typescript
const handleEStopAll = async () => {
  await Promise.allSettled(
    activeTaskIds.map((id) => cancelTask(id))
  );
  // dispatch SET_STOPPING for each
};
```

---

### `src/components/console/WorkdirPicker.tsx` (component, request-response)

**Analog:** `src/lib/astridrApi.ts` `apiRequest` pattern for `GET /browse/repos`.

**Two-mode component pattern** — try M1.P3 browse, fall back to free-text Input (D-03):
```typescript
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";

// Fallback mode (always works):
<Input
  value={value}
  onChange={(e) => onChange(e.target.value)}
  placeholder="Absolute path (e.g. /home/user/project)"
/>

// Try GET /browse/repos on mount; on failure set browseAvailable = false
useEffect(() => {
  void (async () => {
    try {
      const repos = await fetchBrowseRepos();  // new function in astridrApi.ts
      setRepos(repos);
      setBrowseAvailable(true);
    } catch {
      setBrowseAvailable(false);
    }
  })();
}, []);
```

**Browse API helpers** — extend `astridrApi.ts` gatewayRequest section with:
```typescript
export interface RepoInfo { name: string; path: string }

export async function fetchBrowseRepos(): Promise<RepoInfo[]> {
  // Browse routes use scoped gateway:read token, not GATEWAY_API_KEY
  // Fetch scoped token first via POST /api/access/token on :8181
  const token = await fetchScopedToken("gateway:read");
  const res = await fetch(`${GATEWAY_API_BASE}/browse/repos`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new AstridrApiError(res.status, "Browse unavailable");
  return res.json();
}
```

---

### `src/components/RunSummary.tsx` (extend, component, transform)

**Analog:** The file itself. Extension adds new optional props and two new sections using the existing `StatCard` + `bg-(--card) border border-(--border) rounded p-3` pattern.

**Existing StatCard pattern** (RunSummary.tsx lines 33-43) — reuse for new "Run Config" section:
```typescript
function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-(--card) border border-(--border) rounded p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-(--muted-foreground)">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <span className="text-lg font-semibold text-(--foreground) font-mono">{value}</span>
    </div>
  );
}
```

**Existing tool-usage section pattern** (RunSummary.tsx lines 111-125) — same `bg-(--card) border` container pattern for the new "Files Touched" section:
```typescript
{filesTouched && filesTouched.length > 0 && (
  <div className="bg-(--card) border border-(--border) rounded p-3">
    <div className="flex items-center gap-1.5 text-(--muted-foreground) mb-2">
      <FileCode className="h-3.5 w-3.5" />
      <span className="text-xs">Files Touched</span>
    </div>
    <div className="flex flex-col gap-1">
      {filesTouched.map((f) => (
        <span key={f} className="text-xs font-mono text-(--foreground)">{f}</span>
      ))}
    </div>
  </div>
)}
```

**New props to add to `RunSummaryProps`** (extend lines 6-15):
```typescript
interface RunSummaryProps {
  // ... existing props unchanged ...
  // New Phase 75 props:
  filesTouched?: string[];
  prompt?: string;
  engine?: string;
  model?: string;
  workdir?: string;
  agentPersona?: string;
}
```

---

### `convex/agentRuns.ts` (service, CRUD)

**Analog:** `convex/runBlocks.ts` — exact same pattern: `mutation` + `query` from `./_generated/server`, `v` from `convex/values`.

**Imports pattern** (runBlocks.ts lines 1-3):
```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
```

**Mutation pattern with idempotency** (extend runBlocks.ts `record` mutation pattern, but add upsert check per RESEARCH.md Pattern 4):
```typescript
export const saveRunSummary = mutation({
  args: { /* all RunState terminal fields */ },
  handler: async (ctx, args) => {
    // Idempotency: skip if already persisted (runBlocks.record has no upsert — this adds it)
    const existing = await ctx.db
      .query("agentRuns")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("agentRuns", args);
  },
});
```

**Query pattern** (runBlocks.ts lines 25-45 — same `.order("desc").take(N)` shape):
```typescript
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

---

### `convex/schema.ts` (extend — add agentRuns table)

**Analog:** Existing `gatewayTasks` table definition (schema.ts lines 1402-1415) — the most similar table (task-tracking, status, provider, duration).

**Pattern for new table** — append after existing tables using the same `defineTable` + index pattern:
```typescript
// Analog — gatewayTasks (schema.ts lines 1402-1415):
gatewayTasks: defineTable({
  taskId: v.string(),
  provider: v.string(),
  status: v.string(),
  durationSeconds: v.optional(v.float64()),
  error: v.optional(v.string()),
  timestamp: v.float64(),
})
  .index("by_timestamp", ["timestamp"])
  .index("by_provider", ["provider", "timestamp"])
  .index("by_taskId", ["taskId"])
  .index("by_status", ["status", "timestamp"]),

// New agentRuns table — same pattern, richer fields:
agentRuns: defineTable({
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
})
  .index("by_taskId", ["taskId"])
  .index("by_status", ["status", "startedAt"])
  .index("by_startedAt", ["startedAt"]),
```

---

## Shared Patterns

### Auth Headers (two distinct helpers)

**Source A:** `src/lib/astridrApi.ts` lines 117-121 — Ástríðr main API (`:8181`)
```typescript
export function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (ASTRIDR_API_KEY) h["Authorization"] = `Bearer ${ASTRIDR_API_KEY}`;
  return h;
}
```

**Source B:** New `gatewayAuthHeaders()` in same file — Gateway API (`:8200`)
```typescript
function gatewayAuthHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (GATEWAY_API_KEY) h["Authorization"] = `Bearer ${GATEWAY_API_KEY}`;
  return h;
}
```

**Apply to:** `submitTask`, `cancelTask`, `fetchBrowseRepos` (different auth from browse). WS stream: NO auth headers.

### Error Handling

**Source:** `src/lib/astridrApi.ts` lines 107-115 (`AstridrApiError`) + lines 126-136 (`apiRequest`).
```typescript
export class AstridrApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AstridrApiError";
    this.status = status;
  }
}
```

**Toast pattern from WarRoomLaunchDialog.tsx lines 181-188:**
```typescript
try {
  // ... API call ...
} catch (err) {
  toast.error(err instanceof Error ? err.message : "Failed to launch run");
} finally {
  setIsLaunching(false);
}
```

**Apply to:** `NewRunModal` launch handler, `RunCard` stop handler, `GlobalEStopButton` e-stop handler.

### Convex Mutation Call Pattern

**Source:** `src/pages/LiveRun.tsx` `useQuery` pattern (lines 68-75); extend to `useMutation`.
```typescript
// useMutation follows same import + call shape:
import { useQuery, useMutation } from "convex/react";
const saveRunSummary = useMutation(api.agentRuns.saveRunSummary);

// Call on terminal state transition inside useEffect:
useEffect(() => {
  const run = runMap.get(selectedRunId ?? "");
  if (!run) return;
  if (run.status === "completed" || run.status === "error" || run.status === "stopped") {
    void saveRunSummary({
      taskId: run.taskId,
      provider: run.provider,
      status: run.status,
      prompt: run.prompt,
      startedAt: run.startedAt,
      // ... rest of RunState terminal fields
    });
  }
}, [runMap, saveRunSummary]);
```

**Apply to:** `src/pages/LiveRun.tsx` (AgentConsole) terminal-state effect.

### Tailwind CSS 4 Token Syntax

**Source:** All existing components — `src/components/RunSummary.tsx`, `src/pages/LiveRun.tsx`.

Use `bg-(--token)` syntax (NOT `bg-[var(--token)]`):
```typescript
// Correct (from RunSummary.tsx line 36, LiveRun.tsx line 204):
className="bg-(--card) border border-(--border) rounded p-3"
className="text-(--muted-foreground)"
className="bg-(--primary) text-(--primary-foreground)"
className="bg-(--destructive) text-white"
```

**Apply to:** All new components in `src/components/console/`.

### Path Alias

**Source:** `src/lib/astridrApi.ts` import style (all files use `@/`).
```typescript
import { ... } from "@/lib/astridrApi";
import { ... } from "@/lib/runReducer";
import { ... } from "@/components/ui/button";
```

**Apply to:** All new files.

### Error Boundary Wrapping

**Source:** RESEARCH.md Project Constraints point 8 — from CLAUDE.md.
```typescript
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";

// Wrap new console sections:
<SectionErrorBoundary name="AgentConsole">
  <RunList ... />
</SectionErrorBoundary>
```

**Apply to:** New console section components in `src/pages/LiveRun.tsx` (AgentConsole).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/components/console/RunList.tsx` | component | transform | Pure composition of RunCards; layout only. No close analog for a scrollable run-list container exists. Use LiveRun.tsx layout patterns as reference. |

---

## Critical Anti-Patterns (from RESEARCH.md — copy into every plan action)

1. **Do NOT route gateway task stream events through `AstridrWSContext`** — it connects to `:8181/ws/telemetry`. Gateway streams go to `useTaskStream` only.
2. **Do NOT optimistically set status to `"stopped"` on DELETE success** — wait for WS `CLOSED` action.
3. **Do NOT mutate `Map` in-place in the reducer** — always `const next = new Map(state)`.
4. **Do NOT use `VITE_ASTRIDR_API_URL`/`VITE_ASTRIDR_API_KEY` for gateway calls** — use `VITE_GATEWAY_URL`/`VITE_GATEWAY_API_KEY`.
5. **Do NOT add auth to `useTaskStream` WebSocket** — the WS stream route has no auth.
6. **Do NOT write live stream blocks to Convex** — only terminal-state summaries.
7. **Do NOT call `model` field on `submitTask` until the paired Ástríðr `TaskRequest` change lands** — Pydantic will silently drop it.

---

## Metadata

**Analog search scope:** `src/pages/`, `src/hooks/`, `src/lib/`, `src/contexts/`, `src/components/`, `convex/`
**Files scanned:** 12 source files read in full
**Pattern extraction date:** 2026-06-10
