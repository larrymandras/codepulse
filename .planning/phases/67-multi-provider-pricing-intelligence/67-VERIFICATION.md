---
phase: 67-multi-provider-pricing-intelligence
verified: 2026-05-22T12:25:00Z
status: human_needed
score: 4/4
overrides_applied: 0
human_verification:
  - test: "Open Analytics page and verify API Spend / Subscription Usage split MetricCards"
    expected: "API Spend shows dollar amount; Subscription Usage shows call count / token total"
    why_human: "Visual rendering verification -- cannot confirm layout and styling programmatically"
  - test: "Open Analytics page and verify SDK Daily Cap gauge with progress bar and 80% marker"
    expected: "Gauge bar with percentage fill, 80% vertical marker line, and status badge (On Track / Near Limit / Cap Reached)"
    why_human: "Visual component rendering with CSS custom properties -- requires browser"
  - test: "Scroll to Token Usage section on Analytics and verify provider-grouped layout with color differentiation"
    expected: "Entries grouped by provider with header labels (display names), nested model bars underneath, GPT bars in green tones, Gemini bars in purple tones"
    why_human: "Provider grouping visual layout and color rendering cannot be verified without browser"
  - test: "Navigate to Settings > Agent Profiles and verify model dropdown includes GPT and Gemini models"
    expected: "Dropdown contains gpt-4o, gpt-4o-mini, gemini-2.5-pro, gemini-2.5-flash alongside Claude models"
    why_human: "Dropdown rendering requires interactive browser verification"
  - test: "Verify CostForecastPanel shows subscription exclusion note"
    expected: "Text 'Subscription providers (claude-cli, codex, antigravity) excluded from forecast' appears below forecast bar"
    why_human: "Visual rendering verification"
---

# Phase 67: Multi-Provider Pricing & Intelligence Verification Report

**Phase Goal:** Cost estimates, briefings, and intelligence features work correctly for all providers, not just Claude
**Verified:** 2026-05-22T12:25:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A Codex task using GPT-4o shows correct cost ($2.50/$10 per 1M tokens), not Claude Sonnet rates | VERIFIED | `src/lib/modelPricing.ts` contains `"gpt-4o": { input: 2.50 / 1_000_000, output: 10.00 / 1_000_000 }`. Test `estimateCost(1000, 1000, "gpt-4o")` returns 0.0125. All 4 GPT/Gemini models priced correctly. `estimateCost("gpt-4o", "subscription")` returns 0. 8 pricing tests pass. |
| 2 | Daily briefings generate without errors when gateway provider events are in the data | VERIFIED | `convex/briefings.ts` line 244: setLLMConfig guard preserved (`provider !== "openai" && provider !== "anthropic"`). D-06 comment at line 147 confirms provider-agnostic data query. `groupActivityEvents` tested with gateway provider events (briefings.test.ts line 62). `convex/memoryQuality.ts` D-07 comment at line 215. `identifyStaleMemories` tested with "mem-codex-old" (memoryQuality.test.ts line 65). All briefings+memoryQuality tests pass. |
| 3 | Analytics page cost breakdown distinguishes subscription (free) from API-billed usage | VERIFIED | `src/pages/Analytics.tsx` lines 43-47: `apiCostByProvider` query with `billingType: "api"`, `subscriptionUsage` query. Lines 112-127: "API Spend" MetricCard with dollar value, "Subscription Usage" MetricCard with `calls/tokens` display. `convex/llm.ts` `subscriptionUsage` query (line 200) filters by `getBillingType === "subscription"`. `convex/aggregates.ts` `costByPeriod` accepts `billingType` filter param (line 155). SDKSpendCapGauge (line 87-92 of Analytics.tsx) wired with `costByPeriod { billingType: "api", lookbackDays: 1 }`. |
| 4 | TokenWaterfall and provider map include all provider/model families | VERIFIED | `src/components/TokenWaterfall.tsx`: MODEL_COLORS contains `gpt-4o: "#22c55e"`, `gpt-4o-mini: "#4ade80"`, `gemini-2.5-pro: "#a855f7"`, `gemini-2.5-flash: "#c084fc"`. `byProvider` grouping (line 40). `PROVIDER_DISPLAY_NAMES` import (line 3). `convex/analytics.ts` line 238: `provider: r.provider` in tokenWaterfall return. `src/lib/providerLocations.ts`: All 4 gateway providers mapped (claude-cli, claude-sdk, codex, antigravity). |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `convex/lib/providers.ts` | PROVIDER_BILLING map and getBillingType() | VERIFIED | 41 lines, PROVIDER_BILLING covers 7 providers, getBillingType with "api" default. Imported by convex/llm.ts, convex/aggregates.ts. |
| `src/lib/providers.ts` | Frontend mirror of PROVIDER_BILLING | VERIFIED | 35 lines, identical PROVIDER_BILLING and getBillingType. Imported by TokenWaterfall.tsx. |
| `src/lib/modelPricing.ts` | GPT/Gemini pricing, billingType skip logic | VERIFIED | 21 lines, 4 new model prices, `billingType?: "api" \| "subscription"`, subscription returns 0. |
| `src/lib/modelPricing.test.ts` | Unit tests for multi-provider pricing | VERIFIED | 50 lines, 8 tests covering GPT, Gemini, billingType skip, and fallback. All pass. |
| `convex/__tests__/providerRegistry.test.ts` | Billing type tests | VERIFIED | 83 lines, 9 active billing tests + 4 todo stubs (pre-existing). All active tests pass. |
| `convex/schema.ts` | billingType field on llmMetrics | VERIFIED | Line 305: `billingType: v.optional(v.string())` in llmMetrics table. |
| `convex/llm.ts` | billingType derivation in recordCall | VERIFIED | Line 4: import getBillingType. Line 21: `const billingType = getBillingType(args.provider)`. Line 34: billingType in insert. |
| `convex/aggregates.ts` | billingType in cost dimensions + costByPeriod filter | VERIFIED | Lines 24-25: billingType derived, triple-part dimension key. Lines 38-43: per-key idempotency. Lines 155-175: costByPeriod with billingType filter. |
| `convex/forecasts.ts` | filterAPIBilledRows + API-only forecast | VERIFIED | Lines 11-18: exported filterAPIBilledRows. Line 67: apiRows = filterAPIBilledRows(rows). Line 71: byDay loop uses apiRows. |
| `convex/forecasts.test.ts` | filterAPIBilledRows tests | VERIFIED | Lines 73-114: 5 tests for API, subscription, legacy, null, and mixed rows. Plus D-04 threshold tests. All pass. |
| `convex/briefings.ts` | setLLMConfig guard preserved | VERIFIED | Line 244: `provider !== "openai" && provider !== "anthropic"` guard intact. D-06 comment at line 147. |
| `convex/briefings.test.ts` | Gateway provider data test | VERIFIED | Line 62: test "groupActivityEvents handles events with gateway provider names". Pass. |
| `convex/memoryQuality.ts` | LLM dispatch config-based | VERIFIED | Line 215-216: D-07 comment. Line 217: `primaryConfig.provider === "anthropic"` dispatch. |
| `convex/memoryQuality.test.ts` | Gateway provider memory tests | VERIFIED | Lines 65-87: "mem-codex-old" and "mem-antigravity-new" tests. computeDeduplicationRate provider-agnostic test. All pass. |
| `src/components/TokenWaterfall.tsx` | Provider-grouped with family colors | VERIFIED | 127 lines, byProvider grouping, MODEL_COLORS with GPT green + Gemini purple, PROVIDER_DISPLAY_NAMES import, pl-2 indent. |
| `src/components/SDKSpendCapGauge.tsx` | SDK daily spend cap gauge | VERIFIED | 87 lines, classifyCapStatus exported, DAILY_CAP=5.00, ALERT_THRESHOLD=0.8, costByPeriod with billingType="api" and lookbackDays=1, 80% marker at `left: "80%"`, min-h-[48px]. |
| `src/components/SDKSpendCapGauge.test.tsx` | Unit tests for status classification | VERIFIED | 40 lines, 8 tests covering ok/warning/exceeded boundaries and constants. All pass. |
| `src/pages/Analytics.tsx` | API/subscription split view | VERIFIED | Lines 43-47: apiCostByProvider + subscriptionUsage queries. Lines 87-92: SDKSpendCapGauge wired. Lines 112-127: "API Spend" and "Subscription Usage" MetricCards. |
| `convex/analytics.ts` | tokenWaterfall with provider field | VERIFIED | Line 238: `provider: r.provider` in return map. |
| `convex/llm.ts` | subscriptionUsage query | VERIFIED | Lines 200-220: query returning `{ calls, tokens }` filtered by `getBillingType === "subscription"`. |
| `src/components/CostForecastPanel.tsx` | Subscription exclusion note | VERIFIED | Line 98: "Subscription providers (claude-cli, codex, antigravity) excluded from forecast". |
| `src/lib/providerLocations.ts` | Gateway provider map locations | VERIFIED | Lines 7-10: claude-cli, claude-sdk (SF), codex (SF), antigravity (Mountain View). |
| `src/components/AgentProfileEditor.tsx` | GPT/Gemini in model dropdown | VERIFIED | Lines 10-19: MODELS includes gpt-4o, gpt-4o-mini, gemini-2.5-pro, gemini-2.5-flash. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| convex/llm.ts | convex/lib/providers.ts | import getBillingType | WIRED | Line 4: `import { getBillingType } from "./lib/providers"` |
| convex/aggregates.ts | convex/lib/providers.ts | import getBillingType | WIRED | Line 3: `import { getBillingType } from "./lib/providers"` |
| src/lib/modelPricing.ts | estimateCost callers | billingType parameter | WIRED | Parameter is optional; 3 existing callers use old 3-arg signature which works correctly (billingType undefined = normal calc). Subscription handling at ingest/aggregate level, not per-call. |
| convex/forecasts.ts | convex/aggregates table | filterAPIBilledRows | WIRED | Line 67: `filterAPIBilledRows(rows)` filters collected aggregate rows. |
| src/components/TokenWaterfall.tsx | convex/analytics.ts | useTokenWaterfall hook | WIRED | Line 42: `r.provider ?? "unknown"` consumes provider field from tokenWaterfall query. |
| src/pages/Analytics.tsx | convex/aggregates.ts | costByPeriod with billingType | WIRED | Line 43-46: `useQuery(api.aggregates.costByPeriod, { period: "daily", billingType: "api" })` |
| src/pages/Analytics.tsx | convex/llm.ts | subscriptionUsage query | WIRED | Line 47: `useQuery(api.llm.subscriptionUsage)` |
| src/components/SDKSpendCapGauge.tsx | convex/aggregates.ts | costByPeriod with billingType | WIRED | Line 21-25: `useQuery(api.aggregates.costByPeriod, { period: "daily", billingType: "api", lookbackDays: 1 })` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| Analytics.tsx | apiCostByProvider | convex/aggregates.ts costByPeriod | Yes -- queries aggregates table with billingType filter, groups by provider | FLOWING |
| Analytics.tsx | subscriptionUsage | convex/llm.ts subscriptionUsage | Yes -- queries llmMetrics, filters by getBillingType, counts calls/tokens | FLOWING |
| SDKSpendCapGauge.tsx | data (todaySpend) | convex/aggregates.ts costByPeriod | Yes -- same pipeline, billingType="api", lookbackDays=1 | FLOWING |
| TokenWaterfall.tsx | raw (providerGroups) | convex/analytics.ts tokenWaterfall | Yes -- queries llmMetrics, returns provider + model + tokens | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All Phase 67 tests pass | `npx vitest run` (7 test files) | 73 passed, 10 todo | PASS |
| TypeScript compiles without errors | `npx tsc --noEmit` | Exit 0, no output | PASS |
| estimateCost for GPT-4o correct | Verified in test output: `0.0125` for 1k/1k tokens | Matches $2.50/$10 per 1M | PASS |
| Subscription billing returns 0 | Verified in test: `estimateCost(1000, 1000, "gpt-4o", "subscription") === 0` | Correct | PASS |
| filterAPIBilledRows excludes subscription | Verified in test: subscription rows filtered out, legacy rows included as "api" | Correct | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| GW-05 | 67-01, 67-03 | Cost estimates work correctly for all providers | SATISFIED | 4 model prices in modelPricing.ts, billingType derivation at ingest, subscription skip, provider billing registry, 21 tests covering pricing |
| GW-06 | 67-02 | Daily briefings generate without errors when gateway provider events in data | SATISFIED | setLLMConfig guard preserved, groupActivityEvents tested with gateway data, memoryQuality tested with gateway memory IDs, D-06/D-07 comments |
| GW-07 | 67-02, 67-03 | Analytics page cost breakdown distinguishes subscription from API-billed | SATISFIED | costByPeriod billingType filter, filterAPIBilledRows, Analytics split view with API Spend + Subscription Usage MetricCards, SDKSpendCapGauge |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| -- | -- | No TODO/FIXME/placeholder patterns found in any Phase 67 files | -- | -- |

### Human Verification Required

### 1. Analytics API/Subscription Split View
**Test:** Open http://localhost:5173, navigate to Analytics page, verify the Summary row
**Expected:** "API Spend" MetricCard shows dollar amount. "Subscription Usage" MetricCard shows "N calls / N tokens" format. SDK Daily Cap gauge appears with progress bar and 80% threshold marker.
**Why human:** Visual rendering of MetricCards, gauge component, CSS custom properties, and layout cannot be verified programmatically.

### 2. TokenWaterfall Provider Grouping and Colors
**Test:** Scroll to Token Usage section on Analytics page (with mixed provider data)
**Expected:** Entries grouped by provider with uppercase header labels (e.g., "Claude CLI", "Codex CLI"). Models nested underneath with indented bars. GPT models render in green tones, Gemini in purple tones.
**Why human:** Provider grouping layout, color differentiation, and nested indentation require visual browser verification.

### 3. Agent Profile Model Dropdown
**Test:** Navigate to Settings > Agent Profiles, open the model dropdown
**Expected:** Dropdown contains gpt-4o, gpt-4o-mini, gemini-2.5-pro, gemini-2.5-flash alongside Claude models
**Why human:** Dropdown rendering requires interactive browser verification.

### 4. CostForecastPanel Subscription Note
**Test:** View CostForecastPanel on Analytics page
**Expected:** Small text "Subscription providers (claude-cli, codex, antigravity) excluded from forecast" below the forecast bar
**Why human:** Text rendering and positioning require visual verification.

### Gaps Summary

No automated gaps found. All 4 ROADMAP success criteria are verified in the codebase. All 73 tests pass across 7 test files. TypeScript compiles cleanly. All artifacts exist, are substantive, are wired, and data flows through them.

5 items require human visual verification to confirm the UI renders correctly in a browser. These are standard UI rendering checks that cannot be verified programmatically.

---

_Verified: 2026-05-22T12:25:00Z_
_Verifier: Claude (gsd-verifier)_
