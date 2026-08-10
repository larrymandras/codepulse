# Phase 110: Convex Durability - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning

<domain>
## Phase Boundary

The self-hosted Convex instance becomes durable **by design** rather than nightly-restarted by mitigation. Three things, and only these three:

1. `aggregates` — today the largest unbounded table — is bounded and pruned on the existing batch-capped, cursor-seeked machinery (DUR-01).
2. A complete nightly prune pass across *every* table in `RETENTION_DAYS` is observed on the live self-hosted instance and recorded as evidence, not read from code (DUR-02).
3. The convex-backend memory-growth driver is probed for a bounding knob and, either way, documented as understood — with `ConvexNightlyRestart` recorded as a deliberate mitigation (DUR-03).

**Not in this phase:** rewriting the prune's batching (the 2026-07-30 cursor fix stands and is verified, not rebuilt); bounding `llmMetrics`/`sessions`/`alerts`; the Mission Board, telemetry-coverage, or debt-sweep work of sibling phases.

</domain>

<decisions>
## Implementation Decisions

### Aggregates prune shape (DUR-01)

- **D-01:** `aggregates` is bounded **period-aware**, not whole-table. `period:"hourly"` rows are prunable; `period:"daily"` rows are kept forever. Measured live 2026-08-10: 1,455 hourly + 138 daily rows/day, so ~91% of the volume is hourly. This preserves the substance of D-04 (Phase 104 re-prices dollars from aggregate token buckets on every read) at day granularity, and it matches the architecture `convex/costDerived.ts:405-424` already documents — whole days before today read `period:"daily"`, today reads `period:"hourly"`, "DISJOINT BY CONSTRUCTION".

- **D-02:** The period filter lives in the **existing chain**, not a parallel one. `pruneBatchV3` gains an optional per-table predicate and `aggregates` becomes another entry processed in the same sequential run, under the same single batch cap. Rationale: two concurrent prune chains would put two batch budgets on SQLite's single writer, which is precisely what the "tables sequential, 3s apart" rule in `convex/retention.ts:18-23` exists to prevent. Constraint: `convex/retentionCursor.ts`'s existing tests must stay green — that module has already been through two production incidents.

- **D-03:** The keep-forever guard in `convex/retention.test.ts:92-101` is **narrowed, not deleted**. `llmMetrics`, `sessions`, `alerts` stay in the keep-forever assertion; `aggregates` comes out of it and is replaced by a *positive* guard asserting the aggregates predicate can never delete a `period:"daily"` row. The class-level protection ("nobody accidentally prunes cost history") must survive in a form that matches the new design — asserted against the predicate itself, not against a comment.

### Window and backlog (DUR-01)

- **D-04:** Hourly aggregate rows are kept **90 days** — the existing build/history tier (`events`, `cronExecutions`, `jobLifecycle`, …). Probed live 2026-08-10: exactly **90 rows** in `aggregates` are older than 90 days, so the first pass has effectively no backlog and needs no drain plan, no offline trim, and carries no tombstone-storm risk. Steady state ≈131k hourly rows. (30d was rejected at a ~95k-row first drain competing with `runtime_events` for the shared nightly cap; 14d additionally risks cutting below readers' hourly lookback windows.)

- **D-05:** The chain **rotates its start index nightly**. Today a capped run always restarts at index 0 (`runtime_events`, the firehose), so every tail table is silently skipped on any night the cap is hit — and `aggregates` would be appended last. Persist where the last run stopped and resume there next night, so "a complete pass across every table" (DUR-02) is structurally true over time rather than only on light nights.

- **D-06:** The rotation cursor lives as **a single row in the existing `agentConfigs`** key-value config store — one row, patched once per night, never grows, nothing new to add to `RETENTION_DAYS`. No new table.

### Prune-pass observability (DUR-02)

- **D-07:** `convex-selfhost/retention-health-check.ps1` **derives its table list from `RETENTION_DAYS` at runtime**; the hand-copied `$RetentionDays` hashtable and its "Keep in sync if that map changes" comment are deleted outright. Evidence this is not hypothetical: that copy holds **14 entries against `RETENTION_DAYS`' 18 keys** — `gatewayQuotaSnapshots`, `toolPolicyEvents`, `activeEngineSnapshots`, and `controlVerbSwaps` are invisible to every health check that has ever run, and the 2026-08-10 05:30 log line "all tables caught up" is therefore a claim about 14 tables, not all of them. `aggregates` would have been the fifth silent omission. **How** the PS1 reads the map (a generated JSON, an inline convex query, `node -e`) is open — see Claude's Discretion.

- **D-08:** DUR-02 closes on **two independent pieces of live evidence captured verbatim once**, not on a new persistence layer:
  1. the chain's own terminal `retention: all tables pruned` line pulled from the running container's logs — reachable only if every table advanced, including the new `aggregates` entry and the rotation;
  2. a health-check run (post-D-07) showing every table in `RETENTION_DAYS` caught up.
  No `retentionRuns` table is created — the module that exists to reduce writes does not gain a per-run write.

### Memory-growth root cause (DUR-03)

- **D-09:** **Probe for a bounding knob first, then document.** Investigate whether the convex-backend build in use exposes a cache / working-set cap (it already accepts `DOCUMENT_RETENTION_DELAY` via env) and whether that version carries a known upstream issue. A knob that bounds growth is durability by design, which is the phase goal; if none exists, the negative result is itself recorded as evidence and DUR-03 closes as documented — which DUR-03 explicitly permits. A multi-day controlled attribution study was considered and rejected as disproportionate.

- **D-10:** If a knob exists, the bar for enabling it is **a measured improvement on the live box, with `ConvexNightlyRestart` left running throughout**. Compare the growth rate across a full inter-restart cycle against the ~0.17 GiB/h baseline already on record. The restart costs nothing, is health-gated (`restart-convex.ps1` asserts `:3210/version` returns 200 within 150s, else it logs `INVESTIGATE` and does not claim success), and is the safety net if the knob makes things worse. Retiring the restart is a later decision, not this phase's.

- **D-11:** The write-up lands in **`CLAUDE.md`'s existing "Self-Hosted Convex — Operational Rules" section plus a phase evidence file**. The evidence file holds raw measurements and provenance; CLAUDE.md gains a short entry stating that `ConvexNightlyRestart` is deliberate and why — that section loads every session, so the claim cannot go unread. (A `convex-selfhost/` runbook and a memory-file refresh were considered; `convex-selfhost/` is not version-controlled until Phase 113's debt sweep.)

### Claude's Discretion

- The mechanism by which `retention-health-check.ps1` reads `RETENTION_DAYS` (D-07) — a generated JSON artifact, an inline convex query like the one the script already uses for per-table probes, or `node -e`. Constraint: it must be a *read of the source of truth*, not a second copy, and it must survive PS 5.1's quoting rules (the script's existing probe uses single-quoted JS string literals inside `cmd /c` for exactly this reason).
- The exact shape of the per-table predicate in `pruneBatchV3` (D-02) — a predicate function, an index-scoped variant, or a policy descriptor on the `RETENTION_DAYS` entry — provided `aggregates` stays inside the one sequential chain and one batch cap.
- The `agentConfigs` key name and value shape for the rotation cursor (D-06).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The prune machinery (DUR-01, DUR-02)
- `convex/retention.ts` — `RETENTION_DAYS` (18 keys), `startNightlyPrune`, `pruneBatchV3`, `BATCH_SIZE=200`, `RESCHEDULE_DELAY_MS=3000`, `MAX_BATCHES_PER_NIGHT=600`. Its header comment (lines 6-27) is the operational-constraint record: batched deletes, sequential tables, why the cap exists.
- `convex/retentionCursor.ts` — the full write-up of the 2026-07-30 self-defeat and the cursor fix, plus `planNextPruneStep`, the only directly-testable part of the chain (no `convex-test` harness in this repo). D-05's rotation changes this module's contract.
- `convex/retention.test.ts` §"still keeps the cost/trend tables forever" (lines 92-101) — the guard D-03 narrows. Also the table-existence test that makes a typo'd table name a caught error rather than a permanent silent no-op.
- `convex/crons.ts:162-168` — `retention-prune` fires at 09:00 UTC. Relevant because `DOCUMENT_RETENTION_DELAY=1800s` means a ~30-minute run sits entirely inside its own tombstone window.

### Why `aggregates` is kept forever today (D-01, D-03)
- `convex/schema.ts:953-990` — the `aggregates` table: `period` (`"hourly"`/`"daily"`), `bucket_start` (epoch **seconds**, while the prune cuts on `_creationTime` in **milliseconds** — do not conflate them), `shard`, `dimension_key`, and the two indexes with their reader-only / write-path-only annotations.
- `convex/costDerived.ts:405-424` — `computePeriodSpend`'s bounded read strategy: daily buckets for whole days before today, hourly for today, disjoint by construction. This is the architectural precedent D-01 rests on.
- `convex/dataRetention.ts:1-25` — D-12: the raw-events purge is forbidden from touching `aggregates`. Still holds; D-01 does not relax it.
- `convex/analyticsRollup.ts:271-292` — `clearHistoricalBucketsPage`, an existing bounded delete over `aggregates` hourly buckets for `events`/`sankey_edge`. Prior art for period-scoped deletion, and a second writer the new predicate must not collide with.
- Hourly readers whose lookback must be confirmed to sit inside 90 days: `convex/analytics.ts:25,47,71,77,100`, `convex/alerts.ts:841,1058`, `convex/briefings.ts:173`, `convex/costDerived.ts:371,469`.

### Live-instance operations (DUR-02, DUR-03)
- `C:/Users/mandr/convex-selfhost/retention-health-check.ps1` — the daily 05:30 probe (task `ConvexRetentionHealthCheck`). Lines 38-54 hold the stale 14-entry copy D-07 removes; lines 95-130 hold the per-table probe recipe (one CLI call per table — a looped inline-query over a table-name array silently produced no output when tried 2026-07-30).
- `C:/Users/mandr/convex-selfhost/retention-health.log` — verdict history. 2026-08-10 05:30: `verdict=OK … all tables caught up, no timeouts, memory/db nominal`, worst overhang 0.5h, memory 16.02GiB, db 6.23GiB.
- `C:/Users/mandr/convex-selfhost/restart-convex.ps1` + `restart-convex.log` — the health-gated nightly restart. 2026-08-10 02:00: 19,630 MiB → 8,181 MiB, healthy after 30s; the same ~8.1 GiB floor as 08-08 and 08-09.
- `C:/Users/mandr/convex-selfhost/health-report.md` — the 2026-08-06 root-cause report. Establishes ~0.17 GiB/h growth, that ~20% of the `docker stats` figure is reclaimable page cache (anon heap flat across a 5-minute sample), and that the 08-05 OCC-retry hypothesis had **0** matching lines in the equivalent window. Both refuted hypotheses are DUR-03 evidence — do not re-derive them.
- `C:/Users/mandr/convex-selfhost/retention-root-cause.ps1` + `.log` — the headless follow-up that fires only on WATCH/ALERT. Verdict has been OK every day since 2026-08-07.

### Project rules that bound this phase
- `CLAUDE.md` §"Self-Hosted Convex — Operational Rules (2026-07-22 incident)" — never `import --replace-all`, never bulk-delete or bulk-patch a large table on the live instance, `docker inspect` clean exit does not rule out OOM. D-11 adds to this section.
- `.planning/REQUIREMENTS.md` §"Convex Durability (DUR)" and §"Scoping evidence" — DUR-01/02/03 verbatim, plus the recorded checks behind them (including that the "retention self-defeats" claim is *stale, already fixed*).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `planNextPruneStep` (`convex/retentionCursor.ts`) — dependency-free chain-advancement arithmetic with real unit tests. Both the `aggregates` entry (D-02) and the nightly rotation (D-05) should express themselves through this function rather than inline in the mutation, because it is the only part of the chain this repo can test.
- `agentConfigs` — the generic key-value config store with source tracking, already consumed elsewhere in the app. Home for D-06's rotation cursor.
- The health check's per-table probe recipe (`retention-health-check.ps1:105-115`) — a working, quoting-safe pattern for reading live table state from PowerShell via `npx convex run --inline-query`. Reuse it rather than inventing a new invocation.
- `aggregates.rollupDaily` (`convex/crons.ts:33-35`) — already folds hourly into daily nightly, which is why D-01 does not need a separate compaction step before pruning.

### Established Patterns
- **Bound a new table before it can ever need a mass delete.** `gatewayQuotaSnapshots` (Phase 104 D-20), `toolPolicyEvents` (105 D-05), `activeEngineSnapshots`/`controlVerbSwaps` (108 D-10/D-14) were each bounded pre-emptively. `aggregates` is the exception that grew first — hence this phase.
- **Deliberate exemptions are documented in place, and the test asserts the documentation exists.** `prompts`/`promptVersions` (Phase 116 D-13) carry an in-file rationale plus a `retention.test.ts` assertion that the rationale string is present. D-03's narrowed guard should follow the same shape.
- **`RETENTION_DAYS` keys are asserted to be real schema tables** — a typo'd name is a permanent silent no-op that nothing reports. Any new entry inherits that guard.
- Deletes are batched 200/mutation, 3s apart, tables sequential; parallel chains starved ingest on SQLite's single writer.

### Integration Points
- `pruneBatchV3`'s query construction (`convex/retention.ts:151-157`) — where a per-table predicate has to land without breaking the `by_creation_time` cursor seek that the 2026-07-30 fix depends on.
- `startNightlyPrune` (`convex/retention.ts:102-114`) — currently hard-codes `tableIndex: 0`; D-05's rotation replaces that with a read of the persisted cursor.
- `convex-selfhost/retention-health-check.ps1` ↔ `convex/retention.ts` — a cross-repo boundary between a version-controlled TS file and an unversioned PS1. D-07 makes it a live read; Phase 113's debt sweep brings the PS1 side into git.

</code_context>

<specifics>
## Specific Ideas

- The measurements that grounded these decisions were taken live on 2026-08-10 against the self-hosted backend and should be re-derived, not trusted blindly, if planning happens much later: `aggregates` spans 2026-05-05 → today; ~1,593 rows written per day (1,455 hourly / 138 daily); exactly 90 rows older than 90 days; a `>30d` bounded probe at `take(5001)` returned `SystemTimeoutError` while the `>90d` probe returned instantly — itself a reminder that unbounded-ish reads on this table are already near the edge.
- DUR-02's evidence must be *pasted verbatim* into the phase evidence file, matching the pattern Phase 108/109 used (`108-ENGINE-05-EVIDENCE.md`, `109-LIVE-EVIDENCE.md`) — command transcript and raw output, not a summary.
- Every DUR-02 leg should carry a control. A table reading "caught up" is ambiguous between pruned, empty, and nothing-aged-out; the terminal log line is what disambiguates a completed pass from a quiet one.

</specifics>

<deferred>
## Deferred Ideas

- **A persisted `retentionRuns` table** (per-run record of tables covered, docs deleted, cap-hit) with a CodePulse widget — rejected for this phase in D-08 to avoid adding writes to the module that exists to reduce them. Worth revisiting if the rotation cursor turns out to need siblings.
- **Retiring `ConvexNightlyRestart`** — explicitly out of scope per D-10; revisit only after a measured, sustained flattening of the growth curve.
- **Bounding `llmMetrics`** — the other keep-forever table that grows with real traffic. Untouched here; DUR-01 names `aggregates` only.
- **Bringing `convex-selfhost/` under version control** — already owned by Phase 113 (Debt Sweep). D-07 leaves the PS1 edit outside git until then.

</deferred>

---

*Phase: 110-Convex Durability*
*Context gathered: 2026-08-10*
