---
phase: 104
slug: cost-intelligence
status: approved
nyquist_compliant: true
wave_0_complete: true
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

- [x] `convex/modelPricing.test.ts` — CRUD, rate lookup, unpriced behavior, shadow-rate mapping
- [x] `convex/costBudgets.test.ts` — CRUD, warn/breach classification, dedup
- [x] Extend `convex/aggregates.test.ts` — prompt/completion token split, read-time dollar derivation, re-pricing, unpriced exclusion
- [x] Extend `convex/runtimeIngest.test.ts` — the D-18 gateway → `llmMetrics` write
- [x] Extend `src/components/SDKSpendGuard.test.tsx` — limit/warnFraction sourced from a `costBudgets` row
- [x] `src/components/CostForecastPanel.test.tsx` — monthly cap sourced from `costBudgets` (D-19)
- [x] No new **framework** — the existing Vitest/Playwright setup covered this phase throughout; no new test
      dependency was added. **One CONFIG change was required and is not covered by this claim:**
      `convex/tsconfig.json` gained a `paths` mapping for the `@/` alias (`e9ca3f9a`), without which
      `npx convex deploy` could not typecheck at all once plan 104-06 introduced the repo's only
      convex→src import. Recorded here rather than silently ticked.

---

---

## Live Deployment Log — 2026-07-31

Executed by `/gsd-execute-phase 104` (plan 104-11 Task 1) against the SELF-HOSTED
deployment. Target confirmed as `http://127.0.0.1:3210` before any write, by matching
env-var names AND a data read against the explicitly-addressed local backend — the
cloud deployment is retired (memory `convex-topology-all-local`), and LESSONS
2026-07-17 records `npx convex` silently hitting the wrong backend.

### Pre-flight baseline (16:45:51Z, before deploy)

| Probe | Value |
|-------|-------|
| `docker stats convex-backend` | 31.18 GiB / 64 GiB (48.71%), CPU 2.25%, PIDs 84 |
| `llm:subscriptionUsage` | `{calls: 0, tokens: 0}` — D-18 baseline |
| `gatewayQuota:latestByProvider` | `[]` — D-20 baseline (poller dead, as RESEARCH found) |
| `llm:providerBreakdown` | `openai` 3 calls / `grok` 7 calls, **`cost: 0` on both** — direct evidence for the phase premise; no gateway provider present |

### Deploy

First attempt **FAILED** after passing the index-deletion safety check —
`npx convex deploy` aborted on 2 x TS2307 (`Cannot find module '@/lib/utils'`,
`'@/lib/hexToRgba'`) while `npx tsc --noEmit` and vitest were both green.
Cause: plan 104-06 added the repo's only convex-to-src import, and
`convex/tsconfig.json` had no `paths` mapping. Fixed in `e9ca3f9a` (NOT with
`--typecheck=disable`). Redeployed successfully.

- `No indexes are deleted by this push` — the documented stop condition did NOT trigger
- `Schema validation complete.` then `Deployed Convex functions to http://127.0.0.1:3210`

### Seeds

| Command | Result |
|---------|--------|
| `modelPricing:seedDefaults` | `{inserted: 23}` |
| `costBudgets:seedFromLegacyCaps` | `{seededDaily: true, seededMonthly: false, monthlySkippedReason: "no positive-number agentConfigs[intelligence.budget_cap] row exists to migrate — no monthly budget was invented"}` |

The monthly refusal is the CORRECT outcome, matching 104-04's live finding: no legacy
monthly cap exists, and none was fabricated. **An operator must set a monthly budget
explicitly via Settings → Cost & Budgets if one is wanted.**

### Backfill

`aggregates:backfillTokenSplit` with `maxHours: 6`, run repeatedly per the plan.

First invocation **FAILED**: "This query or mutation function ran multiple paginated
queries. Convex only supports a single paginated query in each function." — despite 34
green unit tests. The same defect was then found in `computeHourly` (the live cron,
pre-existing from Phase 88). Both fixed in `921517db`; the test mock that had allowed it
now enforces Convex's real single-paginate rule.

After the fix: reached **`done: true` in exactly 120 invocations** (720 h / 6 — matching
104-03's predicted count), 1-2 s each. `docker stats` sampled after every invocation:
memory stayed flat 31.13-31.19 GiB and **ended below the starting value**. The
3-consecutive-monotonic-climb abort (the tombstone/index-rot signature) never tripped.

### Read-only confirmations

| Check | Result |
|-------|--------|
| `modelPricing:list` row count | 23 |
| ...no row with `model === "default"` | **0** — D-03's no-fallback rule holds live |
| ...`claude-sonnet-5` / `claude-opus-5` / `claude-fable-5` present | all 3 present |
| ...`claude-cli` row with `shadowForProvider: "claude-cli"` | present (D-06 shadow rate) |
| `costBudgets:list` | exactly one row: `("global", "", "daily")`, `limit: 5`, `warnFraction: 0.8`, `unit: "usd"`, `enabled: true` |
| `costDerived:unpricedModels` (24 h) | `{count: 0, models: []}` |
| `costDerived:costBreakdown` field shape | `billedTotal` and `coveredTotal` both present; **no** `totalCost`, **no** `combinedTotal` — D-05 separation holds live |
| `costBreakdown` totals (24 h) | `billedTotal: $4.8834`, `coveredTotal: 0`, `unpricedModelCount: 0`, `unpricedTokenTotal: 0` |

No command run in this task contained `--replace-all`. No bulk delete or bulk patch was issued.


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

### Results — 2026-07-31

Recorded per the plan's rule: **a row that could not be executed is recorded as NOT
EXECUTED, never as passing.**

| Behavior | Req | Verdict | Evidence |
|----------|-----|---------|----------|
| D-14: tail-append does not push `computeHourly` past the 15 s syscall cap | COST-03 | **PASS** | Re-measured over 3 consecutive runs: 1264 / 1254 / 1287 ms wall **including ~1 s of `npx` startup**, i.e. ~250-290 ms server-side against a 15 000 ms cap. No `retry`/`backoff`/`SystemTimeout` entries in the function log. `docker stats` stable (31.16 -> 31.24 GiB, CPU 2.85%). Earlier runs: 1648 / 1290 ms wall, so server-side execution is well under 1 s against a 15 s cap. Convex log confirms the evaluator ran: `[computeHourly] budget eval {evaluated: 1, fired: 0, skippedDeduped: 0, skippedNoData: 0, errors: 0}`. No retry-backoff entries. `docker stats` flat at 31.16 GiB, CPU 0.04%. |
| D-03: the "N models need rates" nudge reflects reality on day one | COST-01 | **PASS (fixed)** | FAILED on the 2026-08-02 browser pass — the nudge demanded a rate for `claude-cli`, which `costBreakdown` simultaneously reported as `priced: true, coveredUsd: 0.180785`, and every entry carried zero tokens. Root cause: `priced: false` meant BOTH "no rate resolves" and "no tokens reported", and the query filtered on that boolean. Fixed in `aee665c0` by adding `unpricedReason: "no-rate" | "no-tokens" | null` and counting only `"no-rate"` in both consumers; the dollar-field honesty guard is unchanged. **Re-verified against the live data that exposed it:** 24h 4→0, 168h 3→0, 720h 6→3, and each of the three that remain (`gpt-4.1`, `grok-4.5`, `google/gemini-3.6-flash`) is genuinely absent from the 23 seeded rates AND carries real tokens (32 401 / 148 349 / 137 681) — both halves of this row's requirement. 5 tests, mutation-verified. |
| D-04: adding a rate re-prices existing charts with no rollup re-run | COST-01 | **PASS (mechanism)** / write path NOT EXECUTED | Proved arithmetically against live data: for all 5 breakdown rows, `billedUsd` equals `promptTokens x inputPerToken + completionTokens x outputPerToken` to within 1e-9 (e.g. `claude-opus-4-8` 620201/23875 gives $3.6978800 expected and actual). Dollars are therefore recomputed from the live `modelPricing` table at read time, not read from stored `llmMetrics.cost`. The rate-EDIT half needs a signed-in Clerk session (`modelPricing:update` sits behind `ctx.auth.getUserIdentity()` and the CLI has no identity), so it was not exercised. |
| D-16: no budget alert names or performs an enforcement action | COST-03 | **NOT EXERCISED** (not a pass) | No alert fired during verification, so the forbidden-word guard was never exercised against a real message. The non-fire is CORRECT, independently verified: UTC-day billed spend was $3.0471 against the $4.00 warn line, projecting to $4.2784 against the $5.00 limit, so both the spend axis and D-13's spike branch correctly return null. (The $4.88 24 h figure spans two UTC days.) Guard remains unit-tested only. |
| A1: the gateway to Astridr to Convex forwarding chain is live at all | COST-01 | **PASS** | `ASTRIDR_TELEMETRY_WEBHOOK_URL` is SET on the `astridr-cli-gateway` container, pointing at `http://astridr:8181/<path>` (read from the running container's environment; no `.env` file was opened and no value printed). The chain was then proven end-to-end by D-18 below. |
| D-18: a real gateway turn produces a real `llmMetrics` row | COST-01 | **PASS** | **Required a deploy first:** both `astridr-cli-gateway` and `astridr-agent` were running code that PREDATED `9adb25b6` — verified by grepping inside the containers (0 occurrences of `prompt_tokens` in all four gateway files, 0 `promptTokens` in `web.py`), not inferred from timestamps. No merge to `main` was needed or performed (`feature/brain-swap` is 270 commits ahead; the code was already in the checked-out tree). Rebuilt both via `docker compose --profile prod up -d --build astridr cli-gateway`; post-rebuild greps show 1/5/5/4 and 1. Then submitted ONE real turn (`POST /tasks`, `provider: claude-cli`, `max_turns: 1`, prompt "Reply with exactly the two characters: OK"); the gateway key never left the container. Task completed in 5.5 s returning `prompt_tokens: 36137, completion_tokens: 4` — so the adapter's usage extraction works. Convex then went from the captured baseline `{calls: 0, tokens: 0}` to **`{calls: 1, tokens: 36141}`** (= 36137 + 4 exactly), and `claude-cli` appeared in `llm:providerBreakdown` with `calls=1, cost=0`. Raw `llmMetrics` row inspected directly: `billingType: "subscription"`, `cost: 0` (a true $0, not fabricated), `promptTokens: 36137`, `completionTokens: 4`, `totalTokens: 36141`, `model: "claude-cli"` (the opaque provider id, per D-06's only viable branch — and it matches the seeded D-06 shadow row, so it shadow-prices to `coveredUsd`). |
| D-20: the repaired quota poller actually lands rows | COST-02 | **PASS** | `/quota` confirmed reachable FROM INSIDE `convex-backend` (both `astridr-cli-gateway:8200` and `cli-gateway:8200` return HTTP 200; the two containers share `astridr-network`), and the sidecar serves it unauthenticated. Set `CLI_GATEWAY_URL=http://astridr-cli-gateway:8200` on the deployment, then triggered `gatewayQuota:pollAndStore` rather than waiting for the 5-minute cron. `gatewayQuota:latestByProvider` went from the captured baseline `[]` to **real rows** — including `claude-cli` and `claude-cli-consulting`, each `billingType: subscription`, `dailyLimit: 200`, `remainingPct: 1`, `usedToday: 0`. Note the 30-day retention bound added in `380f13d9` landed BEFORE this table started filling. |

### Task 3 browser steps — executed 2026-08-01/02

| Step | Result | Evidence |
|---|---|---|
| 2 — COST-03 end to end | **PASS** | Budget edited to `$2.76` via Settings, `computeHourly` triggered: `evaluated: 1, fired: 1, errors: 0`. Alert rendered on screen with source `cost-budget:md7pb7p2xqa0h4ssqfdg0802jx8bk94e:error` and message *"Global daily budget at 111% ($3.0629 of $2.7600) — projected to hit $2.7600 by ~08:03 PM."* — independently matching the $3.0629 computed from `costOverTime`. |
| 2 — D-16 no enforcement wording | **PASS** | Message read on screen: names a concrete figure AND a concrete time, and contains none of `throttle / swap / stop / block / disable / cap enforced`. |
| 2 — D-15 per-period dedup | **PASS** | Second `computeHourly`: `fired: 0, skippedDeduped: 1`, and the source still has exactly 1 alert row. |
| 2 — delivery actually ran | **PASS** | `webhookStatus: "delivered"`, badge shows "Delivered 22m ago" after the unit fix (`1a136dc8`). |
| 5 — honest empty state | **PASS (after a fix)** | First attempt could not be observed — and the reason turned out to be a REAL BUG, not a testing miss. Toggling the budget off changed nothing: the save persisted `enabled: false`, but `costBudgets.getByScope` returned the row regardless of `enabled`, so `SDKSpendGuard` kept painting a live gauge, an "On Track" badge and a projection against a threshold `costBudgetEval.ts:209` would never alert on (it filters `b.enabled`). The same defect was then found in `forecasts.ts:99-105` for the monthly axis. Both fixed in `b26b22f4`. **Re-tested and CONFIRMED on screen:** SDK DAILY CAP renders `$2.4864 today` + sparkline + *"No daily budget set. Set one in Settings → Cost & Budgets."* with NO progress bar, NO `$5`, NO percentage and NO badge; Cost Forecast shows the equivalent *"No monthly budget set."* Verified live with a control (disabled row and a never-existing scope return byte-identical null). |
| 6 — theme coverage | **PASS (4 of 4 selectable)** | Cycled with no unreadable text or stuck colour reported. Electric Cyan and Midnight Aubergine captured directly. **NOTE: the plan/UI-SPEC demand SIX themes, which is not executable** — `index.css` defines six blocks, but the pre-paint script in `index.html` and `ThemeSwitcher.tsx` both hard-whitelist the same four (`cyan`, `emerald`, `readable`, `aubergine`). `amber` and the light `:root` are unreachable from the UI. Pre-existing from Phase 89. Separately confirmed `:root` is a LOAD-BEARING base layer, not a dead theme: 11 vars (`--glow-*`, `--info`, `--metric-*`, `--radius`) exist only there and every active theme inherits them. |
| 4 — D-04 live re-price | **NOT EXECUTED (premise absent)** | Requires an unpriced model to price; the live mix was fully priced at the time. Mechanism already proven arithmetically to 1e-9. |

### Defects found by the browser pass (all fixed or routed)

| # | Defect | Disposition |
|---|---|---|
| 1 | `WebhookStatusBadge` had its own local `relativeTime` doing `Date.now() - ts` (milliseconds) while `webhookDeliveredAt` is stored in seconds — rendered "Delivered 20645d ago", a 1970 date. | **FIXED** `1a136dc8`, mutation-tested (reverting reproduces the exact live string). |
| 2 | Analytics went fully blank on one query failure: `LlmAnalyticsPanel` was one of the few panels NOT in a `SectionErrorBoundary` (35 siblings were), so an unhandled `useQuery` throw unmounted the tree. 9 more bare panels shared the exposure, including Phase 104's own `CostTrendChart`. | **FIXED** `3b31c9f4` — all 10 wrapped. |
| 3 | `llm:providerBreakdown` is an unbounded 30-day `.collect()` over ~7 080 rows; `convex/llm.ts` is untouched by this phase, but Phase 104 added 5 readers to the same 10-query page and the combined load timed it out. | **BOUNDED** `3b31c9f4` (row cap + warn). Narrowing the window was tried and REVERTED as ineffective (7d still scanned 7 052 rows). Real fix = read the aggregates rollups → gap plan with CR-01. |
| 4 | `llm:costOverTime` and its `useCostOverTime` hook have ZERO consumers since 104-10 moved `CostTrendChart` onto `costDerived.costOverTime` — a second dead unbounded 30-day scan. | **DELETED** `aee665c0`, after confirming no references in `src/`, `convex/` or the astridr repo. |
| 5 | `costDerived.unpricedModels` names a priced model and counts zero-token models (see D-03 row). | **FIXED** `aee665c0`, verified live. |
| 6 | A **disabled** budget still rendered as an active cap: `getByScope` and `costForecast`'s inline read both ignored `enabled`, while `costBudgetEval` correctly skipped it — the UI asserted a cap was being watched that could never alert. Test fixtures had been masking it by omitting the REQUIRED `enabled` field. | **FIXED** `b26b22f4` (both read paths + fixtures), 4 tests, mutation-verified. |

Automated `<verify>` items for Task 3 both pass: `npm test` 3133 passed / 0 failed, `npm run build` clean.

**Defects found by this live gate that the green suite could not see:** 3 —
the convex deploy typecheck break (`e9ca3f9a`), the multi-paginate failure in both
`backfillTokenSplit` and the live `computeHourly` cron (`921517db`), and the test mock
that was more permissive than Convex (same commit). This is the gate earning its keep.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] Every **Manual-Only** row above executed and recorded — **all 5 PASS** (D-14, D-03 after its fix, A1, D-18, D-20), plus D-16 on a real fired alert, D-15 dedup, D-04's mechanism, and the honest-empty-state and theme rows. Nothing inferred from a green suite; 7 defects surfaced and 6 fixed in-session.
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** APPROVED for the VALIDATION CONTRACT (2026-08-03) — every Manual-Only row was executed against the running stack and recorded verbatim, and all now pass. 7 defects were surfaced by this gate that no green suite could see; 6 are fixed and deployed.

**CR-01 is now CLOSED** (was listed here as blocking; superseded 2026-08-03). It turned out to have
FOUR instances, not the two originally reported — `22a1733f` fixed `SDKSpendGuard` and
`CostForecastPanel`, and the phase verifier then caught that commit's own "the last two cost
surfaces" claim as false: `7e278003` additionally moved Analytics' **API Spend** MetricCard and
**LlmAnalyticsPanel**'s Model Breakdown money column onto the derived layer, and deleted a dead
second `costByPeriod` read. Measured live on the same 24h window, derived **$2.8136** vs legacy
**$2.4895** — the gauge had been under-reporting ~13%.

Scope of that closure, stated precisely: **every AGGREGATE spend surface** — the ones COST-01/02/03
actually target — now derives dollars from tokens × live rates. Three PRE-EXISTING per-call/per-trace
debug readouts still display the value the agent reported (`Analytics.tsx`'s Recent-LLM-Calls row,
`TraceWaterfall.tsx`, `chat/VitalsRail.tsx`). All three predate this phase (Phase 94 / the chat
command-center), none were touched by it, and none is an aggregate spend figure. Recorded as
informational, out of scope for D-01 here — not silently dropped.

**Remaining, and explicitly NOT blocking:** `llm:providerBreakdown` is bounded by a row cap
(`3b31c9f4`) rather than rewired onto the aggregates rollups. Its `cost` field is not displayed
anywhere (the Provider Comparison chart plots call counts), so it is a performance stopgap, not a
locked-decision violation — a phase-106 tech-debt candidate.
