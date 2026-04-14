# Phase 3: Interaction Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 03-interaction-layer
**Areas discussed:** Command Palette, Generative UI Blocks, Live Run hierarchy, Insights Chat

---

## Command Palette

### Search Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Agents | Search agent names, jump to agent detail | ✓ |
| Sessions/Executions | Search by session ID or execution summary | ✓ |
| Alerts & Inbox items | Search active alerts, approval requests, notifications | ✓ |
| Cron jobs & Automation | Search cron job names, automation rules | ✓ |

**User's choice:** All four entity types selected
**Notes:** Full search scope across all operational entities

### Quick Actions

| Option | Description | Selected |
|--------|-------------|----------|
| Search + actions (Recommended) | Search entities AND quick actions like 'Send task to agent', 'Mute all alerts', 'Navigate to page'. VS Code-style. | ✓ |
| Search only | Pure search — find and navigate to entities | |
| Actions only when empty | Show quick actions when empty, switch to search when typing | |

**User's choice:** Search + actions
**Notes:** None

### Result Grouping

| Option | Description | Selected |
|--------|-------------|----------|
| By entity type (Recommended) | Grouped sections: Agents, Sessions, Alerts, Cron Jobs with section headers | ✓ |
| Flat ranked list | Single list ranked by relevance with type icon/badge | |
| Tabbed | Tabs across the top to filter by entity type | |

**User's choice:** By entity type
**Notes:** None

---

## Generative UI Blocks

### Block Types

| Option | Description | Selected |
|--------|-------------|----------|
| Metric block | Renders MetricCard inline for stats questions | ✓ |
| Table block | Sortable data table for list queries | ✓ |
| Chart block | FlexBarChart inline for breakdown questions | ✓ |
| Code/Diff block | Syntax-highlighted code or side-by-side diff | ✓ |

**User's choice:** All four block types selected (plus approval block as inline action card)
**Notes:** None

### Approval Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Inline action card (Recommended) | Approval block renders as card with approve/reject in chat flow | ✓ |
| Notification + redirect | Chat shows notification linking to Inbox page | |
| Modal overlay | Approval pops up as modal dialog | |

**User's choice:** Inline action card
**Notes:** Matches existing InboxCard pattern

### Fallback Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Render as markdown (Recommended) | Fall back to rendering raw content as markdown | ✓ |
| Show 'unsupported block' placeholder | Gray placeholder with block type name | |
| Hide unknown blocks | Skip rendering entirely | |

**User's choice:** Render as markdown
**Notes:** Graceful degradation

---

## Live Run Hierarchy

### Display Style

| Option | Description | Selected |
|--------|-------------|----------|
| Nested accordion (Recommended) | Rounds as collapsible sections, tool calls nested inside | ✓ |
| Indented timeline | Single vertical timeline with indentation levels | |
| Tree view | File-explorer-style tree with expand/collapse | |

**User's choice:** Nested accordion
**Notes:** Completed rounds auto-collapse, active round stays expanded

### Flow Tab

| Option | Description | Selected |
|--------|-------------|----------|
| Visual flowchart (Recommended) | React Flow directed graph with tool call nodes and data flow edges | ✓ |
| Sequence diagram | Vertical sequence diagram with agent and tools | |
| Summary stats only | No visualization, just stats panel | |

**User's choice:** Visual flowchart
**Notes:** Leverages existing React Flow dependency

---

## Insights Chat

### Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Separate page (Recommended) | Dedicated Insights page under INSIGHTS section in sidebar | ✓ |
| Tab in Agent Chat | Two tabs: Agent and Insights sharing same UI | |
| Slide-out panel | Global side panel accessible from any page | |

**User's choice:** Separate page
**Notes:** Distinct from Agent Chat which sends tasks

### Data Access

| Option | Description | Selected |
|--------|-------------|----------|
| LLM with Convex tool calls (Recommended) | LLM gets structured Convex query tools, calls them to answer | ✓ |
| LLM generates Convex queries | LLM writes raw Convex query code | |
| Pre-computed summaries only | LLM only accesses pre-aggregated summaries | |

**User's choice:** LLM with Convex tool calls
**Notes:** Structured, auditable, no raw DB access

### Response Format

| Option | Description | Selected |
|--------|-------------|----------|
| Same block system (Recommended) | Uses same Generative UI Block renderer as Agent Chat | ✓ |
| Text only with inline data | Narrative text with numbers inline | |
| Custom visualization | Separate specialized visualization components | |

**User's choice:** Same block system
**Notes:** Shared renderer, consistent UX

---

## Claude's Discretion

- cmdk library choice and configuration
- Command palette result ranking and search index
- Generative UI Block wire protocol (JSON schema)
- Block renderer component architecture
- Insights Chat LLM provider and model
- Convex tool set for Insights Chat
- Keyboard shortcut specifics for Inbox
- React Flow layout algorithm for Flow tab
- Round auto-collapse threshold and animation

## Deferred Ideas

None — discussion stayed within phase scope
