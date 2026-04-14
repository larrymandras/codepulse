# Phase 58: Infrastructure Layer - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Capabilities page displays a live command catalog received over WebSocket, showing all registered Ástríðr slash commands grouped by category with expand/collapse details, category filter pills, and integration with the page-level search. This is a cross-project phase — Ástríðr pushes `commands.catalog` events, CodePulse renders them.

</domain>

<decisions>
## Implementation Decisions

### Command Data Shape
- **D-01:** Keep current 5 core fields: name, description, category, parameters[], source. Covers what operators need without overloading the UI.
- **D-02:** Add optional `status?: "enabled" | "disabled" | "deprecated"` field to CommandEntry as forward-compatible. Ástríðr populates it when command lifecycle management is ready.
- **D-03:** Categories come directly from Ástríðr manifests — no CodePulse-side mapping or fixed category set. Whatever Ástríðr sends is what the UI shows.

### Catalog Presentation
- **D-04:** Grouped accordion layout — commands grouped by category headers, accordion expand per row, category filter pills above. Matches DiscoveredToolsTable pattern for consistency across the Capabilities page.
- **D-05:** Expanded detail shows full description, parameters table (name/type/required), and source manifest. No copy-to-clipboard or inline invoke.
- **D-06:** All Capabilities page sections (MCP Servers, Plugins, Skills, Tools, Commands) become collapsible with expand/collapse toggle.
- **D-07:** Collapse state is session-only (React state) — resets when navigating away from the page. No localStorage persistence.

### Connection State Handling
- **D-08:** On WebSocket disconnect, clear commands immediately and show error message. No caching of stale data. Aligns with Phase 2 decision D-05 (stale real-time data is worse than no data).
- **D-09:** Loading state uses indefinite spinner — no timeout or hint. The connection status indicator from Phase 2 already tells operators what's happening at the WebSocket level.

### Search & Filtering
- **D-10:** Per-panel filtering — single search input passes filter prop to each panel independently. No unified cross-entity ranked results.
- **D-11:** Combined intersection — search text AND active category pill both apply. Typing 'run' with 'core' selected shows only core commands matching 'run'.
- **D-12:** Dynamic search placeholder — auto-generated from mounted panels rather than hardcoded. As entity types are added or panels shown/hidden, placeholder updates accordingly.

### Claude's Discretion
- Collapsible section component API design and chevron/toggle placement
- Dynamic placeholder implementation (derive from panel refs vs static registry)
- Category pill color assignments (whether categories get distinct dot colors or use a single muted color)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### WebSocket Infrastructure
- `src/contexts/AstridrWSContext.tsx` — Singleton WebSocket provider with subscribe/subscribeEvent/sendCommand API, topic mapping, auto-reconnect
- `src/hooks/useCommandCatalog.ts` — WebSocket catalog subscription hook (existing implementation, reference for pattern)

### UI Components
- `src/components/CommandCatalogPanel.tsx` — Grouped/expandable command list panel (existing implementation)
- `src/components/DiscoveredToolsTable.tsx` — Structural reference for grouped list with filter pills (consistency target)
- `src/pages/Capabilities.tsx` — Integration point for all panels, search input, MetricCard grid

### Type Definitions
- `src/types/commands.ts` — CommandEntry interface (needs status field addition per D-02)

### Phase 58 UI Spec
- `.planning/phases/58-infrastructure-layer/58-UI-SPEC.md` — Interaction contracts, copywriting, anti-patterns

### Prior Phase Decisions
- Phase 1 CONTEXT.md — Paperclip design language, oklch palette, `--radius: 0`, EntityRow pattern
- Phase 2 CONTEXT.md — WebSocket-first for live data, clear state on disconnect (D-05), connection status indicator placement

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CommandCatalogPanel` (273 lines) — fully implemented grouped accordion with category pills, search filter, loading/error/empty states
- `useCommandCatalog` (93 lines) — WebSocket subscription hook with connection state handling
- `CommandEntry` type — 5-field interface in `src/types/commands.ts`
- `DiscoveredToolsTable` — reference pattern for grouped list with filter pills (consistency anchor)

### Established Patterns
- WebSocket event subscription via `subscribeEvent("commands.catalog", callback)` with runtime array validation
- Accordion expand/collapse with single-expanded state (expandedName)
- Category filter pills with "All (N)" as first pill, `rounded-sm` styling
- Per-panel filter prop pattern — parent passes filter string, panel handles matching internally

### Integration Points
- `src/pages/Capabilities.tsx` — already imports and renders CommandCatalogPanel after DiscoveredToolsTable
- MetricCard grid — Commands card shows `catalogCommands.length` from WebSocket hook
- Search input — currently hardcoded `"Search tools, skills, commands..."` placeholder (needs dynamic generation per D-12)

</code_context>

<specifics>
## Specific Ideas

- Collapsible sections (D-06) are a new pattern not yet in the codebase — all Capabilities sections currently render unconditionally
- Dynamic search placeholder (D-12) is a new UX pattern — current implementation uses a static string
- Forward-compatible status field (D-02) — add to type now, UI rendering deferred until Ástríðr populates it

</specifics>

<deferred>
## Deferred Ideas

- **Copy-to-clipboard for command names** — quick copy of slash command string for use in Ástríðr. Small UX win, own phase.
- **Inline command invocation** — execute commands directly from the catalog via WebSocket. Turns catalog into an execution surface. Significant scope — own phase.
- **Usage stats per command** — invocation count, last-used, success rate. Requires Ástríðr-side tracking. Future enhancement.
- **Unified cross-entity search** — combined ranked results across tools, skills, commands. More powerful but complex. Future Capabilities page enhancement.

</deferred>

---

*Phase: 58-infrastructure-layer*
*Context gathered: 2026-04-14*
