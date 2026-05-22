---
phase: 67-multi-provider-pricing-intelligence
plan: 01
subsystem: api, database, ui
tags: [pricing, billing, convex, typescript, vitest, tdd]

requires:
  - phase: 66-gateway-compatibility
    provides: gateway provider registry (GATEWAY_PROVIDERS, LEGACY_PROVIDERS, ALL_PROVIDERS)
provides:
  - PROVIDER_BILLING map and getBillingType() on backend and frontend
  - GPT-4o, GPT-4o-mini, Gemini 2.5 Pro, Gemini 2.5 Flash pricing rates
  - billingType field on llmMetrics schema with ingest derivation
  - estimateCost billingType parameter (subscription returns $0)
  - Gateway provider map locations
  - Extended model dropdowns in AgentProfileEditor
affects: [67-02, 67-03, cost-forecasting, aggregation, analytics]

tech-stack:
  added: []
  patterns: [billing-type-derivation-at-ingest, subscription-zero-cost-pattern]

key-files:
  created:
    - src/lib/modelPricing.test.ts
  modified:
    - convex/lib/providers.ts
    - src/lib/providers.ts
    - src/lib/modelPricing.ts
    - convex/__tests__/providerRegistry.test.ts
    - convex/schema.ts
    - convex/llm.ts
    - src/components/AgentProfileEditor.tsx
    - src/lib/providerLocations.ts

key-decisions:
  - "getBillingType defaults unknown providers to 'api' (conservative: shows more cost, not less)"
  - "billingType derived at ingest time via getBillingType(provider) rather than stored on provider config"
  - "Gemini 2.5 Flash priced at $0.30/$2.50 per 1M per D-11 (Larry-confirmed 2026-05-22)"

patterns-established:
  - "Billing type derivation: getBillingType(provider) at ingest, stored on llmMetrics row"
  - "Subscription cost skip: estimateCost returns 0 when billingType='subscription'"
  - "Provider registry sync: convex/lib/providers.ts and src/lib/providers.ts must stay in sync"

requirements-completed: [GW-05]

duration: 3min
completed: 2026-05-22
---

# Phase 67 Plan 01: Multi-Provider Pricing Foundation Summary

**Provider billing registry with GPT/Gemini pricing, billingType schema field, ingest derivation, and 21 passing tests (TDD)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-22T11:45:08Z
- **Completed:** 2026-05-22T11:48:17Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- PROVIDER_BILLING map and getBillingType() helper on both backend (convex/lib/providers.ts) and frontend (src/lib/providers.ts) covering all 7 providers
- Extended modelPricing.ts with GPT-4o ($2.50/$10), GPT-4o-mini ($0.15/$0.60), Gemini 2.5 Pro ($1.25/$10), Gemini 2.5 Flash ($0.30/$2.50) per D-11
- billingType optional field on llmMetrics schema with automatic derivation in recordCall mutation
- estimateCost accepts billingType parameter -- subscription returns $0 (D-12), unknown models fall back to Sonnet rates (D-13)
- AgentProfileEditor dropdown extended with gpt-4o-mini, gemini-2.5-pro, gemini-2.5-flash
- All 4 gateway providers added to provider map locations (claude-cli/claude-sdk -> SF, codex -> SF, antigravity -> Mountain View)
- 21 tests passing including 8 new modelPricing tests and 9 new billing type tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Provider billing registry + model pricing extension + tests (TDD)**
   - `041a915` (test) -- RED: failing tests for billing registry and multi-provider pricing
   - `2c1d2a5` (feat) -- GREEN: implementation passing all tests
2. **Task 2: Schema extension + ingest wiring + model dropdowns + map locations** - `2657cb9` (feat)

## Files Created/Modified
- `convex/lib/providers.ts` - Added PROVIDER_BILLING map and getBillingType() helper
- `src/lib/providers.ts` - Frontend mirror of PROVIDER_BILLING and getBillingType()
- `src/lib/modelPricing.ts` - Added 4 GPT/Gemini price entries, billingType parameter on estimateCost
- `src/lib/modelPricing.test.ts` - New: 8 unit tests for multi-provider pricing and billing skip
- `convex/__tests__/providerRegistry.test.ts` - Added 9 billing type tests
- `convex/schema.ts` - Added billingType optional field to llmMetrics table
- `convex/llm.ts` - Import getBillingType, derive and store billingType on every insert
- `src/components/AgentProfileEditor.tsx` - Extended MODELS array with GPT/Gemini entries
- `src/lib/providerLocations.ts` - Added claude-cli, claude-sdk, codex, antigravity map locations

## Decisions Made
- getBillingType defaults unknown providers to "api" (conservative: shows more cost, not less) per T-67-01
- billingType derived at ingest time from provider name rather than requiring callers to pass it
- Gemini 2.5 Flash priced at $0.30/$2.50 per 1M tokens per D-11 (confirmed by Larry 2026-05-22)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## TDD Gate Compliance

- RED gate: `041a915` (test commit with all failing tests)
- GREEN gate: `2c1d2a5` (feat commit making all tests pass)
- REFACTOR gate: not needed (code was clean after GREEN)

## Next Phase Readiness
- billingType is now derivable from any provider name and stored on every new llmMetrics row
- Plans 67-02 (aggregation) and 67-03 (visualization) can consume billingType for cost breakdowns
- estimateCost with billingType parameter ready for cost forecasting updates

## Self-Check: PASSED

- All 9 files verified present on disk
- All 3 commit hashes found in git log
- PROVIDER_BILLING confirmed in both backend and frontend
- gpt-4o pricing confirmed in modelPricing.ts
- billingType confirmed in schema.ts
- getBillingType confirmed in llm.ts

---
*Phase: 67-multi-provider-pricing-intelligence*
*Completed: 2026-05-22*
