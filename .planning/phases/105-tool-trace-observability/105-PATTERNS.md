# Phase 105: Tool & Trace Observability - Pattern Map

**Mapped:** 2026-08-03
**Files analyzed:** 15 (7 CodePulse new/extended backend, 5 CodePulse new/extended frontend, 3 astridr-repo)
**Analogs found:** 15 / 15

**Correction to RESEARCH.md:** its Wave 0 Gaps table claims `convex/runtimeIngest.test.ts` "does not
exist." It does — verified live, 60+ lines, already tests `resolveGatewayTaskCompleted` and a
`processSwarmTaskEvent` pure-function extraction. The D-01/D-05 pure-function tests (extended
`tool_executed` parsing, new `tool_policy_event` parsing) should be ADDED to this existing file, not
a new one. Every other file:line citation in CONTEXT.md/RESEARCH.md was independently re-verified
below and matched.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `convex/schema.ts` (+`toolPolicyEvents` table) | model/schema | CRUD | `kgBenchmarkRuns` table def (`schema.ts:776-784`) | exact |
| `convex/toolPolicyEvents.ts` (new) | service/model | event-driven | `convex/kgBenchmark.ts` (whole file) | exact |
| `convex/runtimeIngest.ts` (extend `tool_executed`, add `tool_policy_event` case) | controller (ingest dispatch) | event-driven | itself — sibling cases in the same switch (`kg_benchmark` case, `llm_call` case) | exact |
| `convex/toolExecutions.ts` (cap `listBySession`) | service | CRUD | `convex/aggregates.ts`'s `fetchLlmRowsForWindow` (bounded-read shape) | exact |
| `convex/llm.ts` (cap `sessionCalls`) | service | CRUD | `convex/aggregates.ts`'s `fetchLlmRowsForWindow` (bounded-read shape) | exact |
| `convex/aggregates.ts` (`computeHourly` — new tool buckets, D-06 alert-eval tail) | service (rollup + evaluator) | batch/event-driven | `insertTokenSplitBuckets` (D-04) + `evaluateBudgets` tail-call (D-06) — both in this same file's existing code | exact |
| new `evaluateToolPolicyAlerts`-style function (D-06, file TBD by planner — `costBudgetEval.ts` sibling or new `toolPolicyAlertEval.ts`) | service (alert evaluator) | event-driven | `convex/costBudgetEval.ts`'s `evaluateBudgets` (alert insert + dedup + schedule block) | exact |
| `src/pages/Tools.tsx` (new) | page/component | request-response | `src/pages/Quality.tsx` (page shell: `PageHeader` + `SectionHeader` + `SectionErrorBoundary` + `space-y-6`) | exact |
| `src/components/ToolUsagePanel.tsx` / usage section (new) | component | request-response | `src/components/ToolExecutionPanel.tsx` (chart + filter + summary strip) | exact |
| `src/components/ToolPolicyFeed.tsx` (new) | component | request-response | `src/components/ToolExecutionPanel.tsx` (`ScrollArea` + expandable-row convention) | exact |
| `src/hooks/useToolUsage.ts` / `useToolPolicyEvents.ts` (new) | hook | request-response | `src/hooks/useCostDerived.ts` (`useQuery(...) ?? DEFAULT` wrapper) | exact |
| `src/components/TraceWaterfall.tsx` (extend — D-09/D-11/D-12) | component | request-response | itself — extend in place | exact (self) |
| `src/lib/navRegistry.ts` (+1 `OBSERVE` entry) | config | CRUD | itself — `OBSERVE` group array | exact |
| `src/App.tsx` (+1 lazy route) | route config | request-response | itself — `Quality`/`Analytics` lazy-route pattern | exact |
| `src/components/ToolBreakdown.tsx`, `ToolExecutionPanel.tsx`, `PermissionDecisionsChart.tsx` (+cross-link, D-15) | component | request-response | n/a — additive `Link` only | exact (self) |
| astridr `astridr/agent/loop.py` (widen `tool_executed` + leak emit, set round ContextVar) | emit-site (Python) | event-driven | itself — sibling `llm_call` traceId-read pattern already in `anthropic_provider.py` | exact |
| astridr `astridr/engine/telemetry.py` (+round ContextVar trio) | utility (Python ContextVar) | n/a | `_current_trace_id` / `set_trace_context` / `reset_trace_context` / `get_trace_context` (same file, lines 87-89, 610-625) | exact |
| astridr `astridr/providers/{anthropic,ollama,openrouter}.py` (+round read in `llm_call` emit) | emit-site (Python) | event-driven | `anthropic_provider.py:592-615`'s existing `_get_trace_ctx()` read — extend with `_get_round_ctx()` identically | exact |

---

## Pattern Assignments

### `convex/schema.ts` — new `toolPolicyEvents` table (D-05)

**Analog:** `kgBenchmarkRuns` (`convex/schema.ts:776-784`) — the most recent "new insert-only table
fed by a runtime-ingest case" precedent in this file.

```typescript
// convex/schema.ts:776-784 (verified live)
kgBenchmarkRuns: defineTable({
  runTag: v.string(),
  verdict: v.string(),            // "pass" | "fail" | "error"
  categories: v.any(),            // nested per-category scores (suite-driven shape)
  suiteSize: v.float64(),
  durationMs: v.float64(),
  workflowRunUrl: v.optional(v.string()),
  timestamp: v.float64(),
}).index("by_timestamp", ["timestamp"]),
```

Apply the same shape to `toolPolicyEvents`: `event: v.string()` (the 4 kind values), `tool:
v.optional(v.string())` (absent for the two malformed-policy kinds, present for the other two —
OBS-02 requires naming the offending tool when there is one), `sessionId: v.optional(v.string())`,
`taskCategory`/`toolWasOffered`/`toolsOfferedCount`/`round`/`agentId` (D-08, all optional — only the
leak kind sends them), `field`/`error` (v.optional(v.string()) — only the two malformed-policy kinds
send them), `timestamp: v.float64()`. Index at minimum `by_timestamp` (for "last received", D-07) and
`by_event` or `["event", "timestamp"]` (for the alert evaluator's fail-open-kind scan, D-06) — mirror
`by_tool` on `toolExecutions` (`["toolName", "timestamp"]`) as the compound-index precedent.

### `convex/toolPolicyEvents.ts` (new file, D-05/D-07)

**Analog:** `convex/kgBenchmark.ts` (full file, 38 lines) — nearly line-for-line the shape needed.

```typescript
// convex/kgBenchmark.ts (verified live, full file)
import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

export const recordRun = internalMutation({
  args: { runTag: v.string(), verdict: v.string(), categories: v.any(),
    suiteSize: v.float64(), durationMs: v.float64(),
    workflowRunUrl: v.optional(v.string()), timestamp: v.float64() },
  handler: async (ctx, args) => { await ctx.db.insert("kgBenchmarkRuns", args); },
});

export const latestRuns = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("kgBenchmarkRuns").withIndex("by_timestamp").order("desc").take(10);
  },
});
```

Use `internalMutation` (not `mutation`) exactly as `kgBenchmark.recordRun` does — the Security Domain
section of RESEARCH.md correctly identifies this as the WR-06 convention: only the Bearer-gated
`runtimeIngest` httpAction should be able to write, never a public client-callable mutation. Add a
`lastReceivedAt` query (D-07's "silence vs. dead pipe" requirement) mirroring `toolExecutions.ts`'s
`recentExecutions` shape (`.withIndex("by_timestamp").order("desc").take(1)`, return `null` when
empty rather than a synthesized value).

### `convex/runtimeIngest.ts` — extend `case "tool_executed"` (D-01/D-02/D-03) + add `case "tool_policy_event"` (D-05)

**Analog:** the case itself (extend in place) plus the `kg_benchmark` case as the sibling-insert
template.

```typescript
// convex/runtimeIngest.ts:841-857 (verified live — exact current state)
case "tool_executed": {
  // M1.P1: agent↔tool call-graph edge emitted on EVERY tool execution
  // (success or failure) by Ástríðr's agent loop. Broader source than
  // hive_mind_entry, which only covered multi-agent coordination calls.
  const d = data as any;
  const toolExecutedAgent = d.agentId ?? d.agent_id;
  if (toolExecutedAgent) {
    await ctx.runMutation(api.callGraphEdges.upsertEdge, {
      agentId: toolExecutedAgent,
      toolName: d.toolName ?? d.tool_name ?? "unknown",
      sessionId: d.sessionId ?? d.session_id ?? "unknown",
      success: d.success ?? true,
      timestamp,
    });
  }
  break;   // D-01 ADDS a second ctx.runMutation(api.toolExecutions.insert, {...}) here,
           // tagging provider: "astridr" (D-02), before this break.
}
```

The switch (`switch (evt.eventType)`, line 118) has **no `default:` case anywhere** (confirmed by
grep across the whole file) — this is why all 4 `tool_policy_event` kinds vanish silently today.
Template the new case on the LAST case in the switch, `kg_benchmark` (lines 1132-1152), which is the
newest "insert-only table via internalMutation" precedent:

```typescript
// convex/runtimeIngest.ts:1132-1152 (verified live, exact current state)
case "kg_benchmark": {
  // Phase 180 (KG-BENCH-02, D-09): CI KG-vs-vector benchmark run →
  // insert-only kgBenchmarkRuns table. recordRun is an internalMutation
  // (07 review #1) so this ingest path is genuinely gated by the
  // validateIngestAuth Bearer check above (T-180-10) and NOT directly
  // callable by an anonymous client — matching the WR-06 convention.
  const d = data as any;
  await ctx.runMutation(internal.kgBenchmark.recordRun, {
    runTag: d.runTag ?? d.run_tag ?? "unknown",
    verdict: d.verdict ?? "error",
    categories: d.categories ?? {},
    suiteSize: d.suiteSize ?? d.suite_size ?? 0,
    durationMs: d.durationMs ?? d.duration_ms ?? 0,
    workflowRunUrl: d.workflowRunUrl ?? d.workflow_run_url,
    timestamp,
  });
  break;
}
```

`internal` is already imported at the top of the file (`import { api, internal } from
"./_generated/api";`, line 2) — no new import needed. Dual snake/camel coalescing (`d.x ?? d.x_snake
?? default`) on every field is the load-bearing convention throughout this switch (WR-06/168-06) —
apply it to every `tool_policy_event` field including D-08's four widened leak fields.

### `convex/toolExecutions.ts` / `convex/llm.ts` — cap the two feeder reads (D-12)

**Analog:** `convex/aggregates.ts`'s `fetchLlmRowsForWindow` (lines 33-46) — the exact `{rows,
truncated}` bounded-read shape already used elsewhere in this codebase for this identical problem.

```typescript
// convex/aggregates.ts:31-46 (verified live)
const LLM_WINDOW_READ_CAP = 4000;
async function fetchLlmRowsForWindow(ctx, windowStart, windowEnd) {
  const rows = await ctx.db
    .query("llmMetrics")
    .withIndex("by_timestamp", (q) => q.gte("timestamp", windowStart).lt("timestamp", windowEnd))
    .filter((q) => q.neq(q.field("archived"), true))
    .take(LLM_WINDOW_READ_CAP);
  return { rows, truncated: rows.length >= LLM_WINDOW_READ_CAP };
}
```

`llm.sessionCalls` (verified live, `convex/llm.ts:126-136`) and `toolExecutions.listBySession`
(verified live, `convex/toolExecutions.ts:91-99`) are both today `.withIndex(...).order("asc")
.collect()` — genuinely unbounded. Convert both to `.take(CAP)` and return `{rows, truncated}` (or add
a sibling `truncated` boolean field) so `TraceWaterfall` can render one banner from one boolean per
D-12. **Do not** wrap either in a `while` pagination loop — `aggregates.ts`'s own doc comment (lines
9-30) documents Convex allows exactly one paginated query per invocation, and a naive cursor loop
already broke `backfillTokenSplit` in Phase 104.

```typescript
// convex/llm.ts:126-136 (verified live — exact current state, D-12 target)
export const sessionCalls = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("llmMetrics")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .filter((q) => q.neq(q.field("archived"), true))
      .collect();   // D-12: replace with .take(CAP), return { rows, truncated }
  },
});
```

```typescript
// convex/toolExecutions.ts:91-99 (verified live — exact current state, D-12 target)
export const listBySession = query({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    return await ctx.db
      .query("toolExecutions")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .order("asc")
      .collect();   // D-12: replace with .take(CAP), return { rows, truncated }
  },
});
```

### `convex/aggregates.ts` `computeHourly` — new tool buckets (D-04) + D-06's alert-eval tail

**Analog (buckets):** `insertTokenSplitBuckets` (lines 69-100+) — the exact per-dimension-key,
idempotency-guarded, insert-only rollup shape Phase 104 used for `tokens_prompt`/`tokens_completion`.
Reuse its guard pattern (`existingRows` query on `by_type_period_bucket`, build a `Set` of existing
dimension keys, skip already-aggregated dims) for new `tool_calls`/`tool_failures`/`tool_duration`
(or similar) metric types keyed by `{tool, provider}`.

**Analog (alert-eval tail):** the existing `evaluateBudgets` call site, verbatim — this is the D-06
insertion point.

```typescript
// convex/aggregates.ts:257-262 (verified live — exact current state, D-06's insertion point)
try {
  const result = await evaluateBudgets(ctx, now);
  console.log("[computeHourly] budget eval", result);
} catch (err) {
  console.warn("[computeHourly] budget eval failed:", (err as Error).message);
}
// D-06 appends a second, identically-shaped try/catch block immediately after this one:
// try {
//   const result = await evaluateToolPolicyAlerts(ctx, now);
//   console.log("[computeHourly] tool policy alert eval", result);
// } catch (err) {
//   console.warn("[computeHourly] tool policy alert eval failed:", (err as Error).message);
// }
```

The surrounding comment block (lines 231-256, not reproduced here for length) is itself load-bearing
context — it explains why this MUST be a try/catch tail-append and never a new `convex/crons.ts`
entry (D-14 of Phase 104, the 2026-07-14 retry-storm incident). Read it in place before editing.

### D-06's alert evaluator (new function, file TBD by planner)

**Analog:** `convex/costBudgetEval.ts`'s `evaluateBudgets` — the dedup + insert + schedule block to
copy structurally (not literally — the dedup key and payload differ).

```typescript
// convex/costBudgetEval.ts:279-348 (verified live — exact current state)
const source = `cost-budget:${budget._id}:${level}`;
const priorAlerts = (await ctx.db
  .query("alerts")
  .withIndex("by_source", (q: any) => q.eq("source", source).gte("createdAt", periodStart))
  .collect()) as unknown as Array<{ details?: { periodStart?: number } }>;
// ... dedup check against priorAlerts, then:
const alertId = await ctx.db.insert("alerts", {
  severity: level,             // "error" | "warning" — for D-06: "error" (boot-degrade,
                                // the fully-permissive case) vs "warning" (reload-rejected,
                                // fails safe not permissive) per the UI-SPEC's locked mapping
  source,                       // D-06: e.g. `tool-policy:${event}` — system-wide, not per-tool
  message,                      // buildAlertMessage-equivalent; must avoid "forbidden" enforcement
                                 // wording per this phase's own "observes, never enforces" boundary
  acknowledged: false,
  status: "active",
  createdAt: nowSec,
  webhookStatus: "pending",
  details: { /* event-specific: field, error, tool, etc. */ },
});
await ctx.scheduler.runAfter(0, internal.webhookDelivery.sendAlertWebhook, { alertId, attempt: 1 });
```

**Verified severity contract** — `convex/webhookDelivery.ts:244-249`'s `colorMap` accepts exactly
`critical`/`error`/`warning`/`info` (falls back to `info`'s color for anything else):

```typescript
// convex/webhookDelivery.ts:244-249 (verified live)
const colorMap: Record<string, number> = {
  critical: 16711680, error: 16744192, warning: 16776960, info: 5592575,
};
```

So D-06's `"error"` (boot-degrade) / `"warning"` (reload-rejected) choice renders correctly with no
further changes to `webhookDelivery.ts`.

**Test analog:** `convex/costBudgetEval.test.ts` — the `vi.mock("./costBudgetEval", ...)` spy-wrapping
pattern (lines 28-43) is how `aggregates.ts`'s tail-call gets asserted for call count/rejection
behavior without duplicating `computeHourly`'s own test setup. Mirror this for the new evaluator.

### `src/components/TraceWaterfall.tsx` — extend in place (D-09/D-11/D-12)

**This file IS the analog for itself** — read in full (368 lines, all in context, no re-read
needed). Exact current shape to extend, not rewrite:

- **`LlmCallRow` interface** (lines 22-40) — already has `traceId`, `cacheReadInputTokens`,
  `cacheCreationInputTokens`. No new fields needed for the LLM-row side of D-09's nesting; a second
  row type for tool rows must be added (`toolName`, `durationMs`, `success`, and whatever
  attribution field D-10 lands as — `round`).
- **`groupByTrace(rows)`** (lines 60-84) — groups `LlmCallRow[]` by `traceId`, untraced bucket last.
  Exported, unit-tested. D-09 needs an analogous grouping of tool rows by `(traceId, round)` to nest
  under the right LLM-call child — do not infer nesting by timestamp (CONTEXT.md explicitly rejects
  this).
- **`barMetrics(row)`** (lines 90-97) — `{start, width}` in the seconds domain from
  `timestamp`/`latencyMs`. Reuse directly for tool-row bars once `durationMs` is available
  (convert ms→s the same way: `width = row.durationMs / 1000`).
- **`cacheBadge(row)`** (lines 103-108) — three-state `HIT`/`MISS`/`NO_DATA`, never conflates
  `undefined` with `0`. Unchanged by this phase (D-11 note: "existing cache honesty is preserved
  unchanged").
- **`costLabel(row)`** (lines 114-116) — `"n/a"` when `cost` is not a number, never estimates.
- **`computeSummary(rows)`** (lines 134-164) — session-wide aggregates including a session-wide
  `cacheRatio = cacheReadSum / (cacheReadSum + cacheCreationSum + promptTokenSum)`. **D-11 needs a
  PER-GROUP (per-turn) version of this same formula** — `computeSummary` itself is session-wide, not
  reusable as-is for a per-group ratio. Write a new `groupCacheRatio(rows: LlmCallRow[])` following
  the identical denominator, do not reimplement a different one.
- **`groupCostLabel(rows)`** (lines 167-172) — **NOT exported** (module-local function), despite
  CONTEXT.md's canonical-refs line describing it alongside "exported and unit-tested" helpers.
  Verified via `TraceWaterfall.test.tsx`'s import list (lines 18-26): only `groupByTrace`,
  `barMetrics`, `cacheBadge`, `costLabel`, `computeSummary`, and the `TraceWaterfall` component itself
  are imported/unit-tested directly — `groupCostLabel` is exercised only indirectly through rendering
  the component. **Correction for the planner:** if D-11's new `groupCacheRatio` needs direct unit
  tests (recommended, since D-11's own rationale is "one formula, not three drifting copies"), export
  it explicitly — do not assume `groupCostLabel`'s current pattern (local + indirectly tested) is
  sufficient precedent to skip exporting the new helper.
- **Component body** (lines 183-303) — `useQuery(api.llm.sessionCalls, {sessionId})`, `groups =
  useMemo(() => groupByTrace(rows ?? []), [rows])`, per-group `Collapsible` (lines 274-297) is where
  D-09's SECOND-level `Collapsible` nests (tool executions under this same `CollapsibleContent`, or a
  nested `Collapsible` inside it per D-09's "two levels" wording). The turn header line (line
  280-284, `Turn {n} · {count} · {duration} · {cost}`) is exactly where D-11 appends `· {cacheRatio}%
  cached` per the UI-SPEC's copy contract.
- **Empty state** (lines 196-207) — exact copy voice to match for the new Tools-page empty states
  (UI-SPEC's "Ástríðr's tool calls will appear here... no refresh needed" is a verbatim echo of this).

### `src/pages/Tools.tsx` (new, D-13/D-16)

**Analog:** `src/pages/Quality.tsx` (imports lines 1-17) — `PageHeader`, `SectionHeader`,
`SectionErrorBoundary`, hook-per-section, `Select`/range-toggle convention.

```typescript
// src/pages/Quality.tsx:1-17 (verified live)
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import MetricCard, { thresholdColor } from "../components/MetricCard";
import { SectionHeader } from "../components/SectionHeader";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import { StatusBadge } from "../components/StatusBadge";
import InfoTooltip from "../components/InfoTooltip";
import Sparkline from "../components/Sparkline";
import { useQualityKpis } from "../hooks/useEvalScores";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
```

D-16 requires two `<SectionErrorBoundary name="...">` wrappers on one scrolling page (usage, then
policy feed) — not tabs. Use the `name` props `"Tool Usage"` and `"Tool Policy Events"` per the
UI-SPEC's Copywriting Contract.

### `src/components/ToolUsagePanel.tsx` / `ToolPolicyFeed.tsx` (new, OBS-01/OBS-02)

**Analog:** `src/components/ToolExecutionPanel.tsx` (full file, 341 lines) — summary strip +
`FlexBarChart` + tool-name/status `PillButton` filters + `ScrollArea` expandable-row list. This is
the single richest existing analog in the repo for both new components; read in full above.

Reusable pieces verbatim:
- `PillButton` component (lines 19-40) — active/inactive filter pill styling. `ToolUsagePanel`'s D-02
  source filter should use `ToggleGroup`/`ToggleGroupItem` per UI-SPEC (not `PillButton` — UI-SPEC
  names Radix `ToggleGroup` explicitly for the source filter), but `PillButton` is still the right
  template for any secondary tool-name filter.
- Expandable-row pattern (lines 234-333) — `expandedId` state, click-to-toggle, `ml-5 mt-1 mb-1`
  detail block. `ToolPolicyFeed`'s D-08 expansion (show `tool_was_offered`/`tools_offered_count`/
  `round`/`agentId`) should copy this shape directly.
- `ScrollArea` usage (`h-[300px] pr-2`, line 232) — same height/padding convention for the policy
  feed's scroll container.

**Analog for the frequency/success chart** — `FlexBarChart`'s `segments` prop (verified,
`src/components/FlexBarChart.tsx:1-18`):

```typescript
// src/components/FlexBarChart.tsx:1-18 (verified live)
export interface StackedSegment { value: number; color: string; label: string; }
interface FlexBarSegment {
  label: string;
  value?: number;
  max?: number;
  segments?: StackedSegment[]; // when present, renders stacked bar
}
```

Pass `segments: [{value: successCount, color: "var(--status-ok)", label: "Success"}, {value:
failCount, color: "var(--status-error)", label: "Failed"}]` per tool for OBS-01's stacked success/fail
bar — confirmed this prop already renders exactly that shape (`FlexBarChart.tsx:33-67`'s stacked
branch).

### `src/hooks/useToolUsage.ts` / `useToolPolicyEvents.ts` (new)

**Analog:** `src/hooks/useCostDerived.ts` (full file, 70 lines) — `useQuery(...) ?? DEFAULT` wrapper
with typed default shapes so every consumer renders unconditionally.

```typescript
// src/hooks/useCostDerived.ts:49-56 (verified live)
export function useCostBreakdown(period: string, lookbackHours?: number): CostBreakdownResult {
  return (
    (useQuery(api.costDerived.costBreakdown, { period, lookbackHours }) as
      CostBreakdownResult | undefined) ?? DEFAULT_BREAKDOWN
  );
}
```

### D-15 cross-links (`ToolBreakdown.tsx`, `ToolExecutionPanel.tsx`, `PermissionDecisionsChart.tsx`)

**Verified data-source note (important for planner):** `PermissionDecisionsChart.tsx` (lines 1-7)
reads `api.toolExecutions.recentExecutions` directly (`useQuery(api.toolExecutions.recentExecutions)
?? []`, line 7) with **no provider argument or filter** — same table `ToolExecutionPanel.tsx` reads
(`recentExecutions`/`successRate`, lines 43-44). CONTEXT.md's D-15 only verifies `ToolBreakdown` is
safe (reads the build-time `events` table via `useRecentEvents`, not `toolExecutions`) — but
`ToolExecutionPanel` and `PermissionDecisionsChart` both read `toolExecutions` UNFILTERED. Once D-01
starts flowing Ástríðr rows into `toolExecutions` for the first time, **these two existing
Dashboard/Analytics panels' rankings will shift** the moment the astridr-repo commit ships — this is
new mixed-provider data reaching two panels D-15 says should have "zero regression surface." Flag
this to the planner explicitly: either these two panels need no changes (acceptable if the operator
understands the shift) or D-02's source-tagging convention should extend to a filtered
`recentExecutions`/`successRate` variant for them. This is a genuine gap CONTEXT.md's own D-15
verification did not fully close — decide explicitly rather than discovering it live post-merge.

Add-only `Link` (react-router), `text-primary`, appended to each of the three components — zero
layout change otherwise, per UI-SPEC's Component Reuse Map.

### `src/lib/navRegistry.ts` — `OBSERVE` group entry (D-14)

**Correction to CONTEXT.md's citation:** CONTEXT.md cites `navRegistry.ts:150-163` for the `OBSERVE`
group. Verified live: the `OBSERVE` group object starts at line 149 and its `items` array runs lines
151-167 (closing at line 168) — a few lines further than cited, but the same group, unambiguous.

```typescript
// src/lib/navRegistry.ts:149-168 (verified live — exact current state)
{
  group: "OBSERVE",
  items: [
    { to: "/", label: "Dashboard", icon: "grid", group: "OBSERVE" },
    { to: "/hive", label: "Hive", icon: "hexagon", group: "OBSERVE" },
    { to: "/executions", label: "Executions", icon: "list", group: "OBSERVE" },
    { to: "/build", label: "Build", icon: "hammer", group: "OBSERVE" },
    { to: "/analytics", label: "Analytics", icon: "chart", group: "OBSERVE" },
    { to: "/alerts", label: "Alerts", icon: "bell", group: "OBSERVE" },
    { to: "/quality", label: "Quality", icon: "gauge", group: "OBSERVE" },
    { to: "/infrastructure", label: "Infrastructure", icon: "server", group: "OBSERVE" },
    { to: "/security", label: "Security", icon: "shield", group: "OBSERVE" },
    { to: "/self-healing", label: "Self-Healing", icon: "refresh", group: "OBSERVE" },
    { to: "/memory", label: "Memory", icon: "brain", group: "OBSERVE" },
    { to: "/insights", label: "Insights", icon: "insights", group: "OBSERVE" },
  ],
},
// D-14 adds: { to: "/tools", label: "Tools", icon: "wrench" (or similar Lucide-mapped icon), group: "OBSERVE" }
```

### `src/App.tsx` — new lazy route

**Analog:** the `Quality` route (verified live, lines 29, 108-109):

```typescript
// src/App.tsx:29, 108 (verified live)
const Quality = lazy(() => import("./pages/Quality"));
...
<Route path="/quality" element={<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading Quality...</div>}><Quality /></Suspense>} />
```

Copy verbatim for `/tools` → `Tools.tsx`.

---

## Astridr-repo Patterns (D-03/D-08/D-10, single commit)

### `astridr/agent/loop.py:2050-2057` — widen `tool_executed` (D-03)

**Analog:** the emit call itself, extend in place; `_duration_ms` is already computed one line above
at 2030 and currently discarded past the `_persistence.insert_tool_invocation` call.

```python
# astridr/agent/loop.py:2029-2057 (verified live — exact current state)
_end_dt = _dt.datetime.now(_dt.timezone.utc)
_duration_ms = int((time.monotonic() - _start_mono) * 1000)
...
if self.telemetry is not None:
    await self.telemetry.send("tool_executed", {
        "agentId": self._active_profile or "astridr",
        "toolName": tool_call.name,
        "sessionId": self._active_session_id or "",
        "success": _tool_success,
        "timestamp": _end_dt.timestamp(),
        # D-03 ADDS: "durationMs": _duration_ms, "traceId": get_trace_context()
        # D-10 ADDS: "round": get_round_context()
    })
```

`get_trace_context` is already imported at the top of `loop.py` (confirmed: `from
astridr.engine.telemetry import get_trace_context, reset_trace_context, set_trace_context`, line
45-47) and already called at line 1718 elsewhere in this file — no new import needed for `traceId`.

### `astridr/agent/loop.py:1454-1476` — widen the leak payload (D-08)

**Analog:** the `logger.warning` call 5 lines above the `telemetry.send`, which already computes all
4 fields as local variables.

```python
# astridr/agent/loop.py:1454-1476 (verified live — exact current state)
_leaked_tool = _detect_leaked_tool_call(response.content)
if _leaked_tool is not None:
    _permitted = run_state.tools_for_turn_names if run_state is not None else None
    logger.warning(
        "agent_loop.tool_call_leaked_as_text",
        leaked_tool=_leaked_tool, round=round_num, task_category=self._task_category,
        tools_offered_count=len(_permitted) if _permitted is not None else None,
        tool_was_offered=(_leaked_tool in _permitted) if _permitted else False,
        session_id=self._active_session_id or "", agent_id=self._active_profile or "",
    )
    if self.telemetry is not None:
        await self.telemetry.send("tool_policy_event", {
            "event": "tool_call_leaked_as_text",
            "tool": _leaked_tool,
            "taskCategory": self._task_category or "",
            "sessionId": self._active_session_id or "",
            # D-08 ADDS: "tool_was_offered": (_leaked_tool in _permitted) if _permitted else False,
            #            "tools_offered_count": len(_permitted) if _permitted is not None else None,
            #            "round": round_num,
            #            "agentId": self._active_profile or "",
        })
```

### `astridr/agent/loop.py:2088-2109` — `execution_denied` (D-05, already correct shape, no widening needed)

```python
# astridr/agent/loop.py:2088-2109 (verified live — exact current state)
if (self.tool_filter is not None and run_state is not None
    and run_state.tools_for_turn_names is not None
    and tool_call.name not in run_state.tools_for_turn_names):
    logger.warning("agent_loop.tool_off_turn", tool=tool_call.name)
    if self.telemetry is not None:
        await self.telemetry.send("tool_policy_event", {
            "event": "execution_denied",
            "tool": tool_call.name,
            "sessionId": self._active_session_id or "",
        })
    # D-05: a clean self-correcting error string, never a raise/abort. Deliberately does NOT
    # match the failure keyword scan — an off-turn block is not a tool failure.
    return f"[Tool '{tool_call.name}' not permitted this turn]"
```

### `astridr/engine/bootstrap/core.py:105-135, 218-235` — the two malformed-policy emits (D-05, already correct shape)

Both call sites forward `**signal` (`{"field": ..., "error": ...}` — see `config.py:1166-1187` below)
verbatim under a different `event` value:

```python
# astridr/engine/bootstrap/core.py:126-134 (verified live)
if telemetry:
    try:
        await telemetry.send("tool_policy_event", {"event": "malformed_policy_boot", **signal})
    except Exception:
        logger.error("bootstrap.tool_policy_telemetry_failed", exc_info=True)
```

```python
# astridr/engine/bootstrap/core.py:226-235 (verified live)
if telemetry:
    try:
        await telemetry.send("tool_policy_event", {"event": "malformed_policy_reload_rejected", **signal})
    except Exception:
        logger.error("config_watcher.tool_policy_telemetry_failed", path=path, exc_info=True)
```

```python
# astridr/engine/config.py:1166-1187 (verified live — the exact signal shape both sites forward)
_tool_policy_malformed_signal: dict[str, str] | None = None
...
merged["tool_clusters"] = {}
_tool_policy_malformed_signal = {"field": "tool_clusters", "error": str(exc)}
...
result.__dict__["_tool_policy_malformed"] = _tool_policy_malformed_signal
```

No astridr-side change needed for these two emit sites — `convex/toolPolicyEvents.ts`'s schema/insert
just needs `field`/`error` as optional string fields to receive this shape.

### `astridr/engine/telemetry.py:79-93, 610-625` — the ContextVar trio to mirror for `round` (D-10)

**Analog:** `_current_trace_id` — definition, setter, resetter, getter, all in this same file.

```python
# astridr/engine/telemetry.py:87-89 (verified live)
_current_trace_id: contextvars.ContextVar[str | None] = contextvars.ContextVar(  # contextvar-ok
    "telemetry_trace_id", default=None
)

# astridr/engine/telemetry.py:610-625 (verified live)
def set_trace_context(trace_id: str | None) -> contextvars.Token[str | None]:
    """Set the current trace ID for telemetry auto-grouping. Returns a token for reset_trace_context()."""
    return _current_trace_id.set(trace_id)

def reset_trace_context(token: contextvars.Token[str | None]) -> None:
    """Reset the trace context to its previous value."""
    _current_trace_id.reset(token)

def get_trace_context() -> str | None:
    """Return the current trace ID, or None if not set."""
    return _current_trace_id.get()
```

D-10's new `_current_round`/`set_round_context`/`reset_round_context`/`get_round_context` trio
should be a near-literal copy of this (type `int | None` instead of `str | None`). Grepped
`_current_round`/`round_id`/`telemetry_round` across the whole `astridr/` package — confirmed zero
existing matches, this is genuinely new.

**Set-site analog** (`traceId`'s per-turn set/reset, for comparison — round's set/reset happens at a
different, per-ROUND granularity inside the loop, not per-turn):

```python
# astridr/agent/loop.py:930-942 (verified live — traceId's per-TURN set/reset, for pattern reference only)
_trace_token = set_trace_context(str(uuid.uuid4()))
try:
    return await self._process_inner_body(run_state, session, message)
finally:
    reset_trace_context(_trace_token)
```

**D-10's actual set-site** is the round-increment point inside the turn loop, NOT the turn-level
wrapper above:

```python
# astridr/agent/loop.py:1143-1145 (verified live — exact current state, D-10's insertion point)
round_num = 0
...
    round_num += 1
    # D-10 ADDS immediately after this line: _round_token = set_round_context(round_num)
    # (with a matching reset in the loop's existing per-round cleanup/finally, mirroring
    # the try/finally discipline set_trace_context/reset_trace_context uses at the turn level)
```

### `astridr/providers/anthropic_provider.py:592-615` — read `round` in `llm_call` emit (D-10)

**Analog:** the file's own existing `traceId` read, 3 lines above where `round` needs to go — same
provider file, same function, same guard idiom (`if _tid: payload["traceId"] = _tid`).

```python
# astridr/providers/anthropic_provider.py:592-615 (verified live — exact current state)
if self._telemetry:
    from astridr.engine.telemetry import get_goal_context as _get_goal_ctx
    from astridr.engine.telemetry import get_trace_context as _get_trace_ctx
    _llm_payload: dict[str, Any] = {
        "provider": self.name, "model": resolved_model,
        "inputTokens": input_tokens, "outputTokens": output_tokens,
        "cacheReadInputTokens": cache_read_tokens, "cacheCreationInputTokens": cache_creation_tokens,
        "costUsd": cost_usd, "latencyMs": latency_ms,
        "advisorModel": self._advisor_model if self._use_advisor else None,
        "hasAdvisor": self._use_advisor, "hasToolCalls": tool_calls is not None,
    }
    _gid = _get_goal_ctx()
    if _gid:
        _llm_payload["goalId"] = _gid
    _tid = _get_trace_ctx()
    if _tid:
        _llm_payload["traceId"] = _tid
    # D-10 ADDS: from astridr.engine.telemetry import get_round_context as _get_round_ctx
    #            _rnd = _get_round_ctx()
    #            if _rnd is not None: _llm_payload["round"] = _rnd
    await self._telemetry.send("llm_call", _llm_payload)
```

Apply the identical 3-line addition (import, read, conditional-attach) to `ollama.py:229` and
`openrouter.py:358` — CONTEXT.md/RESEARCH.md's citations for those two sites were not independently
re-verified this session (only `anthropic_provider.py` was read in full); confirm the exact
surrounding lines in each during planning, but the shape will be identical since all three call
`get_trace_context()` today by the same convention.

### `convex/runtimeIngest.ts`'s `llm_call` case — already reads `traceId`/`round`? (verify)

**Verified: `traceId` is already coalesced here; `round` is NOT yet.**

```typescript
// convex/runtimeIngest.ts:119-137 (verified live — exact current state)
case "llm_call": {
  const d = data as any;
  await ctx.runMutation(api.llm.recordCall, {
    ...
    traceId: d.traceId ?? d.trace_id,         // Phase 94 TRACE-01 — per-turn trace grouping
    cacheReadInputTokens: d.cacheReadInputTokens ?? d.cache_read_input_tokens,
    cacheCreationInputTokens: d.cacheCreationInputTokens ?? d.cache_creation_input_tokens,
  });
  break;
}
```

D-10 needs `round: d.round` added to this `recordCall` args object (and a corresponding `round:
v.optional(v.float64())` on `llmMetrics` in `schema.ts`, plus in `api.llm.recordCall`'s validator in
`convex/llm.ts:6-23`) so the trace-waterfall's tool-under-LLM-call nesting has a field to join on for
LLM rows, matching whatever field `toolExecutions` rows get from `tool_executed`'s widened payload.

---

## Shared Patterns

### Bounded index-range read (no unbounded `.collect()`)
**Source:** `convex/aggregates.ts:31-46` (`fetchLlmRowsForWindow`)
**Apply to:** `convex/llm.ts`'s `sessionCalls`, `convex/toolExecutions.ts`'s `listBySession` (D-12);
any new `toolPolicyEvents` list query that could grow large.
```typescript
const rows = await ctx.db.query(TABLE)
  .withIndex(INDEX, (q) => q.gte("timestamp", start).lt("timestamp", end))
  .take(CAP);
return { rows, truncated: rows.length >= CAP };
```

### internalMutation-gated insert for a new ingest-fed table
**Source:** `convex/kgBenchmark.ts` (D-05's direct analog)
**Apply to:** `convex/toolPolicyEvents.ts`'s `insert`/`record` mutation — `internalMutation`, never a
public `mutation`, so the only write path is through the Bearer-gated `runtimeIngest` httpAction.

### Cron-tail alert evaluation (never a new `crons.ts` entry)
**Source:** `convex/costBudgetEval.ts`'s `evaluateBudgets`, called from `convex/aggregates.ts:257-262`
**Apply to:** D-06's `evaluateToolPolicyAlerts` — same `try { ... } catch { console.warn(...) }`
wrapper appended to `computeHourly`'s tail, same `alerts` insert + `sendAlertWebhook` schedule shape,
same `by_source` dedup index usage.

### `useQuery(...) ?? DEFAULT` hook wrapper
**Source:** `src/hooks/useCostDerived.ts`
**Apply to:** `src/hooks/useToolUsage.ts`, `src/hooks/useToolPolicyEvents.ts` — typed `DEFAULT`
constants so every consumer renders unconditionally without an `undefined` check.

### `SectionErrorBoundary` — wrap every new panel, don't imitate its internal styling
**Source:** `src/components/SectionErrorBoundary.tsx` (confirmed pre-existing hex debt: hardcoded
`bg-gray-800/50`/`border-red-500/30`/etc., predates the Phase 89 token system)
**Apply to:** both new Tools-page sections (D-16), `name` props `"Tool Usage"` / `"Tool Policy
Events"`. Do NOT copy its hardcoded-hex internals as a template for any NEW component this phase
writes — new components must use CSS-var tokens per CLAUDE.md/UI-SPEC even though this pre-existing
wrapper itself doesn't.

### Dual snake_case/camelCase coalescing at the ingest boundary
**Source:** every case in `convex/runtimeIngest.ts`'s switch, e.g. `d.toolName ?? d.tool_name ??
"unknown"`
**Apply to:** the new `tool_policy_event` case and the extended `tool_executed` case — apply to every
field regardless of which casing the current Python emitter actually sends, per the WR-06/168-06
defensive-ingest convention.

---

## No Analog Found

None. Every file in scope has a strong (exact-match) existing analog in one of the two repos —
this phase is, per RESEARCH.md's own framing, an extension exercise across already-established
conventions rather than new-pattern territory.

---

## Metadata

**Analog search scope:** `convex/*.ts` (ingest, schema, aggregates, costBudgetEval, toolExecutions,
llm, retention, webhookDelivery, kgBenchmark), `src/components/*.tsx` (TraceWaterfall, FlexBarChart,
SectionErrorBoundary, ToolExecutionPanel, PermissionDecisionsChart), `src/pages/*.tsx` (Quality,
Dashboard), `src/hooks/*.ts` (useCostDerived), `src/lib/navRegistry.ts`, `src/App.tsx`; astridr-repo
`astridr/agent/loop.py`, `astridr/engine/telemetry.py`, `astridr/engine/bootstrap/core.py`,
`astridr/engine/config.py`, `astridr/providers/anthropic_provider.py`.
**Files scanned:** ~24 (18 read in full or targeted sections this session, plus grep-only
confirmation passes on `retention.ts`, `webhookDelivery.ts`, `costBudgetEval.test.ts`, contract doc).
**Pattern extraction date:** 2026-08-03
