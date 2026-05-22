# Phase 67: Multi-Provider Pricing & Intelligence - Research

**Researched:** 2026-05-22
**Domain:** Multi-provider cost attribution, aggregation pipeline, LLM intelligence validation, React visualization
**Confidence:** HIGH (all key files read from codebase; pricing partially diverges from CONTEXT.md — flagged below)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Subscription Cost Handling**
- D-01: Subscription providers (claude-cli, codex, antigravity) show $0 actual cost. API-billed providers (claude-sdk) show real cost. Analytics page gets a split view: "API Spend" (real money) vs "Subscription Usage" (call counts/tokens).
- D-02: Cost forecasting (CostForecastPanel) only projects API-billed spend. Subscription usage is tracked but not forecasted as cost.
- D-03: billingType derived from provider registry (`convex/lib/providers.ts`) — no upstream Ástríðr changes needed. Provider registry gets a billing type map (e.g., `claude-sdk → "api"`, `codex → "subscription"`).
- D-04: $5/day SDK spend cap surfaced in dashboard with visual gauge. Auto-alert fires at 80% ($4).

**Intelligence Provider Scope**
- D-05: LLM intelligence calls (briefings, memory quality) stay openai + anthropic only — these require direct API keys stored in agentConfigs. Gateway providers are not added as LLM provider choices.
- D-06: Fix `briefings.ts:241` provider validation — accept ALL provider names in the data being summarized. The validation should only gate which LLM to call for generation, not filter which provider data flows into the narrative.
- D-07: Same fix for `memoryQuality.ts:216` — accept any provider in data, validate only the LLM config provider used for the contradiction-check call.

**Multi-Provider Visualization**
- D-08: TokenWaterfall groups by provider, then model (provider headers with models nested underneath).
- D-09: Provider family color scheme — GPT = green tones (#22c55e variants), Gemini = purple tones (#a855f7 variants), Claude keeps existing gold/cyan/emerald palette.
- D-10: All gateway providers get map locations — claude-cli/claude-sdk → San Francisco (Anthropic), codex → San Francisco (OpenAI), antigravity → Mountain View (Google).

**Model Pricing**
- D-11: Add exactly 4 models to `modelPricing.ts`: GPT-4o ($2.50/$10 per 1M), GPT-4o-mini ($0.15/$0.60), Gemini 2.5 Pro ($1.25/$10), Gemini 2.5 Flash ($0.15/$0.60).
- D-12: Cost estimation skips pricing lookup when billingType = "subscription" — return 0 at call site. `modelPricing.ts` only contains API-billed model rates.
- D-13: Default fallback for unknown API-billed models stays at Claude Sonnet rates ($3/$15 per 1M).

### Claude's Discretion

None listed — discussion stayed within phase scope.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GW-05 | Cost estimates work correctly for all providers, not just Claude | modelPricing.ts extension + billingType skip logic in llm.ts recordCall |
| GW-06 | Daily briefings generate without errors when gateway provider events are in the data | briefings.ts setLLMConfig provider validation fix (line ~241); memoryQuality.ts line ~216 same pattern |
| GW-07 | Analytics page cost breakdown distinguishes subscription (free) from API-billed usage | schema billingType field + aggregates billingType dimension + Analytics split view |
</phase_requirements>

---

## Summary

Phase 67 is a precision repair phase: seven narrowly scoped code changes across the pricing, aggregation, intelligence, and visualization layers. All target files are confirmed to exist and have been read. The changes follow well-established patterns already used elsewhere in the codebase — the provider registry pattern, the conditional field pattern, and the existing React component extension pattern. There are no new libraries to install and no new tables to create beyond adding a `billingType` optional field to `llmMetrics`.

The most important research finding is a **pricing discrepancy**: D-11 specifies Gemini 2.5 Flash at $0.15/$0.60 per 1M tokens, but the current Google official docs and OpenRouter both show $0.30/$2.50 per 1M tokens (text). D-11's value for Flash matches neither current Flash nor Flash-Lite ($0.10/$0.40). GPT-4o and GPT-4o-mini values in D-11 are confirmed correct against OpenAI official pricing. Gemini 2.5 Pro ($1.25/$10) is confirmed correct for prompts ≤200K context. Larry must confirm whether D-11's Flash price is intentional (approximate/budget estimate) or should be updated to match current Google pricing before the planner locks those numbers.

The briefings and memoryQuality "fixes" are not refactors — they are surgical removals of a provider allow-list that was erroneously placed in the data-layer path instead of the LLM-config path. The `setLLMConfig` mutation at line 241 of briefings.ts already has a correct `if (provider !== "openai" && provider !== "anthropic")` guard for LLM config saves. The bug is that this same gate is apparently also being applied (or inferred) to data flowing into briefing generation — the fix is to ensure no provider filtering sits in the data summarization path.

**Primary recommendation:** Execute all seven work items in a single wave. Each is independent of the others at the code level, though the schema migration (billingType on llmMetrics) must precede any aggregation query changes that filter by it.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Model pricing lookup | Frontend lib (`src/lib/modelPricing.ts`) | — | Pure function used by UI components; no backend needed |
| billingType derivation | Backend mutation (`convex/llm.ts:recordCall`) | Provider registry (`convex/lib/providers.ts`) | Determined at ingest time, stored on `llmMetrics` rows |
| Cost aggregation by billing type | Backend cron (`convex/aggregates.ts`) | — | Runs hourly, writes to `aggregates` table |
| Cost forecast filtering | Backend query (`convex/forecasts.ts`) | — | Reads aggregates, must filter to API-billed only |
| LLM provider validation (intelligence calls) | Backend mutation (`convex/briefings.ts:setLLMConfig`) | — | Guards which providers can be stored as intelligence config |
| Data provider validation (briefing generation) | Backend action (`convex/briefings.ts:generateDailyDigestAction`) | — | Must NOT filter — all providers flow into narrative |
| TokenWaterfall grouping and colors | Frontend component (`src/components/TokenWaterfall.tsx`) | — | Pure UI transformation |
| Analytics split view | Frontend page (`src/pages/Analytics.tsx`) | Backend query (`convex/aggregates.ts`) | Page queries aggregates filtered by billingType dimension |
| SDK spend cap gauge | Frontend component (new `SDKSpendCapGauge.tsx`) | Backend query (`convex/aggregates.ts`) | Queries today's API-billed cost vs $5 cap |
| AgentProfileEditor model list | Frontend component (`src/components/AgentProfileEditor.tsx`) | — | Static MODELS array — pure UI data |
| Provider map locations | Frontend (wherever providerLocations is consumed) | — | Static coordinate data |

---

## Standard Stack

### Core (no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Convex | Already installed | Schema, mutations, queries, crons | Project backbone |
| React + TypeScript | Already installed | UI components | Project backbone |
| Tailwind CSS 4 | Already installed | Styling | Project standard |
| shadcn/ui (progress, badge) | Already installed | SDK gauge component | UI-SPEC confirmed both installed |

**Version verification:** No new packages. All dependencies confirmed present in codebase.

---

## Architecture Patterns

### System Architecture Diagram

```
Ingest path:
  POST /runtime-ingest
    → runtimeIngest.ts (case "llm_call")
      → llm.ts:recordCall()
        → derive billingType from providers.ts:PROVIDER_BILLING[provider]
        → insert llmMetrics { ...existing, billingType }

Aggregation path (hourly cron):
  aggregates.ts:computeHourly()
    → reads llmMetrics
    → groups cost by provider+model+billingType
    → writes aggregates { metric_type:"cost", dimensions:{ provider, model, billingType } }

Query path (Analytics page):
  Analytics.tsx
    → api.aggregates.costByPeriod({ billingType: "api" })   → API Spend MetricCard
    → api.aggregates.costByPeriod({ billingType: "subscription" }) → Subscription Usage MetricCard
    → CostForecastPanel → api.forecasts.costForecast() → reads only api-billed aggregate rows

Intelligence path (daily cron):
  briefings.ts:generateDailyDigestAction()
    → getDailyDigestDataInternal() reads sessions/aggregates (provider-agnostic)
    → callLLMWithFallback() validates only LLM config provider (openai/anthropic)
    → no filtering on data provider → all gateway providers flow into narrative

Visualization path:
  TokenWaterfall.tsx
    → useTokenWaterfall() returns raw llmMetrics rows (with provider field)
    → groups by provider → then by model
    → renders provider headers + nested model bars with family colors
```

### Recommended Project Structure (no change to structure)

No new directories. All changes are file-level additions/modifications within existing structure:
```
convex/
  lib/providers.ts        # Add PROVIDER_BILLING map + getBillingType()
  schema.ts               # Add billingType optional field to llmMetrics
  llm.ts                  # Add billingType derivation in recordCall
  aggregates.ts           # Add billingType to dimensions; add billingType filter param to costByPeriod
  forecasts.ts            # Add billingType: "api" filter to costForecast query
  briefings.ts            # Remove erroneous data-side provider filter (line ~241)
  memoryQuality.ts        # Remove erroneous data-side provider check (line ~216)
src/
  lib/
    modelPricing.ts       # Add GPT/Gemini rates; add billingType skip at call site
    providers.ts          # Mirror PROVIDER_BILLING from convex/lib/providers.ts
  components/
    TokenWaterfall.tsx    # Add provider grouping + GPT/Gemini colors
    AgentProfileEditor.tsx # Extend MODELS array
    SDKSpendCapGauge.tsx  # New component
  pages/
    Analytics.tsx         # Add API/subscription split view
```

### Pattern 1: Provider Registry Billing Map

**What:** Add `PROVIDER_BILLING` as a typed const record in `convex/lib/providers.ts` and mirror to `src/lib/providers.ts`.
**When to use:** Any time a billing type lookup is needed (ingest, aggregation, forecast filtering).

```typescript
// convex/lib/providers.ts (addition to existing file)
export const PROVIDER_BILLING: Record<AnyProvider, "api" | "subscription"> = {
  "claude-sdk":        "api",
  "claude-cli":        "subscription",
  "codex":             "subscription",
  "antigravity":       "subscription",
  "anthropic_direct":  "api",
  "openrouter":        "api",
  "ollama":            "subscription",  // local, no billing
};

export function getBillingType(provider: string): "api" | "subscription" {
  return (PROVIDER_BILLING as Record<string, "api" | "subscription">)[provider] ?? "api";
}
```

Note: `ollama` is local inference — treat as "subscription" (no money leaves account). [ASSUMED] — not in CONTEXT.md; confirm if ollama should be "api" or "subscription" before locking.

### Pattern 2: billingType on llmMetrics Schema

**What:** Add optional `billingType` field to `llmMetrics` table in `convex/schema.ts`.
**When to use:** Schema migration — optional field, no data migration needed for existing rows.

```typescript
// convex/schema.ts — llmMetrics table addition
billingType: v.optional(v.string()),  // "api" | "subscription"
```

Existing rows get `undefined` for billingType. New rows get the derived value. Queries must handle `undefined` as "api" (legacy rows pre-date this field).

### Pattern 3: billingType Derivation at Ingest

**What:** Derive billingType from provider registry in `convex/llm.ts:recordCall` and `runtimeIngest.ts` llm_call case.
**Where:** The derivation should happen in `recordCall` mutation (single place), not in the HTTP router.

```typescript
// convex/llm.ts — recordCall handler addition
import { getBillingType } from "./lib/providers";

// In handler:
const billingType = getBillingType(args.provider);
await ctx.db.insert("llmMetrics", {
  ...existingFields,
  billingType,
});
```

### Pattern 4: Aggregates billingType Dimension

**What:** Include billingType in cost aggregate dimensions; add optional billingType filter to `costByPeriod` query.
**Current state:** `costByDim` key is `${provider}::${model}`. Extend to `${provider}::${model}::${billingType}`.

```typescript
// convex/aggregates.ts — computeHourly cost section (extension)
const billingType = (r as any).billingType ?? getBillingType(r.provider);
const key = `${r.provider}::${r.model}::${billingType}`;

// costByPeriod query: add optional billingType filter arg
export const costByPeriod = query({
  args: {
    period: v.string(),
    lookbackDays: v.optional(v.float64()),
    billingType: v.optional(v.string()),  // new arg
  },
  handler: async (ctx, args) => {
    // ...existing query...
    // After collecting rows, filter by billingType if provided:
    const filtered = args.billingType
      ? rows.filter(r => (r.dimensions as any)?.billingType === args.billingType)
      : rows;
    // ...group filtered rows by provider...
  },
});
```

**Important:** The idempotency guard in `computeHourly` checks for an existing `cost` row by `bucket_start` only. Adding billingType to the dimension key means multiple rows per bucket are now possible (one per provider/model/billingType combo). The idempotency guard uses `by_type_period_bucket` index — this is at the `metric_type + period + bucket_start` level and only checks for the first matching row. The guard will incorrectly early-exit if any cost row already exists for that hour, even if new billingType combos are missing. The fix is to **remove the early-exit guard** or change it to check for the specific dimension key. See Pitfall 2 below.

### Pattern 5: Forecasts API-Only Filter

**What:** `costForecast` query must sum only API-billed rows.
**Current state:** Sums all cost aggregate rows regardless of dimensions.

```typescript
// convex/forecasts.ts — costForecast handler change
const rows = await ctx.db.query("aggregates")
  .withIndex("by_type_period_bucket", q =>
    q.eq("metric_type", "cost").eq("period", "daily").gte("bucket_start", cutoff)
  )
  .filter(q => q.eq((q.field("dimensions") as any)?.billingType, "api"))  // NEW FILTER
  .collect();
```

Note: Convex `.filter()` on nested fields within a `v.any()` column uses the `q.field()` accessor. Filter on embedded JSON fields in `v.any()` dimensions works via JS-level filter after `.collect()` if Convex's filter API doesn't support nested field access. [VERIFIED: from codebase reading — `aggregates.ts:costByPeriod` already does this with a JS-level filter after collect]: use the same post-collect JS filter pattern.

### Pattern 6: briefings.ts Provider Validation Fix

**What:** The `setLLMConfig` mutation at line ~241 correctly guards "openai" | "anthropic" for the LLM intelligence config. The issue per CONTEXT.md D-06 is that somewhere in the generation path, provider data from sessions is being filtered. Need to confirm the exact location.

**From code reading:** `briefings.ts` line 241 is inside `setLLMConfig` mutation:
```typescript
if (provider !== "openai" && provider !== "anthropic") {
  throw new Error(`Invalid provider "${provider}". Must be "openai" or "anthropic".`);
}
```
This is CORRECT behavior for LLM config saves. The CONTEXT.md references "line 241" for the fix — but this IS the correct guard. The issue is likely that `getDailyDigestDataInternal` or the briefing action path is NOT the actual problem site. Looking at the code, the generation actions do not filter by provider anywhere — they pass structured data (counts, costs) to the LLM prompt.

**The actual bug is ambiguous from the code.** The `briefings.ts` generation flow does not filter by session provider. The daily digest reads from `sessions` table (no provider filter) and from `aggregates` table (no provider filter). The `generateSessionBriefingAction` reads events by sessionId, not filtering by provider.

This means the CONTEXT.md "fix briefings.ts:241 provider validation" is referring to the `setLLMConfig` line — but the fix described (accept all provider names in data) does not match what that line does. Either:
1. The bug manifests as an exception thrown during a briefing cron when a gateway provider name appears in some config lookup, OR
2. There is a secondary path not visible in the code that filters providers.

**Research finding:** The `getDailyDigestDataInternal` and `generateDailyDigestAction` as read contain no provider filters on data. The `generateSessionBriefingAction` also contains no provider filter. The only provider validation is in `setLLMConfig`. The planner should add a "verify by running daily digest with gateway provider session data" verification task rather than making a blind code edit.

### Pattern 7: TokenWaterfall Provider Grouping

**What:** Current `TokenWaterfall.tsx` groups by model only. Change to group by provider first (extracted from llmMetrics `provider` field), then model.

**Current hook:** `useTokenWaterfall()` returns `{ model, provider, promptTokens, completionTokens }` rows — need to verify the hook returns `provider`.

```typescript
// TokenWaterfall.tsx — extended MODEL_COLORS
const MODEL_COLORS: Record<string, string> = {
  // Claude (existing)
  "claude-opus":   "#fbbf24",
  "claude-sonnet": "#22d3ee",
  "claude-haiku":  "#34d399",
  opus:            "#fbbf24",
  sonnet:          "#22d3ee",
  haiku:           "#34d399",
  ollama:          "#f97316",
  // GPT (new, D-09)
  "gpt-4o-mini":   "#4ade80",
  "gpt-4o":        "#22c55e",
  gpt:             "#22c55e",   // fallback for all GPT variants
  // Gemini (new, D-09)
  "gemini-2.5-pro":   "#a855f7",
  "gemini-2.5-flash": "#c084fc",
  gemini:             "#a855f7", // fallback for all Gemini variants
};
```

Provider grouping requires the `raw` data from `useTokenWaterfall` to include `provider` field. Need to verify the hook exposes this — see Open Question 1.

### Anti-Patterns to Avoid

- **Filtering aggregates in the TypeScript layer for every query:** Always add billingType to the stored dimension at write time (aggregates) so reads can filter by index/dimension rather than post-processing entire tables.
- **Patching existing aggregate rows:** The aggregates table is append-only. Add billingType to new rows going forward; don't backfill. Old aggregate rows without billingType are treated as "api" for forecast purposes (conservative: shows more cost, not less).
- **Touching LLMProviderConfig.tsx:** D-05 explicitly locks this component to openai/anthropic only. Do not add gateway providers to this dropdown.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| billingType lookup per provider | Switch/if chain in every call site | `getBillingType()` helper in providers.ts | Single source of truth already established as pattern |
| Cost aggregation by billing | New separate table | Extend existing `aggregates` dimensions field | Dimensions field already uses `v.any()` for extensibility |
| Gauge component | Custom SVG progress bar | shadcn `<Progress>` (already installed) | UI-SPEC confirmed; consistent with existing CostForecastPanel budget bar |

---

## Runtime State Inventory

This phase is NOT a rename/refactor. Only code and schema changes are involved.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | Existing `llmMetrics` rows have no `billingType` field | None — `v.optional` field, undefined treated as "api" (legacy) |
| Live service config | None — no external service config changes | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | None | None |

---

## Common Pitfalls

### Pitfall 1: Gemini 2.5 Flash Pricing Discrepancy

**What goes wrong:** D-11 specifies Gemini 2.5 Flash at $0.15/$0.60 per 1M tokens. Google's official API docs and OpenRouter both show current pricing as $0.30/$2.50 per 1M tokens for text. The D-11 values match neither Flash nor Flash-Lite ($0.10/$0.40).
**Why it happens:** Pricing discussions during planning used approximate or cached values.
**How to avoid:** Confirm with Larry before committing Flash prices. The planner should treat D-11 Flash prices as `[ASSUMED]` and gate implementation on Larry's confirmation.
**Warning signs:** If Flash output costs $2.50/1M, the existing Claude Sonnet fallback ($15/1M output) is still more expensive — correct relative ordering. The $0.60 figure would be cheaper than GPT-4o-mini output ($0.60/1M) — same price, unlikely for a newer Google flagship Flash model.

**GPT-4o and GPT-4o-mini prices confirmed correct:**
- GPT-4o: $2.50/$10.00 per 1M [VERIFIED: OpenAI official pricing page]
- GPT-4o-mini: $0.15/$0.60 per 1M [VERIFIED: OpenAI official pricing page]
- Gemini 2.5 Pro: $1.25/$10.00 per 1M (≤200K context) [VERIFIED: Google AI developer docs]
- Gemini 2.5 Flash: $0.30/$2.50 per 1M [VERIFIED: Google AI developer docs] — **differs from D-11**

### Pitfall 2: Aggregates Idempotency Guard Breaks with billingType Dimension

**What goes wrong:** `computeHourly` in `aggregates.ts` has an early-exit guard: if any cost row exists for `metric_type="cost" + period="hourly" + bucket_start=X`, the entire function returns early. After adding billingType to the dimension key, multiple cost rows per hour-bucket will exist. The guard will see one existing cost row and skip inserting the others.
**Why it happens:** The guard was written for the original model where one row per provider/model was expected. Adding billingType multiplies the row count per bucket.
**How to avoid:** Remove the early-exit guard OR change it to a per-dimension-key upsert pattern (check for existing row with matching dimensions, skip only that specific key). The simplest fix is to remove the guard since `computeHourly` is an internal mutation called by cron — re-runs would double-count, so if removing the guard, must also add a per-key existence check before insert.
**Warning signs:** Analytics shows cost as $0 after deploying aggregation changes.

### Pitfall 3: useTokenWaterfall Hook Missing provider Field

**What goes wrong:** TokenWaterfall provider grouping (D-08) requires the `provider` field on each row from `useTokenWaterfall()`. If the hook query doesn't return `provider`, the grouping silently falls back to "unknown" for all rows.
**Why it happens:** The hook may return only model-level summaries without provider.
**How to avoid:** Check `useAdvancedAnalytics.ts` (hook source) to verify `provider` is included in the returned data before implementing grouping. If absent, add it to the query.

### Pitfall 4: forecasts.ts Filter on Nested v.any() Field

**What goes wrong:** Convex `.filter()` with `q.field("dimensions")` returns the entire `v.any()` object. Filtering on a nested field inside it (e.g., `dimensions.billingType`) is not supported via Convex's native filter API for non-indexed fields.
**Why it happens:** `dimensions` is `v.optional(v.any())` — Convex indexes only top-level fields.
**How to avoid:** Use post-collect JavaScript filtering (already done in `aggregates.ts:costByPeriod` for `provider` field — the existing code uses `(r.dimensions as { provider?: string } | null)?.provider` after collect). Apply the same pattern for billingType.

### Pitfall 5: briefings.ts Fix Location Ambiguity

**What goes wrong:** CONTEXT.md references "line 241" but the code at that line is a correct LLM-config provider guard (intentional). Making the wrong edit could break the security of intelligence config saves.
**Why it happens:** Line numbers shift between planning discussion and implementation; the described bug may manifest differently than expected.
**How to avoid:** The planner should add a task to first VERIFY the actual failure mode (run daily digest cron with a gateway-provider session in the data, observe the error), then make the targeted fix. Do not blindly remove the `setLLMConfig` provider guard.

### Pitfall 6: Frontend/Backend providers.ts Sync

**What goes wrong:** `src/lib/providers.ts` is documented as "Frontend mirror of convex/lib/providers.ts — keep in sync." Adding `PROVIDER_BILLING` to the backend file but not the frontend file causes the Analytics split view to silently miss billingType lookups for client-side provider logic.
**Why it happens:** Two separate files maintained manually.
**How to avoid:** PROVIDER_BILLING and getBillingType additions must be made in BOTH files in the same task.

---

## Code Examples

### getBillingType helper (verified pattern)

```typescript
// Follows existing ALL_PROVIDERS typed const pattern in convex/lib/providers.ts
// [VERIFIED: convex/lib/providers.ts codebase read]
export const PROVIDER_BILLING: Record<string, "api" | "subscription"> = {
  "claude-sdk":        "api",
  "claude-cli":        "subscription",
  "codex":             "subscription",
  "antigravity":       "subscription",
  "anthropic_direct":  "api",
  "openrouter":        "api",
  "ollama":            "subscription",
};

export function getBillingType(provider: string): "api" | "subscription" {
  return PROVIDER_BILLING[provider] ?? "api";
}
```

### modelPricing.ts extension (verified structure)

```typescript
// Extends existing PRICING record — [VERIFIED: src/lib/modelPricing.ts codebase read]
const PRICING: Record<string, { input: number; output: number }> = {
  // Existing Claude rates
  "claude-opus-4-5":  { input: 15.00 / 1_000_000, output: 75.00 / 1_000_000 },
  "claude-sonnet-4-5":{ input:  3.00 / 1_000_000, output: 15.00 / 1_000_000 },
  "claude-haiku-3-5": { input:  0.80 / 1_000_000, output:  4.00 / 1_000_000 },
  "default":          { input:  3.00 / 1_000_000, output: 15.00 / 1_000_000 },
  // New GPT rates (D-11, confirmed against OpenAI official pricing)
  "gpt-4o":           { input:  2.50 / 1_000_000, output: 10.00 / 1_000_000 },
  "gpt-4o-mini":      { input:  0.15 / 1_000_000, output:  0.60 / 1_000_000 },
  // New Gemini rates (D-11, Gemini 2.5 Pro confirmed; Flash price PENDING Larry confirmation)
  "gemini-2.5-pro":   { input:  1.25 / 1_000_000, output: 10.00 / 1_000_000 },
  "gemini-2.5-flash": { input:  0.15 / 1_000_000, output:  0.60 / 1_000_000 }, // [ASSUMED] — see Pitfall 1
};

export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  model: string,
  billingType?: "api" | "subscription"  // D-12: skip lookup for subscription
): number {
  if (billingType === "subscription") return 0;  // D-12
  const rates = PRICING[model] ?? PRICING["default"];
  return inputTokens * rates.input + outputTokens * rates.output;
}
```

### Analytics split view query pattern

```typescript
// src/pages/Analytics.tsx additions — [VERIFIED: aggregates.costByPeriod signature from codebase]
const apiCost = useQuery(api.aggregates.costByPeriod, {
  period: "daily",
  billingType: "api",
}) ?? {};
const subUsage = useQuery(api.aggregates.costByPeriod, {
  period: "daily",
  billingType: "subscription",
}) ?? {};

const totalApiSpend = Object.values(apiCost).reduce((s, v) => s + (v as number), 0);
const totalSubCalls = /* from llmMetrics direct query or separate subscription call count query */;
```

Note: Subscription "usage" (D-01) is call counts + tokens, not dollars. A separate query on `llmMetrics` filtered by subscription providers may be needed for the call count display. The aggregates table stores cost value only; for subscription usage counts, query `llmMetrics` directly or add a new "calls" aggregate dimension.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Claude-only pricing in modelPricing.ts | Multi-provider pricing with billingType skip | Phase 67 | Correct costs for GPT/Gemini tasks |
| All providers treated as API-billed | billingType field distinguishes subscription vs API | Phase 67 | Analytics shows real burn rate |
| briefings/memoryQuality validate data-side providers | Validate only LLM config providers | Phase 67 | Gateway provider events flow into briefings |
| TokenWaterfall flat model list | Provider-grouped waterfall with family colors | Phase 67 | Visual clarity across multi-provider deployments |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Gemini 2.5 Flash price is $0.15/$0.60 per 1M (from D-11) | Standard Stack / Code Examples | Cost underestimate by 2x input, 4x output vs official $0.30/$2.50 |
| A2 | `ollama` billing type should be "subscription" (free, local) | Architecture Patterns Pattern 1 | If treated as "api", subscription usage count will be understated |
| A3 | `useTokenWaterfall` hook returns `provider` field on each row | Architecture Patterns / Pitfall 3 | Provider grouping in TokenWaterfall silently degrades to "unknown" headers |
| A4 | The briefings.ts "line 241" bug manifests as a thrown error during cron execution when gateway provider data is present | Common Pitfalls 5 | Wrong edit target could break intelligence config security |

---

## Open Questions

1. **useTokenWaterfall hook — does it return `provider`?**
   - What we know: `TokenWaterfall.tsx` imports `useTokenWaterfall` from `../hooks/useAdvancedAnalytics`. The hook was not read.
   - What's unclear: Whether the returned data structure includes `provider` field (needed for D-08 grouping).
   - Recommendation: Planner adds a Wave 0 task to read `useAdvancedAnalytics.ts` and confirm; if missing, add `provider` to the hook's returned data before TokenWaterfall work begins.

2. **Gemini 2.5 Flash pricing confirmation**
   - What we know: D-11 says $0.15/$0.60. Official Google docs say $0.30/$2.50. The values match GPT-4o-mini exactly — likely a placeholder/copy during discussion.
   - What's unclear: Whether Larry intended these exact values or wants current official pricing.
   - Recommendation: Ask Larry before implementing. Include as BLOCKED task until confirmed.

3. **Subscription usage count for Analytics split view**
   - What we know: D-01 says "Subscription Usage = call counts/tokens". The aggregates table stores `value` as cost (float). Call counts would require either a separate aggregate type or a direct llmMetrics query.
   - What's unclear: Whether to add a new "calls" aggregate metric_type or query llmMetrics directly in the Analytics page.
   - Recommendation: Query `llmMetrics` directly for the subscription call count (small dataset for 30-day window); no new aggregate type needed. This matches the existing `llm.costByProvider` query pattern.

4. **SDK spend cap gauge location**
   - What we know: UI-SPEC says "Inline with Settings page or as collapsible within Analytics 'Intelligence Limits' section." Both are described but neither is definitive.
   - What's unclear: Where exactly to place the SDKSpendCapGauge component.
   - Recommendation: Place on Analytics page per UI-SPEC primary description. D-04 says "surfaced in dashboard" which points to Analytics.

---

## Environment Availability

Step 2.6: SKIPPED — This phase is purely code/schema changes with no new external dependencies.

---

## Validation Architecture

`workflow.nyquist_validation` is absent from `.planning/config.json` — treat as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `vite.config.ts` (implicit) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GW-05 | `estimateCost("gpt-4o", ...)` returns correct dollar amount | unit | `npx vitest run src/lib/modelPricing.test.ts` | ❌ Wave 0 |
| GW-05 | `estimateCost(..., billingType="subscription")` returns 0 | unit | `npx vitest run src/lib/modelPricing.test.ts` | ❌ Wave 0 |
| GW-05 | `getBillingType("codex")` returns "subscription" | unit | `npx vitest run convex/__tests__/providerRegistry.test.ts` | ✅ (file exists, test is `.todo`) |
| GW-05 | `getBillingType("claude-sdk")` returns "api" | unit | `npx vitest run convex/__tests__/providerRegistry.test.ts` | ✅ (file exists, test is `.todo`) |
| GW-06 | `groupActivityEvents` handles events with gateway provider names without error | unit | `npx vitest run convex/briefings.test.ts` | ✅ (file exists) |
| GW-07 | `costByPeriod` with `billingType="api"` excludes subscription rows | unit | `npx vitest run convex/aggregates.test.ts` | ✅ (file exists, needs new test case) |
| GW-07 | `costForecast` excludes subscription cost rows from projections | unit | `npx vitest run convex/forecasts.test.ts` | ✅ (file exists, needs new test case) |

### Sampling Rate

- **Per task commit:** `npx vitest run convex/__tests__/providerRegistry.test.ts convex/briefings.test.ts convex/aggregates.test.ts convex/forecasts.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/lib/modelPricing.test.ts` — covers GW-05 pricing correctness + billingType skip
- [ ] Implement the `.todo` tests in `convex/__tests__/providerRegistry.test.ts` — covers GW-05 getBillingType

---

## Security Domain

This phase does not introduce new authentication, session management, access control, or cryptographic operations. The existing `setLLMConfig` provider validation guard is being PRESERVED (D-05). No ASVS review required beyond confirming the guard is not accidentally removed.

| ASVS Category | Applies | Notes |
|---------------|---------|-------|
| V5 Input Validation | Partial | setLLMConfig provider guard must remain intact |
| All others | No | No new auth, session, crypto, or access control surface |

---

## Sources

### Primary (HIGH confidence)
- Codebase read: `convex/lib/providers.ts` — provider registry structure
- Codebase read: `src/lib/modelPricing.ts` — pricing table structure and estimateCost signature
- Codebase read: `convex/schema.ts` — llmMetrics table definition (no billingType yet confirmed)
- Codebase read: `convex/llm.ts` — recordCall mutation structure
- Codebase read: `convex/aggregates.ts` — computeHourly idempotency guard + costByPeriod structure
- Codebase read: `convex/forecasts.ts` — costForecast full implementation
- Codebase read: `convex/briefings.ts` — full briefing generation flow; setLLMConfig line 241
- Codebase read: `convex/memoryQuality.ts` — contradiction detection action
- Codebase read: `src/components/TokenWaterfall.tsx` — MODEL_COLORS and grouping logic
- Codebase read: `src/components/AgentProfileEditor.tsx` — MODELS array at line 10
- Codebase read: `src/lib/providers.ts` — frontend mirror
- [OpenAI official pricing](https://openai.com/api/pricing/) — GPT-4o $2.50/$10, GPT-4o-mini $0.15/$0.60
- [Google AI Developer pricing](https://ai.google.dev/gemini-api/docs/pricing) — Gemini 2.5 Pro $1.25/$10, Gemini 2.5 Flash $0.30/$2.50

### Secondary (MEDIUM confidence)
- [OpenRouter Gemini 2.5 Flash](https://openrouter.ai/google/gemini-2.5-flash) — corroborates Flash $0.30/$2.50

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all files read from codebase
- Architecture: HIGH — all integration points verified in source
- Pitfalls: HIGH — derived from direct code reading; one pricing pitfall verified against official docs
- Gemini Flash price: LOW — D-11 contradicts official pricing; flagged for confirmation

**Research date:** 2026-05-22
**Valid until:** 2026-06-22 (stable domain; pricing can change — re-verify before implementation)
