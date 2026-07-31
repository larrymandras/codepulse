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
| D-03: the "N models need rates" nudge reflects reality on day one | COST-01 | **PASS** | `unpricedModels` returns `count: 0`. Verified ACCURATE rather than trusted: every row in `costBreakdown` reports `priced: true, pricedVia: "model"`, and `unpricedTokenTotal: 0`, so the live model mix is genuinely fully priced by the 23-row seed. |
| D-04: adding a rate re-prices existing charts with no rollup re-run | COST-01 | **PASS (mechanism)** / write path NOT EXECUTED | Proved arithmetically against live data: for all 5 breakdown rows, `billedUsd` equals `promptTokens x inputPerToken + completionTokens x outputPerToken` to within 1e-9 (e.g. `claude-opus-4-8` 620201/23875 gives $3.6978800 expected and actual). Dollars are therefore recomputed from the live `modelPricing` table at read time, not read from stored `llmMetrics.cost`. The rate-EDIT half needs a signed-in Clerk session (`modelPricing:update` sits behind `ctx.auth.getUserIdentity()` and the CLI has no identity), so it was not exercised. |
| D-16: no budget alert names or performs an enforcement action | COST-03 | **NOT EXERCISED** (not a pass) | No alert fired during verification, so the forbidden-word guard was never exercised against a real message. The non-fire is CORRECT, independently verified: UTC-day billed spend was $3.0471 against the $4.00 warn line, projecting to $4.2784 against the $5.00 limit, so both the spend axis and D-13's spike branch correctly return null. (The $4.88 24 h figure spans two UTC days.) Guard remains unit-tested only. |
| A1: the gateway to Astridr to Convex forwarding chain is live at all | COST-01 | **PASS** | `ASTRIDR_TELEMETRY_WEBHOOK_URL` is SET on the `astridr-cli-gateway` container, pointing at `http://astridr:8181/<path>` (read from the running container's environment; no `.env` file was opened and no value printed). The chain was then proven end-to-end by D-18 below. |
| D-18: a real gateway turn produces a real `llmMetrics` row | COST-01 | **PASS** | **Required a deploy first:** both `astridr-cli-gateway` and `astridr-agent` were running code that PREDATED `9adb25b6` — verified by grepping inside the containers (0 occurrences of `prompt_tokens` in all four gateway files, 0 `promptTokens` in `web.py`), not inferred from timestamps. No merge to `main` was needed or performed (`feature/brain-swap` is 270 commits ahead; the code was already in the checked-out tree). Rebuilt both via `docker compose --profile prod up -d --build astridr cli-gateway`; post-rebuild greps show 1/5/5/4 and 1. Then submitted ONE real turn (`POST /tasks`, `provider: claude-cli`, `max_turns: 1`, prompt "Reply with exactly the two characters: OK"); the gateway key never left the container. Task completed in 5.5 s returning `prompt_tokens: 36137, completion_tokens: 4` — so the adapter's usage extraction works. Convex then went from the captured baseline `{calls: 0, tokens: 0}` to **`{calls: 1, tokens: 36141}`** (= 36137 + 4 exactly), and `claude-cli` appeared in `llm:providerBreakdown` with `calls=1, cost=0`. Raw `llmMetrics` row inspected directly: `billingType: "subscription"`, `cost: 0` (a true $0, not fabricated), `promptTokens: 36137`, `completionTokens: 4`, `totalTokens: 36141`, `model: "claude-cli"` (the opaque provider id, per D-06's only viable branch — and it matches the seeded D-06 shadow row, so it shadow-prices to `coveredUsd`). |
| D-20: the repaired quota poller actually lands rows | COST-02 | **PASS** | `/quota` confirmed reachable FROM INSIDE `convex-backend` (both `astridr-cli-gateway:8200` and `cli-gateway:8200` return HTTP 200; the two containers share `astridr-network`), and the sidecar serves it unauthenticated. Set `CLI_GATEWAY_URL=http://astridr-cli-gateway:8200` on the deployment, then triggered `gatewayQuota:pollAndStore` rather than waiting for the 5-minute cron. `gatewayQuota:latestByProvider` went from the captured baseline `[]` to **real rows** — including `claude-cli` and `claude-cli-consulting`, each `billingType: subscription`, `dailyLimit: 200`, `remainingPct: 1`, `usedToday: 0`. Note the 30-day retention bound added in `380f13d9` landed BEFORE this table started filling. |

### Still outstanding — require a signed-in browser (2026-07-31)

Every `costBudgets` / `modelPricing` WRITE sits behind `ctx.auth.getUserIdentity()`, and the Convex
CLI carries no user identity, so these cannot be driven from the terminal. The Chrome extension was
not connected during this run, so they were not attempted rather than faked.

| Plan 104-11 Task 3 step | What it needs | Status |
|---|---|---|
| 2 — COST-03 end to end | Create a `Global`/`Daily` budget just under today's billed spend in Settings → Cost & Budgets, trigger `computeHourly`, then confirm an alert row with source `cost-budget:{id}:{level}`, that `webhookStatus` moved off `pending` (delivery ran, not just an insert), that a SECOND trigger fires nothing (D-15 dedup), and read the message aloud to confirm D-16 (no enforcement wording). Delete the temp budget after. | **NOT EXECUTED** |
| 4 — D-04 live re-price | As written it wants an unpriced model, but `unpricedModels` is legitimately `{count: 0}` — the seed covers the whole live mix, so there is nothing unpriced to price. Equivalent check: EDIT an existing rate and confirm the breakdown re-prices with no rollup re-run. (The mechanism is already proven arithmetically above.) | **NOT EXECUTED** (premise absent) |
| 5 — honest empty states | Disable (not delete) the global daily budget and confirm `SDKSpendGuard` renders its no-budget copy with NO gauge bar and no `$5` figure. Re-enable. | **NOT EXECUTED** |
| 6 — six-theme coverage | Cycle `cyan`/`emerald`/`readable`/`aubergine` + light across Analytics and Settings → Cost & Budgets, confirming the nudge, breakdown table, chart toggle, both admin panels and the rewired gauge/forecast repaint with no invisible text or stuck colour. | **NOT EXECUTED** |
| D-18 covered-vs-billed on screen | The gateway turn landed at 19:13:07 UTC (from the row's own `_creationTime`), so its bucket is the 19:00Z hour — incomplete at time of writing; `computeHourly` only rolls up the last COMPLETE hour, so the shadow-priced `coveredUsd` cannot appear until after 20:00 UTC. The hourly cron will do this unattended. Re-check with `npx convex run costDerived:costBreakdown '{"period":"hourly","lookbackHours":3}'` and confirm the `claude-cli` row shows `coveredUsd` populated and `billedUsd` zero. | **PENDING ROLLUP** |

Automated `<verify>` items for Task 3 both pass: `npm test` 3133 passed / 0 failed, `npm run build` clean.

**Defects found by this live gate that the green suite could not see:** 3 —
the convex deploy typecheck break (`e9ca3f9a`), the multi-paginate failure in both
`backfillTokenSplit` and the live `computeHourly` cron (`921517db`), and the test mock
that was more permissive than Convex (same commit). This is the gate earning its keep.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [~] Every **Manual-Only** row above executed and recorded — **6 of 7 PASS** (D-14, D-03, A1, D-18, D-20, plus D-04's mechanism); D-16 remains NOT EXERCISED and four browser-only Task 3 steps are NOT EXECUTED. All recorded verbatim, none inferred from a green suite
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** partial (updated 2026-07-31 after the live run) — Task 1 (deploy/seed/backfill) complete and recorded; D-18/D-20/A1 deferred
with explicit blockers, so `nyquist_compliant` stays false and Phase 104 stays OPEN.
