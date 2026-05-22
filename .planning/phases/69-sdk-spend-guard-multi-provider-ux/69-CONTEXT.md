# Phase 69: SDK Spend Guard & Multi-Provider UX - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Operator has full control and visibility over API-billed SDK usage, and the entire dashboard feels multi-provider-native. This is the polish/UX phase at the end of the gateway integration critical path (66→67→68→69). Deliverables: upgraded spend guard card with trend/projection, provider enable/disable + priority controls, provider badges on session views, 80% spend auto-alert, non-Claude agent profiles, routing table enhancements, and hook docs.

</domain>

<decisions>
## Implementation Decisions

### Spend Guard UX
- **D-01:** Replace existing `SDKSpendCapGauge` component with a richer `SDKSpendGuard` card in-place. One component, no duplicate spend displays.
- **D-02:** Card shows both an hourly spend sparkline (burn rate shape) AND a projected end-of-day total with visual indicator if it would exceed the $5 cap.
- **D-03:** Data comes from existing `costByPeriod` aggregate query with `billingType='api'` and hourly granularity. No new dedicated Convex query — projection is a client-side extrapolation from hourly buckets.

### Provider Controls
- **D-04:** Provider enable/disable sends a real command to Ástríðr's gateway (not just UI filtering). Tasks immediately stop routing to disabled providers.
- **D-05:** ProviderControls panel lives on the Settings page under a "Gateway Providers" section.
- **D-06:** Controls include per-provider enable/disable toggles + drag-to-reorder priority list. No force-route. Gateway respects the priority order when multiple providers are available.
- **D-07:** Provider config (enabled state, priority order) persisted in a Convex table. Gateway reads on startup + responds to live updates. Survives restarts.

### Session Provider Badges
- **D-08:** Colored pill badges using provider family colors (GPT=green, Gemini=purple, Claude=gold/cyan/emerald per Phase 67 D-09). Uses existing `Badge` component.
- **D-09:** Every tool call event on the session timeline shows a provider badge — always visible, not conditional on mixed-provider sessions.
- **D-10:** Session list page also shows a provider badge per row indicating the primary provider (most tool calls in that session).

### Auto-Alert & Seed Data
- **D-11:** 80% SDK spend auto-alert implemented as a system-created `alertRuleCustom` row. Visible in Alerts page, editable, can be muted/acknowledged. Integrates with existing Inbox/Discord/Slack delivery.
- **D-12:** Seed agent profiles for all 4 gateway providers: claude-cli, codex, antigravity, claude-sdk. Each with correct model names, provider name, and billing type.
- **D-13:** RoutingAuditTable = upgrade to existing `RoutingDecisionsTable` from Phase 68 with richer score breakdown, filtering, and audit-friendly columns. No separate table.

### Claude's Discretion
- Overshoot warning aggressiveness — pick based on existing alert/warning patterns in the codebase (inline vs toast)
- Exact sparkline rendering approach (inline SVG, Recharts Sparkline, or CSS)
- RoutingDecisionsTable specific upgrade details (columns, filters, expanded content)
- Hook system documentation format and content
- Test structure and Wave 0 stub design

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior Phase Context (Gateway Integration Chain)
- `.planning/phases/66-gateway-compatibility/CONTEXT.md` — Gateway data contracts, provider naming, cross-repo boundaries
- `.planning/phases/67-multi-provider-pricing-intelligence/67-CONTEXT.md` — Billing type handling, cost split, provider colors, subscription vs API decisions
- `.planning/phases/68-gateway-observability/68-CONTEXT.md` — Quota visualization, routing decisions table, provider comparison, CostTrendChart stacking

### Roadmap & Requirements
- `.planning/ROADMAP.md` §Phase 69 — Goal, success criteria, scope list
- `.planning/REQUIREMENTS.md` — GW-12, GW-13, GW-14

### Key Source Files — Spend Guard
- `src/components/SDKSpendCapGauge.tsx` — Component to replace. Has `DAILY_CAP`, `ALERT_THRESHOLD`, `classifyCapStatus()`. Keep export contract.
- `convex/aggregates.ts` — `costByPeriod` query with `billingType` filter parameter

### Key Source Files — Provider Controls
- `src/lib/providers.ts` — Frontend provider registry (ALL_PROVIDERS, PROVIDER_BILLING, PROVIDER_DISPLAY_NAMES)
- `convex/lib/providers.ts` — Backend provider registry (mirror)
- `src/pages/Settings.tsx` — Target page for ProviderControls panel
- `src/components/ProviderHealthPanel.tsx` — Visual pattern reference for provider cards

### Key Source Files — Session Badges
- `src/pages/SessionDetail.tsx` — Session detail page with timeline
- `src/components/SessionTimeline.tsx` — Timeline component for tool call events
- `src/pages/Sessions.tsx` (or equivalent session list) — Add provider badge to list rows

### Key Source Files — Alert & Seed
- `convex/schema.ts` — `alertRuleCustom` table definition
- `convex/agentProfiles.ts` — Agent profile CRUD mutations
- `convex/seedTeams.ts` — Existing seed data pattern
- `src/components/RoutingDecisionsTable.tsx` — Table to upgrade with audit features
- `src/hooks/useRoutingDecisions.ts` — Hook for routing decisions data

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SDKSpendCapGauge`: Already has gauge bar, 80% threshold marker, status classification. Upgrade in place — keep `classifyCapStatus()` export for tests.
- `RoutingDecisionsTable`: Phase 68 built expandable rows with score breakdown. Upgrade rather than rebuild.
- `Badge` component: shadcn/ui badge, used throughout. Use for provider pills with custom color classes.
- `FlexBarChart`: Extended in Phase 68 with `segments` prop. Could be used for sparkline or stick with inline approach.
- `LoadMoreButton`: Cursor pagination from Phase 5. Already used by RoutingDecisionsTable.
- Provider registries (`src/lib/providers.ts`, `convex/lib/providers.ts`): PROVIDER_BILLING, PROVIDER_DISPLAY_NAMES, provider color families.
- `GlassPanel`, `SectionErrorBoundary`, `SectionHeader`: Analytics page wrapper patterns.
- `@dnd-kit`: Already installed from Phase 4 Kanban. Reuse for provider priority drag-to-reorder.

### Established Patterns
- Settings page sections: Existing sections for Notification Channels, Notification Preferences, LLM Provider Config. New "Gateway Providers" section follows same pattern.
- Alert rule creation: `alertRuleCustom` table with `create` mutation. System-created rules use `source: "system"` field if it exists, or a convention to mark auto-created rules.
- Agent profile seeding: `convex/seedTeams.ts` shows existing seed pattern. Follow for gateway provider profiles.
- Provider color families: Phase 67 D-09 established GPT=green (#22c55e), Gemini=purple (#a855f7), Claude=gold/cyan/emerald.
- WebSocket commands: Phase 2 established command sender with optimistic UI and ack correlation. Provider enable/disable commands follow same pattern.

### Integration Points
- Settings page: Add ProviderControls panel section
- Analytics page: SDKSpendGuard replaces SDKSpendCapGauge in existing slot
- SessionDetail page: Add provider badge to timeline events
- Session list page: Add provider badge column/indicator
- Convex schema: New table for provider config persistence
- Gateway API: New enable/disable + priority endpoints (Ástríðr cross-repo)
- Alert system: Auto-create SDK spend alert rule on deploy/first-run

</code_context>

<specifics>
## Specific Ideas

- Analytics page spend guard should clearly communicate projected overshoot — "At current rate, you'll hit $5 by 3:00 PM" style messaging.
- Provider priority reordering should use @dnd-kit (already installed) for consistent drag UX with the Kanban board.
- Session list primary provider badge helps operators quickly spot which sessions used non-Claude providers.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 69-SDK Spend Guard & Multi-Provider UX*
*Context gathered: 2026-05-22*
