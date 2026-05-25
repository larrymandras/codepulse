# Phase 69: SDK Spend Guard & Multi-Provider UX — Research

**Researched:** 2026-05-23
**Domain:** React/TypeScript dashboard — spend visualization, provider config persistence, session badges, alert automation, agent seeding
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Spend Guard UX**
- D-01: Replace `SDKSpendCapGauge` with `SDKSpendGuard` in-place. One component, no duplicate spend displays.
- D-02: Card shows hourly spend sparkline (burn rate shape) AND a projected end-of-day total with visual indicator if it would exceed the $5 cap.
- D-03: Data from existing `costByPeriod` aggregate query (`billingType='api'`, hourly granularity). No new Convex query — projection is client-side extrapolation.

**Provider Controls**
- D-04: Provider enable/disable sends a real command to Astridr's gateway (not just UI filtering).
- D-05: ProviderControls panel on Settings page under "Gateway Providers" section.
- D-06: Controls include per-provider enable/disable toggles + drag-to-reorder priority list. No force-route.
- D-07: Provider config (enabled state, priority order) persisted in a Convex table. Gateway reads on startup + responds to live updates.

**Session Provider Badges**
- D-08: Colored pill badges using provider family colors (GPT=green, Gemini=purple, Claude=gold/cyan/emerald per Phase 67 D-09). Uses existing `Badge` component.
- D-09: Every tool call event on SessionTimeline shows a provider badge — always visible.
- D-10: Session list page (ActiveSessions/Dashboard) shows a provider badge per row indicating primary provider.

**Auto-Alert & Seed Data**
- D-11: 80% SDK spend auto-alert as a system-created `alertRuleCustom` row. Visible in Alerts page, editable, mutable.
- D-12: Seed agent profiles for all 4 gateway providers: claude-cli, codex, antigravity, claude-sdk.
- D-13: RoutingAuditTable = upgrade to existing `RoutingDecisionsTable` with richer score breakdown, filtering, and audit columns.

### Claude's Discretion
- Overshoot warning aggressiveness (inline vs toast)
- Exact sparkline rendering approach (inline SVG, Recharts Sparkline, or CSS)
- RoutingDecisionsTable specific upgrade details (columns, filters, expanded content)
- Hook system documentation format and content
- Test structure and Wave 0 stub design

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GW-12 | SDK spend guard card shows real-time spend with projected daily total and visual alert at threshold | costByPeriod hourly data feeds client-side linear projection; existing classifyCapStatus keeps threshold logic |
| GW-13 | Operator can manually disable a provider from the dashboard | New `providerConfig` Convex table + WebSocket command via useCommandDispatch; @dnd-kit/sortable for priority reorder |
| GW-14 | Session timeline shows provider badge per tool call; alert fires at 80% SDK spend | toolExecutions.provider field already exists; auto-alert requires new metric `sdk_spend_usd_today` in evaluateCondition |
</phase_requirements>

---

## Summary

Phase 69 is the UX polish capstone for the gateway integration chain (66->67->68->69). It has six distinct workstreams that are largely independent and can be parallelized in planning waves: (1) SDKSpendGuard card upgrade, (2) ProviderControls Settings panel with drag-to-reorder, (3) session timeline and list provider badges, (4) 80% auto-alert rule seeding, (5) gateway agent profile seeding, and (6) RoutingDecisionsTable audit upgrade.

All backend data structures needed for this phase already exist from prior phases. The `costByPeriod` query returns hourly API-billed buckets suitable for sparkline and linear projection. The `toolExecutions` table already has a `provider` field. The `alertRuleCustom` table exists with full CRUD. The `agentProfiles` and `seedTeams` patterns are established. The only net-new Convex table required is `providerConfig` for persisting provider enabled state and priority order (D-07).

The primary new complexity is the `sdk_spend_usd_today` metric in the `evaluateCondition` function inside `alerts.ts`. The existing custom rule evaluator only handles `error_rate`, `event_count`, and `error_count`. To fire the 80% spend auto-alert, the evaluator must be extended with an `sdk_spend_usd_today` metric that queries today's API-billed aggregate total and compares it to `DAILY_CAP`. The auto-alert row itself is seeded via a Convex mutation run at deploy/first-run using the existing `alertRuleCustom.create` pattern — but note that `create` currently requires auth (`ctx.auth.getUserIdentity()`), so the seed function must use an `internalMutation` to bypass that gate.

**Primary recommendation:** Wave 0 creates test stubs and the `providerConfig` schema. Wave 1 implements SDKSpendGuard + alert metric extension + seed mutations. Wave 2 adds ProviderControls panel + session badges. Wave 3 is RoutingDecisionsTable upgrade + docs.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SDKSpendGuard card (sparkline + projection) | Frontend | Convex (data) | Projection is client-side math on hourly aggregate buckets |
| Provider enable/disable command | API/Backend (Astridr gateway) | Frontend (optimistic) | D-04 requires real gateway command, not UI-only filtering |
| Provider config persistence | Database (Convex) | Frontend (read) | D-07: persisted in Convex, gateway reads on startup |
| Provider priority drag-to-reorder | Frontend | Convex (persist) | @dnd-kit/sortable in browser, mutation to persist order |
| Session timeline provider badges | Frontend | — | toolExecutions.provider already in event data |
| Session list primary provider badge | Frontend | Convex (query) | Needs per-session provider aggregation query |
| 80% SDK spend auto-alert | Database (Convex) | Frontend (alert eval) | evaluateCondition in alerts.ts + alertRuleCustom seed row |
| Gateway agent profile seeding | Database (Convex) | — | internalMutation following seedTeams.ts pattern |
| RoutingDecisionsTable audit upgrade | Frontend | — | Upgrade existing component, no schema changes |
| Hook system docs | Documentation | — | Markdown update only |

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| convex | installed | Reactive queries + mutations | Project standard |
| @dnd-kit/core + @dnd-kit/sortable | installed | Drag-to-reorder priority list | Already used in KanbanBoard and TeamEditor |
| shadcn/ui Badge | installed | Provider pill badges | Used throughout; D-08 explicitly names it |
| sonner (toast) | installed | Command feedback | useCommandDispatch already uses it |
| vitest | ^4.0.18 | Test framework | Project standard |

### No New Dependencies Required

All libraries needed for Phase 69 are already installed. [VERIFIED: codebase grep — @dnd-kit, Badge, sonner, vitest confirmed present]

---

## Architecture Patterns

### System Architecture Diagram

```
Analytics Page
  └── SDKSpendGuard (replaces SDKSpendCapGauge)
        ├── costByPeriod(hourly, billingType=api) → Convex aggregates
        ├── Hourly bucket array → client-side sparkline render
        └── Linear projection: (spend / elapsed_hours) * 24 → projected total

Settings Page → Gateway Providers section
  └── ProviderControls
        ├── useProviderConfig() → Convex providerConfig table (read)
        ├── Toggle enable/disable → Convex mutation (write) + WebSocket command (gateway)
        ├── @dnd-kit/sortable priority list → Convex mutation (write)
        └── "Seed Gateway Defaults" button → runSeed mutation (when providerConfig empty)

SessionTimeline (events[].provider via toolExecutions join or payload)
  └── Badge per tool call row → PROVIDER_COLORS from CostTrendChart

ActiveSessions (Dashboard)
  └── Primary provider badge → sessions.provider field (already on schema)

alerts.ts evaluateCondition()
  └── new metric: "sdk_spend_usd_today"
        └── query aggregates WHERE metric_type=cost, period=daily, billingType=api → sum → compare to DAILY_CAP

Convex internalMutation: seedSDKSpendAlert()
  └── check if rule named "SDK Spend Guard" exists → insert alertRuleCustom if absent

Convex internalMutation: seedGatewayProfiles()
  └── upsert agentProfiles for claude-cli, codex, antigravity, claude-sdk

Convex mutation: runSeed()
  └── public wrapper calling seedSDKSpendAlert + seedGatewayProfiles (triggered by Settings button)
```

### Recommended Project Structure (new files only)

```
src/components/
  SDKSpendGuard.tsx          # replaces SDKSpendCapGauge (keep file, rename component)
  SDKSpendGuard.test.tsx     # Wave 0 stub
  ProviderControls.tsx        # new Settings panel section
  ProviderControls.test.tsx   # Wave 0 stub
  SessionTimeline.test.tsx    # Wave 0 stub — provider badge rendering

src/hooks/
  useProviderConfig.ts        # reads/writes Convex providerConfig table

convex/
  providerConfig.ts           # CRUD for provider enabled state + priority order
  schema.ts                   # add providerConfig table
  alerts.ts                   # extend evaluateCondition with sdk_spend_usd_today
  alerts.test.ts              # Wave 0 stub — sdk_spend_usd_today metric evaluation
  seedGateway.ts              # internalMutations for alert seed + profile seed + public runSeed wrapper
```

### Pattern 1: SDKSpendGuard — Hourly Sparkline + Projection

**What:** Replace the single gauge bar with a richer card showing an hourly sparkline and a projected end-of-day total.

**Data shape:** `costByPeriod({ period: "hourly", billingType: "api", lookbackDays: 1 })` returns `Record<provider, number>` — the sum across all providers for a single lookback window. **This is not per-bucket.** For a sparkline, `costByPeriodByProvider({ period: "hourly", lookbackHours: 24, billingType: "api" })` returns time-bucketed data with `{ bucket_start, byProvider }` structure.

**Projection logic (client-side):**
```typescript
// Source: CONTEXT.md D-03, codebase verified
const elapsedHours = (Date.now() / 1000 - dayStartEpoch) / 3600;
const currentSpend = buckets
  .filter(b => b.bucket_start >= dayStartEpoch)
  .reduce((sum, b) => sum + Object.values(b.byProvider).reduce((s, v) => s + v, 0), 0);
const projectedTotal = elapsedHours > 0 ? (currentSpend / elapsedHours) * 24 : 0;
const willExceedCap = projectedTotal > DAILY_CAP;
```

**Keep exported:** `classifyCapStatus`, `DAILY_CAP`, `ALERT_THRESHOLD` — existing test `SDKSpendCapGauge.test.tsx` imports them. Either keep the exports from the same file or re-export from the new component. [VERIFIED: SDKSpendCapGauge.test.tsx imports these]

**Sparkline options (Claude's discretion):**
- Inline SVG polyline: zero deps, full control, easiest to keep `--radius: 0` style compliance
- CSS flex bars (same as FlexBarChart): consistent with project's "no Recharts for primary displays" rule (UI-05)
- Recharts Sparkline: violates UI-05 spirit — avoid

**Recommendation:** Use CSS flex bars matching FlexBarChart approach. Each hourly bucket becomes a bar segment. Simple, consistent, no new deps. [ASSUMED — sparkline approach not locked by user]

**Overshoot warning:** Inline text below the gauge bar reading "At current rate, you'll exceed $5.00 by ~[time]". Not a toast — the card is always visible on Analytics, inline is more appropriate. [ASSUMED]

### Pattern 2: ProviderControls — New Convex Table

**What:** Persist provider enabled state and priority order.

**New table shape:**
```typescript
// Source: CONTEXT.md D-07, schema.ts patterns verified
providerConfig: defineTable({
  provider: v.string(),       // matches AnyProvider keys from providers.ts
  enabled: v.boolean(),
  priority: v.float64(),      // lower number = higher priority
  updatedAt: v.float64(),
}).index("by_provider", ["provider"])
  .index("by_priority", ["priority"]),
```

**Convex mutation for enable/disable:**
```typescript
// Pattern: mirrors agentConfigs upsert pattern (alertRuleCustom.ts:setThresholdOverride)
export const setProviderEnabled = mutation({
  args: { provider: v.string(), enabled: v.boolean() },
  handler: async (ctx, { provider, enabled }) => {
    const existing = await ctx.db.query("providerConfig")
      .withIndex("by_provider", q => q.eq("provider", provider)).first();
    if (existing) {
      await ctx.db.patch(existing._id, { enabled, updatedAt: Date.now() / 1000 });
    } else {
      await ctx.db.insert("providerConfig", { provider, enabled, priority: 999, updatedAt: Date.now() / 1000 });
    }
    // Then send WebSocket command to gateway
  }
});
```

**WebSocket command for gateway (D-04):**
```typescript
// Source: useCommandDispatch.ts — verified pattern
const { dispatch } = useCommandDispatch();
await dispatch(
  { type: "gateway.provider.set_enabled", provider, enabled },
  enabled ? `${name} enabled` : `${name} disabled`
);
```

The `dispatch` call sends optimistic command + shows toast on ack. The Convex mutation persists the state for gateway restart recovery (D-07).

**Drag-to-reorder with @dnd-kit/sortable:**
```typescript
// Source: TeamEditor.tsx — verified working pattern in codebase
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// On drag end: call arrayMove() to reorder, then persist via mutation
```
[VERIFIED: TeamEditor.tsx uses identical pattern with useSortable + CSS.Transform.toString]

### Pattern 3: Provider Badges — Colors and Badge Component

**Provider color map** (verified from `CostTrendChart.tsx`):
```typescript
// Source: CostTrendChart.tsx — VERIFIED
const PROVIDER_COLORS: Record<string, string> = {
  "claude-cli":       "#10b981",   // emerald
  "claude-sdk":       "#10b981",   // emerald
  "codex":            "#22c55e",   // green (GPT family)
  "antigravity":      "#06b6d4",   // cyan
  "anthropic_direct": "#f59e0b",   // gold/amber
  "openrouter":       "#a855f7",   // purple (Gemini family)
  "ollama":           "#6b7280",   // gray
};
```

This map should be extracted to `src/lib/providers.ts` (or a new `src/lib/providerColors.ts`) so it's shared between CostTrendChart, badge rendering, and ProviderControls. [ASSUMED — currently local to CostTrendChart]

**Badge usage pattern:**
```typescript
// Source: CONTEXT.md D-08, Badge component verified in codebase
import { Badge } from "./ui/badge";
<Badge
  variant="outline"
  className="text-[10px] font-mono"
  style={{ borderColor: PROVIDER_COLORS[provider], color: PROVIDER_COLORS[provider] }}
>
  {PROVIDER_DISPLAY_NAMES[provider] ?? provider}
</Badge>
```

**Session timeline:** The `events` array passed to `SessionTimeline` comes from `api.events.listBySession`. The `events` table does NOT have a `provider` field directly — provider comes from the `toolExecutions` table via its `provider` field. The session's primary `provider` is on the `sessions` table. [VERIFIED: schema.ts — events table has no provider field; toolExecutions has `provider: v.optional(v.string())`]

**Implication for D-09:** To show provider badge per timeline event, either:
1. Join toolExecutions to events client-side by matching toolName + sessionId + approximate timestamp
2. Add provider to the events ingest (heavier lift)
3. Use `session.provider` as a single badge for all events (ignores mixed-provider)

Option 1 is most accurate per D-09 intent. Option 3 is simpler but violates "per tool call" requirement. **Recommended approach:** Query `toolExecutions` for the session alongside events, then correlate by toolName + timestamp proximity in the component. [ASSUMED — implementation detail in Claude's discretion]

**Session list (D-10):** `sessions.provider` field already exists on the schema and is populated. `ActiveSessions` component renders session cards from `useActiveSessions()` -> `sessions.listActive`. The provider badge can be added inline to each session card using `session.provider`. [VERIFIED: schema.ts sessions table has `provider: v.optional(v.string())`]

### Pattern 4: 80% Auto-Alert — evaluateCondition Extension

**The problem:** The custom rule evaluator in `alerts.ts:evaluateCondition` only handles three metrics: `error_rate`, `event_count`, `error_count`. A new metric `sdk_spend_usd_today` must be added for the auto-alert to actually fire.

**Extension pattern:**
```typescript
// Source: alerts.ts:792-821 — VERIFIED existing pattern
} else if (condition.metric === "sdk_spend_usd_today") {
  // Query today's API-billed aggregate cost
  const dayStart = Math.floor(now / 86400) * 86400;
  const todayAggregates = await ctx.db
    .query("aggregates")
    .withIndex("by_type_period_bucket", q =>
      q.eq("metric_type", "cost").eq("period", "daily").gte("bucket_start", dayStart)
    )
    .collect();
  const apiRows = todayAggregates.filter(r =>
    (r.dimensions as any)?.billingType === "api"
  );
  value = apiRows.reduce((sum, r) => sum + r.value, 0);
}
```

**Auto-alert rule seed shape:**
```typescript
// D-11: system-created alertRuleCustom row
// Must use internalMutation (bypasses auth gate — alertRuleCustom.create requires identity)
{
  name: "SDK Spend Guard",
  severity: "warning",
  conditions: [{
    metric: "sdk_spend_usd_today",
    operator: "gte",
    threshold: DAILY_CAP * ALERT_THRESHOLD,  // 4.00
    lookbackWindow: "24h",
  }],
  conditionLogic: "AND",
  messageTemplate: "SDK API spend has reached 80% of the daily $5.00 cap",
  enabled: true,
}
```

**Seed idempotency:** Check if a rule with `name === "SDK Spend Guard"` already exists before inserting. Run from a Convex `internalMutation` triggered at deploy or from a one-time admin action button on Settings.

**Auth constraint:** `alertRuleCustom.create` requires `ctx.auth.getUserIdentity()` (CPHLTH-01). The seed function must be an `internalMutation` in `convex/seedGateway.ts` that writes directly to `ctx.db` without the auth check. [VERIFIED: alertRuleCustom.ts:47-48]

### Pattern 5: Gateway Agent Profile Seed

**Seed data for D-12:**
```typescript
// Source: seedTeams.ts pattern — VERIFIED
const GATEWAY_PROFILES = [
  { profileId: "claude-cli",   name: "Claude CLI",   model: "claude-opus-4-6",   displayName: "Claude CLI — Subscription" },
  { profileId: "codex",        name: "Codex CLI",    model: "gpt-4o",            displayName: "Codex CLI — Subscription" },
  { profileId: "antigravity",  name: "Antigravity",  model: "gpt-4o",            displayName: "Antigravity CLI — Subscription" },
  { profileId: "claude-sdk",   name: "Claude SDK",   model: "claude-sonnet-4-6", displayName: "Claude SDK — API" },
];
```

**Upsert pattern:** Query `agentProfiles` by `profileId`, patch if exists, insert if not. Model names for codex/antigravity: both route through OpenAI-compatible APIs, `gpt-4o` is the appropriate model name. [ASSUMED — exact model names for codex/antigravity not locked]

### Pattern 6: RoutingDecisionsTable Audit Upgrade (D-13)

**Current state:** The table in `RoutingDecisionsTable.tsx` already has expandable rows with quota/latency/cost/final scores. Per D-13 this is already the richer score breakdown. The upgrade is about adding filtering and audit-friendly columns.

**Additions per Claude's discretion:**
- Add a "Filter" pill row: All / Fallback only (already `fallbackUsed` field on schema)
- Add "Score" summary column showing finalScore inline without requiring expand
- Add "Duration" column pulling from `gatewayTasks` join by `taskId` (requires hook extension)
- Export/copy button for audit scenarios [ASSUMED]

**Hook extension:** `useRoutingDecisionsPaginated` wraps `api.routingDecisions.listPaginated`. Adding filtering requires either a new query variant or client-side filter on the paginated result set (workable for Fallback-only filter since `fallbackUsed` is a boolean index on the table). [VERIFIED: routingDecisions table has `by_fallback` index]

### Anti-Patterns to Avoid

- **Querying raw `llmMetrics` in the spend guard instead of `aggregates`:** Raw table is slow and unbounded. Use `costByPeriodByProvider` with hourly period. [VERIFIED: SDKSpendCapGauge already uses aggregates]
- **Using `alertRuleCustom.create` (public mutation) for seed:** It requires auth identity. Use `internalMutation` directly writing to `ctx.db`. [VERIFIED: alertRuleCustom.ts:47]
- **Duplicating PROVIDER_COLORS:** Currently defined locally in `CostTrendChart.tsx`. Extract to shared location in this phase to avoid the provider badge duplicating the map.
- **Provider enable/disable as UI-only:** D-04 explicitly requires a real gateway command. The Convex mutation alone is not sufficient — `useCommandDispatch` must also fire.
- **Using `sessions.listActive` for session list badges:** Only active sessions. The provider field is also available on `sessions.listPaginated` / `sessions.listAll` for the broader sessions list if needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-to-reorder priority list | Custom mouse event handlers | `@dnd-kit/sortable` (`useSortable`, `DndContext`, `arrayMove`) | Already installed, TeamEditor.tsx has working pattern |
| Provider pill badges | Custom styled divs | shadcn/ui `Badge` with `style` color override | D-08 explicitly names Badge; consistent with all other badge use |
| Command dispatch with toast | Raw WebSocket + manual toast | `useCommandDispatch()` | Already handles ack correlation, error toast, optimistic UI |
| Sparkline bars | SVG path calculation | CSS flex bars (FlexBarChart pattern) | Project standard per UI-05; no Recharts for primary displays |
| Alert evaluation for SDK spend | New cron action | Extend `evaluateCondition` in existing `alerts.ts` | Custom rule infrastructure already runs on cron; just add the metric |

---

## Common Pitfalls

### Pitfall 1: `costByPeriod` Returns Provider-Summed Total, Not Per-Bucket

**What goes wrong:** Calling `costByPeriod({ period: "hourly", billingType: "api", lookbackDays: 1 })` returns `Record<provider, number>` — a sum across all hours, not an array of hourly buckets.
**Why it happens:** The query groups by provider and collapses time. For a sparkline you need `costByPeriodByProvider` which returns `{ bucket_start, byProvider }[]`.
**How to avoid:** Use `costByPeriodByProvider` for sparkline data. Sum all providers per bucket for the total hourly bars. Use `costByPeriod` only for the single "today's total" number.
**Warning signs:** Sparkline shows a single bar instead of 24 hourly bars.

### Pitfall 2: Auto-Alert Fires on Every Evaluation Cycle

**What goes wrong:** `evaluateCondition` for `sdk_spend_usd_today` may re-trigger the alert on every cron run once spend is at 80%, creating duplicate alert rows.
**Why it happens:** The existing `createIfNew` helper deduplicates by checking for active alerts with the same `ruleId`. Confirm this helper is used for the auto-alert rule.
**How to avoid:** The `createIfNew` function in `alerts.ts` (line 840-843) already handles dedup via `ruleId`. The auto-alert uses the `alertRuleCustom._id` as `ruleId`, which is stable. [VERIFIED: createIfNew called with customRule._id]
**Warning signs:** Alert inbox fills with duplicate "SDK Spend Guard" alerts.

### Pitfall 3: Provider Badge on Timeline Requires toolExecutions Join

**What goes wrong:** `SessionTimeline` receives `events[]` which have no `provider` field. Attempting to render a provider badge directly from `e.provider` will always be undefined.
**Why it happens:** The `events` table (hook/session events) is separate from `toolExecutions`. Provider attribution lives on `toolExecutions`.
**How to avoid:** Either (a) load `toolExecutions` for the session and join in the component by toolName + timestamp, or (b) add provider to the events ingest path. Option (a) is recommended as a lighter touch.
**Warning signs:** All provider badges render as the fallback/unknown color.

### Pitfall 4: ProviderControls Panel Auth vs. Gateway Connectivity

**What goes wrong:** Toggling a provider sends a WebSocket command that requires Astridr to be running. If gateway is offline, the command silently fails.
**Why it happens:** `useCommandDispatch` uses `sendCommand` which has no fallback for disconnected state.
**How to avoid:** Check `isConnected` from `useCommandDispatch` before sending. Still write the Convex mutation regardless (for restart recovery per D-07). Show a warning toast if gateway is disconnected.
**Warning signs:** Toggle appears to succeed (Convex write works) but gateway never receives the command.

### Pitfall 5: Seed Mutations Running on Every Deploy

**What goes wrong:** `seedSDKSpendAlert` inserts a new `alertRuleCustom` row on every deploy, creating N duplicate "SDK Spend Guard" rules.
**Why it happens:** No idempotency guard.
**How to avoid:** Check `ctx.db.query("alertRuleCustom").filter(q => q.eq(q.field("name"), "SDK Spend Guard")).first()` before inserting. Only insert if `null`.
**Warning signs:** Alerts page shows multiple "SDK Spend Guard" rules.

---

## Code Examples

### Hourly Bucket Sparkline Data (verified query)

```typescript
// Source: convex/aggregates.ts:234 — VERIFIED
const buckets = useQuery(api.aggregates.costByPeriodByProvider, {
  period: "hourly",
  lookbackHours: 24,
  billingType: "api",
}) ?? [];

// Collapse per-provider spend into total per bucket for sparkline
const sparklineData = buckets.map(b => ({
  label: new Date(b.bucket_start * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  value: Object.values(b.byProvider).reduce((s, v) => s + (v as number), 0),
}));
```

### Linear Day-End Projection (client-side)

```typescript
// Source: CONTEXT.md D-02, D-03 — computation approach ASSUMED
const dayStartEpoch = Math.floor(Date.now() / 1000 / 86400) * 86400;
const elapsedHours = (Date.now() / 1000 - dayStartEpoch) / 3600;
const todayBuckets = buckets.filter(b => b.bucket_start >= dayStartEpoch);
const todaySpend = todayBuckets.reduce(
  (sum, b) => sum + Object.values(b.byProvider).reduce((s, v) => s + (v as number), 0), 0
);
const projectedTotal = elapsedHours > 0 ? (todaySpend / elapsedHours) * 24 : 0;
const projectedHitTime = elapsedHours > 0 && todaySpend > 0
  ? new Date((dayStartEpoch + (DAILY_CAP / (todaySpend / elapsedHours)) * 3600) * 1000)
  : null;
```

### @dnd-kit/sortable Provider Priority List

```typescript
// Source: TeamEditor.tsx:64-118 — VERIFIED pattern
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableProvider({ provider }: { provider: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: provider });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-2 border border-border/50">
      <button className="cursor-grab" {...attributes} {...listeners}><GripVertical className="h-4 w-4" /></button>
      {PROVIDER_DISPLAY_NAMES[provider] ?? provider}
    </div>
  );
}

// In parent: onDragEnd calls arrayMove then persists via mutation
```

### evaluateCondition Extension (sdk_spend_usd_today)

```typescript
// Source: alerts.ts:792-821 — extend existing pattern VERIFIED
} else if (condition.metric === "sdk_spend_usd_today") {
  const dayStart = Math.floor(now / 86400) * 86400;
  const dailyRows = await ctx.db
    .query("aggregates")
    .withIndex("by_type_period_bucket", q =>
      q.eq("metric_type", "cost").eq("period", "daily").gte("bucket_start", dayStart)
    )
    .collect();
  value = dailyRows
    .filter(r => (r.dimensions as any)?.billingType === "api")
    .reduce((sum, r) => sum + r.value, 0);
  // Fallback: if no daily rollup yet (rollup runs at 01:00 UTC), sum hourly buckets instead
  if (value === 0) {
    const hourlyRows = await ctx.db
      .query("aggregates")
      .withIndex("by_type_period_bucket", q =>
        q.eq("metric_type", "cost").eq("period", "hourly").gte("bucket_start", dayStart)
      )
      .collect();
    value = hourlyRows
      .filter(r => (r.dimensions as any)?.billingType === "api")
      .reduce((sum, r) => sum + r.value, 0);
  }
}
```

---

## Runtime State Inventory

Phase 69 is not a rename/refactor phase. No runtime state audit required.

---

## Environment Availability

Phase 69 is code-only (frontend components + Convex backend). No new external tools, runtimes, or services required beyond the existing local dev stack (Vite + Convex).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 |
| Config file | vite.config.ts (vitest inferred) |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| GW-12 | `projectDayEndSpend()` returns correct linear extrapolation | unit | `npm test -- --run src/components/SDKSpendGuard.test.tsx` | Wave 0 |
| GW-12 | `classifyCapStatus` still works with same inputs (regression) | unit | `npm test -- --run src/components/SDKSpendCapGauge.test.tsx` | exists |
| GW-13 | ProviderControls renders toggle per provider from config | unit | `npm test -- --run src/components/ProviderControls.test.tsx` | Wave 0 |
| GW-14 | `evaluateCondition("sdk_spend_usd_today")` fires at 80% of cap | unit | `npm test -- --run convex/alerts.test.ts` | Wave 0 |
| GW-14 | Provider badge renders on timeline events with provider set | unit | `npm test -- --run src/components/SessionTimeline.test.tsx` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- --run src/components/SDKSpendGuard.test.tsx src/components/ProviderControls.test.tsx`
- **Per wave merge:** `npm test -- --run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/components/SDKSpendGuard.test.tsx` — covers GW-12 projection logic + classifyCapStatus regression
- [ ] `src/components/ProviderControls.test.tsx` — covers GW-13 toggle rendering
- [ ] `src/components/SessionTimeline.test.tsx` — covers GW-14 provider badge rendering
- [ ] `convex/alerts.test.ts` (or extension of alertRuleCustom.test.ts) — covers sdk_spend_usd_today metric

---

## Security Domain

Phase 69 has no new auth surfaces, no new external API calls, and no new credential handling. The `providerConfig` Convex table is operator-only (single-tenant dashboard per REQUIREMENTS.md Out of Scope). The WebSocket command for provider enable/disable uses the existing authenticated WebSocket channel (RT-02 — JWT/service-role key authentication already in place).

No ASVS categories newly triggered by this phase.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Sparkline should use CSS flex bars (not inline SVG or Recharts) | Standard Stack / Pattern 1 | Low — any approach works; planner should pick based on existing FlexBarChart reuse |
| A2 | Overshoot warning rendered inline in the card, not as a toast | Pattern 1 | Low — user said Claude's discretion; inline is more persistent and appropriate |
| A3 | Provider badge join to toolExecutions by toolName + timestamp proximity (not events ingest change) | Pattern 3 / Common Pitfalls | Medium — if toolName+timestamp join is too noisy, may need a different join key or events ingest change |
| A4 | codex/antigravity model names are "gpt-4o" for seed data | Pattern 5 | Low — seed data is editable after creation |
| A5 | PROVIDER_COLORS extracted to shared module (currently local in CostTrendChart.tsx) | Pattern 3 | Low — can be duplicated temporarily, but creates drift risk |
| A6 | sdk_spend_usd_today falls back to hourly sum when daily rollup not yet computed | Pattern 4 / Code Examples | Medium — if hourly sum is also empty (very early in day), alert never fires until rollup runs at 01:00 UTC |
| A7 | RoutingDecisionsTable upgrade adds Fallback filter pill + inline finalScore column | Pattern 6 | Low — Claude's discretion; any audit-useful columns work |

---

## Open Questions (RESOLVED)

1. **Where does the `providerConfig` seed run?**
   - What we know: Must be an `internalMutation`. Can be triggered by a button in Settings ("Initialize Gateway Defaults") or run automatically on schema deploy.
   - What's unclear: Convex doesn't have a native "run on schema push" hook. Options: (a) one-time Settings button, (b) Convex cron that checks and seeds once, (c) manually triggered via dashboard.
   - Recommendation: Add a "Seed Gateway Defaults" button to the Gateway Providers section in Settings that calls an HTTP action or mutation. Visible only when providerConfig table is empty.
   - RESOLVED: A public mutation wrapper (`runSeed`) will be added to `convex/seedGateway.ts` that calls both `seedSDKSpendAlert` and `seedGatewayProfiles` internally. The ProviderControls component in Plan 03 will show a "Seed Gateway Defaults" button when the providerConfig table is empty (0 configs returned). The button calls `runSeed` via `useMutation`. This is a one-time operator action, consistent with how the existing seed pattern in `seedTeams.ts` works.

2. **Does the gateway actually expose a provider enable/disable command over WebSocket?**
   - What we know: D-04 says the command must be real. The WebSocket command sender pattern exists. The gateway-side endpoint would be a new command type in Astridr.
   - What's unclear: Whether the Astridr CLI Gateway (feature/cli-gateway branch) already handles `gateway.provider.set_enabled` or whether this requires cross-repo work.
   - Recommendation: Plan the Convex + frontend side completely. Flag the gateway-side command as requiring Astridr cross-repo task (like Phase 66 CLIGatewayTool work). If gateway command not yet implemented, provider disable still persists to Convex for gateway restart recovery.
   - RESOLVED: The CodePulse side will dispatch `gateway.provider.set_enabled` via `useCommandDispatch`. The gateway-side handler is a cross-repo Astridr task (same pattern as Phase 66 CLIGatewayTool). If the gateway does not yet handle this command type, the command will be sent but not acknowledged -- `useCommandDispatch` already handles ack timeout gracefully. The Convex `providerConfig` write ensures the state persists regardless of gateway connectivity (D-07).

3. **Session timeline provider attribution — toolExecutions join key precision**
   - What we know: `toolExecutions` has `sessionId`, `toolName`, `timestamp`, `provider`. `events` has `sessionId`, `toolName`, `timestamp`.
   - What's unclear: Multiple tool calls to the same tool in the same session will have multiple toolExecution rows. Matching by toolName alone would be ambiguous.
   - Recommendation: Match by `sessionId + toolName + timestamp` within a +-1 second window. If no match found, fall back to session-level provider. Document this as an approximation.
   - RESOLVED: Plan 04 Task 1 uses `sessionId + toolName + Math.round(timestamp)` as a composite key for the provider lookup map. This provides per-second precision which is sufficient for distinguishing sequential tool calls. For the rare case of multiple calls to the same tool within the same second, the first match wins. This is an acceptable approximation documented in the plan.

---

## Sources

### Primary (HIGH confidence)
- `convex/schema.ts` — all table structures verified in-session
- `convex/aggregates.ts` — costByPeriod, costByPeriodByProvider queries verified
- `convex/alertRuleCustom.ts` — create mutation auth gate verified
- `convex/alerts.ts` — evaluateCondition metric names verified
- `src/components/SDKSpendCapGauge.tsx` — existing component structure verified
- `src/components/CostTrendChart.tsx` — PROVIDER_COLORS map verified
- `src/components/RoutingDecisionsTable.tsx` — current state verified
- `src/components/hr/TeamEditor.tsx` — @dnd-kit/sortable pattern verified
- `src/hooks/useCommandDispatch.ts` — command dispatch pattern verified
- `src/lib/providers.ts` — provider registry verified
- `.planning/phases/69-sdk-spend-guard-multi-provider-ux/69-CONTEXT.md` — all decisions

### Secondary (MEDIUM confidence)
- `.planning/phases/68-gateway-observability/68-CONTEXT.md` — Phase 68 patterns and decisions
- `.planning/ROADMAP.md` — GW-12/13/14 requirements and phase scope

### Tertiary (LOW confidence)
- Sparkline implementation approach — training knowledge, not verified against a specific doc

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified present in codebase
- Architecture: HIGH — all integration points verified against actual source files
- Pitfalls: HIGH — all three critical pitfalls verified against actual code
- Assumptions: MEDIUM — 7 assumptions logged, all low-to-medium risk

**Research date:** 2026-05-23
**Valid until:** 2026-06-23 (stable codebase, no fast-moving external deps)
