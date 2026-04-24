# Live Run Overhaul — Design Spec

**Date**: 2026-04-24
**Scope**: CodePulse only (no Astridr changes)
**Phase**: TBD (next available CodePulse phase number)

## Problem

The Live Run page subscribes to 4 of 9 available run events (`run.started`, `run.blocks`, `run.completed`, `run.error`). It ignores thinking state, tool call details, cost/token data, and failover transitions — all of which Astridr already emits. The Flow tab (dagre DAG) adds complexity without solving a real problem. The result is a page that shows "something is happening" but provides no actionable insight.

## Goals

1. Surface what the agent is doing and why (thinking, tool calls with args/results)
2. Show cost, token, and provider data per run
3. Make failover transitions visible
4. Remove the unused Flow tab, replace with a Run Summary panel
5. Decompose RunBlock into focused sub-components for maintainability and the upcoming streaming phase

## Non-Goals

- Token-level streaming (requires Astridr provider changes — separate phase)
- Reworking RunHistorySelector (functional as-is)
- Changes to Astridr's agent loop or telemetry (all data already emitted)

---

## New WS Subscriptions

Currently subscribed: `run.started`, `run.blocks`, `run.completed`, `run.error`

Add:
- `run.thinking` — emitted with `{ round_num, thinking_text }`
- `run.tool_call` — emitted with `{ tool_name, arguments, status, result }`
- Failover `self_healing` event — emitted with `{ failedProvider, errorMessage, remainingProviders }`. Note: this event is on the `health` WS topic, not `live-runs`. LiveRun must subscribe to the `health` topic to receive it (useLiveState already subscribes to health).

## Block Type Mapping

Events are accumulated into a typed blocks array in LiveRun state:

| WS Event | Block Type | Key Data |
|----------|-----------|----------|
| `run.thinking` | `thinking` | round_num, thinking_text |
| `run.tool_call` | `tool_call` | tool_name, arguments, result, status |
| `run.blocks` (text) | `text` | text content (existing) |
| `run.error` | `error` | error_type, message (existing) |
| `self_healing` (health topic) | `failover` | failedProvider, newProvider, errorMessage |

`run.blocks` with `type: "tool_use"` are **dropped** — superseded by the richer `run.tool_call` event. See Deduplication section.

---

## Component Architecture

### Current
```
LiveRun.tsx → RunTimeline.tsx → RunBlock.tsx (handles all types)
                               RunHistorySelector.tsx
```

### New
```
LiveRun.tsx (orchestrator: subscriptions, tab state, session mgmt)
├── Tab: Timeline
│   └── RunTimeline.tsx (round grouping, accordion, auto-scroll)
│       ├── ThinkingBlock.tsx
│       ├── ToolCallBlock.tsx
│       ├── TextBlock.tsx
│       ├── ErrorBlock.tsx
│       └── FailoverBlock.tsx
├── Tab: Summary
│   └── RunSummary.tsx
└── RunHistorySelector.tsx (unchanged)
```

### RunBlock.tsx

Becomes a thin dispatcher: receives a block, switches on `block.type`, renders the matching sub-component. Each sub-component owns its layout and expand/collapse state.

### Sub-Component Specifications

**ThinkingBlock**
- Round number badge (e.g., "Round 3")
- Thinking text preview, collapsed by default, expandable
- Amber left stripe (`border-l-4` with `--status-warn` token)
- Pulse animation while run is still active

**ToolCallBlock**
- Tool name as header
- Expandable section: arguments (formatted JSON)
- Expandable section: result (text, 500 char max from Astridr)
- Blue left stripe (`--primary` token)
- Green/red status indicator based on `status` field

**TextBlock**
- Final response text rendering
- No left stripe
- Existing text block behavior, extracted from RunBlock

**ErrorBlock**
- Error type + message
- Red left stripe (`--status-error` token)
- Existing error behavior, extracted from RunBlock

**FailoverBlock**
- Alert-style banner: "Provider X failed -> fell back to Y"
- Yellow/warning left stripe (`--status-warn` token)
- Expandable: error reason detail

---

## RunSummary Tab

Replaces the Flow/dagre tab. Stats panel for the current or selected run.

### Data Sources

- `run.completed` event: `{ rounds, tokens, cost, final_text }`
- Accumulated from live events during a run (round count from `run.thinking`, tool list from `run.tool_call`, provider trail from failover events)

### Layout (stats grid, four sections)

**Run Stats** (top row, card grid):
- Rounds: count
- Duration: elapsed from `run.started` to `run.completed`
- Status: running / completed / error (color indicator)

**Token & Cost** (second row):
- Input tokens
- Output tokens
- Total cost: `$X.XX`
- Shows "---" during live run before completion

**Provider Trail** (third section):
- Which provider handled the run
- If failover occurred: chain display (e.g., "Anthropic -> timeout -> Ollama qwen2.5:72b")
- Built from accumulated failover blocks

**Tool Usage** (bottom section):
- Total tool call count
- Unique tools with call counts (e.g., "web_search x3, memory_save x1")
- Built from accumulated `run.tool_call` events

### Live vs Completed Behavior

- During a live run: stats update as events arrive (round count ticks up, tools list grows)
- On `run.completed`: snaps to final values from the event payload
- History replay: summary populates from stored blocks (existing format, no enrichment)

---

## Deduplication Strategy

When a tool is called, Astridr emits both:
1. `run.tool_call` — rich (has arguments + result + status)
2. `run.blocks` with `tool_use` type — lean (name + arguments only)

**Rule**: `run.tool_call` is authoritative. `run.blocks` entries with `type: "tool_use"` are dropped in the `appendBlocks` filter. `run.blocks` entries with `type: "text"` are kept.

**Ordering**: Events arrive over WS in roughly chronological order. No sorting needed — display order matches receive order. `run.thinking` naturally precedes `run.tool_call` per round due to agent loop execution order.

**History replay**: Convex stores `run.blocks` (lean format). Replayed sessions show existing block format without `run.tool_call` enrichment. Acceptable — replay is secondary.

---

## Removals

- **Flow tab**: All ReactFlow, dagre imports, `flowGraph` useMemo, `FLOW_BLOCK_CAP` constant removed from LiveRun.tsx
- **Tab rename**: "Timeline | Flow" becomes "Timeline | Summary"

## Unchanged

- `RunHistorySelector.tsx` — left as-is
- `useLiveState.ts` — separate hook for dashboard-level state, not involved
- `RunTimeline.tsx` — round grouping and accordion logic preserved; delegates to new sub-components instead of RunBlock inline rendering

## RunBlock.tsx Disposition

Becomes the dispatcher (switch on `block.type` + imports). Current inline rendering moves to sub-components. Kept as a dispatcher for clean separation — if it becomes trivially small, RunTimeline could import sub-components directly, but keeping the indirection is cleaner for the upcoming streaming phase.

---

## Future Phase: Provider Streaming

A follow-up phase (separate spec) will add `stream: true` to Ollama and Anthropic providers in Astridr, emit token-level events from the agent loop, and update the Live Run timeline to render tokens as they arrive. This phase's component decomposition directly supports that — new block types or streaming variants slot into the same dispatcher pattern.
