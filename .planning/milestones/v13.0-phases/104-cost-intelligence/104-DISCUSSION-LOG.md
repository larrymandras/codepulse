# Phase 104: Cost Intelligence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-30
**Phase:** 104-cost-intelligence
**Areas discussed:** Where the dollar comes from, Subscription & CLI spend, Budget threshold axes, Anomaly & alert firing

---

## Where the dollar comes from

### Q1 — Who computes the cost figure CodePulse displays?

| Option | Description | Selected |
|--------|-------------|----------|
| CodePulse recomputes | Owns a pricing table, derives cost = tokens × rate at query/rollup time; the ingest payload's cost is stored but not displayed. One place to fix a mispriced model; can re-price history. Must track every model Ástríðr can route to (~331 in the live catalogue). | ✓ |
| Trust Ástríðr, fall back locally | Use the payload's cost when present, recompute only when absent. Closer to provider usage reporting, but two sources that can silently disagree and an untested fallback path. | |
| Store both, flag disagreement | Persist reported AND recomputed, display one, surface a discrepancy indicator. Catches both a stale local table and a wrong upstream number; extra schema, extra UI concept. | |

**User's choice:** CodePulse recomputes → **D-01**

### Q2 — Where does that pricing table live, and how does a new model get priced?

| Option | Description | Selected |
|--------|-------------|----------|
| Convex table + admin UI | `modelPricing` table seeded from `src/lib/modelPricing.ts`, editable from a settings surface. Price a new engine with no deploy; rollups read the same store. New table + small CRUD surface. | ✓ |
| Code constant, shared module | One TS module imported by both `convex/` and `src/`. Version-controlled and reviewable, but pricing a newly-swapped-to model needs a code change + deploy. | |
| Code defaults + Convex overrides | Code table as baseline, override rows win. No-deploy hotfix with a reviewed source; two places to look when a number seems wrong. | |

**User's choice:** Convex table + admin UI → **D-02**

### Q3 — A call arrives for a model with no pricing row. What does the cost view show?

| Option | Description | Selected |
|--------|-------------|----------|
| Unpriced bucket, never silent | Excluded from the dollar total, shown as its own row with real token counts, plus a persistent "N models need rates" nudge. The total never absorbs a guess; headline understates until the rate is filled in. | ✓ |
| Estimate at default rate, marked | Apply the existing `default` $3/$15 fallback, tag rows as estimated. No missing money, but an opus-5 call priced at sonnet rates is ~5× wrong while looking authoritative. | |
| Both: estimate + separate tally | Estimate in the total AND a separate toggleable "estimated" subtotal. Complete and auditable; two numbers for one thing, more states to test. | |

**User's choice:** Unpriced bucket, never silent → **D-03**

### Q4 — You fix a wrong rate (or add a missing one). What happens to spend already charted?

| Option | Description | Selected |
|--------|-------------|----------|
| Re-price history: rollups store tokens | Rollups carry tokens-by-model, dollars derived at read time. A rate fix corrects every chart back to the start of retention and unpriced rows heal. Wider rollup rows, multiply on the read path. | ✓ |
| Freeze dollars at ingest-time rate | Each bucket stores the dollar figure under the rate in force then. Matches what you were billed, cheaper reads; a wrong rate is wrong forever. | |
| Freeze, with an explicit reprice action | Store dollars, ship a deliberate recompute job. Auditable correction; a batch job over live self-hosted Convex, reaching only as far back as raw rows survive. | |

**User's choice:** Re-price history → **D-04**

**Notes:** Scouting during this area established two facts that shaped it — `src/lib/modelPricing.ts` has no entry for `claude-sonnet-5` / `claude-opus-5` / `claude-fable-5` (the exact models COST-01 names) and is imported only by three HR surfaces; and `convex/runtimeIngest.ts:68` takes cost from the payload where the field is optional, so an un-costed call silently contributes $0 today.

---

## Subscription & CLI spend

### Q1 — Subscription turns bill $0 per call. How does the cost view represent them?

| Option | Description | Selected |
|--------|-------------|----------|
| $0 + shadow "avoided" figure | Real spend stays $0; the same tokens are also priced against a comparable API model and shown as a distinct "covered by subscription" figure. A brain swap visibly explains the drop. Needs a rule for which API rate a CLI brain maps to. | ✓ |
| True $0, with a usage lane | Never impute dollars; subscription turns appear only as token/call volume beside `gatewayQuotaSnapshots` quota burn. Zero invented numbers, but no single figure answers "what did today cost me". | |
| Fold into one blended total | Impute the shadow cost into the headline so the total is continuous across a swap. One comparable number, but the headline stops being money actually owed. | |

**User's choice:** $0 + shadow figure → **D-05**

### Q2 — Where does the shadow rate come from?

| Option | Description | Selected |
|--------|-------------|----------|
| Its own reported model, if priceable | Price at that model's API rate when the id is real; explicit per-engine mapping row as fallback for opaque ids like `claude-cli`. No invented equivalence in the common case; researcher must confirm what Ástríðr reports for CLI-gateway turns. | ✓ |
| Explicit per-engine mapping only | A `shadowModel` field per subscription engine, set deliberately. Predictable and operator-controlled; goes stale when a CLI changes its underlying model. | |
| One configurable blended rate | A single $/Mtok pair for all subscription traffic. Trivial to build; Codex and Claude Code get the same rate, so the figure is order-of-magnitude only. | |

**User's choice:** Its own reported model, if priceable → **D-06**

### Q3 — Billed spend is ~$0 under a subscription brain, so no dollar budget can trip. Does anything still guard that traffic?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — quota burn gets its own threshold | Dollar budgets stay about billed money; subscription traffic guarded by a threshold on `gatewayQuotaSnapshots` (`remainingPct`/`usedToday`), firing through the same alert routing. Each axis guarded in its real unit; two threshold concepts in the config surface. | ✓ |
| No — billed dollars only, this phase | Subscription traffic visible but ungoverned. Smallest scope; an operator on a CLI brain can burn a whole quota with the cost surface reporting all-clear. | |
| Budgets can target billed or blended | Each budget picks its basis. One mechanism covers both; a tripped blended budget alerts on money never charged. | |

**User's choice:** Quota burn gets its own threshold → **D-07**

### Q4 — How does subscription traffic appear in the over-time chart?

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle: Billed / Billed + covered | One chart, one control; billed is the default, covered renders as a visually distinct segment. Reuses `FlexBarChart` + `costByPeriodByProvider`; a mode the user must discover. | ✓ |
| Second stacked lane below | A separate always-visible band for subscription volume, never mixed into the dollar chart. No mode and it doubles as the quota view; more vertical space, two charts to scan. | |
| Table only | Chart stays purely billed; the shadow figure appears as a table column. Least new surface; loses the "when did my spend drop and why" story. | |

**User's choice:** Billed / Billed + covered toggle → **D-08**

---

## Budget threshold axes

### Q1 — Which axes can a budget be set on?

| Option | Description | Selected |
|--------|-------------|----------|
| Global + per-model + per-provider | One `costBudgets` table with a `scope` discriminator. One table, one form, one evaluator; later axes are a new scope value, not a new subsystem. UI must explain scopes and prevent overlaps. | ✓ |
| Global + per-model only | Exactly what COST-02 names. Tightest scope; "which provider is eating my money" is the more common question. | |
| Add per-profile too | Fills the empty `profileConfigs.budget` slot. Matches how personas are thought about; `llmMetrics` has no `profileId`, so attribution needs a join that may not exist — could stall the phase. | |

**User's choice:** Global + per-model + per-provider → **D-09**

### Q2 — What period does a budget cover?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-row period: daily/weekly/monthly | Each row picks its window; daily and monthly rollups already exist. Evaluator must handle three window shapes and a timezone choice. | ✓ |
| Daily only | Matches today's `DAILY_CAP` and the hourly rollup grain. Minimal evaluator; no answer for monthly burn, which is how bills arrive. | |
| Daily + monthly, both fixed | Two known windows, no picker. Still two reset boundaries, and most of the general machinery is built anyway. | |

**User's choice:** Per-row period → **D-10**

### Q3 — What happens to the hardcoded `SDKSpendGuard` $5/day gauge?

| Option | Description | Selected |
|--------|-------------|----------|
| Rewire onto the global daily budget | The gauge reads the configured row; constants survive as the seed. Its projection carries over and becomes the first consumer of the new system. Existing tests move with it. | ✓ |
| Leave it, build alongside | Zero regression risk; two spend caps on one page that can disagree — the stale-second-source pattern 103's D-03 was written to prevent. | |
| Retire it, replace with a budgets panel | One clean surface; loses the projection/burn-rate feature unless deliberately rebuilt. | |

**User's choice:** Rewire onto the global daily budget → **D-12**

### Q4 — Does a budget have levels, or is it one number?

| Option | Description | Selected |
|--------|-------------|----------|
| Limit + warn fraction, per row | Cap plus a warn fraction (default 0.8), firing warning on approach and error on breach — matches the existing severity vocabulary. Two firing points to dedupe and re-arm. | ✓ |
| One limit, breach only | Simplest evaluator; you learn you blew the budget after you blew it, which is why the 80% line exists today. | |
| Free-form levels list | Arbitrary `{fraction, severity}` trip points. Maximum flexibility; over-built for a single-operator dashboard. | |

**User's choice:** Limit + warn fraction → **D-11**

---

## Anomaly & alert firing

### Q1 — What counts as a spike?

| Option | Description | Selected |
|--------|-------------|----------|
| Rate projection to period end | Extrapolate current burn to the period boundary, fire when the projection breaches. `SDKSpendGuard` already computes this; every alert names a concrete number and time. Only detects spikes relative to a configured budget. | ✓ |
| Rolling baseline multiple | Current hour vs a trailing baseline (e.g. > 3× the 7-day median hour). Catches anomalies with no budget set; needs history and an absolute floor to stay useful. | |
| Both, as two rule types | Covers budgeted and unbudgeted spend; roughly double the evaluator, config, and test matrix, and two rules can fire on one spike. | |

**User's choice:** Rate projection → **D-13**

### Q2 — Where does the evaluator run?

| Option | Description | Selected |
|--------|-------------|----------|
| Inside the existing hourly rollup | Evaluate at the tail of `computeHourly`, which already runs hourly and has already read the data. No new cron, no new scan, no new retry-storm surface. Up to an hour of alert latency. | ✓ |
| New bounded cron of its own | Isolated blast radius, can run more often; a new scheduled function on the instance whose cron history is exactly why `evaluateInternal` is commented out. | |
| Evaluate on ingest | Near-real-time; adds work to the hottest path, and a failure rolls back the ingest transaction — the doomed-queue pattern. | |

**User's choice:** Inside the existing hourly rollup → **D-14**

**Notes:** Presented alongside two scouted findings — `convex/crons.ts:42-47` shows the Phase 6 alert-evaluation cron disabled since 2026-07-14 (15s syscall cap, retry storms starving ingest), and `convex/evalScores.ts:1236-1249` documents that the delivering fire path inserts with `webhookStatus: "pending"` + scheduled `sendAlertWebhook` rather than calling the public `alerts.create`.

### Q3 — A budget stays breached all day. How often does it alert?

| Option | Description | Selected |
|--------|-------------|----------|
| Once per level per period | Warn once, breach once, re-arm at period reset; dedup on `(budget, level, periodStart)` in `details`, the `evalScores` pattern. No storms, escalation still gets through; dismissing the breach means nothing re-raises until reset. | ✓ |
| Once, plus re-fire on escalation multiples | Re-fire at 150%, 200%… "3× over" is new information; more dedup state and a ladder to define. | |
| Re-fire every cycle while over | Impossible to miss, mutes already exist; 16 identical alerts get buried by auto-acknowledge-stale, worse than not firing. | |

**User's choice:** Once per level per period → **D-15**

### Q4 — Does a tripped budget do anything beyond alerting?

| Option | Description | Selected |
|--------|-------------|----------|
| Alert only — observation, not enforcement | Reports and routes; never mutates Ástríðr's runtime. Blast radius stays at read paths plus one config table. Nothing actually stops the spend. | ✓ |
| Alert + a one-click action in the alert | Deep link opening the brain picker pre-set to a cheaper engine, operator confirms. Closes the loop without autonomous mutation; couples this phase to 103's surface. | |
| Alert + optional auto-downgrade | Per-budget opt-in dispatching a swap on breach. A real ceiling; autonomous runtime mutation on an hour-stale number deserves its own phase. | |

**User's choice:** Alert only → **D-16**

---

## Claude's Discretion

- Surface placement — default is extending the existing Analytics cost cluster rather than a new `/costs` route; where the pricing admin and budget config form live is the planner's call.
- Naming of the new Convex tables and fields, and of the chart toggle's two labels.
- Component decomposition of the breakdown table, the unpriced-models nudge, and the budget progress display; visual treatment of the "covered by subscription" segment.
- Whether the per-model token map in a rollup bucket is a record or an array of rows.
- Whether the quota threshold shares `costBudgets` with a fourth scope value or gets its own table.

## Deferred Ideas

- Per-profile and per-goal budget scopes (`llmMetrics` has no `profileId`).
- Rolling-baseline / z-score spend anomaly detection (`convex/anomalyDetection.ts` is its natural home).
- Auto-downgrade on breach, and the softer one-click "swap to a cheaper brain" alert action.
- Re-enabling `internal.alerts.evaluateInternal` — with the consequence that the 40+ static rules currently fire only while the Alerts page is open.
- Cache-token pricing (`cacheReadInputTokens` / `cacheCreationInputTokens` already in `llmMetrics`).
- Brain-swap event annotations on the cost timeline.
- Migrating the three HR surfaces still importing `src/lib/modelPricing.ts` once rates move to Convex.
- Enforcement of any kind — spend caps that actually stop work.
