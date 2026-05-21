# Phase 67: Multi-Provider Pricing & Intelligence - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Cost estimates, briefings, and intelligence features work correctly for all providers, not just Claude. This phase fixes data accuracy across the pricing, aggregation, and visualization pipeline so that gateway provider events (codex, antigravity, claude-sdk) produce correct costs, appear in briefings, and render properly in analytics views.

</domain>

<decisions>
## Implementation Decisions

### Subscription Cost Handling
- **D-01:** Subscription providers (claude-cli, codex, antigravity) show $0 actual cost. API-billed providers (claude-sdk) show real cost. Analytics page gets a split view: "API Spend" (real money) vs "Subscription Usage" (call counts/tokens).
- **D-02:** Cost forecasting (CostForecastPanel) only projects API-billed spend. Subscription usage is tracked but not forecasted as cost.
- **D-03:** billingType derived from provider registry (`convex/lib/providers.ts`) — no upstream Ástríðr changes needed. Provider registry gets a billing type map (e.g., `claude-sdk → "api"`, `codex → "subscription"`).
- **D-04:** $5/day SDK spend cap surfaced in dashboard with visual gauge. Auto-alert fires at 80% ($4).

### Intelligence Provider Scope
- **D-05:** LLM intelligence calls (briefings, memory quality) stay openai + anthropic only — these require direct API keys stored in agentConfigs. Gateway providers are not added as LLM provider choices.
- **D-06:** Fix `briefings.ts:241` provider validation — accept ALL provider names in the data being summarized. The validation should only gate which LLM to call for generation, not filter which provider data flows into the narrative.
- **D-07:** Same fix for `memoryQuality.ts:216` — accept any provider in data, validate only the LLM config provider used for the contradiction-check call.

### Multi-Provider Visualization
- **D-08:** TokenWaterfall groups by provider, then model (provider headers with models nested underneath).
- **D-09:** Provider family color scheme — GPT = green tones (#22c55e variants), Gemini = purple tones (#a855f7 variants), Claude keeps existing gold/cyan/emerald palette.
- **D-10:** All gateway providers get map locations — claude-cli/claude-sdk → San Francisco (Anthropic), codex → San Francisco (OpenAI), antigravity → Mountain View (Google).

### Model Pricing
- **D-11:** Add exactly 4 models to `modelPricing.ts`: GPT-4o ($2.50/$10 per 1M), GPT-4o-mini ($0.15/$0.60), Gemini 2.5 Pro ($1.25/$10), Gemini 2.5 Flash ($0.15/$0.60).
- **D-12:** Cost estimation skips pricing lookup when billingType = "subscription" — return 0 at call site. `modelPricing.ts` only contains API-billed model rates.
- **D-13:** Default fallback for unknown API-billed models stays at Claude Sonnet rates ($3/$15 per 1M).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Provider Architecture
- `.planning/phases/66-gateway-compatibility/CONTEXT.md` — Gateway data contracts (TaskEvent, GatewayHealth, QuotaStatus), provider naming, cross-repo boundaries
- `convex/lib/providers.ts` — Central provider registry (GATEWAY_PROVIDERS, LEGACY_PROVIDERS, ALL_PROVIDERS). Extend with billing type map.

### Pricing & Cost
- `src/lib/modelPricing.ts` — Current pricing table (Claude-only). Expand with GPT/Gemini rates.
- `convex/forecasts.ts` — Cost forecasting queries aggregates table. Filter to API-billed only.
- `convex/aggregates.ts` — Cost aggregation pipeline. Add billing dimension.

### Intelligence Features
- `convex/briefings.ts` — LLM-generated briefings. Fix provider validation at line 241. Accept all providers in data, validate only LLM config.
- `convex/memoryQuality.ts` — Memory contradiction checker. Fix provider handling at line 216. Same pattern as briefings fix.

### UI Components
- `src/components/TokenWaterfall.tsx` — Token usage visualization. Add provider grouping and family colors.
- `src/components/LLMProviderConfig.tsx` — LLM provider settings (stays openai/anthropic only per D-05).
- `src/components/AgentProfileEditor.tsx` — Agent model dropdown. Expand with non-Claude models.
- `src/pages/Analytics.tsx` — Analytics page. Add API/subscription split view.

### Schema
- `convex/schema.ts` — Add billingType field to llmMetrics table.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `convex/lib/providers.ts`: Central provider registry already exists from Phase 66. Extend with `PROVIDER_BILLING` map and `getBillingType()` helper.
- `src/lib/modelPricing.ts`: Simple pricing table with `estimateCost()` function. Already used by 3 components (AgentAnalytics, TokenUsageChart, MetricsDashboard). Extend with GPT/Gemini rates.
- `convex/forecasts.ts`: `costForecast` query reads from aggregates table. Add billingType filter parameter.
- `src/components/TokenWaterfall.tsx`: `MODEL_COLORS` record and `getModelColor()` function. Extend with GPT/Gemini family colors.

### Established Patterns
- Provider registry pattern: `convex/lib/providers.ts` exports typed arrays + type unions. Follow same pattern for billing type map.
- LLM dual-provider failover: `briefings.ts` calls Anthropic or OpenAI based on stored config. Keep this pattern, just fix the data-side validation.
- Cost aggregation: `convex/aggregates.ts` stores metric_type="cost" rows with daily/hourly periods. Add provider/billingType dimensions.

### Integration Points
- OTel ingest pipeline already tags `provider` on events (from Phase 66). billingType lookup uses same provider value.
- `runtimeIngest.ts:62` extracts `cost` from ingest payloads. Add billingType derivation here.
- `AgentProfileEditor.tsx` MODELS array at line 10 — extend with GPT/Gemini model names.

</code_context>

<specifics>
## Specific Ideas

- Analytics page split view should clearly distinguish "money leaving your account" (API) from "included in subscription" — operators need to know their actual burn rate at a glance.
- SDK spend cap ($5/day) gauge on Analytics or Settings, with 80% auto-alert matching existing anomaly detection pattern.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 67-Multi-Provider Pricing & Intelligence*
*Context gathered: 2026-05-21*
