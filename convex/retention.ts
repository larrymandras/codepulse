import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { planNextPruneStep } from "./retentionCursor";

// Nightly retention pruning (2026-07-14, revised after the self-hosted
// migration incidents — full history in memory note "convex-selfhosted-setup").
//
// Policy (decided with Larry 2026-07-14): high-rate runtime firehose tables
// keep 30 days; build/history event tables keep 90 days. Aggregates, llmMetrics
// (cost history), sessions, alerts, and config/audit tables are kept forever —
// trend dashboards keep working; only drill-down to old raw events ages out.
// The historical backlog was applied OFFLINE (trim_export.py on the export zip
// + reimport), so nightly runs only age out ~1 day of docs.
//
// Operational constraints learned the hard way:
// - Deletes are batched (200 docs/mutation, 3s apart, tables sequential):
//   parallel chains starved ingest on SQLite's single writer.
// - MAX_BATCHES_PER_NIGHT caps each run: mass deletes create tombstones that
//   inflate boot memory until the ~2-day retention GC (OOM crash-loop cause).
//   If the cap is hit, the log says so and the remainder waits for tomorrow.

const RETENTION_DAYS: Record<string, number> = {
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
  // build/history — 90 days
  events: 90,
  environmentSnapshots: 90,
  contextSnapshots: 90,
  metricSnapshots: 90,
  securityEvents: 90,
  cronExecutions: 90,
  jobLifecycle: 90,
  agentCoordination: 90,
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

    let deleted = 0;
    let lastCreationTime: number | null = null;
    for (const doc of batch) {
      await ctx.db.delete(doc._id);
      deleted++;
      lastCreationTime = doc._creationTime;
    }

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
