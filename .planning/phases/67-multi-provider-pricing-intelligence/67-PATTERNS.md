# Phase 67: Multi-Provider Pricing & Intelligence - Pattern Map

**Mapped:** 2026-05-22
**Files analyzed:** 12 new/modified files
**Analogs found:** 12 / 12

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `convex/lib/providers.ts` | utility/registry | transform | `src/lib/providers.ts` (frontend mirror) | exact |
| `src/lib/providers.ts` | utility/registry | transform | `convex/lib/providers.ts` (backend origin) | exact |
| `src/lib/modelPricing.ts` | utility | transform | self (extend existing) | exact |
| `convex/schema.ts` | config/schema | CRUD | self (add optional field to llmMetrics) | exact |
| `convex/llm.ts` | service | CRUD | self (extend `recordCall`) | exact |
| `convex/aggregates.ts` | service | batch | self (extend `computeHourly` + `costByPeriod`) | exact |
| `convex/forecasts.ts` | service | request-response | self (extend `costForecast` filter) | exact |
| `convex/briefings.ts` | service | event-driven | self (surgical validation fix) | exact |
| `convex/memoryQuality.ts` | service | event-driven | `convex/briefings.ts` (same LLM dual-provider pattern) | role-match |
| `src/components/TokenWaterfall.tsx` | component | transform | self (extend MODEL_COLORS + grouping) | exact |
| `src/components/AgentProfileEditor.tsx` | component | CRUD | self (extend MODELS array) | exact |
| `src/components/SDKSpendCapGauge.tsx` | component | request-response | `src/components/CostForecastPanel.tsx` | role-match |
| `src/pages/Analytics.tsx` | page | request-response | self (add split-view queries) | exact |
| `src/lib/providerLocations.ts` | utility | transform | self (add gateway provider entries) | exact |
| `convex/analytics.ts` | service/query | request-response | self (add `provider` field to `tokenWaterfall` return) | exact |

---

## Pattern Assignments

### `convex/lib/providers.ts` (utility/registry, transform)

**Analog:** `src/lib/providers.ts` (frontend mirror, same structure)

**Current file** (lines 1–24 — read in full):
```typescript
export const GATEWAY_PROVIDERS = [
  "claude-cli",
  "codex",
  "antigravity",
  "claude-sdk",
] as const;

export const LEGACY_PROVIDERS = [
  "anthropic_direct",
  "openrouter",
  "ollama",
] as const;

export const ALL_PROVIDERS = [...LEGACY_PROVIDERS, ...GATEWAY_PROVIDERS] as const;

export type GatewayProvider = (typeof GATEWAY_PROVIDERS)[number];
export type LegacyProvider = (typeof LEGACY_PROVIDERS)[number];
export type AnyProvider = (typeof ALL_PROVIDERS)[number];
```

**Pattern to add** — copy the typed const record pattern already used for GATEWAY_PROVIDERS:
```typescript
// Add after existing exports — same pattern as GATEWAY_PROVIDERS typed const
export const PROVIDER_BILLING: Record<AnyProvider, "api" | "subscription"> = {
  "anthropic_direct": "api",
  "openrouter":       "api",
  "ollama":           "subscription",  // local inference — no billing
  "claude-sdk":       "api",
  "claude-cli":       "subscription",
  "codex":            "subscription",
  "antigravity":      "subscription",
};

export function getBillingType(provider: string): "api" | "subscription" {
  return (PROVIDER_BILLING as Record<string, "api" | "subscription">)[provider] ?? "api";
}
```

**Important:** This same block must be added to `src/lib/providers.ts` identically (see Pitfall 6 in RESEARCH.md).

---

### `src/lib/providers.ts` (utility/registry, transform)

**Analog:** `convex/lib/providers.ts` (backend origin)

**Current file** (lines 1–19 — read in full):
```typescript
/** Frontend mirror of convex/lib/providers.ts — keep in sync. */
export const GATEWAY_PROVIDERS = ["claude-cli", "codex", "antigravity", "claude-sdk"] as const;
export const LEGACY_PROVIDERS = ["anthropic_direct", "openrouter", "ollama"] as const;
export const ALL_PROVIDERS = [...LEGACY_PROVIDERS, ...GATEWAY_PROVIDERS] as const;

export type GatewayProvider = (typeof GATEWAY_PROVIDERS)[number];
export type LegacyProvider = (typeof LEGACY_PROVIDERS)[number];
export type AnyProvider = (typeof ALL_PROVIDERS)[number];

/** Display name mapping for UI rendering. Raw key used if not in map. */
export const PROVIDER_DISPLAY_NAMES: Record<string, string> = { ... };
```

**Pattern to add** — identical PROVIDER_BILLING block as backend, after PROVIDER_DISPLAY_NAMES.

---

### `src/lib/modelPricing.ts` (utility, transform)

**Analog:** self (extend)

**Current file** (lines 1–15 — read in full):
```typescript
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-5":   { input: 15.00 / 1_000_000, output: 75.00 / 1_000_000 },
  "claude-sonnet-4-5": { input:  3.00 / 1_000_000, output: 15.00 / 1_000_000 },
  "claude-haiku-3-5":  { input:  0.80 / 1_000_000, output:  4.00 / 1_000_000 },
  "default":           { input:  3.00 / 1_000_000, output: 15.00 / 1_000_000 },
};

export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  model: string
): number {
  const rates = PRICING[model] ?? PRICING["default"];
  return inputTokens * rates.input + outputTokens * rates.output;
}
```

**Pattern to add** — extend PRICING record with 4 new entries, add `billingType` param to `estimateCost`:
```typescript
// Add to PRICING record (D-11):
"gpt-4o":           { input:  2.50 / 1_000_000, output: 10.00 / 1_000_000 },
"gpt-4o-mini":      { input:  0.15 / 1_000_000, output:  0.60 / 1_000_000 },
"gemini-2.5-pro":   { input:  1.25 / 1_000_000, output: 10.00 / 1_000_000 },
"gemini-2.5-flash": { input:  0.15 / 1_000_000, output:  0.60 / 1_000_000 }, // [ASSUMED] — confirm with Larry before locking

// New signature (D-12) — copy the exact existing guard pattern:
export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  model: string,
  billingType?: "api" | "subscription"
): number {
  if (billingType === "subscription") return 0;  // D-12: subscription = $0 actual cost
  const rates = PRICING[model] ?? PRICING["default"];
  return inputTokens * rates.input + outputTokens * rates.output;
}
```

---

### `convex/schema.ts` (config/schema, CRUD)

**Analog:** self (add field to `llmMetrics` table definition, lines 292–310)

**Current `llmMetrics` table** (lines 292–310):
```typescript
llmMetrics: defineTable({
  provider: v.string(),
  model: v.string(),
  promptTokens: v.float64(),
  completionTokens: v.float64(),
  totalTokens: v.float64(),
  latencyMs: v.float64(),
  cost: v.optional(v.float64()),
  sessionId: v.optional(v.string()),
  timestamp: v.float64(),
  archived: v.optional(v.boolean()),
  agentId: v.optional(v.string()),    // Phase 59 SCH-02
  toolName: v.optional(v.string()),   // Phase 59 SCH-02
})
```

**Pattern to add** — follow the `v.optional` pattern already used for `agentId`/`toolName`:
```typescript
billingType: v.optional(v.string()),  // "api" | "subscription" — Phase 67
```
Add after `toolName` with matching comment style.

---

### `convex/llm.ts` (service, CRUD)

**Analog:** self (extend `recordCall` mutation, lines 5–34)

**Current `recordCall` handler** (lines 1–34):
```typescript
import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const recordCall = mutation({
  args: {
    provider: v.string(),
    model: v.string(),
    // ...existing args...
    agentId: v.optional(v.string()),
    toolName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("llmMetrics", {
      provider: args.provider,
      model: args.model,
      // ...existing fields...
      agentId: args.agentId,
      toolName: args.toolName,
    });
  },
});
```

**Pattern to add** — import `getBillingType` and derive at insert time (same pattern as existing optional field derivation):
```typescript
import { getBillingType } from "./lib/providers";

// In recordCall handler, derive before insert:
const billingType = getBillingType(args.provider);

await ctx.db.insert("llmMetrics", {
  // ...existing fields...
  agentId: args.agentId,
  toolName: args.toolName,
  billingType,               // Phase 67
});
```

---

### `convex/aggregates.ts` (service, batch)

**Analog:** self (extend `computeHourly` and `costByPeriod`)

**Key existing patterns to extend:**

Cost dimension key pattern (lines 22–25):
```typescript
const costByDim: Record<string, number> = {};
for (const r of llmRows) {
  const key = `${r.provider}::${r.model}`;
  costByDim[key] = (costByDim[key] ?? 0) + (r.cost ?? 0);
}
```

Idempotency guard (lines 27–36) — **must be modified** per Pitfall 2 in RESEARCH.md:
```typescript
const existingCost = await ctx.db
  .query("aggregates")
  .withIndex("by_type_period_bucket", (q) =>
    q.eq("metric_type", "cost").eq("period", "hourly").eq("bucket_start", hourStart)
  )
  .first();
if (existingCost) {
  return;  // This early-exit breaks when billingType adds multiple rows per bucket
}
```

Dimensions insert (lines 38–47):
```typescript
for (const [dim, value] of Object.entries(costByDim)) {
  const [provider, model] = dim.split("::");
  await ctx.db.insert("aggregates", {
    metric_type: "cost",
    period: "hourly",
    bucket_start: hourStart,
    value,
    dimensions: { provider, model },
  });
}
```

Post-collect filter pattern in `costByPeriod` (lines 160–166) — **copy this pattern** for billingType filter:
```typescript
// Existing post-collect provider filter (the model for billingType filter):
const provider = (r.dimensions as { provider?: string } | null)?.provider ?? "unknown";
grouped[provider] = (grouped[provider] ?? 0) + r.value;
```

**Patterns to add:**
1. Extend dim key: `const key = \`${r.provider}::${r.model}::${billingType}\``
2. Add `billingType` to `dimensions` on insert: `dimensions: { provider, model, billingType }`
3. Fix idempotency guard: check per-dimension key existence instead of first-row early exit
4. Add `billingType: v.optional(v.string())` arg to `costByPeriod` query
5. Post-collect JS filter in `costByPeriod` mirroring the existing provider filter pattern

---

### `convex/forecasts.ts` (service, request-response)

**Analog:** self (extend `costForecast` query)

**Current collect pattern** (lines 44–51):
```typescript
const rows = await ctx.db
  .query("aggregates")
  .withIndex("by_type_period_bucket", (q) =>
    q.eq("metric_type", "cost").eq("period", "daily").gte("bucket_start", cutoff)
  )
  .collect();
```

**Current sum-by-day pattern** (lines 53–56):
```typescript
const byDay: Record<number, number> = {};
for (const row of rows) {
  byDay[row.bucket_start] = (byDay[row.bucket_start] ?? 0) + row.value;
}
```

**Pattern to add** — post-collect JS filter (same approach as `aggregates.costByPeriod` lines 160–166):
```typescript
// After .collect(), filter to API-billed rows only (D-02):
const apiRows = rows.filter(
  (r) => ((r.dimensions as { billingType?: string } | null)?.billingType ?? "api") === "api"
);
// Then group apiRows instead of rows in the byDay loop
```

Note: The `?? "api"` default handles legacy rows that predate the billingType field.

---

### `convex/briefings.ts` (service, event-driven)

**Analog:** self (surgical fix, lines 241–244)

**Existing correct guard** (lines 225–244 — do NOT remove this):
```typescript
export const setLLMConfig = mutation({
  args: { slot: v.string(), provider: v.string(), model: v.string(), apiKey: v.string() },
  handler: async (ctx, { slot, provider, model, apiKey }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");

    if (slot !== "primary" && slot !== "backup") {
      throw new Error(`Invalid slot "${slot}". Must be "primary" or "backup".`);
    }
    if (provider !== "openai" && provider !== "anthropic") {
      throw new Error(
        `Invalid provider "${provider}". Must be "openai" or "anthropic".`
      );  // ← LINE 241-244: This guard is CORRECT. Do not remove.
    }
    ...
  }
});
```

**Investigation task required before editing** — per RESEARCH.md Pitfall 5: The CONTEXT.md D-06 fix description ("accept ALL provider names in data being summarized") does not match what line 241 does (it gates LLM config saves, which is correct). The planner must add a Wave 0 verification task: run the daily digest cron with a gateway-provider session in the data and observe the actual error. Do not blindly edit line 241.

**If data-side filtering is discovered elsewhere** — the fix pattern is: any `if (provider !== "openai" && provider !== "anthropic")` guard that exists in the data aggregation path (`getDailyDigestDataInternal`, `generateDailyDigestAction`, or `generateSessionBriefingAction`) should be removed. The guard at line 241 in `setLLMConfig` is intentional and must stay.

---

### `convex/memoryQuality.ts` (service, event-driven)

**Analog:** `convex/briefings.ts` lines 216–244 (same LLM dual-provider call pattern)

**Existing dual-provider call pattern in memoryQuality.ts** (lines 213–235):
```typescript
// Call LLM (OpenAI-compatible or Anthropic)
if (primaryConfig.provider === "anthropic") {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": primaryConfig.apiKey,
      "anthropic-version": "2023-06-01",
    },
    ...
  });
  responseText = json.content?.[0]?.text ?? "{}";
} else {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", { ... });
  ...
}
```

**Same investigation-first approach** as briefings.ts — verify where provider data filtering occurs at line ~216 before editing. The LLM call branching at line 216 is intentional and correct. The fix (per D-07) only removes any provider filter on the DATA flowing into the contradiction-check prompt, not the LLM config selection.

---

### `src/components/TokenWaterfall.tsx` (component, transform)

**Analog:** self (extend MODEL_COLORS and grouping logic)

**Current MODEL_COLORS** (lines 5–13):
```typescript
const MODEL_COLORS: Record<string, string> = {
  "claude-opus": "#fbbf24",
  "claude-sonnet": "#22d3ee",
  "claude-haiku": "#34d399",
  opus: "#fbbf24",
  sonnet: "#22d3ee",
  haiku: "#34d399",
  ollama: "#f97316",
};
```

**Current grouping** (lines 26–39) — groups by model only:
```typescript
const byModel: Record<string, { prompt: number; completion: number }> = {};
for (const r of raw) {
  if (!byModel[r.model]) byModel[r.model] = { prompt: 0, completion: 0 };
  byModel[r.model].prompt += r.promptTokens;
  byModel[r.model].completion += r.completionTokens;
}
```

**Current render** (lines 54–88) — `rows.map(({ model, prompt, completion })` with `getModelColor(model)`.

**Patterns to add:**

1. Extend MODEL_COLORS (D-09) — follow existing key pattern (exact match + family fallback):
```typescript
// GPT family (green tones)
"gpt-4o":      "#22c55e",
"gpt-4o-mini": "#4ade80",
gpt:           "#22c55e",  // fallback for any gpt-* variant
// Gemini family (purple tones)
"gemini-2.5-pro":   "#a855f7",
"gemini-2.5-flash": "#c084fc",
gemini:             "#a855f7",  // fallback for any gemini-* variant
```

2. Wire `provider` field from hook — **prerequisite check first** (RESEARCH.md Open Question 1): `convex/analytics.ts:tokenWaterfall` at line 235–239 currently returns only `{ timestamp, model, promptTokens, completionTokens }` — `provider` is absent. Must add `provider: r.provider` to the query return before D-08 grouping can work.

3. Change grouping from model-flat to provider-then-model (D-08) — follow existing byModel pattern extended to two levels:
```typescript
const byProvider: Record<string, Record<string, { prompt: number; completion: number }>> = {};
for (const r of raw) {
  if (!byProvider[r.provider]) byProvider[r.provider] = {};
  if (!byProvider[r.provider][r.model]) byProvider[r.provider][r.model] = { prompt: 0, completion: 0 };
  byProvider[r.provider][r.model].prompt += r.promptTokens;
  byProvider[r.provider][r.model].completion += r.completionTokens;
}
```

4. Render provider headers with nested model bars — follow existing bar render style (lines 60–88), wrapping each provider group in a header element with the provider name.

---

### `src/components/AgentProfileEditor.tsx` (component, CRUD)

**Analog:** self (extend MODELS array, lines 10–16)

**Current MODELS array** (lines 10–16):
```typescript
const MODELS = [
  "claude-opus-4-6",
  "claude-sonnet-4-6",
  "claude-haiku-4-5",
  "gpt-4o",
  "other",
];
```

Note: `gpt-4o` is already in the list. The additions needed are the new GPT-mini and Gemini models:
```typescript
const MODELS = [
  "claude-opus-4-6",
  "claude-sonnet-4-6",
  "claude-haiku-4-5",
  "gpt-4o",
  "gpt-4o-mini",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "other",
];
```

---

### `src/components/SDKSpendCapGauge.tsx` (component, request-response) — NEW FILE

**Analog:** `src/components/CostForecastPanel.tsx` (same query-then-render pattern)

**Import pattern** (copy from CostForecastPanel.tsx lines 1–4):
```typescript
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatCost } from "../lib/formatters";
```

**Query pattern** (copy from CostForecastPanel.tsx lines 6–7):
```typescript
const data = useQuery(api.aggregates.costByPeriod, {
  period: "daily",
  billingType: "api",
  lookbackDays: 1,  // today only
});
```

**Budget bar pattern** (copy from CostForecastPanel.tsx lines 78–96):
```typescript
// CostForecastPanel budget bar — copy this exact pattern for the SDK spend gauge:
const DAILY_CAP = 5.00;      // D-04: $5/day hard cap
const ALERT_THRESHOLD = 0.8; // D-04: 80% = $4 auto-alert

const todaySpend = Object.values(data ?? {}).reduce((s, v) => s + (v as number), 0);
const percentage = Math.min((todaySpend / DAILY_CAP) * 100, 100);
const status = todaySpend >= DAILY_CAP ? "exceeded" : todaySpend >= DAILY_CAP * ALERT_THRESHOLD ? "warning" : "ok";

const barColor =
  status === "exceeded" ? "bg-[--status-error]" :
  status === "warning"  ? "bg-[--status-warn]"  :
  "bg-[--status-ok]";

// Render: div with h-2 progress bar — same className pattern as CostForecastPanel lines 87–90
<div className="h-2 bg-muted rounded-none overflow-hidden">
  <div className={`h-full transition-all ${barColor}`} style={{ width: `${percentage}%` }} />
</div>
```

**Status label pattern** (copy from CostForecastPanel.tsx lines 34–39):
```typescript
const label = status === "exceeded" ? "Cap exceeded" : status === "warning" ? "Near limit" : "On track";
```

**Loading/empty state** (copy from CostForecastPanel.tsx lines 8–17):
```typescript
if (data === undefined) {
  return <div className="space-y-4"><p className="text-sm text-muted-foreground text-center">Loading...</p></div>;
}
```

---

### `src/pages/Analytics.tsx` (page, request-response)

**Analog:** self (extend with split-view queries)

**Current query pattern** (lines 38–47):
```typescript
const costByProvider = useQuery(api.aggregates.costByPeriod, { period: "daily" }) ?? {};
const errorTrend = useQuery(api.aggregates.errorTrendByPeriod, { period: "hourly" }) ?? [];
const eventCounts = useQuery(api.aggregates.eventCountsByPeriod, { period: "daily" }) ?? {};
```

**Patterns to add** — follow same `useQuery` → null-coalescing pattern:
```typescript
// API spend (real money out of account)
const apiCostByProvider = useQuery(api.aggregates.costByPeriod, {
  period: "daily",
  billingType: "api",
}) ?? {};

// Subscription usage (call counts, not dollars)
// Direct llmMetrics query for call counts by subscription providers
// (see RESEARCH.md Open Question 3: use llm.costByProvider pattern filtered to subscription)
```

**Total cost computation** (line 56) — split into two totals:
```typescript
// Replace: const totalCost = Object.values(costByProvider).reduce(...)
const totalApiSpend = Object.values(apiCostByProvider).reduce((s, v) => s + (v as number), 0);
```

**SDKSpendCapGauge placement** — add as new section before or after CostForecastPanel (lines 72–77):
```typescript
<SectionErrorBoundary name="SDK Spend Cap">
  <GlassPanel className="p-4">
    <SDKSpendCapGauge />
  </GlassPanel>
</SectionErrorBoundary>
```

---

### `src/lib/providerLocations.ts` (utility, transform)

**Analog:** self (extend PROVIDER_LOCATIONS record)

**Current file** (lines 1–9 — read in full):
```typescript
export const PROVIDER_LOCATIONS: Record<string, { lat: number; lng: number; color: string }> = {
  anthropic:  { lat: 37.77, lng: -122.42, color: "#FF6B35" },
  openai:     { lat: 37.79, lng: -122.40, color: "#10B981" },
  openrouter: { lat: 37.75, lng: -122.44, color: "#8B5CF6" },
  ollama:     { lat: 0, lng: 0, color: "#67E8F9" },
  google:     { lat: 37.42, lng: -122.08, color: "#60A5FA" },
};

export const USER_LOCATION = { lat: 40.71, lng: -74.01 };
```

**Patterns to add** (D-10) — follow existing Record entry pattern:
```typescript
// Gateway providers — add to PROVIDER_LOCATIONS (D-10):
"claude-cli":  { lat: 37.77, lng: -122.42, color: "#FF6B35" },  // Anthropic SF (same as anthropic)
"claude-sdk":  { lat: 37.77, lng: -122.42, color: "#FF6B35" },  // Anthropic SF
"codex":       { lat: 37.79, lng: -122.40, color: "#10B981" },  // OpenAI SF (same as openai)
"antigravity": { lat: 37.42, lng: -122.08, color: "#60A5FA" },  // Google Mountain View (same as google)
```

---

### `convex/analytics.ts` (service/query, request-response) — supporting change for TokenWaterfall

**Analog:** self (extend `tokenWaterfall` query return at lines 233–240)

**Current return shape** (lines 233–240):
```typescript
return all
  .filter((r) => r.timestamp >= cutoff)
  .map((r) => ({
    timestamp: r.timestamp,
    model: r.model,
    promptTokens: r.promptTokens,
    completionTokens: r.completionTokens,
  }));
```

**Pattern to add** — add `provider` field to the mapped object:
```typescript
.map((r) => ({
  timestamp: r.timestamp,
  model: r.model,
  provider: r.provider,          // Phase 67 — required for D-08 TokenWaterfall grouping
  promptTokens: r.promptTokens,
  completionTokens: r.completionTokens,
}));
```

---

## Shared Patterns

### Post-Collect JS Filter on v.any() Dimensions
**Source:** `convex/aggregates.ts` lines 160–166
**Apply to:** `convex/aggregates.ts:costByPeriod` (new billingType filter arg) and `convex/forecasts.ts:costForecast` (API-only filter)
```typescript
// Pattern: access nested field inside v.optional(v.any()) dimensions column
const provider = (r.dimensions as { provider?: string } | null)?.provider ?? "unknown";
// Apply same cast for billingType:
const billingType = (r.dimensions as { billingType?: string } | null)?.billingType ?? "api";
```

### Optional Field on Convex Schema Table
**Source:** `convex/schema.ts` lines 303–305 (agentId, toolName)
**Apply to:** `convex/schema.ts:llmMetrics` (billingType field)
```typescript
agentId: v.optional(v.string()),    // Phase 59 SCH-02
toolName: v.optional(v.string()),   // Phase 59 SCH-02
billingType: v.optional(v.string()), // "api" | "subscription" — Phase 67
```

### Budget Status Classification (ok/warning/exceeded at 80%)
**Source:** `convex/forecasts.ts` lines 24–33
**Apply to:** `src/components/SDKSpendCapGauge.tsx`
```typescript
export function classifyBudgetStatus(
  projectedMonthly: number,
  budgetCap: number | null
): "ok" | "warning" | "exceeded" {
  if (budgetCap == null || budgetCap <= 0) return "ok";
  const ratio = projectedMonthly / budgetCap;
  if (ratio >= 1.0) return "exceeded";
  if (ratio >= 0.8) return "warning";   // 80% threshold from D-04
  return "ok";
}
```

### useQuery + Null-Coalesce Pattern
**Source:** `src/pages/Analytics.tsx` lines 42–47
**Apply to:** `src/pages/Analytics.tsx` (new split-view queries), `src/components/SDKSpendCapGauge.tsx`
```typescript
const costByProvider = useQuery(api.aggregates.costByPeriod, { period: "daily" }) ?? {};
```

### Typed-Const Record Export (provider registry)
**Source:** `convex/lib/providers.ts` lines 7–24
**Apply to:** PROVIDER_BILLING addition in both `convex/lib/providers.ts` and `src/lib/providers.ts`
```typescript
export const GATEWAY_PROVIDERS = [
  "claude-cli",
  // ...
] as const;
// → same pattern for PROVIDER_BILLING as a typed Record
```

---

## No Analog Found

All files have close codebase analogs. No files require falling back to RESEARCH.md external patterns only.

---

## Metadata

**Analog search scope:** `convex/`, `src/lib/`, `src/components/`, `src/pages/`
**Files scanned:** 15
**Pattern extraction date:** 2026-05-22

### Critical Pre-Implementation Checks (from RESEARCH.md)

| Check | What to verify | Risk if skipped |
|---|---|---|
| Gemini Flash pricing | Confirm with Larry: D-11 says $0.15/$0.60 but Google docs say $0.30/$2.50 | Cost underestimate 2-4x |
| TokenWaterfall `provider` field | `convex/analytics.ts:tokenWaterfall` does NOT currently return `provider` — add it first | Silent "unknown" provider grouping |
| briefings.ts line 241 | Verify actual failure mode before editing — line 241 guard is intentional | Removing it breaks LLM config security |
| Aggregates idempotency guard | `computeHourly` early-exit guard at lines 33–36 breaks with billingType multi-row buckets | Analytics shows $0 after deploy |
| Frontend/backend providers.ts sync | PROVIDER_BILLING must be added to BOTH files in one task | Analytics split view misses client-side billingType lookups |
