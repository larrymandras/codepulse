# Phase 104: Cost Intelligence - Pattern Map

**Mapped:** 2026-07-31
**Files analyzed:** 15 (7 new backend, 2 edited backend, 1 edited ingest/cron, 4 new frontend, 5 edited frontend)
**Analogs found:** 15 / 15 (all with role-match or exact analogs; no "no analog" files this phase)

All analogs below were opened and verified live in this session (paths + line numbers current as of
2026-07-31). This phase is overwhelmingly "generalize a narrow existing pattern," per RESEARCH.md's
own framing — every new file has a close, directly-copyable sibling already in the repo.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `convex/modelPricing.ts` (NEW) | service (Convex CRUD module) | CRUD | `convex/alertRuleCustom.ts` | exact |
| `convex/costBudgets.ts` (NEW) | service (Convex CRUD + evaluator) | CRUD + event-driven | `convex/alertRuleCustom.ts` (CRUD) + `convex/evalScores.ts:1235-1355` (fire-and-deliver) | exact (composite) |
| `convex/schema.ts` (EDIT — add `modelPricing`, `costBudgets` tables) | model (schema) | CRUD | `convex/schema.ts:984` (`alertRuleCustom` table) + `convex/schema.ts:1540` (`gatewayQuotaSnapshots` table) | exact |
| `convex/aggregates.ts` (EDIT — widen `tokensByDim`, append budget eval to `computeHourly`) | service (rollup mutation) | batch / transform | `convex/aggregates.ts:7-114` (itself — extend in place) | exact |
| `convex/runtimeIngest.ts` (EDIT — new/extended gateway-completion case → `llmMetrics`) | route (HTTP-triggered ingest dispatcher) | event-driven | `convex/runtimeIngest.ts:59-77` (`llm_call` case) | exact |
| `convex/gatewayQuota.ts` (EDIT — repoint poll URL, D-20) | service (internalAction poller) | event-driven / polling | itself (`pollAndStore`, `:33-98`) | exact |
| `convex/crons.ts` (EDIT — no new cron entry; leave `computeHourly` interval as-is) | config (cron registration) | event-driven | itself (`:13-18`) | exact — **no new entry needed, D-14 forbids one** |
| `src/components/ModelPricingAdmin.tsx` (NEW) | component (admin CRUD sheet) | CRUD | `src/components/AlertRuleForm.tsx` | exact |
| `src/components/CostBudgetsAdmin.tsx` (NEW) | component (admin CRUD sheet) | CRUD | `src/components/AlertRuleForm.tsx` | exact |
| `src/components/UnpricedModelsNudge.tsx` (NEW) | component (banner/nudge) | request-response (reactive read) | `src/components/CostForecastPanel.tsx` (panel shape) + `MetricCard.tsx` (status-token styling) | role-match |
| `src/components/CostBreakdownTable.tsx` (NEW) | component (data table) | request-response (reactive read) | `src/components/CostBreakdown.tsx:152-206` (existing per-provider/model table) | exact |
| `src/components/CostTrendChart.tsx` (EDIT — Billed/Covered toggle, hex→token) | component (chart) | request-response | itself + `src/components/SDKSpendGuard.tsx` (toggle/status pattern) | exact |
| `src/components/CostBreakdown.tsx` (EDIT — hex→token only) | component (table) | request-response | itself | exact |
| `src/components/SDKSpendGuard.tsx` (EDIT — read `costBudgets` row, not constants) | component (gauge) | request-response | itself + `src/hooks/useThemeColors.ts` (hex-token resolution for `Sparkline`) | exact |
| `src/components/CostForecastPanel.tsx` (EDIT — read `costBudgets` monthly row, D-19) | component (panel) | request-response | itself + `convex/forecasts.ts` (current data source being replaced) | exact |
| `src/pages/Settings.tsx` (EDIT — new "Cost & Budgets" `TabsContent`) | page (tab shell) | request-response | itself (`:461-464` `TabsTrigger` list, `:895-903` provider tab pattern) | exact |
| `src/hooks/useCostBudgets.ts` / `useModelPricing.ts` (NEW, if split out) | hook | request-response | `src/hooks/useCostByGoal.ts` | exact |

---

## Pattern Assignments

### `convex/modelPricing.ts` (service, CRUD) — NEW

**Analog:** `convex/alertRuleCustom.ts` (verified live, full file read)

**Imports pattern** (`convex/alertRuleCustom.ts:1-3`):
```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
```

**Auth pattern** (`convex/alertRuleCustom.ts:46-48`, repeated in `update`/`remove`):
```typescript
// CPHLTH-01: Require authenticated Clerk identity.
const identity = await ctx.auth.getUserIdentity();
if (!identity) throw new ConvexError("Unauthenticated");
```
⚠ **Note for planner:** RESEARCH.md's Security Domain table claims `alertRuleCustom` has "no
additional identity check beyond what the rest of the admin surfaces use" — but the *live* file
requires `ctx.auth.getUserIdentity()` on every mutation. `convex/forecasts.ts:143-144`
(`setBudgetCap`) does the identical check. **Copy this auth gate into `modelPricing`
create/update/remove** — do not skip it; it is the actual sibling-surface convention, not an
absence of one.

**Core CRUD pattern** (`convex/alertRuleCustom.ts:34-137`, full `create`/`update`/`remove`/`list`/`get`):
```typescript
export const create = mutation({
  args: { /* ... */ },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");
    const now = Date.now() / 1000;
    return await ctx.db.insert("alertRuleCustom", { ...args, enabled: true, createdAt: now, updatedAt: now });
  },
});
export const update = mutation({ /* ... patch by id, bump updatedAt ... */ });
export const remove = mutation({ /* ... ctx.db.delete(args.id) ... */ });
export const list = query({
  args: { enabled: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    if (args.enabled !== undefined) {
      return await ctx.db.query("alertRuleCustom")
        .withIndex("by_enabled", (q) => q.eq("enabled", args.enabled!)).collect();
    }
    return await ctx.db.query("alertRuleCustom").collect(); // small table, full scan is fine
  },
});
export const get = query({ args: { id: v.id("alertRuleCustom") }, handler: async (ctx, args) => ctx.db.get(args.id) });
```
`modelPricing` is a small table (RESEARCH.md's own read-time-derivation code example at line 599
does `await ctx.db.query("modelPricing").collect()` with the comment "small table, full scan is
fine" — copy that assumption, do not add pagination here).

**Validation pattern** (`convex/forecasts.ts:146-148`, range-check on a money-adjacent field):
```typescript
if (!(args.cap > 0 && args.cap < 1_000_000)) {
  throw new Error("Budget cap must be greater than 0 and less than 1,000,000");
}
```
Apply the same shape to `modelPricing.input`/`.output` rates (must be `> 0`).

---

### `convex/costBudgets.ts` (service, CRUD + evaluator) — NEW

**Analog 1 (CRUD shape):** `convex/alertRuleCustom.ts` — same as above.

**Analog 2 (fire-and-deliver + dedup, copy verbatim per D-15/D-17):** `convex/evalScores.ts:1235-1355`

**Fire path** (`convex/evalScores.ts:1235-1249`):
```typescript
export async function insertRegressionAlertHandler(
  ctx: { db: AlertInsertDb } | any,
  args: { profileId: string; message: string; details: unknown }
): Promise<any> {
  return await ctx.db.insert("alerts", {
    severity: "warning",
    source: `eval-regression:${args.profileId}`,
    message: args.message,
    acknowledged: false,
    status: "active",
    createdAt: Date.now() / 1000,
    webhookStatus: "pending",
    details: args.details,
  });
}
```
For `costBudgets`, mirror with `source: \`cost-budget:${budgetId}:${level}\`` (level =
`"warning"|"error"`) and `details: { periodStart, spend, limit, projectedTotal, projectedHitTime }`
per D-15's dedup key `(budgetId, level, periodStart)`.

**Dedup query** (`convex/evalScores.ts:1168-1178`, note: **no** `.eq("status", ...)` filter — all
statuses count):
```typescript
export const getRegressionAlertsInternal = internalQuery({
  args: { profileId: v.string() },
  handler: async (ctx, { profileId }) => {
    return await ctx.db.query("alerts")
      .withIndex("by_source", (q) => q.eq("source", `eval-regression:${profileId}`))
      .collect();
  },
});
```
For `costBudgets`: query `alerts.by_source` on `\`cost-budget:${budgetId}:${level}\`` and build a
`Set<periodStart>` from `details.periodStart` across all returned rows (mirrors
`alertedChangeDates` at `evalScores.ts:1285-1289`), matching D-15 exactly.

**Delivery scheduling** (`convex/evalScores.ts:1346-1349`, called immediately after the insert):
```typescript
await ctx.scheduler.runAfter(0, internal.webhookDelivery.sendAlertWebhook, {
  alertId,
  attempt: 1,
});
```
`sendAlertWebhook` is an `internalAction` (`convex/webhookDelivery.ts:406-441`, verified) that
loads the alert, loads channels/prefs, checks mute (`internal.alertMutes.isTargetMuted`), and
checks per-severity delivery mode before sending — **never call `alerts.create`** (the public
mutation), copy the insert-then-schedule shape directly instead.

**Error handling / isolation pattern:** `convex/evalScores.ts` isolates one persona's failure from
others (see `:1357+` per-persona try/catch, referenced in evalScores.ts's own docstring) — apply
the same per-budget-row isolation in the D-14 tail-append loop so one malformed `costBudgets` row
never blocks evaluating the rest.

**Projection algorithm to generalize (D-13's mechanism):** `src/components/SDKSpendGuard.tsx:22-37`
```typescript
export function projectDayEndSpend(todaySpend: number, elapsedHours: number) {
  if (elapsedHours <= 0) return { projectedTotal: 0, willExceedCap: false, projectedHitTime: null };
  const hourlyRate = todaySpend / elapsedHours;
  const projectedTotal = hourlyRate * 24;
  const willExceedCap = projectedTotal > DAILY_CAP;
  const dayStartEpoch = Math.floor(Date.now() / 1000 / 86400) * 86400;
  const projectedHitTime = willExceedCap && hourlyRate > 0
    ? new Date((dayStartEpoch + (DAILY_CAP / hourlyRate) * 3600) * 1000)
    : null;
  return { projectedTotal, willExceedCap, projectedHitTime };
}
```
This is pure, already exported for testing (module-level `export function`, no React) — this is
the exact convention `costBudgets.ts`'s own evaluator functions should follow: pure, exported,
unit-testable without `convex-test`, called from the `internalMutation` handler. Parameterize
`24`/`86400` by the row's `period` (`daily|weekly|monthly`) and `DAILY_CAP` by the row's `limit`.

**Where it's invoked from (D-14, tail of `computeHourly`):** `convex/aggregates.ts:7-114` — append
a call at the end of the `handler`, after the existing tokens-bucket insert loop (currently ends
at line 114 with a comment block, before the closing `},`).

**Bounded-read discipline (Pitfall 4/5):** costBudgets read must be `ctx.db.query("costBudgets").collect()`
(small, whole-table — same "small table, full scan is fine" assumption as modelPricing) and any
burn-rate read must go through the `aggregates` table's `by_type_period_bucket` index
(`convex/aggregates.ts:182-187` pattern), **never** a raw `llmMetrics` re-scan.

---

### `convex/schema.ts` — new `modelPricing` / `costBudgets` tables — EDIT

**Analog:** `convex/schema.ts:984-990` (`alertRuleCustom`) for shape; `convex/schema.ts:1540-1551`
(`gatewayQuotaSnapshots`) for a small polled/threshold-carrying table shape.

```typescript
// convex/schema.ts:984-990 (alertRuleCustom — CRUD table shape to mirror)
alertRuleCustom: defineTable({
  name: v.string(),
  severity: v.string(),        // "critical" | "error" | "warning" | "info"
  enabled: v.boolean(),
  conditions: v.array(v.object({
    metric: v.string(),         // e.g., "cost_per_hour", "error_rate", "stall_duration"
    // ...
```
```typescript
// convex/schema.ts:1540-1551 (gatewayQuotaSnapshots — threshold-adjacent small table)
gatewayQuotaSnapshots: defineTable({
  provider: v.string(),
  billingType: v.string(),
  usedToday: v.float64(),
  dailyLimit: v.optional(v.float64()),
  spendUsd: v.float64(),
  spendCapUsd: v.optional(v.float64()),
  remainingPct: v.float64(),
  timestamp: v.float64(),
})
  .index("by_provider", ["provider", "timestamp"])
  .index("by_timestamp", ["timestamp"]),
```
`alerts` table (`convex/schema.ts:111-131`) — the exact fields any budget alert insert must supply
(`severity`, `source`, `message`, `details`, `acknowledged`, `status`, `createdAt`,
`webhookStatus`, indexed `by_source`).

`llmMetrics` (`convex/schema.ts:306-330`) — confirms **no `profileId` field** (D-09's deferred
per-profile scope) and the existing `billingType`/`goalId`/cache-token fields new ingest wiring
(D-18) must populate.

`aggregates` (`convex/schema.ts:917-925`) — current `dimensions: v.optional(v.any())` comment says
`{ provider?, model?, event_type?, error_category? }`; D-04 needs this comment/shape widened to
also carry `billingType`/`goalId` (already written by `computeHourly`, just undocumented in the
comment) plus the new `promptTokens`/`completionTokens` split.

---

### `convex/aggregates.ts` (service, batch/transform) — EDIT

**Analog:** itself. Full file read; this is the file being widened, not copied from elsewhere.

**Existing per-dimension-row pattern to extend** (`convex/aggregates.ts:34-47`):
```typescript
const costByDim: Record<string, number> = {};
const tokensByDim: Record<string, number> = {};
for (const r of llmRows) {
  const billingType = (r as any).billingType ?? getBillingType(r.provider);
  const key = `${r.provider}::${r.model}::${billingType}::${(r as any).goalId ?? ""}`;
  costByDim[key] = (costByDim[key] ?? 0) + (r.cost ?? 0);
  tokensByDim[key] = (tokensByDim[key] ?? 0) + ((r as any).totalTokens ?? 0);
}
```
**D-04 change:** widen `tokensByDim`'s value from a single number to
`{ promptTokens, completionTokens }` (both already on `llmMetrics`, `schema.ts:309-310`), summed
per the identical 4-segment key — **do not** introduce a nested per-model map (RESEARCH.md's
explicit Anti-Pattern); keep the existing row-per-dimension-key insert shape
(`convex/aggregates.ts:96-106`).

**Idempotency guard pattern to replicate for the widened bucket** (`convex/aggregates.ts:82-94`):
```typescript
const existingTokenRows = await ctx.db.query("aggregates")
  .withIndex("by_type_period_bucket", (q) =>
    q.eq("metric_type", "tokens").eq("period", "hourly").eq("bucket_start", hourStart))
  .collect();
const existingTokenKeys = new Set(existingTokenRows.map((r) => { /* reconstruct key */ }));
```

**Bounded-read pagination pattern (mandatory for any new read in the tail-append)**
(`convex/aggregates.ts:18-32`):
```typescript
const LLM_PAGE_SIZE = 500;
const llmRows: Array<Doc<"llmMetrics">> = [];
let llmCursor: string | null = null;
while (true) {
  const page = await ctx.db.query("llmMetrics")
    .withIndex("by_timestamp", (q) => q.gte("timestamp", hourStart).lt("timestamp", hourEnd))
    .filter((q) => q.neq(q.field("archived"), true))
    .paginate({ numItems: LLM_PAGE_SIZE, cursor: llmCursor });
  llmRows.push(...page.page);
  if (page.isDone) break;
  llmCursor = page.continueCursor;
}
```
This exact pagination shape is CLAUDE.md's/`<specifics>`'s "never `.collect()` unbounded" rule
already implemented — reuse verbatim for any new bounded read this phase adds.

**Read-time dollar derivation (composed, no direct precedent — RESEARCH.md's own illustrative code, `104-RESEARCH.md:591-609`):**
```typescript
const tokenRows = await ctx.db.query("aggregates")
  .withIndex("by_type_period_bucket", (q) =>
    q.eq("metric_type", "tokens").eq("period", args.period).gte("bucket_start", cutoff))
  .collect();
const rates = await ctx.db.query("modelPricing").collect(); // small table, full scan is fine
const rateByModel = new Map(rates.map((r) => [r.model, r]));
let total = 0, unpricedTokens = 0;
for (const row of tokenRows) {
  const { model } = row.dimensions as { model: string };
  const rate = rateByModel.get(model);
  if (!rate) { unpricedTokens += row.promptTokens + row.completionTokens; continue; } // D-03
  total += row.promptTokens * rate.input + row.completionTokens * rate.output;
}
```

**Read query pattern to extend/mirror for new derived queries** (`convex/aggregates.ts:172-247`,
`costByPeriod`/`costByPeriodByProvider`) — both already index-bounded on `by_type_period_bucket`
and post-filter by `billingType`; follow this shape for any new derived-dollar query rather than
inventing a new index.

---

### `convex/runtimeIngest.ts` — new/extended gateway-completion case → `llmMetrics` (D-18) — EDIT

**Analog (the pattern to copy the shape of):** `convex/runtimeIngest.ts:59-77` (`llm_call` case —
this is what a `llmMetrics`-writing case looks like):
```typescript
case "llm_call": {
  const d = data as any;
  await ctx.runMutation(api.llm.recordCall, {
    provider: d.provider ?? "unknown",
    model: d.model ?? "unknown",
    promptTokens: d.promptTokens ?? d.prompt_tokens ?? d.inputTokens ?? d.input_tokens ?? 0,
    completionTokens: d.completionTokens ?? d.completion_tokens ?? d.outputTokens ?? d.output_tokens ?? 0,
    totalTokens: d.totalTokens ?? d.total_tokens ?? (/* sum */),
    latencyMs: d.latencyMs ?? d.latency_ms ?? 0,
    cost: d.cost ?? d.costUsd ?? d.cost_usd,
    sessionId: d.sessionId ?? d.session_id,
    timestamp,
    agentId: d.agentId ?? d.agent_id,
    toolName: d.toolName ?? d.tool_name,
    goalId: d.goalId ?? d.goal_id,
    traceId: d.traceId ?? d.trace_id,
    cacheReadInputTokens: d.cacheReadInputTokens ?? d.cache_read_input_tokens,
    cacheCreationInputTokens: d.cacheCreationInputTokens ?? d.cache_creation_input_tokens,
  });
  break;
}
```

**What NOT to build on top of unchanged (the current dead-end)** — `convex/runtimeIngest.ts:965-982`:
```typescript
case "gateway.task_completed": {
  const d = data as any;
  const provider = d.provider ?? "unknown";
  const sessionId = d.session_id ?? d.sessionId ?? "unknown";
  await ctx.runMutation(api.toolExecutions.insert, {
    sessionId, toolName: `gateway:${provider}`, provider,
    success: true, durationMs: d.duration_ms ?? d.durationMs, timestamp,
  });
  await ctx.runMutation(api.sessions.upsert, { sessionId, provider });
  break;
  // no cost, no tokens, no model on `d` for this event type today
}
```
D-18's new work: either extend this case (if the tokens needed to price a shadow figure are
present on `d`) or add a case for the currently-unrouted `"gateway_task_completed"` (underscore,
carries `costUsd` per RESEARCH.md) to **additionally** call `api.llm.recordCall` (same mutation
`llm_call` already uses) with `provider` from `GATEWAY_PROVIDERS` (`convex/lib/providers.ts:7-12`),
`model: undefined`/opaque, and `billingType: "subscription"`. **Per D-18/CLAUDE.md: this must be
additive** — do not remove the existing `toolExecutions.insert`/`sessions.upsert` calls, and any
failure in the new branch must not roll back the ingest transaction beyond what's necessary.

**Auth pattern already gating this whole file (unrelated to this phase, but the mandatory context
for any new case):** the `validateIngestAuth` Bearer gate referenced at `runtimeIngest.ts:83-84`
("Inherits the validateIngestAuth Bearer gate above… no new route or auth check added") — new
cases inherit it automatically; do not add a second check.

---

### `convex/gatewayQuota.ts` (D-20, repoint poll target) — EDIT

**Analog:** itself, full file read. The bug is exactly what CONTEXT.md/RESEARCH.md describe: line
36 reads `process.env.ASTRIDR_API_URL` (astridr's main API, no `/quota` route) instead of the
gateway sidecar's own base URL.
```typescript
// convex/gatewayQuota.ts:33-53 (pollAndStore — the fetch target to repoint)
export const pollAndStore = internalAction({
  args: {},
  handler: async (ctx) => {
    const apiBase = process.env.ASTRIDR_API_URL;   // WRONG target — main API has no /quota
    const apiKey = process.env.ASTRIDR_API_KEY;
    if (!apiBase) { console.warn(...); return; }
    // ...
    res = await fetch(`${apiBase}/quota`, { headers });
```
D-20 fix: introduce a new env var (e.g. `CLI_GATEWAY_URL`) pointing at the sidecar
(`gateway/gateway/app.py:302`'s host:port, default per astridr-repo docs), and repoint the fetch.
Keep the existing "warn and return, never throw" pattern (`:39-42`, `:54-57`, `:59-61`, `:76-81`)
for a missing/unreachable env var — this is already the project's honest-degradation convention
for a poller with no live target.

---

### `convex/crons.ts` — no new entry (D-14 hard constraint) — EDIT (context only)

**Analog:** itself. The existing hourly interval already covers D-14's requirement:
```typescript
// convex/crons.ts:13-18
crons.interval(
  "aggregate-hourly",
  { hours: 1 },
  internal.aggregates.computeHourly
);
```
**Do not add a `costBudgets`-specific cron entry.** The disabled-cron warning at `:27-32` is the
canonical citation for *why*:
```typescript
// DISABLED 2026-07-14 (self-hosted migration incident): markStaleArchived,
// evaluateInternal, and sweepGraphSnapshotVersions all hit the 15s syscall cap
// on self-hosted Convex (single node, SQLite, 3.2M docs) and NEVER complete.
// A failing cron execution retries on its own backoff regardless of schedule,
// so throttling does not help — the retry storms starved ingest mutations.
```

---

### `src/components/ModelPricingAdmin.tsx` / `CostBudgetsAdmin.tsx` (component, CRUD) — NEW

**Analog:** `src/components/AlertRuleForm.tsx` (full file read, 556 lines — the canonical
Sheet-based CRUD form in this codebase).

**Imports pattern** (`AlertRuleForm.tsx:15-52`):
```typescript
import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { type Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
```

**Dirty-tracking + mutation wiring pattern** (`AlertRuleForm.tsx:96-102`, `:117-142`, `:178-180`):
```typescript
const createCustomRule = useMutation(api.alertRuleCustom.create);
const updateCustomRule = useMutation(api.alertRuleCustom.update);
const removeCustomRule = useMutation(api.alertRuleCustom.remove);
// ... form state ...
const [dirty, setDirty] = useState(false);
function markDirty() { if (!dirty) setDirty(true); }
```

**Save handler pattern with toast feedback** (`AlertRuleForm.tsx:183-254`):
```typescript
async function handleSave() {
  setSaving(true);
  try {
    if (customRuleId) {
      await updateCustomRule({ id: customRuleId, /* ... */ });
      toast.success("Rule updated.");
    } else {
      await createCustomRule({ /* ... */ });
      toast.success("Custom rule created.");
    }
    setDirty(false);
    onOpenChange(false);
  } catch {
    toast.error("Rule could not be saved. Check your condition values and try again.");
  } finally {
    setSaving(false);
  }
}
```

**Delete-confirm Dialog pattern** (`AlertRuleForm.tsx:256-270`, `:529-552`):
```typescript
async function handleDelete() {
  if (!customRuleId) return;
  setDeleting(true);
  try {
    await removeCustomRule({ id: customRuleId });
    toast.success("Rule deleted.");
    setDeleteOpen(false);
    onOpenChange(false);
  } catch {
    toast.error("Failed to delete rule.");
  } finally {
    setDeleting(false);
  }
}
// ...
<Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
  <DialogContent>
    <DialogHeader><DialogTitle>Delete this rule?</DialogTitle></DialogHeader>
    <p className="text-base text-muted-foreground">This cannot be undone. ...</p>
    <DialogFooter>
      <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
      <Button variant="destructive" onClick={() => void handleDelete()} disabled={deleting}>
        {deleting ? "Deleting…" : "Delete Rule"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```
UI-SPEC's copy contract already supplies the exact strings to substitute here (`"Remove pricing
rate for {model}?"` / `"Delete this budget threshold?"`).

**Icon-only row-action `aria-label` requirement (UI-SPEC mandate, verified live precedent)**
(`src/components/AlertRulesEngine.tsx:144-150`, `:156-161`):
```tsx
<button
  className="p-1 rounded text-muted-foreground hover:bg-background/80 transition-colors"
  onClick={handleUnmute}
  aria-label="Unmute rule"
>
  <Clock className="w-3.5 h-3.5" />
</button>
```
Apply identically: `aria-label="Edit pricing rate for {model}"`, `aria-label="Remove pricing rate
for {model}"`, `aria-label="Edit budget threshold"`, `aria-label="Delete budget threshold"`.

**Validation pattern for the numeric fields** (`convex/forecasts.ts:146-148`, `AlertRuleForm.tsx:186-192`):
```typescript
const thresh = parseFloat(overrideThreshold);
if (isNaN(thresh)) {
  toast.error("Enter a valid threshold number.");
  setSaving(false);
  return;
}
```

---

### `src/components/UnpricedModelsNudge.tsx` (component, banner) — NEW

**Analog:** `src/components/CostForecastPanel.tsx` (panel shell/loading-state shape) +
`src/components/MetricCard.tsx:66-101` (status-token color-mix pattern).

**Panel shell + loading/empty state pattern** (`CostForecastPanel.tsx:5-30`):
```tsx
export default function CostForecastPanel() {
  const data = useQuery(api.forecasts.costForecast);
  if (data === undefined) {
    return (
      <div className="space-y-4">
        <h2 className="text-sm font-normal uppercase tracking-wide text-muted-foreground">Cost Forecast</h2>
        <p className="text-base text-muted-foreground text-center">Loading...</p>
      </div>
    );
  }
  // ...
```
UI-SPEC pins `UnpricedModelsNudge` to this exact **Heading (panel title)** convention (`text-sm
font-normal uppercase tracking-wide text-muted-foreground`), not the mono eyebrow style.

**Status-token color-mix pattern (never hardcode hex — mandatory remediation target)**
(`src/components/MetricCard.tsx:66-72`, `:97-101`, `:131-136`):
```typescript
// Severity colors are driven entirely by the design-token scale
// (--status-*/--info/--primary). `color-mix` derives the dot glow and the
// hover card glow from the single source token, so there are no hardcoded rgba.
const severityConfig: Record<string, { color: string }> = {
  critical: { color: "var(--status-error)" },
  error: { color: "var(--status-error)" },
  warning: { color: "var(--status-warn)" },
};
const sevConfig = severityConfig[severity] || severityConfig.default;
const hoverCardShadow = `0 0 25px color-mix(in srgb, ${sevConfig.color} 20%, transparent)`;
// ...
style={{ backgroundColor: sevConfig.color, boxShadow: `0 0 8px color-mix(in srgb, ${sevConfig.color} 80%, transparent)` }}
```
Use `var(--status-warn)` for the nudge (D-03's "N models need rates" is a warning-severity signal
per UI-SPEC's Color section).

**Copy contract (UI-SPEC, verbatim):** `"**{N} models** need pricing rates — their cost isn't in
the total above. [Add rates]"` — N must be a live count, never cached/stale (UI-SPEC explicit
requirement).

---

### `src/components/CostBreakdownTable.tsx` (component, data table) — NEW

**Analog:** `src/components/CostBreakdown.tsx:152-206` (existing per-provider/model shadcn `Table`
usage — UI-SPEC explicitly calls out reusing shadcn `Table` primitives here, not the raw HTML this
file also demonstrates elsewhere is being retired).

```tsx
// src/components/CostBreakdown.tsx:14-22 (import) + :153-169 (table header) — verified live
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
// ...
<Table>
  <TableHeader>
    <TableRow>
      <TableHead className="text-xs font-mono uppercase tracking-widest text-muted-foreground h-7 px-1">
        Provider
      </TableHead>
      {/* Model, Cost, % columns identically */}
    </TableRow>
  </TableHeader>
  <TableBody>
    {rows.map((row, i) => (
      <TableRow key={`${row.provider}-${row.model}-${i}`}>
        <TableCell className="text-sm tabular-nums px-1 py-1">{row.provider}</TableCell>
        {/* ... */}
      </TableRow>
    ))}
  </TableBody>
</Table>
```
**D-03's "Unpriced" row requirement** — no direct precedent (new behavior); render as a `Badge`
(status-warn token, per UI-SPEC Copywriting Contract: `"Unpriced"`) in place of the dollar cell,
never `$0.00`/blank — this is new logic, not a copy, but the surrounding table shape is the exact
`CostBreakdown.tsx` shape above.

**⚠ Hardcoded-hex violation present in the analog — do NOT copy these lines, only the structure**
(`CostBreakdown.tsx:52-64`, `:88-115`, `:180-198`):
```tsx
// DO NOT COPY — flagged by CONTEXT.md canonical_refs and UI-SPEC as a violation to fix, not a pattern to propagate
dotClass: "w-2 h-2 rounded-full bg-[#10b981]",
labelClass: "text-xs font-mono text-[#10b981]",
className={isOpus ? "bg-amber-500/10" : ""}
className={`... ${isOpus ? "text-amber-300" : ""}`}
```
UI-SPEC's remediation target for this file: `#10b981`/`#ef4444`/`amber-500`/`amber-300` →
`var(--status-ok)`/`var(--status-error)`/`var(--status-warn)` via the `MetricCard.tsx` `color-mix`
pattern above.

---

### `src/components/CostTrendChart.tsx` (Billed/Covered toggle, D-08) — EDIT

**Analog (chart shape to keep):** itself, full file read — already uses `FlexBarChart` +
`PROVIDER_COLORS`/`PROVIDER_DISPLAY_NAMES` exactly as D-08 specifies reusing.

```tsx
// src/components/CostTrendChart.tsx:1-24 — verified live, current shape
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FlexBarChart } from "./FlexBarChart";
import { PROVIDER_DISPLAY_NAMES, PROVIDER_COLORS } from "../lib/providers";
import InfoTooltip from "./InfoTooltip";

export default function CostTrendChart() {
  const buckets = useQuery(api.aggregates.costByPeriodByProvider, {
    period: "hourly", lookbackHours: 24, billingType: "api",
  }) ?? [];
  const data = buckets.map((b) => ({
    label: new Date(b.bucket_start * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    segments: Object.entries(b.byProvider).map(([provider, cost]) => ({
      value: cost as number,
      color: PROVIDER_COLORS[provider] ?? "#6b7280",
      label: PROVIDER_DISPLAY_NAMES[provider] ?? provider,
    })),
  }));
```

**`FlexBarChart`'s `StackedSegment[]` shape this phase must produce a second (covered) segment
for** (`src/components/FlexBarChart.tsx:1-18`):
```typescript
export interface StackedSegment {
  value: number;
  color: string;   // hex color e.g. "#22c55e"
  label: string;
}
interface FlexBarSegment {
  label: string;
  value?: number;
  max?: number;
  segments?: StackedSegment[]; // when present, renders stacked bar
}
```
UI-SPEC's D-08 rendering rule: the "covered" segment reuses the same `PROVIDER_COLORS[provider]`
hex at `opacity-35` (provider colors are the one exempt-from-tokens hex palette,
`src/lib/providers.ts:38-46`), not a new color scale.

**⚠ Hardcoded-hex violations to fix in this file (mandatory remediation, CLAUDE.md + UI-SPEC)**
(`CostTrendChart.tsx:28`, `:39`):
```tsx
// DO NOT COPY — fix target
<div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
```
→ `bg-card border-border` (matches `GlassPanel`'s own tokens; UI-SPEC notes this wrapper is
redundant since `Analytics.tsx` already wraps this component in a `GlassPanel`).

**Toggle control precedent (no exact toggle-pill precedent found in this codebase for a two-state
segmented control) — closest analog is `AlertRuleForm.tsx`'s `Switch` + `Select` usage for binary
state; UI-SPEC leaves exact toggle implementation to Claude's Discretion (shadcn `Tabs` two-item
row, or a `Button`-pair with `variant="default"`/`"outline"` — both already-installed primitives
per the Registry Safety table).**

---

### `src/components/SDKSpendGuard.tsx` (D-12 rewire onto `costBudgets`) — EDIT

**Analog:** itself, full file read — the file being rewired, not copied from elsewhere.

**Constants to retire as hardcoded, keep as seed values** (`SDKSpendGuard.tsx:8-9`):
```typescript
export const DAILY_CAP = 5.00;
export const ALERT_THRESHOLD = 0.8;  // D-04: 80% = $4 auto-alert
```
Per D-12, these become the **seed row** written into `costBudgets` (scope: "global", period:
"daily") on first migration — the component then reads `limit`/`warnFraction` from a
`useQuery(api.costBudgets.getGlobalDaily)`-style call instead of the module constants.

**Pure functions already exported for testing — keep this convention** (`SDKSpendGuard.tsx:11-37`):
```typescript
export function classifyCapStatus(todaySpend: number, cap: number, alertThreshold: number): "ok" | "warning" | "exceeded" { /* ... */ }
export function projectDayEndSpend(todaySpend: number, elapsedHours: number): { /* ... */ } { /* ... */ }
```
These two functions are D-13's chosen algorithm verbatim — `convex/costBudgets.ts`'s evaluator
should reuse/reimplement this exact math (parameterized), and `SDKSpendGuard.test.tsx` (existing
test file, per RESEARCH.md's Wave 0 Gaps table) should be extended, not replaced.

**⚠ Sparkline hex constants to fix** (`SDKSpendGuard.tsx:90-93`):
```tsx
// DO NOT COPY — fix target
const sparklineColor =
  status === "exceeded" ? "#ef4444"
  : status === "warning" ? "#eab308"
  : "#10b981";
```
**Color-resolution helper already exists — use it, do not hand-roll** (UI-SPEC explicitly asks to
check `src/lib`/hooks first): `src/hooks/useThemeColors.ts:41-75` (`resolveThemeColors`), which
already exposes `statusOk`/`statusWarn`/`statusError` resolved via `getComputedStyle` specifically
because `Sparkline`'s SVG `stroke`/canvas-style APIs can't read CSS vars natively — this is the
exact same problem `SDKSpendGuard`'s sparkline color has:
```typescript
// src/hooks/useThemeColors.ts:41-75 — verified live
export function resolveThemeColors(): ThemeColors {
  const style = getComputedStyle(document.documentElement);
  const get = (token: string): string => style.getPropertyValue(token).trim();
  return {
    // ...
    statusOk: get("--status-ok"),
    statusWarn: get("--status-warn"),
    statusError: get("--status-error"),
    statusInfo: get("--status-info"),
  };
}
export function useThemeColors(): ThemeColors { /* useState + MutationObserver on data-theme */ }
```
Replace the `sparklineColor` ternary's hex literals with `useThemeColors().statusError` /
`.statusWarn` / `.statusOk`.

---

### `src/components/CostForecastPanel.tsx` (D-19 rewire onto `costBudgets`) — EDIT

**Analog:** itself + `convex/forecasts.ts` (the data source being migrated away from).

**Current data source being replaced** (`convex/forecasts.ts:87-92`, `:126-172`):
```typescript
const budgetConfig = await ctx.db.query("agentConfigs")
  .withIndex("by_key", (q) => q.eq("configKey", "intelligence.budget_cap")).first();
const budgetCap = budgetConfig != null ? (budgetConfig.value as number) : null;
// ...
export const setBudgetCap = mutation({
  args: { cap: v.float64() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");
    if (!(args.cap > 0 && args.cap < 1_000_000)) throw new Error("...");
    // patch-or-insert into agentConfigs
```
Per D-19, `agentConfigs["intelligence.budget_cap"]` becomes the **seed value** migrated into a
`costBudgets` row (`scope: "global", period: "monthly"`); `costForecast`'s `budgetCap`/`budgetStatus`
fields must read from `costBudgets` thereafter, reusing `classifyBudgetStatus`
(`convex/forecasts.ts:38-47`, 80%/100% two-tier classifier — structurally identical to D-11's
warn/breach model, confirms no new classifier logic is needed, just a new read source).

**Component-side render pattern to keep unchanged** (`CostForecastPanel.tsx:32-100` — three stat
boxes, progress bar, sparkline) — **UI-SPEC is explicit: same visual output, new data source only.**
Do not restyle this component's headings/layout as part of this edit (UI-SPEC: "Existing panels
being edited in place... keep their current heading style; do not restyle headings on components
this phase only touches for data-source rewiring").

---

### `src/pages/Settings.tsx` — new "Cost & Budgets" tab — EDIT

**Analog:** itself — the existing `Tabs` shell and `SectionErrorBoundary` convention.

**Tab registration pattern** (`Settings.tsx:461-464`, verified live):
```tsx
<TabsTrigger value="general">General</TabsTrigger>
<TabsTrigger value="agents">Agents</TabsTrigger>
<TabsTrigger value="providers">LLM Providers</TabsTrigger>
<TabsTrigger value="notifications">Notifications</TabsTrigger>
```
Add `<TabsTrigger value="cost-budgets">Cost & Budgets</TabsTrigger>`.

**Tab content + error-isolation pattern** (`Settings.tsx:895-903`, the smallest/most directly
comparable existing tab body):
```tsx
<TabsContent value="providers" className="space-y-6 mt-0">
  <SectionErrorBoundary name="Gateway Providers">
    {/* ... */}
  </SectionErrorBoundary>
</TabsContent>
```
New tab: `<TabsContent value="cost-budgets" className="space-y-6 mt-0">` wrapping
`<SectionErrorBoundary name="Cost Budgets"><CostBudgetsAdmin /></SectionErrorBoundary>` above
`<SectionErrorBoundary name="Model Pricing"><ModelPricingAdmin /></SectionErrorBoundary>` per
UI-SPEC's Visual Focal Point ordering (budgets above pricing).

---

### `src/hooks/useCostBudgets.ts` / `useModelPricing.ts` (hook) — NEW

**Analog:** `src/hooks/useCostByGoal.ts` (full file read — the established "skip sentinel +
default fallback" wrapper convention).

```typescript
// src/hooks/useCostByGoal.ts:36-58 — verified live
const DEFAULT_COST: CostByGoalResult = { rows: [], totalCost: 0 };

export function useCostByGoal(goalId: string | null | undefined): CostByGoalResult {
  return (
    (useQuery(api.aggregates.costByGoalPeriod, goalId ? { goalId } : "skip") as CostByGoalResult | undefined)
      ?? DEFAULT_COST
  );
}
```
New hooks: `useCostBudgets()` → `useQuery(api.costBudgets.list) ?? []`,
`useModelPricing()` → `useQuery(api.modelPricing.list) ?? []` — same
`useQuery(api.domain.fn) ?? []` convention documented in `CLAUDE.md`'s Patterns section and used
project-wide.

---

## Shared Patterns

### Fire-and-deliver alert insert (D-15, D-17)
**Source:** `convex/evalScores.ts:1235-1249` (insert) + `:1346-1349` (schedule) + `:1168-1178`
(dedup query, `alerts.by_source` index, no status filter).
**Apply to:** `convex/costBudgets.ts`'s budget-evaluation tail-append in `computeHourly`. Never
call the public `alerts.create` mutation — it does not deliver
(`convex/evalScores.ts:1230-1233` comment is the explicit citation).

### Admin CRUD (create/update/remove/list/get) + Clerk auth gate
**Source:** `convex/alertRuleCustom.ts:34-137` (CRUD) + `:46-48` (auth gate, repeated at `:81-83`,
`:98-100`) + `convex/forecasts.ts:143-144` (same gate on `setBudgetCap`).
**Apply to:** `convex/modelPricing.ts`, `convex/costBudgets.ts` — every mutation requires
`ctx.auth.getUserIdentity()` / `throw new ConvexError("Unauthenticated")` if absent. This
contradicts RESEARCH.md's Security Domain table claim of "no additional identity check" — the
live code has one; copy it.

### Sheet-based CRUD form with dirty-tracking, toast feedback, delete-confirm Dialog
**Source:** `src/components/AlertRuleForm.tsx` (full file, 556 lines).
**Apply to:** `ModelPricingAdmin.tsx`, `CostBudgetsAdmin.tsx`.

### Icon-only row-action `aria-label` requirement
**Source:** `src/components/AlertRulesEngine.tsx:144-150`, `:158`, `:231`, `:242`.
**Apply to:** every icon-only edit/delete button in `ModelPricingAdmin`/`CostBudgetsAdmin` (UI-SPEC
mandates this explicitly, citing this exact precedent).

### Status-token color via `color-mix`, never hardcoded hex
**Source:** `src/components/MetricCard.tsx:66-72`, `:97-101`, `:131-136`.
**Apply to:** `UnpricedModelsNudge.tsx`, `CostBreakdownTable.tsx`, and the hex-remediation edits to
`CostTrendChart.tsx`/`CostBreakdown.tsx`/`SDKSpendGuard.tsx`.

### `useThemeColors()` for non-CSS-var contexts (SVG/canvas)
**Source:** `src/hooks/useThemeColors.ts:41-106` (`resolveThemeColors` + `useThemeColors` hook,
MutationObserver on `data-theme`).
**Apply to:** `SDKSpendGuard.tsx`'s `Sparkline` `color` prop (currently hardcoded hex ternary).

### Bounded, index-range reads only — never `.collect()` on `llmMetrics`/unbounded ranges
**Source:** `convex/aggregates.ts:18-32` (paginated `llmMetrics` read, 500-row pages) and
`convex/aggregates.ts:182-187`/`convex/forecasts.ts:59-64` (index-bounded `aggregates` reads).
**Apply to:** every new query in `costBudgets.ts`/`modelPricing.ts`/widened `aggregates.ts` reads.
Small whole-table `.collect()` is explicitly acceptable **only** for `modelPricing`/`costBudgets`
themselves (few rows by design) — RESEARCH.md's own composed code example states this assumption
outright ("small table, full scan is fine").

### `useQuery(api.domain.fn) ?? []` hook wrapper with "skip" sentinel
**Source:** `src/hooks/useCostByGoal.ts:36-58`.
**Apply to:** any new hook wrapping `costBudgets`/`modelPricing` queries.

### `<SectionErrorBoundary name="...">` around every new widget group
**Source:** `src/pages/Settings.tsx:897-901`, `:907-911` (multiple existing instances).
**Apply to:** every new panel (`ModelPricingAdmin`, `CostBudgetsAdmin`, `UnpricedModelsNudge`,
`CostBreakdownTable`) per CLAUDE.md's Error boundaries convention and UI-SPEC's explicit error-state
copy contract ("Couldn't load {budgets / pricing rates}. [Retry]").

---

## No Analog Found

None. Every file this phase touches has a role-match or exact analog already in the codebase,
confirming RESEARCH.md's own framing ("90% wire existing plumbing, 10% new schema").

One caveat worth flagging to the planner rather than a missing analog: the **two-state segmented
toggle** for `CostTrendChart`'s "Billed" / "Billed + Covered" control (D-08) has no exact existing
precedent component in this codebase — the closest primitives are shadcn `Tabs` (used elsewhere as
a *view router*, e.g. `Settings.tsx`, not as a two-state display toggle) or a `Button`-pair with
`variant="default"`/`"outline"`. Both are already-installed primitives (Registry Safety table,
UI-SPEC), so this is a composition choice, not a missing-package gap.

---

## Metadata

**Analog search scope:** `convex/*.ts` (aggregates, alertRuleCustom, alerts, evalScores,
webhookDelivery, forecasts, gatewayQuota, crons, runtimeIngest, schema, lib/providers),
`src/components/*.tsx` (SDKSpendGuard, CostTrendChart, CostBreakdown, CostForecastPanel,
FlexBarChart, AlertRuleForm, AlertRulesEngine, MetricCard, Sparkline), `src/hooks/*.ts`
(useCostByGoal, useThemeColors), `src/lib/*.ts` (modelPricing, providers, formatters, hexToRgba),
`src/pages/Analytics.tsx`, `src/pages/Settings.tsx`.
**Files scanned/read in full or targeted ranges:** 24.
**Pattern extraction date:** 2026-07-31.
