---
id: TODO-unbounded-analytics-scans-timeout
status: pending
planted: 2026-08-18
planted_during: Phase 121 (Analytics Query Resilience) — surfaced during 121-07's live /analytics smoke check, which found three boundaries in their fallback state from real server-side query timeouts
trigger_when: Next Analytics- or Dashboard-touching phase, OR the next time an operator reports empty panels / "no data yet" on a page whose backend demonstrably holds data. Not a live outage on its own — Phase 121's boundaries contain it to the individual panels.
scope: Medium (one phase — per-query triage keyed on table row count, NOT a mechanical sweep of every .collect())
source: Observed live 2026-08-18 against the self-hosted backend; convex/analytics.ts, convex/metrics.ts
resolves_phase: 129
last_reviewed: 2026-08-27
---

# Unbounded `.collect()` scans time out at current data volume

## What was observed (evidence, 2026-08-18)

Four queries return `Server Error / Your request timed out performing too many system
operations` at current row counts. Three of them surfaced as boundary fallbacks on
`/analytics` during Phase 121's smoke check; the fourth was found from the CLI.

| Query | Where | How it failed |
|---|---|---|
| `analytics:activityHeatmap` | `convex/analytics.ts:17`, `.collect()` at `:27` | Rendered `Activity Heatmap failed to load`; console showed `SectionErrorBoundary [Activity Heatmap] caught: [CONVEX Q(analytics:activityHeatmap)] ... too many system operations` |
| `analytics:toolFlowSankey` | `convex/analytics.ts:35`, `.collect()` at `:49` | Rendered `Token Flow failed to load`, same console signature |
| `analytics:tokenSunburst` | `convex/analytics.ts:57`, `.collect()` at `:73` and `:79` | Rendered `Prompt Activity failed to load` |
| `metrics:dashboardSummary` | `convex/metrics.ts` | Timed out **from the CLI** (`npx convex run metrics:dashboardSummary '{}'`) with no browser involved — this is what proved the failure is server-side |

**Not a memory problem.** This was initially misdiagnosed as backend memory starvation
(`convex-backend` was at 19.19 GiB / 120.9% CPU). The operator approved a health-gated
restart via `convex-selfhost\restart-convex.ps1`, which reclaimed 15,652 MiB
(24,934 → 9,282 MiB, healthy after 45s) — and **both queries still timed out identically
afterwards**. The residual cause is per-query scan cost against the row counts these
tables now hold (`events` alone is over 155,000 rows), not the working-set climb.

## What this is NOT

- **Not a Phase 121 regression.** Proven by control: the Dashboard (`/`), which Phase 121
  never touched, showed the same degradation pattern — `SESSIONS 464` rendering while
  `MEMORY HIT RATE` / `DURABLE FACTS` / `ADVISOR SAVINGS` / `STARTUP TIME` showed `—` and
  Activity Pulse showed "No activity data yet". Cheap indexed queries succeed; expensive
  aggregating ones time out, on touched and untouched pages alike.
- **Not a 218-site mechanical sweep.** There are 218 non-comment `.collect()` sites across
  `convex/*.ts` (excluding tests) — `registry.ts` 30, `alerts.ts` 21, `aggregates.ts` 16,
  `skillCategories.ts` 15, `evalScores.ts` 11, `analytics.ts` 5, `metrics.ts` 3, and so on.
  **Most of those are almost certainly fine**: a `.collect()` over a small or
  index-range-bounded table is not a defect. Do not treat that 218 as a work list; it is
  the population to triage, and the triage key is the row count of the table being scanned.
- **Not urgent.** Phase 121's boundaries are why this presents as three empty panels rather
  than a blank route. That containment is working as designed.

## Same class, observed-adjacent but NOT verified failing

- `analytics:errorRateTrend` (`convex/analytics.ts:88`, `.collect()` at `:102`) — same file,
  same shape, was NOT seen failing. Verify before treating as broken.
- The other two non-comment `.collect()` sites in `convex/metrics.ts`.

## The fix pattern already exists in this repo

Phase 121 bounded exactly this class for four queries — use them as the analog rather than
inventing an approach:

- `llm:costByModel` / `llm:providerBreakdown` (`convex/llm.ts`) — moved onto the `aggregates`
  hourly rollups with `.order("desc").take(ROLLUP_READ_CAP)`, and they report `truncated` /
  `rowsRead` / `presentBuckets` / `expectedBuckets` in the payload plus a `console.warn` on a
  cap hit, rather than silently under-reporting. Measured live post-deploy: `rowsRead` 889
  (11% of the 8000 cap) and 1773 (22%) — cost now scales with bucket count, not call volume.
- `llm:cacheStats` — bounded with `.take(CACHE_STATS_READ_CAP)`.
- `evalScores` — read capped in the same phase.

## Traps recorded while diagnosing this

1. **A cap that bounds writes does not bound reads.** Convex mutations die on a **4,096-READ**
   limit, not the 16,000-write ceiling the docs and this repo's older comments both point at;
   `ctx.db.delete()` counts as a read. If several values of a cap all fail identically, the cap
   is not the cause — find the variable that discriminates.
2. **Reproduce from the CLI before blaming the frontend.** One `npx convex run` with no
   concurrency is what separated "server-side query cost" from "browser fires 30 subscriptions
   at once". CLAUDE.md's triage order (docker stats → soak-watch canary → only then frontend)
   is right, but add: also try the failing query from the CLI.
3. **A tile showing `0` where the query failed is a separate honesty bug** from the query cost.
   Several components do `useQuery(...) ?? {}`, so a failed query renders a confident zero
   rather than an unavailable state. Phase 122's TOKEN-04 six-state tile contract owns that;
   Phase 121 deliberately did not.

## Re-derivation (Phase 128, 2026-08-27)

Re-derived against live code per D-04. `.planning/REQUIREMENTS.md`'s RECON-01 bullet lists
"unbounded analytics scans" among eight items it calls already-fixed — that framing is WRONG as
a blanket statement, though most of the underlying work genuinely is done.

Three of the four queries this todo names ARE fixed: `analytics:activityHeatmap`
(`convex/analytics.ts:17-33`), `analytics:toolFlowSankey` (`:35-55`) and `analytics:tokenSunburst`
(`:57-86`) now read the `aggregates` rollup table via
`.withIndex("by_type_period_bucket", (q) => q.eq("metric_type", ...).eq("period", "hourly").gte("bucket_start", cutoff)).collect()`
— bounded by an index range, not a post-read `.filter()`. `analytics:errorRateTrend`
(`:88-109`, this todo's own "observed-adjacent, not verified failing" fifth query) is bounded
the same way. This matches Phase 121's own closing record (`STATE.md`'s Phase 121 entry,
AR-01..03) — that work landed before this phase started.

The fourth named query, `metrics:dashboardSummary`, is **still fully unbounded**:
`convex/metrics.ts:19` reads `const events = await ctx.db.query("events").collect();` — no
`.withIndex()` range, no `.take()` — and `:24` does the identical thing to `discoveredTools`
(`const tools = await ctx.db.query("discoveredTools").collect();`). This is a live, unfixed
defect, and it matches `.planning/REQUIREMENTS.md`'s FIX-01 verbatim (FIX-01 records this exact
`convex/metrics.ts:19` finding, dated "Found 2026-08-27", assigned to Phase 129).

**Verdict: PARTIALLY FIXED — keep, scope narrowed.** This todo stays open, narrowed to
`convex/metrics.ts:19` and `:24` alone (`metrics:dashboardSummary`'s two unbounded reads) —
`analytics.ts`'s four queries no longer need triage. `resolves_phase` is unchanged at 129,
which was already correct (this todo was never one of the four folded-as-fixed items in
`128-CONTEXT.md`; it was included in this plan specifically because of the RECON-01/FIX-01
contradiction). Full ledger: `.planning/phases/128-planning-reconciliation/128-TODO-CLOSURES.md`.
