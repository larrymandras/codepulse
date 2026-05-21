# Phase 67: Multi-Provider Pricing & Intelligence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 67-multi-provider-pricing-intelligence
**Areas discussed:** Subscription cost handling, Intelligence provider scope, Multi-provider visualization, Model pricing granularity

---

## Subscription Cost Handling

### Q1: How should subscription-provider calls appear in cost views?

| Option | Description | Selected |
|--------|-------------|----------|
| Zero cost + separate section | Subscription calls show $0 actual cost. Analytics page gets a split view: 'API Spend' vs 'Subscription Usage'. Cost forecasting only tracks API-billed providers. | ✓ |
| Theoretical cost comparison | Show what the call WOULD have cost at API rates as a 'savings' metric. | |
| Just tag, don't zero | Keep existing cost estimation for all calls but add a billingType badge. | |

**User's choice:** Zero cost + separate section
**Notes:** None

### Q2: For cost forecasting, should it only project API-billed spend?

| Option | Description | Selected |
|--------|-------------|----------|
| API-billed only | CostForecastPanel only forecasts real dollar spend (claude-sdk). Subscription usage tracked but not forecasted. | ✓ |
| Both with separate lines | Forecast panel shows API spend projection AND subscription token consumption trend. | |

**User's choice:** API-billed only
**Notes:** None

### Q3: How should billingType be determined on ingested llmMetrics rows?

| Option | Description | Selected |
|--------|-------------|----------|
| Derive from provider registry | Provider registry gets a billing type map. Ingest looks up provider and tags automatically. | ✓ |
| Require from ingest payload | Gateway and OTel events must include billingType in their payload. | |
| Default subscription, override API | All providers default to 'subscription'. Only claude-sdk gets 'api'. | |

**User's choice:** Derive from provider registry
**Notes:** None

### Q4: Should the $5/day cap for claude-sdk be surfaced in the dashboard?

| Option | Description | Selected |
|--------|-------------|----------|
| Show in dashboard | Analytics or Settings shows current SDK spend vs $5 cap with visual gauge. Budget alert fires at 80%. | ✓ |
| Gateway-only tracking | Cap enforcement stays in gateway. Display deferred to Phase 69. | |

**User's choice:** Show in dashboard
**Notes:** None

---

## Intelligence Provider Scope

### Q1: Should gateway providers be available as LLM intelligence provider options?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep openai + anthropic only | These LLM calls need direct API keys. Fix validation errors but don't add gateway providers as choices. | ✓ |
| Add google as third option | Add Google AI (Gemini) as a third intelligence provider choice. Requires storing a Google API key. | |

**User's choice:** Keep openai + anthropic only
**Notes:** None

### Q2: How should briefings.ts handle non-OpenAI/Anthropic data in briefing narratives?

| Option | Description | Selected |
|--------|-------------|----------|
| Accept all providers in data, validate only LLM config | Provider validation only gates which LLM to call. Data from ANY provider flows into narrative. | ✓ |
| Skip unknown provider rows | Filter out non-openai/anthropic rows from briefing data. | |

**User's choice:** Accept all providers in data, validate only LLM config
**Notes:** None

---

## Multi-Provider Visualization

### Q1: How should TokenWaterfall display multi-provider data?

| Option | Description | Selected |
|--------|-------------|----------|
| Group by provider, then model | Provider headers with models nested under each. Clear visual hierarchy. | ✓ |
| Flat model list with provider badge | Keep flat list with small provider icon/badge next to each model name. | |
| Provider ring + model bars | Color-coded provider ring on left, model breakdown bars on right. | |

**User's choice:** Group by provider, then model
**Notes:** None

### Q2: Color scheme for non-Claude model families?

| Option | Description | Selected |
|--------|-------------|----------|
| Provider family colors | GPT = green tones, Gemini = purple tones. Claude keeps existing gold/cyan/emerald. | ✓ |
| Distinct per-model colors | Each model gets a unique color regardless of family. | |
| You decide | Pick whatever looks best against existing oklch dark theme. | |

**User's choice:** Provider family colors
**Notes:** None

### Q3: Should gateway providers get map locations?

| Option | Description | Selected |
|--------|-------------|----------|
| Add locations for all gateway providers | claude-cli/claude-sdk → SF, codex → SF, antigravity → Mountain View. | ✓ |
| Skip map for gateway providers | Health panel without map pins for gateway providers. | |

**User's choice:** Add locations for all gateway providers
**Notes:** None

---

## Model Pricing Granularity

### Q1: Which GPT/Gemini models should be in modelPricing.ts?

| Option | Description | Selected |
|--------|-------------|----------|
| Exactly those four | GPT-4o, GPT-4o-mini, Gemini 2.5 Pro, Gemini 2.5 Flash with specified rates. | ✓ |
| Add o3 and o4-mini too | Include reasoning models for future-proofing. | |
| Just the four + extensible pattern | Add four models but also restructure to registry pattern. | |

**User's choice:** Exactly those four
**Notes:** None

### Q2: How should subscription models handle pricing lookup?

| Option | Description | Selected |
|--------|-------------|----------|
| Skip at call site | Cost estimation checks billingType first. If 'subscription', return 0 without lookup. | ✓ |
| Add $0 entries in pricing table | Add subscription model names with {input: 0, output: 0} to PRICING object. | |

**User's choice:** Skip at call site
**Notes:** None

### Q3: What should the default fallback rate be for unknown API-billed models?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep Sonnet as default | Sonnet rates ($3/$15 per 1M). Conservative mid-tier estimate. | ✓ |
| Use GPT-4o-mini rates | Cheapest common model ($0.15/$0.60). | |
| Flag as unknown, no estimate | Return null for unknown models. Dashboard shows 'cost unknown'. | |

**User's choice:** Keep Sonnet as default
**Notes:** None

---

## Claude's Discretion

None — all decisions made by user.

## Deferred Ideas

None — discussion stayed within phase scope.
