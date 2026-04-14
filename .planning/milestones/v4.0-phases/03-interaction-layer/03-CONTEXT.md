# Phase 3: Interaction Layer - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

CodePulse becomes a command center — operators can search everything via Cmd+K, chat with agents using rich Generative UI Blocks, view structured live run transcripts, approve actions inline, and ask operational questions via an LLM-powered Insights Chat. This phase builds on the existing Chat, Inbox, and LiveRun pages from Phase 56 and the WebSocket infrastructure from Phase 2.

</domain>

<decisions>
## Implementation Decisions

### Command Palette
- **D-01:** Cmd+K opens a command palette (cmdk library) with search across ALL entity types: agents, sessions/executions, alerts & inbox items, cron jobs & automation
- **D-02:** Palette includes both search AND quick actions — search entities to navigate, plus actions like "Send task to agent", "Mute all alerts", "Navigate to page" (VS Code-style)
- **D-03:** Search results grouped by entity type with section headers (Agents, Sessions, Alerts, Cron Jobs) — not a flat ranked list or tabs

### Generative UI Blocks
- **D-04:** Agent Chat evolves from plain markdown ChatBubble to a block renderer supporting 5 block types: metric (renders MetricCard), table (sortable data table), chart (FlexBarChart), code/diff (syntax-highlighted), approval (inline action card with approve/reject)
- **D-05:** Approval requests from Ástríðr render as inline action cards in the chat flow with approve/reject buttons — matches existing InboxCard pattern, no modal or redirect
- **D-06:** Unknown/unrecognized block types fall back to rendering raw content as markdown — graceful degradation, always shows something

### Live Run Hierarchy
- **D-07:** RunTimeline restructured from flat block stream to nested accordion: Run > Rounds (collapsible sections) > Tool Calls (nested inside rounds). Completed rounds auto-collapse, active round stays expanded
- **D-08:** Flow tab uses React Flow (already a project dependency) to render a visual flowchart — nodes are tool calls, edges show data flow. Directed graph layout
- **D-09:** Stop button remains on the Live Run widget to cancel active runs

### Insights Chat
- **D-10:** Insights Chat is a separate dedicated page in the sidebar under INSIGHTS section — distinct from Agent Chat which sends tasks to Ástríðr
- **D-11:** Backend uses LLM with structured Convex tool calls (cost_summary, error_counts, session_list, etc.) — not raw query generation. Structured, auditable, no raw DB access
- **D-12:** Insights Chat responses use the same Generative UI Block renderer as Agent Chat — "What's the error rate?" returns a MetricCard block. Shared renderer, consistent UX

### Inbox Enhancements
- **D-13:** Inbox page (already exists from Phase 56) gets keyboard navigation added — arrow keys for item focus, Enter to expand, keyboard shortcuts for approve/reject

### Claude's Discretion
- cmdk library choice and configuration details
- Command palette result ranking algorithm and search index approach
- Generative UI Block wire protocol (JSON schema for block messages from Ástríðr)
- Block renderer component architecture (single dispatcher vs registry pattern)
- Insights Chat LLM provider and model selection
- Convex tool set for Insights Chat (which queries to expose as tools)
- Keyboard shortcut specifics for Inbox navigation
- React Flow layout algorithm for Flow tab
- Round auto-collapse threshold and animation

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Interaction Pages (Phase 56 — build on these)
- `src/pages/Chat.tsx` — Agent Chat page with WebSocket send/receive, streaming, markdown rendering
- `src/pages/Inbox.tsx` — Unified Inbox with approvals, alerts, notifications, filter bar
- `src/pages/LiveRun.tsx` — Live Run page with block streaming, history replay
- `src/components/ChatBubble.tsx` — Chat message bubble with markdown support (will be extended with block rendering)
- `src/components/ChatInput.tsx` — Chat input component
- `src/components/InboxCard.tsx` — Inbox item card with approve/reject actions (reference for approval block)
- `src/components/InboxFilterBar.tsx` — Inbox filter bar component
- `src/components/RunTimeline.tsx` — Flat block timeline (will be restructured to nested accordion)
- `src/components/RunBlock.tsx` — Individual run block renderer
- `src/components/RunHistorySelector.tsx` — Run history dropdown

### WebSocket Infrastructure (Phase 2)
- `src/contexts/AstridrWSContext.tsx` — WebSocket singleton with subscribe/subscribeEvent/sendCommand API
- `src/hooks/useLiveState.ts` — Transient operational state hook
- `src/hooks/useLiveFlash.ts` — Pulse animation on live updates
- `src/hooks/useCommandCatalog.ts` — Reference pattern for WebSocket event subscription
- `src/hooks/useCommandDispatch.ts` — Command dispatch pattern

### UI Foundation (Phase 1)
- `src/components/MetricCard.tsx` — MetricCard pattern (reuse for metric blocks in Generative UI)
- `src/index.css` — oklch token layer, animation keyframes
- `src/layouts/DashboardLayout.tsx` — Sidebar layout, nav items, route structure

### Project Context
- `.planning/PROJECT.md` — Project vision, cross-repo constraints, design reference
- `.planning/REQUIREMENTS.md` — IL-01 through IL-06 requirements
- `C:\Users\mandr\Mandras\04-research\paperclip-ui-patterns-2026-04-06.md` — Paperclip design patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ChatBubble` + `ChatInput`: Working chat UI — extend ChatBubble to dispatch to block renderer instead of always rendering markdown
- `InboxCard`: Approval card pattern with approve/reject actions — reuse as the approval block type in Generative UI
- `RunTimeline` + `RunBlock`: Working block stream — restructure RunTimeline to nested accordion, keep RunBlock as the leaf renderer
- `MetricCard`: Phase 1 component — reuse directly as the metric block renderer
- `FlexBarChart` (from Phase 1): Custom CSS flex chart — reuse as the chart block renderer
- `AstridrWSContext`: Full WebSocket infrastructure with topic subscriptions, command queue
- React Flow: Already a project dependency — reuse for Flow tab visualization

### Established Patterns
- WebSocket event subscription: `subscribeEvent(eventType, callback)` returns cleanup function
- Command sending: `sendCommand({action, ...})` returns Promise<AckResponse>
- Phase 1 design tokens: oklch palette, `--radius: 0`, Lucide icons, shadcn/ui New York
- Convex queries: `useQuery(api.tableName.queryName)` pattern throughout all pages
- SectionErrorBoundary wrapping per widget group

### Integration Points
- `DashboardLayout.tsx` sidebar nav: Add Insights Chat page route, Command Palette global shortcut
- `App.tsx` routes: Add Insights Chat route
- `AstridrWSContext`: Subscribe to new event types for chat blocks, run hierarchy events
- Convex backend: New queries needed for Insights Chat tool calls (cost_summary, error_counts, etc.)

</code_context>

<specifics>
## Specific Ideas

- Command Palette should feel like VS Code's Cmd+K — instant, keyboard-driven, search-as-you-type
- Generative UI Blocks should make the chat feel like a dashboard embedded in a conversation — metrics, tables, charts rendered natively, not as text
- The approval block in chat should look and behave identically to InboxCard — same approve/reject flow, same risk-level color stripe
- Live Run accordion should auto-collapse completed rounds so the active round is always visible during streaming
- Flow tab leverages React Flow which is already in the project — no new dependency needed
- Insights Chat is the "ask questions about your data" companion — distinct from Agent Chat which "tells Ástríðr to do things"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-interaction-layer*
*Context gathered: 2026-04-13*
