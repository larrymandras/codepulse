# HR Section & Agent Onboarding — Design Spec

**Date:** 2026-04-20
**Status:** Draft
**Scope:** CodePulse (frontend + Convex) + Ástríðr (API + war room dispatcher)

## Overview

A new top-level "Agents" section in CodePulse replacing the current Agents and Profiles pages. Provides a full agent management experience: browsing a catalog of archetypes, onboarding new agents through a guided wizard, organizing agents into team presets, and launching war rooms with dynamic participant composition.

### Goals

1. Centralize all agent management in CodePulse — creation, configuration, monitoring, team composition
2. Enable new agent creation through a UI wizard that drives Ástríðr's existing agent factory pipeline
3. Replace the war room's hard-coded participant list with dynamic team-based composition
4. Move approval workflow from Telegram-only to CodePulse UI (Telegram remains as fallback)

### Non-Goals

- Replacing Ástríðr's `agent-types.yaml` as the canonical agent config store
- Building a visual war room interface in CodePulse (war room stays voice-based via LiveKit)
- Agent-to-agent communication management (peer_comm_allowed stays config-driven)

## Architecture

### Hybrid Data Ownership

**Convex (CodePulse) — UI State:**
- Wizard drafts (auto-saved per step)
- Team presets (names, descriptions, agent membership)
- Approval queue display (mirrored from Ástríðr telemetry)
- Roster view preferences (view mode, sort, filters)
- Existing tables unchanged: `agentProfiles`, `agents`, `avatars`, `agentCoordination`

**Ástríðr (Supabase + config files) — Source of Truth:**
- `agent-types.yaml` — canonical agent definitions (AgentTypeConfig)
- `AgentTypeRegistry` — runtime registry, hot-reloads on config change
- `catalog.db` — SQLite FTS5 index of agent archetypes
- `agent_approvals` table — approval request lifecycle
- `war_rooms` / `war_room_transcripts` tables — war room lifecycle

### Data Flow: Agent Onboarding

1. User fills wizard steps in CodePulse → auto-saves each step to Convex `wizardDrafts`
2. User clicks "Deploy" → CodePulse validates client-side, then `POST /api/agents` to Ástríðr
3. Ástríðr validates config (schema, tool availability)
   - Ephemeral → activate immediately via `EphemeralLifecycleManager`
   - Permanent → create approval request in `agent_approvals`
4. Ástríðr emits `agent_approval_requested` telemetry → Convex `approvalQueue` updated
5. User approves in CodePulse UI → `POST /api/approvals/:id/approve`
6. Ástríðr activates via `AgentOrchestrator`, updates `agent-types.yaml`, registers in `AgentTypeRegistry`
7. Ástríðr emits `agent_created` telemetry → Convex updates, agent appears in Roster

### Data Flow: War Room with Dynamic Teams

1. User selects team preset (or picks agents ad-hoc) → reads `agentIds[]` from Convex `teamPresets`
2. User clicks "Launch War Room" → `POST /api/war-room { participants: [...] }`
3. Ástríðr dispatcher creates LiveKit room, dispatches agents dynamically
4. Original 5 Norse agents use their dedicated subclasses; new agents use `DynamicWarRoomAgent`

## Navigation & Routes

### Sidebar Change

The current "Agents" and "Profiles" nav items under OVERVIEW are removed. A new "AGENTS" nav group is added between COMMAND and OVERVIEW:

```
COMMAND
  Chat, Live Run, Inbox, Tasks, Config
AGENTS          ← new group
  Roster        ← /hr/roster
  Catalog       ← /hr/catalog
  Onboarding    ← /hr/onboarding
  Teams         ← /hr/teams
OVERVIEW
  Dashboard, Capabilities, Analytics, ...
```

### Route Definitions

| Route | Page | Description |
|-------|------|-------------|
| `/hr/roster` | Roster | Agent directory with switchable views (org chart, cards, table) |
| `/hr/roster/:agentId` | Agent Detail | Full agent config, runtime, topology, security, activity |
| `/hr/catalog` | Catalog | Browse/search agent archetypes from Ástríðr catalog.db |
| `/hr/onboarding` | Onboarding Wizard | Step-through agent creation (redirects to catalog as step 1) |
| `/hr/onboarding/:catalogId` | Onboarding Wizard | Wizard pre-filled from selected template |
| `/hr/teams` | Teams | Team preset cards with "Launch War Room" actions |
| `/hr/teams/:teamId` | Team Editor | Drag-and-drop team composition |

**Backwards compatibility:** `/agents` redirects to `/hr/roster`, `/profiles` redirects to `/hr/roster`.

## Page Designs

### 1. Roster (`/hr/roster`)

**Header:** Agent count summary (total, active, pending, idle), "+ Onboard Agent" button, view switcher (org chart / cards / table), tier/status/profile filters, search.

**Approval Banner:** When pending approvals exist, an amber banner appears below the header with agent name, requested time, and inline Approve/Reject/Details buttons.

**View: Org Chart**
- React Flow hierarchical tree layout grouped by tier: command → domain → shared
- Nodes show avatar, name, role, status indicator
- Pending agents rendered with dashed borders and amber styling
- Click any node to open agent detail
- Built with React Flow (already in CodePulse)

**View: Card Grid**
- 4-column responsive grid of agent cards
- Each card: gradient header with profile image (or emoji avatar fallback), name, role, tier badge, status indicator
- When both profile image and emoji exist, image is primary with emoji overlay in corner
- Pending agents shown with dashed borders, amber name color, "pending approval" badge

**View: Table**
- Dense sortable columns: Agent (avatar + name + role), Tier, Status, Model, Budget, Tools count, Teams count, Profiles
- Multi-select checkboxes with bulk action bar: "Add to Team", "Launch War Room"
- Pending agents highlighted with amber row background

**View preferences** (selected view, sort, filters) persisted to Convex `rosterViewPrefs`.

### 2. Agent Detail (`/hr/roster/:agentId`)

Slide-out panel (default from card/table click) that can expand to full page. Shows agent profile image/avatar, name, role, tier, reporting chain, status badges. Edit Config and Deregister actions in header.

**Tabs:**
- **Config** — Full AgentTypeConfig view/edit (identity, personality, tools, autonomy, memory, scheduling)
- **Runtime** — Active sessions, current status, resource usage (migrated from old Agents page)
- **Topology** — Agent's position in coordination graph (migrated from old Agents page)
- **Security** — Security scan results (migrated from old Agents page)
- **Activity** — Recent coordination events, tool executions, war room participation history

### 3. Catalog (`/hr/catalog`)

Searchable grid of agent archetypes sourced from Ástríðr's `catalog.db` via `GET /api/catalog`.

- Full-text search bar + tier/domain/capability filters
- Archetype cards: emoji, name, description, tier badge, capability tags
- "Blank Agent" card always present for from-scratch builds
- Click card to preview full template details
- "Onboard This Agent" button → navigates to `/hr/onboarding/:catalogId`

### 4. Onboarding Wizard (`/hr/onboarding`)

5-step wizard with progress indicator. Template-first with "Advanced Options" toggle on every step. Auto-saves each step to Convex `wizardDrafts`.

**Step 1: Template Selection**
- Embedded catalog browser (same component as standalone Catalog page)
- Search + tier/domain filters
- Select a template or "Blank Agent"
- Pre-fills subsequent steps with template defaults

**Step 2: Identity**
- Core fields: Agent ID (lowercase, no spaces), Display Name, Tier (command/domain/shared), Description, Profiles (multi-select)
- Avatar section: Profile Image upload (drag-and-drop, file picker, crop/preview, stored in Convex file storage via `imageStorageId` on `avatars` table) + Emoji Avatar picker (emoji + color)
- Advanced toggle: `reports_to`, `channels`, `budget_fraction`, `timeout_seconds`, `max_rounds`

**Step 3: Personality**
- Three modes: From Template (pre-filled), Write Custom, Import File
- CodeMirror markdown editor with syntax highlighting (CodeMirror already in CodePulse)
- Word count indicator
- Advanced toggle: raw `system_prompt` override, custom `soul_variant_path`, memory paths (`l1_index`, `l2_topics_dir`, `l3_logs_dir`)

**Step 4: Tools & Capabilities**
- Two selection modes: Glob Patterns (chip input with live matched tools preview) or Individual Pick (checkbox list of all available tools)
- Matched tools preview grid showing which tools the patterns resolve to
- Advanced toggle: `autonomy_rules` (action pattern → level editor), `peer_comm_allowed` (agent multi-select), `daily_rhythm` (scheduled task builder)

**Step 5: Review & Deploy**
- Summary cards for each step with "Edit →" links back
- Full agent preview: avatar/image, name, role, tier, tools count, profile badges
- Deployment type selector: Permanent (requires approval, persists to YAML) or Ephemeral (immediate, runtime-only, auto-deregisters on TTL/completion)
- "View Raw Config" expandable showing generated AgentTypeConfig YAML
- Warning banner for permanent agents: "Requires approval before activation"
- Actions: Save Draft, Deploy Agent

On deploy: `POST /api/agents` with full AgentTypeConfig JSON body. Soul variant markdown sent as `soul_variant_content` field; Ástríðr writes it to `config/identity/agents/{id}.md`.

### 5. Teams (`/hr/teams`)

**Overview:** Grid of team preset cards, "+ New Team" button.

Each card shows:
- Team name and description/purpose
- Stacked avatar faces with overflow count (+N)
- Agent count badge
- "Launch War Room" button (red/warm accent — action-oriented)
- Edit button
- Usage stats: `lastUsedAt`, `warRoomCount`

**Team Editor (`/hr/teams/:teamId`):**
- Name and Purpose fields
- Dual-panel drag-and-drop: Available Agents (left, filterable) ⇄ Team Members (right)
- Uses @dnd-kit (already in CodePulse for agent profile sorting)
- Available agents show avatar, name, role, tier badge
- Team members show same with × remove button
- Actions: Delete Team, Cancel, Save Team

**War Room Launch (two paths):**

Path 1 — From Team Preset:
1. Click "Launch War Room" on team card
2. Optional: add/remove agents for this session only
3. Set topic/agenda (optional)
4. Launch → `POST /api/war-room { participants, topic, teamPresetId }`

Path 2 — Ad-hoc from Roster:
1. Multi-select agents in Roster table view
2. Bulk action bar: "Launch War Room with N agents"
3. Set topic/agenda (optional)
4. Optional: "Save as Team" before launching
5. Launch → `POST /api/war-room { participants, topic }`

## New Convex Tables

### wizardDrafts

```typescript
wizardDrafts: defineTable({
  catalogEntryId: v.optional(v.string()),
  currentStep: v.number(),                 // 1-5
  formData: v.object({
    identity: v.optional(v.any()),
    personality: v.optional(v.any()),
    tools: v.optional(v.any()),
    deployment: v.optional(v.any()),
  }),
  status: v.string(),                      // "draft" | "submitted" | "approved" | "rejected"
  createdAt: v.number(),
  updatedAt: v.number(),
})
```

### teamPresets

```typescript
teamPresets: defineTable({
  name: v.string(),
  description: v.optional(v.string()),
  agentIds: v.array(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
  createdBy: v.optional(v.string()),
  lastUsedAt: v.optional(v.number()),
  warRoomCount: v.optional(v.number()),
})
```

### approvalQueue

```typescript
approvalQueue: defineTable({
  requestId: v.string(),
  agentName: v.string(),
  agentId: v.string(),
  catalogEntryId: v.optional(v.string()),
  tier: v.string(),
  budgetFraction: v.optional(v.number()),
  status: v.string(),                      // "pending" | "approved" | "rejected" | "expired"
  configSnapshot: v.any(),                 // full AgentTypeConfig JSON
  requestedAt: v.number(),
  decidedAt: v.optional(v.number()),
  decidedBy: v.optional(v.string()),
})
```

### rosterViewPrefs

```typescript
rosterViewPrefs: defineTable({
  userId: v.optional(v.string()),
  viewMode: v.string(),                    // "chart" | "grid" | "table"
  sortBy: v.optional(v.string()),
  filters: v.optional(v.any()),
})
```

## New Ástríðr API Endpoints

All endpoints added to the existing FastAPI app. Prefix: `/api/`.

### Catalog

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/catalog` | List/search archetypes. Query params: `q` (FTS5 search), `tier`, `capability`. Returns array of catalog entries. |
| `GET` | `/api/catalog/:id` | Archetype detail with default AgentTypeConfig. |

### Agent Lifecycle

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/agents` | Create agent. Body: AgentTypeConfig JSON + `soul_variant_content` (markdown) + `ephemeral` (bool) + `ttl_seconds` (optional). Permanent → approval gate. Ephemeral → immediate activation. |
| `GET` | `/api/agents` | List all registered agents (registry snapshot). Returns array of AgentTypeConfig + runtime status. |
| `GET` | `/api/agents/:id` | Agent detail: config + runtime status + coordination history. |
| `PUT` | `/api/agents/:id` | Update agent config. Triggers config_watcher hot-reload. |
| `DELETE` | `/api/agents/:id` | Deregister agent. Removes from YAML (permanent) or registry (ephemeral). |
| `POST` | `/api/agents/:id/validate` | Validate config without creating. Returns validation errors or success. |

### Approvals

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/approvals` | List pending approvals. |
| `POST` | `/api/approvals/:id/approve` | Approve agent creation. Triggers `AgentOrchestrator` activation pipeline. |
| `POST` | `/api/approvals/:id/reject` | Reject agent creation. Updates status, emits telemetry. |

### War Room

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/war-room` | Create room. Body: `participants` (array of agent IDs, optional — defaults to original 5), `topic` (optional), `teamPresetId` (optional). |
| `DELETE` | `/api/war-room/:roomName` | Close room. |

## Ástríðr War Room Changes

### Dispatcher Update

Replace hard-coded `NORSE_AGENT_NAMES` with dynamic participant dispatch:

```python
DEFAULT_PARTICIPANTS = ["astridr", "hervor", "freya", "gondul", "ragnhildr"]

async def create_war_room(
    participants: list[str] | None = None,
    topic: str | None = None,
    ...
):
    agent_ids = participants or DEFAULT_PARTICIPANTS
    for agent_id in agent_ids:
        config = registry.get(agent_id)
        if config is None:
            raise ValueError(f"Agent {agent_id} not in registry")
        await dispatch_agent(room_name, agent_id, config)
```

Backwards compatible: no participants → original 5 Norse agents.

### DynamicWarRoomAgent

New class for agents created through the onboarding wizard:

```python
class DynamicWarRoomAgent(NorseAgent):
    """Loads personality from AgentTypeConfig at dispatch time.
    Works for any agent in the registry, not just original 5."""

    def __init__(self, config: AgentTypeConfig):
        self.persona_id = config.id
        self.system_prompt = load_soul_variant(config)
        self.display_name = config.name
```

Original 5 Norse agents retain their dedicated subclasses. `DynamicWarRoomAgent` is used for any newly onboarded agent. Dispatch logic checks if a dedicated subclass exists and falls back to `DynamicWarRoomAgent`.

## Telemetry Events

New events emitted by Ástríðr through the existing telemetry pipeline (Convex ingestion):

| Event | Trigger | Payload |
|-------|---------|---------|
| `agent_approval_requested` | Permanent agent creation submitted | `requestId`, `agentName`, `agentId`, `tier`, `configSnapshot` |
| `agent_approval_decided` | Approval approved or rejected | `requestId`, `agentId`, `status`, `decidedBy` |
| `agent_created` | Agent activated (permanent or ephemeral) | `agentId`, `name`, `tier`, `ephemeral`, `source: "ui"` |
| `agent_deregistered` | Agent removed | `agentId`, `reason` |
| `war_room_created` | War room launched | `roomName`, `participants`, `teamPresetId`, `topic` |

CodePulse's existing Convex HTTP ingestion handlers process these and update the relevant tables (`approvalQueue`, `agents`, etc.).

## Backwards Compatibility

This design is fully additive. No existing functionality breaks:

- **CodePulse Convex tables:** All new tables. Existing `agentProfiles`, `agents`, `avatars`, `agentCoordination` unchanged.
- **CodePulse routes:** `/agents` and `/profiles` redirect to `/hr/roster`. All other routes unchanged.
- **Ástríðr API:** New endpoints only. Existing `/ingest`, `/runtime-ingest`, `/scan`, `/health` unchanged.
- **Ástríðr config:** New agents appended to `agent-types.yaml`. Existing 10 agents untouched.
- **War room:** Dispatcher defaults to original 5 Norse agents when no participants specified. Existing dedicated agent subclasses retained.
- **Approval gate:** HTTP approval path added alongside existing Telegram flow. Telegram notifications still sent as fallback.
- **Telemetry pipeline:** New event types flow through existing Convex HTTP ingestion. No pipeline changes needed.

## Component Reuse

Existing CodePulse components leveraged:

| Component | Used In |
|-----------|---------|
| React Flow | Org chart view (already used for agent topology) |
| @dnd-kit | Team editor drag-and-drop (already used for agent profile sorting) |
| CodeMirror | Soul variant editor (already used in ConfigEditor) |
| AgentAvatar | All views — extended with profile image support |
| AgentDetailPanel | Agent detail — extended with Config/Activity tabs |
| shadcn/ui (Dialog, Form, Tabs, Table, Badge, Button) | All new pages |
| Sonner toasts | Success/error notifications |
| Recharts | Activity tab charts (optional) |

## New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `RosterPage` | `src/pages/hr/Roster.tsx` | View switcher + filters + approval banner |
| `RosterOrgChart` | `src/components/hr/RosterOrgChart.tsx` | React Flow org chart view |
| `RosterCardGrid` | `src/components/hr/RosterCardGrid.tsx` | Card grid view |
| `RosterTable` | `src/components/hr/RosterTable.tsx` | Table view with multi-select |
| `AgentCard` | `src/components/hr/AgentCard.tsx` | Individual agent card |
| `CatalogPage` | `src/pages/hr/Catalog.tsx` | Archetype browser |
| `CatalogBrowser` | `src/components/hr/CatalogBrowser.tsx` | Shared catalog component (page + wizard step 1) |
| `OnboardingWizard` | `src/pages/hr/Onboarding.tsx` | 5-step wizard shell |
| `WizardStepTemplate` | `src/components/hr/wizard/StepTemplate.tsx` | Step 1: template selection |
| `WizardStepIdentity` | `src/components/hr/wizard/StepIdentity.tsx` | Step 2: identity + image upload |
| `WizardStepPersonality` | `src/components/hr/wizard/StepPersonality.tsx` | Step 3: soul variant editor |
| `WizardStepTools` | `src/components/hr/wizard/StepTools.tsx` | Step 4: tool selection |
| `WizardStepReview` | `src/components/hr/wizard/StepReview.tsx` | Step 5: review + deploy |
| `TeamsPage` | `src/pages/hr/Teams.tsx` | Team preset cards |
| `TeamEditor` | `src/components/hr/TeamEditor.tsx` | Drag-and-drop team composition |
| `TeamCard` | `src/components/hr/TeamCard.tsx` | Team preset card |
| `ApprovalBanner` | `src/components/hr/ApprovalBanner.tsx` | Inline approval actions |
| `ProfileImageUpload` | `src/components/hr/ProfileImageUpload.tsx` | Image upload with crop/preview |
| `AdvancedToggle` | `src/components/hr/AdvancedToggle.tsx` | Collapsible advanced options |
| `WarRoomLaunchDialog` | `src/components/hr/WarRoomLaunchDialog.tsx` | Topic/agenda + agent tweaks before launch |

## New Convex Functions

| File | Functions |
|------|-----------|
| `convex/wizardDrafts.ts` | `save`, `get`, `list`, `remove` |
| `convex/teamPresets.ts` | `create`, `update`, `remove`, `list`, `get`, `incrementUsage` |
| `convex/approvalQueue.ts` | `upsert` (from telemetry), `list`, `get`, `updateStatus` |
| `convex/rosterViewPrefs.ts` | `save`, `get` |
| `convex/catalog.ts` | `search`, `getEntry` (proxy to Ástríðr API via httpAction) |

## New Ástríðr Files

| File | Purpose |
|------|---------|
| `astridr/api/catalog_routes.py` | FastAPI routes for catalog browse/search |
| `astridr/api/agent_routes.py` | FastAPI routes for agent CRUD + validation |
| `astridr/api/approval_routes.py` | FastAPI routes for approval actions |
| `astridr/api/war_room_routes.py` | FastAPI routes for dynamic war room creation |
| `astridr/channels/war_room/agents/dynamic_agent.py` | `DynamicWarRoomAgent` class |
