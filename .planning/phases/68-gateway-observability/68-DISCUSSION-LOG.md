# Phase 68: Gateway Observability - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-22
**Phase:** 68-gateway-observability
**Areas discussed:** Quota visualization, Routing decisions display, Provider comparison layout, CostTrendChart per-provider lines

---

## Quota Visualization

### Q1: How should per-provider quota gauges be displayed?

| Option | Description | Selected |
|--------|-------------|----------|
| Radial gauges grid | Circular arc gauges in a grid, one per provider | |
| Linear progress bars | Horizontal progress bars stacked vertically, matches ProviderHealthPanel pattern | ✓ |
| Inline in ProviderHealthPanel | Extend existing ProviderHealthPanel cards with quota bar | |

**User's choice:** Linear progress bars
**Notes:** None

### Q2: Quota data refresh frequency

| Option | Description | Selected |
|--------|-------------|----------|
| Convex cron (5 min) | Action polls gateway /quota every 5 minutes, writes to gatewayQuotaSnapshots | ✓ |
| Convex cron (1 min) | More frequent, more writes | |
| You decide | Claude picks | |

**User's choice:** Convex cron (5 min)

### Q3: Should subscription providers show quota gauges?

| Option | Description | Selected |
|--------|-------------|----------|
| API-billed only | Only providers with spend limits get gauges; subscription gets "Unlimited" badge | ✓ |
| All providers | Show all providers with gauges, subscription ones show "No limit" | |
| You decide | Claude picks | |

**User's choice:** API-billed only

### Q4: Placement on Analytics page

| Option | Description | Selected |
|--------|-------------|----------|
| After SDK Spend Cap | Below SDKSpendCapGauge — both deal with resource limits | ✓ |
| In a new Gateway section | Under new "Gateway Operations" SectionHeader with all gateway widgets | |
| You decide | Claude picks | |

**User's choice:** After SDK Spend Cap

### Q5: Historical burndown vs current snapshot

| Option | Description | Selected |
|--------|-------------|----------|
| Current snapshot only | Live bars showing current remaining | ✓ |
| Mini sparklines | Inline sparklines showing last 24h burndown | |
| Both | Current bars plus separate area chart | |

**User's choice:** Current snapshot only

### Q6: Color thresholds

| Option | Description | Selected |
|--------|-------------|----------|
| Match existing | Same as ProviderHealthPanel: <5% red, <20% yellow, else emerald | ✓ |
| Custom thresholds | Different thresholds for quota burndown | |
| You decide | Claude picks | |

**User's choice:** Match existing

---

## Routing Decisions Display

### Q1: How should routing decisions be displayed?

| Option | Description | Selected |
|--------|-------------|----------|
| Sortable table with expandable rows | Table with Task/Req/Sel/Fallback/Time columns, expandable score breakdown | ✓ |
| Flat detailed table | All columns including scores visible inline | |
| You decide | Claude picks | |

**User's choice:** Sortable table with expandable rows

### Q2: Fallback row highlighting

| Option | Description | Selected |
|--------|-------------|----------|
| Yellow accent row | Subtle yellow left-border on fallback rows | ✓ |
| Badge only | "FALLBACK" badge in column | |
| You decide | Claude picks | |

**User's choice:** Yellow accent row

### Q3: Default page size

| Option | Description | Selected |
|--------|-------------|----------|
| Last 25 with Load More | 25 recent, LoadMoreButton for pagination | ✓ |
| Last 50 with Load More | 50 recent, same pagination | |
| You decide | Claude picks | |

**User's choice:** Last 25 with Load More

### Q4: Page location

| Option | Description | Selected |
|--------|-------------|----------|
| On Analytics, in Agent Telemetry section | Under renamed section header with other gateway widgets | ✓ |
| Separate Gateway page | New sidebar nav item with dedicated page | |
| You decide | Claude picks | |

**User's choice:** On Analytics, in Agent Telemetry section

---

## Provider Comparison Layout

### Q1: Visualization type

| Option | Description | Selected |
|--------|-------------|----------|
| Grouped bar chart | FlexBarChart with 3 metrics per provider, provider color families | ✓ |
| Comparison table | Table with providers as rows, metrics as columns | |
| Radar/spider chart | Multi-axis radar with colored polygons per provider | |

**User's choice:** Grouped bar chart

### Q2: Default time range

| Option | Description | Selected |
|--------|-------------|----------|
| Last 24 hours | Today's operational picture, matches daily quota resets | ✓ |
| Last 7 days | Weekly view with more data points | |
| Configurable toggle | 24h/7d/30d toggle | |

**User's choice:** Last 24 hours

### Q3: Zero-task providers

| Option | Description | Selected |
|--------|-------------|----------|
| Hide inactive | Only show providers with ≥1 task in period | ✓ |
| Show all with zero bars | Show all 7 providers regardless | |
| You decide | Claude picks | |

**User's choice:** Hide inactive

---

## CostTrendChart Per-Provider Lines

### Q1: Chart type upgrade

| Option | Description | Selected |
|--------|-------------|----------|
| Stacked FlexBarChart | Keep FlexBarChart with stacked colored segments per provider | ✓ |
| Recharts multi-line | Replace with Recharts LineChart | |
| SVG area chart | Custom SVG stacked area chart | |

**User's choice:** Stacked FlexBarChart

### Q2: Stacking implementation

| Option | Description | Selected |
|--------|-------------|----------|
| Extend FlexBarChart | Add optional `segments` prop for native stacking support — reusable | ✓ |
| CostTrendChart only | Internal stacking, not reusable | |
| You decide | Claude picks | |

**User's choice:** Extend FlexBarChart

### Q3: Data source for provider grouping

| Option | Description | Selected |
|--------|-------------|----------|
| New Convex query | `aggregates.costByPeriodByProvider` — backend grouping | ✓ |
| Frontend grouping | Client-side grouping from existing hook | |
| You decide | Claude picks | |

**User's choice:** New Convex query

### Q4: Billing type filter

| Option | Description | Selected |
|--------|-------------|----------|
| API-billed only | Match Phase 67 D-01 split view — real money only | ✓ |
| All providers, zero included | Complete picture including subscription at $0 | |
| You decide | Claude picks | |

**User's choice:** API-billed only

---

## Claude's Discretion

- Exact schema shapes for gatewayTasks, gatewayQuotaSnapshots, routingDecisions tables
- GatewayTasksPanel design (sortable/filterable recent tasks table)
- LlmProviderPanel grouped by provider then model — implementation approach
- CostBreakdown provider dimension
- Test structure and Wave 0 stub design

## Deferred Ideas

None — discussion stayed within phase scope.
