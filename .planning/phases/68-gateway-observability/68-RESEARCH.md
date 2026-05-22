# Phase 68: Gateway Observability - Research

**Researched:** 2026-05-22
**Domain:** Convex schema extension, cron actions, React component extension, sortable/paginated tables
**Confidence:** HIGH (all key files read from codebase; gateway `/quota` endpoint confirmed in Astridr)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Quota Visualization**
- D-01: Linear progress bars stacked vertically in a new `GatewayQuotaPanel` component. Horizontal bars with provider name, percentage, and spend amount. Matches ProviderHealthPanel's existing bar pattern.
- D-02: Convex cron action polls gateway `/quota` endpoint every 5 minutes and writes to `gatewayQuotaSnapshots` table. Frontend reads via `useQuery` (reactive). Consistent with existing cron patterns.
- D-03: Only API-billed providers (claude-sdk, openrouter, anthropic_direct) show quota gauges. Subscription providers (claude-cli, codex, antigravity) get a simple "Unlimited" badge instead.
- D-04: Placement: after SDK Spend Cap gauge on Analytics page.
- D-05: Current snapshot only — no historical sparklines or burndown curves. History is stored in `gatewayQuotaSnapshots` for future use.
- D-06: Color thresholds match ProviderHealthPanel: <5% remaining = `bg-red-500`, <20% remaining = `bg-yellow-500`, else `bg-emerald-500`.

**Routing Decisions Display**
- D-07: Sortable table with expandable rows. Columns: Task ID, Requested Provider, Selected Provider, Fallback Used, Timestamp. Click row to expand per-provider score breakdown.
- D-08: Fallback rows (`fallbackUsed=true`) get a yellow left-border accent (`border-l-2 border-yellow-500`).
- D-09: Default page size of 25 rows with Load More pagination (reuse existing `LoadMoreButton` from Phase 5).
- D-10: Routing decisions table lives on Analytics page under renamed "Agent Telemetry" section header (was "Claude Code Telemetry").

**Provider Comparison**
- D-11: Grouped FlexBarChart showing 3 metrics per provider: success rate (%), average latency (ms), task count. Provider family color scheme from Phase 67 D-09.
- D-12: Default time range: last 24 hours. No time range toggle in this phase.
- D-13: Hide providers with zero tasks in the time range.

**CostTrendChart Per-Provider Lines**
- D-14: Upgrade CostTrendChart to stacked FlexBarChart with colored segments per provider per time bucket.
- D-15: Extend `FlexBarChart` with optional `segments` prop: `{ label, segments: [{ value, color, label }] }`.
- D-16: New Convex query `aggregates.costByPeriodByProvider` returns time-bucketed costs grouped by provider.
- D-17: Cost trend shows API-billed spend only. Subscription providers ($0 cost) excluded.

### Claude's Discretion
- Exact schema shape of `gatewayTasks`, `gatewayQuotaSnapshots`, and `routingDecisions` tables — follow field names from ROADMAP scope section
- GatewayTasksPanel design (sortable/filterable recent tasks) — Claude picks appropriate table pattern
- `LlmProviderPanel` grouped by provider then model — extend existing LlmAnalyticsPanel or create new component based on code inspection
- CostBreakdown provider dimension — extend existing cost queries with provider grouping
- Test structure and Wave 0 stub design

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GW-08 | Quota gauges show live remaining capacity for each enabled provider | `gatewayQuotaSnapshots` table + cron poller + `GatewayQuotaPanel` component |
| GW-09 | Routing decisions table shows why each provider was selected (score breakdown) | `routingDecisions` table + OTel routing redirect + `RoutingDecisionsTable` component |
| GW-10 | Provider comparison chart shows relative performance across all active providers | `gatewayTasks` table + `ProviderComparisonChart` + `aggregates.providerStats` query |
| GW-11 | CostTrendChart shows separate trend lines per provider | `FlexBarChart` segments extension + `aggregates.costByPeriodByProvider` query + CostTrendChart upgrade |
</phase_requirements>

---

## Summary

Phase 68 is an additive phase: three new Convex tables, one new cron action, four new frontend components, two upgraded components, and one page-level wiring change. All patterns needed already exist in this codebase and can be followed precisely — no new libraries are required.

The most critical finding is that the gateway `/quota` endpoint is confirmed live in `gateway/gateway/app.py` (`GET /quota` returns `list[QuotaStatus]`). The `QuotaStatus` model fields map directly to the `gatewayQuotaSnapshots` table shape specified in the ROADMAP. The cron action must call this endpoint using `authHeaders()` from `src/lib/astridrApi.ts` (Bearer token auth, same pattern as all other Ástríðr API calls).

The second critical finding is the OTel routing redirect for `gateway.routing_decision` events. Line 279 of `convex/otelLogs.ts` is already marked with a comment "Phase 68 adds routingDecisions table" — the current fallback sends these events to the generic `events` table. The Phase 68 work replaces that `case` handler with a direct insert to the new `routingDecisions` table.

The `FlexBarChart` component is a simple CSS flex layout (33 lines). Adding the `segments` prop is a 15–20 line extension that adds a stacked-segment rendering path alongside the existing single-bar path. The existing `data: FlexBarSegment[]` interface is preserved as the non-segmented path; the new `segments` prop is additive.

`LlmProviderPanel` is a new component (not a rename of `LlmAnalyticsPanel`). The existing `LlmAnalyticsPanel` stays on the page — the new panel adds grouped-by-provider-then-model breakdown in the "Agent Telemetry" section.

All three shadcn components needed (Table, Collapsible, Badge) are already installed in `src/components/ui/`.

**Primary recommendation:** Four waves — Wave 0 (schema + cron + OTel redirect), Wave 1 (backend queries), Wave 2 (new UI components), Wave 3 (Analytics page wiring + CostTrendChart upgrade).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Quota data ingestion | Backend cron action (`convex/gatewayQuota.ts`) | Ástríðr gateway `/quota` endpoint | Polling happens server-side; no browser auth exposure |
| Quota display | Frontend component (`GatewayQuotaPanel`) | Backend query (`gatewayQuota.latestByProvider`) | Reactive `useQuery` subscription |
| Routing decision ingestion | Backend OTel handler (`convex/otelLogs.ts`) | New mutation (`convex/routingDecisions.ts`) | Events arrive via existing `/v1/logs` OTel pipeline |
| Routing decision display | Frontend component (`RoutingDecisionsTable`) | Backend paginated query | Table with cursor pagination + row expansion |
| Gateway task ingestion | Backend OTel handler (`convex/otelLogs.ts`) | New mutation (`convex/gatewayTasks.ts`) | Redirect existing gateway.task_* event handlers |
| Gateway task display | Frontend component (`GatewayTasksPanel`) | Backend paginated query | Sortable/filterable table with cursor pagination |
| Provider comparison stats | Backend query (`convex/gatewayTasks.ts`) | — | Aggregates success rate, latency, task count from `gatewayTasks` table |
| Provider comparison display | Frontend component (`ProviderComparisonChart`) | — | Grouped FlexBarChart using provider family colors |
| Cost-by-provider time series | Backend query (`convex/aggregates.ts`) | Existing `aggregates` table | New query reads existing rows; no schema change needed |
| Cost trend display | Frontend component (`CostTrendChart`) | — | Upgrade from single-bar to stacked FlexBarChart |
| FlexBarChart stacking | Frontend component (`FlexBarChart`) | — | additive `segments` prop extension |
| Analytics page wiring | Frontend page (`src/pages/Analytics.tsx`) | — | Insert new widgets, rename section header |

---

## Standard Stack

### Core (all already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Convex | existing | Database, queries, mutations, cron | Project standard; all tables live here |
| React 19 | existing | UI | Project standard |
| Tailwind CSS 4 | existing | Styling | Project standard — no new CSS |
| shadcn/ui | existing | Table, Collapsible, Badge components | All three already in `src/components/ui/` |
| Lucide React | existing | Icons | UI-08 requirement |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `convex/react` `usePaginatedQuery` | existing | Cursor pagination | GatewayTasksPanel, RoutingDecisionsTable — matches LoadMoreButton contract |
| `motion/react` | existing | GlassPanel entry animation | Already baked into GlassPanel; no direct usage needed |

**Installation:** No new packages needed.

---

## Architecture Patterns

### System Architecture Diagram

```
Ástríðr Gateway (localhost:8181)
  └─ GET /quota → list[QuotaStatus]
       └─ Convex cron (every 5min) ──► gatewayQuotaSnapshots table
                                            └─ useQuery(latestByProvider) ──► GatewayQuotaPanel

OTel pipeline (POST /v1/logs)
  └─ gateway.routing_decision event
       └─ otelLogs.ts case handler ──► routingDecisions table
                                            └─ usePaginatedQuery ──► RoutingDecisionsTable

  └─ gateway.task_started / _completed / _failed events
       └─ otelLogs.ts case handlers ──► gatewayTasks table
                                            └─ usePaginatedQuery ──► GatewayTasksPanel
                                            └─ query(providerStats 24h) ──► ProviderComparisonChart

aggregates table (existing, hourly cost rows with provider dimension)
  └─ costByPeriodByProvider query ──► CostTrendChart (stacked FlexBarChart)
```

### Recommended Project Structure

New files to create:
```
convex/
├── gatewayTasks.ts          # mutation (insert) + queries (paginated list, providerStats)
├── gatewayQuota.ts          # cron action (poll /quota) + query (latestByProvider)
├── routingDecisions.ts      # mutation (insert) + query (paginated list)

src/components/
├── GatewayQuotaPanel.tsx    # quota progress bars (API-billed) + UNLIMITED badges (subscription)
├── GatewayTasksPanel.tsx    # sortable/filterable paginated task table
├── RoutingDecisionsTable.tsx # sortable paginated table with expandable score rows
├── ProviderComparisonChart.tsx # grouped FlexBarChart (success rate, latency, task count)
├── LlmProviderPanel.tsx     # grouped-by-provider then model breakdown

src/hooks/
├── useGatewayTasks.ts       # usePaginatedQuery wrapper
├── useRoutingDecisions.ts   # usePaginatedQuery wrapper
```

Files modified:
```
convex/schema.ts             # +3 tables: gatewayTasks, gatewayQuotaSnapshots, routingDecisions
convex/crons.ts              # +1 cron: "poll-gateway-quota" every 5 minutes
convex/otelLogs.ts           # redirect gateway.routing_decision + gateway.task_* to new tables
convex/aggregates.ts         # +costByPeriodByProvider query
src/components/FlexBarChart.tsx   # +segments prop
src/components/CostTrendChart.tsx  # switch to costByPeriodByProvider + stacked rendering
src/pages/Analytics.tsx      # insert new widgets, rename section header
```

### Pattern 1: Convex Schema Table Definition

Follow the exact pattern of `llmMetrics` (most recent similar table). All new tables use `v.float64()` for timestamps (epoch seconds), `v.optional()` for nullable fields, and explicit indexes for every access pattern used by queries.

```typescript
// Source: convex/schema.ts — llmMetrics / gatewayTasks pattern
gatewayTasks: defineTable({
  taskId: v.string(),
  sessionId: v.optional(v.string()),
  provider: v.string(),
  billingType: v.optional(v.string()),   // "api" | "subscription"
  status: v.string(),                    // "pending" | "running" | "completed" | "failed"
  durationSeconds: v.optional(v.float64()),
  error: v.optional(v.string()),
  timestamp: v.float64(),
})
  .index("by_timestamp", ["timestamp"])
  .index("by_provider", ["provider", "timestamp"])
  .index("by_status", ["status", "timestamp"]),

gatewayQuotaSnapshots: defineTable({
  provider: v.string(),
  billingType: v.string(),               // "api" | "subscription"
  usedToday: v.float64(),
  dailyLimit: v.optional(v.float64()),
  spendUsd: v.float64(),
  spendCapUsd: v.optional(v.float64()),
  remainingPct: v.float64(),
  timestamp: v.float64(),
})
  .index("by_provider", ["provider", "timestamp"])
  .index("by_timestamp", ["timestamp"]),

routingDecisions: defineTable({
  taskId: v.string(),
  requestedProvider: v.string(),
  selectedProvider: v.string(),
  quotaScore: v.optional(v.float64()),
  latencyScore: v.optional(v.float64()),
  costScore: v.optional(v.float64()),
  finalScore: v.optional(v.float64()),
  fallbackUsed: v.boolean(),
  timestamp: v.float64(),
})
  .index("by_timestamp", ["timestamp"])
  .index("by_taskId", ["taskId"])
  .index("by_fallback", ["fallbackUsed", "timestamp"]),
```

### Pattern 2: Convex Cron Action (Polling)

The cron calls the Ástríðr API via `fetch` in an `internalAction`, then writes to the table via `ctx.runMutation`. This is the same pattern as `docker.pollHealth` (which runs every 5 minutes) — the only difference is this cron calls an external HTTP endpoint rather than doing an internal check.

```typescript
// Source: convex/crons.ts + convex/docker.ts — cron + internalMutation pattern
// In convex/crons.ts:
crons.interval(
  "poll-gateway-quota",
  { minutes: 5 },
  internal.gatewayQuota.pollAndStore
);

// In convex/gatewayQuota.ts:
export const pollAndStore = internalAction({
  args: {},
  handler: async (ctx) => {
    const apiBase = process.env.ASTRIDR_API_URL ?? "";
    const apiKey = process.env.ASTRIDR_API_KEY ?? "";
    const res = await fetch(`${apiBase}/quota`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
    if (!res.ok) return;
    const statuses: QuotaStatus[] = await res.json();
    const now = Date.now() / 1000;
    for (const s of statuses) {
      await ctx.runMutation(internal.gatewayQuota.insertSnapshot, {
        provider: s.provider,
        billingType: s.billing_type,
        usedToday: s.used_today,
        dailyLimit: s.daily_limit ?? undefined,
        spendUsd: s.spend_usd,
        spendCapUsd: s.spend_cap_usd ?? undefined,
        remainingPct: s.remaining_pct,
        timestamp: now,
      });
    }
  },
});
```

**Important:** Convex actions use `process.env` (not `import.meta.env`) for environment variables. The gateway URL and API key must be set as Convex environment variables (`npx convex env set`), NOT as `VITE_*` variables which are browser-only.

### Pattern 3: Paginated Query + Hook + LoadMoreButton

Canonical pattern — replicate from `convex/agents.ts` + `src/hooks/useAgentTopology.ts` + `src/pages/Briefings.tsx`:

```typescript
// Source: convex/agents.ts — listAllPaginated pattern
export const listPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
    provider: v.optional(v.string()),  // optional filter
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("gatewayTasks").withIndex("by_timestamp").order("desc");
    return await q.paginate(args.paginationOpts);
  },
});

// Source: src/hooks/useAgentTopology.ts — usePaginatedQuery hook wrapper
export function useGatewayTasksPaginated(initialNumItems = 25) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.gatewayTasks.listPaginated,
    {},
    { initialNumItems }
  );
  return { tasks: results, status, loadMore };
}

// Source: src/pages/Briefings.tsx — LoadMoreButton usage
<LoadMoreButton status={status} loadMore={loadMore} pageSize={25} />
```

`LoadMoreButton` renders nothing when `status === "Exhausted"` or `"LoadingFirstPage"` — no conditional wrapping needed in the parent.

### Pattern 4: OTel Routing Redirect (gateway.routing_decision)

Current code in `convex/otelLogs.ts:279` sends routing decisions to the generic `events` table. Replace with a direct insert to `routingDecisions`. Extract score sub-fields from the `attrsToObj` payload:

```typescript
// Source: convex/otelLogs.ts:278 — current routing_decision case (to be replaced)
case "gateway.routing_decision": {
  // BEFORE (Phase 66): falls to generic events table
  // AFTER (Phase 68): insert to routingDecisions table
  const taskId = getAttr(attrs, "task_id") ?? getAttr(attrs, "taskId") ?? sessionId;
  await ctx.runMutation(api.routingDecisions.insert, {
    taskId,
    requestedProvider: getAttr(attrs, "requested_provider") ?? "unknown",
    selectedProvider: getAttr(attrs, "selected_provider") ?? "unknown",
    quotaScore: getNumAttr(attrs, "quota_score"),
    latencyScore: getNumAttr(attrs, "latency_score"),
    costScore: getNumAttr(attrs, "cost_score"),
    finalScore: getNumAttr(attrs, "final_score"),
    fallbackUsed: getAttr(attrs, "fallback_used") === "true",
    timestamp,
  });
  break;
}
```

Also redirect the three existing `gateway.task_*` case handlers. Currently they write to `toolExecutions` as a workaround — Phase 68 replaces this with direct writes to `gatewayTasks`:

```typescript
// Source: convex/otelLogs.ts:236-276 — gateway.task_* handlers (to be updated)
case "gateway.task_started": {
  await ctx.runMutation(api.gatewayTasks.upsert, {
    taskId: getAttr(attrs, "task_id") ?? sessionId,
    sessionId,
    provider: getAttr(attrs, "provider") ?? "unknown",
    status: "running",
    timestamp,
  });
  break;
}
case "gateway.task_completed": {
  await ctx.runMutation(api.gatewayTasks.upsert, {
    taskId: getAttr(attrs, "task_id") ?? sessionId,
    sessionId,
    provider: getAttr(attrs, "provider") ?? "unknown",
    status: "completed",
    durationSeconds: getNumAttr(attrs, "duration_seconds"),
    timestamp,
  });
  // Keep the sessions.upsert call (provider attribution on session)
  await ctx.runMutation(api.sessions.upsert, { sessionId, provider: getAttr(attrs, "provider") });
  break;
}
case "gateway.task_failed": {
  await ctx.runMutation(api.gatewayTasks.upsert, {
    taskId: getAttr(attrs, "task_id") ?? sessionId,
    sessionId,
    provider: getAttr(attrs, "provider") ?? "unknown",
    status: "failed",
    error: getAttr(attrs, "error") ?? "Task failed",
    timestamp,
  });
  break;
}
```

Use `upsert` (patch if exists by `taskId`, insert if not) so task_started → task_completed updates the same row rather than creating two rows.

### Pattern 5: FlexBarChart Segments Extension

The current `FlexBarChart` is 33 lines. Add a `segments` prop that renders stacked segments when present. The existing interface and behavior are preserved as the non-segmented path:

```typescript
// Source: src/components/FlexBarChart.tsx — current implementation + proposed extension
interface StackedSegment {
  value: number;
  color: string;  // hex or Tailwind arbitrary e.g. "#10b981"
  label: string;
}

interface FlexBarChartBar {
  label: string;
  segments?: StackedSegment[];  // NEW: when present, renders stacked
  value?: number;               // existing: single-value path
  max?: number;
}

// Render logic: when segments present, calculate each segment's % of max total
// max = Math.max(...data.map(d => d.segments ? d.segments.reduce(...) : d.value))
// Each segment rendered as a div with explicit background-color and proportional height
```

### Pattern 6: GatewayQuotaPanel Bar Layout

Follows the quota bar pattern inside `ProviderCard` (lines 93–110 of `ProviderHealthPanel.tsx`). The panel iterates all providers, renders API-billed ones with the bar and subscription ones with the UNLIMITED badge:

```typescript
// Source: src/components/ProviderHealthPanel.tsx:93-110 — quota bar pattern
// Track: w-full h-1 bg-gray-700/50 (matches existing)
// Fill: color-thresholded per D-06
const quotaBarColor = remainingPct < 0.05 ? "bg-red-500"
  : remainingPct < 0.20 ? "bg-yellow-500"
  : "bg-emerald-500";

// Row layout per bar:
// [provider display name (left)] [% + $spend (right, tabular-nums mono)]
// [bar track full width, h-1]
```

### Pattern 7: costByPeriodByProvider Query

The existing `costByPeriod` query already reads from the `aggregates` table with `provider` in the `dimensions` field. The new `costByPeriodByProvider` query adds time-bucketing to the return value:

```typescript
// Source: convex/aggregates.ts:198-232 — costByPeriod pattern
export const costByPeriodByProvider = query({
  args: {
    period: v.string(),           // "hourly"
    lookbackHours: v.optional(v.float64()),  // default 24
    billingType: v.optional(v.string()),     // "api" to exclude subscription
  },
  handler: async (ctx, args) => {
    // Returns: Array<{ bucket_start: number, byProvider: Record<string, number> }>
    // Frontend maps to stacked FlexBarChart bars
  },
});
```

### Anti-Patterns to Avoid

- **`VITE_*` vars in Convex actions:** Convex backend actions run on Convex servers, not the browser. `import.meta.env.VITE_*` is undefined there. Use `process.env.ASTRIDR_API_URL` and set via `npx convex env set ASTRIDR_API_URL <value>`.
- **Calling `toolExecutions.insert` for gateway tasks:** The Phase 66 workaround wrote gateway events to `toolExecutions`. Phase 68 replaces this — do not leave the old insert calls in the `gateway.task_*` OTel handlers.
- **Monolithic `gatewayStats.ts`:** Keep concerns separated — `gatewayTasks.ts`, `gatewayQuota.ts`, `routingDecisions.ts` as separate files, matching how `sessions.ts`, `agents.ts`, `llm.ts` are separated.
- **Sorting in the component:** All pagination and ordering must happen on the Convex query side (using `.order("desc")`). Client-side sort of a paginated set only sorts the loaded page, not the full dataset.
- **Re-rendering on every tick:** `useQuery(api.gatewayQuota.latestByProvider)` is reactive — it auto-updates when Convex writes a new snapshot. Do not add polling timers in the component.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cursor pagination | Custom offset/limit | `paginationOptsValidator` + `.paginate()` | Convex cursor pagination handles race conditions; offset pagination breaks on inserts |
| Expandable table rows | Custom state per row | shadcn `Collapsible` (already installed) | Accessibility, animation, and keyboard support handled |
| Relative timestamps ("3m ago") | Custom date math | `date-fns` or simple inline calculation — but check if `formatters.ts` already has one | Avoid duplicating if a util exists |
| Bar chart stacking | Custom SVG/canvas | Extend `FlexBarChart` per D-15 | Chart library avoided per UI-05 requirement; CSS flex stacking is sufficient |
| Status badges | Custom span styling | shadcn `Badge` (already installed) | Consistent sizing and semantic variants |

---

## Common Pitfalls

### Pitfall 1: Convex Environment Variables in Actions
**What goes wrong:** `process.env.VITE_ASTRIDR_API_URL` returns `undefined` in the Convex action — the fetch call goes to `undefined/quota` and silently fails.
**Why it happens:** `VITE_*` vars are injected by Vite at build time into the browser bundle only. The Convex backend is a separate runtime.
**How to avoid:** Set gateway URL and key as Convex environment variables: `npx convex env set ASTRIDR_API_URL http://localhost:8181` and `npx convex env set ASTRIDR_API_KEY <value>`. Access via `process.env.ASTRIDR_API_URL`.
**Warning signs:** Cron runs without error but `gatewayQuotaSnapshots` table stays empty.

### Pitfall 2: Routing Decision OTel Attribute Names
**What goes wrong:** `getAttr(attrs, "task_id")` returns `undefined` because the gateway emits the attribute as `taskId` (camelCase) rather than `task_id` (snake_case).
**Why it happens:** OTel attribute naming conventions vary — gateway Python code may use either. The existing `getAttr` helper does exact-match.
**How to avoid:** Check actual OTel emission in `astridr-repo/astridr/tools/cli_gateway.py` before locking attribute names. Add a fallback: `getAttr(attrs, "task_id") ?? getAttr(attrs, "taskId") ?? sessionId`.
**Warning signs:** `routingDecisions` rows insert with `taskId = sessionId` (the fallback) rather than a proper task UUID.

### Pitfall 3: gatewayTasks Upsert vs Insert for Task Lifecycle
**What goes wrong:** Three OTel events (started, completed, failed) fire for a single task. If using `insert`, you get three separate rows for the same task. If the table is queried for "recent tasks", a single task appears three times.
**Why it happens:** Task lifecycle events are separate OTel log records emitted at different points in time.
**How to avoid:** Use an `upsert` pattern in the `gatewayTasks` mutation: query by `taskId`, patch if exists, insert if not. Index `by_taskId` is needed for this lookup.
**Warning signs:** GatewayTasksPanel shows 3x the expected row count; same task ID appears with RUNNING then COMPLETED rows.

### Pitfall 4: FlexBarChart Segments Max Calculation
**What goes wrong:** Stacked bars overflow their container when the max normalization uses the wrong base. If `maxVal = Math.max(...bars.map(b => b.value))` but bars now use segments, the max is always 1 (undefined) and all bars render at 100%.
**Why it happens:** The existing `maxVal` computation reads `d.value` — which is undefined when `segments` are present.
**How to avoid:** When `segments` are present, compute `maxVal = Math.max(...data.map(d => d.segments ? d.segments.reduce((s, seg) => s + seg.value, 0) : (d.value ?? 0)), 1)`. Each segment renders at `(seg.value / barTotal) * (barTotal / maxVal) * 100%` height.
**Warning signs:** All stacked bars render at full height regardless of values.

### Pitfall 5: providerStats Query Scanning the Full Table
**What goes wrong:** `SELECT * FROM gatewayTasks` to compute 24h stats becomes slow as the table grows.
**Why it happens:** Without a time-window index, Convex scans all rows to compute provider stats.
**How to avoid:** Use the `by_timestamp` index with a cutoff: `.withIndex("by_timestamp", q => q.gte("timestamp", cutoff)).collect()`. Alternatively, compute stats on insert (aggregate approach) — but given this is a new table starting empty, the index scan approach is fine for Phase 68 scale.

### Pitfall 6: LlmProviderPanel vs LlmAnalyticsPanel Collision
**What goes wrong:** Adding `LlmProviderPanel` to the Analytics page while `LlmAnalyticsPanel` already exists in the "Agent Telemetry" section causes duplication — two "Provider Comparison" panels.
**Why it happens:** The UI-SPEC places `LlmProviderPanel` in the new Agent Telemetry section; `LlmAnalyticsPanel` is currently also in Analytics (not under that section header).
**How to avoid:** The existing `LlmAnalyticsPanel` is in the pre-SectionHeader block (lines 131–144 of Analytics.tsx). `LlmProviderPanel` goes in the new "Agent Telemetry" section. They are in different locations on the page. No removal of `LlmAnalyticsPanel` in this phase.

---

## Code Examples

### Gateway Quota API Response Shape (Verified)

```python
# Source: astridr-repo/gateway/gateway/models.py — QuotaStatus model
class QuotaStatus(BaseModel):
    provider: str           # "claude-cli" | "claude-sdk" | "codex" | "antigravity"
    billing_type: BillingType  # "subscription" | "api"
    used_today: int         # request/call count for subscription; unused for api
    daily_limit: int | None  # None for api providers (use spend_cap_usd instead)
    spend_usd: float        # 0.0 for subscription providers
    spend_cap_usd: float | None  # only set for claude-sdk (api provider)
    remaining_pct: float    # 0.0 to 1.0
```

Gateway endpoint: `GET /quota` (no auth required per app.py — but use Bearer token for consistency with all other Ástríðr API calls).

### Cron Registration Pattern (Verified)

```typescript
// Source: convex/crons.ts:77-81 — docker health poll pattern (every 5 minutes)
crons.interval(
  "poll-gateway-quota",
  { minutes: 5 },
  internal.gatewayQuota.pollAndStore  // internalAction, NOT internalMutation
);
```

Use `internalAction` (not `internalMutation`) for the cron handler because it makes an external HTTP call. Convex mutations cannot make `fetch()` calls.

### Existing Analytics Page Insertion Points (Verified)

```typescript
// Source: src/pages/Analytics.tsx:87-93 — SDK Spend Cap Gauge location (D-04 insertion point)
<SectionErrorBoundary name="SDK Spend Cap">
  <GlassPanel className="p-4">
    <SDKSpendCapGauge />
  </GlassPanel>
</SectionErrorBoundary>
// ← INSERT GatewayQuotaPanel here (after SDK Spend Cap, before summary row)

// Source: src/pages/Analytics.tsx:184 — section header rename target
<SectionHeader title="Claude Code Telemetry" />  // ← rename to "Agent Telemetry"
// ← INSERT new widgets in this section: CostTrendChart (upgraded), LlmProviderPanel + ProviderComparisonChart, RoutingDecisionsTable, GatewayTasksPanel
```

### usePaginatedQuery Hook Pattern (Verified)

```typescript
// Source: src/hooks/useLlmMetrics.ts — canonical paginated hook pattern
import { usePaginatedQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useGatewayTasksPaginated(initialNumItems = 25) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.gatewayTasks.listPaginated,
    {},
    { initialNumItems }
  );
  return { tasks: results ?? [], status, loadMore };
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Gateway events → `toolExecutions` workaround | Gateway events → dedicated `gatewayTasks` table | Phase 68 | Enables proper task lifecycle tracking and provider stats |
| `routing_decision` → generic `events` table | `routing_decision` → `routingDecisions` table | Phase 68 | Enables expandable score breakdown UI |
| `CostTrendChart` reads raw `llmMetrics` | `CostTrendChart` reads `aggregates.costByPeriodByProvider` | Phase 68 | Faster, pre-computed, provider-segmented |
| `FlexBarChart` single-value bars | `FlexBarChart` supports optional stacked `segments` | Phase 68 | Reusable stacking for CostTrendChart and ProviderComparisonChart |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The gateway `/quota` endpoint requires Bearer token auth | Pattern 2 (cron action) | If no auth needed, the `Authorization` header is harmless; if a different auth scheme is used, the cron will get 401 and silently skip writes |
| A2 | OTel `gateway.routing_decision` attributes include `task_id`, `requested_provider`, `selected_provider`, `fallback_used`, and score sub-fields | Pattern 4 (OTel redirect) | If gateway emits different attribute names, `routingDecisions` rows will have `unknown` values; fallback chain `task_id ?? taskId` partially mitigates |
| A3 | The gateway emits `task_id` on `gateway.task_started/completed/failed` events | Pattern 4 (upsert) | If no `task_id` attribute, all task rows will share `sessionId` as the task key — upsert will incorrectly merge all tasks into one row |
| A4 | `gatewayTasks` providerStats query at 24h scale is acceptable without a separate aggregation table | Pitfall 5 | If gateway handles high task volume (thousands/day), a `.collect()` over 24h of rows may hit Convex limits; for initial Phase 68 scale this is fine |

---

## Open Questions

1. **Are OTel routing_decision attribute names confirmed?**
   - What we know: The OTel handler in `otelLogs.ts` uses `getAttr()` to extract fields by name. The gateway Python code (`cli_gateway.py`) emits these attributes.
   - What's unclear: Exact attribute key names for score sub-fields and `task_id` vs `taskId`.
   - Recommendation: Read `astridr-repo/astridr/tools/cli_gateway.py` and `astridr-repo/gateway/gateway/router.py` before implementing the `routingDecisions.insert` mutation to confirm attribute keys. Add fallback chains for both naming conventions.

2. **Does the gateway `/quota` endpoint require authentication?**
   - What we know: `app.py` shows no auth middleware on the `/quota` route; other routes also have no per-route auth.
   - What's unclear: Whether a global FastAPI middleware enforces Bearer auth on all routes.
   - Recommendation: Use Bearer token in the cron action regardless (consistent with all other Ástríðr API calls). If auth fails, `res.ok` will be false and the cron will skip silently — add error logging.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Ástríðr gateway (`localhost:8181`) | Quota cron polling | ASSUMED running | — | Cron action logs warning and skips insert if unreachable |
| Convex env vars `ASTRIDR_API_URL`, `ASTRIDR_API_KEY` | gatewayQuota cron action | Must be set | — | Set via `npx convex env set` before first cron run |
| shadcn Table | GatewayTasksPanel, RoutingDecisionsTable | Already installed | — | — |
| shadcn Collapsible | RoutingDecisionsTable row expansion | Already installed | — | — |
| shadcn Badge | Status badges, UNLIMITED badge | Already installed | — | — |

**Missing dependencies with no fallback:** None — all shadcn components already present.

**Missing dependencies with fallback:** Convex env vars must be set before the quota cron fires. The cron won't crash but will silently skip writes if `ASTRIDR_API_URL` is empty.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run convex/gatewayTasks.test.ts convex/gatewayQuota.test.ts convex/routingDecisions.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GW-08 | `gatewayQuotaSnapshots` insert with all required fields | unit | `npx vitest run convex/gatewayQuota.test.ts` | Wave 0 |
| GW-08 | `latestByProvider` returns most recent snapshot per provider | unit | `npx vitest run convex/gatewayQuota.test.ts` | Wave 0 |
| GW-08 | API-billed vs subscription classification correct | unit | `npx vitest run convex/gatewayQuota.test.ts` | Wave 0 |
| GW-09 | `routingDecisions.insert` stores all score fields | unit | `npx vitest run convex/routingDecisions.test.ts` | Wave 0 |
| GW-09 | OTel `gateway.routing_decision` case routes to `routingDecisions` (not `events`) | unit | `npx vitest run convex/__tests__/otelLogs.test.ts` | Extend existing |
| GW-10 | `gatewayTasks.upsert` merges started→completed correctly (same taskId) | unit | `npx vitest run convex/gatewayTasks.test.ts` | Wave 0 |
| GW-10 | `providerStats` returns correct success rate and avg latency | unit | `npx vitest run convex/gatewayTasks.test.ts` | Wave 0 |
| GW-11 | `costByPeriodByProvider` groups by provider per time bucket | unit | `npx vitest run convex/aggregates.test.ts` | Extend existing |
| GW-11 | FlexBarChart `segments` prop renders stacked layout | unit | `npx vitest run src/components/FlexBarChart.test.tsx` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run convex/gatewayTasks.test.ts convex/gatewayQuota.test.ts convex/routingDecisions.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `convex/gatewayTasks.test.ts` — covers GW-10: upsert lifecycle, providerStats aggregation
- [ ] `convex/gatewayQuota.test.ts` — covers GW-08: snapshot insert, latestByProvider, API vs subscription classification
- [ ] `convex/routingDecisions.test.ts` — covers GW-09: insert with scores, paginated list
- [ ] `src/components/FlexBarChart.test.tsx` — covers GW-11: segments prop rendering, max normalization

Existing tests to extend:
- `convex/__tests__/otelLogs.test.ts` — add test cases for `gateway.routing_decision` routing to `routingDecisions` table
- `convex/aggregates.test.ts` — add `costByPeriodByProvider` bucket grouping tests

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No user-facing auth in this phase |
| V3 Session Management | No | No session changes |
| V4 Access Control | No | No new access-controlled endpoints |
| V5 Input Validation | Yes | Convex `v.` validators on all new table fields and mutation args |
| V6 Cryptography | No | No crypto operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated Convex mutation calls from browser | Tampering | All mutations go through Convex auth layer; OTel ingest uses `validateIngestAuth()` |
| Polluted `gateway.routing_decision` events with malformed scores | Tampering | `getNumAttr` returns `undefined` for non-numeric values; `v.optional(v.float64())` in schema rejects non-floats |
| Cron action exposing API key in logs | Information Disclosure | Never log `process.env.ASTRIDR_API_KEY`; log only response status codes |

---

## Sources

### Primary (HIGH confidence)
- `convex/schema.ts` — all existing table definitions and index patterns read directly
- `convex/crons.ts` — all existing cron registrations read directly
- `convex/otelLogs.ts` — routing_decision case at line 279 confirmed, gateway.task_* handlers at lines 236–276 confirmed
- `convex/aggregates.ts` — `costByPeriod` query pattern confirmed, `dimensions` field shape confirmed
- `src/components/FlexBarChart.tsx` — full source read; 33 lines, single-value path only
- `src/components/ProviderHealthPanel.tsx` — quota bar pattern confirmed (lines 93–110)
- `src/components/CostTrendChart.tsx` — current `useCostOverTime` dependency confirmed
- `src/components/LoadMoreButton.tsx` — `status`/`loadMore`/`pageSize` interface confirmed
- `src/components/GlassPanel.tsx` — `className` + `animate` props confirmed
- `src/components/SectionErrorBoundary.tsx` — `name` prop confirmed
- `src/components/SectionHeader.tsx` — `title` + `action` props confirmed
- `src/components/LlmAnalyticsPanel.tsx` — existing component structure confirmed; does NOT group by provider family
- `src/pages/Analytics.tsx` — full insertion points confirmed; "Claude Code Telemetry" at line 185
- `src/lib/providers.ts` — `ALL_PROVIDERS`, `PROVIDER_BILLING`, `PROVIDER_DISPLAY_NAMES` confirmed
- `convex/lib/providers.ts` — backend mirror confirmed (identical)
- `src/lib/astridrApi.ts` — `authHeaders()` pattern confirmed
- `src/components/ui/` — Table, Collapsible, Badge all already installed
- `astridr-repo/gateway/gateway/app.py` — `/quota` endpoint confirmed at line 195; `GET /quota → list[QuotaStatus]`
- `astridr-repo/gateway/gateway/models.py` — `QuotaStatus` model fields confirmed

### Secondary (MEDIUM confidence)
- Phase 67 RESEARCH.md — provider colors, billing type handling confirmed as already shipped
- Phase 66 RESEARCH.md — OTel routing patterns, provider registry origin confirmed

### Tertiary (LOW confidence — flagged assumptions)
- OTel attribute names for `routing_decision` events (A2, A3) — not read from `cli_gateway.py`; planner should verify before implementation

---

## Metadata

**Confidence breakdown:**
- Schema patterns: HIGH — read from `schema.ts` directly
- Cron action pattern: HIGH — read from `crons.ts` + `docker.ts` + `supabase.ts`
- OTel redirect: HIGH — exact line numbers confirmed in `otelLogs.ts`
- FlexBarChart extension: HIGH — full source read; extension approach is straightforward
- Gateway `/quota` endpoint: HIGH — confirmed in `astridr-repo/gateway/gateway/app.py:195`
- OTel attribute key names for routing_decision: LOW — `cli_gateway.py` not read

**Research date:** 2026-05-22
**Valid until:** 2026-06-22 (30 days — stable codebase)
