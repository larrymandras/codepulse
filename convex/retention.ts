import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  planNextPruneStep,
  partitionBatchForPrune,
  resolveRotationStart,
  planRotationWrite,
  summarizeOverhangProbe,
} from "./retentionCursor";

// Nightly retention pruning (2026-07-14, revised after the self-hosted
// migration incidents — full history in memory note "convex-selfhosted-setup").
//
// Policy (decided with Larry 2026-07-14): high-rate runtime firehose tables
// keep 14 days (cut from 30 on 2026-07-17 — see the tier comment below; this
// line said 30 until 2026-07-31 and contradicted the table); poll snapshots
// keep 30 days; build/history event tables keep 90 days. `aggregates` is
// bounded period-aware (Phase 110 D-01): `period:"hourly"` rows age out at
// 90 days like their build/history siblings below, while `period:"daily"`
// rows are kept forever, protected by PRUNE_PREDICATES (below) rather than
// by absence from this policy. llmMetrics (cost history), sessions, alerts,
// and config/audit tables are kept forever outright — trend dashboards keep
// working; only drill-down to old raw events ages out.
// The historical backlog was applied OFFLINE (trim_export.py on the export zip
// + reimport), so nightly runs only age out ~1 day of docs.
//
// Operational constraints learned the hard way:
// - Deletes are batched (200 docs/mutation, 3s apart, tables sequential):
//   parallel chains starved ingest on SQLite's single writer.
// - MAX_BATCHES_PER_NIGHT caps each run: mass deletes create tombstones that
//   inflate boot memory until the ~2-day retention GC (OOM crash-loop cause).
//   If the cap is hit, the log says so and the remainder waits for tomorrow.

// Exported for retention.test.ts, which asserts every key here is a REAL schema
// table: a typo'd table name is a permanent SILENT no-op — the nightly prune
// simply never deletes anything for it and nothing ever reports the mismatch.
export const RETENTION_DAYS: Record<string, number> = {
  // runtime firehose — 14 days (cut from 30d 2026-07-17 w/ Larry: 30d steady
  // state was ~896k runtime_events pushing the snapshot-export peak >48g into an
  // OOM loop; 14d ~halves it. Bulk cut applied offline via trim+reimport, so the
  // nightly prune only ages ~1 day going forward — no tombstone mass-delete.)
  runtime_events: 14,
  toolExecutions: 14,
  activeTime: 14,
  selfHealingEvents: 14,
  fileOps: 14,
  heartbeatAlerts: 14,
  // poll snapshots — 30 days (added 2026-07-31, Phase 104 D-20). The 5-minute
  // gatewayQuota poller was DEAD before this phase (`gatewayQuota:latestByProvider`
  // returned []), so this table never grew and was never pruned. D-20 repointed the
  // poller at the CLI-gateway sidecar and revives it, which turns a permanently-empty
  // table into ~288 rows/provider/day forever on the instance that has already gone
  // down twice from read growth. Bounding it here BEFORE the poller runs in anger
  // avoids ever needing a mass delete (which is what created the tombstone storms
  // this whole module exists to avoid). Only the latest row per provider is ever
  // read, so 30 days is pure headroom for trend queries, not a functional limit.
  gatewayQuotaSnapshots: 30,
  // Enrolled 2026-08-21 from COVERAGE_PRUNE_PROPOSED, after the coverage gate
  // (convex/retentionCoverage.ts) surfaced that 143 tables had no retention
  // decision at all. Rates below were measured on the live backend that day as
  // oldest-row -> newest-row over current row count. Each was checked for a
  // status/acknowledgement field first, because pruneBatchV3 deletes by
  // whole-table _creationTime and cannot tell a handled row from an unhandled
  // one — that check is what kept `inbox` out (see the note at the end).
  //
  // advisorEvents, 155.5 rows/day. Every consumer in convex/advisorEvents.ts
  // (recent, savingsSummary, providerMetrics) is a newest-first .take(50) or
  // .take(100), so nothing reads even one full day back; 30 days is headroom,
  // not a functional limit. It carries costUsd, but llmMetrics remains the
  // kept-forever cost history — this is the advisor-specific event stream.
  advisorEvents: 30,
  // promptSubmissions, 104.0 rows/day. Pure telemetry — sessionId,
  // promptLength, promptId, timestamp. No status field, nothing to strand.
  promptSubmissions: 30,
  // supabaseHealth, 125.0 rows/day. supabase.ts:27 .collect()s the WHOLE table
  // and then dedupes to the latest row per service, so only the newest is ever
  // used and pruning actively shrinks an unbounded read.
  supabaseHealth: 30,
  // build/history — 90 days
  // episodicEvents, 96.2 rows/day, enrolled 2026-08-21 alongside the three
  // 30-day entries above. Despite the name this is NOT memory content — its
  // eventType is "memory_stored" | "memory_recalled" | "memory_pruned", i.e. an
  // audit log ABOUT memory operations, and the memories themselves live outside
  // Convex. 90 days matches what the deleted convex/dataRetention.ts's
  // purgeOldMemoryEvents had targeted for this same table before it was
  // superseded by Phase 110 and left uncalled.
  episodicEvents: 90,
  events: 90,
  environmentSnapshots: 90,
  contextSnapshots: 90,
  metricSnapshots: 90,
  securityEvents: 90,
  cronExecutions: 90,
  jobLifecycle: 90,
  agentCoordination: 90,
  // Phase 105 D-05 — new table, bounded BEFORE it can ever need a mass
  // delete (the same pre-emptive move D-20 made for gatewayQuotaSnapshots).
  // Policy events are low-volume (boot/reload fire once per boot; denials
  // and leaks are rare by design), so 90 days keeps the feed useful across
  // a milestone without exposing the instance to another tombstone-storm
  // incident; 14 would age the signal out faster than an operator would
  // notice it.
  toolPolicyEvents: 90,
  // Phase 108 D-10 — new table, bounded BEFORE it can ever grow (same
  // pre-emptive move as gatewayQuotaSnapshots/toolPolicyEvents above). Only
  // the latest row per profile is ever read via activeEngine.latestByProfile,
  // so any window is pure headroom, not a functional limit.
  activeEngineSnapshots: 30,
  // Phase 108 D-14 — new table, same tier as activeEngineSnapshots above
  // (keeps the mental model simple: both are Phase 108's new per-profile
  // engine-axis tables). Swap-history is a manual/rare operator action
  // (D-15's "what did I last switch this to"), so 30 days is ample without
  // reaching for the 90-day build/history tier reserved for higher-value
  // long-horizon tables.
  controlVerbSwaps: 30,

  // Phase 112 D-06 — new table, bounded BEFORE it can ever grow (same
  // pre-emptive move as gatewayQuotaSnapshots/toolPolicyEvents/
  // activeEngineSnapshots/controlVerbSwaps above). Measured 2026-08-12:
  // 83.3 rows/day, 1,168 rows in the 14-day window — read via a bounded
  // `.take()` audit list, same read pattern as controlVerbSwaps, not a
  // latest-per-key lookup, so it takes the same 30-day tier. Applied
  // pre-emptively, before this table can ever need a mass delete — a mass
  // delete is exactly what created the tombstone storms this module
  // exists to avoid.
  governorDecisions: 30,
  // Phase 112 D-06 — new table, bounded BEFORE it can ever grow, same
  // rationale as governorDecisions above. Measured 2026-08-12: 0.7-1.2
  // rows/day, 10 rows in the 14-day window — rare-event tier, matching
  // toolPolicyEvents' tier rather than controlVerbSwaps'/
  // activeEngineSnapshots' 30-day tier, since at this volume the window
  // is pure headroom regardless of value chosen. Applied pre-emptively,
  // before this table can ever need a mass delete — a mass delete is
  // exactly what created the tombstone storms this module exists to
  // avoid.
  messageRoutes: 90,

  // Phase 110 D-01/D-04: `aggregates` is bounded period-aware, not simply
  // added to the 90-day build/history tier above like its siblings. Only
  // `period:"hourly"` rows are prunable; `period:"daily"` rows are kept
  // forever, protected by PRUNE_PREDICATES.aggregates below rather than by
  // absence from this map. Daily rows must survive because Phase 104
  // re-prices dollars from daily buckets on every read — see
  // convex/costDerived.ts's computePeriodSpend, whose own comment describes
  // the daily/hourly split as "DISJOINT BY CONSTRUCTION". This number alone
  // does not protect daily rows; PRUNE_PREDICATES is what does. The
  // eligibility cut below is on `_creationTime` in MILLISECONDS, exactly like
  // every other table here — never `bucket_start`, which is epoch SECONDS
  // (convex/schema.ts). Measured 2026-08-10: ~1,455 hourly + 138 daily
  // rows/day, with exactly 90 rows older than 90 days — the first nightly
  // pass carries effectively no backlog.
  aggregates: 90,

  // Phase 116 D-13: `prompts` is deliberately EXEMPT from RETENTION_DAYS — do
  // not add it as a key here. Every other new table above was bounded
  // pre-emptively because it is a firehose (gatewayQuotaSnapshots per Phase
  // 104 D-20, toolPolicyEvents per Phase 105 D-05, activeEngineSnapshots and
  // controlVerbSwaps per Phase 108 D-10/D-14); a curated Galdr prompt library
  // is the opposite of a firehose, and a 90-day window would silently delete
  // a prompt for the sole offence of going a quarter unused.
  // `promptVersions` — the table that actually grows — IS bounded, but by a
  // different mechanism: newest-20-per-prompt, pruned inline in
  // convex/galdr.ts's save/restore mutations, keyed by edit frequency rather
  // than calendar age.
  // Do NOT "fix" this by adding `prompts` or `promptVersions` here: it would
  // be syntactically valid and would pass retention.test.ts's table-existence
  // check, but is semantically wrong — pruneBatchV3 deletes by `_creationTime`
  // cutoff across the WHOLE table, so it would delete versions of
  // actively-edited prompts exactly as readily as abandoned ones.

  // Phase 118 D-03: `media`, `mediaStyles` and `mediaModels` are deliberately
  // EXEMPT from RETENTION_DAYS — do not add them as keys here. Same shape as
  // the `prompts`/`promptVersions` exemption directly above: these are
  // curated libraries, the opposite of a firehose, and pruneBatchV3 deletes
  // by whole-table `_creationTime` cutoff — so a calendar rule would delete a
  // starred image for the sole offence of being old.
  // `media` — the table that actually grows — IS bounded, but by a different
  // mechanism: the Phase 118 D-08 janitor's 30-day sweep over `deletedAt`,
  // keyed by the operator's own delete action rather than by calendar age,
  // the same "different mechanism, deliberately" structure the block above
  // uses for `promptVersions`.
  // Do NOT "fix" this by adding `media`, `mediaStyles` or `mediaModels` here:
  // it would be syntactically valid and would pass retention.test.ts's
  // table-existence check, but is semantically wrong — it would delete a
  // starred, actively-curated image exactly as readily as an abandoned one.
};

// Phase 110 D-01/D-02/D-03: per-table predicate applied AFTER the batch query
// below returns — never folded into the query itself, which would break the
// `by_creation_time` cursor-seek machinery D-02 requires reusing unmodified.
// A table absent from this map is pruned unconditionally, exactly as before
// this phase.
//
// This function IS the positive guard (D-03): retention.test.ts asserts
// against it directly, not against a comment, so an inverted or removed
// predicate fails a test immediately instead of silently deleting
// re-priceable daily cost history on the next nightly run.
//
// A second, pre-existing writer over `aggregates` already exists:
// convex/analyticsRollup.ts's clearHistoricalBucketsPage deletes by
// `bucket_start` through the `by_type_period_bucket` index — a different
// index and field than this predicate's `_creationTime`-keyed nightly prune,
// so the two never collide. Documented here so a future editor doesn't
// rediscover it as a surprise.
export const PRUNE_PREDICATES: Partial<Record<string, (doc: any) => boolean>> = {
  aggregates: (doc) => doc.period !== "daily",
};

const PRUNED_TABLES = Object.keys(RETENTION_DAYS);
const BATCH_SIZE = 200;
const RESCHEDULE_DELAY_MS = 3000;
const MAX_BATCHES_PER_NIGHT = 600; // hard ceiling ~120k docs/night across the run

// Phase 110 D-05/D-06: the single persisted `agentConfigs` row the nightly chain
// rotates its start index through. Patched (never inserted-per-run) — see the
// get-existing-or-patch idiom below, copied from convex/webhookDelivery.ts's
// setChannel. Do NOT copy convex/aggregates.ts's backfill cursors instead: those
// are insert-only and grow one row per invocation, which is correct for a rare
// operator-run backfill but would add ~365 rows/year here — the exact unbounded
// growth this whole phase exists to prevent.
const ROTATION_CURSOR_KEY = "retention.rotationCursor";

export const startNightlyPrune = internalMutation({
  args: {},
  handler: async (ctx) => {
    const nowMs = Date.now();
    // D-05: resume where the last capped run stopped instead of always restarting
    // at index 0 (which, pre-Phase-110, meant the firehose head starved every
    // table past it on any night the batch cap was hit). D-06/T-110-03-01: the
    // persisted value is untrusted — resolveRotationStart bounds-checks it fresh
    // against PRUNED_TABLES.length on every call and never throws.
    const existingCursor = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", ROTATION_CURSOR_KEY))
      .first();
    const startIndex = resolveRotationStart(existingCursor?.value, PRUNED_TABLES.length);
    await ctx.scheduler.runAfter(0, internal.retention.pruneBatchV3, {
      tableIndex: startIndex,
      startIndex,
      nowMs,
      deletedSoFar: 0,
      batchesUsed: 0,
    });
    console.log(`retention: nightly prune started (start index ${startIndex})`);
  },
});

// V3 name retained: earlier signatures are burned — their pending scheduled
// jobs were drained by making them fail validation (see incident notes).
export const pruneBatchV3 = internalMutation({
  args: {
    tableIndex: v.number(),
    nowMs: v.number(),
    deletedSoFar: v.number(),
    batchesUsed: v.number(),
    /**
     * Inclusive lower bound for this batch's index seek (2026-07-30 fix). Optional so any
     * already-scheduled job from the old signature still runs — it simply starts at the head, which
     * is correct for a table's first batch.
     */
    cursorMs: v.optional(v.number()),
    /**
     * Phase 110 D-05/D-06: the table index THIS RUN started at, threaded unchanged through
     * every reschedule so the terminal log lines can report it. Optional for the same reason
     * cursorMs is optional — an already-scheduled job from the pre-Phase-110 signature must
     * still validate; a required arg would fail them. Resolved as `args.startIndex ??
     * args.tableIndex` below, which for a legacy job reports it as starting exactly where it
     * is — always 0 pre-rotation, since startNightlyPrune hardcoded that until this plan.
     */
    startIndex: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const startIndex = args.startIndex ?? args.tableIndex;
    const table = PRUNED_TABLES[args.tableIndex];
    if (!table) return;
    if (args.batchesUsed >= MAX_BATCHES_PER_NIGHT) {
      console.log(`retention: nightly batch cap (${MAX_BATCHES_PER_NIGHT}) already exhausted before ${table}; remainder deferred to tomorrow`);
      return;
    }
    const cutoffMs = args.nowMs - RETENTION_DAYS[table] * 86400 * 1000;
    const cursorMs = args.cursorMs ?? 0;

    // 2026-07-30: seek to `cursorMs` instead of re-scanning from the head, and bound the range by
    // the cutoff so every returned doc is already eligible for deletion.
    //
    // The old form — `.query(table).order("asc").take(BATCH_SIZE)` — restarted at the head on EVERY
    // batch, so batch k walked past the ~200×(k-1) tombstones its own predecessors had just made.
    // Those tombstones live until DOCUMENT_RETENTION_DELAY (1800s) collects them, and a full run
    // takes ~30 min at 3s/batch, so none of them were ever GC'd mid-run. The scan degraded until the
    // isolate blew its time limit (SystemTimeout on 2026-07-29 and 2026-07-30). Because the abort
    // skips the reschedule below, the whole chain died at table index 0 (`runtime_events`) and the
    // other 13 tables went unpruned every night. See convex/retentionCursor.ts for the full write-up.
    const batch = await ctx.db
      .query(table as any)
      .withIndex("by_creation_time", (q: any) =>
        q.gte("_creationTime", cursorMs).lt("_creationTime", cutoffMs)
      )
      .order("asc")
      .take(BATCH_SIZE);

    // Phase 110 D-02: split into delete-vs-skip via the tested helper. `lastCreationTime` is
    // sourced from EVERY doc iterated, deleted or skipped — see partitionBatchForPrune's own
    // docstring for why (Pitfall 1: an all-skipped batch must still advance the cursor).
    const { toDelete, lastCreationTime } = partitionBatchForPrune(batch, PRUNE_PREDICATES[table]);
    for (const doc of toDelete) {
      await ctx.db.delete(doc._id);
    }
    const deleted = toDelete.length;

    const total = args.deletedSoFar + deleted;
    const next = planNextPruneStep({
      batchLength: batch.length,
      lastCreationTime,
      cursorMs,
      tableIndex: args.tableIndex,
      tableCount: PRUNED_TABLES.length,
      batchesUsed: args.batchesUsed,
      maxBatches: MAX_BATCHES_PER_NIGHT,
      batchSize: BATCH_SIZE,
    });

    // Phase 110 D-06: the rotation cursor writes ONLY at the two chain-terminal actions —
    // planRotationWrite returns null for "continue-table"/"next-table", so the interior of a
    // run never writes agentConfigs (that would be up to MAX_BATCHES_PER_NIGHT writes/night,
    // which D-08 rejects for a module whose whole purpose is reducing writes to the live
    // instance). Done once, here, before either terminal branch below — not duplicated per
    // branch.
    const rotationWrite = planRotationWrite(next.action, args.tableIndex);
    if (rotationWrite !== null) {
      const existingCursor = await ctx.db
        .query("agentConfigs")
        .withIndex("by_key", (q) => q.eq("configKey", ROTATION_CURSOR_KEY))
        .first();
      if (existingCursor) {
        await ctx.db.patch(existingCursor._id, {
          value: rotationWrite,
          updatedAt: Date.now() / 1000,
        });
      } else {
        await ctx.db.insert("agentConfigs", {
          configKey: ROTATION_CURSOR_KEY,
          value: rotationWrite,
          source: "runtime",
          updatedAt: Date.now() / 1000,
        });
      }
    }

    if (next.action === "cap-reached") {
      // Report the count here too: this path returns BEFORE the per-table "done" log below, so
      // without it a capped run deletes silently and the next morning's check cannot tell whether
      // the run did any work or stalled. (Found 2026-07-30 by actually running a capped batch.)
      // Phase 110 D-05: the appended start index lets a capped run's log line be read against
      // the NEXT run's start-index log line to confirm the resume actually happened.
      console.log(
        `retention: nightly batch cap (${MAX_BATCHES_PER_NIGHT}) hit at ${table} after pruning ${total} docs; remainder deferred to tomorrow (start index ${startIndex})`
      );
      return;
    }

    if (next.action === "continue-table") {
      await ctx.scheduler.runAfter(RESCHEDULE_DELAY_MS, internal.retention.pruneBatchV3, {
        tableIndex: next.tableIndex,
        nowMs: args.nowMs,
        deletedSoFar: total,
        batchesUsed: args.batchesUsed + 1,
        cursorMs: next.cursorMs,
        startIndex,
      });
      return;
    }

    if (total > 0) console.log(`retention: ${table} done, pruned ${total} docs`);

    if (next.action === "next-table") {
      await ctx.scheduler.runAfter(RESCHEDULE_DELAY_MS, internal.retention.pruneBatchV3, {
        tableIndex: next.tableIndex,
        nowMs: args.nowMs,
        deletedSoFar: 0,
        batchesUsed: args.batchesUsed + 1,
        cursorMs: next.cursorMs,
        startIndex,
      });
      return;
    }

    // Phase 110 D-05/T-110-03-05: with rotation, a run no longer always starts at index 0, so
    // this bare message alone would claim a complete pass for a run that only covered the tail
    // of the table list — and DUR-02's evidence leg rests on exactly this line. The appended
    // start index and coverage counts make the claim self-describing and falsifiable.
    console.log(
      `retention: all tables pruned (start index ${startIndex}, covered ${PRUNED_TABLES.length - startIndex} of ${PRUNED_TABLES.length} tables)`
    );
  },
});

// Phase 110 D-07: a read of the SAME object pruneBatchV3 iterates over above — not a copy. Exists
// so retention-health-check.ps1 can read the live policy instead of hand-copying it into its own
// $RetentionDays hashtable (which has already drifted from RETENTION_DAYS once — see
// 110-PATTERNS.md's D-07 evidence). A copy of this table in any other file is a bug.
//
// Shipped as internalQuery, the secure default (T-110-03-04): this phase adds no new
// publicly-callable endpoint. Plan defect resolved by the 110-03 orchestrator: the task
// description that produced this comment originally called for verifying CLI reachability here
// via `npx convex run retention:listRetentionPolicy` against the deployed backend — but nothing
// in this phase is deployed yet (deploy is plan 110-04, gated on separate operator
// authorization), so that invocation cannot run at this wave and would only ever report
// "function not found," which is not evidence about whether `npx convex run` can reach an
// internalQuery. That empirical check is deferred to 110-04 Task 3, which records the exact
// function form (internalQuery vs. query) against the live deployed backend instead of an
// assumed one.
export const listRetentionPolicy = internalQuery({
  args: {},
  handler: async () => RETENTION_DAYS,
});

// 2026-08-10: the retention-lag probe, moved server-side out of
// retention-health-check.ps1.
//
// The script used to ask the index a question the pruner does not ask —
// `.withIndex('by_creation_time').order('asc').take(1)`, i.e. "what is the oldest doc in this
// table", with no predicate. D-07 had already taught that script to read RETENTION_DAYS live so it
// could never drift from the policy; PRUNE_PREDICATES landed in the SAME phase and the script knew
// nothing about it, so the policy was back in two places — just a different two.
//
// The consequence was not cosmetic. `aggregates` keeps `period:"daily"` rows forever (D-01), so the
// oldest doc in that table is permanently past its own cutoff and ages 24h/day. Against the
// script's 72h FAIL threshold that is an ALERT which no amount of correct pruning can ever clear.
// Verified against the live instance on 2026-08-10: 93 docs past the cutoff, 73 hourly + 20 daily,
// oldest daily already 165.4h over.
//
// Asking it HERE means the probe reuses PRUNE_PREDICATES and partitionBatchForPrune — the very
// objects pruneBatchV3 above runs on, not copies of them — so "what the check measures" and "what
// the pruner deletes" cannot drift apart. The query is deliberately per-table rather than a single
// all-tables sweep: `events` index-head reads intermittently SystemTimeout on this instance under
// memory pressure, and batching all 19 tables into one call would let that one table's timeout
// destroy the other 18 readings.
//
// internalQuery for the same reason listRetentionPolicy is one (T-110-03-04): this adds no
// publicly-callable endpoint. Read-only — it never deletes, so it is safe to run at any hour,
// unlike the nightly chain above.
const PROBE_LIMIT = BATCH_SIZE;

export const oldestPrunableDoc = internalQuery({
  args: { table: v.string() },
  handler: async (ctx, args) => {
    const days = RETENTION_DAYS[args.table];
    if (days === undefined) {
      // Not an error: the caller enumerates tables from listRetentionPolicy, so this can only
      // happen if the two reads straddle a policy edit. Report it as its own status rather than
      // throwing (which the script would see as a timeout) or returning a green (which would hide
      // a table from the check entirely).
      return {
        table: args.table,
        status: "unknown-table" as const,
        retentionDays: null,
        oldestPrunableMs: null,
        overhangHours: null,
        scanned: 0,
      };
    }

    const cutoffMs = Date.now() - days * 86400 * 1000;
    // Byte-for-byte the shape pruneBatchV3 uses for a table's FIRST batch (cursor 0), so this
    // measures the exact read the pruner will perform tonight, not an approximation of it.
    const batch = await ctx.db
      .query(args.table as any)
      .withIndex("by_creation_time", (q: any) =>
        q.gte("_creationTime", 0).lt("_creationTime", cutoffMs)
      )
      .order("asc")
      .take(PROBE_LIMIT);

    const probe = summarizeOverhangProbe({
      batch,
      predicate: PRUNE_PREDICATES[args.table],
      probeLimit: PROBE_LIMIT,
      cutoffMs,
    });

    return { table: args.table, retentionDays: days, ...probe };
  },
});
