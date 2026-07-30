---
phase: 104
slug: cost-intelligence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-30
---

# Phase 104 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `104-RESEARCH.md` §"Validation Architecture". The Per-Task Verification Map
> below cannot be completed until plans exist — `/gsd-plan-phase 104` fills it.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.9 (jsdom) + Playwright ^1.61.1 for E2E |
| **Config file** | `vitest.config.ts` — jsdom, `src/test/setup.ts`, includes `src/**/*.test.{ts,tsx}` and `convex/**/*.test.ts` |
| **Quick run command** | `npx vitest run <touched test files>` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | quick ~5–15s · full suite ~60s |

Convex logic is tested via extracted pure functions/handlers against a fake `ctx` — this
codebase's established pattern (`evalScores.ts`'s `insertRegressionAlertHandler` /
`detectRegressionsForPersona` are directly unit-testable without `convex-test`). No new test
framework or config is needed for this phase.

---

## Sampling Rate

- **After every task commit:** `npx vitest run <touched test files>`
- **After every plan wave:** `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~60 seconds

---

## Requirement → Test Map

Requirement-level map from research. Task IDs are assigned at plan time.

| Req ID | Behavior | Decision | Test Type | Automated Command | File Exists |
|--------|----------|----------|-----------|-------------------|-------------|
| COST-01 | Cost recomputed from tokens × rate, not the raw ingested `cost` | D-01 | unit | `npx vitest run convex/modelPricing.test.ts` | ❌ W0 |
| COST-01 | Unpriced model excluded from the total and shown as its own row — never valued at `default`, never rendered $0 inside the total | D-03 | unit | `npx vitest run convex/aggregates.test.ts -t "unpriced"` | ❌ W0 |
| COST-01 | **History re-prices retroactively** when a rate is added/changed, with zero rollup mutation | D-04 | unit | `npx vitest run convex/aggregates.test.ts -t "re-price"` | ❌ W0 |
| COST-01 | Billed and shadow ("covered") never merge into one headline | D-05 | unit + component | `npx vitest run src/components/CostTrendChart.test.tsx` | ❌ W0 |
| COST-01 | A gateway turn produces an `llmMetrics` row with `billingType: "subscription"` keyed on the opaque provider id | D-18 | unit + **live** | `npx vitest run convex/runtimeIngest.test.ts -t "gateway"` + live ingest probe | ❌ W0 |
| COST-01 | A subscription turn whose tokens are absent is shown unpriced — never $0, never a guess | D-18/D-03 | unit | `npx vitest run convex/modelPricing.test.ts -t "shadow"` | ❌ W0 |
| COST-02 | Warn fires at `warnFraction × limit`; breach fires at `limit` | D-11 | unit | `npx vitest run convex/costBudgets.test.ts` | ❌ W0 |
| COST-02 | `SDKSpendGuard` reads the global-daily `costBudgets` row, not module constants | D-12 | unit | extend `src/components/SDKSpendGuard.test.tsx` | ✓ extend |
| COST-02 | `CostForecastPanel` reads its monthly limit from `costBudgets`; the `agentConfigs` value is migrated as seed and no longer read | D-19 | unit | `npx vitest run src/components/CostForecastPanel.test.tsx` | ❌ W0 |
| COST-02 | Exactly one cap source is live — no path reads a hardcoded or `agentConfigs` cap after migration | D-12/D-19 | unit + review | grep assertion: no residual `DAILY_CAP` / `intelligence.budget_cap` read on a render path | ❌ W0 |
| COST-03 | Alert fires once per `(budgetId, level, periodStart)` and re-arms at period reset | D-15 | unit | `npx vitest run convex/costBudgets.test.ts -t "dedup"` | ❌ W0 |
| COST-03 | Alert insert uses the delivering path (`webhookStatus: "pending"` + `scheduler.runAfter`), never public `alerts.create` | D-17 | unit | assert fake-ctx call args, per `evalScores.test.ts` | ❌ W0 |
| COST-03 | `computeHourly` tail-append adds no unbounded read | D-14 | unit + **review gate** | assert every new read is index-range-bounded; no raw `llmMetrics` re-scan | ❌ W0 |
| COST-03 | `gatewayQuotaSnapshots` actually fills after the poller fix, before any threshold is built on it | D-20 | **live** | live read-only query returns non-zero rows | ❌ W0 |

---

## Wave 0 Requirements

- [ ] `convex/modelPricing.test.ts` — CRUD, rate lookup, unpriced behavior, shadow-rate mapping
- [ ] `convex/costBudgets.test.ts` — CRUD, warn/breach classification, dedup
- [ ] Extend `convex/aggregates.test.ts` — prompt/completion token split, read-time dollar derivation, re-pricing, unpriced exclusion
- [ ] Extend `convex/runtimeIngest.test.ts` — the D-18 gateway → `llmMetrics` write
- [ ] Extend `src/components/SDKSpendGuard.test.tsx` — limit/warnFraction sourced from a `costBudgets` row
- [ ] `src/components/CostForecastPanel.test.tsx` — monthly cap sourced from `costBudgets` (D-19)
- [ ] No new framework or config — existing Vitest/Playwright setup covers this phase

---

## Manual-Only Verifications

These cannot be proven by the unit suite. **A green suite is not accepted as proof for any row
here** — the same live-verification discipline Phase 103 established.

| Behavior | Req | Why Manual | Test Instructions |
|----------|-----|------------|-------------------|
| D-14: the tail-append does not push `computeHourly` past the 15s syscall cap | COST-03 | Vitest cannot measure real Convex query cost; the disabled `evaluateInternal` cron is what this failure mode looks like | Run `computeHourly` against the live self-hosted instance, measure execution time and confirm no retry-backoff entries appear |
| D-20: the repaired quota poller actually lands rows | COST-02 | Cross-repo config + a sidecar that must be reachable from the Convex backend | Live read-only query of `gatewayQuotaSnapshots` returns non-zero rows after one 5-min poll cycle |
| D-18: a real gateway turn produces a real `llmMetrics` row | COST-01 | Requires driving an actual Claude Code / Codex turn through the gateway | Run one gateway turn, then live-query `llm:subscriptionUsage` and assert `calls > 0` |
| A1: the gateway → Ástríðr → Convex forwarding chain is live at all | COST-01 | Research assumed but did not verify `ASTRIDR_TELEMETRY_WEBHOOK_URL` is configured | **Check before Wave 1** — if the webhook is unconfigured, D-18 has no live signal to build or test against |
| D-03: the "N models need rates" nudge reflects reality on day one | COST-01 | Depends on the live model mix, not on fixtures | After seeding `modelPricing`, confirm the nudge count matches the distinct unpriced model ids actually present in `llmMetrics` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] Every **Manual-Only** row above executed and recorded — not inferred from a green suite
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
