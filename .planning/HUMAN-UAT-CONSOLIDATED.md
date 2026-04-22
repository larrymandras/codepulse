---
status: testing
phases: [01-ui-redesign, 02-bidirectional-telemetry, 03-interaction-layer, 04-task-management, 05-data-pipeline, 06-alert-routing, 07-intelligence-layer, 58-infrastructure-layer]
source: [01-VERIFICATION.md, 02-VERIFICATION.md, 03-VERIFICATION.md, 04-VERIFICATION.md, 05-VERIFICATION.md, 06-VERIFICATION.md, 07-VERIFICATION.md, 58-VERIFICATION.md]
created: 2026-04-13
updated: 2026-04-22
---

# Consolidated Human UAT — CodePulse v4.0

All manual verification steps across all 8 completed phases. Work through sequentially — the dev server only needs to be started once.

## Prerequisites

- Terminal open in `C:\Users\mandr\codepulse`
- Run `npm run dev` to start the dev server
- Run `npm run dev:backend` in a second terminal for Convex
- Open http://localhost:5173 in your browser (port may vary — check terminal output)
- Astridr WebSocket **not running** initially (some tests start in disconnected state)

## Automated Checks (pre-UAT)

| Check | Status |
|-------|--------|
| TypeScript compilation (`npx tsc --noEmit`) | PASS |
| Test suite (`npm test -- --run`) | PASS — 40 files, 296 assertions |
| Dev server starts | PASS |
| Convex backend connects | PASS |

---

## Phase 1: UI Foundation

> Already tested: 0/4 passed. All pending.

### Test 1.1 — Sharp Corners Everywhere

**Steps:**
1. Open the dashboard
2. Navigate through Dashboard, Analytics, Agents, Executions pages
3. Inspect cards, panels, and containers visually

**Expected:**
- [ ] No rounded corners on any card, panel, or container
- [ ] Only `rounded-sm` on StatusBadge pills is acceptable
- [ ] All card/container edges appear sharp (square corners)
- [ ] Consistent across all pages

**Result:** ___

---

### Test 1.2 — Chart Migration (CSS Flex Bars)

**Steps:**
1. Navigate to Analytics or any chart-heavy page
2. Inspect bar charts visually
3. Hover over individual bars

**Expected:**
- [ ] Bar charts render as proportional CSS flex divs (not SVG)
- [ ] Bars use color from `--chart-bar` token
- [ ] Hovering a bar shows a label:value tooltip
- [ ] No Recharts SVG elements in DOM
- [ ] No empty states or placeholders where charts should be

**Result:** ___

---

### Test 1.3 — Sidebar Collapse Behavior

**Steps:**
1. Find the sidebar collapse toggle button
2. Click to collapse
3. Hover over any nav icon in collapsed state
4. Click toggle again to expand

**Expected:**
- [ ] Sidebar collapses to icon-only width (~48px)
- [ ] Icons remain visible in collapsed state
- [ ] Hovering any icon shows a Tooltip with the nav item label
- [ ] No text labels visible when collapsed
- [ ] Expanding restores full 240px sidebar with labels

**Result:** ___

---

### Test 1.4 — Icon Audit

**Steps:**
1. With sidebar expanded, scan all nav items top to bottom
2. Collapse sidebar and scan again

**Expected:**
- [ ] Every nav item shows a recognizable Lucide icon at consistent size
- [ ] No ASCII characters used as icons
- [ ] All items present: Dashboard, Analytics, Agents, Executions, Build, Automation, Infrastructure, Security, Self-Healing, Memory, Capabilities, Briefings, Alerts, Profiles, Settings
- [ ] Icons render correctly in both expanded and collapsed states

**Result:** ___

---

## Phase 2: Bidirectional Telemetry

> 2/9 previously passed (sidebar footer indicator + disconnected state). 7 pending.
> Tests 2.1–2.3 require Astridr **running**. Tests 2.4–2.7 already passed or are visual checks.

### Test 2.1 — Dashboard widgets update within 1s of Astridr events

**Steps:**
1. Start Astridr (`docker compose up --build -d` in astridr-repo)
2. Open Dashboard page
3. Trigger an agent action (send a message via Telegram/Slack)
4. Watch the hero stat cards

**Expected:**
- [ ] Dashboard hero stat cards update within 1 second of event emission
- [ ] No page refresh needed

**Result:** ___

---

### Test 2.2 — Critical events arrive within 500ms

**Steps:**
1. With Astridr running, navigate to Security page
2. Trigger a security-relevant event (e.g. a tool call that hits HITL)
3. Time the appearance

**Expected:**
- [ ] Security/SelfHealing pages show the event within 500ms of emission
- [ ] Event appears without polling delay

**Result:** ___

---

### Test 2.3 — Live run transcript streams without batching delay

**Steps:**
1. Navigate to LiveRun page
2. Trigger an agent run
3. Watch transcript lines appear

**Expected:**
- [ ] Transcript lines stream in real-time
- [ ] No visible batching or chunking delay
- [ ] Lines appear individually as they're emitted

**Result:** ___

---

### Test 2.4 — Sidebar footer status indicator

**Previously passed** (2026-04-13): Popover opens with all fields: URL, Status, Uptime, Latency, Topics, Last event. Reconnect button present.

**Re-verify:** ___

---

### Test 2.5 — Header status indicator

**Steps:**
1. Look near the E-Stop button in the header bar

**Expected:**
- [ ] Small colored status dot visible
- [ ] Green when connected, red/salmon when disconnected

**Result:** ___

---

### Test 2.6 — Collapsed sidebar behavior

**Steps:**
1. Collapse the sidebar
2. Look at the status indicator area

**Expected:**
- [ ] Status shows as dot-only (no text)
- [ ] Hover shows tooltip with connection status

**Result:** ___

---

### Test 2.7 — Disconnected state

**Previously passed** (2026-04-13): Red dot visible, "Reconnecting..." shown during attempt, falls back to "Disconnected" when Astridr not running. Reconnect button functional.

**Re-verify:** ___

---

### Test 2.8 — Flash animation on WS events

**Steps:**
1. With Astridr running, navigate to Agents page
2. Trigger an event
3. Repeat on Security and Dashboard pages

**Expected:**
- [ ] Subtle pulse animation fires on incoming WS events
- [ ] Animation is visible but not distracting
- [ ] Works on multiple pages

**Result:** ___

---

### Test 2.9 — All 11 pages wired to WS events

**Steps:**
1. Navigate through each page while Astridr is active: Security, Executions, Agents, Dashboard, Infrastructure, SelfHealing, Chat, LiveRun, Inbox, Tasks, ConfigEditor

**Expected:**
- [ ] Each page responds to relevant WS events with flash animation
- [ ] No console errors on any page

**Result:** ___

---

## Phase 3: Interaction Layer

> 0/4 passed. All pending.
> Requires Astridr running for tests 3.1, 3.3, 3.4.

### Test 3.1 — Insights Chat LLM path

**Steps:**
1. Ensure OPENAI_API_KEY is set in Convex env
2. Navigate to Insights Chat page
3. Ask "What is my current total cost?"

**Expected:**
- [ ] Metric block appears with cost data
- [ ] LLM summary text accompanies the block
- [ ] Response uses Convex data (not hallucinated)

**Result:** ___

---

### Test 3.2 — Cmd+K live search filtering

**Steps:**
1. Press Cmd+K (or Ctrl+K on Windows)
2. Type an agent name
3. Select a result

**Expected:**
- [ ] Command palette opens
- [ ] cmdk filters items correctly with live Convex data
- [ ] Selecting a result navigates to the target page
- [ ] Escape closes the palette

**Result:** ___

---

### Test 3.3 — Live Run Widget streaming

**Steps:**
1. Trigger an agent run
2. Navigate to the LiveRun page
3. Watch the RunTimeline

**Expected:**
- [ ] Accordion rounds appear in RunTimeline
- [ ] Active round has amber stripe
- [ ] Stop button is visible and toggles correctly
- [ ] Tool calls nest inside rounds

**Result:** ___

---

### Test 3.4 — Approval Block in Agent Chat

**Steps:**
1. Trigger an action that requires HITL approval
2. Watch the Chat panel

**Expected:**
- [ ] Approve/reject buttons appear in ChatBubble
- [ ] Clicking one collapses the card to confirmation text
- [ ] Approval state persists (no re-prompt)

**Result:** ___

---

## Phase 4: Task Management

> 0/7 passed. All pending.
> Some tests require Astridr running (hot-reload, WS commands).

### Test 4.1 — Kanban drag-and-drop

**Steps:**
1. Navigate to Tasks page
2. Create a task if none exist
3. Drag a task between columns

**Expected:**
- [ ] Drag works smoothly between columns
- [ ] Dragging to running/cancelled shows 5-second confirmation toast
- [ ] Confirm/Cancel buttons on toast work
- [ ] Confirming fires WS command to Astridr

**Result:** ___

---

### Test 4.2 — Column collapse/expand

**Steps:**
1. Observe empty columns on the Kanban board

**Expected:**
- [ ] Empty columns auto-collapse to 40px strip with rotated label
- [ ] Hover expands them
- [ ] Adding a task auto-expands the column

**Result:** ___

---

### Test 4.3 — Config diff preview

**Steps:**
1. Navigate to Config Editor
2. Make a change to any config value
3. Click "Review Changes"

**Expected:**
- [ ] Inline LCS diff with green backgrounds for added lines
- [ ] Red backgrounds for removed lines
- [ ] Line numbers in gutter

**Result:** ___

---

### Test 4.4 — Hot-reload status transitions

**Steps:**
1. With Astridr connected, apply a config change

**Expected:**
- [ ] HotReloadBar cycles: pending -> validating -> applied -> confirmed
- [ ] Appropriate icons at each stage (Loader2 spinner, CheckCircle2, etc.)

**Result:** ___

---

### Test 4.5 — Cron Sheet and Builder

**Steps:**
1. Navigate to Automation/Cron page
2. Click to add/edit a cron job

**Expected:**
- [ ] Sheet slides in from right at 400px width
- [ ] Frequency dropdown presets generate correct cron expressions
- [ ] Human-readable preview updates live
- [ ] Save button disabled when name empty or expression invalid

**Result:** ___

---

### Test 4.6 — Cron Play spinner

**Steps:**
1. Click the play button on any cron job

**Expected:**
- [ ] Loader2 spinner shows for ~3 seconds then reverts to play icon
- [ ] WS dispatch fires on click

**Result:** ___

---

### Test 4.7 — Ideation bulk convert

**Steps:**
1. Navigate to Ideation findings
2. Select multiple findings via checkboxes
3. Click bulk convert

**Expected:**
- [ ] Multi-select checkboxes work
- [ ] Bulk convert creates tasks for all selected
- [ ] "Task linked" badges appear on converted findings
- [ ] Success toast fires

**Result:** ___

---

## Phase 5: Data Pipeline

> 0/4 passed. All pending.
> Backend-focused tests — check via browser Network tab and Convex dashboard.

### Test 5.1 — Cron produces aggregate rows

**Steps:**
1. Open Convex dashboard (or check via `npx convex run`)
2. Invoke `computeHourly` cron manually if needed

**Expected:**
- [ ] Rows appear in `aggregates` table
- [ ] Correct `metric_type`, `period`, `bucket_start`, and `value` fields

**Result:** ___

---

### Test 5.2 — Archival marks old rows

**Steps:**
1. Insert a 31-day-old event row (via Convex dashboard or mutation)
2. Invoke `markStaleArchived`

**Expected:**
- [ ] Row has `archived=true` after invocation
- [ ] Archived rows don't appear in normal list queries

**Result:** ___

---

### Test 5.3 — Analytics page shows aggregate data

**Steps:**
1. Navigate to Analytics page
2. Open browser Network tab
3. Look at the Convex query calls

**Expected:**
- [ ] Queries hit `aggregates:costByPeriod` (not `llm:costByProvider`)
- [ ] Data renders correctly from aggregates

**Result:** ___

---

### Test 5.4 — Load More pagination

**Steps:**
1. Navigate to any list page with 25+ items (Events, Agents, etc.)
2. Scroll to bottom

**Expected:**
- [ ] Initial render shows 25 items
- [ ] "Load More" button appears at bottom
- [ ] Clicking appends next batch (no flicker, no duplicate)
- [ ] Works across Events, LLM, Sessions, Agents, Alerts, Executions, Security

**Result:** ___

---

## Phase 6: Alert Routing

> 0/7 passed. All pending.
> Tests 6.1–6.2 require Discord/Slack webhook URLs configured.

### Test 6.1 — Discord webhook delivery within 60 seconds

**Steps:**
1. Navigate to Settings > Notification Channels
2. Add a Discord webhook URL
3. Trigger an alert (or lower a threshold to trigger)

**Expected:**
- [ ] Discord embed appears within 60 seconds
- [ ] Correct severity color, rule name, timestamp
- [ ] Includes link back to CodePulse

**Result:** ___

---

### Test 6.2 — Slack webhook delivery within 60 seconds

**Steps:**
1. Add a Slack webhook URL in Settings
2. Trigger an alert

**Expected:**
- [ ] Slack Block Kit message appears within 60 seconds
- [ ] Correct formatting and severity

**Result:** ___

---

### Test 6.3 — Alert lifecycle actions

**Steps:**
1. Navigate to Alerts page
2. Find an active alert
3. Test Acknowledge, Mute, and Escalate buttons

**Expected:**
- [ ] Acknowledge: opacity-60 + badge
- [ ] Mute: opens popover with duration options
- [ ] Escalate: opens Create Task dialog with severity-mapped priority
- [ ] Escalated alert creates a Kanban task

**Result:** ___

---

### Test 6.4 — Per-severity delivery mode routing

**Steps:**
1. Set "warning" severity to "Digest" mode in Settings
2. Trigger a warning-level alert

**Expected:**
- [ ] No immediate Discord/Slack delivery
- [ ] Alert queued for hourly digest cron

**Result:** ___

---

### Test 6.5 — Unified Inbox alert items

**Steps:**
1. Navigate to Inbox page
2. Look for alert-type items

**Expected:**
- [ ] Active alerts appear with type "alert"
- [ ] Inline Acknowledge/Mute actions work from inbox

**Result:** ___

---

### Test 6.6 — Custom rule creation end-to-end

**Steps:**
1. Navigate to Alerts page
2. Click to create a new alert rule
3. Fill in threshold and conditions
4. Save

**Expected:**
- [ ] AlertRuleForm Sheet opens
- [ ] Rule persists after save
- [ ] Appears in CUSTOM RULES section

**Result:** ___

---

### Test 6.7 — Threshold override persistence

**Steps:**
1. Find a static rule on Alerts page
2. Override its threshold via inline input
3. Refresh the page

**Expected:**
- [ ] Override value persists after refresh
- [ ] Rule uses overridden value for evaluation

**Result:** ___

---

## Phase 7: Intelligence Layer

> 0/6 passed. All pending.
> Tests 7.1–7.2 require LLM provider configured (OpenAI or Anthropic).

### Test 7.1 — LLM session briefing generation

**Steps:**
1. Ensure an LLM provider is configured in Settings
2. Complete a session (or find a completed one)
3. Navigate to Briefings page

**Expected:**
- [ ] Completed session has a coherent briefing card
- [ ] Briefing includes summary, key decisions, anomalies
- [ ] Card is readable and well-formatted

**Result:** ___

---

### Test 7.2 — Daily digest generation

**Steps:**
1. Check Briefings page for daily digests
2. Or manually trigger the daily digest cron

**Expected:**
- [ ] Digest includes activity summary, spend data, ideation findings
- [ ] Past digests browsable from the Briefings page

**Result:** ___

---

### Test 7.3 — CostForecastPanel visual rendering

**Steps:**
1. Navigate to Analytics page
2. Look for the CostForecastPanel

**Expected:**
- [ ] Layout renders with sparkline and budget bar
- [ ] Uses real aggregate data (not placeholder)
- [ ] Budget threshold indicator visible

**Result:** ___

---

### Test 7.4 — Budget cap + LLM provider settings

**Steps:**
1. Navigate to Settings
2. Find budget cap and LLM provider sections
3. Save a value, then test remove

**Expected:**
- [ ] Save state transitions work correctly
- [ ] Remove Provider confirmation dialog functions
- [ ] Values persist after page refresh

**Result:** ___

---

### Test 7.5 — Memory Quality tab rendering

**Steps:**
1. Navigate to Memory page
2. Click the Quality tab

**Expected:**
- [ ] Tab navigation works
- [ ] Accordion toggles for quality sections
- [ ] Empty state displays correctly when no data
- [ ] Shows dedup rate, staleness, contradiction metrics when data exists

**Result:** ___

---

### Test 7.6 — AnomalyBadge on MetricCards

**Steps:**
1. Navigate to Analytics page
2. Look at MetricCards

**Expected:**
- [ ] Badge appears on cards when anomaly data exists
- [ ] Tooltip shows anomaly details on hover
- [ ] No badge when no anomalies (clean state)

**Result:** ___

---

## Phase 58: Infrastructure Layer

> 0/10 passed. All pending.
> Tests 58.1–58.3 with Astridr **disconnected**. Tests 58.4–58.7 **connected**. Tests 58.8–58.10 **toggle**.

### Test 58.1 — Page Layout and MetricCards (disconnected)

**Steps:**
1. Ensure Astridr is **not running**
2. Navigate to Capabilities page

**Expected:**
- [ ] MetricCard row shows 6 cards: MCP Servers, Plugins, Skills, Tools, Hooks, Commands
- [ ] Commands card displays 0
- [ ] Grid uses 7-column layout on large screens

**Result:** ___

---

### Test 58.2 — CommandCatalogPanel Error State (disconnected)

**Steps:**
1. Scroll to Commands section on Capabilities page

**Expected:**
- [ ] "COMMANDS" section heading visible
- [ ] Error message about connecting to Astridr
- [ ] No stale data, no spinner

**Result:** ___

---

### Test 58.3 — Search Input Placeholder

**Expected:**
- [ ] Placeholder text includes "commands" (e.g. "Search tools, skills, commands...")
- [ ] Clean Lucide search icon

**Result:** ___

---

### Test 58.4 — Loading State (connect Astridr)

**Steps:**
1. Start Astridr, watch Commands section

**Expected:**
- [ ] Spinning loader briefly while waiting for catalog
- [ ] No error during loading

**Result:** ___

---

### Test 58.5 — Ready State (commands loaded)

**Expected:**
- [ ] Commands MetricCard shows live count
- [ ] Commands grouped by category
- [ ] Category filter pills with "All (N)" first
- [ ] Pills use `rounded-sm` corners

**Result:** ___

---

### Test 58.6 — Accordion Expand/Collapse

**Steps:**
1. Click a command row, then a different one, then the expanded one

**Expected:**
- [ ] First click expands showing parameters, source, description
- [ ] Second click on different row: accordion behavior
- [ ] Third click collapses all

**Result:** ___

---

### Test 58.7 — Category Filter Pills

**Expected:**
- [ ] Clicking a category filters correctly
- [ ] Active pill highlighted
- [ ] Clicking again or "All" resets

**Result:** ___

---

### Test 58.8 — Search Filtering

**Expected:**
- [ ] Real-time filtering as you type
- [ ] Matches name, description, category, source
- [ ] Case-insensitive
- [ ] "No commands match" for zero results

**Result:** ___

---

### Test 58.9 — WebSocket Disconnect Transition

**Steps:**
1. With commands loaded, stop Astridr

**Expected:**
- [ ] MetricCard immediately shows 0
- [ ] Panel switches to error state
- [ ] No stale commands displayed

**Result:** ___

---

### Test 58.10 — WebSocket Reconnect Transition

**Steps:**
1. With error state, restart Astridr

**Expected:**
- [ ] Loading spinner appears briefly
- [ ] Commands repopulate
- [ ] MetricCard updates to live count

**Result:** ___

---

## Summary

| Phase | Tests | Previously Passed | Pending |
|-------|-------|-------------------|---------|
| 1 — UI Foundation | 4 | 0 | 4 |
| 2 — Bidirectional Telemetry | 9 | 2 | 7 |
| 3 — Interaction Layer | 4 | 0 | 4 |
| 4 — Task Management | 7 | 0 | 7 |
| 5 — Data Pipeline | 4 | 0 | 4 |
| 6 — Alert Routing | 7 | 0 | 7 |
| 7 — Intelligence Layer | 6 | 0 | 6 |
| 58 — Infrastructure Layer | 10 | 0 | 10 |
| **Total** | **51** | **2** | **49** |

## Recommended Test Order

1. **Phase 1** (UI Foundation) — visual checks, no Astridr needed
2. **Phase 58** (Infrastructure) — start disconnected, then connect Astridr
3. **Phase 2** (Bidirectional Telemetry) — keep Astridr running from 58
4. **Phase 5** (Data Pipeline) — backend checks via Network tab and Convex dashboard
5. **Phase 3** (Interaction Layer) — requires Astridr + LLM provider
6. **Phase 4** (Task Management) — drag-and-drop, config editor, cron builder
7. **Phase 6** (Alert Routing) — requires Discord/Slack webhook URLs
8. **Phase 7** (Intelligence Layer) — requires LLM provider + aggregate data

## Gaps

(populated after testing)

---

## After Testing

- Update results above (pass / issue per test)
- For any issues: describe what you saw in the Result field
- Close phases with `/gsd-verify-work <phase_number>`
