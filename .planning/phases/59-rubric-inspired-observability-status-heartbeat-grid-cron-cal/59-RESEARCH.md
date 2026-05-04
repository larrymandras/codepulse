# Phase 59: Rubric-Inspired Observability - Research

**Researched:** 2026-05-03
**Domain:** Cross-project real-time dashboard surfaces (React + Convex + Ástríðr event pipeline)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Status Heartbeat Grid**
- D-01: Grid lives on a new dedicated "Operations" page (not a Dashboard widget)
- D-02: Rubric-style tiles — larger square tiles with pulsing color backgrounds per state, agent avatar, and real-time counters. Four states: active (green pulse), waiting (blue), recent (amber pulse), idle (gray)
- D-03: Show all configured agent types from Ástríðr's agent-types.yaml, even if offline. Idle agents get gray tiles — full roster always visible
- D-04: Click a tile to expand inline detail below the grid (last 5 heartbeats, current task, error count). No page navigation

**Cron Calendar Design**
- D-05: Combined view showing both Ástríðr daily_rhythm entries AND Convex cron jobs, with a toggle to hide system crons
- D-06: Category color coding derived from action text via keyword heuristic. Color mapping: health=teal, morning=orange, research=blue, content=purple, review=red, system=gray
- D-07: Interactive slots — click a calendar slot to see last execution result, duration, and any errors

**Pipeline Flow Diagram**
- D-08: Both live and replay modes — default to live view when a pipeline execution is active, with a dropdown to select and replay past executions from pipelineCheckpoints history
- D-09: Render with React Flow (reusing existing pattern from AgentTopology, DetailTopologyTab, RosterOrgChart). Custom nodes per stage with status indicators, animated edges for progress
- D-10: Click a pipeline stage node to expand detail below the diagram showing step duration, input/output size, and error details if failed

**Data Transport**
- D-11: Status heartbeat events use both channels — HTTP POST to `/runtime-ingest` for Convex persistence PLUS WebSocket push via `useAstridrWS()` for instant UI updates
- D-12: Daily rhythm data pushed to Convex at Ástríðr bootstrap, plus live sync on config changes. Calendar works even if Ástríðr is down. Requires new Convex table for rhythm entries
- D-13: Ástríðr must emit finer-grained pipeline events — both `step_started` and `step_completed` events so the diagram shows real-time progress per step with accurate timing

### Claude's Discretion
- Auto-timeout threshold for idle state (roadmap says 5min — Claude can adjust if needed)
- React Flow node styling and edge animation specifics
- Convex table schema design for rhythm entries and enhanced pipeline events
- Operations page layout arrangement of the three surfaces
- Current-time indicator and next-up countdown implementation on cron calendar

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 59 delivers three new dashboard surfaces on a dedicated Operations page: a real-time agent status heartbeat grid, a 7-day cron calendar, and an animated pipeline flow diagram. The work spans two repos — CodePulse (React/Convex frontend + Convex backend) and Ástríðr (Python event emitter). All three surfaces follow patterns already established in the codebase, making this predominantly a composition and schema extension phase rather than a greenfield build.

The primary complexity is the cross-project data contract: Ástríðr must emit three new event shapes (`agent_status`, `daily_rhythm_sync`, `step_started`/`step_completed`) and CodePulse must store them in two new Convex tables while wiring the dual-channel transport (HTTP POST → Convex persistence + WebSocket → instant UI). The React side reuses `@xyflow/react` v12 (already installed at `^12.10.1`), the `useAstridrWS()` hook pattern, and the established dark-theme component library.

The key schema decisions that unlock the planner: (1) a `agentStatusEvents` table indexed by `agentId + timestamp` for the heartbeat grid, (2) a `dailyRhythmEntries` table for calendar data, and (3) `pipelineStepEvents` table extending the existing `pipelineCheckpoints` pattern with `step_started`/`step_completed` status and timing fields.

**Primary recommendation:** Build bottom-up — Convex schema + ingest routing first, then Ástríðr event emission, then React components. The Operations page is the integration surface; each of the three panels can be developed independently once the data layer is in place.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Agent status heartbeat grid | Frontend (React) | Convex DB + Ástríðr emitter | UI owns rendering and state transitions (idle timeout). Convex is source of truth. Ástríðr fires the events |
| Idle timeout (5min) | Frontend (React) | — | Timer logic lives in React component using `Date.now()` vs last event timestamp. No server-side cron needed |
| Daily rhythm calendar | Frontend (React) | Convex DB + Ástríðr bootstrap | Calendar layout is pure client-side derivation from stored rhythm entries. Convex serves the data |
| Convex cron display | Frontend (React) | `cronSchedules.ts` | Static data from `CRON_SCHEDULES` array — no DB needed for system crons |
| Pipeline flow diagram | Frontend (React via React Flow) | Convex DB | React Flow renders nodes/edges. Convex streams live step events |
| Event ingestion (HTTP) | Convex HTTP action | `runtimeIngest.ts` | Follows the established `/runtime-ingest` handler pattern |
| Event push (WebSocket) | Ástríðr WebSocket server | `AstridrWSContext.tsx` | Instant UI updates via `subscribeEvent()` bypass Convex polling latency |
| Daily rhythm bootstrap push | Ástríðr engine | Convex mutation | Ástríðr pushes `daily_rhythm_sync` at startup; CodePulse stores in `dailyRhythmEntries` table |

---

## Standard Stack

### Core (already installed — no new packages needed)
[VERIFIED: package.json]

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@xyflow/react` | `^12.10.1` | Pipeline flow diagram | Already used in AgentTopology, DetailTopologyTab, RosterOrgChart |
| `convex` | `^1.36.1` | DB + real-time queries | Project's backend. `useQuery()` auto-updates the UI |
| `react` | `^19.2.4` | UI framework | Project standard |
| `tailwindcss` | `^4.2.1` | Styling | Project standard — dark theme utilities already defined |
| `motion` | `^12.38.0` | CSS pulse animations for tile states | Already installed; handles keyframe pulse rings |
| `lucide-react` | `^1.8.0` | Icons | Project standard (UI-08) |
| `date-fns` | `^4.1.0` | Calendar date math (7-day window, hour slots) | Already installed |

### No New Dependencies Required
All capabilities in this phase can be built with the existing stack. [VERIFIED: package.json]

---

## Architecture Patterns

### System Architecture Diagram

```
Ástríðr (Python)
  │
  ├─[HTTP POST]─► /runtime-ingest (Convex httpAction)
  │                    │
  │                    ├─► agentStatusEvents table   ─► useQuery() ─► StatusHeartbeatGrid
  │                    ├─► dailyRhythmEntries table  ─► useQuery() ─► CronCalendarView
  │                    └─► pipelineStepEvents table  ─► useQuery() ─► PipelineFlowDiagram
  │
  └─[WebSocket]─► /ws/telemetry (Ástríðr WS server)
                      │
                      └─► AstridrWSContext subscribeEvent()
                              │
                              ├─► "agent_status" ──────────────► StatusHeartbeatGrid (instant)
                              └─► "step_started/completed" ───► PipelineFlowDiagram (instant)

Static data:
  CRON_SCHEDULES (cronSchedules.ts) ──────────────────────────► CronCalendarView (combined)
  dailyRhythmEntries (Convex) ─────────────────────────────────► CronCalendarView
```

### Recommended Project Structure

```
src/pages/
└── Operations.tsx                    # new Operations page (D-01)

src/components/
├── StatusHeartbeatGrid.tsx           # agent tile grid (D-02, D-03, D-04)
├── AgentStatusTile.tsx               # individual tile with pulse animation
├── CronCalendarView.tsx              # 7-day hour-by-hour calendar (D-05, D-06, D-07)
└── PipelineFlowDiagram.tsx           # React Flow pipeline (D-08, D-09, D-10)
    └── PipelineStageNode.tsx         # custom React Flow node

src/hooks/
├── useAgentStatus.ts                 # wraps useQuery(api.agentStatus.recent)
├── useDailyRhythm.ts                 # wraps useQuery(api.dailyRhythm.list)
└── usePipelineStepEvents.ts          # wraps useQuery(api.pipelineStepEvents.*)

convex/
├── agentStatus.ts                    # mutations + queries for agentStatusEvents
├── dailyRhythm.ts                    # mutations + queries for dailyRhythmEntries
└── pipelineStepEvents.ts             # mutations + queries for pipelineStepEvents
```

### Pattern 1: React Flow Custom Pipeline Node

Follow the `AgentNode.tsx` pattern exactly. [VERIFIED: src/components/AgentNode.tsx]

```typescript
// Source: src/components/AgentNode.tsx (established pattern)
import { Handle, Position } from "@xyflow/react";

interface PipelineStageNodeData {
  stepName: string;         // "receive" | "route" | "process" | "respond" | "tts_followup"
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  durationMs?: number;
  selected?: boolean;
  onClick?: () => void;
}

export default function PipelineStageNode({ data }: { data: PipelineStageNodeData }) {
  // Use same border/dot color conventions as AgentNode
  // selected: "border-indigo-500 ring-1 ring-indigo-500/40"
  return (
    <div onClick={data.onClick} className={`...`}>
      <Handle type="target" position={Position.Left} ... />
      {/* stage name, status dot, duration */}
      <Handle type="source" position={Position.Right} ... />
    </div>
  );
}
```

Pipeline stages are a linear chain (left→right), so use `Position.Left` / `Position.Right` handles and a horizontal layout (unlike the tree layout in AgentTopology which is top→bottom).

### Pattern 2: WebSocket Event Subscription for Instant Updates

[VERIFIED: src/contexts/AstridrWSContext.tsx]

```typescript
// Source: AstridrWSContext.tsx — subscribeEvent for precise event targeting
const { subscribeEvent } = useAstridrWS();

useEffect(() => {
  const unsub = subscribeEvent("agent_status", (event) => {
    // event.agentId, event.state, event.timestamp, event.currentTask
    setLocalAgentState(prev => ({
      ...prev,
      [event.agentId as string]: event,
    }));
  });
  return unsub;
}, [subscribeEvent]);
```

The `subscribeEvent()` API (not `subscribe()`) targets a specific `event_type` string. New event types `agent_status`, `daily_rhythm_sync`, `step_started`, `step_completed` must be added to `TOPIC_EVENT_MAP` in `AstridrWSContext.tsx` to route them correctly. They belong in the `"health"` or a new `"operations"` topic bucket.

### Pattern 3: Convex Table + Domain Module

Follow the `pipelineCheckpoints.ts` pattern. [VERIFIED: convex/pipelineCheckpoints.ts]

```typescript
// Source: convex/pipelineCheckpoints.ts (established pattern)
export const recordEvent = mutation({
  args: { executionId: v.string(), ... },
  handler: async (ctx, args) => {
    await ctx.db.insert("pipelineStepEvents", args);
  },
});

export const recent = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pipelineStepEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit ?? 50);
  },
});
```

### Pattern 4: Operations Page Structure

Follow the `Automation.tsx` page pattern. [VERIFIED: src/pages/Automation.tsx]

```typescript
// Pattern: MetricCard row → SectionErrorBoundary-wrapped panels
export default function Operations() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Operations</h1>

      {/* Summary MetricCards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Active Agents" value={activeCount} />
        ...
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

### Pattern 5: Agent Roster from YAML (D-03)

The roster source is `agent-types.yaml` in the Ástríðr repo. [VERIFIED: C:\Users\mandr\astridr-repo\config\agent-types.yaml]

Ástríðr already pushes agent type definitions via the `capability_sync` event type (handled in `runtimeIngest.ts`). However, that event writes to `agentConfigs` (generic key-value), not a dedicated agent roster. Two options:
1. Ástríðr sends a `agent_roster_sync` event at bootstrap with the full agent type list → CodePulse stores in a dedicated query. [ASSUMED — new event type, needs Ástríðr implementation]
2. CodePulse hard-codes the roster as a static list (like `CRON_SCHEDULES` does for Convex crons) and decorates it with live status from `agentStatusEvents`. [VERIFIED: pattern exists in cronSchedules.ts]

**Recommendation:** Option 2 for the initial implementation. The full agent roster doesn't change often. A static `AGENT_TYPES` constant in `src/lib/agentRoster.ts` (mirroring the 8+ agent types from yaml) is simpler and avoids a cross-repo bootstrap dependency. Can be upgraded to dynamic sync later.

Known agent types from yaml [VERIFIED: config/agent-types.yaml]:
- `astridr` (commander, profiles: personal/business)
- Additional agent types need full yaml read — confirmed multiple entries with `id`, `name`, `profiles`, `task_category` fields

### Pattern 6: Category Color Heuristic (D-06)

No existing implementation. Pure keyword matching on action text. [ASSUMED — keyword map below]

```typescript
// src/lib/rhythmCategories.ts
export function categorizeRhythm(action: string): RhythmCategory {
  const lower = action.toLowerCase();
  if (/briefing|morning|evening|weekly digest/.test(lower)) return "morning";
  if (/health|check|monitor|status/.test(lower)) return "health";
  if (/research|digest|pr review|code review/.test(lower)) return "research";
  if (/content|write|generate|create/.test(lower)) return "content";
  if (/review|audit|report/.test(lower)) return "review";
  return "system";
}

export const CATEGORY_COLORS: Record<RhythmCategory, string> = {
  health: "bg-teal-500/20 border-teal-500/40 text-teal-300",
  morning: "bg-orange-500/20 border-orange-500/40 text-orange-300",
  research: "bg-blue-500/20 border-blue-500/40 text-blue-300",
  content: "bg-purple-500/20 border-purple-500/40 text-purple-300",
  review: "bg-red-500/20 border-red-500/40 text-red-300",
  system: "bg-gray-500/20 border-gray-500/40 text-gray-400",
};
```

### Anti-Patterns to Avoid

- **Inline React Flow layout math:** Keep layout computation (node positions) in a `useMemo` outside the JSX, as AgentTopology.tsx does. Never recalculate positions on every render.
- **Polling instead of subscribeEvent:** For instant tile state changes, use `subscribeEvent()` not a short `useQuery` polling interval. Convex queries already auto-update; the WS path is additive for sub-second UI feedback.
- **Rendering ReactFlow inside a flex container without explicit height:** React Flow requires an explicit pixel height on its container (see `style={{ height: 400 }}` in AgentTopology.tsx). Without it the diagram renders invisible.
- **Storing full action text in calendar slots:** Calendar grid cells are tiny. Store only the category label + time; the full action is tooltip/expand content.
- **Missing `SectionErrorBoundary`:** Each of the three panels must be wrapped. A React Flow crash in PipelineFlowDiagram must not take down the status grid.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Animated flow edges | Custom SVG path animation | `animated: true` on React Flow Edge | Built into @xyflow/react — handles SVG dash animation automatically |
| Pulse ring animation | Keyframe CSS in JS | Tailwind `animate-pulse` + `motion` | Both already installed; `motion` handles timed pulse ring variants |
| Calendar date math | Manual `new Date()` arithmetic | `date-fns` `startOfWeek`, `eachHourOfInterval` | Already installed; handles DST, locale, week boundaries correctly |
| Cron expression → next-run | Custom cron parser | `estimateNextRun()` from `cronSchedules.ts` | Already written and tested for this codebase's cron format |
| Node click → detail expand | Custom portal/modal | Inline expand panel below grid (same pattern as AgentTopology's `AgentDetailPanel`) | Establishes page consistency; no z-index conflicts |

**Key insight:** React Flow's `animated` edge property and Tailwind pulse utilities handle all the visual "live" feel. Don't invest in custom animation primitives.

---

## New Convex Tables Required

Three new tables in `convex/schema.ts`:

### `agentStatusEvents` (for Status Heartbeat Grid)

```typescript
agentStatusEvents: defineTable({
  agentId: v.string(),          // matches agent type id from roster (e.g. "astridr")
  state: v.string(),            // "active" | "waiting" | "recent" | "idle"
  currentTask: v.optional(v.string()),
  errorCount: v.optional(v.float64()),
  profileId: v.optional(v.string()),
  timestamp: v.float64(),
})
  .index("by_agentId", ["agentId", "timestamp"])
  .index("by_timestamp", ["timestamp"])
  .index("by_state", ["state", "timestamp"]),
```

Query pattern: fetch the most recent event per `agentId` (latest-wins). UI derives idle by comparing `timestamp` to `Date.now()` with a 5-minute threshold.

### `dailyRhythmEntries` (for Cron Calendar)

```typescript
dailyRhythmEntries: defineTable({
  agentTypeId: v.string(),       // e.g. "astridr"
  action: v.string(),            // full action text (truncated in UI)
  channel: v.string(),           // "telegram" | "slack" | "email"
  days: v.string(),              // cron days spec e.g. "mon-sun"
  time: v.string(),              // "HH:MM" 24h
  profileId: v.optional(v.string()),
  category: v.optional(v.string()), // derived on write: "morning" | "health" etc.
  cronExpression: v.optional(v.string()), // pre-computed cron expr
  syncedAt: v.float64(),
})
  .index("by_agentType", ["agentTypeId"])
  .index("by_syncedAt", ["syncedAt"]),
```

### `pipelineStepEvents` (for Pipeline Flow Diagram)

```typescript
pipelineStepEvents: defineTable({
  executionId: v.string(),
  pipelineName: v.string(),      // e.g. "message_pipeline"
  stepName: v.string(),          // "receive" | "route" | "process" | "respond" | "tts_followup"
  stepIndex: v.float64(),
  status: v.string(),            // "step_started" | "step_completed" | "step_failed"
  durationMs: v.optional(v.float64()),  // populated on step_completed
  inputSize: v.optional(v.float64()),   // bytes or token count
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

## New `runtimeIngest.ts` Event Types

Three new `case` blocks needed in the `switch(evt.eventType)` in `convex/runtimeIngest.ts`:

| New eventType | Routes to | Notes |
|---------------|-----------|-------|
| `agent_status` | `agentStatus.recordEvent` | Dual-channel: HTTP POST + WS push (D-11) |
| `daily_rhythm_sync` | `dailyRhythm.upsertEntries` | Bulk upsert at Ástríðr bootstrap (D-12) |
| `step_started` | `pipelineStepEvents.recordEvent` | Fine-grained pipeline event (D-13) |
| `step_completed` | `pipelineStepEvents.recordEvent` | Fine-grained pipeline event (D-13) |

---

## AstridrWSContext Topic Map Update

New event types must be registered in `TOPIC_EVENT_MAP` in `AstridrWSContext.tsx`. [VERIFIED: src/contexts/AstridrWSContext.tsx]

```typescript
// Add to existing TOPIC_EVENT_MAP:
health: new Set([
  // ... existing entries ...
  "agent_status",        // new — heartbeat grid instant update
  "daily_rhythm_sync",   // new — calendar live sync
]),
executions: new Set([
  // ... existing entries ...
  "step_started",        // new — pipeline diagram live progress
  "step_completed",      // new — pipeline diagram live progress
]),
```

---

## Ástríðr Side Changes (Phase 94 — cross-project contract)

These are the CodePulse-side expectations for what Ástríðr must emit. The planner should treat these as integration contract requirements, not CodePulse implementation tasks.

### Event Shape: `agent_status`

```python
# POST to /runtime-ingest AND WS push
{
  "eventType": "agent_status",
  "agentId": "astridr",          # agent type id
  "state": "active",             # "active" | "waiting" | "recent"
  "currentTask": "Morning briefing...",
  "errorCount": 0,
  "profileId": "personal",
  "timestamp": 1234567890.0
}
```

Trigger points in Ástríðr: on inbound message receipt (→ `active`), on task completion (→ `recent`), on queue entry (→ `waiting`). Idle is derived client-side by timeout.

### Event Shape: `daily_rhythm_sync`

```python
# POST to /runtime-ingest at bootstrap
{
  "eventType": "daily_rhythm_sync",
  "entries": [
    {
      "agentTypeId": "astridr",
      "action": "Generate today's personal morning briefing...",
      "channel": "telegram",
      "days": "mon-sun",
      "time": "05:57",
      "profileId": "personal"
    },
    ...  # all rhythm entries across all agent types
  ],
  "timestamp": 1234567890.0
}
```

### Event Shapes: `step_started` / `step_completed`

```python
# POST to /runtime-ingest (step_started)
{
  "eventType": "step_started",
  "executionId": "exec_abc123",
  "pipelineName": "message_pipeline",
  "stepName": "route",
  "stepIndex": 1,
  "timestamp": 1234567890.0
}

# POST to /runtime-ingest (step_completed)
{
  "eventType": "step_completed",
  "executionId": "exec_abc123",
  "pipelineName": "message_pipeline",
  "stepName": "route",
  "stepIndex": 1,
  "durationMs": 42.5,
  "inputSize": 1024,
  "outputSize": 256,
  "timestamp": 1234567891.0
}
```

---

## Common Pitfalls

### Pitfall 1: React Flow Container Height
**What goes wrong:** The Flow diagram renders as a 0-height div — completely invisible.
**Why it happens:** React Flow requires explicit pixel height on its container. Flexbox `flex-1` does not work.
**How to avoid:** Always set `style={{ height: 400 }}` (or fixed px) on the ReactFlow container div, as done in AgentTopology.tsx.
**Warning signs:** Component renders but shows nothing; no error in console.

### Pitfall 2: Stale Agent Roster if Static AGENT_TYPES List Used
**What goes wrong:** New agent types added to agent-types.yaml don't appear in the grid.
**Why it happens:** The static fallback approach for D-03 requires manual sync.
**How to avoid:** Note in the implementation that the static `agentRoster.ts` file is the source — any new agent types added to Ástríðr must be reflected here. Comment the file with the Ástríðr yaml path.

### Pitfall 3: Idle State Logic Race
**What goes wrong:** An agent shows "active" indefinitely because the last event timestamp never gets a 5-minute timeout applied.
**Why it happens:** WebSocket events update local React state but the idle timeout must be computed continuously via `setInterval` or `useMemo` with current time.
**How to avoid:** Use a `useEffect` with `setInterval(1000)` that re-evaluates all agent states against `Date.now()`. Derive the rendered `state` from the stored event plus the current time, not from a stored state field.

### Pitfall 4: Calendar Overcrowding at Certain Hours
**What goes wrong:** Multiple daily_rhythm entries at 05:57, 06:57, 17:57 all stack on the same slot and overlap visually.
**Why it happens:** Multiple agents have entries at the same time (morning/evening briefings fire at identical clock times).
**How to avoid:** Allow multiple entries per hour slot. Stack them vertically within the cell (small colored badges), not as full-width items. Show count badge if > 3 in one slot.

### Pitfall 5: `null` coercion in runtimeIngest
**What goes wrong:** Convex mutation fails with validator error on optional fields.
**Why it happens:** The existing runtimeIngest pattern explicitly coerces `null → undefined` for all top-level fields (see line ~89 in runtimeIngest.ts). New event handlers must follow the same pattern.
**How to avoid:** In the new `case` blocks, use the same `d.field ?? undefined` pattern as all other handlers.

### Pitfall 6: React Flow node `data` prop TypeScript errors
**What goes wrong:** TypeScript errors on `data.field` inside custom nodes.
**Why it happens:** `@xyflow/react` v12 requires generics: `Node<MyDataType>` and the node component must receive `{ data: MyDataType }`.
**How to avoid:** Define a typed `Node` type: `type PipelineNode = Node<PipelineStageNodeData>` and pass to `nodeTypes`. Match `AgentNode.tsx` pattern exactly.

---

## Existing Codebase Patterns (Verified — Use These Exactly)

### Page Registration

```typescript
// 1. src/App.tsx — add route (follow existing lazy import pattern for heavy pages)
const Operations = lazy(() => import("./pages/Operations"));
<Route path="/operations" element={<Suspense fallback={...}><Operations /></Suspense>} />

// 2. src/layouts/DashboardLayout.tsx — add to navItems array
{ to: "/operations", label: "Operations", icon: "radar", group: "MONITOR" }
// and add to iconComponents map: radar: Radio  (Radio icon already imported)
```

### Hook Pattern

```typescript
// src/hooks/useAgentStatus.ts
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useRecentAgentStatus() {
  return useQuery(api.agentStatus.recentByAgent) ?? [];
}
```

### ReactFlow with Custom Nodes

```typescript
// Source: AgentTopology.tsx
const nodeTypes = { pipelineStage: PipelineStageNode };

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
  <Controls showInteractive={false} className="!bg-gray-800 ..." />
</ReactFlow>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@reactflow/core` import path | `@xyflow/react` import path | v12 (2024) | Must use `@xyflow/react` — old import path doesn't exist in v12 |
| `ReactFlowProvider` required | Auto-wrapped when using `<ReactFlow>` directly | v12 | No manual provider needed at top level |
| Manual edge animation CSS | `animated: true` on edge config | v11+ | Single boolean handles marching-ants animation |

**Note:** The codebase already uses `@xyflow/react` correctly [VERIFIED: AgentTopology.tsx line 3]. No migration needed.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Static `AGENT_TYPES` constant (Option 2) is sufficient for D-03 — full roster always visible | Architecture Patterns, Pattern 5 | If agent types change frequently, the static list goes stale. Mitigation: add a comment linking to the yaml source |
| A2 | Category keyword heuristic in Pattern 6 correctly classifies all daily_rhythm entries | Architecture Patterns, Pattern 6 | Some entries may get wrong category. Low risk — purely cosmetic |
| A3 | Ástríðr's message handling pipeline has exactly 5 stages: receive→route→process→respond→tts_followup | Phase description + CONTEXT.md specifics | If actual pipeline has more/fewer stages, node layout needs adjustment. Verify against astridr source before implementing |
| A4 | `agent_status` events should be added to the `health` topic in `TOPIC_EVENT_MAP` | AstridrWSContext Update section | Could go in a new `operations` topic instead. Either works — `health` already has `heartbeat_alerts` |
| A5 | The 5-minute idle timeout is appropriate | Claude's Discretion | Could be too long (busy agents) or too short (quiet hours). Configurable constant is safer |

---

## Open Questions

1. **How many agent types are in agent-types.yaml?**
   - What we know: At minimum `astridr` confirmed. YAML has `agent_types:` array.
   - What's unclear: Full count — only read first 180 lines. Need to confirm full roster for the static AGENT_TYPES list.
   - Recommendation: Read full agent-types.yaml during Wave 0 / task execution to build the complete static list.

2. **Does the 5-stage pipeline (receive→route→process→respond→tts_followup) match Ástríðr's actual pipeline structure?**
   - What we know: Phase description names these 5 stages; D-13 says Ástríðr must emit step events.
   - What's unclear: Whether Ástríðr's current pipeline module uses exactly these stage names.
   - Recommendation: Planner should include a task to read `astridr/engine/pipelines.py` before implementing step emission.

3. **Does `daily_rhythm_sync` need to be idempotent (upsert) or can it replace-all?**
   - What we know: Pushed at bootstrap plus "live sync on config changes" (D-12).
   - What's unclear: Whether to delete-and-reinsert vs. upsert on key `(agentTypeId, time, days)`.
   - Recommendation: Replace-all (delete by `agentTypeId`, then bulk insert) — simpler and correct since the full yaml is always sent.

---

## Environment Availability

Step 2.6 confirmed: All dependencies are the existing installed stack. No new tooling required.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@xyflow/react` | Pipeline Flow Diagram | Yes | `^12.10.1` | — |
| `motion` | Tile pulse animations | Yes | `^12.38.0` | Tailwind `animate-pulse` |
| `date-fns` | Calendar date math | Yes | `^4.1.0` | — |
| Convex backend | All data persistence | Yes | `^1.36.1` | — |
| Ástríðr WS endpoint | Instant status updates | [ASSUMED] — Phase 56 wired it | — | Graceful degradation — falls back to Convex polling |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `^4.0.18` with `@testing-library/react` |
| Config file | None found — uses Vite's default Vitest config |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |
| Setup file | `src/test/setup.ts` (imports `@testing-library/jest-dom`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-02 | AgentStatusTile renders correct state color class per state | unit | `npx vitest run src/components/AgentStatusTile.test.tsx` | Wave 0 |
| D-03 | StatusHeartbeatGrid renders all configured agent types even with no live events | unit | `npx vitest run src/components/StatusHeartbeatGrid.test.tsx` | Wave 0 |
| D-06 | `categorizeRhythm()` returns correct category for keyword variants | unit | `npx vitest run src/lib/rhythmCategories.test.ts` | Wave 0 |
| D-11 | `runtimeIngest` `agent_status` case inserts into `agentStatusEvents` | unit (Convex) | `npx vitest run convex/agentStatus.test.ts` | Wave 0 |
| D-12 | `dailyRhythm.upsertEntries` replaces entries for an agentTypeId | unit (Convex) | `npx vitest run convex/dailyRhythm.test.ts` | Wave 0 |
| D-13 | `pipelineStepEvents.recordEvent` stores step_started with correct fields | unit (Convex) | `npx vitest run convex/pipelineStepEvents.test.ts` | Wave 0 |
| Idle timeout | Agent state transitions to "idle" after 5min with no events | unit | `npx vitest run src/components/StatusHeartbeatGrid.test.tsx` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run` (test files related to current task)
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/components/AgentStatusTile.test.tsx` — covers D-02 state rendering
- [ ] `src/components/StatusHeartbeatGrid.test.tsx` — covers D-03, idle timeout
- [ ] `src/lib/rhythmCategories.test.ts` — covers D-06 keyword heuristic
- [ ] `convex/agentStatus.test.ts` — covers D-11 ingest routing
- [ ] `convex/dailyRhythm.test.ts` — covers D-12 upsert/replace logic
- [ ] `convex/pipelineStepEvents.test.ts` — covers D-13 step event storage

Note: React Flow and `motion` are already mocked in `src/test/setup.ts` context. Verify mock coverage before writing React Flow component tests. [VERIFIED: CLAUDE.md mentions setup.ts mocks React Flow]

---

## Security Domain

`security_enforcement` not explicitly set to false — treating as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Operations page is behind existing `AuthGuard` (Clerk optional) |
| V3 Session Management | No | Handled by existing app-wide auth |
| V4 Access Control | No | Single-operator dashboard — no per-feature access control needed |
| V5 Input Validation | Yes | New ingest event types validated via Convex `v.` validators in mutation args |
| V6 Cryptography | No | No new crypto surfaces |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Ingest spoofing via `agent_status` events | Spoofing | Existing `validateIngestAuth()` in `runtimeIngest.ts` — Bearer token required for all `/runtime-ingest` POSTs |
| Oversized `daily_rhythm_sync` payload (many entries) | DoS | Existing `checkBodySize()` in `runtimeIngest.ts` — payload size limit already enforced |
| XSS via `currentTask` action text in tile | Tampering | React's default JSX escaping handles this — never use `dangerouslySetInnerHTML` |

---

## Project Constraints (from CLAUDE.md)

The following directives from `C:\Users\mandr\codepulse\CLAUDE.md` apply to this phase:

- **No new npm dependencies** — all functionality built with existing stack (confirmed: no new packages needed)
- **Dark theme throughout** — `bg-gray-800/50` cards, `border-gray-700/50`, `text-gray-300`, `indigo-600` accents
- **Tailwind CSS 4 only** — no component library for new UI (except existing shadcn/ui buttons/separators already in use)
- **Page pattern**: new file in `src/pages/` → route in `App.tsx` → nav entry in `DashboardLayout.tsx`
- **Convex data flow**: HTTP ingest → domain mutations → tables → `useQuery()` subscriptions
- **Error boundaries**: `SectionErrorBoundary` wrapping every new widget section
- **Auth headers**: Any new `fetch()` calls to Ástríðr API must use `authHeaders()` from `src/lib/astridrApi.ts`
- **Path alias**: `@/` resolves to `./src/` — use in all new component files

---

## Sources

### Primary (HIGH confidence)
- `src/components/AgentTopology.tsx` — React Flow patterns (nodes, edges, layout, custom types)
- `src/components/AgentNode.tsx` — Custom node implementation pattern
- `convex/schema.ts` — All existing table definitions; no `agentStatusEvents`, `dailyRhythmEntries`, or `pipelineStepEvents` tables exist yet
- `convex/pipelineCheckpoints.ts` — Pipeline event table pattern
- `convex/runtimeIngest.ts` — Event routing switch pattern; all existing `case` handlers
- `src/contexts/AstridrWSContext.tsx` — `TOPIC_EVENT_MAP`, `subscribeEvent()` API
- `src/hooks/useAutomation.ts` — Hook pattern for Convex queries
- `src/lib/cronSchedules.ts` — Static cron registry + `estimateNextRun()` pattern
- `src/pages/Automation.tsx` — Page composition pattern
- `src/layouts/DashboardLayout.tsx` — `navItems` and `iconComponents` map
- `package.json` — All dependency versions verified
- `C:\Users\mandr\astridr-repo\config\agent-types.yaml` — daily_rhythm entry structure (agentTypeId, action, channel, days, time)
- `C:\Users\mandr\astridr-repo\astridr\engine\bootstrap\cron_jobs.py` — `_rhythm_to_cron()` cron expression converter; bootstrap registration pattern

### Secondary (MEDIUM confidence)
- `graphify-out/GRAPH_REPORT.md` — Confirmed `useAstridrWS()` is a god node (8 edges); `Automation()` has 7 edges — both are central abstractions this phase extends

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all versions verified from package.json
- Architecture: HIGH — all patterns exist in codebase and were read directly
- Convex schemas: HIGH — existing schemas verified; new schemas designed to match existing patterns
- Ástríðr event contract: MEDIUM — event shapes designed from phase spec + existing ingest patterns; actual Ástríðr pipeline stage names need verification (A3)
- Pitfalls: HIGH — derived from direct code reading (React Flow height, null coercion, TOPIC_EVENT_MAP)

**Research date:** 2026-05-03
**Valid until:** 2026-06-03 (stable stack)
