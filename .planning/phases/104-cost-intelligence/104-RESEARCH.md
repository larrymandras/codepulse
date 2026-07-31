# Phase 104: Cost Intelligence - Research

**Researched:** 2026-07-30
**Domain:** Convex rollup/aggregation architecture, cross-repo telemetry ingest (Ástríðr → CodePulse), alert-routing reuse, self-hosted Convex performance constraints
**Confidence:** HIGH for code-path claims (all verified against live source + live self-hosted Convex data on 2026-07-30); MEDIUM/LOW flagged inline where noted

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** **CodePulse recomputes cost from tokens × rate.** The displayed dollar figure is derived
  by CodePulse, not taken from the ingest payload. `convex/runtimeIngest.ts:68`
  (`cost: d.cost ?? d.costUsd ?? d.cost_usd`) currently accepts whatever Ástríðr posts, and the
  field is **optional** — an un-costed call silently contributes $0 today. Keep persisting the
  reported value (it is useful evidence), but it is no longer the truth the UI renders.
  Rationale: one place to fix a mispriced model, and history can be re-priced (D-04).

- **D-02:** **Rates live in a Convex `modelPricing` table with an admin surface**, seeded from the
  current `src/lib/modelPricing.ts` values. Pricing a newly-swapped-to engine must not require a
  code change plus a Convex deploy — Phase 103 shipped a live catalogue of ~331 engines an
  operator can switch to at will.
  **Verified gap this closes:** `src/lib/modelPricing.ts` has NO entry for `claude-sonnet-5`,
  `claude-opus-5`, or `claude-fable-5` — the exact models REQUIREMENTS.md COST-01 names. They all
  fall through to `PRICING["default"]` at $3/$15 per Mtok, which under-prices an Opus-class call
  by roughly 5×. That file is also imported by only three HR surfaces
  (`src/pages/hr/AgentAnalytics.tsx`, `src/components/hr/detail/MetricsDashboard.tsx`,
  `TokenUsageChart.tsx`) — it is **not** on the main cost path at all today.

- **D-03:** **An unpriced model is never silently valued.** A call whose model has no pricing row is
  excluded from the dollar total and shown as its own "Unpriced" row carrying its real token
  counts, plus a persistent "N models need rates" affordance into the pricing admin. Do **not**
  fall back to the `default` rate and do **not** render it as $0 inside the total.
  Rationale: this project's recurring failure mode is a surface that quietly asserts more than it
  knows. A total that absorbs a guess is that failure, in the one number an operator will trust most.

- **D-04:** **Rollups store tokens-by-model; dollars are derived at read time.** Correcting or adding
  a rate must retroactively fix every chart back to the start of retention, and an unpriced
  bucket must heal the moment its rate is entered. This constrains the rollup schema —
  `convex/aggregates.ts` `computeHourly`/`rollupDaily` currently pre-aggregate dollars; the
  planner must widen the bucket shape to carry per-model token counts.
  ⚠ Planner note: this is the one decision with a real cost — bucket rows get wider (one key
  per model seen in the hour) and the read path does the multiply. Bound the per-bucket model
  cardinality deliberately; do not `.collect()` unbounded.

- **D-05:** **Billed stays $0; a separate "covered by subscription" shadow figure is shown
  alongside it.** Subscription/CLI turns genuinely cost nothing per call (`billingType:
  "subscription"` → `estimateCost` returns 0, the existing D-12 rule). But Phase 103 makes a swap
  to Claude Code / Codex / Antigravity a one-click operator action, so spend can now collapse for
  a reason that has nothing to do with usage. The shadow figure prices the same tokens against
  the engine's API rate so the drop explains itself. The two numbers are **never** merged into
  one headline — the billed total must always mean money actually owed.

- **D-06:** **The shadow rate comes from the turn's own reported model when that id is priceable**
  (e.g. a Claude Code turn reporting `claude-opus-5` is priced at the `claude-opus-5` API rate,
  with only `billingType` marking it subscription). An explicit per-engine `shadowModel` mapping
  row in the pricing table is the fallback for opaque ids (`claude-cli`, `codex`, …).
  ⚠ Researcher must confirm: what `provider`/`model` Ástríðr actually reports for
  CLI-gateway turns. This is genuinely unknown right now and determines whether the common path
  or the fallback path is the real one. **[See "⚠ Decision at risk: D-06" in this document —
  researched and answered: the fallback path is the only viable one; the "common path" does not
  exist in the current code for CLI-gateway turns.]**

- **D-07:** **Dollar budgets guard billed money only; subscription traffic gets its own threshold on
  quota burn.** A dollar budget can never trip while a subscription brain is in force, so
  `gatewayQuotaSnapshots` (`convex/schema.ts:1540` — `usedToday`, `dailyLimit`, `spendUsd`,
  `remainingPct`) carries a threshold of its own, firing through the same alert routing. Each
  axis is guarded in the unit that actually constrains it. No fictional dollars enter a budget.

- **D-08:** **One over-time chart with a `Billed` / `Billed + covered` toggle**, billed as the
  default view; the covered portion renders as a visually distinct segment. Reuses the existing
  `FlexBarChart` + `costByPeriodByProvider` shape rather than adding a second chart. The default
  view never displays imputed money.

- **D-09:** **One generic `costBudgets` Convex table with a `scope` discriminator** —
  `"global" | "model" | "provider"` plus a key. Per-profile and per-goal are deliberately NOT in
  this phase but must be reachable as a new scope value rather than a new subsystem.
  (Per-profile was considered and dropped: `llmMetrics` carries `agentId` and `goalId` but **no**
  `profileId` (`convex/schema.ts:306-330`), so attributing spend to a profile needs a join that
  may not exist.)

- **D-10:** **Period is per-row: `daily | weekly | monthly`.** A $5/day guardrail and a $100/month
  ceiling are different questions and both are wanted. The daily/hourly rollups that answer them
  already exist in `convex/aggregates.ts`. Planner must pick and state a timezone for period
  boundaries (UTC vs local) — the existing crons are UTC-anchored (`crons.daily … hourUTC`).
  **[See Q6 finding in this document: SDKSpendGuard's own day-boundary math is also UTC-anchored
  — recommend UTC for consistency.]**

- **D-11:** **Each budget row carries a limit plus a warn fraction (default `0.8`)**, generalizing
  today's `ALERT_THRESHOLD`. Warn fires at `warnFraction × limit` as severity `warning`; breach
  fires at the limit as severity `error` — both already in the `alerts.severity` vocabulary
  (`convex/schema.ts:112`). Not a free-form levels list; two firing points, no more.

- **D-12:** **`SDKSpendGuard` is rewired onto the global-daily budget row, not left alongside it.**
  `src/components/SDKSpendGuard.tsx:8-9` hardcodes `DAILY_CAP = 5.00` / `ALERT_THRESHOLD = 0.8`;
  those constants survive only as the **seed values** for the first `costBudgets` row. Its
  burn-rate projection ("at current rate, you'll hit $5 by ~3:40pm") is preserved and becomes
  D-13's mechanism. Do NOT ship a second spend gauge on Analytics beside it — two caps that can
  disagree is the stale-second-source pattern Phase 103's D-03 exists to prevent.
  **[See "⚠ Gap in CONTEXT.md coverage" in this document: a THIRD independent cap
  (`CostForecastPanel`/`agentConfigs["intelligence.budget_cap"]`) also exists and was not
  named here.]**

- **D-13:** **"Spike" is defined as rate-projection-to-period-end.** Extrapolate the current burn
  rate to the budget's period boundary and fire when the projection breaches the limit. This is
  the algorithm `SDKSpendGuard` already implements and the operator already reads; every alert
  can therefore name a concrete number and time. A rolling-baseline / z-score anomaly detector
  was considered and **not** chosen for this phase (note `convex/anomalyDetection.ts` already
  implements a z-score evaluator for other metrics; do not duplicate it, and do not silently
  re-purpose it either).

- **D-14:** **The evaluator runs at the tail of the existing `internal.aggregates.computeHourly`
  cron.** No new scheduled function.
  🛑 This is a hard constraint, not a preference. `convex/crons.ts:42-47` shows
  `internal.alerts.evaluateInternal` — the Phase 6 alert-rule evaluation cron — **disabled since
  2026-07-14**: it hit the 15s syscall cap on self-hosted Convex and "a failing cron execution
  retries on its own backoff regardless of schedule, so throttling does not help — the retry
  storms starved ingest mutations." `computeHourly` already runs hourly and has already read
  exactly the data a budget needs, so evaluating there adds no new scan and no new retry surface.
  Accepted cost: alert latency up to one hour. Ingest-time evaluation was explicitly rejected —
  it adds work to the hottest path, and a failure there rolls back the ingest transaction.

- **D-15:** **Fire once per budget, per level, per period; re-arm at the period reset.** Dedup keyed
  on `(budgetId, level, periodStart)` stored in the alert's `details`, mirroring
  `convex/evalScores.ts` `detectRegressionsForPersona`, which dedups on `details.changeDate`
  against prior alerts in any status (active, acknowledged, or resolved). Escalation
  warn → breach still gets through. No re-firing every cycle — 16 identical alerts a day get
  buried by the auto-acknowledge-stale cron, which is worse than not firing.

- **D-16:** **Alert-only. No enforcement, no dispatch.** A tripped budget does not swap the brain,
  throttle, or mutate Ástríðr in any way — even though Phase 103 made that mechanically
  possible. An autonomous runtime mutation driven by an up-to-an-hour-stale rollup is its own
  phase with its own confirm ritual and its own live verification.

- **D-17:** **Alerts must be inserted via the delivering path, not `alerts.create`.**
  `convex/evalScores.ts:1225-1249` documents this explicitly: the fire path inserts with
  `webhookStatus: "pending"` and schedules `internal.webhookDelivery.sendAlertWebhook` — "this
  insert call does not use the shared createIfNew helper, and never calls the public
  `alerts.create`," because the public mutation does not deliver. Copy that shape.

### Claude's Discretion

- **Surface placement.** Default: extend the existing Analytics cost cluster
  (`src/pages/Analytics.tsx` already hosts `CostForecastPanel` :88, `SDKSpendGuard` :96,
  `CostTrendChart` :288) rather than minting a new `/costs` route. Where the pricing admin and
  the budget config form live is likewise the planner's call — Settings and Analytics are both
  defensible; pick one and keep both configs together.
- Naming of the Convex tables/fields (`modelPricing`, `costBudgets`, `shadowModel`, …) and of
  the chart toggle's two labels.
- Component decomposition of the breakdown table, the unpriced-models nudge, and the budget
  progress display; visual treatment of the "covered by subscription" segment.
- Whether the per-model token map in a rollup bucket is a record or an array of rows.
  **[See Q2/D-04 finding: recommend one row per (provider,model,billingType,goalId) per hour,
  matching the existing `aggregates` design — not a nested map.]**
- Whether the quota threshold (D-07) shares the `costBudgets` table with a fourth scope value or
  gets its own small table — both satisfy the decision.

### Deferred Ideas (OUT OF SCOPE)

- **Per-profile and per-goal budget scopes** — D-09 keeps the `scope` discriminator open for
  them, but `llmMetrics` has no `profileId`, so per-profile attribution needs an upstream join
  (or an Ástríðr-side ingest change) that does not exist today. `profileConfigs.budget`
  (`schema.ts:511`) stays an empty slot this phase.
- **Rolling-baseline / z-score spend anomaly detection** — D-13 chose rate-projection instead.
  `convex/anomalyDetection.ts` already implements z-score detection for other metrics and is the
  natural home if this is ever wanted for spend.
- **Auto-downgrade on budget breach** (dispatching a Phase 103 brain swap to a cheaper engine
  when a budget trips) — explicitly rejected by D-16. An autonomous runtime mutation driven by an
  hour-stale rollup needs its own phase, confirm ritual, and live verification.
- **A one-click "swap to a cheaper brain" action embedded in the budget alert** — considered
  under D-16 and not taken; it couples this phase to Phase 103's dispatch surface.
- **Re-enabling `internal.alerts.evaluateInternal`** — the Phase 6 alert cron disabled
  2026-07-14. This phase deliberately routes around it rather than fixing it. Consequence worth
  naming: the 40+ static rules in `convex/alertRules.ts` still only fire while an operator has
  the Alerts page open (`AlertRulesEngine.tsx:274`). Bounding and re-enabling that cron is real,
  known work that belongs with the Phase 106 hardening pass or its own phase.
- **Cache-token pricing** — `llmMetrics` already carries `cacheReadInputTokens` and
  `cacheCreationInputTokens` (`schema.ts:322-323`), which bill at rates distinct from input and
  output. Not discussed; the `modelPricing` row shape should leave room for them even if this
  phase prices only input/output.
- **Brain-swap event annotations on the cost timeline** (marking *when* the engine changed so a
  spend cliff is self-explaining) — raised while discussing D-05 and not taken.
- **Retiring / rewiring the three HR surfaces still importing `src/lib/modelPricing.ts`** — once
  D-02 moves rates into Convex, `AgentAnalytics.tsx`, `MetricsDashboard.tsx`, and
  `TokenUsageChart.tsx` become the last consumers of the code table and will drift. Planner's
  call whether to migrate them in this phase or leave a documented follow-up; the phase boundary
  does not require it.
- **Enforcement of any kind** — spend caps that actually stop work. Out of scope by D-16.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COST-01 | Per-model / per-provider cost breakdown over time (chart + table), correctly attributing the current model mix (sonnet-5 / opus-4.8 / fable-5 etc.) | D-01/D-02/D-03/D-04/D-05/D-06/D-08 findings above; live `modelPricing.ts` gap confirmed (Q5); live `llmMetrics` model/provider cardinality queried (Q1/Q5); CLI-gateway "common path" falsified with code + live evidence (D-06 risk section); existing `CostTrendChart`/`CostBreakdown`/`FlexBarChart` reuse mapped (Q8) |
| COST-02 | Budget thresholds, configurable per-model and/or global (and per-goal where the data supports it), persisted in Convex | D-09/D-10/D-11/D-12 findings; `alertRuleCustom.ts` CRUD pattern to mirror (Pattern 3); UTC period-boundary evidence (Q6); third pre-existing budget-cap surface flagged (`CostForecastPanel`/`forecasts.ts`) |
| COST-03 | Anomaly / budget alerts when spend spikes or crosses a threshold, delivered through the existing alert-routing layer (no new channel plumbing) | D-13/D-14/D-15/D-17 findings; exact fire-and-deliver + dedup pattern extracted verbatim from `evalScores.ts` (Pattern 2); `computeHourly` tail-append safety quantified against the disabled `evaluateInternal` cron's actual failure mode (Pitfall 5); D-07 quota-source dead-end identified (Pitfall 2) |
</phase_requirements>

## Summary

This phase is 90% "wire existing plumbing together correctly" and 10% "new schema." The
rollup spine (`convex/aggregates.ts`), the alert-delivery spine (`convex/webhookDelivery.ts` +
`evalScores.ts`'s fire-and-deliver pattern), the budget-cap UI pattern (`SDKSpendGuard.tsx`'s
projection math), and the CRUD pattern (`alertRuleCustom.ts`) all already exist and are directly
reusable. The two genuinely new pieces of engineering are (1) a `modelPricing` Convex table +
admin surface, and (2) a `costBudgets` table + an evaluation step appended to `computeHourly`.

**The single most important finding is on D-06 (COST-01 subscription path):** the CLI-gateway
route (Claude Code / Codex / Antigravity / Claude Agent SDK) **never reports a `model` id to
CodePulse at all, and currently writes zero rows to `llmMetrics`.** This was verified two ways —
by tracing the emit code in astridr-repo's `gateway/` sidecar and by querying the live
self-hosted Convex instance's `llmMetrics` table, which shows **zero** rows from any of the four
gateway provider ids in the last 30 days. D-06's "common path" (turn's own reported model, when
priceable) is not just currently-inactive, it is **structurally impossible** for gateway-routed
turns as the code is written today — there is no model field anywhere in that pipe. D-06's
fallback (`shadowModel` mapping keyed on the opaque provider id) is the *only* viable mechanism,
and it requires new ingest wiring (today's gateway completion events route to `toolExecutions`,
not `llmMetrics`, and drop `cost_usd` on the floor entirely). See "⚠ Decision at risk: D-06" below.

**Second major finding, on D-04 (rollup widening):** the "widen the bucket shape" framing in
CONTEXT.md is slightly mis-modeled. `computeHourly` already writes **one `aggregates` row per
`(provider, model, billingType, goalId)` combination per hour** (not a nested per-model map in
one wide document) — this is a good design and does not need re-architecting. It also **already
has a parallel `"tokens"` metric_type** alongside `"cost"`, added as a Phase-88 follow-up,
keyed on the identical 4-segment dimension. The real gap is narrower: `tokensByDim` currently
sums only `totalTokens` (input+output collapsed into one number), which is insufficient to
re-derive dollars at read time once distinct input/output/cache rates matter. The actual widening
needed is splitting the tokens bucket into `promptTokens` / `completionTokens` (and ideally the
two cache-token fields) summed per the same dimension key — not adding a nested map.

**Third finding, not named anywhere in CONTEXT.md:** there is a **third pre-existing budget-cap
surface** — `convex/forecasts.ts`'s `costForecast` query reads a monthly cap from
`agentConfigs["intelligence.budget_cap"]` (its own `setBudgetCap` mutation, its own 80%/100%
warn/exceeded classifier) and renders it in `CostForecastPanel`, the *first* panel on the
Analytics cost cluster (`Analytics.tsx:88`, above `SDKSpendGuard` at `:96`). D-12's "do not ship
a second spend gauge... two caps that can disagree" instruction was written against
`SDKSpendGuard` only; `CostForecastPanel`'s independent monthly cap is exactly the same failure
mode and needs the same resolution (fold into `costBudgets` or explicitly document the ongoing
gap) — see "⚠ Gap in CONTEXT.md coverage" below.

**Primary recommendation:** build `modelPricing` + `costBudgets` as new Convex tables mirroring
`alertRuleCustom.ts`'s CRUD shape; widen `computeHourly`'s existing per-dimension-row token
bucket to carry `promptTokens`/`completionTokens` (not a nested map); append budget evaluation to
`computeHourly`'s tail using data already in memory from that same run; copy
`evalScores.ts:1235-1249`'s insert-then-schedule pattern verbatim for alert firing; and treat
D-06's CLI-gateway "common path" as dead code today — plan directly for the `shadowModel`
fallback plus the missing gateway→llmMetrics ingest wiring it depends on.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Token→dollar pricing (modelPricing) | Convex (API/Backend) | — | Rate table must be admin-editable without a code deploy (D-02); Convex is the only persistence layer here |
| Cost rollup (tokens-by-model, hourly/daily) | Convex (API/Backend) | — | Already lives in `aggregates.ts`; existing cron-driven mutation, no browser role |
| Dollar derivation at read time | Convex (API/Backend) | Browser (display formatting only) | D-04 requires re-pricing to happen server-side so every consumer (chart, table, budget evaluator) sees one consistent number; browser only formats |
| Budget threshold config (costBudgets) | Convex (API/Backend) | Browser (admin form) | Persisted config per D-09; CRUD mutations server-side, form is a thin client |
| Budget evaluation / spike detection | Convex (API/Backend, cron-tail) | — | D-14 pins this to the existing `computeHourly` internalMutation — no new scheduled function, no client role |
| Alert firing + delivery | Convex (API/Backend) | — | Rides `alerts` table + `webhookDelivery.ts` internalAction; already 100% backend, D-17 forbids any new client-invoked path |
| Cost breakdown chart/table (COST-01 UI) | Browser (React/Vite SPA) | Convex (reactive query) | `useQuery` + `FlexBarChart`/`Table`; standard CodePulse reactive-read pattern |
| Quota-burn threshold (D-07, gatewayQuotaSnapshots) | Convex (API/Backend) | — | Currently dead (see Q5/Q7 finding below) — polling target is misconfigured, not a browser concern |
| Subscription shadow-cost display (D-05) | Browser (React) | Convex (derivation) | Convex computes the shadow figure from tokens × shadow rate; browser renders it as a visually distinct, never-merged segment |

## Standard Stack

No new external packages are required for this phase. Every capability (rollup mutation, cron
scheduling, alert insert/deliver, admin CRUD, chart rendering) is implemented with the stack
already in the repo: Convex 1.42, React 19.2, TypeScript 6.0, existing `FlexBarChart`/shadcn
table primitives, existing `convex/webhookDelivery.ts`. `[VERIFIED: package.json]`

### Core (existing, reused — not newly installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| convex | ^1.42.0 | Reactive DB + cron + internalMutation/internalAction | Already the project's sole backend |
| react | ^19.2.7 | UI | Already the project's sole frontend framework |
| vitest | ^4.1.9 | Unit tests | Already the project's test runner |
| @playwright/test | ^1.61.1 | E2E tests | Already the project's E2E runner |

### Alternatives Considered
None — this phase is additive over an existing stack per CONTEXT.md's phase boundary. No
charting library, date library, or state-management library is needed; UTC epoch-second math
(already used throughout `aggregates.ts` and `SDKSpendGuard.tsx`) is sufficient for period
boundaries (see Q6 finding below).

## Package Legitimacy Audit

**No new external packages are introduced by this phase.** The Package Legitimacy Gate is
therefore not applicable — skip `slopcheck`/registry verification steps at plan time unless a
plan introduces a dependency not listed above (e.g., a color-token-resolution helper — check
first whether `getComputedStyle`/existing CSS-var utilities in `src/lib` already cover it).

## Architecture Patterns

### System Architecture Diagram — cost data flow (current + D-04 target)

```
KEYED API TURN                          CLI-GATEWAY TURN (subscription)
(anthropic_provider.py,                  (gateway/gateway/task_manager.py,
 router.py, etc.)                         claude_cli.py / codex_cli.py / ...)
   |                                          |
   | telemetry.send("llm_call",               | emit_task_completed() -> POST
   |   {provider, model, tokens, cost, ...})  |   ASTRIDR_TELEMETRY_WEBHOOK_URL
   |                                          |   (astridr web.py /internal/gateway/
   v                                          |    task_completed) -> telemetry.send(
POST /runtime-ingest (CodePulse)             |    "gateway_task_completed", {taskId,
   |                                          |     account, profile, priority, costUsd})
   | case "llm_call":                        |         |
   |   api.llm.recordCall -> llmMetrics       |         v  <-- NO CASE for "gateway_task_completed"
   |   (provider, model, tokens, cost,        |         in runtimeIngest.ts switch --
   |    billingType DERIVED server-side       |         falls through to generic
   |    via getBillingType(provider))         |         api.events.insertEvent (unindexed,
   |                                          |         cost/tokens/model NEVER queryable)
   |                                          |
   |                    ALSO (separate emitter): astridr/tools/cli_gateway.py
   |                    CLIGatewayTool._poll_until_complete() ->
   |                    telemetry.send("gateway.task_completed" [DOT, different
   |                    string], {provider, task_id, session_id, duration_ms})
   |                        |
   |                        v  <-- HAS a case (runtimeIngest.ts:965) but routes to
   |                        api.toolExecutions.insert (toolName: "gateway:<provider>")
   |                        + api.sessions.upsert -- NEVER writes llmMetrics,
   |                        NEVER carries cost_usd or a model id at all
   v
llmMetrics (real model ids, real $) -----> computeHourly (hourly cron)
                                              |
                                              | pages llmMetrics for the hour,
                                              | groups by (provider,model,billingType,goalId),
                                              | writes 1 row per dim-key to `aggregates`
                                              | metric_type="cost" (today) + "tokens" (today)
                                              v
                                    D-04 TARGET: costByPeriod/costByPeriodByProvider
                                    read `tokens` buckets, multiply by modelPricing
                                    rate at READ TIME (not pre-baked dollars)
                                              |
                                              v  D-14 TAIL APPEND (same mutation, same run)
                                    read costBudgets (bounded, small) + this hour's
                                    already-in-memory costByDim -> project burn rate ->
                                    on threshold cross: insert alerts row
                                    (webhookStatus:"pending") + scheduler.runAfter(0,
                                    sendAlertWebhook) -- copies evalScores.ts pattern
```

### Recommended Project Structure (new files only; everything else is edits to existing files)
```
convex/
├── modelPricing.ts       # NEW: CRUD (create/update/remove/list/get) mirroring alertRuleCustom.ts
├── costBudgets.ts         # NEW: CRUD + evaluation helper (evaluateBudgets, called from aggregates.ts tail)
├── aggregates.ts          # EDIT: split tokensByDim into promptTokens/completionTokens; append
│                          #       evaluateBudgets() call at end of computeHourly
├── schema.ts              # EDIT: add modelPricing, costBudgets tables
src/
├── components/
│   ├── ModelPricingAdmin.tsx   # NEW (or under Settings, per Claude's Discretion)
│   ├── CostBudgetsAdmin.tsx    # NEW
│   ├── UnpricedModelsNudge.tsx # NEW: D-03 "N models need rates" persistent affordance
│   ├── CostTrendChart.tsx      # EDIT: Billed / Billed+covered toggle (D-08), move off hex to tokens
│   ├── CostBreakdown.tsx       # EDIT (scope decision needed, see Open Questions): move off hex to tokens
│   └── SDKSpendGuard.tsx       # EDIT: read from costBudgets global-daily row (D-12), not hardcoded consts
```

### Pattern 1: Per-dimension-row hourly aggregation (already implemented — reuse, don't rebuild)
**What:** One `aggregates` document per `(provider, model, billingType, goalId)` combination per
hour, not one wide document with a nested map.
**When to use:** Any new per-model metric this phase adds (e.g., splitting tokens by
prompt/completion) should follow this exact row-per-dimension-key shape — it is already proven
safe and idempotent on self-hosted Convex.
**Example (existing, `convex/aggregates.ts:34-76`):**
```typescript
// Source: convex/aggregates.ts (verified live 2026-07-30)
const costByDim: Record<string, number> = {};
const tokensByDim: Record<string, number> = {};
for (const r of llmRows) {
  const billingType = (r as any).billingType ?? getBillingType(r.provider);
  const key = `${r.provider}::${r.model}::${billingType}::${(r as any).goalId ?? ""}`;
  costByDim[key] = (costByDim[key] ?? 0) + (r.cost ?? 0);
  tokensByDim[key] = (tokensByDim[key] ?? 0) + ((r as any).totalTokens ?? 0);
}
// ... idempotency guard via existing rows for (metric_type, period, bucket_start) ...
// ... one ctx.db.insert("aggregates", {...}) per new dimension key ...
```
**D-04 change needed:** widen the per-key value from a single `totalTokens` number to
`{ promptTokens, completionTokens, cacheReadInputTokens?, cacheCreationInputTokens? }` (or a
second parallel `"tokens_output"` metric_type row, following the same pattern already used to add
`"tokens"` alongside `"cost"`). Either shape keeps every read bounded by the existing
`by_type_period_bucket` index — no new query pattern required.

### Pattern 2: Fire-and-deliver alert with cross-status dedup (copy verbatim)
**What:** Insert directly into `alerts` with `webhookStatus: "pending"`, then
`ctx.scheduler.runAfter(0, internal.webhookDelivery.sendAlertWebhook, { alertId, attempt: 1 })`.
Never call the public `alerts.create` (it does not deliver).
**When to use:** Every budget alert this phase fires (D-15, D-17).
**Example (verified live, `convex/evalScores.ts:1235-1249` + `1329-1349`):**
```typescript
// Source: convex/evalScores.ts (verified 2026-07-30)
export async function insertRegressionAlertHandler(ctx, args) {
  return await ctx.db.insert("alerts", {
    severity: "warning",
    source: `eval-regression:${args.profileId}`,
    message: args.message,
    acknowledged: false,
    status: "active",
    createdAt: Date.now() / 1000,
    webhookStatus: "pending",
    details: args.details,
  });
}
// ... later, after the insert:
await ctx.scheduler.runAfter(0, internal.webhookDelivery.sendAlertWebhook, {
  alertId, attempt: 1,
});
```
**Dedup query (`convex/evalScores.ts:1168-1178`, uses the `alerts.by_source` index, all
statuses, no `.eq("status", ...)` filter):**
```typescript
export const getRegressionAlertsInternal = internalQuery({
  args: { profileId: v.string() },
  handler: async (ctx, { profileId }) => {
    return await ctx.db.query("alerts")
      .withIndex("by_source", (q) => q.eq("source", `eval-regression:${profileId}`))
      .collect();
  },
});
// caller then does: alertedChangeDates.has(event.timestamp) -- i.e. a Set built from
// details.<discriminator> across every returned row, regardless of status.
```
**D-15 mapping for this phase:** `source = \`cost-budget:${budgetId}:${level}\`` (level =
`"warning"`|`"error"`), dedup discriminator = `details.periodStart`. This exactly satisfies "fire
once per budget, per level, per period; re-arm at period reset" without inventing a new
mechanism.

### Pattern 3: Existing admin-CRUD shape to mirror for `modelPricing` / `costBudgets`
**What:** `create` / `update` / `remove` / `list` / `get` mutations+query, plus a
`setThresholdOverride`-style sub-pattern already proven for per-rule threshold config.
**Example (`convex/alertRuleCustom.ts`, exported surface, verified 2026-07-30):**
```
export const create = mutation({ ... });
export const update = mutation({ ... });
export const remove = mutation({ ... });
export const list = query({ ... });
export const get = query({ ... });
export const setThresholdOverride = mutation({ ... });
export const getThresholdOverride = query({ ... });
export const listThresholdOverrides = query({ ... });
```
Its schema table (`alertRuleCustom`, `schema.ts:984+`) already models a `"cost_per_hour"` metric
condition — i.e. the *general* alert-rule engine was designed with cost thresholds in mind, but
the evaluator that would act on it (`internal.alerts.evaluateInternal`) is the disabled cron. This
phase's `costBudgets` table is a **narrower, purpose-built** table (per D-09/D-11), not a
duplication of `alertRuleCustom` — but the CRUD shape is directly reusable.

### Pattern 4: Existing budget-cap projection algorithm (D-13's mechanism)
**What:** `SDKSpendGuard.tsx`'s `projectDayEndSpend` is already the "rate-projection-to-period-end"
algorithm D-13 names. Verified live (`src/components/SDKSpendGuard.tsx:22-37`):
```typescript
export function projectDayEndSpend(todaySpend: number, elapsedHours: number) {
  if (elapsedHours <= 0) return { projectedTotal: 0, willExceedCap: false, projectedHitTime: null };
  const hourlyRate = todaySpend / elapsedHours;
  const projectedTotal = hourlyRate * 24;
  const willExceedCap = projectedTotal > DAILY_CAP;
  const dayStartEpoch = Math.floor(Date.now() / 1000 / 86400) * 86400;
  const projectedHitTime = willExceedCap && hourlyRate > 0
    ? new Date((dayStartEpoch + (DAILY_CAP / hourlyRate) * 3600) * 1000)
    : null;
  return { projectedTotal, willExceedCap, projectedHitTime };
}
```
**Generalization needed for D-10/D-11/D-13:** parameterize `24` (hours in period) and
`dayStartEpoch`'s `86400` divisor by the budget row's `period` (`daily|weekly|monthly`), and by
`limit` instead of the module constant `DAILY_CAP`. The core `hourlyRate * periodHours` math does
not otherwise change.

### Anti-Patterns to Avoid
- **Nested per-model map in one hourly bucket document:** not what the existing code does, and
  not needed — don't introduce this shape; it would be a regression from the current row-per-key
  design and risks the doc-size growth CONTEXT.md's D-04 note worried about, for no benefit.
- **A second, independently-hardcoded spend gauge or budget cap:** the codebase already has this
  failure mode twice (`SDKSpendGuard`'s `DAILY_CAP=5`, `forecasts.ts`'s
  `agentConfigs["intelligence.budget_cap"]`) — see the CONTEXT.md coverage gap below. Do not add a
  third.
- **`.collect()` on an unbounded/unindexed range for a total:** `convex/llm.ts`'s `costByModel`
  and `providerBreakdown` (used to pull live-data evidence for this research) both do a 30-day
  `.collect()` over `llmMetrics` with no page cap — pre-existing tech debt, not introduced by this
  phase, but do not copy this pattern for any new query this phase adds; use the
  `aggregates` table (already hourly/daily rolled up) instead of re-scanning `llmMetrics` for any
  new cost view spanning more than ~a day.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Alert delivery (webhook, digest, mute) | A new delivery path for budget alerts | `convex/webhookDelivery.ts` `sendAlertWebhook` via `scheduler.runAfter` | Already handles channels, preferences, mute checks, retry (`attempt` param); COST-03 is explicitly scoped to "no new channel plumbing" |
| Budget-progress CRUD forms | A bespoke admin table component | Mirror `alertRuleCustom.ts`'s create/update/remove/list/get shape | Proven pattern in this codebase, consistent UX with existing rule config |
| Burn-rate projection math | A new anomaly/forecasting algorithm | `SDKSpendGuard.tsx`'s `projectDayEndSpend`, generalized to arbitrary period length | D-13 explicitly names this as the chosen algorithm; `convex/anomalyDetection.ts`'s z-score detector is explicitly NOT to be duplicated or silently repurposed (D-13) |
| Stacked provider bar chart | A new charting primitive | `FlexBarChart` (`StackedSegment[]`) already used by `CostTrendChart` | D-08 explicitly reuses this shape for the Billed/Billed+covered toggle |

**Key insight:** every piece of machinery this phase needs to fire, deliver, project, or render a
budget/cost signal already exists in the codebase in a slightly-too-narrow form (single hardcoded
cap, single hardcoded rate table, single-purpose regression-alert dedup). The work is
generalizing narrow-but-correct existing code, not inventing new subsystems.

## Common Pitfalls

### Pitfall 1: Treating D-06's "common path" as live when it is not
**What goes wrong:** Planning a task that reads `d.model` off a CLI-gateway completion event and
looks it up in `modelPricing`, assuming that field exists.
**Why it happens:** CONTEXT.md's D-06 language ("a Claude Code turn reporting `claude-opus-5`")
describes a plausible-sounding mechanism that does not exist in the current code — no adapter in
`gateway/gateway/adapters/` (`claude_cli.py`, `codex_cli.py`, `antigravity_cli.py`,
`claude_sdk.py`) extracts or forwards a model id anywhere in its `TaskEvent`/`TaskResponse`
payloads, and neither gateway-completion event type CodePulse can receive
(`gateway.task_completed` / unrouted `gateway_task_completed`) carries one.
**How to avoid:** Plan directly for the `shadowModel` fallback (opaque id → mapping row), and
treat "ingest a gateway completion into `llmMetrics` with a real cost figure at all" as a
prerequisite task, not an assumed-already-working input. Live evidence: `npx convex run
llm:providerBreakdown` on 2026-07-30 returned exactly 6 providers, none of them
`claude-cli`/`codex`/`antigravity`/`claude-sdk`; `npx convex run llm:subscriptionUsage` returned
`{ calls: 0, tokens: 0 }`.
**Warning signs:** Any task description that says "read the model from the subscription turn's
telemetry" without first citing which event/field carries it.

### Pitfall 2: Assuming `gatewayQuotaSnapshots` (D-07's source) has live data
**What goes wrong:** Building the D-07 quota-threshold UI/alert against a table assumed to be
populated every 5 minutes by the existing `poll-gateway-quota` cron.
**Why it happens:** The cron (`convex/crons.ts:97-102`, `internal.gatewayQuota.pollAndStore`) is
real, active, and unconditionally scheduled. But it fetches `${ASTRIDR_API_URL}/quota` —
`ASTRIDR_API_URL` is astridr's main web API (`web.py`, default `:8181` per this repo's own
CLAUDE.md), which has **no `/quota` route at all** (verified: zero matches for `"quota"` anywhere
in `astridr/channels/web.py`). The only `/quota` route in the entire astridr-repo lives on the
**separate CLI-gateway sidecar** (`gateway/gateway/app.py:302`, served on its own port,
`http://cli-gateway:8200`, not proxied by astridr's main API). Live check confirms this: `npx
convex run gatewayQuota:latestByProvider` returns `[]`.
**How to avoid:** Flag this as a cross-repo prerequisite (either astridr adds a `/quota` proxy
route on `:8181`, or CodePulse's poller is repointed at the gateway sidecar's own URL/port — a new
env var). This is astridr-repo work, not CodePulse work, and is outside this phase's "observe and
report, never mutate Ástríðr" boundary only in the narrow sense that D-16 forbids CodePulse
mutating Ástríðr's *runtime behavior* — fixing a dead telemetry poll is not that, but it is
cross-repo coordination the planner should call out explicitly rather than silently build a UI on
top of an empty table.
**Warning signs:** `gatewayQuotaSnapshots` query returning `[]` in dev/local testing — this is
not a fixture gap, it reproduces live.

### Pitfall 3: Re-deriving cost from `llmMetrics.cost` in places D-01 doesn't cover
**What goes wrong:** `CostBreakdown.tsx` (goal-scoped, hosted on `HivePage.tsx`) and its hooks
(`useCostByGoal`/`useLlmByGoal` → `costByGoalPeriod`/`llmByGoal` in `aggregates.ts`) read
`r.cost ?? 0` directly off raw `llmMetrics` rows — the *reported*, not recomputed, dollar figure.
If D-01's "CodePulse recomputes cost from tokens × rate" is implemented only for the
Analytics-page cost cluster, `CostBreakdown` on HivePage will show a **different** total for the
same underlying calls once a `modelPricing` rate diverges from whatever Ástríðr reported — the
exact "two numbers that can disagree" failure D-12 was written to prevent, just via a surface
CONTEXT.md's canonical_refs didn't flag for this specific implication.
**How to avoid:** Explicit planner decision needed on whether `CostBreakdown`/`costByGoalPeriod`
are in scope for D-01's recompute-at-read-time rule this phase, or an explicitly documented
follow-up. See Open Questions.
**Warning signs:** Any plan that touches `aggregates.ts`'s hourly/daily cost path but leaves
`costByGoalPeriod`/`llmByGoal` untouched should say so explicitly, not silently.

### Pitfall 4: Unbounded `.collect()` inside the D-14 tail-of-`computeHourly` evaluation
**What goes wrong:** A budget evaluator that needs "spend so far this month" reads `llmMetrics`
directly (unbounded/wide) instead of the already-rolled-up `aggregates` table.
**Why it happens:** It is tempting to re-derive from raw rows for accuracy.
**How to avoid:** Read `aggregates` (`metric_type: "tokens"` or `"cost"`, index-bounded on
`by_type_period_bucket`, range from period-start to now) — at most `~31 daily buckets × N
dimension keys` for a monthly budget, a small, bounded read. This is the same discipline
`costForecast` already uses (`aggregates` query bounded to 30 days on an index, never raw
`llmMetrics`). Cross-reference CLAUDE.md's Self-Hosted Convex rules and this project's own
incident history (heroStats timeout, retention prune self-defeat, disabled `evaluateInternal`
cron) — all three trace to an unbounded or re-scanning read on this single-node instance.

### Pitfall 5: Assuming the disabled `evaluateInternal` cron's slowness came from a scan D-14 also touches
**What goes wrong:** Worrying that appending budget evaluation to `computeHourly` risks the same
15s-syscall-cap failure that disabled `evaluateInternal`.
**Why it happens:** Surface-level pattern match ("another alert-evaluation cron").
**Reality (verified `convex/alerts.ts:674-830`):** `evaluateInternal`'s cost was a `.collect()`
over ALL unacknowledged alerts, a 200-row recent-events window scan, an all active-sessions
`.collect()`, PLUS one Convex read per *each* of 40+ static rules and N custom rules
(`alertRuleCustom` by_enabled `.collect()`, then a per-rule loop each potentially issuing more
reads) — a fan-out pattern, not a single bounded read. `computeHourly`'s existing read (paginated
`llmMetrics` for one hour, 500-row pages) plus a `costBudgets` read (bounded by however many
budget rows exist — realistically single/low-double-digit count) plus a bounded `aggregates`
range read for burn-rate projection is a fundamentally different, much smaller shape. D-14's
"adds no new scan" claim in CONTEXT.md is well-founded, but the planner should still state the
concrete new reads (costBudgets `.collect()` count, aggregates range-read row count) rather than
asserting "adds nothing" — it adds a small, bounded amount, which is the actual safe claim.
**Warning signs:** Any costBudgets table growing into the hundreds of rows (unlikely per D-09's
scope, but worth a soft cap/UI warning since it's read via `.collect()` every hour).

## Code Examples

### Deriving cost from tokens at read time (new — no direct precedent, composed from existing pieces)
```typescript
// Composed from convex/aggregates.ts's existing per-dim-key tokens bucket +
// a new convex/modelPricing.ts lookup. Illustrative shape only.
const tokenRows = await ctx.db.query("aggregates")
  .withIndex("by_type_period_bucket", (q) =>
    q.eq("metric_type", "tokens").eq("period", args.period).gte("bucket_start", cutoff))
  .collect();
const rates = await ctx.db.query("modelPricing").collect(); // small table, full scan is fine
const rateByModel = new Map(rates.map((r) => [r.model, r]));

let total = 0;
let unpricedTokens = 0;
for (const row of tokenRows) {
  const { model } = row.dimensions as { model: string };
  const rate = rateByModel.get(model);
  if (!rate) { unpricedTokens += row.promptTokens + row.completionTokens; continue; } // D-03
  total += row.promptTokens * rate.input + row.completionTokens * rate.output;
}
```

### Gateway-completion event routing today (what NOT to build on top of unchanged)
```typescript
// Source: convex/runtimeIngest.ts:965-981 (verified 2026-07-30)
case "gateway.task_completed": {
  const d = data as any;
  const provider = d.provider ?? "unknown";
  const sessionId = d.session_id ?? d.sessionId ?? "unknown";
  await ctx.runMutation(api.toolExecutions.insert, {
    sessionId, toolName: `gateway:${provider}`, provider,
    success: true, durationMs: d.duration_ms ?? d.durationMs, timestamp,
  });
  await ctx.runMutation(api.sessions.upsert, { sessionId, provider });
  break;
  // NOTE: no cost, no tokens, no model -- none of these fields exist on `d` for this
  // event type. A NEW ingest case (or an extension of this one) is required before
  // any subscription-CLI cost figure can exist in llmMetrics at all.
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Ingest-accepted `cost` treated as truth | Recompute from tokens × Convex-editable rate (D-01) | This phase | One place to fix a mispriced model; enables retroactive re-pricing (D-04) |
| Hardcoded `SDKSpendGuard.DAILY_CAP=5`/`ALERT_THRESHOLD=0.8` | `costBudgets` table row, seeded from these constants (D-12) | This phase | Removes one of (at least) three independent hardcoded/siloed cap sources found in this research |
| `internal.alerts.evaluateInternal` (disabled 2026-07-14) | Budget-specific evaluation appended to `computeHourly` (D-14) | This phase | Sidesteps the 15s syscall cap that killed the general evaluator, at the cost of up-to-1-hour alert latency (accepted) |

**Deprecated/outdated:** `internal.alerts.evaluateInternal` remains disabled and out of this
phase's scope to fix (Deferred). `src/lib/modelPricing.ts` (the file-based rate table) becomes a
seed source only, not the runtime source of truth, once `modelPricing` (Convex) exists — the
three HR surfaces still importing it (`AgentAnalytics.tsx`, `MetricsDashboard.tsx`,
`TokenUsageChart.tsx`) are Claude's Discretion whether to migrate this phase (Deferred notes this
explicitly).

## ⚠ Decision at risk: D-06

**Decision as written:** "The shadow rate comes from the turn's own reported model when that id
is priceable... An explicit per-engine `shadowModel` mapping row... is the fallback for opaque
ids."

**Evidence this needs re-framing (not re-deciding):** The "common path" branch of this decision
describes a mechanism that does not exist in the current codebase for any CLI-gateway-routed
turn, verified two independent ways:
1. **Code trace:** none of `gateway/gateway/adapters/{claude_cli,codex_cli,antigravity_cli,
   claude_sdk}.py` ever populates a `model` field on any `TaskEvent`/`TaskResponse`/telemetry
   payload. The gateway's own `telemetry_client.py` `emit_task_completed()` payload is
   `{task_id, account, profile, priority, cost_usd, status}` — no model. The AgentLoop-side
   `astridr/tools/cli_gateway.py` emits a *second*, differently-named event
   (`"gateway.task_completed"`, dot-separated) with `{provider, task_id, session_id,
   duration_ms}` — also no model, no cost.
2. **Live data:** `npx convex run llm:providerBreakdown` against the running self-hosted instance
   (2026-07-30) shows exactly 6 distinct `provider` values in `llmMetrics` over 30 days —
   `gemini_openrouter`, `anthropic_direct`, `anthropic_advisor`, `gemini`, `openai`, `grok` — zero
   of the four gateway ids (`claude-cli`, `codex`, `antigravity`, `claude-sdk`).
   `llm:subscriptionUsage` (filters `billingType === "subscription"`) returns `{calls: 0,
   tokens: 0}`.

**What this means for planning, without re-opening D-06 itself:** the decision's *fallback*
branch (opaque-id → `shadowModel` mapping row) is the only branch with any code to build against
today. Before a shadow-cost figure can exist at all for subscription turns, new ingest wiring is
needed: either extend the `"gateway.task_completed"` case (or add a case for the currently-unrouted
`"gateway_task_completed"`, which does carry `costUsd`) to write an `llmMetrics` row keyed on the
opaque `account`/`provider` id, with `billingType: "subscription"`. The `shadowModel` mapping then
keys off exactly the same opaque id set already known to CodePulse
(`GATEWAY_PROVIDERS` in `convex/lib/providers.ts`: `claude-cli`, `codex`, `antigravity`,
`claude-sdk`). This is a bounded, well-scoped addition — but it is *new* ingest work this phase
must account for, not existing plumbing to wire a UI onto.

## ⚠ Gap in CONTEXT.md coverage: a third pre-existing budget cap

`convex/forecasts.ts`'s `costForecast` query and `CostForecastPanel.tsx` (the *first* panel in
the Analytics cost cluster, `Analytics.tsx:88`, directly above `SDKSpendGuard` at `:96`) already
implement an independent monthly budget cap:
- Stored in `agentConfigs` under key `"intelligence.budget_cap"` (own `setBudgetCap` mutation,
  own `getBudgetConfig` query).
- Own two-tier classifier (`classifyBudgetStatus`: 80% → `"warning"`, 100% → `"exceeded"`) —
  structurally identical in shape to D-11's warn/breach model, but a **separate, un-integrated**
  implementation.
- Rendered as its own progress bar with its own "On track / Near limit / Over budget" labels.

CONTEXT.md's `<canonical_refs>` and `<decisions>` never mention `forecasts.ts`,
`agentConfigs["intelligence.budget_cap"]`, or `CostForecastPanel`'s existing cap concept — D-12's
"do not ship a second spend gauge... two caps that can disagree" was written against
`SDKSpendGuard` only. Shipping `costBudgets` (D-09) alongside `SDKSpendGuard` rewired onto it
(D-12) while leaving `CostForecastPanel`'s independent monthly cap untouched reproduces the exact
anti-pattern D-12 exists to prevent, on the very first panel of the page. This is not a defect in
CONTEXT.md's locked decisions — it's information the planner needs to decide, in the same spirit
as D-12, whether `CostForecastPanel`'s monthly cap becomes a `period: "monthly", scope: "global"`
row in `costBudgets` (folding three sources down to one) or is explicitly left as a documented,
intentional gap for a later phase.

## Runtime State Inventory

Not applicable — this is a greenfield-additive phase (new tables, new UI panels, extended cron),
not a rename/refactor/migration phase.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Self-hosted Convex (`convex-backend` container) | All new tables/functions | ✓ | live, healthy (verified via `docker ps`) | — |
| `ASTRIDR_TELEMETRY_WEBHOOK_URL` (gateway → astridr forwarding) | Future gateway-cost ingest wiring (Pitfall 1) | Unverified this session (env var, not inspectable per `.env` read restriction) | — | Confirm live with the operator before building the new ingest case |
| astridr `/quota` route reachable from CodePulse's poller | D-07 | ✗ (wrong host/port target — see Pitfall 2) | — | Cross-repo fix (astridr proxy route, or repoint CodePulse's poller at the gateway sidecar) — flag as a phase dependency, do not silently build UI on an empty table |

**Missing dependencies with no fallback:** none block *starting* this phase — D-07's quota data
gap only blocks the quota-threshold sub-feature, and the phase can still ship COST-01/02/03's
dollar-budget half without it (D-07 explicitly separates the two axes).

**Missing dependencies with fallback:** the `/quota` routing gap has a fallback (fix cross-repo,
or ship the quota-threshold UI in a documented "no live data yet" state, matching this project's
established honesty bar per `<specifics>` in CONTEXT.md).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.9 (jsdom environment) + Playwright ^1.61.1 for E2E |
| Config file | `vitest.config.ts` (jsdom, `src/test/setup.ts`, includes `src/**/*.test.{ts,tsx}` and `convex/**/*.test.ts`) |
| Quick run command | `npx vitest run convex/aggregates.test.ts src/components/SDKSpendGuard.test.tsx` (or the relevant new test files) |
| Full suite command | `npm test` (vitest) — Convex logic is tested via extracted pure functions/handlers against fake `ctx`, per this codebase's established pattern (`evalScores.ts`'s `insertRegressionAlertHandler`/`detectRegressionsForPersona` being directly unit-testable without `convex-test`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COST-01 | Cost recomputed from tokens × rate, not raw ingested `cost` | unit | `npx vitest run convex/modelPricing.test.ts` | ❌ Wave 0 |
| COST-01 | Unpriced model excluded from total, shown as its own row (D-03) | unit | `npx vitest run convex/aggregates.test.ts -t "unpriced"` | ❌ Wave 0 (extends existing `convex/analyticsRollup.test.ts`/new file) |
| COST-01 | History re-prices retroactively when a rate is added/changed (D-04) | unit | `npx vitest run convex/aggregates.test.ts -t "re-price"` | ❌ Wave 0 — this is the highest-value test in the phase: insert tokens-only aggregate rows, add a `modelPricing` row, assert the read-time total changes with zero rollup mutation |
| COST-01 | Billed vs. shadow ("covered") never merge into one headline (D-05) | unit + component | `npx vitest run src/components/CostTrendChart.test.tsx` | ❌ Wave 0 |
| COST-02 | Warn fires at `warnFraction × limit`, breach at `limit` (D-11) | unit | `npx vitest run convex/costBudgets.test.ts` | ❌ Wave 0 |
| COST-02 | `SDKSpendGuard` reads from the global-daily `costBudgets` row, not hardcoded constants (D-12) | unit | extend existing `src/components/SDKSpendGuard.test.tsx` | ✓ exists, extend |
| COST-03 | Alert fires once per (budgetId, level, periodStart); re-arms at period reset (D-15) | unit | `npx vitest run convex/costBudgets.test.ts -t "dedup"` | ❌ Wave 0 — mirror `evalScores.test.ts`'s dedup test shape (fake ctx, no live cron needed) |
| COST-03 | Alert insert uses the delivering path (`webhookStatus:"pending"` + `scheduler.runAfter`), never public `alerts.create` (D-17) | unit | assert on the fake-ctx call args, same pattern as `evalScores.ts`'s existing tests | ❌ Wave 0 |
| COST-03 | `computeHourly` tail-append adds no unbounded read (D-14) | unit + manual code review | assert `costBudgets` read uses `.collect()` on the full table only (small, bounded) and any burn-rate read uses `aggregates`'s indexed range, never raw `llmMetrics` re-scan | ❌ Wave 0, review-gated |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched test files>`
- **Per wave merge:** `npm test` (full vitest suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`; the D-14 "no unbounded read" property
  is a code-review gate, not something vitest can assert against real Convex query-cost — call
  this out explicitly in the phase's verification checklist rather than relying on unit tests
  alone (mirrors this project's own "a green unit suite is not accepted as proof" pattern from
  Phase 103's live-verification discipline).

### Wave 0 Gaps
- [ ] `convex/modelPricing.test.ts` — CRUD + rate-lookup unit tests
- [ ] `convex/costBudgets.test.ts` — CRUD + warn/breach classification + dedup unit tests
- [ ] Extend `convex/aggregates.test.ts` (or `analyticsRollup.test.ts`) — tokens-by-model widening,
      read-time dollar derivation, unpriced-exclusion behavior
- [ ] Extend `src/components/SDKSpendGuard.test.tsx` — reading limit/warnFraction from a
      `costBudgets` row instead of module constants
- [ ] No new test framework or config needed — existing Vitest/Playwright setup fully covers this
      phase's testing surface

## Security Domain

`security_enforcement` is absent from `.planning/config.json` (treated as enabled per the
research protocol default).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | This phase adds no new auth surface; existing Clerk/dev-mode gating on the dashboard is unchanged |
| V3 Session Management | no | N/A |
| V4 Access Control | yes | **[CORRECTED 2026-07-31 — verified against live code]** `costBudgets`/`modelPricing` mutations MUST mirror the sibling admin surfaces' actual pattern: a public `mutation()` that opens its handler with a Clerk identity gate. Both cited exemplars have one — `convex/alertRuleCustom.ts:46-48` (`// CPHLTH-01: Require authenticated Clerk identity.` → `ctx.auth.getUserIdentity()` → `throw new ConvexError("Unauthenticated")`) and `convex/forecasts.ts:143-144` (identical two lines). The earlier claim in this section that the convention is "no additional identity check" was false. Money-affecting config mutations get the gate; omitting it diverges from convention rather than matching it. |
| V5 Input Validation | yes | Convex `v.*` validators on every new table field (already the project-wide convention); budget `limit`/`warnFraction` need range validation (mirror `forecasts.ts`'s `setBudgetCap`: `args.cap > 0 && args.cap < 1_000_000` pattern) |
| V6 Cryptography | no | N/A — no secrets/crypto introduced |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated write to a new public `mutation()` (e.g. `costBudgets.create`) | Tampering | **[CORRECTED 2026-07-31]** Follow the exact same pattern already accepted for `alertRuleCustom.create` (`convex/alertRuleCustom.ts:46-48`) and `forecasts.setBudgetCap` (`convex/forecasts.ts:143-144`) — both open the handler with `const identity = await ctx.auth.getUserIdentity(); if (!identity) throw new ConvexError("Unauthenticated");`. Reproduce those two lines verbatim at the top of every new `costBudgets`/`modelPricing` write handler. This IS the sibling convention — it is not a bespoke stricter bar. |
| Unbounded `.collect()` becoming a DoS vector against the single-node self-hosted instance | Denial of Service | Every new query must be index-range-bounded per CLAUDE.md's Self-Hosted Convex rules; this is functional correctness and availability, not classic ASVS, but is the dominant real threat class in this specific deployment (see Pitfall 4/5) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ASTRIDR_TELEMETRY_WEBHOOK_URL` is actually configured and the gateway→astridr→Convex forwarding chain works end-to-end for the *event types it does support* (i.e., the chain itself is live, only the specific `llmMetrics` routing is the gap) | Environment Availability, Pitfall 1 | If the webhook itself is unconfigured/broken, the new ingest wiring this phase needs to add has no live signal to test against at all — this needs a live check before Wave 1 |
| A2 | The ~12 distinct model ids observed live (`claude-haiku-4-5`, `claude-haiku-4-5-20251001`, `claude-opus-4-6`, `claude-opus-4-8`, `claude-sonnet-4-6`, `claude-sonnet-5`, `gemini-2.5-flash`, `gemini-3.5-flash`, `google/gemini-2.5-flash`, `google/gemini-3.6-flash`, `gpt-4.1`, `grok-4.5`) are representative of the near-term model mix, not an anomaly of the 30-day window queried | Q5 findings (folded into Summary/Pitfalls) | If the live mix is unusually narrow right now (e.g. mid-swap), the initial `modelPricing` seed set could still miss models that reappear next week; D-03's "Unpriced" nudge is the designed safety net for this, so risk is low |
| A3 | ~~No operator-elevated auth check beyond the existing project convention is required~~ **RESOLVED 2026-07-31 — assumption was false.** The existing project convention for money/config-affecting mutations IS a Clerk identity gate; both cited exemplars carry it (`convex/alertRuleCustom.ts:46-48`, `convex/forecasts.ts:143-144`). New `costBudgets`/`modelPricing` write mutations MUST include it. No further decision from Larry is needed — this is convention-matching, not a stricter bar. | Security Domain | Resolved by direct code verification; no residual risk. Shipping without the gate would have left money-affecting config writable unauthenticated. |

**If this table is empty:** N/A — see above.

## Open Questions

1. **Is `CostBreakdown.tsx` (goal-scoped, HivePage) in scope for D-01's recompute-at-read-time
   rule this phase?**
   - What we know: it currently reads raw `llmMetrics.cost` via `costByGoalPeriod`/`llmByGoal`,
     bypassing whatever `modelPricing`-derived total the Analytics cost cluster will show.
   - What's unclear: CONTEXT.md's canonical_refs list this file as an "existing asset" but never
     states whether it must also switch to derived pricing.
   - Recommendation: planner should make an explicit call (in scope this phase, or documented
     follow-up) rather than leave it implicit — either answer is defensible, but silence
     reproduces the exact "two disagreeing totals" pattern D-12 exists to prevent.

2. **Should `CostForecastPanel`'s pre-existing `agentConfigs["intelligence.budget_cap"]` monthly
   cap be folded into `costBudgets` this phase?**
   - What we know: it's a third, fully independent budget-cap implementation, sitting on the very
     first Analytics panel, not mentioned anywhere in CONTEXT.md.
   - What's unclear: whether Larry considers this in-scope for D-09's "one generic table" goal or
     wants it addressed separately.
   - Recommendation: surface this to the operator explicitly before planning locks in D-09's task
     breakdown — see "⚠ Gap in CONTEXT.md coverage" above.

3. **What does the D-07 quota-threshold feature look like when its data source is currently
   empty?**
   - What we know: `gatewayQuotaSnapshots` is polled every 5 minutes but the poll target has no
     matching route (Pitfall 2), so the table has zero rows live.
   - What's unclear: whether fixing the cross-repo routing gap is in scope for this phase, or the
     UI should ship in an honest "no data" state pending a separate fix.
   - Recommendation: treat as a phase dependency to resolve or explicitly descope, not silently
     build against.

## Sources

### Primary (HIGH confidence — live code + live data, verified 2026-07-30)
- `C:\Users\mandr\codepulse\convex\runtimeIngest.ts` — full `llm_call`/`gateway.*` case inventory
- `C:\Users\mandr\codepulse\convex\aggregates.ts` — `computeHourly`/`rollupDaily`/read queries
- `C:\Users\mandr\codepulse\convex\llm.ts`, `convex/lib/providers.ts`, `convex/gatewayQuota.ts`,
  `convex/retention.ts`, `convex/forecasts.ts`, `convex/crons.ts`, `convex/alerts.ts`,
  `convex/evalScores.ts`, `convex/webhookDelivery.ts`, `convex/alertRuleCustom.ts`,
  `convex/schema.ts`
- `C:\Users\mandr\codepulse\src\components\SDKSpendGuard.tsx`, `CostTrendChart.tsx`,
  `CostBreakdown.tsx`, `CostForecastPanel.tsx`, `FlexBarChart.tsx`
- `C:\Users\mandr\codepulse\src\lib\modelPricing.ts`, `src\lib\providers.ts`
- `C:\Users\mandr\astridr-repo\astridr\providers\anthropic_provider.py`
- `C:\Users\mandr\astridr-repo\astridr\tools\cli_gateway.py`
- `C:\Users\mandr\astridr-repo\astridr\channels\web.py` (`/internal/gateway/task_completed`)
- `C:\Users\mandr\astridr-repo\gateway\gateway\{models.py,telemetry_client.py,task_manager.py,
  adapters/{claude_cli.py,claude_sdk.py}}`
- Live self-hosted Convex queries (`npx convex run llm:costByModel`,
  `llm:providerBreakdown`, `llm:subscriptionUsage`, `gatewayQuota:latestByProvider`), run
  read-only against `http://127.0.0.1:3210`, 2026-07-30

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — historical decision log, cross-referenced for D-04/D-14 rationale
  consistency

### Tertiary (LOW confidence)
- None — every substantive claim in this document is either a direct code citation or a live
  data result from this session.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, all existing and version-confirmed via `package.json`
- Architecture (rollup/aggregation/alert patterns): HIGH — every pattern cited is quoted from live
  source read this session
- D-06 CLI-gateway finding: HIGH — confirmed by both code trace and live Convex query
- D-07 quota-source finding: HIGH — confirmed by code trace (`grep` for `/quota`/`quota` across
  both repos) and a live empty-table query
- Pitfalls: HIGH — all derived from reading the actual disabled/working code paths, not inference

**Research date:** 2026-07-30
**Valid until:** ~14 days (self-hosted Convex data shape and astridr's gateway/telemetry wiring
are both under active development this milestone — re-verify the D-06/D-07 findings if more than
~2 weeks pass before this phase executes, since a swap to a different active brain or an astridr
gateway change could shift what's live)
