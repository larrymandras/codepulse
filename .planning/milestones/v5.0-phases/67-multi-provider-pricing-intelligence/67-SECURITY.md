# Phase 67 Security Audit: Multi-Provider Pricing Intelligence

**Audited:** 2026-05-22
**Auditor:** Claude Opus 4.6 (automated security verification)
**ASVS Level:** 1
**Result:** SECURED

## Threat Register Verification

| Threat ID | Category | Component | Disposition | Status | Evidence |
|-----------|----------|-----------|-------------|--------|----------|
| T-67-01 | Spoofing | convex/llm.ts:recordCall | accept | CLOSED | `convex/llm.ts:21` derives billingType via `getBillingType(args.provider)`. `convex/lib/providers.ts:39` defaults unknown providers to `"api"` (conservative: overstates cost, never understates). Provider field sourced from trusted Astridr agent, not user input. |
| T-67-02 | Tampering | src/lib/modelPricing.ts | accept | CLOSED | `src/lib/modelPricing.ts` PRICING record is a compile-time constant with no user-writable surface. All rates are hardcoded literals. Incorrect prices affect display only, not billing. |
| T-67-03 | Tampering | convex/briefings.ts:setLLMConfig | mitigate | CLOSED | `convex/briefings.ts:244` contains guard: `if (provider !== "openai" && provider !== "anthropic")` throwing an error. Only "openai" and "anthropic" are accepted as LLM intelligence config providers. Guard verified present and active. |
| T-67-04 | Information Disclosure | convex/forecasts.ts | accept | CLOSED | `convex/forecasts.ts:51` `costForecast` is a read-only Convex query. Returns projected spend data (daily/weekly/monthly, budget status, daily history). No PII present. Data is operational cost telemetry for single-operator dashboard. |
| T-67-05 | Denial of Service | convex/aggregates.ts:computeHourly | accept | CLOSED | `convex/aggregates.ts:6` `computeHourly` is an `internalMutation` (no external HTTP surface). Per-dimension-key idempotency guard at line 46 (`existingKeys.has(dim)`) prevents duplicate inserts. Cron-triggered only. |
| T-67-06 | Information Disclosure | src/pages/Analytics.tsx | accept | CLOSED | `src/pages/Analytics.tsx` renders operational telemetry (API spend at line 113, subscription usage at line 124-127). No PII. Single-operator dashboard with no external exposure. |
| T-67-07 | Spoofing | src/components/SDKSpendCapGauge.tsx | accept | CLOSED | `src/components/SDKSpendCapGauge.tsx:21` reads from Convex query (`api.aggregates.costByPeriod`). Server-side data. Display-only component with no client-writable surface. |

## Accepted Risks Log

### T-67-01: Provider field spoofing on recordCall
- **Category:** Spoofing
- **Risk:** A malicious caller could send an arbitrary provider string to `recordCall`, causing incorrect billingType derivation.
- **Acceptance rationale:** Provider field comes from trusted Astridr agent (server-to-server). `getBillingType` defaults unknown providers to `"api"` which is the conservative path (shows more cost, not less). No financial impact; affects display only.
- **Residual risk:** Low. If an attacker gained access to the Convex mutation endpoint, billing type misclassification is the least of concerns.

### T-67-02: Pricing table tampering
- **Category:** Tampering
- **Risk:** Incorrect model pricing rates could mislead the operator about spend.
- **Acceptance rationale:** PRICING record is a hardcoded TypeScript constant in frontend code. No user-writable surface. Changes require code deployment. Affects dashboard display only, not actual billing.
- **Residual risk:** Negligible. Stale prices are an operational concern, not a security concern.

### T-67-04: Cost forecast data disclosure
- **Category:** Information Disclosure
- **Risk:** Cost projection data could be read by unauthorized parties.
- **Acceptance rationale:** Single-operator dashboard. No PII in forecast data. Cost projections are operational telemetry. Convex query access is controlled by deployment-level auth.
- **Residual risk:** Low.

### T-67-05: Aggregation DoS via computeHourly
- **Category:** Denial of Service
- **Risk:** Repeated invocation could create duplicate aggregate rows or overwhelm the database.
- **Acceptance rationale:** `computeHourly` is an `internalMutation` with no external HTTP surface. Per-dimension-key idempotency guard (`existingKeys` Set) prevents duplicate inserts even on repeated invocation. Cron-triggered only.
- **Residual risk:** Negligible.

### T-67-06: Analytics page information disclosure
- **Category:** Information Disclosure
- **Risk:** Operational telemetry visible on Analytics page.
- **Acceptance rationale:** Single-operator dashboard displaying aggregate cost and usage metrics. No PII. No external exposure beyond the authenticated dashboard.
- **Residual risk:** Low.

### T-67-07: SDKSpendCapGauge data spoofing
- **Category:** Spoofing
- **Risk:** Gauge could display incorrect spend data.
- **Acceptance rationale:** Component reads from server-side Convex query. No client-writable surface. Display-only. Any data manipulation would require compromising the Convex backend.
- **Residual risk:** Negligible.

## Unregistered Threat Flags

None. No `## Threat Flags` sections found in any SUMMARY.md files for this phase.

## Audit Methodology

Each threat was verified using the FORCE stance: assumed absent until grep evidence proved the mitigation exists in the correct location. For `mitigate` dispositions, the specific code pattern was located by file and line number. For `accept` dispositions, the architectural characteristics described in the acceptance rationale were verified against the implementation code.

### Files Examined
- `convex/llm.ts` -- recordCall mutation, subscriptionUsage query, getBillingType import
- `convex/briefings.ts` -- setLLMConfig provider guard at line 244
- `convex/forecasts.ts` -- costForecast query, filterAPIBilledRows helper
- `convex/aggregates.ts` -- computeHourly internalMutation, per-key idempotency, costByPeriod billingType filter
- `convex/lib/providers.ts` -- PROVIDER_BILLING map, getBillingType default-to-api fallback
- `src/lib/modelPricing.ts` -- static PRICING record, estimateCost with billingType parameter
- `src/pages/Analytics.tsx` -- API Spend / Subscription Usage split view
- `src/components/SDKSpendCapGauge.tsx` -- display-only gauge reading from Convex query

---
*Phase: 67-multi-provider-pricing-intelligence*
*Audit completed: 2026-05-22*
