# Phase 129: Dashboard Unbounded Read & Ratchet Coverage - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-28
**Phase:** 129-dashboard-unbounded-read-ratchet-coverage
**Areas discussed:** Consumer disposition (F-1/F-2), Count semantics, Ratchet signature (FIX-02), Guard family

All four offered gray areas were selected for discussion; none were skipped.

---

## Consumer disposition (F-1/F-2)

### How far does Phase 129 go?

| Option | Description | Selected |
|--------|-------------|----------|
| Bound + fix the caller | Bound both reads AND resolve the field mismatch; phase criteria are unobservable otherwise | ✓ |
| Bound the query only | Matches FIX-01/FIX-02's literal scope; leaves the confident zero, filed as a todo | |
| Retire dashboardSummary | No frontend consumer exists; delete and give cost_summary a purpose-built query | |
| You decide | | |

**User's choice:** Bound + fix the caller
**Notes:** Chosen with F-1/F-2 already on the table — the query has one caller and two of its three fields do not exist on the return type, so bounding alone would ship an unobservable fix.

### What happens to FIX-01's wrong-surface wording?

| Option | Description | Selected |
|--------|-------------|----------|
| Correct FIX-01 in place | Rewrite to name the real consumer, with a dated correction note | ✓ |
| Leave it, record in CONTEXT | Correction lives only in 129-CONTEXT.md | |
| Correct it and check for siblings | Also sweep the other FIX-* entries for the same class of error | |

**User's choice:** Correct FIX-01 in place
**Notes:** The sibling sweep was offered as the treat-it-as-a-class option and not taken; FIX-02..FIX-09 were not re-derived during this discussion, so the possibility that another entry names a wrong surface remains open and unmeasured.

### Where should cost_summary's totalCost / totalTokens come from?

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse the aggregates rollup | The index-ranged read behind analytics:tokenSunburst already produces both figures | ✓ |
| Add the fields to dashboardSummary | Same source, but widens a query being made cheaper; nothing else wants the fields | |
| Drop the fields from cost_summary | Smallest change; the Insights chat loses cost answering entirely | |
| You decide | | |

**User's choice:** Reuse the aggregates rollup

### How do we prove the caller fix stayed fixed?

| Option | Description | Selected |
|--------|-------------|----------|
| Type-level + a test | Derive executeTool's shape from the real return type, plus a non-placeholder value test | ✓ |
| Unit test only | Simpler; a `?? 0` fallback can still absorb a future rename | |
| Type-level only | Cheapest; proves nothing about runtime values | |

**User's choice:** Type-level + a test

---

## Count semantics

Presented with the measurement that `convex/heroStats.ts` had already solved both halves — a range-bounded `by_timestamp2` read at `:43-47` and `TOOLS_COUNT_CAP` at `:8`/`:102` — and that `metrics.ts:20-23`'s `activeSessions` read duplicates `heroStats.ts:17-20` byte-for-byte.

### What should totalEvents MEAN once bounded?

| Option | Description | Selected |
|--------|-------------|----------|
| Window it, heroStats-style | Range-bounded read over a stated window + take cap; field renamed | ✓ |
| Read the aggregates rollup | Longer horizon cheaply; depends on the rollup being populated and current | |
| Cap + truncated flag | Keeps "total" semantics but would ship permanently truncated on events | |
| You decide | | |

**User's choice:** Window it, heroStats-style

### And uniqueTools?

| Option | Description | Selected |
|--------|-------------|----------|
| Share heroStats' cap | One exported constant; the two counts cannot drift | ✓ |
| Copy the treatment locally | Zero risk to heroStats, at the cost of a second copy of a number that should agree | |
| You decide | | |

**User's choice:** Share heroStats' cap
**Notes:** Accepts a deliberate touch of `heroStats.ts` — the every-page query — as an export-only change.

### Report saturation, or stay silent?

| Option | Description | Selected |
|--------|-------------|----------|
| Report truncation | truncated / rowsRead, matching llm:costByModel's contract | ✓ |
| Silent, like heroStats | Consistent with the sibling query; but this consumer is an LLM stating the figure as fact | |

**User's choice:** Report truncation
**Notes:** A deliberate divergence from heroStats' documented position that a wrong-but-large number beats an error — justified by the consumer being an LLM rather than a UI tile.

### Deduplicate the activeSessions read shared with heroStats?

| Option | Description | Selected |
|--------|-------------|----------|
| Note as deferred | Keeps the every-page query out of this phase's blast radius | ✓ |
| Deduplicate in this phase | Removes the drift risk permanently | |

**User's choice:** Note as deferred

---

## Ratchet signature (FIX-02)

Presented with a fresh measurement: of 608 `ctx.db.query(...)` chains in `convex/*.ts`, 90 terminate in a bare `.collect()` with no `withIndex` — but `events` accounts for exactly 1 of them (`metrics.ts:19`), while `registry.ts` (24) and `skillCategories.ts` (14) dominate the rest on small config tables.

### How should the signature be expressed?

| Option | Description | Selected |
|--------|-------------|----------|
| Table-scoped | Bare .collect() flagged only on declared high-volume tables; population of 1 for events | ✓ |
| Shape-only + rotting baseline | Catches any table, incl. ones that grow later; ships a 90-entry debt list | |
| Hybrid | Table-scoped enforcement plus a baselined inventory of the rest | |
| Record the limitation | Criterion 3's explicit escape hatch — no ratchet extension at all | |

**User's choice:** Table-scoped

### How does a table earn its place on the high-volume list?

| Option | Description | Selected |
|--------|-------------|----------|
| Growth shape, from schema | Derived from time-indexed tables; no human step to forget | ✓ |
| Measured row counts | Most accurate today; goes stale silently | |
| Hand-maintained, defended | Simple and readable; relies on someone remembering | |
| You decide | | |

**User's choice:** Growth shape, from schema

### How should the new scan parse?

| Option | Description | Selected |
|--------|-------------|----------|
| TypeScript AST | Real call chains; immune to formatting, comments, code-like strings | ✓ |
| Multi-line regex | Matches the existing ratchets' style; its negative result is a claim about the probe | |
| You decide | | |

**User's choice:** TypeScript AST

### The schema rule misses discoveredTools — how do we cover it?

Raised after classifying the 90 sites by growth shape returned a result that partly contradicted the rule just chosen: only 12 sites sit on growth-shaped tables, and `discoveredTools` — half of this phase's own defect — classified as config-shaped because its indexes carry no time field.

| Option | Description | Selected |
|--------|-------------|----------|
| Schema base + additions list | Derived base plus explicit additions with reasons for what the schema can't reveal | ✓ |
| Broaden the heuristic | Also treat ingest/registry-written tables as growing; a second inference on the first | |
| Accept the miss, record it | Ratchet covers :19 only; honest but demonstrably half-blind | |

**User's choice:** Schema base + additions list

### What happens to the other 10 growth-shaped bare collects?

| Option | Description | Selected |
|--------|-------------|----------|
| Allowlist with reasons | Ratchet ships green, debt visible and countable, population cannot grow | ✓ |
| Triage, then fix or allowlist | Closest to the folded todo's own instruction; materially larger than filed scope | |
| Fix only metrics.ts, defer the rest | Tightest scope; follow-up may never be picked up | |

**User's choice:** Allowlist with reasons

---

## Guard family

Presented with two facts: `makeRecordingDb` is defined 7 separate times across `convex/*.test.ts` (documented at `alertsCountBounded.test.ts:27-29` as a deliberate copy because `heroStats.test.ts` does not export it), and `scripts/hooks/pre-commit` — landed the same day — already runs the dead-surface ratchet on any commit touching `convex/*.ts`.

### Where should the new bare-collect ratchet live?

| Option | Description | Selected |
|--------|-------------|----------|
| Extend boundedReads.ratchet.test.ts | One file owns "reads that aren't bounded"; closes the gap where readers will look | ✓ |
| New sibling ratchet test | Keeps an AST scan out of a working regex file; two places to look | |
| scripts/*.mjs + pre-commit | Most enforcement; a third guard style to keep straight | |

**User's choice:** Extend boundedReads.ratchet.test.ts

### And the recorded-query test?

| Option | Description | Selected |
|--------|-------------|----------|
| New metricsDashboardBounded.test.ts | Follows the established *Bounded.test.ts naming beside five siblings | ✓ |
| Fold into an existing file | Fewer files; couples this guard to the every-page query's test file | |

**User's choice:** New metricsDashboardBounded.test.ts

### makeRecordingDb — extract, or add the 8th copy?

| Option | Description | Selected |
|--------|-------------|----------|
| Extract to a shared helper | Stops the drift seven independent fakes invite; touches files this phase otherwise wouldn't | ✓ |
| Extract, new file only | Right structure without a 7-file refactor | |
| Add the 8th copy | Zero risk to six passing test files; makes the drift worse | |

**User's choice:** Extract to a shared helper
**Notes:** Recorded in CONTEXT.md (D-14) as: create the helper and use it for the new test; migrating the existing 7 is explicitly deferred.

### Pre-commit, or npm test + CI only?

| Option | Description | Selected |
|--------|-------------|----------|
| npm test + CI only | Same wiring as every other ratchet; keeps the hook single-purpose and fast | ✓ |
| Pre-commit too | Refuses the read at authoring time; slower hook, two reasons to fail a commit | |

**User's choice:** npm test + CI only

---

## Claude's Discretion

- The window for the bounded `events` read (hour vs 24h) and the replacement field names.
- Whether the aggregates rollup read for `cost_summary` is a direct query call or an extracted helper — constrained by the new `CLAUDE.md` §"Dead Surface" rule.
- How the new ratchet proves it can fail: a `--self-test` flag in the dead-surface style, or a red/green mutation against the real `metrics.ts`. One of them is mandatory.

## Deferred Ideas

- Deduplicate the `activeSessions` read shared between `metrics.ts:20-23` and `heroStats.ts:17-20`.
- Migrate the existing 7 `makeRecordingDb` copies to the shared helper.
- Triage the ~78 config-shaped bare `.collect()` sites by measured row count.
- `forgeLogChunks` (`forge.ts:1136`) — probable growth-shaped table misclassified by the schema heuristic; gets ratchet coverage via the additions list, not a fix.
- The unrun sibling sweep of FIX-02..FIX-09 for further wrong-surface claims.

## Process note

Two concurrent-session messages arrived mid-discussion from the astridr-repo Phase 197 session, which is committing cross-repo into this checkout. No path overlap with this phase; its 197-02 files were staged in the shared index at the time, which is recorded in CONTEXT.md's code_context section as a hazard for this phase's executors.
