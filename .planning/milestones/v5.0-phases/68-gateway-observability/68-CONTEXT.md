# Phase 68: Gateway Observability - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

CodePulse surfaces gateway-specific operational data — task lifecycle, quota burndown, routing decisions, and per-provider performance comparison. Three new Convex tables (`gatewayTasks`, `gatewayQuotaSnapshots`, `routingDecisions`) plus four new UI widgets on the Analytics page. Rename "Claude Code Telemetry" section header to "Agent Telemetry".

</domain>

<decisions>
## Implementation Decisions

### Quota Visualization
- **D-01:** Linear progress bars stacked vertically in a new `GatewayQuotaPanel` component. Horizontal bars with provider name, percentage, and spend amount. Matches ProviderHealthPanel's existing bar pattern.
- **D-02:** Convex cron action polls gateway `/quota` endpoint every 5 minutes and writes to `gatewayQuotaSnapshots` table. Frontend reads via `useQuery` (reactive). Consistent with existing cron patterns (aggregates, archival).
- **D-03:** Only API-billed providers (claude-sdk, openrouter, anthropic_direct) show quota gauges. Subscription providers (claude-cli, codex, antigravity) get a simple "Unlimited" badge instead.
- **D-04:** Placement: after SDK Spend Cap gauge on Analytics page.
- **D-05:** Current snapshot only — no historical sparklines or burndown curves. History is stored in `gatewayQuotaSnapshots` for future use.
- **D-06:** Color thresholds match ProviderHealthPanel: <5% remaining = red (`bg-red-500`), <20% remaining = yellow (`bg-yellow-500`), else emerald (`bg-emerald-500`).

### Routing Decisions Display
- **D-07:** Sortable table with expandable rows. Columns: Task ID, Requested Provider, Selected Provider, Fallback Used, Timestamp. Click a row to expand and see per-provider score breakdown (quota, latency, cost sub-scores).
- **D-08:** Fallback rows (where `fallbackUsed=true`) get a yellow left-border accent to make routing failures easy to spot at a glance.
- **D-09:** Default page size of 25 rows with Load More pagination (reuse existing `LoadMoreButton` pattern from Phase 5).
- **D-10:** Routing decisions table lives on the Analytics page under the renamed "Agent Telemetry" section header (was "Claude Code Telemetry").

### Provider Comparison
- **D-11:** Grouped FlexBarChart showing 3 metrics per provider: success rate (%), average latency (ms), task count. Uses provider family color scheme (GPT=green, Gemini=purple, Claude=gold/cyan/emerald per Phase 67 D-09).
- **D-12:** Default time range: last 24 hours. No time range toggle in this phase.
- **D-13:** Hide providers with zero tasks in the time range — only show providers that had at least one task.

### CostTrendChart Per-Provider Lines
- **D-14:** Upgrade CostTrendChart to stacked FlexBarChart with colored segments per provider in each time bucket. No new chart library — extends existing FlexBarChart.
- **D-15:** Extend `FlexBarChart` component with native stacking support via an optional `segments` prop. Data shape: `{ label, segments: [{ value, color, label }] }`. This makes stacking reusable for other charts.
- **D-16:** New Convex query `aggregates.costByPeriodByProvider` returns time-bucketed costs grouped by provider. Backend does the grouping, frontend just renders.
- **D-17:** Cost trend shows API-billed spend only, matching Phase 67 D-01 subscription/API split philosophy. Subscription providers have $0 cost and are excluded.

### Claude's Discretion
- Exact schema shape of `gatewayTasks`, `gatewayQuotaSnapshots`, and `routingDecisions` tables — follow field names from ROADMAP scope section
- GatewayTasksPanel design (sortable/filterable recent tasks) — not discussed in detail, Claude picks appropriate table pattern
- `LlmProviderPanel` grouped by provider then model — extend existing LlmAnalyticsPanel or create new component based on code inspection
- CostBreakdown provider dimension — extend existing cost queries with provider grouping
- Test structure and Wave 0 stub design

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` §Phase 68 — Goal, success criteria, scope (new tables, widgets, rename)
- `.planning/REQUIREMENTS.md` — GW-08 through GW-11 referenced but not yet catalogued (documentation gap noted in Phase 66 verification)
- `.planning/PROJECT.md` — Core value, stack, constraints

### Prior Phase Context (Gateway Integration)
- `.planning/phases/66-gateway-compatibility/66-RESEARCH.md` — Provider registry pattern, OTel routing, CLIGatewayTool emission
- `.planning/phases/67-multi-provider-pricing-intelligence/67-RESEARCH.md` — Billing type handling, cost split view, provider colors
- `.planning/phases/66-gateway-compatibility/66-VERIFICATION.md` — GW-01..04 verification results
- `.planning/phases/67-multi-provider-pricing-intelligence/67-VERIFICATION.md` — GW-05..07 verification results

### Key Source Files
- `src/lib/providers.ts` — Frontend provider registry (ALL_PROVIDERS, PROVIDER_BILLING, display names)
- `convex/lib/providers.ts` — Backend provider registry (mirror)
- `src/components/ProviderHealthPanel.tsx` — Existing provider card pattern with quota bars
- `src/components/CostTrendChart.tsx` — Current implementation to upgrade with stacking
- `src/components/FlexBarChart.tsx` — Chart component to extend with `segments` prop
- `src/pages/Analytics.tsx` — Page where all new widgets are placed
- `convex/otelLogs.ts:279` — Comment: "Phase 68 adds routingDecisions table"

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FlexBarChart` component: CSS-based bar chart, will be extended with stacking support for CostTrendChart and ProviderComparisonChart
- `ProviderHealthPanel` + `ProviderCard`: Pattern for per-provider cards with sparklines and quota bars — GatewayQuotaPanel follows same visual pattern
- `LoadMoreButton`: Cursor pagination component from Phase 5 — reuse for routing decisions table
- `SectionErrorBoundary`: Wraps all Analytics sections — use for new widgets
- `GlassPanel`: Container component for all Analytics widgets
- `SectionHeader`: Section divider — use for renamed "Agent Telemetry" header
- Provider registry (`src/lib/providers.ts`): ALL_PROVIDERS, PROVIDER_BILLING, PROVIDER_DISPLAY_NAMES — drive all widget provider lists
- Provider color families (Phase 67 D-09): GPT=green (#22c55e), Gemini=purple (#a855f7), Claude=gold/cyan/emerald

### Established Patterns
- Analytics page layout: GlassPanel wrapping each widget, SectionErrorBoundary for error isolation
- Convex cron pattern: cron registration + action + table write (aggregates, archival, briefings)
- `useCostOverTime` hook: Returns raw llmMetrics — CostTrendChart currently uses this, will switch to new aggregate query
- Provider-aware queries: `aggregates.costByPeriod` already accepts optional `billingType` filter

### Integration Points
- Analytics page (`src/pages/Analytics.tsx`): Insert GatewayQuotaPanel after SDKSpendCapGauge, rename "Claude Code Telemetry" → "Agent Telemetry", add new widgets in that section
- Convex schema: 3 new tables (gatewayTasks, gatewayQuotaSnapshots, routingDecisions)
- Convex cron: New quota polling action registration
- OTel routing (`convex/otelLogs.ts`): `routing_decision` events currently fall to generic events — redirect to new `routingDecisions` table

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 68-Gateway Observability*
*Context gathered: 2026-05-22*
