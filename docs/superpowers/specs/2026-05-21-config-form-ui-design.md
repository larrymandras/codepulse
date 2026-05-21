# Config Page Form UI Redesign

## Summary

Replace the raw YAML editor on the CodePulse Config page with a form-based settings UI optimized for scanning and quick edits. Hand-crafted forms for the two most-used sections (security-rules, agent-types); enhanced YAML editor for the remaining three (tools, profiles, pipes). Raw YAML toggle preserved on all sections as an escape hatch for structural edits.

## Context

- **Primary use**: read/monitor — glance at the page and understand current config state
- **Secondary use**: quick manual tweaks (flip a toggle, change a budget) without round-tripping through Claude Code
- **Escape hatch**: raw YAML editor for deep structural edits (adding new agents, rewriting rules)
- **No backend changes** — the form serializes to the same YAML dict and sends the same `config.get` / `config.update` WebSocket commands

## Page Layout & Navigation

### Current
- Single `<select>` dropdown to pick a section
- Full-page CodeMirror YAML editor below

### New
- **Left sidebar tabs** using shadcn Tabs (vertical variant), one tab per section:
  - Security (shield icon)
  - Agents (bot icon)
  - Tools (wrench icon)
  - Profiles (user icon)
  - Pipes (git-branch icon)
- **Tab content area** fills remaining width
- **Header bar** (carried forward): section title, Validate button, Apply button, WS status indicator
- **Raw YAML toggle** button in the header — flips the active section between form view and CodeMirror editor. Form and YAML stay in sync: switching to raw shows the current form state as YAML; switching back parses YAML into form fields.
- **Existing behaviors preserved**: hot-reload status bar, revert-to-saved, diff panel, validation result strip, apply confirmation strip

### Data Flow (unchanged)
1. On tab select → `sendCommand({ type: "config.get", section })` → receive YAML string
2. Parse YAML into typed state for form rendering
3. On any field change → mark dirty, invalidate previous validation
4. Validate → `sendCommand({ type: "config.update", section, changes, dry_run: true })`
5. Apply → `sendCommand({ type: "config.update", section, changes, dry_run: false })`

The form sections serialize their state back to a plain JS object (same shape as `jsYaml.load()` output) before sending. No new WebSocket commands needed.

## Section 1: Security Rules (Form)

### Layout
Two cards stacked vertically inside a scroll area.

### Card 1: Core Security Layers
Toggle grid — one row per layer:

| Layer | Label | Control |
|-------|-------|---------|
| L1 | PII Filter | Switch |
| L3 | Injection Defense | Switch |
| L4 | Command Blocklist | Switch |
| L6 | Secret Scanner | Switch |
| L8 | Credential Access | Switch |
| L9 | Egress Control | Switch |
| L10 | RLS Enforcement | Switch |
| L12 | Output Filter | Switch |
| L13 | Audit Logging | Switch |
| L14 | HITL Gate | Switch |

Each row: layer badge (muted Badge), label text, Switch aligned right. Rows use alternating subtle background for scannability.

### Card 2: Advanced Settings
- **DM Pairing**: Switch + text showing dm_pairs_file path
- **Exfil Guard**: Switch
- **DLP**: Switch (reserved label shown muted)

### Threshold
- **Legal HITL Risk Threshold**: shadcn Slider (0–100) with numeric display beside it. Default 70.

### Protected Env Vars
- Tag chip row: each var as a Badge with × remove button
- Inline Input + Add button to append new vars

### Dirty tracking
Any Switch toggle, slider change, or tag add/remove marks the section dirty and enables Validate.

## Section 2: Agent Types (Form)

### Layout
Vertical stack of collapsible agent cards using shadcn Accordion (multiple open supported).

### Collapsed Card (scan-optimized)
Single row showing:
- **Agent name** (bold) + norse_meaning in muted text
- **Tier** badge: `command` (primary), `domain` (secondary), `shared` (outline)
- **Status** badge: green "active" or muted "inactive"
- **Model**: override value or "default" in muted text
- **Budget**: fraction as percentage (e.g., "35%")
- Chevron expand indicator

### Expanded Card
Grouped into collapsible sub-sections:

**Identity**
- Name: Input
- Description: Textarea (2 rows)
- Tier: Select dropdown (command / domain / shared)
- Active: Switch
- Norse meaning: Input (muted helper text)

**Limits**
- Model override: Input (placeholder "default")
- Budget fraction: Input (number, 0–1)
- Timeout (seconds): Input (number)
- Max rounds: Input (number)

**Tools & Channels**
- Tools enabled: tag chip array with wildcard support (e.g., `web_search`, `coding_agent`, `*`)
- Channels: tag chip array (slack, telegram, web, email, internal)
- Peer comm allowed: tag chip array (agent IDs)
- Kits: tag chip array
- Capabilities: tag chip array

**Autonomy Rules**
Inline editable table:
| Pattern | Level | Notify After |
|---------|-------|-------------|
| Input | Select (silent / draft_approval / always_ask / blocked) | Checkbox |
| [+ Add rule] button |

**Daily Rhythm**
Inline editable table:
| Time | Action | Channel | Days | Profile |
|------|--------|---------|------|---------|
| Input (HH:MM) | Input | Select | Input | Input |
| [+ Add entry] button |

**Memory** (read-only display)
- L1 index path
- L2 topics dir
- L3 logs dir

**Email** (conditional, only shown if fields present)
- Default layout: Input
- Signature name: Input
- Signature title: Input

### New Agent
"+ New Agent" button at top of the card list. Creates a new expanded card with empty fields and required field validation.

## Sections 3–5: Tools, Profiles, Pipes (YAML)

Same CodeMirror editor as today, placed inside the new tab layout. Minor enhancements:

- **Section description**: one-line muted text above the editor explaining what this section controls
  - Tools: "Built-in tools, optional tools, skill/plugin directories, and Claude Code settings"
  - Profiles: "Routing profiles, budget limits, channel mappings, and persona voice configuration"
  - Pipes: "Automation pipelines with triggers, steps, and approval gates"
- Same validate / apply / diff / revert workflow
- These sections are candidates for future form migration

## Component Architecture

### New Files
- `src/pages/ConfigPage.tsx` — new page component with tab layout, replaces ConfigEditor route
- `src/components/config/SecurityRulesForm.tsx` — security toggle grid + threshold + env vars
- `src/components/config/AgentTypesForm.tsx` — accordion card list for agents
- `src/components/config/YamlSection.tsx` — extracted YAML editor (reuse of current CodeMirror setup) with section description
- `src/components/config/TagChipInput.tsx` — reusable tag chip array with add/remove (used in both security and agents)
- `src/components/config/InlineTable.tsx` — reusable editable table rows with add/remove (used for autonomy rules and daily rhythm)

### Modified Files
- `src/App.tsx` — update route from ConfigEditor to ConfigPage
- `src/layouts/DashboardLayout.tsx` — no changes needed (nav item already points to /config)

### Removed Files
- `src/pages/ConfigEditor.tsx` — replaced by ConfigPage.tsx (logic moved/refactored into sub-components)

### Shared State
Each section component receives:
- `data: Record<string, unknown>` (parsed YAML object from server)
- `onChange: (updated: Record<string, unknown>) => void` (called on every field change with the full section object)

The parent ConfigPage owns:
- WebSocket interaction (load, validate, apply)
- Dirty tracking (compares current state to original via deep equality)
- YAML serialization (calls `jsYaml.dump()` on the current state object for validate/apply/raw toggle)

Section components are pure controlled form renderers — they receive data and call onChange. No internal dirty tracking or serialization.

### Raw YAML Toggle
When toggled to raw:
- Form component serializes current state → YAML string via `jsYaml.dump()`
- Passes to YamlSection component
When toggled back to form:
- YamlSection's current content → `jsYaml.load()` → form state
- If YAML is unparseable, show error toast and stay in raw mode

## Existing UI Components Used
- Tabs, Switch, Slider, Badge, Card, Accordion, Input, Textarea, Select, Button, Label, Separator, ScrollArea, Tooltip
- Form (react-hook-form) + zod for validation on agent types
- GlassPanel wrapper for cards
- HotReloadBar, WSStatusIndicator, DiffView (unchanged)
- lucide-react icons

## Testing
- Existing validate/apply WebSocket flow is unchanged — no new integration tests needed
- Form ↔ YAML round-trip: verify `jsYaml.dump(formState)` then `jsYaml.load()` produces identical object
- Dirty tracking: toggling a switch and reverting should return to clean state
- Raw toggle: switching form → raw → form should preserve all values

## Migration Path
Tools, Profiles, and Pipes remain as YAML editors. Each can be migrated to a form component independently in the future by:
1. Adding a TypeScript type matching the Pydantic model
2. Creating a section-specific form component
3. Registering it in ConfigPage's tab renderer

No coordination required — each section is independent.
