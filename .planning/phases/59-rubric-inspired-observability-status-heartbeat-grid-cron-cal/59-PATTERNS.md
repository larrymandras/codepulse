# Phase 59: Rubric-Inspired Observability - Pattern Map

**Mapped:** 2026-05-04
**Files analyzed:** 18 new/modified files
**Analogs found:** 17 / 18

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/pages/Operations.tsx` | page | request-response | `src/pages/Automation.tsx` | exact |
| `src/components/StatusHeartbeatGrid.tsx` | component | event-driven | `src/components/HeartbeatAlertsPanel.tsx` | role-match |
| `src/components/AgentStatusTile.tsx` | component | event-driven | `src/components/AgentNode.tsx` | role-match |
| `src/components/CronCalendarView.tsx` | component | request-response | `src/pages/Automation.tsx` (CronJobList section) | partial |
| `src/components/PipelineFlowDiagram.tsx` | component | event-driven | `src/components/AgentTopology.tsx` | exact |
| `src/components/PipelineStageNode.tsx` | component | request-response | `src/components/AgentNode.tsx` | exact |
| `src/hooks/useAgentStatus.ts` | hook | request-response | `src/hooks/useAutomation.ts` | exact |
| `src/hooks/useDailyRhythm.ts` | hook | request-response | `src/hooks/useAutomation.ts` | exact |
| `src/hooks/usePipelineStepEvents.ts` | hook | request-response | `src/hooks/useAutomation.ts` | exact |
| `src/lib/agentRoster.ts` | utility | — | `src/lib/cronSchedules.ts` | exact |
| `src/lib/rhythmCategories.ts` | utility | transform | `src/lib/cronSchedules.ts` | role-match |
| `convex/agentStatus.ts` | Convex module | CRUD | `convex/pipelineCheckpoints.ts` | exact |
| `convex/dailyRhythm.ts` | Convex module | CRUD | `convex/pipelineCheckpoints.ts` | exact |
| `convex/pipelineStepEvents.ts` | Convex module | CRUD | `convex/pipelineCheckpoints.ts` | exact |
| `convex/schema.ts` (modify) | config | — | `convex/schema.ts` | exact |
| `convex/runtimeIngest.ts` (modify) | middleware | request-response | `convex/runtimeIngest.ts` | exact |
| `src/contexts/AstridrWSContext.tsx` (modify) | provider | event-driven | `src/contexts/AstridrWSContext.tsx` | exact |
| `src/App.tsx` (modify) + `src/layouts/DashboardLayout.tsx` (modify) | config | — | existing entries in both files | exact |

---

## Pattern Assignments

### `src/pages/Operations.tsx` (page, request-response)

**Analog:** `src/pages/Automation.tsx`

**Imports pattern** (lines 1–22):
```typescript
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import MetricCard from "../components/MetricCard";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import { formatDurationMs } from "../lib/formatters";
import { CRON_SCHEDULES } from "../lib/cronSchedules";
// New imports for this page:
import StatusHeartbeatGrid from "../components/StatusHeartbeatGrid";
import CronCalendarView from "../components/CronCalendarView";
import PipelineFlowDiagram from "../components/PipelineFlowDiagram";
import { useAgentStatus } from "../hooks/useAgentStatus";
import { useDailyRhythm } from "../hooks/useDailyRhythm";
import { usePipelineStepEvents } from "../hooks/usePipelineStepEvents";
```

**Core page structure pattern** (lines 74–217, Automation.tsx):
```typescript
export default function Operations() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Operations</h1>
      </div>

      {/* Summary MetricCards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Active Agents" value={activeCount} />
        <MetricCard label="Waiting" value={waitingCount} />
        <MetricCard label="Recent" value={recentCount} />
        <MetricCard label="Idle" value={idleCount} />
      </div>

      {/* Status Grid */}
      <SectionErrorBoundary name="Agent Status">
        <StatusHeartbeatGrid />
      </SectionErrorBoundary>

      {/* Cron Calendar */}
      <SectionErrorBoundary name="Cron Calendar">
        <CronCalendarView />
      </SectionErrorBoundary>

      {/* Pipeline Flow */}
      <SectionErrorBoundary name="Pipeline Flow">
        <PipelineFlowDiagram />
      </SectionErrorBoundary>
    </div>
  );
}
```

**Route registration pattern** (`src/App.tsx` lines 24–50 — lazy-load pattern):
```typescript
// Add near other lazy imports at top of App.tsx:
const Operations = lazy(() => import("./pages/Operations"));

// Add inside <Route element={<DashboardLayout />}> block:
<Route
  path="/operations"
  element={
    <Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading Operations...</div>}>
      <Operations />
    </Suspense>
  }
/>
```

**Nav registration pattern** (`src/layouts/DashboardLayout.tsx` lines 114–136):
```typescript
// Add to overviewNavItems array (or create a new MONITOR group):
{ to: "/operations", label: "Operations", icon: "radio", group: "OVERVIEW" }

// "radio" key already maps to Radio icon (line 89 in DashboardLayout.tsx):
// radio: Radio,  ← already present in iconComponents
```

---

### `src/components/StatusHeartbeatGrid.tsx` (component, event-driven)

**Analog:** `src/components/HeartbeatAlertsPanel.tsx`

**Imports pattern** (lines 1–3, HeartbeatAlertsPanel.tsx):
```typescript
import { useState, useEffect, useRef } from "react";
import { useAstridrWS } from "../contexts/AstridrWSContext";
import { useRecentAgentStatus } from "../hooks/useAgentStatus";
import { AGENT_ROSTER } from "../lib/agentRoster";
import AgentStatusTile from "./AgentStatusTile";
import InfoTooltip from "./InfoTooltip";
```

**Expanded-item inline detail pattern** (lines 10–12, 24–67, HeartbeatAlertsPanel.tsx):
```typescript
// Toggle expand on click — inline detail below grid, not page navigation (D-04)
const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

// Click handler:
onClick={() => setSelectedAgentId(prev => prev === agentId ? null : agentId)}
```

**WebSocket subscription for instant state update** (from AstridrWSContext.tsx lines 350–361):
```typescript
const { subscribeEvent } = useAstridrWS();
const [liveStates, setLiveStates] = useState<Record<string, AgentStatusEvent>>({});

useEffect(() => {
  const unsub = subscribeEvent("agent_status", (event) => {
    const agentId = event.agentId as string;
    setLiveStates(prev => ({ ...prev, [agentId]: event as AgentStatusEvent }));
  });
  return unsub;
}, [subscribeEvent]);
```

**Idle timeout via interval** (from RESEARCH.md Pitfall 3):
```typescript
// Re-evaluate state every second to apply 5-min idle threshold
const IDLE_THRESHOLD_MS = 5 * 60 * 1000;
const [now, setNow] = useState(Date.now());
useEffect(() => {
  const timer = setInterval(() => setNow(Date.now()), 1000);
  return () => clearInterval(timer);
}, []);

// Derive state at render time — never store "idle" in DB:
function deriveState(event: AgentStatusEvent | undefined, now: number): AgentState {
  if (!event) return "idle";
  if (now - event.timestamp * 1000 > IDLE_THRESHOLD_MS) return "idle";
  return event.state as AgentState;
}
```

**Card container pattern** (line 13, HeartbeatAlertsPanel.tsx):
```typescript
<div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
  <h2 className="text-sm font-semibold text-gray-300 mb-3">
    Agent Status
    <InfoTooltip text="Real-time status of all configured Ástríðr agent types" />
  </h2>
  {/* grid goes here */}
</div>
```

---

### `src/components/AgentStatusTile.tsx` (component, event-driven)

**Analog:** `src/components/AgentNode.tsx`

**Imports pattern** (line 1, AgentNode.tsx):
```typescript
import AgentAvatar from "./AgentAvatar";
// motion for pulse ring animation (already installed):
import { motion } from "motion/react";
```

**State→color lookup table pattern** (lines 15–37, AgentNode.tsx — statusBorder/statusDot/statusLabel pattern):
```typescript
const STATE_BORDER: Record<AgentState, string> = {
  active:  "border-green-500/60",
  waiting: "border-blue-500/60",
  recent:  "border-amber-500/60",
  idle:    "border-gray-600/40",
};

const STATE_BG: Record<AgentState, string> = {
  active:  "bg-green-500/10",
  waiting: "bg-blue-500/10",
  recent:  "bg-amber-500/10",
  idle:    "bg-gray-800/50",
};

const STATE_PULSE: Record<AgentState, boolean> = {
  active:  true,   // green pulse
  waiting: false,
  recent:  true,   // amber pulse
  idle:    false,
};
```

**Tile structure (adapts AgentNode.tsx lines 56–101 for larger square format)**:
```typescript
export default function AgentStatusTile({ agentId, agentName, state, currentTask, onClick, selected }: AgentStatusTileProps) {
  return (
    <div
      onClick={onClick}
      className={`relative rounded-xl p-4 border cursor-pointer transition-all
        ${STATE_BG[state]} ${STATE_BORDER[state]}
        ${selected ? "ring-1 ring-indigo-500/40" : ""}
        hover:brightness-110`}
    >
      {/* Pulse ring for active/recent */}
      {STATE_PULSE[state] && (
        <motion.div
          className={`absolute inset-0 rounded-xl ${state === "active" ? "border-green-400" : "border-amber-400"} border`}
          animate={{ opacity: [0.6, 0], scale: [1, 1.04] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
      <AgentAvatar avatar={{ name: agentId }} status={avatarStatus[state]} size="sm" />
      <p className="text-xs font-medium text-gray-200 mt-2 truncate">{agentName}</p>
      <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATE_BADGE[state]}`}>{state}</span>
      {currentTask && <p className="text-[9px] text-gray-500 mt-1 truncate">{currentTask}</p>}
    </div>
  );
}
```

---

### `src/components/CronCalendarView.tsx` (component, request-response)

**Analog:** `src/pages/Automation.tsx` (cron-display section) + `src/lib/cronSchedules.ts`

**Imports pattern**:
```typescript
import { useState, useMemo } from "react";
import { startOfWeek, addDays, format, parseISO } from "date-fns";
import { CRON_SCHEDULES, estimateNextRun } from "../lib/cronSchedules";
import { useDailyRhythm } from "../hooks/useDailyRhythm";
import { categorizeRhythm, CATEGORY_COLORS } from "../lib/rhythmCategories";
import InfoTooltip from "./InfoTooltip";
```

**Toggle pattern** (lines 52–59, Automation.tsx — filter toggle button group):
```typescript
// System cron toggle — same pill-button pattern as filter tabs in AgentTopology:
const [showSystemCrons, setShowSystemCrons] = useState(true);

<div className="flex items-center gap-1 bg-gray-900/50 border border-gray-700/30 rounded-lg p-0.5">
  <button
    onClick={() => setShowSystemCrons(prev => !prev)}
    className={`text-[11px] px-2 py-1 rounded-md transition-colors ${
      showSystemCrons ? "bg-gray-700 text-gray-100" : "text-gray-400 hover:text-gray-200"
    }`}
  >
    System Crons
  </button>
</div>
```

**Slot click → inline detail pattern** (same expand pattern as HeartbeatAlertsPanel.tsx lines 24–65):
```typescript
const [selectedSlot, setSelectedSlot] = useState<SlotKey | null>(null);
// Clicking a slot key (e.g., "2026-05-04T06:00") toggles the detail panel below
```

**Card container pattern** (line 13, HeartbeatAlertsPanel.tsx):
```typescript
<div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
  <h2 className="text-sm font-semibold text-gray-300 mb-3">
    Cron Calendar — 7 Days
    <InfoTooltip text="Combined view of Ástríðr daily_rhythm entries and Convex system cron jobs" />
  </h2>
  {/* 7-col hour grid */}
</div>
```

---

### `src/components/PipelineFlowDiagram.tsx` (component, event-driven)

**Analog:** `src/components/AgentTopology.tsx` — copy this file's structure almost verbatim

**Imports pattern** (lines 1–17, AgentTopology.tsx):
```typescript
import { useMemo, useState, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import PipelineStageNode from "./PipelineStageNode";
import { useAstridrWS } from "../contexts/AstridrWSContext";
import { usePipelineStepEvents } from "../hooks/usePipelineStepEvents";
```

**nodeTypes declaration** (line 18, AgentTopology.tsx):
```typescript
// Must be declared outside component to prevent React Flow re-registering on every render
const nodeTypes = { pipelineStage: PipelineStageNode };
```

**Layout math in useMemo** (lines 47–170, AgentTopology.tsx — anti-pattern: never inline in JSX):
```typescript
// For pipeline: linear left→right layout (not tree). 5 fixed stages.
const STAGE_NAMES = ["receive", "route", "process", "respond", "tts_followup"] as const;
const NODE_W = 160;
const NODE_GAP = 40;

const { nodes, edges } = useMemo(() => {
  const nodes: Node[] = STAGE_NAMES.map((name, i) => ({
    id: name,
    type: "pipelineStage",
    position: { x: i * (NODE_W + NODE_GAP), y: 0 },
    data: {
      stepName: name,
      status: deriveStepStatus(name, stepEvents),
      durationMs: getStepDuration(name, stepEvents),
      selected: selectedStage === name,
      onClick: () => setSelectedStage(prev => prev === name ? null : name),
    },
  }));

  const edges: Edge[] = STAGE_NAMES.slice(0, -1).map((name, i) => ({
    id: `${name}->${STAGE_NAMES[i + 1]}`,
    source: name,
    target: STAGE_NAMES[i + 1],
    type: "smoothstep",
    animated: deriveStepStatus(STAGE_NAMES[i + 1], stepEvents) === "running",
    style: { stroke: "#4b5563", strokeWidth: 2 },
  }));

  return { nodes, edges };
}, [stepEvents, selectedStage]);
```

**ReactFlow container — CRITICAL: explicit pixel height** (lines 237–256, AgentTopology.tsx):
```typescript
// MUST use style={{ height: 400 }} — flex-1 alone renders invisible (Pitfall 1)
<div style={{ height: 400 }} className="rounded-lg overflow-hidden w-full">
  <ReactFlow
    nodes={nodes}
    edges={edges}
    nodeTypes={nodeTypes}
    fitView
    proOptions={{ hideAttribution: true }}
    minZoom={0.3}
    maxZoom={2}
  >
    <Background color="#374151" gap={20} />
    <Controls
      showInteractive={false}
      className="!bg-gray-800 !border-gray-700 !shadow-none [&>button]:!bg-gray-700 [&>button]:!border-gray-600 [&>button]:!text-gray-300 [&>button:hover]:!bg-gray-600"
    />
  </ReactFlow>
</div>
```

**Detail panel beside / below diagram** (lines 257–265, AgentTopology.tsx):
```typescript
{selectedStage && (
  <div className="mt-3 bg-gray-900/50 border border-gray-700/40 rounded-lg px-4 py-3 text-xs">
    {/* step duration, input/output size, error details */}
  </div>
)}
```

**WebSocket subscription for live step updates**:
```typescript
// Uses subscribeEvent — same pattern as StatusHeartbeatGrid
const { subscribeEvent } = useAstridrWS();
useEffect(() => {
  const unsub1 = subscribeEvent("step_started", (event) => { /* update local step state */ });
  const unsub2 = subscribeEvent("step_completed", (event) => { /* update local step state */ });
  return () => { unsub1(); unsub2(); };
}, [subscribeEvent]);
```

**Live vs. replay mode — execution selector pattern** (mirroring filter dropdown in Automation.tsx line 43–49):
```typescript
const recentExecutionIds = useQuery(api.pipelineStepEvents.recentExecutionIds, { limit: 10 }) ?? [];
const [selectedExecutionId, setSelectedExecutionId] = useState<string | "live">("live");
```

---

### `src/components/PipelineStageNode.tsx` (component, request-response)

**Analog:** `src/components/AgentNode.tsx` — copy this file's structure exactly

**Full pattern** (AgentNode.tsx lines 1–102):
```typescript
import { Handle, Position } from "@xyflow/react";

// CRITICAL: @xyflow/react v12 requires typed generics (Pitfall 6)
// The node component receives { data: PipelineStageNodeData } — must match nodeTypes key

interface PipelineStageNodeData {
  stepName: string;    // "receive" | "route" | "process" | "respond" | "tts_followup"
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  durationMs?: number;
  selected?: boolean;
  onClick?: () => void;
}

// Status lookup tables — follow AgentNode.tsx statusBorder/statusDot pattern:
const STATUS_BORDER: Record<string, string> = {
  running:   "border-green-500/60",
  completed: "border-yellow-500/40",
  failed:    "border-red-500/60",
  pending:   "border-gray-600/50",
  skipped:   "border-gray-700/30",
};

export default function PipelineStageNode({ data }: { data: PipelineStageNodeData }) {
  return (
    <div
      onClick={data.onClick}
      className={`relative bg-gray-800/80 backdrop-blur border rounded-xl px-3 py-2 min-w-[120px] max-w-[160px] cursor-pointer transition-all hover:bg-gray-700/80 ${
        data.selected
          ? "border-indigo-500 ring-1 ring-indigo-500/40 shadow-lg shadow-indigo-500/10"
          : STATUS_BORDER[data.status] ?? "border-gray-600/50"
      }`}
    >
      {/* Pipeline is horizontal — Left/Right handles (not Top/Bottom like AgentNode) */}
      <Handle type="target" position={Position.Left}  className="!bg-gray-500 !w-2 !h-2 !border-gray-800" />
      {/* stage name, status dot, duration */}
      <Handle type="source" position={Position.Right} className="!bg-gray-500 !w-2 !h-2 !border-gray-800" />
    </div>
  );
}
```

---

### `src/hooks/useAgentStatus.ts` (hook, request-response)

**Analog:** `src/hooks/useAutomation.ts` — copy this file's pattern exactly

**Full pattern** (useAutomation.ts lines 1–22):
```typescript
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useRecentAgentStatus() {
  // ?? [] ensures undefined (loading) returns empty array — matches useAutomation pattern
  return useQuery(api.agentStatus.recentByAgent) ?? [];
}

export function useLatestAgentStatus(agentId: string) {
  return useQuery(api.agentStatus.latestForAgent, { agentId });
}
```

---

### `src/hooks/useDailyRhythm.ts` (hook, request-response)

**Analog:** `src/hooks/useAutomation.ts`

```typescript
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useDailyRhythm() {
  return useQuery(api.dailyRhythm.list) ?? [];
}
```

---

### `src/hooks/usePipelineStepEvents.ts` (hook, request-response)

**Analog:** `src/hooks/useAutomation.ts`

```typescript
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function usePipelineStepEvents(executionId?: string) {
  return useQuery(api.pipelineStepEvents.byExecution, executionId ? { executionId } : "skip") ?? [];
}

export function useRecentPipelineExecutionIds(limit?: number) {
  return useQuery(api.pipelineStepEvents.recentExecutionIds, limit ? { limit } : {}) ?? [];
}
```

---

### `src/lib/agentRoster.ts` (utility, static)

**Analog:** `src/lib/cronSchedules.ts` — mirror the static array + interface pattern exactly

**Full pattern** (cronSchedules.ts lines 1–40):
```typescript
// SOURCE OF TRUTH: C:\Users\mandr\astridr-repo\config\agent-types.yaml
// If agent types change in that file, update this list manually.
export interface AgentRosterEntry {
  id: string;
  name: string;
  profiles: string[];
  taskCategory: string;
  description?: string;
}

export const AGENT_ROSTER: AgentRosterEntry[] = [
  { id: "astridr", name: "Ástríðr", profiles: ["personal", "business"], taskCategory: "general" },
  // ... additional entries from agent-types.yaml
];
```

---

### `src/lib/rhythmCategories.ts` (utility, transform)

**Analog:** `src/lib/cronSchedules.ts` — same static-map pattern, but adds a classifier function

**Pattern** (CronSchedule interface pattern, cronSchedules.ts lines 1–8):
```typescript
export type RhythmCategory = "health" | "morning" | "research" | "content" | "review" | "system";

// Color classes follow dark-theme pattern: bg-{color}-500/20 border-{color}-500/40 text-{color}-300
export const CATEGORY_COLORS: Record<RhythmCategory, string> = {
  health:   "bg-teal-500/20 border-teal-500/40 text-teal-300",
  morning:  "bg-orange-500/20 border-orange-500/40 text-orange-300",
  research: "bg-blue-500/20 border-blue-500/40 text-blue-300",
  content:  "bg-purple-500/20 border-purple-500/40 text-purple-300",
  review:   "bg-red-500/20 border-red-500/40 text-red-300",
  system:   "bg-gray-500/20 border-gray-500/40 text-gray-400",
};

export function categorizeRhythm(action: string): RhythmCategory {
  const lower = action.toLowerCase();
  if (/briefing|morning|evening|weekly digest/.test(lower)) return "morning";
  if (/health|check|monitor|status/.test(lower)) return "health";
  if (/research|digest|pr review|code review/.test(lower)) return "research";
  if (/content|write|generate|create/.test(lower)) return "content";
  if (/review|audit|report/.test(lower)) return "review";
  return "system";
}
```

---

### `convex/agentStatus.ts` (Convex module, CRUD)

**Analog:** `convex/pipelineCheckpoints.ts` — copy the mutation + query structure exactly

**Full pattern** (pipelineCheckpoints.ts lines 1–95):
```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const recordEvent = mutation({
  args: {
    agentId: v.string(),
    state: v.string(),              // "active" | "waiting" | "recent"
    currentTask: v.optional(v.string()),
    errorCount: v.optional(v.float64()),
    profileId: v.optional(v.string()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("agentStatusEvents", args);
  },
});

export const recentByAgent = query({
  args: {},
  handler: async (ctx) => {
    // Latest event per agentId — take recent pool, group client-side or with index
    return await ctx.db
      .query("agentStatusEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(100);
  },
});

export const latestForAgent = query({
  args: { agentId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentStatusEvents")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .order("desc")
      .first();
  },
});
```

---

### `convex/dailyRhythm.ts` (Convex module, CRUD)

**Analog:** `convex/pipelineCheckpoints.ts`

**Key difference — upsert (replace-all per agentTypeId)** follows same handler pattern but with delete-then-insert:
```typescript
export const upsertEntries = mutation({
  args: {
    agentTypeId: v.string(),
    entries: v.array(v.object({
      action: v.string(),
      channel: v.string(),
      days: v.string(),
      time: v.string(),
      profileId: v.optional(v.string()),
      category: v.optional(v.string()),
      cronExpression: v.optional(v.string()),
    })),
    syncedAt: v.float64(),
  },
  handler: async (ctx, args) => {
    // Delete existing entries for this agentTypeId, then bulk insert
    const existing = await ctx.db
      .query("dailyRhythmEntries")
      .withIndex("by_agentType", (q) => q.eq("agentTypeId", args.agentTypeId))
      .collect();
    for (const row of existing) {
      await ctx.db.delete(row._id);
    }
    for (const entry of args.entries) {
      await ctx.db.insert("dailyRhythmEntries", {
        agentTypeId: args.agentTypeId,
        syncedAt: args.syncedAt,
        ...entry,
      });
    }
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("dailyRhythmEntries")
      .withIndex("by_syncedAt")
      .order("desc")
      .take(500);
  },
});
```

---

### `convex/pipelineStepEvents.ts` (Convex module, CRUD)

**Analog:** `convex/pipelineCheckpoints.ts` — nearly identical structure

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const recordEvent = mutation({
  args: {
    executionId: v.string(),
    pipelineName: v.string(),
    stepName: v.string(),
    stepIndex: v.float64(),
    status: v.string(),             // "step_started" | "step_completed" | "step_failed"
    durationMs: v.optional(v.float64()),
    inputSize: v.optional(v.float64()),
    outputSize: v.optional(v.float64()),
    error: v.optional(v.string()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("pipelineStepEvents", args);
  },
});

// Mirrors pipelineCheckpoints.byExecution (lines 30–38):
export const byExecution = query({
  args: { executionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pipelineStepEvents")
      .withIndex("by_execution", (q) => q.eq("executionId", args.executionId))
      .order("asc")
      .take(50);
  },
});

export const recentExecutionIds = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("pipelineStepEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit ?? 50);
    const seen = new Set<string>();
    return rows.filter(r => {
      if (seen.has(r.executionId)) return false;
      seen.add(r.executionId);
      return true;
    }).map(r => r.executionId);
  },
});
```

---

### `convex/schema.ts` (modify — add 3 tables)

**Analog:** existing tables in `convex/schema.ts` — follow the same `defineTable` + index pattern

**Pattern to replicate** (schema.ts lines 51–63 — agents table):
```typescript
// Add inside the defineSchema({}) call, following same format as existing tables:

agentStatusEvents: defineTable({
  agentId: v.string(),
  state: v.string(),
  currentTask: v.optional(v.string()),
  errorCount: v.optional(v.float64()),
  profileId: v.optional(v.string()),
  timestamp: v.float64(),
})
  .index("by_agentId", ["agentId", "timestamp"])
  .index("by_timestamp", ["timestamp"])
  .index("by_state", ["state", "timestamp"]),

dailyRhythmEntries: defineTable({
  agentTypeId: v.string(),
  action: v.string(),
  channel: v.string(),
  days: v.string(),
  time: v.string(),
  profileId: v.optional(v.string()),
  category: v.optional(v.string()),
  cronExpression: v.optional(v.string()),
  syncedAt: v.float64(),
})
  .index("by_agentType", ["agentTypeId"])
  .index("by_syncedAt", ["syncedAt"]),

pipelineStepEvents: defineTable({
  executionId: v.string(),
  pipelineName: v.string(),
  stepName: v.string(),
  stepIndex: v.float64(),
  status: v.string(),
  durationMs: v.optional(v.float64()),
  inputSize: v.optional(v.float64()),
  outputSize: v.optional(v.float64()),
  error: v.optional(v.string()),
  timestamp: v.float64(),
})
  .index("by_execution", ["executionId", "timestamp"])
  .index("by_pipeline", ["pipelineName", "timestamp"])
  .index("by_status", ["status", "timestamp"])
  .index("by_timestamp", ["timestamp"]),
```

---

### `convex/runtimeIngest.ts` (modify — add 4 case blocks)

**Analog:** existing `case` blocks in `convex/runtimeIngest.ts`

**Pattern to replicate exactly** (runtimeIngest.ts lines 274–307 — `cron_execution` and `heartbeat_alerts` cases):
```typescript
// CRITICAL: use d.field ?? undefined for all optional fields (Pitfall 5 / line 88 comment)
// The pattern on line 88: "Convex v.optional() rejects null — coerce to undefined"

case "agent_status": {
  const d = data as any;
  await ctx.runMutation(api.agentStatus.recordEvent, {
    agentId: d.agentId ?? d.agent_id ?? "unknown",
    state: d.state ?? "idle",
    currentTask: d.currentTask ?? d.current_task ?? undefined,
    errorCount: d.errorCount ?? d.error_count ?? undefined,
    profileId: d.profileId ?? d.profile_id ?? undefined,
    timestamp,
  });
  break;
}
case "daily_rhythm_sync": {
  const d = data as any;
  if (Array.isArray(d.entries)) {
    await ctx.runMutation(api.dailyRhythm.upsertEntries, {
      agentTypeId: d.agentTypeId ?? d.agent_type_id ?? "unknown",
      entries: d.entries,
      syncedAt: timestamp,
    });
  }
  break;
}
case "step_started":
case "step_completed": {
  const d = data as any;
  await ctx.runMutation(api.pipelineStepEvents.recordEvent, {
    executionId: d.executionId ?? d.execution_id ?? "unknown",
    pipelineName: d.pipelineName ?? d.pipeline_name ?? "message_pipeline",
    stepName: d.stepName ?? d.step_name ?? "unknown",
    stepIndex: d.stepIndex ?? d.step_index ?? 0,
    status: evt.eventType,   // preserve "step_started" or "step_completed" as-is
    durationMs: d.durationMs ?? d.duration_ms ?? undefined,
    inputSize: d.inputSize ?? d.input_size ?? undefined,
    outputSize: d.outputSize ?? d.output_size ?? undefined,
    error: d.error ?? undefined,
    timestamp,
  });
  break;
}
```

---

### `src/contexts/AstridrWSContext.tsx` (modify — add event types to TOPIC_EVENT_MAP)

**Analog:** existing `TOPIC_EVENT_MAP` in `src/contexts/AstridrWSContext.tsx` (lines 51–88)

**Exact modification** (add to existing Sets):
```typescript
// Lines 52–60: health Set — add two entries:
health: new Set([
  "health_check",
  "docker_status",
  "supabase_health",
  "self_healing",
  "heartbeat_alerts",
  "mcp_connection",
  "context_cache",
  "agent_status",        // NEW — heartbeat grid instant update (D-11)
  "daily_rhythm_sync",   // NEW — calendar live sync (D-12)
]),

// Lines 62–69: executions Set — add two entries:
executions: new Set([
  "command_execution",
  "pipeline_execution",
  "job_lifecycle",
  "worktree_event",
  "pipe_execution",
  "step_started",        // NEW — pipeline diagram live progress (D-13)
  "step_completed",      // NEW — pipeline diagram live progress (D-13)
]),
```

---

## Shared Patterns

### Dark Theme Card Container
**Source:** `src/components/HeartbeatAlertsPanel.tsx` line 13  
**Apply to:** All three new panel components (StatusHeartbeatGrid, CronCalendarView, PipelineFlowDiagram)
```typescript
<div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
  <h2 className="text-sm font-semibold text-gray-300 mb-3">
    {title}
    <InfoTooltip text={tooltipText} />
  </h2>
  {/* content */}
</div>
```

### SectionErrorBoundary Wrapping
**Source:** `src/components/SectionErrorBoundary.tsx` + `src/pages/Automation.tsx` lines 103, 121, 127, 131  
**Apply to:** Every new panel section in Operations.tsx
```typescript
<SectionErrorBoundary name="Descriptive Panel Name">
  <ThePanel />
</SectionErrorBoundary>
```

### Inline Expand-on-Click (no page navigation)
**Source:** `src/components/HeartbeatAlertsPanel.tsx` lines 10–67  
**Apply to:** StatusHeartbeatGrid (tile click), CronCalendarView (slot click), PipelineFlowDiagram (stage click)
```typescript
const [selectedId, setSelectedId] = useState<string | null>(null);
// Toggle on click — null closes detail:
onClick={() => setSelectedId(prev => prev === id ? null : id)}
// Conditional render below the grid/diagram:
{selectedId && <DetailPanel id={selectedId} onClose={() => setSelectedId(null)} />}
```

### Null→Undefined Coercion in runtimeIngest cases
**Source:** `convex/runtimeIngest.ts` line 87–90 (comment + data loop)  
**Apply to:** All 4 new case blocks in runtimeIngest.ts
```typescript
// The pre-loop already handles top-level keys: data[k] = v === null ? undefined : v
// Inside case blocks, use ?? undefined (not ?? null) for optional mutation args:
profileId: d.profileId ?? d.profile_id ?? undefined,
```

### WebSocket subscribeEvent Pattern
**Source:** `src/contexts/AstridrWSContext.tsx` lines 350–361  
**Apply to:** StatusHeartbeatGrid.tsx, PipelineFlowDiagram.tsx
```typescript
const { subscribeEvent } = useAstridrWS();
useEffect(() => {
  const unsub = subscribeEvent("event_type_string", (event) => {
    // handle event — update local React state
  });
  return unsub;  // cleanup on unmount
}, [subscribeEvent]);
```

### Status Dot Color Convention
**Source:** `src/components/AgentNode.tsx` lines 15–25, `src/components/HeartbeatAlertsPanel.tsx` lines 35–37  
**Apply to:** AgentStatusTile.tsx, PipelineStageNode.tsx
```typescript
// Consistent color palette — do not introduce new colors:
// green-400 = active/running/success
// yellow-400/amber-400 = recent/warning
// blue-400 = waiting/info
// red-400 = failed/error
// gray-400/500 = idle/unknown
```

### Convex hook ?? [] Pattern
**Source:** `src/hooks/useAutomation.ts` lines 9, 12, 16, 20  
**Apply to:** All three new hooks (useAgentStatus, useDailyRhythm, usePipelineStepEvents)
```typescript
// ?? [] ensures undefined (loading state) is handled — never pass undefined to .map()
return useQuery(api.domain.fn, args) ?? [];
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| — | — | — | All files have a usable analog in the codebase |

Note: `CronCalendarView.tsx` has no calendar component analog, but it composes existing patterns (static array from cronSchedules, useQuery hook, expand-on-click) so it does not require external references. The `date-fns` usage pattern is standard and no codebase analog exists — follow RESEARCH.md Pattern 6 for the calendar grid math.

---

## Metadata

**Analog search scope:** `src/pages/`, `src/components/`, `src/hooks/`, `src/lib/`, `src/contexts/`, `convex/`
**Files scanned:** 14 source files read directly
**Pattern extraction date:** 2026-05-04

### Critical Implementation Warnings

1. **React Flow container height** — always `style={{ height: 400 }}`, never `flex-1` alone (Pitfall 1, AgentTopology.tsx line 238)
2. **Null coercion** — use `?? undefined` not `?? null` in all new runtimeIngest case blocks (runtimeIngest.ts line 88)
3. **nodeTypes outside component** — declare `const nodeTypes = { pipelineStage: PipelineStageNode }` outside the component function, not inside (anti-pattern documented in RESEARCH.md)
4. **Idle state via timer** — derive "idle" at render time from `Date.now()` vs `event.timestamp`, never store "idle" in DB (Pitfall 3)
5. **Position.Left/Right for pipeline nodes** — PipelineStageNode uses Left/Right handles (horizontal flow), not Top/Bottom like AgentNode (vertical tree)
