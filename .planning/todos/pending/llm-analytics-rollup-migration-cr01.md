---
id: TODO-llm-analytics-rollup-cr01
status: pending
planted: 2026-08-11
planted_during: Phase 110 (Convex Durability) — surfaced when llm:subscriptionUsage threw and blanked /analytics during the DUR-01 operator chart check
trigger_when: Next time /analytics throws a "too many system operations" error, or the next Analytics-touching phase — whichever comes first. Not urgent on its own; see "What this is NOT" below.
scope: Medium (one phase — per-query semantic verification against the rollups, not a mechanical sweep)
source: Phase 104 gap plan CR-01 (pre-existing, re-confirmed live 2026-08-11); convex/llm.ts:251-271 STOPGAP note
resolves_phase: 121
last_reviewed: 2026-08-17
---

> **SCOPED INTO v15.0 on 2026-08-17, at Larry's request.** Still `pending` — this records
> that it is *committed scope*, not that it is done. Recorded as target feature 5 in
> `.planning/MILESTONE-CONTEXT.md`, which `/gsd-new-milestone` consumes; that entry carries
> the sequencing constraint and the three traps below, so the scoping step does not
> re-derive them.
>
> **The `trigger_when` above has now fired** — by its own terms. It reads "the next
> Analytics-touching phase, whichever comes first", and v15.0 is one: its criterion 5 puts
> the shared PageHeader on every route and its feature 2 mandates six-state metric tiles.
>
> **It is a dependency of that milestone, not a passenger.** The 2026-08-11 incident was a
> single `useQuery` throw **unmounting the React tree**, blanking all of `/analytics`
> including charts whose data was intact. A tile cannot render an honest `unavailable`
> state if the throw kills the tree before it renders — so v15.0's six-state tile contract
> is not deliverable on `/analytics` until this lands. Sequence it **with or before** the
> Analytics honest-states work rather than as tail-end cleanup.
>
> Earlier the same day this was reviewed and left parked (neither trigger had fired then;
> `/analytics` has not thrown again since `0053c596` took `subscriptionUsage` to ~1s).
> Nothing below was re-measured on either date — the 2026-08-11 figures stand as written,
> including the correction that this is a **latency/load** problem and NOT runaway growth.

# TODO: Move the Analytics LLM queries onto the `aggregates` rollups (Phase 104 CR-01)

Phase 104 already identified this and left it tracked as **CR-01**. Its own note sits in
`convex/llm.ts:251-271` and says plainly: *"This is a stopgap: the real fix is to read the
pre-aggregated `aggregates` rollups instead of raw `llmMetrics`."* This todo re-confirms it
against live data and records what is and is not actually wrong, so the next person does not
re-derive it from scratch — or, as I did, mis-diagnose it.

## What happened on 2026-08-11

`llm:subscriptionUsage` threw `Your request timed out performing too many system operations`.
Because an unhandled `useQuery` throw unmounts the React tree, **one query blanked the entire
`/analytics` page**, including cost-history charts whose data was completely intact. Fixed in
`0053c596` by reading only rows that can match via the `by_provider` index (~864 rows instead of
5,274) — it now returns in ~1s.

## What this is NOT — read before prioritising

My first diagnosis was that these reads "grow without bound". **That was wrong**, corrected in
`c4a53541`. Measured 2026-08-11:

- The 30-day `llmMetrics` window holds **5,274 rows** — *under* the 8000 cap Phase 104 set, and
  *down* from the ~7,080 Phase 104 recorded on 2026-08-01.
- `llmMetrics` as a **table** is keep-forever (excluded from `RETENTION_DAYS`, guarded by a
  positive test in `retention.test.ts`) and does grow without bound. The 30-day **read** is a
  sliding window and does not. Those are different claims; conflating them overstates the risk.
- The supported mechanism is the one Phase 104 documented: Analytics fires ~10 queries
  concurrently and the combined load tips a memory-loaded instance. Backend memory was 32.5 GiB
  the evening this fired, versus 18 GiB after the nightly restart.

So this is a **latency/load** problem, not a runaway-growth problem. Treat it accordingly.

## The work

Move these off raw `llmMetrics` and onto the Phase 104 `aggregates` rollups, verifying semantics
per query rather than mechanically:

| Site | Scope | Note |
|---|---|---|
| `convex/llm.ts:275` `providerBreakdown` | unscoped 30d | already capped at 8000 with a `console.warn`; the original CR-01 target |
| `convex/llm.ts:231` `costByModel` | unscoped 30d | live — `LlmAnalyticsPanel.tsx:11` |
| `convex/llm.ts:308` `latencyOverTime` | unscoped 30d | live — `useAnalytics.ts:5` |

**Gotcha for whoever does this.** `by_timestamp` with a `gte` bound returns from the **oldest**
end of the range. A naive `.take(N)` on a "last 30 days" view therefore keeps the *oldest* N rows
and silently drops the most recent — the opposite of what every one of these surfaces wants. Use
`.order("desc")` and reverse for display. `providerBreakdown`'s existing cap has this exact
characteristic and should be checked while you are in there. I lost a diagnosis to the same trap:
a `take(1000)` sample from that end showed 100% `billingType: "api"` and suggested subscription
usage was ~zero, when the real answer was 864 calls / 20.75M tokens.

## Also found, decided against fixing here

`convex/llm.ts:214` **`costByProvider` is dead code** — zero callers anywhere in `src/`
(the only hit is a passing mention in a comment at `LlmStatusPanel.tsx:22`). It is still a
public, unbounded, externally-callable `query`. Either delete it or fold it into the rollup
migration; it was left alone on 2026-08-11 only because removing a public endpoint deserves a
deliberate decision rather than a drive-by.

## Lower-priority siblings (scoped — probably fine as-is)

`aggregates.ts:965` `costByGoalPeriod`, `aggregates.ts:1032` `llmByGoal` (both scoped to one
`goalId`) and `evalScores.ts:156` (scoped to one `sessionId`) also `.collect()` over
`llmMetrics`, but each reads a single goal's or session's rows. Worth noting that
`evalScores.ts:156` bounds its sibling `events` read at `.take(200)` while leaving `llmMetrics`
unbounded — an asymmetry that looks unintentional.
