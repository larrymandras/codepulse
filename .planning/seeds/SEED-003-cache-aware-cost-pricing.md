---
id: SEED-003
status: dormant
planted: 2026-08-07
planted_during: v14.0 Phase 108 (COST-01 side quest — daily-rollup gap + unpriced-model closure)
trigger_when: >
  Any time the cost surfaces need to be trusted as an absolute number rather than
  a relative trend — a budget/alert threshold tuned against real dollars, a
  spend-reduction decision (local vs API model routing), or reconciling CodePulse
  against an actual Anthropic invoice. NOT urgent while the surfaces are only
  used to compare periods against each other, since the error is directionally
  consistent.
scope: Medium
origin: >
  Measured live 2026-08-07 against the self-hosted backend while closing COST-01.
  Commits: 081a35be (period guard + daily backfill), 25d39c39 (rollup root cause),
  1fe02ad9 (three unpriced model rates), 1af87f28 (cacheStats bounded read),
  astridr-repo a4ab5861 (CMA cost/cache accumulation).
---

# SEED-003: Cache-aware cost pricing

## The problem

Every cost surface prices `promptTokens` only. `promptTokens` maps to Anthropic's
`input_tokens`, which **excludes** both cache streams. Anthropic bills three input
streams and CodePulse counts one:

| stream | billed at | priced today |
|---|---|---|
| `input_tokens` | 1.0x | yes |
| `cache_read_input_tokens` | 0.1x | **no** |
| `cache_creation_input_tokens` | 1.25x (5-min TTL) / 2.0x (1-hour TTL) | **no** |

Measured over 7 days (`llm:cacheStats`, windowHours 168, input side only):

| model | counted | cache read | cache write | uncounted |
|---|---|---|---|---|
| claude-sonnet-5 | $15.59 | $2.41 | $8.34 | $10.75 |
| claude-opus-4-8 | $0.00 | $0.05 | $0.97 | $1.02 |
| others | $0.24 | $0.08 | $0.74 | $0.82 |
| **total** | **$15.83** | | | **$12.58** |

**Input cost is billed at ~1.8x what CodePulse reports** ($28.42 vs $15.83 over 7d).
Extrapolated, ~$54/30d uncounted against a reported $85.25 — i.e. real spend is
plausibly ~$140/month, not ~$85. The 7-day figure is measured; the 30-day is an
extrapolation and should be re-measured, not trusted.

The overall ratio is healthy (3.14 read-tokens per written token against a
break-even of 0.28, ~65% saving on Sonnet), so this is a **measurement** gap, not
an efficiency problem. Do not let the size of the number imply the caching is
misconfigured.

## What to build

1. **Two new hourly metric types** — `tokens_cache_read` and `tokens_cache_creation`
   — in `computeHourly` (`convex/aggregates.ts`), filled from the SAME already-fetched
   `llmRows` as `insertTokenSplitBuckets`, same `{provider, model, billingType, goalId}`
   dimension key, same per-metric-type idempotency guard. The source fields
   (`cacheReadInputTokens` / `cacheCreationInputTokens`) are **already ingested** —
   `convex/runtimeIngest.ts:543-544`, `convex/schema.ts:322-323`. No emitter work needed.

2. **Wire the two dormant rate columns.** `cacheReadPerToken` / `cacheWritePerToken`
   already exist in `modelPricing` (`schema.ts:1631-1632`) and are read by **no code** —
   the schema comment says so explicitly. `resolveRate` / `priceTokens` /
   `deriveBucketDollars` in `convex/costDerived.ts` need to consume them.

3. **Seed cache rates.** Derive from each model's input rate rather than hand-entering
   a third and fourth number per model, so they cannot drift apart.

4. **Surface honestly.** `costBreakdown` should distinguish cached from uncached input,
   otherwise the jump in the reported total looks like a regression rather than a
   correction.

## Constraints and gotchas (learned the hard way, 2026-08-07)

- **Cache multipliers are NOT universal.** Anthropic is 0.1x read / 1.25x write. xAI's
  grok-4.5 is a 75% read discount (0.25x), Kimi K3 is 90% (0.1x), and grok doubles its
  base rate above a 200K-token request. Do not hardcode Anthropic's ratios globally —
  this is per-provider, and `grok-4.5`'s `notes` field already records its caveat.
- **`rollupDaily` needs no change.** It groups generically by
  `metric_type + JSON.stringify(dimensions)`, so new metric types roll into daily
  buckets automatically. There is an explicit "do not add a per-metric-type branch"
  comment on it — respect it.
- **Backfilling historical cache aggregates will recreate the daily-rollup gap.**
  Writing historical HOURLY rows for days that already passed is exactly what Phase
  104's `backfillTokenSplit` did, and it left the daily series reading 3.3x low for
  ~2 weeks. Two mitigations now exist and both should be used: `rollupDaily`'s nightly
  repair sweep (`repairDayTargets`, closes any gap within one sweep of the retention
  window) and `aggregates:backfillDailyRollup` for immediate repair (no longer latches
  — it resets on completion and is safe to re-run).
- **Self-hosted Convex rules apply.** Insert-only, batch-capped, no mass deletes, no
  new heavy cron. If extra work is needed on a schedule, append it to an
  already-running mutation behind its own try/catch (the D-14 precedent in
  `aggregates.ts`), never a new cron — three were disabled on 2026-07-14 for exactly
  this.
- **Any new `period` argument must go through `assertAggregatePeriod`**
  (`convex/lib/aggregatePeriod.ts`). An unrecognized period matches no rows and renders
  as a silent $0.
- **Three providers report no tokens at all** — `codex`, `antigravity`, `claude-sdk`
  (and `claude-cli` reports 36,137 prompt against **4** completion tokens across a
  month). Cache pricing will not help them; only the claude_cli gateway adapter ever
  sets token keys (`gateway/gateway/task_manager.py`, D-18). Their D-06 shadow rates
  are seeded and ready but starved of input — that is a separate seed's worth of work.

## Already done — do not redo

- `cacheStats` **exists and works** (`convex/llm.ts:73`) and is already rendered in
  `src/pages/Analytics.tsx:69` as a hit-rate tile + per-model table. Its unbounded
  `.collect()` was capped at 8000 with `truncated`/`cap` reported (`1af87f28`).
- The upstream emitter bug is fixed: CMA follow-up rounds were adding tokens without
  adding cost **or** cache counters (astridr `a4ab5861`), which is why the raw ingested
  cost metric read $48.75 against $85.25 derived. Any reconciliation done before that
  commit is invalid.
- All 682,491 previously-unpriced tokens are now priced (`1fe02ad9`); `unpricedTokens`
  reads 0.

## Known follow-up, deliberately not built

`cacheStats` now returns `truncated`/`cap` but **nothing renders it**. At current
volumes (727 rows/168h against a 8000 cap) it is always false. If ingest volume grows
past the cap, a truncation banner becomes necessary or the hit rate silently
under-reports — the same silent-undercount class this whole seed is about.
