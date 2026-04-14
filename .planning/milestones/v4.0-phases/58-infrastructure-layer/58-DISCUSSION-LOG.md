# Phase 58: Infrastructure Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-14
**Phase:** 58-infrastructure-layer
**Areas discussed:** Command data shape, Catalog presentation, Connection state handling, Search & filtering scope

---

## Command data shape

| Option | Description | Selected |
|--------|-------------|----------|
| Current 5 fields | name, description, category, parameters, source. Covers operator needs. | ✓ |
| Add usage stats | Invocation count, last-used, success rate. Requires Ástríðr tracking. | |
| Add aliases & examples | Command aliases and example invocations. Increases payload/density. | |

**User's choice:** Current 5 fields (Recommended)
**Notes:** Keep lean — current fields cover what operators need.

| Option | Description | Selected |
|--------|-------------|----------|
| Ástríðr-defined | Categories from manifest — whatever Ástríðr sends is displayed. | ✓ |
| CodePulse-mapped | Map to fixed UI categories. Requires maintenance. | |
| You decide | Claude's discretion. | |

**User's choice:** Ástríðr-defined (Recommended)
**Notes:** No CodePulse-side mapping needed.

| Option | Description | Selected |
|--------|-------------|----------|
| Not now | Add status when Ástríðr supports lifecycle management. | |
| Add optional status field | Forward-compatible enabled/disabled/deprecated field. | ✓ |
| You decide | Claude's discretion. | |

**User's choice:** Add optional status field
**Notes:** Forward-compatible — Ástríðr populates when ready.

---

## Catalog presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Grouped accordion | Grouped by category, accordion expand, filter pills. Matches DiscoveredToolsTable. | ✓ |
| Flat sortable table | Single sortable/filterable table. Denser. | |
| Card grid | Responsive card grid. More visual, less dense. | |

**User's choice:** Grouped accordion (Recommended)
**Notes:** Consistency with existing DiscoveredToolsTable pattern.

| Option | Description | Selected |
|--------|-------------|----------|
| Current detail level | Full description, parameters table, source. | ✓ |
| Add copy-to-clipboard | Copy slash command string for quick use. | |
| Add inline invoke | Send command via WebSocket from catalog. | |

**User's choice:** Current detail level (Recommended)
**Notes:** Sufficient for operator understanding.

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed below tools | Commands always after Discovered Tools. | |
| Collapsible sections | All Capabilities sections become collapsible. | ✓ |
| You decide | Claude's discretion. | |

**User's choice:** Collapsible sections
**Notes:** All Capabilities page sections should be collapsible — new pattern.

| Option | Description | Selected |
|--------|-------------|----------|
| Session-only | Collapse state in React state, resets on navigation. | ✓ |
| localStorage persist | Remember collapse state across sessions. | |

**User's choice:** Session-only (Recommended)
**Notes:** Simple, no storage needed.

---

## Connection state handling

| Option | Description | Selected |
|--------|-------------|----------|
| Clear + error message | Current behavior: clear stale data, show error. Auto-reconnect handles recovery. | ✓ |
| Cache last-known with stale indicator | Keep last catalog dimmed with 'stale' banner. | |
| Manual retry button | Add reconnect button in error state. | |

**User's choice:** Clear + error message (Recommended)
**Notes:** Aligns with Phase 2 D-05: stale real-time data is worse than no data.

| Option | Description | Selected |
|--------|-------------|----------|
| Indefinite spinner | Keep spinning until catalog arrives or WS disconnects. | ✓ |
| Timeout with hint | After 10-15s, show context hint alongside spinner. | |
| You decide | Claude's discretion. | |

**User's choice:** Indefinite spinner (Recommended)
**Notes:** WS status indicator from Phase 2 provides connection-level context.

---

## Search & filtering scope

| Option | Description | Selected |
|--------|-------------|----------|
| Per-panel filtering | Single search passes filter to each panel independently. | ✓ |
| Unified ranked results | Combined ranked results across all entity types. | |
| You decide | Claude's discretion. | |

**User's choice:** Per-panel filtering (Recommended)
**Notes:** Already works, simple.

| Option | Description | Selected |
|--------|-------------|----------|
| Combined intersection | Search text AND category pill both apply. | ✓ |
| Independent filters | Category pills ignore search text and vice versa. | |
| You decide | Claude's discretion. | |

**User's choice:** Combined intersection (Recommended)
**Notes:** Current implementation already does this.

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed text | Keep static 'Search tools, skills, commands...' string. | |
| Dynamic from panels | Auto-generate placeholder from mounted panels. | ✓ |

**User's choice:** Dynamic from panels
**Notes:** Placeholder updates as entity types are added or panels shown/hidden.

---

## Claude's Discretion

- Collapsible section component API design and chevron/toggle placement
- Dynamic placeholder implementation approach
- Category pill color assignments

## Deferred Ideas

- Copy-to-clipboard for command names
- Inline command invocation from catalog
- Usage stats per command (requires Ástríðr tracking)
- Unified cross-entity search with ranked results
