# Phase 68: Gateway Observability - Pattern Map

**Mapped:** 2026-05-22
**Files analyzed:** 14
**Analogs found:** 14 / 14

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `convex/schema.ts` | config | — | `convex/schema.ts` (llmMetrics, providerHealth sections) | exact |
| `convex/gatewayTasks.ts` | service | CRUD + request-response | `convex/agents.ts` + `convex/docker.ts` (upsert pattern) | exact |
| `convex/gatewayQuota.ts` | service | event-driven (cron polling) | `convex/webhookDelivery.ts` (internalAction + fetch) + `convex/supabase.ts` (pollHealth) | exact |
| `convex/routingDecisions.ts` | service | CRUD | `convex/events.ts` (insert mutation + paginated query) | exact |
| `convex/aggregates.ts` | service | batch + CRUD | `convex/aggregates.ts` costByPeriod query | exact |
| `convex/crons.ts` | config | — | `convex/crons.ts` (docker-health-cleanup interval) | exact |
| `convex/otelLogs.ts` | middleware | event-driven | `convex/otelLogs.ts:236-287` (gateway.task_* + routing_decision cases) | exact |
| `src/components/GatewayQuotaPanel.tsx` | component | request-response | `src/components/ProviderHealthPanel.tsx` (quota bar pattern) | exact |
| `src/components/ProviderComparisonChart.tsx` | component | request-response | `src/components/LlmAnalyticsPanel.tsx` (FlexBarChart per-provider rendering) | role-match |
| `src/components/GatewayTasksPanel.tsx` | component | CRUD + request-response | `src/components/LlmAnalyticsPanel.tsx` (table) + `src/hooks/useLlmMetrics.ts` (usePaginatedQuery) | role-match |
| `src/components/RoutingDecisionsTable.tsx` | component | CRUD + request-response | `src/pages/Analytics.tsx:250-273` (shadcn Table pattern) + `src/components/LoadMoreButton.tsx` | role-match |
| `src/components/FlexBarChart.tsx` | component | transform | `src/components/FlexBarChart.tsx` (extend in-place) | exact |
| `src/components/CostTrendChart.tsx` | component | request-response | `src/components/CostTrendChart.tsx` (upgrade in-place) | exact |
| `src/pages/Analytics.tsx` | page | request-response | `src/pages/Analytics.tsx` (wire new widgets) | exact |

---

## Pattern Assignments

### `convex/schema.ts` — 3 new table definitions

**Analog:** `convex/schema.ts` — `llmMetrics` (lines 292–311), `providerHealth` (lines 764–777)

**Table definition pattern** (lines 292–311 for llmMetrics, 877–885 for aggregates):
```typescript
// Template pattern: all tables use v.float64() for timestamps, v.optional() for nullables,
// explicit indexes for every query access pattern.
llmMetrics: defineTable({
  provider: v.string(),
  model: v.string(),
  cost: v.optional(v.float64()),       // nullable numeric → v.optional(v.float64())
  sessionId: v.optional(v.string()),
  billingType: v.optional(v.string()), // "api" | "subscription"
  timestamp: v.float64(),              // epoch seconds — always present
})
  .index("by_provider", ["provider", "timestamp"])
  .index("by_timestamp", ["timestamp"]),
```

**New tables to add** (derived from RESEARCH.md Pattern 1 + confirmed schema shape):
```typescript
// Add after existing provider-related tables (after providerHealth at line 777)

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
  .index("by_taskId", ["taskId"])        // needed for upsert lookup
  .index("by_status", ["status", "timestamp"]),

gatewayQuotaSnapshots: defineTable({
  provider: v.string(),
  billingType: v.string(),               // "api" | "subscription"
  usedToday: v.float64(),
  dailyLimit: v.optional(v.float64()),
  spendUsd: v.float64(),
  spendCapUsd: v.optional(v.float64()),
  remainingPct: v.float64(),             // 0.0–1.0
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

---

### `convex/gatewayTasks.ts` (service, CRUD)

**Analogs:**
- `convex/docker.ts` — upsert-by-unique-key pattern (lines 1–46)
- `convex/agents.ts` — paginated query (lines 100–108)
- `convex/llm.ts` — time-windowed collect + group (lines 63–74)

**Imports pattern** (from docker.ts line 1):
```typescript
import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
```

**Upsert-by-taskId pattern** (from docker.ts lines 4–46):
```typescript
export const upsert = mutation({
  args: {
    taskId: v.string(),
    sessionId: v.optional(v.string()),
    provider: v.string(),
    billingType: v.optional(v.string()),
    status: v.string(),
    durationSeconds: v.optional(v.float64()),
    error: v.optional(v.string()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("gatewayTasks")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        durationSeconds: args.durationSeconds,
        error: args.error,
        timestamp: args.timestamp,
      });
    } else {
      await ctx.db.insert("gatewayTasks", { ...args });
    }
  },
});
```

**Paginated list query** (from agents.ts lines 100–108):
```typescript
export const listPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
    provider: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("gatewayTasks")
      .withIndex("by_timestamp")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
```

**providerStats query — time-windowed collect** (from llm.ts lines 63–74 + aggregates.ts lines 9–12):
```typescript
export const providerStats = query({
  args: { lookbackHours: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    const cutoff = Date.now() / 1000 - (args.lookbackHours ?? 24) * 3600;
    const rows = await ctx.db
      .query("gatewayTasks")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", cutoff))
      .collect();
    // Group by provider: success rate, avg latency, task count
    const byProvider: Record<string, { total: number; completed: number; totalDuration: number }> = {};
    for (const r of rows) {
      if (!byProvider[r.provider]) byProvider[r.provider] = { total: 0, completed: 0, totalDuration: 0 };
      byProvider[r.provider].total++;
      if (r.status === "completed") {
        byProvider[r.provider].completed++;
        byProvider[r.provider].totalDuration += r.durationSeconds ?? 0;
      }
    }
    return Object.entries(byProvider)
      .filter(([, s]) => s.total > 0)
      .map(([provider, s]) => ({
        provider,
        taskCount: s.total,
        successRate: s.total > 0 ? (s.completed / s.total) * 100 : 0,
        avgDurationSeconds: s.completed > 0 ? s.totalDuration / s.completed : 0,
      }));
  },
});
```

---

### `convex/gatewayQuota.ts` (service, event-driven cron)

**Analogs:**
- `convex/webhookDelivery.ts` — `internalAction` with external `fetch` (lines 406–460)
- `convex/supabase.ts` — `pollHealth` insert-per-item pattern (lines 40–75)
- `convex/crons.ts` — `docker-health-cleanup` 5-minute interval registration (lines 77–81)

**CRITICAL:** Convex actions use `process.env.*` not `import.meta.env.VITE_*`. Set via `npx convex env set`.

**Imports pattern**:
```typescript
import { internalAction, internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
```

**internalAction with fetch** (from webhookDelivery.ts lines 406–412 pattern):
```typescript
export const pollAndStore = internalAction({
  args: {},
  handler: async (ctx) => {
    const apiBase = process.env.ASTRIDR_API_URL ?? "";
    const apiKey = process.env.ASTRIDR_API_KEY ?? "";
    const res = await fetch(`${apiBase}/quota`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
    if (!res.ok) {
      console.warn(`[gatewayQuota] /quota returned ${res.status}`);
      return;
    }
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

**internalMutation insert** (from supabase.ts lines 40–22 pattern):
```typescript
export const insertSnapshot = internalMutation({
  args: {
    provider: v.string(),
    billingType: v.string(),
    usedToday: v.float64(),
    dailyLimit: v.optional(v.float64()),
    spendUsd: v.float64(),
    spendCapUsd: v.optional(v.float64()),
    remainingPct: v.float64(),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("gatewayQuotaSnapshots", { ...args });
  },
});
```

**latestByProvider query** (from supabase.ts currentHealth dedup pattern, lines 24–38):
```typescript
export const latestByProvider = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("gatewayQuotaSnapshots")
      .withIndex("by_timestamp")
      .order("desc")
      .take(100);
    // Dedup: keep most recent per provider
    const byProvider = new Map<string, typeof rows[0]>();
    for (const r of rows) {
      if (!byProvider.has(r.provider)) byProvider.set(r.provider, r);
    }
    return Array.from(byProvider.values());
  },
});
```

---

### `convex/routingDecisions.ts` (service, CRUD)

**Analog:** `convex/events.ts` (insert mutation + paginated query, same pattern as agents.ts)

**Imports pattern** (from llm.ts line 3):
```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
```

**Insert mutation** (from supabase.ts recordHealth pattern, lines 4–22):
```typescript
export const insert = mutation({
  args: {
    taskId: v.string(),
    requestedProvider: v.string(),
    selectedProvider: v.string(),
    quotaScore: v.optional(v.float64()),
    latencyScore: v.optional(v.float64()),
    costScore: v.optional(v.float64()),
    finalScore: v.optional(v.float64()),
    fallbackUsed: v.boolean(),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("routingDecisions", { ...args });
  },
});
```

**Paginated list query** (from agents.ts listAllPaginated, lines 100–108):
```typescript
export const listPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
    fallbackOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("routingDecisions")
      .withIndex("by_timestamp")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
```

---

### `convex/aggregates.ts` — add `costByPeriodByProvider` query

**Analog:** `convex/aggregates.ts` — `costByPeriod` query (lines 198–232)

**costByPeriod existing pattern** (lines 198–232):
```typescript
export const costByPeriod = query({
  args: {
    period: v.string(),
    lookbackDays: v.optional(v.float64()),
    billingType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const lookback = (args.lookbackDays ?? 30) * 86400;
    const cutoff = Date.now() / 1000 - lookback;
    const rows = await ctx.db
      .query("aggregates")
      .withIndex("by_type_period_bucket", (q) =>
        q.eq("metric_type", "cost").eq("period", args.period).gte("bucket_start", cutoff)
      )
      .collect();
    // Phase 67 billingType filter (post-collect)
    const filtered = args.billingType
      ? rows.filter((r) => {
          const bt = (r.dimensions as { billingType?: string } | null)?.billingType ?? "api";
          return bt === args.billingType;
        })
      : rows;
    const grouped: Record<string, number> = {};
    for (const r of filtered) {
      const provider = (r.dimensions as { provider?: string } | null)?.provider ?? "unknown";
      grouped[provider] = (grouped[provider] ?? 0) + r.value;
    }
    return grouped;
  },
});
```

**New query to add** — time-bucketed, grouped by provider:
```typescript
export const costByPeriodByProvider = query({
  args: {
    period: v.string(),
    lookbackHours: v.optional(v.float64()),
    billingType: v.optional(v.string()),   // pass "api" to exclude subscription
  },
  handler: async (ctx, args) => {
    const lookback = (args.lookbackHours ?? 24) * 3600;
    const cutoff = Date.now() / 1000 - lookback;
    const rows = await ctx.db
      .query("aggregates")
      .withIndex("by_type_period_bucket", (q) =>
        q.eq("metric_type", "cost").eq("period", args.period).gte("bucket_start", cutoff)
      )
      .collect();
    const filtered = args.billingType
      ? rows.filter((r) => {
          const bt = (r.dimensions as { billingType?: string } | null)?.billingType ?? "api";
          return bt === args.billingType;
        })
      : rows;
    // Group by bucket_start, then by provider
    const byBucket: Record<number, Record<string, number>> = {};
    for (const r of filtered) {
      const provider = (r.dimensions as { provider?: string } | null)?.provider ?? "unknown";
      if (!byBucket[r.bucket_start]) byBucket[r.bucket_start] = {};
      byBucket[r.bucket_start][provider] = (byBucket[r.bucket_start][provider] ?? 0) + r.value;
    }
    return Object.entries(byBucket)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([bucket_start, byProvider]) => ({
        bucket_start: Number(bucket_start),
        byProvider,
      }));
  },
});
```

---

### `convex/crons.ts` — add quota polling cron

**Analog:** `convex/crons.ts` lines 77–81 (docker-health-cleanup, 5-minute interval)

**Exact registration pattern** (lines 77–81):
```typescript
// Docker container staleness cleanup (every 5 minutes)
crons.interval(
  "docker-health-cleanup",
  { minutes: 5 },
  internal.docker.pollHealth
);
```

**New entry to add** (after docker-health-cleanup):
```typescript
// Phase 68: Gateway quota polling (every 5 minutes)
crons.interval(
  "poll-gateway-quota",
  { minutes: 5 },
  internal.gatewayQuota.pollAndStore   // internalAction — NOT internalMutation (needs fetch)
);
```

---

### `convex/otelLogs.ts` — redirect gateway.* OTel handlers

**Analog:** `convex/otelLogs.ts` lines 236–287 (current gateway.task_* and routing_decision cases)

**Existing gateway.task_completed handler** (lines 236–251 — to be REPLACED):
```typescript
case "gateway.task_completed": {
  const provider = getAttr(attrs, "provider") ?? "unknown";
  await ctx.runMutation(api.toolExecutions.insert, {   // ← Phase 68 removes this
    sessionId,
    toolName: `gateway:${provider}`,
    provider,
    success: true,
    durationMs: getNumAttr(attrs, "duration_ms"),
    timestamp,
  });
  await ctx.runMutation(api.sessions.upsert, { sessionId, provider });  // ← KEEP this line
  break;
}
```

**Replacement pattern** (upsert to gatewayTasks, keep sessions.upsert):
```typescript
case "gateway.task_started": {
  await ctx.runMutation(api.gatewayTasks.upsert, {
    taskId: getAttr(attrs, "task_id") ?? getAttr(attrs, "taskId") ?? sessionId,
    sessionId,
    provider: getAttr(attrs, "provider") ?? "unknown",
    status: "running",
    timestamp,
  });
  break;
}
case "gateway.task_completed": {
  await ctx.runMutation(api.gatewayTasks.upsert, {
    taskId: getAttr(attrs, "task_id") ?? getAttr(attrs, "taskId") ?? sessionId,
    sessionId,
    provider: getAttr(attrs, "provider") ?? "unknown",
    status: "completed",
    durationSeconds: getNumAttr(attrs, "duration_seconds"),
    timestamp,
  });
  await ctx.runMutation(api.sessions.upsert, { sessionId, provider: getAttr(attrs, "provider") });
  break;
}
case "gateway.task_failed": {
  await ctx.runMutation(api.gatewayTasks.upsert, {
    taskId: getAttr(attrs, "task_id") ?? getAttr(attrs, "taskId") ?? sessionId,
    sessionId,
    provider: getAttr(attrs, "provider") ?? "unknown",
    status: "failed",
    error: getAttr(attrs, "error") ?? "Task failed",
    timestamp,
  });
  break;
}
case "gateway.routing_decision": {
  // Phase 68: direct insert to routingDecisions table (replaces generic events.ingest)
  await ctx.runMutation(api.routingDecisions.insert, {
    taskId: getAttr(attrs, "task_id") ?? getAttr(attrs, "taskId") ?? sessionId,
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

**Helper functions already present in otelLogs.ts** (lines 6–31 — do NOT duplicate):
- `getAttr(attrs, key)` — string attribute extraction
- `getNumAttr(attrs, key)` — numeric attribute extraction with `doubleValue` support
- `attrsToObj(attrs)` — full attribute object

---

### `src/components/GatewayQuotaPanel.tsx` (component, request-response)

**Analog:** `src/components/ProviderHealthPanel.tsx` — quota bar pattern (lines 44–110) + provider registry usage (lines 6, 25, 141–143)

**Imports pattern** (from ProviderHealthPanel.tsx lines 1–6):
```typescript
import { memo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ALL_PROVIDERS, PROVIDER_BILLING, PROVIDER_DISPLAY_NAMES } from "../lib/providers";
```

**Quota bar color logic** (from ProviderHealthPanel.tsx lines 44–51 — exact D-06 thresholds):
```typescript
const quotaBarColor = data?.quotaRemaining !== undefined
  ? data.quotaRemaining < 0.05
    ? "bg-red-500"
    : data.quotaRemaining < 0.20
      ? "bg-yellow-500"
      : "bg-emerald-500"
  : null;
```

**Quota bar DOM pattern** (from ProviderHealthPanel.tsx lines 95–110):
```typescript
{/* Quota bar — only if field present */}
{data.quotaRemaining !== undefined && (
  <div className="space-y-1">
    <div className="flex justify-between text-xs">
      <span className="text-gray-500">Quota</span>
      <span className="text-xs font-medium font-mono tabular-nums text-gray-300">
        {Math.round(data.quotaRemaining * 100)}%
      </span>
    </div>
    <div className="w-full h-1 bg-gray-700/50 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${quotaBarColor}`}
        style={{ width: `${Math.round(data.quotaRemaining * 100)}%` }}
      />
    </div>
  </div>
)}
```

**Billing badge pattern** (from ProviderHealthPanel.tsx lines 38–43):
```typescript
const billingBadge = data?.billingType === "api"
  ? { label: "API-BILLED", cls: "bg-yellow-500/20 text-yellow-400" }
  : data?.billingType === "subscription"
    ? { label: "SUBSCRIPTION", cls: "bg-gray-700/50 text-gray-400" }
    : null;
```

**Panel title pattern** (from ProviderHealthPanel.tsx line 139):
```typescript
<h2 className="text-xs font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">
  Gateway Quota
</h2>
```

**ALL_PROVIDERS iteration** (from ProviderHealthPanel.tsx lines 141–143):
```typescript
{ALL_PROVIDERS.map((p) => (
  <ProviderCard key={p} name={p} data={healthData[p]} />
))}
```

**D-03 subscription branch:** For providers where `PROVIDER_BILLING[p] === "subscription"`, render an "Unlimited" badge (`bg-gray-700/50 text-gray-400`) instead of a quota bar.

---

### `src/components/ProviderComparisonChart.tsx` (component, request-response)

**Analog:** `src/components/LlmAnalyticsPanel.tsx` (FlexBarChart per-provider rendering, lines 1–28)

**Imports pattern** (from LlmAnalyticsPanel.tsx lines 1–5):
```typescript
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FlexBarChart } from "./FlexBarChart";
```

**FlexBarChart usage pattern** (from LlmAnalyticsPanel.tsx lines 15–27):
```typescript
const barData = providerData.map((p) => ({
  label: p.provider,
  value: p.calls,
}));

// Empty state
if (barData.length === 0) {
  return <p className="text-gray-500 text-sm">No provider data yet.</p>;
}

<FlexBarChart data={barData} height={220} />
```

**D-11 grouped display:** Three separate FlexBarCharts (success rate %, avg latency ms, task count) or a single chart per metric, each driven by `useQuery(api.gatewayTasks.providerStats)`. Filter out providers with `taskCount === 0` (D-13).

**Panel container pattern** (from LlmAnalyticsPanel.tsx lines 21–23):
```typescript
<div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 space-y-6">
  <h2 className="text-xs font-mono tracking-widest text-primary uppercase mb-3">Provider Comparison</h2>
```

---

### `src/components/GatewayTasksPanel.tsx` (component, CRUD + request-response)

**Analogs:**
- `src/hooks/useLlmMetrics.ts` — usePaginatedQuery hook wrapper (lines 1–11)
- `src/pages/Analytics.tsx` lines 250–273 — shadcn Table usage
- `src/components/LoadMoreButton.tsx` — LoadMoreButton interface (lines 1–26)

**usePaginatedQuery hook pattern** (from useLlmMetrics.ts lines 1–11):
```typescript
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

**shadcn Table imports** (from Analytics.tsx lines 31–37):
```typescript
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../components/ui/table";
```

**Table + LoadMoreButton composition** (from Analytics.tsx lines 250–273 + LoadMoreButton.tsx):
```typescript
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Task ID</TableHead>
      <TableHead>Provider</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Duration</TableHead>
      <TableHead>Timestamp</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {tasks.map((task) => (
      <TableRow key={task._id}>
        <TableCell className="font-mono text-xs">{task.taskId}</TableCell>
        ...
      </TableRow>
    ))}
  </TableBody>
</Table>
<LoadMoreButton status={status} loadMore={loadMore} pageSize={25} />
```

**LoadMoreButton contract** (from LoadMoreButton.tsx lines 1–26):
- Props: `status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted"`
- Renders `null` when `status === "Exhausted" || status === "LoadingFirstPage"` — no conditional wrapping needed

---

### `src/components/RoutingDecisionsTable.tsx` (component, CRUD + request-response)

**Analogs:**
- Same as GatewayTasksPanel (shadcn Table + usePaginatedQuery + LoadMoreButton)
- shadcn Collapsible for expandable rows (already installed in `src/components/ui/`)

**D-08 fallback row accent:**
```typescript
<TableRow
  key={row._id}
  className={row.fallbackUsed ? "border-l-2 border-yellow-500" : ""}
  onClick={() => setExpanded(row._id === expanded ? null : row._id)}
>
```

**Collapsible row expansion pattern** (shadcn Collapsible, already in ui/):
```typescript
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../components/ui/collapsible";

// Inside TableRow onClick or as a separate Collapsible per row:
<Collapsible open={expanded === row._id}>
  <CollapsibleContent>
    {/* Score breakdown: quotaScore, latencyScore, costScore, finalScore */}
    <div className="grid grid-cols-4 gap-2 text-xs text-gray-400 px-4 py-2 bg-gray-900/30">
      <span>Quota: {row.quotaScore?.toFixed(3) ?? "—"}</span>
      <span>Latency: {row.latencyScore?.toFixed(3) ?? "—"}</span>
      <span>Cost: {row.costScore?.toFixed(3) ?? "—"}</span>
      <span>Final: {row.finalScore?.toFixed(3) ?? "—"}</span>
    </div>
  </CollapsibleContent>
</Collapsible>
```

---

### `src/components/FlexBarChart.tsx` — extend with `segments` prop

**Analog:** `src/components/FlexBarChart.tsx` — full source (lines 1–34, existing single-value path)

**Current interface** (lines 1–11):
```typescript
interface FlexBarSegment {
  label: string;
  value: number;
  max?: number;
}
interface FlexBarChartProps {
  data: FlexBarSegment[];
  height?: number | string;
  onSegmentClick?: (label: string, value: number) => void;
}
```

**Current maxVal computation** (line 14 — must be updated for segments):
```typescript
const maxVal = Math.max(...data.map(d => d.value), 1);
// Phase 68: when segments present, use sum of segments as bar total
// maxVal = Math.max(...data.map(d => d.segments
//   ? d.segments.reduce((s, seg) => s + seg.value, 0)
//   : (d.value ?? 0)), 1);
```

**Additive extension** (add these interfaces, keep existing unchanged):
```typescript
interface StackedSegment {
  value: number;
  color: string;    // hex color e.g. "#22c55e" or arbitrary Tailwind
  label: string;
}

// Extend FlexBarSegment:
interface FlexBarSegment {
  label: string;
  value?: number;              // optional when segments present
  max?: number;
  segments?: StackedSegment[]; // NEW: when present, renders stacked bar
}

// In render: when d.segments present, render each segment as a proportional div
// with inline background-color (not Tailwind class, since color is dynamic):
{d.segments
  ? d.segments.map((seg) => (
      <div
        key={seg.label}
        style={{
          height: `${(seg.value / barTotal) * (barTotal / maxVal) * 100}%`,
          backgroundColor: seg.color,
        }}
      />
    ))
  : <div className="w-full bg-gradient-to-t ..." style={{ height: `...` }} />
}
```

---

### `src/components/CostTrendChart.tsx` — upgrade to stacked

**Analog:** `src/components/CostTrendChart.tsx` — full source (lines 1–35, to be replaced in-place)

**Current data flow** (lines 1–18 — to be replaced):
```typescript
import { useCostOverTime } from "../hooks/useAnalytics";  // ← replace with useQuery
const raw = useCostOverTime();
// Manual byTime grouping ← replace with costByPeriodByProvider
```

**New data flow:**
```typescript
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

const buckets = useQuery(api.aggregates.costByPeriodByProvider, {
  period: "hourly",
  lookbackHours: 24,
  billingType: "api",  // D-17: API-billed only
}) ?? [];

// Transform to FlexBarChart stacked data:
const data = buckets.map((b) => ({
  label: new Date(b.bucket_start * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  segments: Object.entries(b.byProvider).map(([provider, cost]) => ({
    value: cost as number,
    color: PROVIDER_COLORS[provider] ?? "#6b7280",
    label: provider,
  })),
}));
```

**FlexBarChart invocation stays the same:**
```typescript
<FlexBarChart data={data} height={300} />
```

---

### `src/pages/Analytics.tsx` — wire new widgets + rename section header

**Analog:** `src/pages/Analytics.tsx` — full source (lines 1–277)

**Insertion point after SDKSpendCapGauge** (lines 87–92 — D-04):
```typescript
{/* SDK Spend Cap per D-04 */}
<SectionErrorBoundary name="SDK Spend Cap">
  <GlassPanel className="p-4">
    <SDKSpendCapGauge />
  </GlassPanel>
</SectionErrorBoundary>

{/* Phase 68 D-04: Gateway Quota Panel — after SDK Spend Cap */}
<SectionErrorBoundary name="Gateway Quota">
  <GlassPanel className="p-4">
    <GatewayQuotaPanel />
  </GlassPanel>
</SectionErrorBoundary>
```

**Section header rename** (line 185 — D-10):
```typescript
// BEFORE:
<SectionHeader title="Claude Code Telemetry" />
// AFTER:
<SectionHeader title="Agent Telemetry" />
```

**New widgets in Agent Telemetry section** (after renamed SectionHeader, before PromptActivityChart):
```typescript
<SectionErrorBoundary name="Provider Comparison">
  <GlassPanel className="p-4">
    <ProviderComparisonChart />
  </GlassPanel>
</SectionErrorBoundary>

<SectionErrorBoundary name="Routing Decisions">
  <GlassPanel className="p-4">
    <RoutingDecisionsTable />
  </GlassPanel>
</SectionErrorBoundary>

<SectionErrorBoundary name="Gateway Tasks">
  <GlassPanel className="p-4">
    <GatewayTasksPanel />
  </GlassPanel>
</SectionErrorBoundary>
```

**Import pattern** (from Analytics.tsx lines 1–38 — add to existing block):
```typescript
import GatewayQuotaPanel from "../components/GatewayQuotaPanel";
import ProviderComparisonChart from "../components/ProviderComparisonChart";
import GatewayTasksPanel from "../components/GatewayTasksPanel";
import RoutingDecisionsTable from "../components/RoutingDecisionsTable";
```

---

## Shared Patterns

### useQuery (non-paginated reactive subscription)
**Source:** `src/components/ProviderHealthPanel.tsx` lines 4–5, 15–18
**Apply to:** GatewayQuotaPanel (latestByProvider), ProviderComparisonChart (providerStats), Analytics.tsx (apiCostByProvider)
```typescript
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

const data = useQuery(api.gatewayQuota.latestByProvider) ?? [];
// Convex auto-updates when the table changes — no polling timer needed in component
```

### usePaginatedQuery hook pattern
**Source:** `src/hooks/useLlmMetrics.ts` lines 1–11
**Apply to:** GatewayTasksPanel hook, RoutingDecisionsTable hook
```typescript
import { usePaginatedQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useXxxPaginated(initialNumItems = 25) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.xxx.listPaginated,
    {},
    { initialNumItems }
  );
  return { items: results ?? [], status, loadMore };
}
```

### Convex paginated query backend
**Source:** `convex/agents.ts` lines 100–108, `convex/llm.ts` lines 51–61
**Apply to:** gatewayTasks.listPaginated, routingDecisions.listPaginated
```typescript
import { paginationOptsValidator } from "convex/server";

export const listPaginated = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tableName")
      .withIndex("by_timestamp")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
```

### SectionErrorBoundary + GlassPanel widget wrapper
**Source:** `src/pages/Analytics.tsx` lines 81–92
**Apply to:** All new widgets inserted in Analytics.tsx
```typescript
<SectionErrorBoundary name="Widget Name">
  <GlassPanel className="p-4">
    <ComponentName />
  </GlassPanel>
</SectionErrorBoundary>
```

### Empty state pattern
**Source:** `src/components/CostTrendChart.tsx` lines 22–27
**Apply to:** All new components
```typescript
if (data.length === 0) {
  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-xs font-mono tracking-widest text-primary uppercase mb-3">Title</h2>
      <p className="text-gray-500 text-sm">No data yet.</p>
    </div>
  );
}
```

### internalAction + ctx.runMutation composition
**Source:** `convex/webhookDelivery.ts` lines 406–412 (internalAction pattern)
**Apply to:** `convex/gatewayQuota.ts` pollAndStore
- internalAction calls `fetch()` — mutations cannot
- After fetch, call `ctx.runMutation(internal.module.mutation, args)` — never `ctx.db` directly inside an action
- Use `process.env.VAR` not `import.meta.env.VITE_VAR` in actions

### Provider display names
**Source:** `src/lib/providers.ts` lines 11–19, `src/components/ProviderHealthPanel.tsx` line 25
**Apply to:** All components rendering provider names
```typescript
import { PROVIDER_DISPLAY_NAMES } from "../lib/providers";
const displayName = PROVIDER_DISPLAY_NAMES[providerKey] ?? providerKey;
```

### Panel heading style
**Source:** `src/components/ProviderHealthPanel.tsx` line 139, `src/components/LlmAnalyticsPanel.tsx` line 23
**Apply to:** All new components that contain their own heading (not wrapped in SectionHeader)
```typescript
<h2 className="text-xs font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">
  Panel Title
</h2>
```

---

## No Analog Found

All 14 files have close analogs in the codebase. No files require fallback to external references.

---

## Metadata

**Analog search scope:** `convex/`, `src/components/`, `src/hooks/`, `src/pages/`, `src/lib/`
**Files scanned:** 18 source files read directly
**Pattern extraction date:** 2026-05-22
