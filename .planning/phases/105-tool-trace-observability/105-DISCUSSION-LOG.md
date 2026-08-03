# Phase 105: Tool & Trace Observability - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-03
**Phase:** 105-tool-trace-observability
**Areas discussed:** Tool data unification, Policy/leak signals, Trace depth, Where it lives (IA)

**Area selection:** all four offered areas were selected.

---

## Tool data unification (OBS-01)

### Q1 — Where does Ástríðr's per-tool history come from?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-call rows | Extend `runtimeIngest`'s `tool_executed` case to also insert a `toolExecutions` row. CodePulse-side only; astridr already sends agentId/toolName/success/timestamp. Feeds the trace waterfall later. | ✓ |
| Hourly counter rollup | Leave `callGraphEdges` as the only astridr source; snapshot deltas into `aggregates` hourly. Cheaper, but loses per-call detail permanently and can never feed OBS-03. | |
| Both | Per-call rows plus hourly buckets. More work. | |

**User's choice:** Per-call rows.
**Notes:** Grounded on a live query — `callGraphEdges` holds Ástríðr's real tools as cumulative counters only (no per-call history, so "over time" is impossible), while `toolExecutions` contained zero Ástríðr agent tools.

### Q2 — Separating Claude Code, gateway, and Ástríðr tools

| Option | Description | Selected |
|--------|-------------|----------|
| Tag + filter, default Ástríðr | Reuse the existing `provider` field; one table, one panel, source filter; default view is Ástríðr only. | ✓ |
| Tag + filter, default All | Same tagging, combined default view. Risks a mixed ranking being read as Ástríðr's behavior. | |
| Two separate surfaces | Never mix; distinct panels that cannot be summed. Strongest guarantee, most UI surface. | |

**User's choice:** Tag + filter, default Ástríðr.
**Notes:** Raised because a chart ranking `Bash` (594 live calls) above `web_search` (125) conflates the operator's own coding session with Ástríðr's autonomy.

### Q3 — How far cross-repo on astridr's `tool_executed` payload?

| Option | Description | Selected |
|--------|-------------|----------|
| durationMs + traceId | One astridr change adding both; duration is already computed and discarded, traceId reads the existing per-turn ContextVar. Serves OBS-01 and OBS-03 in one trip. | ✓ |
| durationMs only | Smaller change now; OBS-03 nesting falls back to correlation or is deferred. | |
| No astridr change | CodePulse-side only; duration renders NO_DATA, spans can never nest. | |

**User's choice:** durationMs + traceId.
**Notes:** The ContextVar plumbing was verified in astridr before this question was asked, rather than assumed.

### Q4 — How far back should "over time" reach?

| Option | Description | Selected |
|--------|-------------|----------|
| Hourly aggregates + 14d raw | `computeHourly` tail writes tool buckets (Phase 104 pattern); charts survive the prune, raw rows are the drill-down. | ✓ |
| 14 days raw only | No new rollup; window capped at a fortnight and says so. Least write pressure. | |
| Aggregates, longer raw retention | Both, plus raised retention. Riskiest on the instance the 2026-07-21/22 incident took down. | |

**User's choice:** Hourly aggregates + 14d raw.

---

## Policy/leak signals (OBS-02)

### Q1 — Where should `tool_policy_event` land?

| Option | Description | Selected |
|--------|-------------|----------|
| New dedicated table | `toolPolicyEvents` keyed by kind + toolName + timestamp; index-bounded view. | ✓ |
| Reuse securityEvents | No schema growth, inherits the Security page — but imposes severity semantics and mixes policy telemetry into a security feed. | |
| Reuse the events table | Zero schema change — but `events` is the highest-volume table and the one whose index tombstones forced the `by_timestamp2` rename. | |

**User's choice:** New dedicated table.
**Notes:** Verified that `runtimeIngest.ts` has neither a case for this event nor a `default`, so all four kinds are silently discarded today.

### Q2 — Alert, or view-only?

| Option | Description | Selected |
|--------|-------------|----------|
| Alert on fail-open only | The two malformed-policy kinds fire through Phase 104's existing path; leak and denial stay view-only. | ✓ |
| View-only, all four | Strictly OBS-02 as written. A fail-open degrade stays invisible unless someone opens the page. | |
| Alert on all four | Most visibility, but `execution_denied` is routine by design, so it would alert on correct behavior. | |

**User's choice:** Alert on fail-open only.
**Notes:** Flagged explicitly at the time that OBS-02's literal wording is "ingest + a view" and does not ask for alerting — decided deliberately rather than by omission, because astridr degrades a malformed tool-access policy to *fully permissive* by design.

### Q3 — Guarding against a false-empty view

| Option | Description | Selected |
|--------|-------------|----------|
| Induce one of each, live | Close as an integration gate during execution (104-11 pattern) plus a last-received heartbeat on the panel. | ✓ |
| Heartbeat indicator only | Cheaper; leaves the pipe unproven until a real event happens on its own. | |
| Neither — ship the view | Least work, and exactly the failure shape the War Room lesson names. | |

**User's choice:** Induce one of each, live.

### Q4 — Widen the leak payload?

| Option | Description | Selected |
|--------|-------------|----------|
| Widen the leak payload | Add `tool_was_offered`, `tools_offered_count`, `round`, `agentId` — all already local variables at the emit site. Same commit, no extra deploy. | ✓ |
| Ship with what's emitted | Satisfies OBS-02 literally; operator cross-references astridr logs for the why. | |
| Widen, and reconcile the two | Also make log line and telemetry emit from one shared dict so they can't drift again. Larger diff. | |

**User's choice:** Widen the leak payload.
**Notes:** Surfaced by reading the emitter — astridr's log line carries four fields the telemetry send three lines below drops, including `tool_was_offered`, which is the actual silent-filter-trap diagnosis.

---

## Trace depth (OBS-03)

### Q1 — What does "nested spans" become on screen?

| Option | Description | Selected |
|--------|-------------|----------|
| Tool rows nest under their LLM call | Two levels of the existing Collapsible; reuses the current axis and bar geometry; per-tool timing reads as a share of the turn. | ✓ |
| Flat trace lane | LLM calls and tools interleaved by timestamp, distinguished but not nested. No parent to get wrong. | |
| Separate tool lane | Parallel lane sharing the axis. Zero regression risk; the lanes never visually connect. | |

**User's choice:** Tool rows nest under their LLM call.

### Q2 — How is the parent determined?

| Option | Description | Selected |
|--------|-------------|----------|
| Round ContextVar | New per-round ContextVar in astridr, mirroring the existing traceId one; nesting becomes reported rather than inferred. Larger astridr diff. | ✓ |
| Timestamp ordering | Nest under the most recent preceding LLM call in the trace. Zero extra change, correct in the common case — but a wrong parent renders as confidently as a right one. | |
| Timestamp ordering, labelled as inferred | Same rule, with the UI stating the grouping is inferred. Cheapest honest option. | |

**User's choice:** Round ContextVar.
**Notes:** A mid-question correction was issued: `llm_call` is emitted from inside each provider, which has no access to the loop's `round_num`, so "just emit the round" is not free — a ContextVar is the only mechanism reaching both sites. The options were re-framed with that real cost before the choice was made.

### Q3 — What does "cache-hit visibility per turn" mean?

| Option | Description | Selected |
|--------|-------------|----------|
| Cache ratio on the group header | Per-trace ratio beside the existing group cost, using the identical denominator already in `computeSummary` and `shapeCacheAcc`. | ✓ |
| Group header shows read/write token counts | Raw sums, no formula to keep in sync — operator does the division. | |
| Both | Ratio on the header, raw counts in detail, making the ratio auditable. | |

**User's choice:** Cache ratio on the group header.

### Q4 — Bounding the deeper waterfall

| Option | Description | Selected |
|--------|-------------|----------|
| Cap both reads + say so on screen | Row caps on both queries, truncation stated, confirm the SectionErrorBoundary. Applies the `3b31c9f4` lesson. | ✓ |
| Cap reads, no truncation notice | Nothing times out, but a truncated trace reads as complete. | |
| Leave unbounded | Smallest diff; knowingly steps past a pre-existing defect with new volume on top. | |

**User's choice:** Cap both reads + say so on screen.
**Notes:** Both feeder queries were confirmed to be unbounded `.collect()` before the question was asked.

---

## Where it lives (IA)

### Q1 — Home for the new surfaces

| Option | Description | Selected |
|--------|-------------|----------|
| New dedicated Tools page | One route owning tool analytics + the policy feed; a home for the source filter. | ✓ |
| Extend what's mounted | No new route — but spreads tool observability across three more pages, the drift Phase 96 undid. | |
| New page + consolidate | Also retires the scattered copies. Cleanest end state, most regression surface. | |

**User's choice:** New dedicated Tools page.

### Q2 — Nav placement

| Option | Description | Selected |
|--------|-------------|----------|
| OBSERVE | Beside Analytics, Alerts, Quality, Security — it is time-series observability. Tool Galaxy / MCP Inventory stay in GRAPHS as different concerns. | ✓ |
| GRAPHS, beside Tool Galaxy | Keeps tool-named surfaces adjacent; dilutes what GRAPHS means. | |
| OBSERVE, and cross-link from Tool Galaxy | Same placement plus explicit wayfinding; extra work on two existing pages. | |

**User's choice:** OBSERVE.

### Q3 — Fate of the three already-mounted panels

| Option | Description | Selected |
|--------|-------------|----------|
| Leave them, add links | Existing panels stay as at-a-glance summaries and link into the new page. Zero regression surface. | ✓ |
| Move all three onto Tools | Cleanest end state; edits Dashboard and Analytics layouts and removes panels operators use daily. | |
| Move ToolExecutionPanel only | Targeted; one panel's worth of regression risk. | |

**User's choice:** Leave them, add links.
**Notes:** A caveat attached to this option — that `ToolBreakdown` would inherit the mixed source set — was **withdrawn as incorrect** immediately after: it reads `useRecentEvents(100)` → the build-time `events` table, not `toolExecutions`, so the Area-1 source mixing does not reach it. The decision was unaffected; CONTEXT.md records the corrected fact.

### Q4 — Page layout

| Option | Description | Selected |
|--------|-------------|----------|
| Stacked sections | Usage then policy feed on one scroll, each error-isolated. A rare signal stays visible; empty costs one line. | ✓ |
| Tabs (Usage / Policy) | Cleaner default view — but buries the fail-open signal, and tab state is local component state, not URL-addressable, so a D-06 alert can't deep-link to it. | |
| Stacked, policy feed first | Strongest emphasis on the wrong-signal — at the cost of usually opening on an empty section. | |

**User's choice:** Stacked sections.

---

## Claude's Discretion

None. A concrete option was selected on every one of the 16 questions; no question was answered
with "you decide" and no free-text override was given.

Items left to research/planning by omission rather than by delegation: table and field naming,
index design, aggregate metric-type names, specific row caps, chart primitives, and plan/wave
decomposition.

## Deferred Ideas

- Backfill of existing `toolExecutions` rows for the new aggregates (raised at the close of
  discussion, not discussed — routed to planning).
- Enforcement of the existing `toolGovernance.disabled` flag (a new capability; its own phase).
- Reconciling CodePulse's definition of a tool "failure" with astridr's, which deliberately excludes
  an off-turn block from its own failure-rate circuit breaker.
- Retiring the duplicate Dashboard/Analytics tool panels (Phase 96-style IA work).
- The 40+ static alert rules that only evaluate while the Alerts page is open (carried forward from
  Phase 104's deferred list).
