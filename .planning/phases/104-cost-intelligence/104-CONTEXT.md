# Phase 104: Cost Intelligence - Context

**Gathered:** 2026-07-30
**Status:** Ready for planning

<domain>
## Phase Boundary

CodePulse makes Ástríðr's spend legible: a per-model and per-provider cost breakdown over time
that correctly prices the *current* model mix, budget thresholds configurable and persisted in
Convex, and threshold/spike alerts delivered through the **existing** alert-routing layer.

**This phase observes and reports. It never enforces.** Nothing here mutates Ástríðr's runtime —
no automatic brain swap, no spend cutoff, no throttle (D-16). "Budget" in this phase means a
threshold that raises an alert, not a cap that stops work.

**No new alert channels** (per REQUIREMENTS.md "Out of scope (v13.0)"). COST-03 rides
`convex/webhookDelivery.ts` + `convex/alertMutes.ts` as they already exist.

</domain>

<decisions>
## Implementation Decisions

### Cost Attribution — where the dollar comes from (COST-01)

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
  knows (see `<specifics>`). A total that absorbs a guess is that failure, in the one number an
  operator will trust most.

- **D-04:** **Rollups store tokens-by-model; dollars are derived at read time.** Correcting or adding
  a rate must retroactively fix every chart back to the start of retention, and an unpriced
  bucket must heal the moment its rate is entered. This constrains the rollup schema —
  `convex/aggregates.ts` `computeHourly`/`rollupDaily` currently pre-aggregate dollars; the
  planner must widen the bucket shape to carry per-model token counts.
  ⚠ **Planner note:** this is the one decision with a real cost — bucket rows get wider (one key
  per model seen in the hour) and the read path does the multiply. Bound the per-bucket model
  cardinality deliberately; do not `.collect()` unbounded (see `<specifics>` on the heroStats
  and retention incidents).

### Subscription & CLI Spend (COST-01)

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
  ⚠ **Researcher must confirm:** what `provider`/`model` Ástríðr actually reports for
  CLI-gateway turns. This is genuinely unknown right now and determines whether the common path
  or the fallback path is the real one.

- **D-07:** **Dollar budgets guard billed money only; subscription traffic gets its own threshold on
  quota burn.** A dollar budget can never trip while a subscription brain is in force, so
  `gatewayQuotaSnapshots` (`convex/schema.ts:1540` — `usedToday`, `dailyLimit`, `spendUsd`,
  `remainingPct`) carries a threshold of its own, firing through the same alert routing. Each
  axis is guarded in the unit that actually constrains it. No fictional dollars enter a budget.

- **D-08:** **One over-time chart with a `Billed` / `Billed + covered` toggle**, billed as the
  default view; the covered portion renders as a visually distinct segment. Reuses the existing
  `FlexBarChart` + `costByPeriodByProvider` shape rather than adding a second chart. The default
  view never displays imputed money.

### Budget Thresholds (COST-02)

- **D-09:** **One generic `costBudgets` Convex table with a `scope` discriminator** —
  `"global" | "model" | "provider"` plus a key. Per-profile and per-goal are deliberately NOT in
  this phase but must be reachable as a new scope value rather than a new subsystem.
  (Per-profile was considered and dropped: `llmMetrics` carries `agentId` and `goalId` but **no**
  `profileId` (`convex/schema.ts:306-330`), so attributing spend to a profile needs a join that
  may not exist — see `<deferred>`.)

- **D-10:** **Period is per-row: `daily | weekly | monthly`.** A $5/day guardrail and a $100/month
  ceiling are different questions and both are wanted. The daily/hourly rollups that answer them
  already exist in `convex/aggregates.ts`. Planner must pick and state a timezone for period
  boundaries (UTC vs local) — the existing crons are UTC-anchored (`crons.daily … hourUTC`).

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

### Alert Firing (COST-03)

- **D-13:** **"Spike" is defined as rate-projection-to-period-end.** Extrapolate the current burn
  rate to the budget's period boundary and fire when the projection breaches the limit. This is
  the algorithm `SDKSpendGuard` already implements and the operator already reads; every alert
  can therefore name a concrete number and time. A rolling-baseline / z-score anomaly detector
  was considered and **not** chosen for this phase (see `<deferred>` — note
  `convex/anomalyDetection.ts` already implements a z-score evaluator for other metrics; do not
  duplicate it, and do not silently re-purpose it either).

- **D-14:** **The evaluator runs at the tail of the existing `internal.aggregates.computeHourly`
  cron.** No new scheduled function.
  🛑 **This is a hard constraint, not a preference.** `convex/crons.ts:42-47` shows
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
  phase with its own confirm ritual and its own live verification (see `<deferred>`).

- **D-17:** **Alerts must be inserted via the delivering path, not `alerts.create`.**
  `convex/evalScores.ts:1225-1249` documents this explicitly: the fire path inserts with
  `webhookStatus: "pending"` and schedules `internal.webhookDelivery.sendAlertWebhook` — "this
  insert call does not use the shared createIfNew helper, and never calls the public
  `alerts.create`", because the public mutation does not deliver. Copy that shape.

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
- Whether the quota threshold (D-07) shares the `costBudgets` table with a fourth scope value or
  gets its own small table — both satisfy the decision.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements & scope
- `.planning/ROADMAP.md` §"Phase 104: Cost Intelligence" (lines ~707-712) — goal, dependencies,
  and the note that 104 is additive over existing surfaces and independent of Phase 103.
- `.planning/REQUIREMENTS.md` lines 19-23 — COST-01, COST-02, COST-03; plus line 42
  ("New alert delivery channels" is explicitly out of scope for v13.0).

### Project conventions that constrain this phase
- `CLAUDE.md` §"Self-Hosted Convex — Operational Rules" — **the governing constraint on D-04 and
  D-14.** No `import --replace-all`; no bulk delete/patch on the live instance; a dashboard-wide
  "all zeros" is index rot or memory starvation until proven otherwise.
- `CLAUDE.md` §"Styling" — token-driven theming, never hardcode hex, compose the shadcn/ui
  primitives in `src/components/ui/`, Lucide icons only. ⚠ Note `CostTrendChart.tsx` and
  `CostBreakdown.tsx` both currently hardcode hex (`bg-gray-800/50`, `#10b981`, `#ef4444`) —
  anything touched in this phase must be brought onto tokens, and nothing new may add hex.
- `CLAUDE.md` §"Ástríðr API Integration" — any new `/api/*` fetch carries `Authorization: Bearer`
  via `authHeaders()` from `src/lib/astridrApi.ts`.

### Cost & pricing plumbing this phase rebuilds on
- `src/lib/modelPricing.ts` — the rate table to seed `modelPricing` from; **missing sonnet-5 /
  opus-5 / fable-5**, and only imported by the three HR surfaces.
- `convex/aggregates.ts` — `computeHourly` (:7), `rollupDaily` (:119), `costByPeriod` (:172),
  `costByPeriodByProvider` (:208), `costByGoalPeriod` (:277), `llmByGoal` (:308). D-04 widens the
  first two; D-14 appends to `computeHourly`.
- `convex/runtimeIngest.ts:59-79` — the `llm_call` case; where the optional reported `cost`
  enters (:68).
- `convex/schema.ts:306-330` — `llmMetrics` (has `agentId`, `goalId`, `traceId`, `billingType`,
  cache-token fields; **no `profileId`**).
- `convex/schema.ts:1540-1551` — `gatewayQuotaSnapshots`, the D-07 quota source.
- `convex/schema.ts:508-517` — `profileConfigs`, whose `budget: v.optional(v.any())` slot stays
  empty this phase (D-09).
- `src/components/SDKSpendGuard.tsx` — the projection + gauge D-12 rewires and D-13 reuses.
- `src/components/CostTrendChart.tsx`, `src/components/CostForecastPanel.tsx`,
  `src/components/CostBreakdown.tsx` (goal-scoped, hosted on `HivePage.tsx:75`),
  `src/components/FlexBarChart.tsx`.
- `convex/retention.ts` — the batch-capped prune that bounds how far back raw `llmMetrics` rows
  survive, i.e. the real limit on D-04's "re-price history" reach.

### Alert routing this phase must ride (not rebuild)
- `convex/crons.ts` — **read this first for D-14.** The disabled `evaluateInternal` block
  (lines ~28-47) and its incident note are the reason D-14 is written the way it is.
- `convex/evalScores.ts:1225-1290` — `insertRegressionAlertHandler` +
  `detectRegressionsForPersona`: the canonical fire-and-deliver + dedup pattern (D-15, D-17).
- `convex/alerts.ts` — `create` (:22), `evaluate` (:201, the client-invoked public mutation),
  `evaluateInternal` (:674, disabled), `autoAcknowledgeStaleInternal` (:147).
- `convex/webhookDelivery.ts` — `sendAlertWebhook` (:406), `sendDigest` (:551), channel and
  preference queries. The "existing alert-routing layer" COST-03 names.
- `convex/alertMutes.ts`, `convex/alertRules.ts`, `convex/alertRuleCustom.ts` (incl.
  `setThresholdOverride` :143) — existing rule/mute/threshold config surface.
- `convex/anomalyDetection.ts` — an existing z-score anomaly evaluator inserting alerts with
  source `anomaly_detection-${metric}`. **Do not duplicate it and do not silently extend it**;
  D-13 chose projection instead.
- `src/components/AlertRulesEngine.tsx:274` — where `api.alerts.evaluate` is invoked
  client-side, i.e. why static rules only fire while the Alerts page is open.

### Prior-phase context
- `.planning/phases/103-brain-swap-control-surface/103-CONTEXT.md` — D-14/D-15 (server-reported
  truth, never the client's own assertion; no optimistic state) set the honesty bar D-03 and D-05
  inherit. `103-CONTRACT.md` §8/§9 for how a global override shadows per-profile defaults.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (all verified present 2026-07-30)
- `convex/aggregates.ts` — the rollup spine already exists and already runs hourly + daily via
  cron. This phase widens it; it does not build a new aggregation layer.
- `src/components/SDKSpendGuard.tsx` — burn-rate projection, cap gauge, `classifyCapStatus`, and
  an existing test file. D-13's algorithm already lives here.
- `src/components/FlexBarChart.tsx` + `src/lib/providers.ts` (`PROVIDER_COLORS`,
  `PROVIDER_DISPLAY_NAMES`) — the stacked provider-segmented chart shape `CostTrendChart` uses.
- `src/lib/formatters.ts` `formatCost` — the money formatter already in use.
- `convex/webhookDelivery.ts` + `convex/alertMutes.ts` — complete alert delivery, digest, and
  mute plumbing. COST-03 adds a producer, not a channel.
- `src/components/InfoTooltip.tsx`, `SectionErrorBoundary` — the widget conventions.
- `convex/alertRuleCustom.ts` — an existing pattern for user-authored rule rows with thresholds
  (`create`/`update`/`remove`/`list` + `setThresholdOverride`); the `costBudgets` CRUD can mirror
  its shape rather than inventing one.

### Established Patterns
- **Reactive reads:** `useQuery(api.domain.fn) ?? []` behind a `src/hooks/useX.ts` wrapper.
- **Alert fire path:** insert with `webhookStatus: "pending"` + `scheduler.runAfter(…
  sendAlertWebhook)`. The public `alerts.create` does **not** deliver — documented at
  `convex/evalScores.ts:1233`.
- **Dedup:** prior-alert lookup by source, matched on a discriminator carried in `details`,
  blocking re-fire in *any* status.
- **Error isolation:** a throwing `useQuery` unmounts the React tree and blanks every page using
  it — wrap new widget groups in `<SectionErrorBoundary name="…">`.

### Integration Points
- `internal.aggregates.computeHourly` — D-14 appends the budget evaluation here.
- `convex/runtimeIngest.ts:61` `api.llm.recordCall` — where a cost row is born; the reported
  `cost` continues to be stored but stops being the displayed truth (D-01).
- `src/pages/Analytics.tsx` :88 / :96 / :288 — the existing cost cluster this phase extends.
- `convex/schema.ts` — new `modelPricing` and `costBudgets` tables; widened rollup bucket shape.

</code_context>

<specifics>
## Specific Ideas

- **The honesty bar is inherited, not new.** Phase 103 spent an entire gap-closure cycle plus a
  live UAT removing surfaces that asserted more than had happened — a badge rendering the literal
  `"unknown"` sentinel as a real engine, a confirm modal naming a mutation the system never
  performs, a failed swap whose row header still claimed the override applied. D-03 (unpriced ≠
  $0), D-05 (billed never merged with shadow), and D-16 (report, don't enforce) are the same rule
  applied to money.
- **A number that looks idle is often a dead counter, not a quiet system.** The v13.0 sentinel
  cleanup found *all 93* rows in `activeEngineSnapshots` were unresolved sentinels while the
  surface read as merely empty. A cost view showing $0 must be able to distinguish "no spend",
  "spend I can't price", and "no data arriving".
- **Unbounded reads are the specific way this instance dies.** The disabled crons
  (`convex/crons.ts`), the retention prune's self-defeating head re-scan, and the heroStats
  timeout all trace to the same cause on single-node self-hosted Convex. Every query D-04 and
  D-14 add must be range-bounded on an index, never a bare `.collect()` for a total.

</specifics>

<deferred>
## Deferred Ideas

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

</deferred>

---

*Phase: 104-Cost Intelligence*
*Context gathered: 2026-07-30*
