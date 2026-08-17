# Phase 110: Convex Durability - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-10
**Phase:** 110-Convex Durability
**Areas discussed:** Aggregates prune shape, Window + backlog, DUR-02 proof mechanism, DUR-03 acceptance bar

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Aggregates prune shape | Whole-table vs. period-aware vs. compact-then-prune; the `retention.test.ts` keep-forever guard blocks DUR-01 as written | ✓ |
| Window + backlog | How long to keep and how the first prune drains, given ~1,593 rows/day and a shared 600-batch nightly cap | ✓ |
| DUR-02 proof mechanism | The daily health check already probes live but its table list has drifted from `RETENTION_DAYS` | ✓ |
| DUR-03 acceptance bar | How hard to chase the memory root cause before closing | ✓ |

**User's choice:** all four.

---

## Aggregates prune shape

### How should `aggregates` be bounded, given D-04 keeps it forever today?

| Option | Description | Selected |
|--------|-------------|----------|
| Period-aware: prune hourly, keep daily | 91% of volume is hourly; `costDerived.ts:415` already treats daily as the long-horizon source. Needs a period-filtered chain, since `pruneBatchV3` cuts on `_creationTime` across the whole table | ✓ |
| Whole-table window | One line in `RETENTION_DAYS`, zero new machinery — but cost history hard-stops at N days and the keep-forever guard must be deleted outright | |
| Compact hourly → daily, then prune | Strictly safest for readers, but `rollupDaily` already runs nightly and the compaction's failure mode is silent data loss if it lags the prune | |

**User's choice:** Period-aware.
**Notes:** This is the decision that reconciles DUR-01 with D-04 — cost history survives at day granularity rather than being traded away.

### Where should the period-filtered prune live?

| Option | Description | Selected |
|--------|-------------|----------|
| Extend the existing chain | One batch cap, one nightly run, one place the operator looks; touches a module that has survived two incidents | ✓ |
| Separate aggregates prune chain | Leaves `retention.ts` byte-identical, but two chains means two batch budgets colliding on SQLite's single writer | |
| You decide during planning | Lock behavior, let the planner pick structure | |

**User's choice:** Extend the existing chain.

### What replaces the `retention.test.ts` keep-forever guard?

| Option | Description | Selected |
|--------|-------------|----------|
| Narrow it to a daily-rows-survive guard | Drop `aggregates` from the keep-forever loop, add a positive assertion on the predicate that a `period:"daily"` row can never be deleted | ✓ |
| Delete the aggregates line only | Less test surface; class-level protection stops being enforced anywhere | |
| Guard + a live negative control | The narrowed guard plus a live proof; extra verification leg | |

**User's choice:** Narrow it.

---

## Window + backlog

### How long should `period:"hourly"` rows be kept?

| Option | Description | Selected |
|--------|-------------|----------|
| 90 days — build/history tier | Probed live: exactly 90 rows older than 90 days. Effectively no first drain, no tombstone risk, full quarter of hour-granularity drill-down | ✓ |
| 30 days — poll-snapshot tier | Smaller steady state, but a ~95k-row first drain competing with `runtime_events` for the shared nightly cap | |
| 14 days — firehose tier | ~120k-row drain over 2+ nights, and may cut below readers' hourly lookback windows | |

**User's choice:** 90 days.

### Should the nightly cap's tail-table starvation be addressed here?

| Option | Description | Selected |
|--------|-------------|----------|
| Rotate the start index nightly | Resume at the starved table instead of restarting at `runtime_events`; makes DUR-02's "complete pass" structurally true over time | ✓ |
| Leave the cap alone, make starvation visible | No behavior change; surface the cap-reached line in the DUR-02 work | |
| Defer — note it and move on | The cap has not been hit in normal operation this month | |

**User's choice:** Rotate.
**Notes:** Directly serves DUR-02 rather than being adjacent to it — a pass that can silently skip its tail is not a full pass.

---

## DUR-02 proof mechanism

### How should the health check stop drifting from `RETENTION_DAYS`?

| Option | Description | Selected |
|--------|-------------|----------|
| Derive the list from `retention.ts` at runtime | The hand-sync contract disappears rather than being re-promised; the only open question is how PS 5.1 reads the map | ✓ |
| Keep the copy, add a CI test that fails on drift | Drift becomes loud, but couples a repo test to a file outside git until Phase 113 | |
| Move the check into Convex entirely | No copy can exist, but the PS1 survives anyway for docker memory / db size, which Convex cannot see | |

**User's choice:** Derive at runtime.
**Notes:** Measured drift: 14 entries in the script vs. 18 keys in `RETENTION_DAYS`. Four tables have never been checked; `aggregates` would have been the fifth.

### What counts as proof that a full pass completed?

| Option | Description | Selected |
|--------|-------------|----------|
| Terminal log line + per-table state, captured once | `retention: all tables pruned` from the live container plus an all-tables-caught-up health run, pasted verbatim; two independent halves, no new machinery | ✓ |
| Persist a run record in Convex | Queryable forever instead of a docker ring buffer, at the cost of a new table and writes from the module that exists to reduce writes | |
| Both — record now, persist for later | Close on observed fact and stay observable afterward | |

**User's choice:** Terminal log line + per-table state.

### Where does the rotation cursor live, with no `retentionRuns` table?

| Option | Description | Selected |
|--------|-------------|----------|
| A single row in `agentConfigs` | Existing key-value config store; one row, never grows, nothing to add to `RETENTION_DAYS` | ✓ |
| A dedicated single-row table | Typed schema and obvious ownership, at the cost of a table holding one integer | |
| You decide during planning | Lock behavior, let the planner pick the store | |

**User's choice:** `agentConfigs`.

---

## DUR-03 acceptance bar

### How far should the phase chase the memory-growth driver?

| Option | Description | Selected |
|--------|-------------|----------|
| Probe for a bounding knob first, then document | A knob that bounds growth is durability by design; a negative result is recorded as evidence and DUR-03 closes as documented, which it explicitly permits | ✓ |
| Controlled attribution study | Most likely to name a true root cause; costs days of live sampling and may still land on "this is how the engine behaves" | |
| Close as documented and mitigated | Cheapest; the driver stays unnamed | |

**User's choice:** Probe first, then document.
**Notes:** Two hypotheses are already refuted on record in `health-report.md` (page-cache fraction, OCC retries) — those are DUR-03 evidence, not work to redo.

### If a knob exists, what's the bar for enabling it in production?

| Option | Description | Selected |
|--------|-------------|----------|
| Measured on the live box, restart stays | Compare a full inter-restart cycle against the ~0.17 GiB/h baseline, with `ConvexNightlyRestart` running throughout as the safety net | ✓ |
| Apply and retire the restart if it holds | Cleaner end state; failure mode is an OOM crash-loop on an instance that has already gone down twice | |
| Document the knob, do not apply it | Zero risk; defers the durability improvement | |

**User's choice:** Measured, restart stays.

### Where does the write-up land?

| Option | Description | Selected |
|--------|-------------|----------|
| `CLAUDE.md` ops section + phase evidence file | Evidence file holds raw measurements; the CLAUDE.md section loads every session so the claim cannot go unread | ✓ |
| Add a `convex-selfhost/` runbook too | Where an operator actually looks, but unversioned until Phase 113 | |
| Also update the Claude memory file | Keeps incident history in one cross-project narrative | |

**User's choice:** CLAUDE.md + phase evidence file.

---

## Claude's Discretion

- How `retention-health-check.ps1` reads `RETENTION_DAYS` (generated JSON, inline convex query, or `node -e`) — must be a read of the source of truth, not a second copy.
- The exact shape of the per-table predicate in `pruneBatchV3`, provided `aggregates` stays inside the one sequential chain and one batch cap.
- The `agentConfigs` key name and value shape for the rotation cursor.

## Deferred Ideas

- A persisted `retentionRuns` table plus a CodePulse widget.
- Retiring `ConvexNightlyRestart` (revisit only after a measured, sustained flattening).
- Bounding `llmMetrics` — the other keep-forever table that grows with real traffic.
- Bringing `convex-selfhost/` under version control — already owned by Phase 113.
