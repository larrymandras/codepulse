# Phase 121: Analytics Query Resilience - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-18
**Phase:** 121-analytics-query-resilience
**Areas discussed:** Resilience blast radius, Missing rollup dimensions, Dead queries' disposition, Honest degradation semantics

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Resilience blast radius | Criterion 1 targets three queries that are already wrapped — fix the real page-level vector or hold the literal wording? | ✓ |
| Missing rollup dimensions | Rollups have no call-count and no latency metric — add them, or drop the columns? | ✓ |
| Dead queries' disposition | `latencyOverTime` and `costByProvider` are live public unbounded endpoints with zero consumers. | ✓ |
| Honest degradation semantics | Missing/partial rollup buckets — silent smaller number, or an explicit stale/partial signal? | ✓ |

**User's choice:** all four.

---

## Resilience blast radius

### Q1 — What should "/analytics survives a failing query" actually cover?

| Option | Description | Selected |
|--------|-------------|----------|
| Fix the real vector | The ~10 hoisted `useQuery` calls at `Analytics.tsx:52-81` are in scope; strict superset of criterion 1. | ✓ |
| Literal roadmap scope | Only the three named queries; cheapest, but the route stays blankable by `subscriptionUsage` et al. | |
| Route-level boundary only | One boundary around the route — stops the white page, but one throw replaces every panel. | |
| Both: per-panel + route net | Push hooks down AND add a route backstop for non-query throws. | |

**Notes:** Selected before the alternatives were re-litigated. The rejected "literal scope" option
would have left the exact query that caused the 2026-08-11 incident (`llm.subscriptionUsage`)
unprotected. → D-01, D-03.

### Q2 — How should the page-level queries stop being able to unmount the route?

| Option | Description | Selected |
|--------|-------------|----------|
| Extract into wrapped children | Move each query into the component that renders its data; wrap in existing `SectionErrorBoundary`. No new dependency. | ✓ |
| Shared status-returning hook | `{data, status}` wrapper instead of throwing. Would need `convex-helpers` (not installed) or a hand-roll; feasibility on convex 1.42 unverified. | |
| Both, hook is the contract | Extract AND build the status hook as what children consume. | |
| You decide | Defer the mechanism to research/planning. | |

**Notes:** The dependency situation was measured before the options were offered — `package.json`
carries only `convex ^1.42.0`, and `src/` has no `useSafeQuery`/`useQueryWithStatus` equivalent.
→ D-02, and the deferred-idea entry for the status hook.

### Q3 — What counts as proof?

| Option | Description | Selected |
|--------|-------------|----------|
| Fault-injection + ratchet | Per-query throw tests, plus a ratchet that derives the query list from the page and fails on any unwrapped query. | ✓ |
| Fault-injection tests only | Proves today's fix; blind to the next hoisted query. | |
| Live browser check | Highest realism, attended, guards nothing afterwards. | |
| Ratchet + one live check | Durable guard plus one attended confirmation of appearance. | |

**Notes:** → D-04.

---

## Missing rollup dimensions

Opened with a measurement that shrank the area: only four fields from the two live queries are
actually rendered (`provider`, `calls` from `providerBreakdown`; `calls`, `tokens` from
`costByModel`). Tokens are already rolled up; call counts are not; latency is needed by nothing.

### Q1 — How do we get call counts?

| Option | Description | Selected |
|--------|-------------|----------|
| Add a `calls` metric | New `metric_type` in `computeHourly`, same `llmRows` loop and 4-segment key as cost/tokens, own idempotency guard. | ✓ |
| Drop the calls figures | Serve only what the rollups hold; model table loses its Calls column, bar chart switches to tokens. | |
| Hybrid: rollups + bounded raw read | Tokens from rollups, calls from a bounded raw read. Leaves a raw scan on the page. | |
| You decide | Defer to research/planning. | |

**Notes:** → D-05.

### Q2 — How do we handle the 30-day history?

| Option | Description | Selected |
|--------|-------------|----------|
| Cursor-paged backfill | Bounded insert-only idempotent `internalMutation` modeled on `backfillTokenSplit` / `backfillDailyRollup`. | ✓ |
| No backfill, accumulate forward | Zero migration risk; undercounts the Calls column for 30 days. | |
| Backfill, daily buckets only | Cheaper; leaves an hourly gap for any future hour-resolution consumer. | |
| You decide | Defer to research/planning. | |

**Notes:** The 4,096-READ ceiling (not the documented 16,000-write figure) was stated as the
binding constraint. → D-08.

### Q3 — What return shape should the migrated queries have?

| Option | Description | Selected |
|--------|-------------|----------|
| Trim to what renders | `providerBreakdown` → `{provider, calls}`; `costByModel` → `{calls, tokens}`. Removes the D-01-violating raw cost sum from public endpoints. | ✓ |
| Trim latency, keep cost | Keeps a dollar figure on an endpoint D-01 says must not be displayed. | |
| Preserve the full shape | Would require a latency rollup purely to serve a field nothing renders. | |
| You decide | Defer to research/planning. | |

**Notes:** Both are breaking shape changes; consumers in `src/` are known and small. → D-07.

---

## Dead queries' disposition

Framed with the tradeoff stated up front: deleting `latencyOverTime` means **amending** success
criterion 2 rather than satisfying it, and nothing outside this repo can be checked from here.

### Q1 — What happens to `latencyOverTime` and `costByProvider`?

| Option | Description | Selected |
|--------|-------------|----------|
| Delete both | Remove both queries and the unused `useLatencyOverTime` hook; amend criterion 2. | ✓ |
| Migrate latency anyway | Add a latency rollup and rewrite the query to keep criterion 2 literally true — for a chart with no consumer. | |
| Delete `costByProvider`, bound latency | Preserves a future latency data source; leaves a raw `llmMetrics` read on the route. | |
| Leave both, record only | Zero risk to unknown external callers; leaves two unbounded scans live. | |

**Notes:** → D-06, plus the criterion-2 amendment recorded in CONTEXT.md's premise corrections.

### Q2 — Are the scoped sibling unbounded collects in scope?

Preceded by a corpus-derived census of all `.collect()` reads over `llmMetrics` in `convex/` —
7 unbounded sites, with two the brief never mentioned (`analytics.ts:150`, `evalScores.ts:731`)
checked and found clean.

| Option | Description | Selected |
|--------|-------------|----------|
| Fix the asymmetry only | Bound `evalScores.ts:156` (which bounds its sibling `events` read at 200 but not `llmMetrics`); leave the two goal-scoped reads. | ✓ |
| Bound all three siblings | Fully closes the class; costs semantic verification on surfaces the phase never touches. | |
| Record the census, fix nothing | Keeps 121 tight; leaves a known unbounded read live. | |
| You decide | Defer to research/planning. | |

**Notes:** → D-09, and the census table in CONTEXT.md `<code_context>`.

---

## Honest degradation semantics

### Q1 — The current, not-yet-rolled-up hour

| Option | Description | Selected |
|--------|-------------|----------|
| Return an `asOf` + label it | No raw read; the number is exactly what the data says and the staleness is stated. Gives 122 a real `stale` signal. | ✓ |
| Top up from a bounded raw read | Exact to the minute; re-introduces the raw read this phase exists to remove. | |
| Sum the buckets, say nothing | Under 0.15% on a 30-day window, but a silent undercount on a cost/usage surface. | |
| You decide | Defer to research/planning. | |

**Notes:** → D-10.

### Q2 — A bucket missing mid-window

| Option | Description | Selected |
|--------|-------------|----------|
| Coverage descriptor | `{asOf, expectedBuckets, presentBuckets}`; cheap, machine-readable. Cannot distinguish a zero-activity hour from a missed cron. | ✓ |
| Coverage + cross-metric check | Disambiguates via other `metric_type` buckets; extra index read per gap and a rule 122 must explain. | |
| `asOf` only, no gap detection | Honest about time, silent about completeness. | |
| You decide | Defer to research/planning. | |

**Notes:** The stated limitation (a zero hour and a missed cron look identical in the `calls`
rollup) is carried into D-10 as a constraint on what the payload may claim.

### Q3 — How much rendering does 121 do?

| Option | Description | Selected |
|--------|-------------|----------|
| Payload + minimal label | Ship the payload and one `as of HH:MM` line; the six-state tile stays entirely in 122. | ✓ |
| Payload only, no UI | Tightest scope, but the surface stays as silent as today until 122 lands. | |
| Build a small state renderer | Honest states sooner, at the risk of 122 replacing it. | |
| You decide | Defer to planning. | |

**Notes:** → D-11.

---

## Claude's Discretion

No area was answered "you decide". Two questions were raised at the close and deliberately left to
planning:
- Whether `billingType` / `goalId` dimension segments are summed away or exposed by the migrated
  queries.
- Whether the `convex/` deploy and the D-08 backfill run attended or as a documented manual step.

## Deferred Ideas

- A latency chart on `/analytics` (needs a `latency` rollup; its own phase, not v15.0).
- A shared status-returning query hook — 122 builds it if TOKEN-04 needs it.
- Cross-metric gap disambiguation for the coverage descriptor.
- `SectionErrorBoundary`'s and `LlmAnalyticsPanel`'s off-token visuals → Phase 122.
- Bounding `aggregates.ts:965` / `:1032` — recorded in the census, judged fine as-is.
