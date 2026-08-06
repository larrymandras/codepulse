---
phase: 104-cost-intelligence
reviewed: 2026-07-31T00:00:00Z
depth: standard
files_reviewed: 42
files_reviewed_list:
  - convex/aggregates.ts
  - convex/aggregates.test.ts
  - convex/costBudgetEval.ts
  - convex/costBudgetEval.test.ts
  - convex/costBudgets.ts
  - convex/costBudgets.test.ts
  - convex/costDerived.ts
  - convex/costDerived.test.ts
  - convex/forecasts.ts
  - convex/forecasts.test.ts
  - convex/gatewayQuota.ts
  - convex/gatewayQuota.test.ts
  - convex/modelPricing.ts
  - convex/modelPricing.test.ts
  - convex/runtimeIngest.ts
  - convex/runtimeIngest.test.ts
  - convex/schema.ts
  - convex/seedGateway.ts
  - src/components/CostBreakdown.tsx
  - src/components/CostBreakdown.test.tsx
  - src/components/CostBreakdownTable.tsx
  - src/components/CostBreakdownTable.test.tsx
  - src/components/CostBudgetsAdmin.tsx
  - src/components/CostBudgetsAdmin.test.tsx
  - src/components/CostForecastPanel.tsx
  - src/components/CostForecastPanel.test.tsx
  - src/components/CostTrendChart.tsx
  - src/components/CostTrendChart.test.tsx
  - src/components/ModelPricingAdmin.tsx
  - src/components/ModelPricingAdmin.test.tsx
  - src/components/SDKSpendCapGauge.tsx
  - src/components/SDKSpendCapGauge.test.tsx
  - src/components/SDKSpendGuard.tsx
  - src/components/SDKSpendGuard.test.tsx
  - src/components/UnpricedModelsNudge.tsx
  - src/components/UnpricedModelsNudge.test.tsx
  - src/hooks/useCostBudgets.ts
  - src/hooks/useCostByGoal.ts
  - src/hooks/useCostByGoal.test.ts
  - src/hooks/useCostDerived.ts
  - src/hooks/useModelPricing.ts
  - src/lib/modelPricing.ts
  - src/pages/Analytics.tsx
  - src/pages/Settings.tsx
findings:
  critical: 2
  warning: 2
  info: 1
  total: 5
status: issues_found
---

# Phase 104: Code Review Report

**Reviewed:** 2026-07-31
**Depth:** standard
**Files Reviewed:** 42
**Status:** issues_found

## Summary

Reviewed phase 104's cost-recomputation pipeline (`modelPricing`, `costBudgets`, `costDerived`,
`costBudgetEval`), the widened `aggregates.ts` rollups, the gateway ingest/quota wiring, and the
seven new/rewired UI surfaces. The core derivation layer (`convex/costDerived.ts`) is careful and
well-tested: D-03's unpriced-never-$0 rule and D-05's billed/covered separation are enforced in
one place and every consumer I traced routes through it correctly, and `convex/costBudgetEval.ts`'s
dedup/D-14 tail-append discipline holds up under direct reading.

The most significant problem is that **two of the four cost-cluster panels on the same Analytics
page were not actually migrated onto that derivation layer** — `SDKSpendGuard` (the SDK Daily Cap
gauge) and `CostForecastPanel` still compute their headline dollar figures from the pre-104
ingested-`cost` aggregate, while `CostTrendChart`/`CostBreakdownTable`/`CostBreakdown` on the same
page (and the backend alert evaluator) now compute from `tokens × modelPricing rate`. This
reproduces, for the underlying spend figure itself, exactly the "two sources of truth disagree"
failure the phase's own D-01/D-12/D-19 decisions exist to eliminate. A second, unrelated honesty
bug was found in `ModelPricingAdmin`'s delete-confirmation copy, which asserts something the
architecture (D-04, dollars derived at read time) directly contradicts.

## Critical Issues

### CR-01: SDKSpendGuard and CostForecastPanel still price from the pre-104 ingested-cost aggregate, not the D-01 tokens×rate derivation

**File:** `src/components/SDKSpendGuard.tsx:47-51`, `src/components/CostForecastPanel.tsx:7`,
`convex/forecasts.ts:59-105`, `convex/aggregates.ts:449-488`, `convex/aggregates.ts:101-143`

**Issue:** D-01 states: "CodePulse recomputes cost from tokens × rate. The displayed dollar figure
is derived by CodePulse, not taken from the ingest payload... it is no longer the truth the UI
renders." `convex/costDerived.ts`'s own header comment lists every surface this phase routes
through `deriveBucketDollars`: "the Analytics over-time chart, the breakdown table, the
unpriced-models nudge, the goal-scoped HivePage breakdown... and the budget evaluator." Verified by
reading each file: `CostTrendChart.tsx:15` (`api.costDerived.costOverTime`), `CostBreakdownTable.tsx:33`
(`useCostBreakdown` → `api.costDerived.costBreakdown`), `CostBreakdown.tsx:33`/`aggregates.ts:528-587`
(`costByGoalPeriod`, rewired to `deriveBucketDollars` in Plan 05), and `costBudgetEval.ts:253-260`
(`computePeriodSpend`) all correctly use the new pipeline.

`SDKSpendGuard.tsx` and `CostForecastPanel.tsx` do not:

```tsx
// src/components/SDKSpendGuard.tsx:47-51
const rawBuckets = useQuery(api.aggregates.costByPeriodByProvider, {
  period: "hourly",
  lookbackHours: 24,
  billingType: "api",
});
```

`costByPeriodByProvider` (`convex/aggregates.ts:449-488`) reads `aggregates` rows with
`metric_type: "cost"`. Those rows are written by `computeHourly`'s **unchanged** legacy block
(`convex/aggregates.ts:101-143`):

```ts
costByDim[key] = (costByDim[key] ?? 0) + (r.cost ?? 0);
```

— i.e. the raw ingested `llmMetrics.cost` field D-01 explicitly says is "no longer the truth the
UI renders" ("the field is optional — an un-costed call silently contributes $0 today"). This
`"cost"` metric-type block was not touched by phase 104; only the new `tokens_prompt`/
`tokens_completion` buckets (D-04) were added alongside it.

`CostForecastPanel.tsx:7` reads `api.forecasts.costForecast`, whose handler
(`convex/forecasts.ts:67-72`) reads the same legacy `metric_type: "cost"` aggregate for its
Projected Daily/Weekly/Monthly figures and its "Current Month Spend" bar. Plan 104-08 (confirmed
in `104-08-SUMMARY.md`) only migrated the **budget cap** source (`agentConfigs` →
`costBudgets`, D-19) — the spend figure itself was left on the pre-104 path.

Net effect: on the exact same Analytics page, `SDKSpendGuard` (top row, right) and
`CostForecastPanel` (top row, left — "the most prominent panel on the page" per D-19's own text)
can show a **different total** for identical underlying LLM calls than `CostTrendChart` /
`CostBreakdownTable` below them, and than whatever `costBudgetEval.ts`'s backend evaluator used to
decide whether to fire a breach alert. This is the precise scenario D-02's own rationale was
written against (`claude-opus-5`/`claude-sonnet-5`/`claude-fable-5` previously mispriced ~5× under
the code-table default) — for these two panels specifically, a rate correction in the new
`modelPricing` admin surface has **no effect** on what the operator sees, because neither panel
ever reads a rate.

**Fix:** Rewire `SDKSpendGuard.tsx` onto `api.costDerived.costOverTime` (or an equivalent
`api` bounded on `billingType: "api"`) instead of `api.aggregates.costByPeriodByProvider`, and
rewire `convex/forecasts.ts`'s `costForecast` to derive its daily-bucketed spend from the
`tokens_prompt`/`tokens_completion` aggregates via `deriveBucketDollars` (matching
`costDerived.computePeriodSpend`'s bounded-read shape) instead of the legacy `metric_type: "cost"`
aggregate.

**Confidence:** High — directly traced through the aggregate write path, the query definitions,
and both component's `useQuery` call sites; `costDerived.ts`'s own doc comment independently
confirms which surfaces were intended to be migrated and does not list these two.

---

### CR-02: ModelPricingAdmin's delete-confirmation copy asserts the opposite of what the architecture does

**File:** `src/components/ModelPricingAdmin.tsx:468-471`

**Issue:**

```tsx
<p className="text-base text-muted-foreground">
  Past cost figures using this rate stay as last computed. New calls for this model
  become Unpriced until a new rate is entered.
</p>
```

This is false under this phase's own architecture. D-04 is explicit: "Rollups store
tokens-by-model; dollars are derived at read time... an unpriced bucket must heal the moment its
rate is entered." `convex/costDerived.ts`'s `loadRateIndex` (`:152-155`) re-reads the entire
`modelPricing` table on every query call, and `deriveBucketDollars`/`resolveRate` compute dollars
fresh against whatever rate index is current — there is no snapshot, cache, or stored historical
dollar value anywhere in the pipeline. `convex/modelPricing.ts`'s `remove` mutation
(`:199-210`) is a bare `ctx.db.delete(args.id)` with no compensating write.

Consequently, deleting a rate does **not** leave "past cost figures... as last computed" — it
makes `resolveRate` return `null` for that model on the very next read, which per
`deriveBucketDollars` (`:92-97`) turns **every historical bucket for that model, back to the start
of retention**, into an Unpriced row on `CostTrendChart`, `CostBreakdownTable`, and
`CostBreakdown` alike. An operator who deletes a rate believing (per this exact copy) that history
is preserved will retroactively blank out cost visibility for that model across the whole
retention window — the opposite of the stated behavior, and exactly the "surface that quietly
asserts more than it knows" failure mode this phase's own `<specifics>` section names as the
project's recurring bug class.

**Fix:** Either (a) correct the copy to state the true, D-04-consistent behavior — "Deleting this
rate makes every chart re-render this model's spend, past and present, as Unpriced until a new
rate is entered" — or (b) if "stay as last computed" is the actually-desired product behavior,
change `remove` to snapshot/soft-delete instead of hard-deleting the row so historical reads keep
resolving. Given D-04's explicit re-pricing-of-history design intent, (a) is the smaller, correct
fix.

**Confidence:** High — read `remove`'s implementation, `loadRateIndex`'s per-call re-fetch, and
`deriveBucketDollars`'s unconditional `resolveRate` call; there is no code path that would make the
dialog's claim true.

## Warnings

### WR-01: D-20 turns a previously-dead 5-minute poller into a permanently unbounded write against a table with no retention policy

**File:** `convex/gatewayQuota.ts:47-116`, `convex/schema.ts:1540-1551`, `convex/retention.ts:23-45`,
`convex/crons.ts:97-102`

**Issue:** `crons.interval("poll-gateway-quota", { minutes: 5 }, internal.gatewayQuota.pollAndStore)`
has existed since Phase 68, but per D-20's own commit note it has been silently dead: it targeted
`ASTRIDR_API_URL`, which has no `/quota` route, so every invocation warned-and-returned without
writing. D-20 repoints it at the new `CLI_GATEWAY_URL` (verified live 2026-07-30 that the old
target returned nothing) — meaning that, once `CLI_GATEWAY_URL` is configured in production, this
cron transitions from writing zero rows to writing one `gatewayQuotaSnapshots` row per gateway
provider every 5 minutes, forever. `gatewayQuotaSnapshots` (`schema.ts:1540-1551`) has no
`updatedAt`-style upsert — `pollAndStore` always `ctx.db.insert`s a fresh row
(`insertSnapshot`, `:121-135`) — and the table is **absent** from `retention.ts`'s
`RETENTION_DAYS`/`PRUNED_TABLES` (`:23-45`), so nothing ever prunes it.

This is precisely the pattern `104-CONTEXT.md`'s own `<specifics>` section calls out as "the
specific way this instance dies" and CLAUDE.md's Self-Hosted Convex rules exist to guard against
— an always-on write with no retention story on a single-node SQLite instance that has already
gone down twice from unbounded growth. The per-poll payload is small (a handful of float fields ×
~4 providers ≈ <1KB every 5 minutes, ~100MB/year), so this is not an immediate crash risk the way
a bulk `import --replace-all` or an unbounded `.collect()` read would be, but it is new,
previously-inert unbounded growth that D-20 knowingly activates without adding a retention entry.

**Fix:** Add `gatewayQuotaSnapshots` to `retention.ts`'s `RETENTION_DAYS` map (a short window is
sufficient — `latestByProvider` only ever reads the most recent row per provider via
`.take(100)`), or have `pollAndStore`/`insertSnapshot` upsert-by-provider instead of always
inserting a new row, before (or immediately after) `CLI_GATEWAY_URL` is configured live per plan
104-11.

**Confidence:** High — confirmed the table is absent from `PRUNED_TABLES`, the poller always
inserts (never patches), and the cron fires every 5 minutes; the growth-rate estimate is my own
back-of-envelope math, included for context rather than as a load-bearing claim.

---

### WR-02: Specific ConvexError messages from costBudgets/modelPricing writes are discarded behind a generic toast

**File:** `src/components/ModelPricingAdmin.tsx:183-184`, `:198-199`,
`src/components/CostBudgetsAdmin.tsx:209-210`, `:224-225`

**Issue:** `convex/modelPricing.ts` and `convex/costBudgets.ts` throw specific, operator-actionable
`ConvexError` messages — e.g. `"A pricing rate already exists for this model"`,
`"Rates are per token (e.g. 0.000005 for $5/Mtok). Value must be greater than 0 and less than 1."`,
`"A ${args.period} budget already exists for scope "${args.scope}" / key "${scopeKey}""`. None of
these messages are client-side pre-validated (e.g. the duplicate-model/duplicate-scope checks are
server-only), so a real operator action can trigger them. But every save/delete handler in both new
admin components discards the caught error entirely:

```tsx
} catch {
  toast.error("Rate could not be saved. Check the values and try again.");
}
```

An operator who tries to add a rate for a model that already has one gets the same generic message
as any other failure, never the actual reason. Per CLAUDE.md's own documented lesson ("Convex
REDACTS plain-`Error` messages to 'Server Error' client-side... `throw new ConvexError(...)`
because its `.data` survives redaction... read `err.data` before `err.message`"), these mutations
were written specifically so the client *could* surface the real reason — the UI just doesn't read
it.

**Fix:** In each `catch` block, read `err instanceof ConvexError ? err.data : undefined` (or
`err.message` after Convex's client-side unwrapping) and pass it to `toast.error`, falling back to
the current generic string only when the error isn't a `ConvexError`.

**Confidence:** High — read every mutation's throw sites and every corresponding catch block in
both files; none of the four catch blocks in scope bind or inspect the caught value.

## Info

### IN-01: The D-06 shadow-fallback resolution path is effectively unreachable for the only live producer of subscription rows

**File:** `convex/modelPricing.ts:82-97` (`resolveRate`), `:320-342` (`SEED_SHADOW_ROWS`),
`convex/runtimeIngest.ts:51-65` (`resolveGatewayTaskCompleted`)

**Issue:** `resolveRate`'s documented resolution order is (1) exact model match, then (2) for
subscription turns only, a `shadowForProvider` fallback match — intended, per D-06, for turns
reporting an "opaque id" that isn't a real model id. In practice, `resolveGatewayTaskCompleted`
sets `model: provider` (`runtimeIngest.ts:56`, e.g. `model: "codex"`), and every
`SEED_SHADOW_ROWS` entry also sets `model` to that same opaque provider id (e.g.
`{ model: "codex", shadowForProvider: "codex", ... }`, `modelPricing.ts:328-334`). Because
`resolveRate` checks the exact-model index (`byModel`) *before* the shadow index, every gateway
subscription turn resolves via step 1 (exact match on its own opaque id) rather than ever reaching
step 2 (the shadow-provider fallback) — the two branches happen to point at the identical row, so
`billedUsd`/`coveredUsd` come out numerically correct either way, but `pricedVia` always reports
`"model"`, never `"shadow"`, for this data. `pricedVia` isn't currently rendered anywhere in the
UI, so this has no observed user-facing effect today.

**Fix:** No urgent action — flagging because it means the `byShadowProvider` index/branch is
currently dead code for the only live producer of subscription data, and any future UI that
branches on `pricedVia === "shadow"` to visually distinguish "priced via its own rate" from
"priced via the fallback mapping" will silently never show that state for gateway turns.

**Confidence:** Medium — confirmed by direct reading of both files' id conventions; not covered by
a passing/failing test either way (the existing `costDerived.test.ts` shadow-path test deliberately
uses a `dims.model` that does NOT match the shadow row's own `model`, which is not representative
of the real `resolveGatewayTaskCompleted` output).

---

## What I dropped and why

- **A `bucketDollars`/`FlexBarChart` stacked-total check** — `FlexBarChart.tsx` sums all segment
  values (billed + covered, when toggled) to compute bar *height*, which looked at first glance
  like a D-05 merge. Traced through: the sum is only used for visual scaling and per-segment
  hover-tooltip lines (each segment labelled individually, no combined total line) — never
  displayed as a number. Dropped.
- **`convex/seedGateway.ts`'s public `runSeed` mutation having no auth gate** — real, but
  pre-existing (only a constant rename this phase, per `104-08-SUMMARY.md`'s own accounting) and
  outside the `modelPricing`/`costBudgets` write-auth surface this review was scoped to. Dropped
  per the review's explicit scope note.
- **`convex/aggregates.ts`'s `costByGoalPeriod`/`llmByGoal` reading `llmMetrics` directly by
  `by_goal` with no time bound** — pre-existing (Phase 149) read pattern, only the dollar
  derivation inside it changed this phase; not a new unbounded-read introduced by 104. Dropped.
  
  Confidence on all four kept findings is High except IN-01 (Medium, no observed impact).

---

_Reviewed: 2026-07-31_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
