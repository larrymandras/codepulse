# Phase 121: Analytics Query Resilience - Context

**Gathered:** 2026-08-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 121 makes `/analytics` **structurally unable to be blanked by a single failing query**, and
moves the LLM cost/usage figures it renders off raw `llmMetrics` scans and onto the durable
`aggregates` rollups. It is a **data-layer and query-boundary phase**, not a visual one.

It is a hard prerequisite for Phase 122's TOKEN-04 six-state metric tile: a tile cannot render an
honest `unavailable` state if an unhandled `useQuery` throw unmounts the React tree before it renders.

**In scope:** DEBT-08.

**Explicitly NOT in scope (belongs to later phases, do not pull forward):**
- The six-state metric-tile primitive itself → **TOKEN-04, Phase 122**
- `SectionErrorBoundary`'s off-token visuals (hardcoded `bg-gray-800/50`, `border-red-500/30`,
  `text-gray-300`) → **TOKEN-01/02, Phase 122**
- `LlmAnalyticsPanel`'s own hardcoded panel chrome and table colours → **Phase 122**
- Any new latency chart or surface → not in this milestone at all
- Restructuring `/analytics`' grid or page header → **TOKEN-05 / SHELL-01, Phases 122/124**

</domain>

<premise_corrections>
## Premise Corrections — read before planning

Four load-bearing premises in the ROADMAP entry, `REQUIREMENTS.md:74`, and
`.planning/todos/pending/llm-analytics-rollup-migration-cr01.md` were measured against the live
code on 2026-08-18 and do not hold. **Plan against the corrections, not the source text.**

**PC-1 — The three named queries are already boundary-protected. The blanking vector is elsewhere.**
`LlmAnalyticsPanel` (owner of both `costByModel` and `providerBreakdown`) sits inside
`SectionErrorBoundary name="LLM Analytics"` — `src/pages/Analytics.tsx:336`, added by the
2026-08-01 fix and annotated in place at `:329-334`. Success criterion 1, as literally written,
plausibly already passes. What is **not** protected is roughly ten `useQuery` calls hoisted into
the `Analytics()` page component body at `src/pages/Analytics.tsx:52-81` — `useRecentEvents`,
`useLlmMetrics`, `costDerived.billedOverTime`, `llm.subscriptionUsage`, `llm.cacheStats`,
`aggregates.eventCountsByPeriod`, `anomalyDetection.getActiveAnomalies`, and three
`advisorEvents.*` reads. Those execute **above every boundary on the page**; a throw in any one
of them unmounts the whole route. `llm.subscriptionUsage` — the query that actually caused the
2026-08-11 incident — is one of them.

**PC-2 — `latencyOverTime` has zero consumers.** `useLatencyOverTime` is declared at
`src/hooks/useAnalytics.ts:4-6` and imported nowhere. Control, same file: `useCapabilityGrowth`
resolves to a real consumer at `src/components/CapabilityGrowthChart.tsx:2,6`, so the search
discriminates. The todo brief records it as "live — `useAnalytics.ts:5`"; that line is the hook
body, not a call site. `api.llm.latencyOverTime` is never mounted by the app. This is the same
class as `costByProvider`, which the brief already flags as dead.

**PC-3 — The `aggregates` rollups do not hold the data these queries need.** Every `metric_type`
string written anywhere in `convex/` is: `cost`, `tokens`, `tokens_prompt`, `tokens_completion`,
`tool_calls`, `events`, `sankey_edge`. There is **no call-count metric and no latency metric**.
"Move onto the rollups" is therefore not a mechanical rewrite — it requires a new metric type in
`computeHourly` plus a backfill, or changed surface semantics.

**PC-4 — Only four fields from the two live queries are actually rendered.**
`providerBreakdown` feeds `p.provider` and `p.calls` into the bar chart
(`src/components/LlmAnalyticsPanel.tsx:59-61`); its `avgLatency` and `cost` are computed,
returned, and rendered **nowhere**. `costByModel` feeds `calls` and `tokens` into the model table
(`:41-47`); its `cost` field is dead too, because the money column comes from
`costDerived.costBreakdown` (`:23-38`) under the Phase 104 D-01 rule that the raw
`llmMetrics.cost` sum is stored but is not the displayed truth (it measured ~13% low).
Net: the only rollup data the surface needs is **call counts and token sums, per provider and per
model, over 30 days**. Tokens already exist as a rollup. Calls do not.

**Consequence for success criterion 2.** Criterion 2 requires all three of `costByModel`,
`latencyOverTime`, and `providerBreakdown` to read the rollups. Per D-06 below, `latencyOverTime`
is being **deleted** rather than migrated. Criterion 2 must be amended in `ROADMAP.md` to record
that, and phase verification must not read the deletion as an unmet criterion.

</premise_corrections>

<decisions>
## Implementation Decisions

### Resilience blast radius (success criterion 1)

- **D-01: The hoisted page-level queries are in scope; criterion 1's three named queries are a
  subset.** `src/pages/Analytics.tsx:52-81` is the actual blanking vector (PC-1). Fixing it is a
  strict superset of criterion 1, which then passes by construction. Fixing only the three named
  queries was explicitly rejected: it leaves the route blankable by `subscriptionUsage`,
  `cacheStats`, `getActiveAnomalies` or any `advisorEvents` read — including the exact query that
  caused the incident this phase exists to close.

- **D-02: Push queries down into boundary-wrapped children. Do not build a status-returning
  query hook in this phase.** Move each hoisted query into the component that renders its data,
  then wrap that component in the existing `SectionErrorBoundary` — the pattern 35+ sections on
  this page already use. **No new dependency:** `convex-helpers` (which ships
  `makeUseQueryWithStatus`) is NOT installed; `package.json` carries only `convex ^1.42.0`, and
  no `useSafeQuery`/`useQueryWithStatus` equivalent exists anywhere in `src/`. A hand-rolled
  status wrapper was considered and deferred — if Phase 122's TOKEN-04 needs one, it builds it.

- **D-03: A route-level `ErrorBoundary` is NOT the fix and must not be substituted for D-02.**
  It stops the blank white page but replaces the entire route with one error card, taking every
  healthy panel with it. It may be added as an additional backstop if planning finds a render-time
  (non-query) throw path, but never instead of D-02.

- **D-04: Proof is fault-injection tests PLUS a structural ratchet.** Per query: force exactly
  one to throw and assert every sibling still renders. Then a ratchet that **derives the query
  list from the page itself** and fails if any query sits outside a boundary — an enumerated
  by-name test only ratifies today's fixes and is structurally blind to the next query someone
  hoists back into the page body. Mutation-test the ratchet with a **synthetic new** hoisted query,
  not just by reverting a known fix; the mutation must be syntactically valid, or a collection
  error masquerades as a passing guard.

### Rollup migration (success criterion 2)

- **D-05: Add `metric_type: "calls"` to `computeHourly`.** Accumulate it in the **same `llmRows`
  loop** that already produces `cost` and `tokens` (`convex/aggregates.ts:265-330`), using the
  identical 4-segment dimension key `provider::model::billingType::goalId` with the same
  `?? "unknown"` / `?? "api"` / `?? ""` defaults, behind its **own** per-dimension-key idempotency
  guard. A shared guard across metric types lets a partially-completed run double-count one metric
  while correctly skipping another — the reason `insertTokenSplitBuckets` already keeps
  `tokens_prompt` and `tokens_completion` guards separate. Insert-only; never patch or delete.

- **D-06: Delete `latencyOverTime` and `costByProvider`, and the unused `useLatencyOverTime`
  hook.** Both are public, externally-callable, unbounded 30-day `.collect()` endpoints
  (`convex/llm.ts:313` and `:218`) with zero UI consumers (PC-2). Deleting them removes two
  instances of the exact scan class that caused the 2026-08-11 timeout and closes the todo brief's
  own open question ("either delete it or fold it into the rollup migration"). No latency rollup
  is added — building one to serve a chart nobody renders was explicitly rejected. **Known
  limitation:** nothing outside this repo can be checked from here; the verified claim is only
  that nothing in `src/` calls either endpoint. Planning should decide whether to stage this as
  deprecate-then-delete if it judges an external caller plausible.

- **D-07: Trim both migrated queries to the fields that render.** `providerBreakdown` returns
  `{provider, calls}`; `costByModel` returns `{calls, tokens}` per model. This removes the raw
  `llmMetrics.cost` sum from a public endpoint entirely — the figure Phase 104's D-01 forbids
  displaying. Both are breaking shape changes; the consumers in `src/` are known, small, and named
  in `<code_context>`. Update `src/components/LlmAnalyticsPanel.test.tsx` fixtures accordingly.

- **D-08: The 30-day history gets a cursor-paged backfill.** A bounded `internalMutation`
  modeled on the existing `backfillTokenSplit` (`convex/aggregates.ts:765`) and
  `backfillDailyRollup` (`:627`): insert-only, per-dimension-key idempotent so a re-run cannot
  double-count, and **batch-capped well under the 4,096-READ ceiling** — on this self-hosted
  instance `ctx.db.delete()` counts as a read, and a query issued after N inserts in the same
  mutation costs roughly N extra reads, so an insert-then-query loop cannot work at any cap. Do
  not rely on the documented 16,000-write figure. "Accumulate forward, no backfill" was rejected:
  it undercounts the Calls column for 30 days, which is the silent undercount the surface's own
  `console.warn` at `convex/llm.ts:288-292` exists to refuse.

- **D-09: Bound `evalScores.ts:156`'s `llmMetrics` read; leave the two goal-scoped
  `aggregates` reads alone.** `evalScores.ts:156` bounds its **sibling** `events` read at
  `.take(200)` in the same function while leaving `llmMetrics` unbounded — an asymmetry the todo
  brief calls unintentional. `aggregates.ts:965` (`costByGoalPeriod`) and `:1032` (`llmByGoal`)
  are single-`goalId` reads and stay as they are. The full 7-site census is in `<code_context>`;
  every site left alone is recorded there with its reason.

### Honest degradation (feeds Phase 122 TOKEN-04)

- **D-10: Rollup queries return an `asOf` and a coverage descriptor.** `asOf` is the newest
  `bucket_start` actually summed; the coverage descriptor is `{expectedBuckets, presentBuckets}`,
  cheap because the buckets are already read. Hourly rollups mean the most recent up-to-60 minutes
  is permanently absent — that is stated, never hidden, and never topped up from a raw read (a
  bounded raw top-up was considered and rejected: it re-introduces the read this phase exists to
  remove). **Honest limit that must be carried into the payload's own docstring and into 122:** in
  the `calls` rollup a zero-activity hour is indistinguishable from a missed cron run, so
  `presentBuckets` means "hours with data" and nothing stronger. Cross-metric disambiguation
  (checking whether any other `metric_type` has a bucket for that hour) was considered and
  deferred.

- **D-11: 121 ships the payload plus one minimal `as of HH:MM` label. The tile primitive stays
  in Phase 122.** Enough that no stale number renders uncaveated between 121 and 122, without
  pre-empting TOKEN-04's six-state contract. Do not build a shared stale/partial/unavailable
  component here — that shape is 122's charter.

### Claude's Discretion

No area was answered "you decide". Two questions were raised and deliberately not asked, and
planning may settle them:
- Whether the `billingType` / `goalId` dimension segments are summed away or exposed by the
  migrated queries (the rendered surface needs neither).
- Whether the deploy of these `convex/` changes and the D-08 backfill run is attended or left as
  a documented manual step.

### Folded Todos

- **`llm-analytics-rollup-migration-cr01.md`** (id `TODO-llm-analytics-rollup-cr01`, planted
  2026-08-11 during Phase 110, `resolves_phase: 121`) — folded whole. Its `trigger_when` has
  fired by its own terms. Its factual core stands (this is a **latency/load** problem, not
  runaway growth; the 30-day `llmMetrics` window measured 5,274 rows, *down* from ~7,080; the
  `by_timestamp` `gte`-bound ordering trap is real and load-bearing). Corrections to it are
  PC-2 and PC-4 above. Its "lower-priority siblings" list is superseded by the corpus-derived
  7-site census in `<code_context>`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and the originating brief
- `.planning/todos/pending/llm-analytics-rollup-migration-cr01.md` — the full DEBT-08 brief:
  the 2026-08-11 incident, the measured row counts, the "what this is NOT" correction, the
  `by_timestamp` ordering trap, and the dead-`costByProvider` note. Read it — but read PC-2 and
  PC-4 above first, which correct two of its claims.
- `.planning/REQUIREMENTS.md:74` — DEBT-08's text and its prerequisite relationship to TOKEN-04.
- `.planning/ROADMAP.md:730-745` — Phase 121's goal and three success criteria. **Criterion 2
  needs amending per D-06** (`latencyOverTime` is deleted, not migrated).
- `.planning/ROADMAP.md:748` — Phase 122's dependency on this phase.

### Rules that constrain this phase
- `CLAUDE.md` § "Self-Hosted Convex — Operational Rules" — never bulk-delete or bulk-patch a
  large table on the live instance; retention-style writes stay batch-capped like
  `convex/retention.ts`; every **public** Convex function is callable with no credential by
  anything that can route to the host.
- `CLAUDE.md` § "Commands" — the backend deploy MUST be
  `npx convex deploy --env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile`. A bare
  `npx convex deploy` can target the retired cloud deployment `tidy-whale-981`. Run
  `git status --porcelain` first: `convex deploy` ships the **working tree**, not HEAD, and this
  is a shared checkout.
- Claude memory `convex-mutation-read-limit-4096` — the real ceiling is 4,096 **reads**, not the
  16,000 writes the docs and this repo's own comments point at. Constrains D-08.
- `convex/llm.ts:251-271` — the Phase 104 STOPGAP note that named this fix. Delete it with the
  code it annotates.

### Prior phase context
- `.planning/phases/120-polish-verified-defects/120-CONTEXT.md` — the immediately prior phase's
  decisions. Relevant carry-forward: fix the defect **class**, not the instance, and re-derive the
  population from the corpus rather than from a triage document.
- `.planning/phases/120-polish-verified-defects/120-DESIGN-REVIEW-HANDOFF.md` — items routed
  forward to 122/123/124. None land on 121, but `LlmAnalyticsPanel`'s off-token chrome is the
  kind of thing that does.

### Not applicable
- No UI-SPEC is needed. This phase builds no new surface; D-11 caps its rendering at one text
  label. Phase 122 does build surface and needs its own.
- No external ADRs exist for this work.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/SectionErrorBoundary.tsx` — the boundary D-02 wraps with. Already used by 35+
  sections on `/analytics`. Has a working `handleRetry` that clears error state. Its visuals are
  off-token (`bg-gray-800/50`, `border-red-500/30`) — leave them; that is Phase 122's.
- `convex/aggregates.ts:265-330` — the `cost` and `tokens` hourly blocks. D-05's `calls` block is
  a direct structural sibling: same `llmRows`, same 4-segment key, same guard shape.
- `convex/aggregates.ts:765` `backfillTokenSplit` and `:627` `backfillDailyRollup` — the two
  working backfill precedents D-08 models on.
- `convex/aggregates.ts:56-111` `insertTokenSplitBuckets` — the shared accumulate+guard+insert
  helper, factored out precisely so the cron and the backfill cannot drift. D-05/D-08 should
  follow that pattern rather than duplicating logic.
- `src/components/LlmAnalyticsPanel.test.tsx` — already mocks `api.llm.providerBreakdown` and
  `api.llm.costByModel` by string ref; the fixture shape must track D-07.

### Established Patterns
- **`by_timestamp` with a `gte` bound returns from the OLDEST end.** A naive `.take(N)` on a
  "last 30 days" view keeps the *oldest* N rows and silently drops the newest — the opposite of
  what every one of these surfaces wants. Use `.order("desc")` and reverse for display.
  `providerBreakdown`'s existing 8000-row cap has exactly this characteristic. This trap already
  cost one wrong diagnosis (a `take(1000)` sample read 100% `billingType: "api"` and suggested
  subscription usage was ~zero; the real figure was 864 calls / 20.75M tokens).
- `.filter()` runs AFTER the index read in Convex — `archived` rows are read and then discarded,
  and count against the budget either way.
- `aggregates` retention: `convex/retention.ts:124,178` prunes hourly rows at 90 days and keeps
  `period: "daily"` forever. A 30-day hourly read is safe.
- `convex/schema.ts:973-976` — `by_type_period_bucket` is **readers only** and deliberately wide;
  ten modules fold across it summing all shards and dimension keys. Do not narrow it.
- Money on this page is derived (`tokens × live rate`) via `costDerived`, never read from the
  ingested `llmMetrics.cost` field (Phase 104 D-01). Loading renders `--`, an unpriced model
  renders `Unpriced`, never `$0.00`.

### Integration Points
- `src/pages/Analytics.tsx:52-81` — the ten hoisted queries D-01/D-02 relocate.
- `src/pages/Analytics.tsx:336` — the existing `LLM Analytics` boundary; already correct.
- `src/components/LlmAnalyticsPanel.tsx:8,11,23` — the only consumers of the two migrated queries.
- `src/hooks/useAnalytics.ts:4-6` — the dead `useLatencyOverTime` hook D-06 deletes.
- `convex/crons.ts:17` — `internal.aggregates.computeHourly`, the cron D-05 extends.

### Defect-class census — unbounded `.collect()` over `llmMetrics` in `convex/`
Derived from the corpus on 2026-08-18, not from the brief's list. **7 sites**:

| Site | Scope | Disposition |
|---|---|---|
| `convex/llm.ts:218` `costByProvider` | unscoped 30d | delete (D-06) |
| `convex/llm.ts:235` `costByModel` | unscoped 30d | migrate to rollups (D-07) |
| `convex/llm.ts:313` `latencyOverTime` | unscoped 30d | delete (D-06) |
| `convex/evalScores.ts:156` | one `sessionId` | bound it (D-09) |
| `convex/aggregates.ts:965` `costByGoalPeriod` | one `goalId` | leave — single-goal read |
| `convex/aggregates.ts:1032` `llmByGoal` | one `goalId` | leave — single-goal read |
| `convex/migrations.ts:391` | one `sessionId`, delete path | leave — not a page query |

Two sites the brief did not mention were checked and are clean: `convex/analytics.ts:150`
(`tokenWaterfall`) is `.take(30000)` over a documented-intentional 30-minute window, and
`convex/evalScores.ts:731` is `.first()` per session.

</code_context>

<specifics>
## Specific Ideas

- The ratchet in D-04 must be **derived, not enumerated**. The 2026-08-17 lesson that produced
  this requirement: a guard test listing required items by name stayed green through five further
  instances of the identical defect. Mutation-test it by adding a **synthetic new** hoisted query
  and confirming the ratchet fails while a by-name test would still pass.
- Verification of criterion 1 must assert the **observable outcome** — that sibling panels still
  render content — not a proxy like "the boundary's `hasError` flag flipped" or "no exception
  escaped".
- Any claim that a query "now reads the rollups" needs a control: a probe that would show the raw
  path if it were still live. Absence of an `llmMetrics` read in one test is not evidence.

</specifics>

<deferred>
## Deferred Ideas

- **A latency chart on `/analytics`.** `latencyOverTime` is being deleted with no replacement
  (D-06). If a latency surface is ever wanted, it needs a `latency` rollup (sum + count per
  bucket) and belongs in its own phase — not v15.0.
- **A shared status-returning query hook** (`{data, status}` instead of throwing). Considered
  under D-02 and deferred. If Phase 122's TOKEN-04 needs one, 122 builds it.
- **Cross-metric gap disambiguation** — checking whether any other `metric_type` has a bucket for
  an hour, to tell a real zero from a missed cron run. Deferred under D-10; the payload states the
  limitation instead.
- **`SectionErrorBoundary`'s off-token visuals** and `LlmAnalyticsPanel`'s hardcoded panel/table
  colours → Phase 122.
- **Bounding `aggregates.ts:965` / `:1032`** — goal-scoped, judged fine as-is (D-09), recorded in
  the census so a future phase inherits a measured population rather than a guess.

### Reviewed Todos (not folded)
None — the single matched todo was folded in full.

</deferred>

---

*Phase: 121-analytics-query-resilience*
*Context gathered: 2026-08-18*
