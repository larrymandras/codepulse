---
phase: 104-cost-intelligence
verified: 2026-08-03T14:10:00Z
status: passed
score: 12/12 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 11/12
  gaps_closed:
    - "D-01 (locked decision): CodePulse recomputes cost from tokens x rate everywhere — no display surface reads the raw ingested llmMetrics.cost as the displayed truth."
  gaps_remaining: []
  regressions: []
deferred: []
---

# Phase 104: Cost Intelligence Verification Report

**Phase Goal:** "Spend is legible per model and per provider over time, with configurable budget
thresholds and alerts that fire through the existing alert-routing layer when spend spikes or
crosses a threshold."
**Verified:** 2026-08-03
**Status:** passed
**Re-verification:** Yes — after gap closure

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | COST-01: per-model/per-provider cost breakdown over time (chart + table), correctly attributing the current model mix | ✓ VERIFIED | Unchanged from initial pass — `CostTrendChart.tsx`, `CostBreakdownTable.tsx`, live-confirmed pricing coverage. |
| 2 | D-01: dollars are derived by CodePulse from tokens x rate everywhere — no surface reads the raw ingested `llmMetrics.cost` as the displayed truth | ✓ VERIFIED (gap closed) | Re-read `src/pages/Analytics.tsx:63-66,83-86,146` live: the "API Spend" MetricCard now reads `useQuery(api.costDerived.billedOverTime, { period: "daily", lookbackHours: 30*24 })`, sums `billedUsd`, and renders `"--"` while `apiSpendDerived` is undefined instead of `$0.0000`. Re-read `src/components/LlmAnalyticsPanel.tsx:24-57,96-104` live: the Model Breakdown money column now joins `api.costDerived.costBreakdown` by model, renders `"Unpriced"` when no priced row exists and `"--"` while loading; `api.llm.costByModel` (line 11) is still queried but only its `calls`/`tokens` fields are read (confirmed by reading the render path — no `.cost` access) — raw measurements, which D-01 does not govern. Commit `7e278003` confirmed in `git log`, diff matches the SUMMARY's description exactly. Own sweep (see below) confirms no other cost-legibility surface reads `aggregates.costByPeriod`/`costByPeriodByProvider` or `llm.costByProvider`/`costOverTime`/the `.cost` field of `costByModel`. |
| 3 | D-03: an unpriced model is never silently valued at $0 or the `default` rate | ✓ VERIFIED | Unchanged; re-confirmed `LlmAnalyticsPanel`'s new join also honors D-03 (`"Unpriced"` label, `"--"` while loading, never `$0.0000` — asserted in its own test suite). |
| 4 | D-05: billed and shadow/"covered" dollars never merge into one headline | ✓ VERIFIED | Unchanged. |
| 5 | COST-02: budget thresholds configurable per-model and/or global, persisted in Convex | ✓ VERIFIED | Unchanged. |
| 6 | D-12/D-19: exactly one cap source is live | ✓ VERIFIED | Unchanged. |
| 7 | COST-03: alerts fire through the existing alert-routing layer | ✓ VERIFIED | Unchanged. |
| 8 | D-14: budget evaluator runs at the tail of `computeHourly`, no new cron | ✓ VERIFIED | Unchanged. |
| 9 | D-15: alert fires once per `(budgetId, level, periodStart)` | ✓ VERIFIED | Unchanged. |
| 10 | D-16: alert-only, no enforcement wording, no runtime mutation | ✓ VERIFIED | Unchanged. |
| 11 | D-17: alert insert uses the delivering path, never public `alerts.create` | ✓ VERIFIED | Unchanged. |
| 12 | Auth: `costBudgets`/`modelPricing` writes gated, seed/internal functions not public | ✓ VERIFIED | Unchanged. |

**Score:** 12/12 truths verified

### My Own D-01 Re-Sweep (not taken on trust)

Ran independently against the live tree (not the SUMMARY's claims):

```
grep -rn "costByPeriod|costByPeriodByProvider|llm\.costByProvider|llm\.costOverTime|costByModel" src/ convex/
```

- `convex/aggregates.ts` still exports `costByPeriod` (line 452) and `costByPeriodByProvider`
  (line 488) — confirmed **zero** consumers anywhere in `src/` (only referenced in
  `aggregates.test.ts` and a code comment). Orphaned, not wired to any render path. Matches
  the executor's claim.
- `convex/llm.ts` exports `costByProvider` (line 162); no `costOverTime` export exists in
  `llm.ts` at all (the SUMMARY's "llm.costOverTime" refers to the derived-layer
  `costDerived.costOverTime`, which is the correct, wired one — confirmed by reading
  `convex/costDerived.ts:182`). Both readings are consistent with "zero legacy consumers."
- `api.llm.costByModel` has exactly one consumer, `LlmAnalyticsPanel.tsx:11`, and reading its
  render path top to bottom confirms only `data.calls` and `data.tokens` are read from it — no
  `.cost` access. The dollar column is sourced from `costDerived.costBreakdown` (line 24).
- `convex/aggregates.ts:567` `costByGoalPeriod` (consumed by `useCostByGoal` →
  `CostBreakdown.tsx`, the HivePage per-goal cost widget) already calls `deriveBucketDollars`
  internally and keeps the ingested sum only as `reportedTotal` (never rendered) — this was
  already D-01-compliant before this gap-closure pass (Phase 149-04 lineage), not a new finding.

**Conclusion: confirmed, not refuted.** No remaining spend-legibility surface (Analytics cost
cluster, Cost Forecast, SDK Spend Cap, Cost Trend, Cost Breakdown, Model Breakdown, Budget
admin, per-goal HivePage cost widget) reads the legacy `metric_type: "cost"` aggregate or a raw
`llmMetrics.cost` sum as its displayed truth.

### Additional Findings — Out of D-01's Scope (Non-Blocking, Informational)

Widening the sweep beyond the specific symbols named in the hand-off (plain `.cost` field reads
across all of `src/`) surfaced three more raw-cost displays. All three **predate Phase 104** and
sit outside the COST-01/02/03 "spend intelligence" surfaces this phase built or touched:

1. `src/pages/Analytics.tsx:244` — the "Recent LLM Calls" table's per-row Cost column
   (`call.cost`), added in commit `9030fb8a` (Phase 94, 2026-07-06). Displays the SDK-reported
   cost for one specific call as evidence, not an aggregate spend total.
2. `src/components/TraceWaterfall.tsx:114-171` — per-span cost label and a per-trace
   `totalCost`/`groupCostLabel` sum, added in `ac4b66c3` (Phase 94-03). A single-session debug
   timeline, not a budget-tracking dashboard.
3. `src/components/chat/VitalsRail.tsx:208,335` — a live "$ Session" meter summing the last 25
   calls' raw `cost` field, present since `565cef36` (chat command-center feature, predates
   Phase 104 by a wide margin).

None of these three files appear in any 104-*-SUMMARY.md key-files list, and D-01's own
rationale text (`104-CONTEXT.md:27-32`, under "Cost Attribution — where the dollar comes from
(COST-01)") is scoped to "one place to fix a mispriced model" — i.e., the aggregate/rollup spend
totals an operator uses for budget decisions, not a per-call/per-trace debug readout of what the
agent itself reported. Treating these as in-scope would mean rewriting two debugging tools
(`TraceWaterfall`, `VitalsRail`) that were never part of this phase's plan.

**Judgment call:** these are **not** classified as gaps against this phase's goal. They are
recorded here for transparency and as a candidate scope question for a future phase/decision if
the intent is for D-01 to govern every dollar-shaped number in the app, not just the
spend-legibility surfaces COST-01/02/03 target.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/pages/Analytics.tsx` | Cost cluster hosts fixed panels, no stray legacy-cost surface | ✓ VERIFIED | "API Spend" MetricCard now sourced from `costDerived.billedOverTime`; gap closed. |
| `src/components/LlmAnalyticsPanel.tsx` | Model Breakdown money column derived, not legacy | ✓ VERIFIED | Joined to `costDerived.costBreakdown`; 6 new tests including a source-level regex guard against `formatCost(row.cost)` reappearing. |
| All other artifacts (`convex/modelPricing.ts`, `convex/costBudgets.ts`, `convex/costDerived.ts`, `convex/costBudgetEval.ts`, `convex/gatewayQuota.ts`, `convex/runtimeIngest.ts`, `SDKSpendGuard.tsx`, `CostForecastPanel.tsx`, `CostBudgetsAdmin.tsx`, `ModelPricingAdmin.tsx`) | Unchanged from initial pass | ✓ VERIFIED | No regressions found; full suite green. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `Analytics.tsx` "API Spend" MetricCard | `totalApiSpend` | `api.costDerived.billedOverTime` (30-day daily buckets, summed `billedUsd`) | Yes — same derivation pipeline as `CostTrendChart`/`SDKSpendGuard` | ✓ FLOWING |
| `LlmAnalyticsPanel.tsx` Model Breakdown money column | `row.derivedCost` | `api.costDerived.costBreakdown` joined by model | Yes — tokens × live rate, per-model | ✓ FLOWING |
| `LlmAnalyticsPanel.tsx` Calls/Tokens columns | `row.calls`, `row.tokens` | `api.llm.costByModel` | Yes — raw measurements, outside D-01's scope by design | ✓ FLOWING |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `Analytics.tsx` "API Spend" card | `costDerived.billedOverTime` | `useQuery` | ✓ WIRED | Correct source, matches CR-01's pattern. |
| `LlmAnalyticsPanel.tsx` money column | `costDerived.costBreakdown` | `useQuery` + model-keyed join | ✓ WIRED | New `derivedByModel` Map join, tested. |
| All other key links from initial pass | — | — | ✓ WIRED | No regressions. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| New D-01 regression-guard tests | `npx vitest run src/components/LlmAnalyticsPanel.test.tsx` | 6/6 passed, including a source-level regex guard for `formatCost(row.cost)` | ✓ PASS |
| Root TypeScript typecheck | `npx tsc --noEmit` | Clean, no output | ✓ PASS |
| Convex typecheck | `npx convex codegen --typecheck=disable` then `npx tsc --noEmit -p convex/tsconfig.json` | Clean, no output | ✓ PASS |
| Full unit suite (independently re-run, not trusted from SUMMARY) | `npx vitest run` | 256 files / 3158 tests passed, 0 failed, 193 todo (unrelated pre-existing) | ✓ PASS — exact match to SUMMARY's claimed 3158/0 |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention in this repo (unchanged from initial pass). SKIPPED.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| COST-01 | 104-01,02,03,05,07,09,10,11 (+ gap-closure commit `7e278003`) | Per-model/per-provider cost breakdown over time, correctly attributing the current model mix | ✓ SATISFIED | The D-01 violation that undermined this (truth #2) is closed; the Analytics page's own "API Spend" figure now agrees with the panels beneath it. |
| COST-02 | 104-01,02,04,07,08,11 | Budget thresholds, configurable per-model and/or global, persisted in Convex | ✓ SATISFIED | Unchanged from initial pass. |
| COST-03 | 104-06,11 | Anomaly/budget alerts through existing alert-routing layer, no new channel | ✓ SATISFIED | Unchanged from initial pass. |

No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/CostTrendChart.tsx` | 31, 38 | Hardcoded hex fallback `"#6b7280"` for an unmapped provider color | ℹ️ Info (downgraded from Warning) | Re-confirmed this is the exact value of `ollama`'s entry in `src/lib/providers.ts`'s shared `PROVIDER_COLORS` map — a deliberate exemption, triaged during execution and correctly recorded as tech debt outside this phase's scope, not a phase-104 defect. Tokenising only the fallback would desync it from the map it falls back from. |
| `.planning/phases/104-cost-intelligence/104-VALIDATION.md` | 230-236 | Closing prose still says "Both are the same theme... Phase 104 stays OPEN," contradicting its own `status: approved` / `nyquist_compliant: true` frontmatter now that CR-01 and this gap are both closed | ℹ️ Info | Confirmed stale — re-read live, frontmatter (lines 4-5) says `approved`/`true` but the trailing paragraph (line 235) still says `nyquist_compliant` stays false. Per CLAUDE.md's "Stale Docs" rule: trust the code/commit history (both items independently confirmed closed above) over this stale sentence. Flagged for correction, not a code defect. |

No blocker-severity anti-patterns found in this pass.

### Human Verification Required

None. All items that previously needed human/live verification were executed in plan 104-11's
live-validation pass. The gap closed in this pass was a static code-reading fix (swap one Convex
query reference for another), independently re-verified via source reading + an independently
re-run test suite + typechecks, not requiring live infrastructure.

### Gaps Summary

The one gap from the initial pass — a third (then a fourth, self-caught by the executor's own
sweep) live surface on the Analytics page rendering a dollar figure from the legacy
`metric_type: "cost"` aggregate / raw `llmMetrics.cost`, in violation of the locked D-01 decision
— is closed. Independently re-read both fixed files line-by-line (not trusted from the SUMMARY),
independently re-ran the full test suite (3158/0, matches the claim exactly) and both
typechecks (clean), and independently re-swept the codebase for the same class of defect beyond
the specific symbols the hand-off named. That wider sweep surfaced three more raw-`.cost`
displays (`Analytics.tsx`'s per-row Recent Calls column, `TraceWaterfall.tsx`, `VitalsRail.tsx`)
but all three predate Phase 104, are debug/trace-level per-call readouts rather than the
aggregate spend-legibility surfaces COST-01/02/03 target, and are not part of this phase's
artifact list — judged out of scope rather than silently dropped.

Phase 104 achieves its stated goal: spend is legible per model and per provider over time (with
no remaining surface disagreeing with the derived truth), budget thresholds are configurable and
persisted, and alerts fire through the existing alert-routing layer. 12/12 must-haves verified.

---

_Verified: 2026-08-03_
_Verifier: Claude (gsd-verifier)_
