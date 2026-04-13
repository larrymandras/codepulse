---
phase: 03-interaction-layer
plan: 05
subsystem: ui
tags: [react, accordion, xyflow, dagre, vitest, run-timeline, flow-dag]

# Dependency graph
requires:
  - GenerativeBlock types from 03-01
  - BlockRenderer from 03-02
provides:
  - RunTimeline nested accordion (Round > Tool Calls)
  - Flow tab with React Flow DAG visualization
  - Stop button with run.stop command
---

## What was built

### RunTimeline.tsx (restructured)
Completely rewritten with `groupIntoRounds()` function that splits agent block streams into accordion rounds. Thinking/reasoning blocks start each new round. Completed rounds collapse by default; active round stays expanded with amber `border-(--status-warn)` left stripe and pulse dot. Round headers show "Round {N}" with tool call count.

### LiveRun.tsx (enhanced)
Timeline/Flow tab switcher added to header bar. Flow tab renders a `@xyflow/react` DAG with `dagre` top-to-bottom layout connecting tool_use → tool_result pairs. Flow capped at 200 blocks (T-03-09 mitigation). Stop button sends `sendCommand({ action: "run.stop" })`, disabled when no active run. Empty state shows "No active run. Start a task from Agent Chat."

## Tests
7 unit tests passing in RunTimeline.test.tsx

## Key files

### created
(none — all files were modifications of existing)

### modified
- src/components/RunTimeline.tsx
- src/pages/LiveRun.tsx
- src/components/__tests__/RunTimeline.test.tsx

## Self-Check: PASSED

- [x] RunTimeline groups blocks into rounds with collapsible accordion sections
- [x] Completed rounds collapsed by default; active round expanded
- [x] Active round has amber left stripe
- [x] Round header shows count
- [x] Stop button calls sendCommand with run.stop
- [x] Flow tab renders React Flow DAG with dagre layout
