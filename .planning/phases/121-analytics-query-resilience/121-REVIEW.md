---
phase: 121-analytics-query-resilience
reviewed: 2026-08-18T00:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - convex/aggregates.test.ts
  - convex/aggregates.ts
  - convex/evalScores.ts
  - convex/lib/fakeCtx.ts
  - convex/llm.test.ts
  - convex/llm.ts
  - src/components/LlmAnalyticsPanel.test.tsx
  - src/components/LlmAnalyticsPanel.tsx
  - src/components/analytics/AdvisorStrategyPanel.tsx
  - src/components/analytics/ApiSpendCard.tsx
  - src/components/analytics/CacheHitRateCard.tsx
  - src/components/analytics/ExecutionDepthPanel.tsx
  - src/components/analytics/LlmVolumeCards.tsx
  - src/components/analytics/PromptCachePanel.tsx
  - src/components/analytics/RecentLlmCallsPanel.tsx
  - src/components/analytics/TotalEventsCard.tsx
  - src/components/control-center/LlmStatusPanel.tsx
  - src/hooks/useAnalytics.ts
  - src/pages/Analytics.structuralGuard.test.ts
  - src/pages/Analytics.test.tsx
  - src/pages/Analytics.tsx
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 121: Code Review Report

**Reviewed:** 2026-08-18
**Depth:** standard
**Files Reviewed:** 21 (`convex/_generated/api.d.ts` excluded — generated, 2-line codegen output)
**Status:** clean

## Summary

Phase 121 (a) pushed ten page-level `useQuery` calls out of `Analytics()`'s body into eight new
self-fetching, boundary-wrapped components, (b) migrated `costByModel`/`providerBreakdown` off raw
`llmMetrics` scans onto new `aggregates` rollups (adding a `calls` metric type), (c) deleted the
two dead unbounded endpoints (`costByProvider`, `latencyOverTime`) and their hook, and (d) bounded
one previously-unbounded read in `evalScores.ts`. No bugs, security issues, or quality defects were
found in the changed files.

Specific checks run, per the team lead's request:

- **Fidelity of the eight relocated components.** Diffed each of `TotalEventsCard`,
  `LlmVolumeCards`, `CacheHitRateCard`, `ApiSpendCard`, `PromptCachePanel`, `RecentLlmCallsPanel`,
  `ExecutionDepthPanel`, `AdvisorStrategyPanel` against the pre-move `Analytics.tsx`
  (`git show 0837b1c3~1:src/pages/Analytics.tsx`). Seven are byte-for-byte behavioral matches —
  same markup, same query args, same fallback strings. The eighth (`LlmVolumeCards`) has one
  disclosed behavior change: it now opens its own `usePaginatedQuery(api.llm.recentCallsPaginated)`
  instead of sharing the page's single subscription, so its "LLM Calls"/"Total Tokens" counts no
  longer grow when the separate Recent LLM Calls table's "Load more" is clicked. This is stated in
  the component's own docstring (`src/components/analytics/LlmVolumeCards.tsx:10-15`), does not
  change correctness (both before and after, the figure counts loaded rows, never a true 30-day
  total), and is a resource/performance question (duplicate subscription) rather than a
  correctness or security one — out of this review's stated scope.

- **`asOf` derivation and dimension-summing in `convex/llm.ts`.** `costByModel`'s `asOf` takes
  `Math.min(callsAsOf, tokensAsOf)` with correct null-handling on either side
  (`convex/llm.ts:309-316`) — verified against `by_type_period_bucket`'s index shape
  (`convex/schema.ts:976`, `[metric_type, period, bucket_start]`), so `.order("desc")` on that index
  with `metric_type`/`period` pinned by `.eq()` genuinely sorts by `bucket_start` descending, and
  `rows[0]` is the newest bucket. `convex/llm.test.ts:369-537` seeds calls/tokens with deliberately
  different newest buckets and asserts the older one wins — this test would fail if the ordering
  were `"asc"` instead of `"desc"` (traced through `fakeCtx.ts`'s reverse-on-desc semantics), so it
  is not a vacuous check.

- **`.order("desc").take(ROLLUP_READ_CAP)` truncation semantics.** `truncated = rows.length >= CAP`
  is correct: `.take(N)` only returns fewer than `N` rows when genuinely exhausted, so a
  sub-cap-length result can never hide a silent undercount. A cap hit drops the *oldest* end of the
  window (matches the code's own claim) and is always accompanied by `truncated: true` — verified
  no code path returns a short read without also flagging it.

- **Read-limit hazard in `convex/aggregates.ts`'s backfill (per the team lead's flag).**
  `backfillTokenSplit`'s per-invocation loop (`maxHours` default 6) times `LLM_WINDOW_READ_CAP`
  (4000) gives a theoretical worst-case read volume above the 4,096-read mutation ceiling if
  traffic ever approached the per-hour cap in more than one hour of a single invocation. This loop
  shape and both constants predate Phase 121 (Phase 104) and are unchanged by it; 121 only removed
  the cursor's terminal "done" latch (D-08) and added a third metric type to the same per-hour
  insert batch (D-05, `convex/aggregates.ts:56-124`), which increases per-hour insert volume only
  marginally. `121-DEPLOY-EVIDENCE.md:211-258` records the live backfill run — 120 consecutive
  `maxHours: 6` invocations, `truncatedHours: []` on every one, `rowsInserted` in the single/low
  double digits per invocation (measured 13-row batches) — consistent with the ~7 rows/hour
  production volume documented elsewhere in the same file (`convex/llm.ts:447`). Not reported as a
  finding: not introduced by this phase, and not observed to trigger at 100x+ margin from today's
  volume. Noted here so it isn't re-discovered as new.

- **Deletion completeness (D-06).** `git grep` for `costByProvider`, `latencyOverTime`, and
  `useLatencyOverTime` across all `.ts`/`.tsx` files returns zero hits outside `.planning/` —
  the deletion left no dangling import, call site, or doc reference. The one place that *named*
  `costByProvider` in prose (`LlmStatusPanel.tsx`'s docstring) was corrected in the same phase
  (see diff at commit `82005161`).

- **Structural ratchet (`Analytics.structuralGuard.test.ts`) and fault-injection suite
  (`Analytics.test.tsx`).** Both read as designed: the ratchet derives its checks from the AST
  (no enumerated query-name list), resolves aliased/default imports before comparing tag identity,
  and its own mutation tests first assert the synthetic mutation is syntactically valid
  (`ts.transpileModule(...).diagnostics` empty) before asserting the ratchet fires — closing the
  exact "collection error masquerading as a passing guard" failure mode D-04 calls out. The
  fault-injection suite asserts on rendered sibling content (never a `hasError`/"no exception"
  proxy), uses `importOriginal` so seven-of-eight real components render genuinely, and each of the
  eight cases independently asserts `getAllByText(/failed to load/i)).toHaveLength(1)` (no
  cascading/masking).

## What I dropped and why

- The `LlmVolumeCards` duplicate-subscription behavior change (above): real and disclosed, but a
  resource-usage question, not a correctness or security defect — out of this review's scope
  (performance is explicitly excluded per the project's v1 review policy), and already documented
  in-repo so it will not surprise a future reader.
- The `backfillTokenSplit` theoretical read-ceiling hazard (above): plausible on paper but not
  introduced by this phase, not observed in live evidence, and would require roughly two orders of
  magnitude more traffic than measured to matter. Recorded in the Summary rather than as a Warning
  finding since I could not substantiate that it is live or that this phase made it worse in any
  way that matters.
- No other candidate findings reached the confidence bar for inclusion. I did not find evidence of
  incorrect rollup math, a fidelity regression in any relocated component, a test that cannot fail,
  a dangling reference to a deleted endpoint, or a security issue in any reviewed file.

---

_Reviewed: 2026-08-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
