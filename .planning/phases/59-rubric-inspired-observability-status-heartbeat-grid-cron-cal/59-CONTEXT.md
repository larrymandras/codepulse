# Phase 59: Rubric-Inspired Observability - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers three new dashboard surfaces on a dedicated Operations page in CodePulse — a real-time agent status heartbeat grid, a 7-day cron calendar showing scheduled tasks, and an animated pipeline flow diagram — giving operators a live operational view of Ástríðr.

This is the CodePulse (consumer/visualization) side. The Ástríðr (producer/instrumentation) side is tracked as Ástríðr Phase 94.

</domain>

<decisions>
## Implementation Decisions

### Status Heartbeat Grid
- **D-01:** Grid lives on a new dedicated "Operations" page (not a Dashboard widget)
- **D-02:** Rubric-style tiles — larger square tiles with pulsing color backgrounds per state, agent avatar, and real-time counters. Four states: active (green pulse), waiting (blue), recent (amber pulse), idle (gray)
- **D-03:** Show all configured agent types from Ástríðr's agent-types.yaml, even if offline. Idle agents get gray tiles — full roster always visible
- **D-04:** Click a tile to expand inline detail below the grid (last 5 heartbeats, current task, error count). No page navigation

### Cron Calendar Design
- **D-05:** Combined view showing both Ástríðr daily_rhythm entries AND Convex cron jobs, with a toggle to hide system crons
- **D-06:** Category color coding derived from action text via keyword heuristic (e.g., "briefing" → morning/orange, "PR digest" → review/red). No Ástríðr config changes needed. Color mapping: health=teal, morning=orange, research=blue, content=purple, review=red, system=gray
- **D-07:** Interactive slots — click a calendar slot to see last execution result, duration, and any errors

### Pipeline Flow Diagram
- **D-08:** Both live and replay modes — default to live view when a pipeline execution is active, with a dropdown to select and replay past executions from pipelineCheckpoints history
- **D-09:** Render with React Flow (reusing existing pattern from AgentTopology, DetailTopologyTab, RosterOrgChart). Custom nodes per stage with status indicators, animated edges for progress
- **D-10:** Click a pipeline stage node to expand detail below the diagram showing step duration, input/output size, and error details if failed

### Data Transport (Cross-Project Contract)
- **D-11:** Status heartbeat events use both channels — HTTP POST to existing ingest endpoint for Convex persistence (source of truth) PLUS WebSocket push via useAstridrWS() for instant UI updates
- **D-12:** Daily rhythm data pushed to Convex at Ástríðr bootstrap, plus live sync on config changes. Calendar works even if Ástríðr is down. Requires new Convex table for rhythm entries
- **D-13:** Ástríðr must emit finer-grained pipeline events — both 'step_started' and 'step_completed' events (not just checkpoints) so the diagram shows real-time progress per step with accurate timing

### Claude's Discretion
- Auto-timeout threshold for idle state (roadmap says 5min — Claude can adjust if needed)
- React Flow node styling and edge animation specifics
- Convex table schema design for rhythm entries and enhanced pipeline events
- Operations page layout arrangement of the three surfaces
- Current-time indicator and next-up countdown implementation on cron calendar

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing CodePulse Patterns
- `src/components/HeartbeatAlertsPanel.tsx` — Existing heartbeat display pattern (list-based, to be replaced with grid)
- `src/components/AgentTopology.tsx` — React Flow usage pattern in this codebase
- `src/lib/cronSchedules.ts` — Static Convex cron schedule definitions and `estimateNextRun()` utility
- `src/pages/Automation.tsx` — Current automation page with cron jobs, heartbeats, pipeline checkpoints
- `src/contexts/AstridrWSContext.tsx` — WebSocket context for real-time Ástríðr data (useAstridrWS hook)
- `convex/pipelineCheckpoints.ts` — Existing pipeline checkpoint Convex functions
- `convex/schema.ts` — Current Convex schema (pipelineCheckpoints table definition)

### Ástríðr Source (Cross-Project)
- `C:\Users\mandr\astridr-repo\config\agent-types.yaml` — Agent type definitions including daily_rhythm entries with action, channel, days, time fields
- `C:\Users\mandr\astridr-repo\astridr\engine\bootstrap\cron_jobs.py` — How daily_rhythm entries become cron jobs at bootstrap

### Inspiration
- [Rubric](https://github.com/robonuggets/rubric) — Command center patterns (status grid, cron calendar, flow visualization)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `HeartbeatAlertsPanel` — existing heartbeat display (will be superseded by the new grid)
- `AgentTopology` / `DetailTopologyTab` / `RosterOrgChart` — React Flow patterns to follow
- `useAstridrWS()` hook — WebSocket subscription for real-time events
- `cronSchedules.ts` — `CRON_SCHEDULES` array and `estimateNextRun()` for Convex crons
- `useAutomationSummary()`, `useRecentCronExecutions()`, `useRecentHeartbeats()` — existing data hooks
- `SectionErrorBoundary` — wrap all new widget sections
- `MetricCard` — reuse for summary stats on Operations page
- `formatTimestamp()`, `relativeTime()`, `formatDurationMs()` — existing formatters

### Established Patterns
- Dark theme: `bg-gray-800/50` cards, `border-gray-700/50`, `text-gray-300`, indigo accents, green/amber/red status
- Page pattern: new file in `src/pages/`, route in `App.tsx`, nav entry in `DashboardLayout.tsx`
- Convex data flow: HTTP ingest → domain mutations → tables → `useQuery()` subscriptions → auto-updating UI
- Error boundaries: `SectionErrorBoundary` wrapping widget groups

### Integration Points
- `App.tsx` — new route for Operations page
- `DashboardLayout.tsx` — nav entry in `navItems` array + `iconMap`
- `convex/schema.ts` — new tables for rhythm entries and enhanced pipeline events
- `convex/http.ts` — if new ingest event types needed for status heartbeats
- `convex/runtimeIngest.ts` — handler for new event types

</code_context>

<specifics>
## Specific Ideas

- Rubric command center is the visual inspiration — pulsing tiles, operational feel
- 5-stage pipeline: receive → route → process → respond → TTS followup
- Calendar is hour-by-hour, 7-day view with category color coding
- Agent status tiles should show agent avatar (from existing AgentAvatar component)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 59-rubric-inspired-observability-status-heartbeat-grid-cron-cal*
*Context gathered: 2026-05-04*
