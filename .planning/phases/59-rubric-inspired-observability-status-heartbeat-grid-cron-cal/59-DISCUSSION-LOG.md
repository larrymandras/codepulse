# Phase 59: Rubric-Inspired Observability - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-04
**Phase:** 59-rubric-inspired-observability-status-heartbeat-grid-cron-cal
**Areas discussed:** Status grid layout, Cron calendar design, Pipeline flow diagram, Data transport

---

## Status Grid Layout

### Where should the grid live?

| Option | Description | Selected |
|--------|-------------|----------|
| New dedicated page | Standalone 'Operations' page with the grid as hero element | ✓ |
| Dashboard widget | Section on existing Dashboard page | |
| Both | Widget summary on Dashboard + full-detail on Operations page | |

**User's choice:** New dedicated page

### Grid cell appearance

| Option | Description | Selected |
|--------|-------------|----------|
| Colored dot + label cards | Small cards with status dot, agent name, timestamp | |
| Rubric-style tiles | Larger square tiles with pulsing backgrounds, avatar, counters | ✓ |
| You decide | Claude picks based on patterns | |

**User's choice:** Rubric-style tiles

### Grid scope

| Option | Description | Selected |
|--------|-------------|----------|
| All configured agents | Full roster from agent-types.yaml, idle = gray | ✓ |
| Active agents only | Only agents that reported in, dynamic | |
| All + offline warning | All agents, never-seen gets distinct state | |

**User's choice:** All configured agents

### Tile click behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Expand inline detail | Expand below grid with last 5 heartbeats, task, errors | ✓ |
| Navigate to agent detail | Go to Agents page filtered to agent | |
| Slide-out drawer | Side drawer with activity, stays on page | |

**User's choice:** Expand inline detail

---

## Cron Calendar Design

### Data sources

| Option | Description | Selected |
|--------|-------------|----------|
| Daily rhythm only | Ástríðr rhythms only | |
| Combined view | Both rhythms and Convex crons, visually distinguished | |
| Combined with toggle | Both by default, toggle to hide system crons | ✓ |

**User's choice:** Combined with toggle

### Category determination

| Option | Description | Selected |
|--------|-------------|----------|
| Derive from action text | Keyword heuristic from action field | ✓ |
| Explicit category field | New field in Ástríðr schema | |
| You decide | Claude picks | |

**User's choice:** Derive from action text

### Interaction model

| Option | Description | Selected |
|--------|-------------|----------|
| Interactive slots | Click slot for execution details/history | ✓ |
| Read-only display | Visual only, history on Automation page | |
| Hover tooltip | Hover for details, no click | |

**User's choice:** Interactive slots

---

## Pipeline Flow Diagram

### Live vs replay

| Option | Description | Selected |
|--------|-------------|----------|
| Live only | Currently-active execution, last completed as static fallback | |
| Both modes | Live default + dropdown to replay past executions | ✓ |
| Replay with live overlay | Static stages, animate on live, history for replay | |

**User's choice:** Both modes

### Renderer

| Option | Description | Selected |
|--------|-------------|----------|
| React Flow (reuse) | Custom nodes/edges, consistent with codebase | ✓ |
| Custom SVG/CSS | Lightweight, no library dep for linear flow | |
| You decide | Claude picks | |

**User's choice:** React Flow (reuse)

### Stage detail interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Click to expand | Expand below diagram with timing/size/errors | ✓ |
| Hover tooltip | Quick stats on hover | |
| Side panel | Detail panel beside diagram | |

**User's choice:** Click to expand

---

## Data Transport

### Heartbeat event delivery

| Option | Description | Selected |
|--------|-------------|----------|
| Extend existing ingest | HTTP POST to /ingest, Convex stores | |
| WebSocket push | useAstridrWS() for real-time | |
| Both channels | HTTP POST for persistence + WS for instant UI update | ✓ |

**User's choice:** Both channels

### Daily rhythm data source

| Option | Description | Selected |
|--------|-------------|----------|
| Fetch from Ástríðr API | CodePulse calls API on page load | |
| Push to Convex at boot | Ástríðr pushes at bootstrap, new Convex table | |
| Push + live sync | Push at bootstrap + sync on config changes | ✓ |

**User's choice:** Push + live sync

### Pipeline event granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Existing checkpoints enough | Use current pipelineCheckpoints data | |
| Need start+complete events | Finer-grained step_started/step_completed events | ✓ |
| You decide | Claude evaluates | |

**User's choice:** Need start+complete events

---

## Claude's Discretion

- Auto-timeout threshold for idle state (5min default)
- React Flow node styling and edge animation specifics
- Convex table schema design for rhythm entries and enhanced pipeline events
- Operations page layout arrangement
- Current-time indicator and next-up countdown on cron calendar

## Deferred Ideas

None — discussion stayed within phase scope
