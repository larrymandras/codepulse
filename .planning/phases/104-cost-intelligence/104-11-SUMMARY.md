---
phase: 104-cost-intelligence
plan: 11
subsystem: validation
tags: [live-validation, self-hosted-convex, cross-repo, deploy, honesty-guards]

# Dependency graph
requires:
  - phase: 104-01
    provides: "modelPricing table + seedDefaults (the rates every derived dollar resolves against)"
  - phase: 104-02
    provides: "gateway_task_completed -> llmMetrics ingest (D-18) and the CLI_GATEWAY_URL quota poller repoint (D-20)"
  - phase: 104-03
    provides: "tokens_prompt/tokens_completion hourly buckets + the resumable backfill"
  - phase: 104-04
    provides: "costBudgets persistence, UTC period helpers, seedFromLegacyCaps"
  - phase: 104-05
    provides: "costDerived.ts — the single tokens-to-dollars derivation"
  - phase: 104-06
    provides: "budget evaluator appended to computeHourly's tail (D-14)"
  - phase: 104-07
    provides: "Settings Cost & Budgets admin tab"
  - phase: 104-08
    provides: "cap-source consolidation onto costBudgets"
  - phase: 104-09
    provides: "CostBreakdownTable + UnpricedModelsNudge on Analytics"
  - phase: 104-10
    provides: "CostTrendChart Billed/Billed+Covered toggle"
provides:
  - ".planning/phases/104-cost-intelligence/104-VALIDATION.md — every Manual-Only row executed against the RUNNING stack and recorded verbatim; status: approved, nyquist_compliant: true"
  - "A deployed, seeded, backfilled self-hosted Convex backend (23 pricing rows, global daily budget, token-split history to the retention floor)"
  - "Nine defects found by live execution that a green unit suite could not see — eight fixed in-session"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Prove the deploy TARGET before any write: match `convex env list` names AND a data read against the explicitly-addressed local URL, per LESSONS 2026-07-17 (npx convex silently hitting the wrong backend)"
    - "Bound a repeated live migration with a scripted stop condition (3 consecutive monotonic memory climbs = the tombstone/index-rot signature) rather than eyeballing docker stats between calls"
    - "Record a manual-verification row that could not be executed as NOT EXECUTED, never as passing — and record the reason"
    - "When a mock is more permissive than the real runtime, fix the MOCK as part of the bug fix, or the same class of defect returns silently"

key-files:
  created:
    - src/lib/convexError.ts
    - src/lib/convexError.test.ts
    - convex/retention.test.ts
    - src/components/WebhookStatusBadge.test.tsx
  modified:
    - .planning/phases/104-cost-intelligence/104-VALIDATION.md
    - convex/tsconfig.json
    - convex/aggregates.ts
    - convex/costBudgetEval.ts
    - convex/costDerived.ts
    - convex/costBudgets.ts
    - convex/forecasts.ts
    - convex/llm.ts
    - convex/retention.ts
    - src/components/SDKSpendGuard.tsx
    - src/components/WebhookStatusBadge.tsx
    - src/components/ModelPricingAdmin.tsx
    - src/components/CostBudgetsAdmin.tsx
    - src/pages/Analytics.tsx
---

# Plan 104-11 — Live Validation Against the Running Stack

## What this plan was for

104-VALIDATION.md lists behaviours that a green unit suite is **explicitly not accepted as proof
of**. Two of the phase's decisions (D-18, D-20) exist because two telemetry pipes were verified
DEAD despite looking plumbed, and one (D-14) routes around a cron that passed review and then
starved ingest in production. None of that is settleable from vitest.

It paid for itself: **nine defects surfaced that 3,100+ passing tests could not see.**

## Outcome

`104-VALIDATION.md` is `status: approved`, `nyquist_compliant: true`, `wave_0_complete: true`.
Every Manual-Only row was executed against the running stack and recorded verbatim.

| Row | Verdict | Basis |
|-----|---------|-------|
| D-14 (evaluator inside the 15s syscall cap) | PASS | 3 runs at 1264/1254/1287 ms wall **including ~1 s npx startup** — ~250-290 ms server-side vs a 15 000 ms cap. Zero retry/backoff entries. Evaluator confirmed running via its own log line. |
| A1 (gateway → Ástríðr → Convex chain live) | PASS | `ASTRIDR_TELEMETRY_WEBHOOK_URL` set on the sidecar, read from the running container; no `.env` opened, no value printed. |
| D-18 (a real gateway turn lands an llmMetrics row) | PASS | One real turn returned `prompt_tokens 36137 / completion_tokens 4`; Convex went `{calls:0,tokens:0}` → `{calls:1,tokens:36141}` (exactly 36137+4). Raw row: `billingType: "subscription"`, `cost: 0` — a **true** $0, not fabricated. |
| D-20 (quota poller lands rows) | PASS | `/quota` reachable from INSIDE convex-backend (HTTP 200); `gatewayQuotaSnapshots` went `[]` → real rows. |
| D-03 (nudge reflects reality) | PASS after a fix | Failed first: it demanded a rate for `claude-cli`, which `costBreakdown` simultaneously reported `priced: true`. Fixed, then re-verified live (24h 4→0, 720h 6→3, each remaining model genuinely absent from the 23 rates AND carrying real tokens). |
| D-16 (no alert implies enforcement) | PASS | Read on a **real fired alert**: *"Global daily budget at 111% ($3.0629 of $2.7600) — projected to hit $2.7600 by ~08:03 PM."* Concrete figure and time, zero forbidden wording. |
| D-04 (a rate change re-prices history) | PASS (mechanism) | `billedUsd` equals `promptTokens × inputPerToken + completionTokens × outputPerToken` to within 1e-9 on all rows, proving read-time derivation. The rate-EDIT half needs a Clerk session the CLI has no identity for. |

Also executed: D-15 dedup (`fired:0, skippedDeduped:1`, still one row), the honest-empty-state row,
and a four-theme sweep.

## Deploy / seed / backfill log

Target proven to be `http://127.0.0.1:3210` before any write. `✔ No indexes are deleted by this
push` — the documented stop condition never triggered. `modelPricing:seedDefaults` inserted 23 rows.
`costBudgets:seedFromLegacyCaps` seeded the daily budget and **correctly refused** to invent a
monthly one. `backfillTokenSplit` reached `done: true` in **exactly 120 invocations** (720 h ÷ 6,
matching 104-03's prediction), memory flat at ~31.1 GiB throughout and **ending below its start** —
no tombstone growth. No command contained `--replace-all`; no bulk delete or patch was issued.

## Defects found by live execution (8 of 9 fixed)

| Commit | Defect |
|--------|--------|
| `e9ca3f9a` | `npx convex deploy` could not typecheck at all — 104-06 added the repo's only convex→src import while `convex/tsconfig.json` had no `paths` map. `tsc --noEmit` and vitest were both green because each resolves `@/` itself. Fixed properly, **not** with `--typecheck=disable`. |
| `921517db` | `backfillTokenSplit` failed on its FIRST live call: multiple paginated queries per invocation. Grepping the pattern found it again in the **live `computeHourly` cron** (pre-existing, Phase 88), latent only because one 500-row page had always covered one hour. Both fixed. The test mock had allowed unlimited `paginate()` calls — which is *why* 34 tests stayed green — so it now throws Convex's real error. |
| `527adc7f` | The budget-alert dedup read had no lower bound over `alerts`, a table `retention.ts` keeps forever — growing one row per fired period **inside `computeHourly`**, the one mutation D-14 protects. Range-bounded on `createdAt`. |
| `d9213c52` | Four admin handlers discarded `ConvexError.data` behind generic copy (Convex redacts plain `Error` to "Server Error"); and the delete-rate dialog promised past figures "stay as last computed" — the exact opposite of D-04. |
| `380f13d9` | `gatewayQuotaSnapshots` was absent from `RETENTION_DAYS`. Harmless while the poller was dead; D-20 revives it at ~288 rows/provider/day forever. Bounded at 30 days **before** it filled, so no mass delete is ever needed. |
| `1a136dc8` | `WebhookStatusBadge` had its own local `relativeTime` doing `Date.now() - ts` (ms) against a seconds timestamp → "Delivered 20645d ago", a 1970 date, on a webhook delivered seconds earlier. |
| `3b31c9f4` | One timing-out query blanked **all** of Analytics: `LlmAnalyticsPanel` was one of the few panels not inside a `SectionErrorBoundary` while 35 siblings were. 10 panels wrapped, including Phase 104's own `CostTrendChart`. |
| `aee665c0` | `unpricedModels` demanded rates for already-priced models: `priced: false` meant BOTH "no rate" and "no tokens". Added `unpricedReason`. Also deleted `llm:costOverTime` + its hook — a second unbounded 30-day scan with zero consumers since 104-10. |
| `b26b22f4` | A **disabled** budget still rendered as an active cap. `costBudgetEval` correctly skipped it, but `getByScope` and `costForecast`'s inline read ignored `enabled` — so the UI painted a gauge and an "On Track" badge against a threshold that could never alert. Test fixtures had masked it by omitting the REQUIRED `enabled` field. |
| `22a1733f` | **CR-01** — `SDKSpendGuard` and `CostForecastPanel` were the last surfaces reading the legacy pre-baked `cost` aggregate, against D-01. Measured live, same window: derived **$2.8136** vs legacy **$2.4895** — the gauge had been under-reporting ~13%. |

## Deviations

- **The plan's six-theme gate is not executable.** `index.css` defines six blocks, but
  `index.html`'s pre-paint script and `ThemeSwitcher.tsx` both hard-whitelist the same four, so
  `amber` and the light `:root` are unreachable from the UI (pre-existing, Phase 89). Executed as a
  four-theme sweep and recorded as such. Separately confirmed `:root` is a **load-bearing base
  layer** — 11 vars (`--glow-*`, `--info`, `--metric-*`, `--radius`) exist only there and every
  active theme inherits them — so it is not dead code.
- **D-04's live re-price step had no premise.** It asks for an unpriced model to price, but
  `unpricedModels` was legitimately `{count: 0}` at 24h — the seed covers the whole live model mix.
  Recorded as NOT EXECUTED (premise absent) with the mechanism proven arithmetically instead.
- **No merge to astridr `main`.** D-18 needed the gateway token-emit change live, but
  `feature/brain-swap` is **270 commits ahead** of main. The code was already in the checked-out
  tree, so this was a container rebuild, not a release. Verified by grepping INSIDE the containers
  (0 → 1/5/5/4 occurrences), never inferred from timestamps.
- **`llm:providerBreakdown` bounded, not rewired.** A row cap stops the unbounded growth; reading
  the aggregates rollups is the real fix and is deferred (see below). Narrowing its window 30d→7d
  was tried and **reverted** — 7 days still scanned 7 052 of 7 080 rows, so it bought nothing.

## Follow-ups

- **`llm:providerBreakdown` → aggregates rollups.** The `3b31c9f4` row cap is an explicit stopgap.
  Not a locked-decision violation, so it does not block this phase — a phase-106 tech-debt candidate.
- **Three other ms-based local `relativeTime` copies** (`InboxCard`, `RunHistorySelector`,
  `KGViewsPopover`) share the shape of the `1a136dc8` bug but are each fed a different `.timestamp`
  whose unit was not traced. Deliberately left alone rather than fixed on a guess; 14 of the repo's
  15 epoch-based copies are seconds-based and consistent with `src/lib/formatters.ts`.
- **`useLatencyOverTime` / `useSessionList`** are also orphaned hooks — out of scope here.
- **`forecasts.getBudgetConfig` / `setBudgetCap`** remain exported but deprecated with no caller in
  `src/`, `convex/` or astridr-repo. `setBudgetCap` still writes a key nothing enforces, so calling
  it is now a silent no-op — a clean deletion for phase 106.

## Operator notes

`CLI_GATEWAY_URL` is set to `http://astridr-cli-gateway:8200` on the deployment. No monthly budget
exists (none was invented — `seedFromLegacyCaps` refused, correctly), so `CostForecastPanel` shows
its honest "No monthly budget set." state until one is created in Settings → Cost & Budgets. The
astridr token-emit commit `9adb25b6` is live in the running containers but still **unmerged** on
`feature/brain-swap`; a future `docker compose up --build` from a different branch would silently
revert D-18.

---
*Phase: 104-cost-intelligence*
*Completed: 2026-08-03*

## Self-Check: PASSED

All created/modified files verified present on disk. Every commit hash cited above verified in
`git log --oneline --all`. `104-VALIDATION.md` frontmatter confirmed `status: approved`,
`nyquist_compliant: true`, `wave_0_complete: true`. Full suite 3152 passed / 0 failed; root and
convex typechecks clean; backend deployed with no index deletion.
