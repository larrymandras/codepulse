# Phase 69: SDK Spend Guard & Multi-Provider UX - Pattern Map

**Mapped:** 2026-05-23
**Files analyzed:** 12 new/modified files
**Analogs found:** 11 / 12

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/SDKSpendGuard.tsx` | component | request-response | `src/components/SDKSpendCapGauge.tsx` | exact (in-place upgrade) |
| `src/components/SDKSpendGuard.test.tsx` | test | — | `src/components/SDKSpendCapGauge.test.tsx` | exact |
| `src/components/ProviderControls.tsx` | component | event-driven | `src/components/ProviderHealthPanel.tsx` + `src/components/hr/TeamEditor.tsx` | role-match (composite) |
| `src/components/ProviderControls.test.tsx` | test | — | existing `.test.tsx` files | role-match |
| `src/components/SessionTimeline.tsx` | component | request-response | `src/components/SessionTimeline.tsx` (modify in-place) | exact (modify) |
| `src/hooks/useProviderConfig.ts` | hook | CRUD | `src/hooks/useRoutingDecisions.ts` | role-match |
| `convex/providerConfig.ts` | service | CRUD | `convex/alertRuleCustom.ts` (upsert pattern) | role-match |
| `convex/schema.ts` | config | — | `convex/schema.ts` (add table) | exact (modify) |
| `convex/alerts.ts` | service | event-driven | `convex/alerts.ts` (extend evaluateCondition) | exact (modify) |
| `convex/seedGateway.ts` | utility | batch | `convex/seedTeams.ts` + `convex/migrations.ts` | exact |
| `src/components/RoutingDecisionsTable.tsx` | component | request-response | `src/components/RoutingDecisionsTable.tsx` (modify in-place) | exact (modify) |
| `src/lib/providers.ts` | utility | — | `src/lib/providers.ts` + `src/components/CostTrendChart.tsx` | exact (modify) |

---

## Pattern Assignments

### `src/components/SDKSpendGuard.tsx` (component, request-response)

**Analog:** `src/components/SDKSpendCapGauge.tsx` — in-place upgrade. Keep the file, rename the default export. The existing component is 87 lines.

**Imports pattern** (lines 1-4):
```typescript
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatCost } from "../lib/formatters";
import { Badge } from "./ui/badge";
```
Add `PROVIDER_COLORS` import from `src/lib/providers.ts` (after PROVIDER_COLORS is extracted there).

**Exports to preserve** (lines 6-18):
```typescript
export const DAILY_CAP = 5.00;
export const ALERT_THRESHOLD = 0.8;  // D-04: 80% = $4 auto-alert

export function classifyCapStatus(
  todaySpend: number,
  cap: number,
  alertThreshold: number
): "ok" | "warning" | "exceeded" {
  if (todaySpend >= cap) return "exceeded";
  if (todaySpend >= cap * alertThreshold) return "warning";
  return "ok";
}
```
These are imported by `SDKSpendCapGauge.test.tsx` — do not move or rename.

**Core data pattern — replace `costByPeriod` with `costByPeriodByProvider`:**
```typescript
// OLD (single total, not per-bucket):
const data = useQuery(api.aggregates.costByPeriod, {
  period: "daily", billingType: "api", lookbackDays: 1,
});

// NEW (hourly buckets for sparkline):
const buckets = useQuery(api.aggregates.costByPeriodByProvider, {
  period: "hourly", lookbackHours: 24, billingType: "api",
}) ?? [];
```

**Gauge bar pattern** (lines 62-74) — reuse exactly:
```typescript
<div className="relative min-h-[48px] flex items-center gap-3">
  <div className="flex-1 relative">
    <div className="h-2 bg-muted rounded-none overflow-hidden">
      <div className={`h-full transition-all ${barColor}`} style={{ width: `${percentage}%` }} />
    </div>
    {/* 80% threshold marker per UI-SPEC */}
    <div className="absolute top-0 w-px h-full bg-[--status-warn] opacity-70" style={{ left: "80%" }} />
  </div>
  <Badge variant={badgeVariant} className={status === "warning" ? "text-[--status-warn]" : undefined}>
    {statusLabel}
  </Badge>
</div>
```

**Sparkline pattern — use FlexBarChart** (from `src/components/FlexBarChart.tsx`):
```typescript
import { FlexBarChart } from "./FlexBarChart";

// Build sparkline data: one bar per hourly bucket
const sparklineData = buckets.map(b => ({
  label: new Date(b.bucket_start * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  value: Object.values(b.byProvider).reduce((s, v) => s + (v as number), 0),
}));

// Render at reduced height (not the full 300px of CostTrendChart)
<FlexBarChart data={sparklineData} height={48} />
```

**Projection + inline overshoot warning:**
```typescript
const dayStartEpoch = Math.floor(Date.now() / 1000 / 86400) * 86400;
const elapsedHours = (Date.now() / 1000 - dayStartEpoch) / 3600;
const todayBuckets = buckets.filter(b => b.bucket_start >= dayStartEpoch);
const todaySpend = todayBuckets.reduce(
  (sum, b) => sum + Object.values(b.byProvider).reduce((s, v) => s + (v as number), 0), 0
);
const projectedTotal = elapsedHours > 0 ? (todaySpend / elapsedHours) * 24 : 0;
const willExceedCap = projectedTotal > DAILY_CAP;
const projectedHitTime = elapsedHours > 0 && todaySpend > 0
  ? new Date((dayStartEpoch + (DAILY_CAP / (todaySpend / elapsedHours)) * 3600) * 1000)
  : null;

// Render inline warning (not toast — card is always visible):
{willExceedCap && projectedHitTime && (
  <p className="text-xs text-[--status-warn] mt-1">
    At current rate, you'll exceed {formatCost(DAILY_CAP)} by ~{projectedHitTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
  </p>
)}
```

**Loading state pattern** (lines 28-35) — reuse exactly:
```typescript
if (data === undefined) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-normal uppercase tracking-wide text-muted-foreground">SDK Daily Cap</h3>
      <p className="text-sm text-muted-foreground text-center">Loading...</p>
    </div>
  );
}
```

---

### `src/components/SDKSpendGuard.test.tsx` (test)

**Analog:** Existing `src/components/SDKSpendCapGauge.test.tsx` (imports `classifyCapStatus`, `DAILY_CAP`, `ALERT_THRESHOLD`). The new test file is an addition that covers the new `projectDayEndSpend()` function.

**Test structure to follow** — import the same exports plus the new pure projection function:
```typescript
import { classifyCapStatus, DAILY_CAP, ALERT_THRESHOLD } from "./SDKSpendGuard";
// or re-export shim from SDKSpendCapGauge.tsx if keeping backward compat

describe("projectDayEndSpend", () => {
  it("returns projected total based on elapsed hours and current spend", ...);
  it("returns 0 when elapsedHours is 0", ...);
  it("flags willExceedCap when projected > DAILY_CAP", ...);
});

describe("classifyCapStatus regression", () => {
  // copy existing tests verbatim — these must still pass
});
```

---

### `src/components/ProviderControls.tsx` (component, event-driven)

**Analog 1:** `src/components/ProviderHealthPanel.tsx` — provider card layout, `ALL_PROVIDERS` iteration, billingBadge pattern (lines 1-151).

**Analog 2:** `src/components/hr/TeamEditor.tsx` — `@dnd-kit/sortable` drag-to-reorder pattern (lines 1-21, 64-119, 194-228).

**Imports pattern** — composite of both analogs:
```typescript
import { memo } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable,
  arrayMove, sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";
import { useCommandDispatch } from "../hooks/useCommandDispatch";
import { useProviderConfig } from "../hooks/useProviderConfig";
import { GATEWAY_PROVIDERS, PROVIDER_DISPLAY_NAMES } from "../lib/providers";
import { Badge } from "./ui/badge";
import SectionErrorBoundary from "./SectionErrorBoundary";
```

**Settings page section wrapper** — from `src/pages/Settings.tsx` lines 150-154:
```typescript
<div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 mt-12">
  <div className="space-y-4">
    <div className="flex items-center gap-2 border-b border-border pb-2">
      <h3 className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
        Gateway Providers
      </h3>
    </div>
    {/* content */}
  </div>
</div>
```

**Toggle pattern** — from `src/pages/Settings.tsx` lines 22-52 (Toggle component):
```typescript
function Toggle({ enabled, onToggle, label }: { enabled: boolean; onToggle: () => void; label: string }) {
  return (
    <button onClick={onToggle} className="flex items-center justify-between w-full py-1.5 group">
      <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">{label}</span>
      <div className={`w-9 h-5 rounded-full transition-colors relative ${enabled ? "bg-indigo-600" : "bg-gray-700"}`}>
        <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${enabled ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
      </div>
    </button>
  );
}
```

**@dnd-kit/sortable item pattern** — from `src/components/hr/TeamEditor.tsx` lines 64-119 (SortableMember). Adapt for providers:
```typescript
function SortableProvider({ provider, enabled, onToggle }: SortableProviderProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: provider });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style}
      className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/60 backdrop-blur p-2.5 shadow-sm hover:border-primary/50 transition-colors group">
      <button className="cursor-grab text-muted-foreground/50 hover:text-primary transition-colors" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" />
      </button>
      {/* provider name + toggle */}
    </div>
  );
}
```

**DndContext wiring** — from `src/components/hr/TeamEditor.tsx` lines 194-228:
```typescript
const sensors = useSensors(
  useSensor(PointerSensor),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
);

const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
  if (!over || active.id === over.id) return;
  const oldIndex = orderedProviders.indexOf(String(active.id));
  const newIndex = orderedProviders.indexOf(String(over.id));
  const reordered = arrayMove(orderedProviders, oldIndex, newIndex);
  setOrderedProviders(reordered);
  // persist via mutation
  setPriorityOrder({ providers: reordered });
};
```

**Command dispatch for gateway** — from `src/hooks/useCommandDispatch.ts`:
```typescript
const { dispatch, isConnected } = useCommandDispatch();

const handleToggle = async (provider: string, enabled: boolean) => {
  // Always write to Convex (persists for gateway restart recovery per D-07)
  await setProviderEnabled({ provider, enabled });
  // Then send gateway command if connected (D-04)
  if (isConnected) {
    await dispatch(
      { type: "gateway.provider.set_enabled", provider, enabled },
      enabled ? `${PROVIDER_DISPLAY_NAMES[provider]} enabled` : `${PROVIDER_DISPLAY_NAMES[provider]} disabled`
    );
  } else {
    toast.warning("Gateway offline — setting saved, will apply on reconnect");
  }
};
```

**Provider color badge** — from `src/components/CostTrendChart.tsx` lines 7-15 (use `PROVIDER_COLORS` after extraction to `src/lib/providers.ts`):
```typescript
import { Badge } from "./ui/badge";
// After PROVIDER_COLORS extracted to providers.ts:
<Badge variant="outline" className="text-[10px] font-mono"
  style={{ borderColor: PROVIDER_COLORS[provider], color: PROVIDER_COLORS[provider] }}>
  {PROVIDER_DISPLAY_NAMES[provider] ?? provider}
</Badge>
```

---

### `src/components/ProviderControls.test.tsx` (test)

**Analog:** Pattern from existing `.test.tsx` files in `src/components/`. Wave 0 stub — render test only.

```typescript
import { describe, it, expect, vi } from "vitest";
// Mock convex hooks
vi.mock("convex/react", () => ({ useMutation: vi.fn(() => vi.fn()), useQuery: vi.fn(() => []) }));
vi.mock("../contexts/AstridrWSContext", () => ({ useAstridrWS: vi.fn(() => ({ sendCommand: vi.fn(), status: "disconnected" })) }));

describe("ProviderControls", () => {
  it("renders a toggle for each gateway provider", ...);
  it("renders a drag handle per provider", ...);
});
```

---

### `src/components/SessionTimeline.tsx` (component, in-place modify)

**Analog:** Self — modify in place. Current file is 124 lines.

**Provider badge insertion point** — within the event row (lines 92-118), after `e.toolName` display:
```typescript
// EXISTING row structure (lines 100-116):
<div className="flex items-center gap-2 min-w-0 flex-1">
  <span className={getEventColor(e.eventType)}>{getEventIcon(e.eventType)}</span>
  <span className="text-xs font-mono text-gray-300 shrink-0">{e.eventType}</span>
  {e.toolName && (
    <span className="text-xs text-gray-500 shrink-0">{e.toolName}</span>
  )}
  {/* ADD: provider badge after toolName */}
  {e.provider && (
    <Badge variant="outline" className="text-[10px] font-mono shrink-0"
      style={{ borderColor: PROVIDER_COLORS[e.provider], color: PROVIDER_COLORS[e.provider] }}>
      {PROVIDER_DISPLAY_NAMES[e.provider] ?? e.provider}
    </Badge>
  )}
  ...
</div>
```

**Props change required** — `SessionTimelineProps` must gain `toolExecutions`:
```typescript
interface SessionTimelineProps {
  events: any[];
  agents: any[];
  toolExecutions?: any[];  // ADD: for provider join (D-09)
}
```

**toolExecutions join logic** — add before `return` statement:
```typescript
// Build a map: sessionId+toolName+timestamp → provider
// Match within ±1 second window (A3 in RESEARCH.md assumptions)
const toolExecMap = useMemo(() => {
  const map = new Map<string, string>();
  for (const te of toolExecutions ?? []) {
    if (te.provider) {
      map.set(`${te.toolName}:${Math.round(te.timestamp)}`, te.provider);
    }
  }
  return map;
}, [toolExecutions]);

// Then resolve provider per event:
const getEventProvider = (e: any): string | null => {
  if (!e.toolName) return null;
  const key = `${e.toolName}:${Math.round(e.timestamp)}`;
  return toolExecMap.get(key) ?? null;
};
```

**SessionDetail.tsx update** — add `toolExecutions` query and pass down:
```typescript
// In SessionDetail.tsx, add query:
const toolExecutions = useQuery(api.toolExecutions.listBySession,
  id && activeTab === "timeline" ? { sessionId: id } : "skip"
) ?? [];

// Pass to SessionTimeline:
<SessionTimeline events={events} agents={agents} toolExecutions={toolExecutions} />
```

---

### `src/hooks/useProviderConfig.ts` (hook, CRUD)

**Analog:** `src/hooks/useRoutingDecisions.ts` — `usePaginatedQuery` wrapper pattern. For providerConfig, use `useQuery` (not paginated — small table).

**Pattern** (adapt from `src/hooks/useActiveSessions.ts` and `src/hooks/useRoutingDecisions.ts`):
```typescript
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useProviderConfig() {
  const configs = useQuery(api.providerConfig.list) ?? [];
  const setEnabled = useMutation(api.providerConfig.setEnabled);
  const setPriority = useMutation(api.providerConfig.setPriority);
  return { configs, setEnabled, setPriority };
}
```

---

### `convex/providerConfig.ts` (service, CRUD)

**Analog:** `convex/alertRuleCustom.ts` — upsert-via-index pattern (lines 45-65). Also see `convex/seedTeams.ts` for idempotency guard.

**Imports pattern:**
```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
```
No auth gate needed — single-tenant dashboard (REQUIREMENTS.md).

**Upsert mutation** — copy from `alertRuleCustom.ts` upsert style:
```typescript
export const setEnabled = mutation({
  args: { provider: v.string(), enabled: v.boolean() },
  handler: async (ctx, { provider, enabled }) => {
    const existing = await ctx.db
      .query("providerConfig")
      .withIndex("by_provider", q => q.eq("provider", provider))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { enabled, updatedAt: Date.now() / 1000 });
    } else {
      await ctx.db.insert("providerConfig", {
        provider, enabled, priority: 999, updatedAt: Date.now() / 1000,
      });
    }
  },
});
```

**List query:**
```typescript
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("providerConfig").withIndex("by_priority").collect();
  },
});
```

---

### `convex/schema.ts` (config, modify)

**Analog:** Self — add one new table. Follow the `defineTable` pattern at line 1 and any table from lines 8-350.

**New table to add** (pattern from lines 247-253 — `agentConfigs` as closest shape):
```typescript
providerConfig: defineTable({
  provider: v.string(),       // matches AnyProvider keys from providers.ts
  enabled: v.boolean(),
  priority: v.float64(),      // lower number = higher priority
  updatedAt: v.float64(),
})
  .index("by_provider", ["provider"])
  .index("by_priority", ["priority"]),
```

---

### `convex/alerts.ts` (service, event-driven, modify)

**Analog:** Self — extend `evaluateCondition` at lines 792-821. The function is defined identically twice (lines 792 and 943 — two separate cron jobs). Both must be updated.

**Extension — add after `error_count` branch** (lines 809-811):
```typescript
// EXISTING (lines 803-811):
if (condition.metric === "error_rate") {
  value = ...;
} else if (condition.metric === "event_count") {
  value = windowEvents.length;
} else if (condition.metric === "error_count") {
  value = windowEvents.filter(...).length;
}
// ADD:
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
  // Fallback: daily rollup runs at 01:00 UTC; sum hourly if daily not yet available
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

**CRITICAL:** `evaluateCondition` is currently a synchronous function (lines 792-821). Adding an `await` inside it requires making it `async`. The `.map(evaluateCondition)` calls at lines 829 and 836 will also need to become `await Promise.all(conditions.map(evaluateCondition))`. Apply same change to the duplicate at lines 943+.

---

### `convex/seedGateway.ts` (utility, batch)

**Analog:** `convex/seedTeams.ts` — idempotency-guarded seed with `by_profileId` index check (lines 116-157). Plus `convex/migrations.ts` lines 1-3 for `internalMutation` import.

**Imports pattern:**
```typescript
import { internalMutation } from "./_generated/server";
import { DAILY_CAP, ALERT_THRESHOLD } from "../src/components/SDKSpendGuard";
// or inline the values directly to avoid cross-boundary import:
const DAILY_CAP = 5.00;
const ALERT_THRESHOLD = 0.8;
```

**Gateway profile seed** — copy `seedTeams.ts` pattern (lines 116-156), substitute gateway agents:
```typescript
const GATEWAY_PROFILES = [
  { profileId: "claude-cli",   name: "Claude CLI",   model: "claude-opus-4-6",   displayName: "Claude CLI — Subscription" },
  { profileId: "codex",        name: "Codex CLI",    model: "gpt-4o",            displayName: "Codex CLI — Subscription" },
  { profileId: "antigravity",  name: "Antigravity",  model: "gpt-4o",            displayName: "Antigravity CLI — Subscription" },
  { profileId: "claude-sdk",   name: "Claude SDK",   model: "claude-sonnet-4-6", displayName: "Claude SDK — API" },
];

export const seedGatewayProfiles = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now() / 1000;
    let count = 0;
    for (const agent of GATEWAY_PROFILES) {
      const existing = await ctx.db
        .query("agentProfiles")
        .withIndex("by_profileId", q => q.eq("profileId", agent.profileId))
        .first();
      if (existing) continue;  // idempotency: skip if exists
      await ctx.db.insert("agentProfiles", {
        profileId: agent.profileId,
        name: agent.name,
        displayName: agent.displayName,
        model: agent.model,
        createdAt: now,
        updatedAt: now,
      });
      count++;
    }
    return { seeded: count };
  },
});
```

**SDK spend alert seed** — `internalMutation` writing directly to `ctx.db` (bypasses `alertRuleCustom.create` auth gate at `alertRuleCustom.ts:47`):
```typescript
export const seedSDKSpendAlert = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Idempotency guard (per RESEARCH.md Pitfall 5)
    const existing = await ctx.db
      .query("alertRuleCustom")
      .filter(q => q.eq(q.field("name"), "SDK Spend Guard"))
      .first();
    if (existing) return { seeded: false, message: "SDK Spend Guard rule already exists" };

    const now = Date.now() / 1000;
    await ctx.db.insert("alertRuleCustom", {
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
      createdAt: now,
      updatedAt: now,
    });
    return { seeded: true };
  },
});
```

**Trigger pattern** — expose as a Settings button (not auto-run on deploy, per RESEARCH.md Open Question 1). Add a Settings section button that calls a public `mutation` wrapper or an HTTP action that internally calls these `internalMutation`s. Show the button only when `providerConfig` table is empty.

---

### `src/components/RoutingDecisionsTable.tsx` (component, in-place modify)

**Analog:** Self — upgrade in place. Current file is 117 lines with expandable rows already built.

**Filter pill pattern** — add above `<Table>` (follow the agent filter pill style in `SessionTimeline.tsx` lines 56-84):
```typescript
// Pill filter state:
const [fallbackFilter, setFallbackFilter] = useState<"all" | "fallback">("all");

// Filter pills:
<div className="flex gap-2 mb-3">
  {["all", "fallback"].map((f) => (
    <button key={f}
      onClick={() => setFallbackFilter(f as "all" | "fallback")}
      className={`text-xs px-2 py-1 rounded font-mono transition-colors ${
        fallbackFilter === f
          ? "bg-purple-400/20 text-purple-300 border border-purple-500/40"
          : "bg-gray-700/50 text-gray-400 border border-gray-600/30 hover:bg-gray-700/80"
      }`}>
      {f === "all" ? "All" : "Fallback only"}
    </button>
  ))}
</div>
```

**Filtered decisions:**
```typescript
const filteredDecisions = fallbackFilter === "fallback"
  ? decisions.filter(d => d.fallbackUsed)
  : decisions;
```

**Inline finalScore column** — add a `Score` column header and cell (upgrade from expand-only):
```typescript
// In TableHeader:
<TableHead>Score</TableHead>

// In TableRow:
<TableCell className="font-mono text-xs tabular-nums text-gray-400">
  {d.finalScore?.toFixed(3) ?? "—"}
</TableCell>
```
Update the `colSpan` in the expanded row from `5` to `6` to match the new column count.

---

### `src/lib/providers.ts` (utility, modify)

**Analog:** Self + `src/components/CostTrendChart.tsx` lines 7-15 (PROVIDER_COLORS currently defined there).

**Extract `PROVIDER_COLORS`** from `CostTrendChart.tsx` to `src/lib/providers.ts`:
```typescript
// ADD to src/lib/providers.ts (after existing exports):

/** Provider family colors. Used by CostTrendChart, provider badges, and ProviderControls. */
export const PROVIDER_COLORS: Record<string, string> = {
  "claude-cli":       "#10b981",   // emerald
  "claude-sdk":       "#10b981",   // emerald
  "codex":            "#22c55e",   // green (GPT family)
  "antigravity":      "#06b6d4",   // cyan
  "anthropic_direct": "#f59e0b",   // gold/amber
  "openrouter":       "#a855f7",   // purple (Gemini family)
  "ollama":           "#6b7280",   // gray
};
```

**Update `CostTrendChart.tsx`** to import instead of define locally:
```typescript
// Replace local PROVIDER_COLORS definition (lines 7-15) with:
import { PROVIDER_COLORS } from "../lib/providers";
```

---

## Shared Patterns

### Provider Color Badge
**Source:** `src/components/CostTrendChart.tsx` lines 7-15 (PROVIDER_COLORS) + `src/components/SDKSpendCapGauge.tsx` lines 77-82 (Badge usage)
**Apply to:** `SDKSpendGuard.tsx`, `ProviderControls.tsx`, `SessionTimeline.tsx`, session list rows

```typescript
import { Badge } from "./ui/badge";
import { PROVIDER_COLORS, PROVIDER_DISPLAY_NAMES } from "../lib/providers";

<Badge
  variant="outline"
  className="text-[10px] font-mono shrink-0"
  style={{ borderColor: PROVIDER_COLORS[provider] ?? "#6b7280", color: PROVIDER_COLORS[provider] ?? "#6b7280" }}
>
  {PROVIDER_DISPLAY_NAMES[provider] ?? provider}
</Badge>
```

### Convex Upsert Pattern
**Source:** `convex/alertRuleCustom.ts` lines 45-65 (query-by-index, patch-if-exists, insert-if-not)
**Apply to:** `convex/providerConfig.ts` all mutations

```typescript
const existing = await ctx.db
  .query("tableName")
  .withIndex("by_key", q => q.eq("key", value))
  .first();
if (existing) {
  await ctx.db.patch(existing._id, { ...fields, updatedAt: Date.now() / 1000 });
} else {
  await ctx.db.insert("tableName", { ...fields, updatedAt: Date.now() / 1000 });
}
```

### Seed Idempotency Guard
**Source:** `convex/seedTeams.ts` lines 119-125
**Apply to:** `convex/seedGateway.ts` both seed functions

```typescript
const existing = await ctx.db
  .query("agentProfiles")
  .withIndex("by_profileId", q => q.eq("profileId", "target-id"))
  .first();
if (existing) return { seeded: false, message: "Already seeded" };
```

### Settings Page Section Wrapper
**Source:** `src/pages/Settings.tsx` lines 150-154
**Apply to:** `ProviderControls.tsx` when mounted in Settings

```typescript
<div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 mt-12">
  <div className="space-y-4">
    <div className="flex items-center gap-2 border-b border-border pb-2">
      <h3 className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
        Gateway Providers
      </h3>
    </div>
    <SectionErrorBoundary name="Gateway Providers">
      <ProviderControls />
    </SectionErrorBoundary>
  </div>
</div>
```

### Command Dispatch with Gateway-Offline Guard
**Source:** `src/hooks/useCommandDispatch.ts` lines 12-33
**Apply to:** `ProviderControls.tsx` enable/disable handler

```typescript
const { dispatch, isConnected } = useCommandDispatch();

// Always persist to Convex first (restart recovery per D-07)
await convexMutation({ ... });

// Then gate gateway command on connection state
if (isConnected) {
  await dispatch({ type: "gateway.provider.set_enabled", ... }, successMsg);
} else {
  toast.warning("Gateway offline — setting saved, will apply on reconnect");
}
```

### internalMutation for Seeding Without Auth
**Source:** `convex/migrations.ts` lines 1, 9-12
**Apply to:** `convex/seedGateway.ts`

```typescript
import { internalMutation } from "./_generated/server";

export const myInternalSeed = internalMutation({
  args: {},
  handler: async (ctx) => {
    // writes directly to ctx.db — no auth.getUserIdentity() check
  },
});
```

---

## No Analog Found

All files have analogs. No new technology patterns required.

| File | Role | Data Flow | Note |
|------|------|-----------|------|
| `convex/seedGateway.ts` | utility | batch | Closest analog is `convex/seedTeams.ts` but uses `internalMutation` instead of public `mutation` — slight pattern variation, fully covered above |

---

## Metadata

**Analog search scope:** `src/components/`, `src/hooks/`, `src/pages/`, `src/lib/`, `convex/`
**Files read:** 16 source files
**Pattern extraction date:** 2026-05-23
