import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  planNextPruneStep,
  partitionBatchForPrune,
  resolveRotationStart,
  planRotationWrite,
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
  // build/history — 90 days
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

export const startNightlyPrune = internalMutation({
  args: {},
  handler: async (ctx) => {
    const nowMs = Date.now();
    await ctx.scheduler.runAfter(0, internal.retention.pruneBatchV3, {
      tableIndex: 0,
      nowMs,
      deletedSoFar: 0,
      batchesUsed: 0,
    });
    console.log("retention: nightly prune started");
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
  },
  handler: async (ctx, args) => {
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

    if (next.action === "cap-reached") {
      // Report the count here too: this path returns BEFORE the per-table "done" log below, so
      // without it a capped run deletes silently and the next morning's check cannot tell whether
      // the run did any work or stalled. (Found 2026-07-30 by actually running a capped batch.)
      console.log(
        `retention: nightly batch cap (${MAX_BATCHES_PER_NIGHT}) hit at ${table} after pruning ${total} docs; remainder deferred to tomorrow`
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
      });
      return;
    }

    console.log("retention: all tables pruned");
  },
});
