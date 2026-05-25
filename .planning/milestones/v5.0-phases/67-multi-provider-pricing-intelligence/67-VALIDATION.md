---
phase: 67
slug: multi-provider-pricing-intelligence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-22
---

# Phase 67 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vite.config.ts` (implicit) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run convex/__tests__/providerRegistry.test.ts convex/briefings.test.ts convex/aggregates.test.ts convex/forecasts.test.ts src/lib/modelPricing.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 67-01-01 | 01 | 1 | GW-05 | — | N/A | unit | `npx vitest run src/lib/modelPricing.test.ts` | ❌ W0 | ⬜ pending |
| 67-01-02 | 01 | 1 | GW-05 | — | N/A | unit | `npx vitest run src/lib/modelPricing.test.ts` | ❌ W0 | ⬜ pending |
| 67-01-03 | 01 | 1 | GW-05 | — | N/A | unit | `npx vitest run convex/__tests__/providerRegistry.test.ts` | ✅ (.todo) | ⬜ pending |
| 67-01-04 | 01 | 1 | GW-05 | — | N/A | unit | `npx vitest run convex/__tests__/providerRegistry.test.ts` | ✅ (.todo) | ⬜ pending |
| 67-02-01 | 02 | 1 | GW-06 | — | setLLMConfig guard preserved | unit | `npx vitest run convex/briefings.test.ts` | ✅ | ⬜ pending |
| 67-03-01 | 03 | 2 | GW-07 | — | N/A | unit | `npx vitest run convex/aggregates.test.ts` | ✅ (new case) | ⬜ pending |
| 67-03-02 | 03 | 2 | GW-07 | — | N/A | unit | `npx vitest run convex/forecasts.test.ts` | ✅ (new case) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/modelPricing.test.ts` — stubs for GW-05 pricing correctness + billingType skip
- [ ] Implement `.todo` tests in `convex/__tests__/providerRegistry.test.ts` — covers GW-05 getBillingType

*Existing test files cover GW-06 and GW-07 but need new test cases added.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| TokenWaterfall renders GPT/Gemini colors correctly | GW-05 | Visual rendering | Open Analytics page with mixed provider data, verify color legend |
| Analytics split view shows API vs Subscription sections | GW-07 | Visual layout | Open Analytics page, verify split view with mock data |
| SDK spend cap gauge at 80% threshold | D-04 | Visual + threshold | Inject spend near $4, verify gauge and alert |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
