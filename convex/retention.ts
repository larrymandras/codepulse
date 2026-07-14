import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

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
  // runtime firehose — 30 days
  runtime_events: 30,
  toolExecutions: 30,
  activeTime: 30,
  selfHealingEvents: 30,
  fileOps: 30,
  heartbeatAlerts: 30,
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
  },
  handler: async (ctx, args) => {
    const table = PRUNED_TABLES[args.tableIndex];
    if (!table) return;
    if (args.batchesUsed >= MAX_BATCHES_PER_NIGHT) {
      console.log(`retention: nightly batch cap (${MAX_BATCHES_PER_NIGHT}) hit at ${table}; remainder deferred to tomorrow`);
      return;
    }
    const cutoffMs = args.nowMs - RETENTION_DAYS[table] * 86400 * 1000;
    // Default query order is _creationTime ascending — oldest docs first,
    // served by the built-in creation-time index (no table scan).
    const batch = await ctx.db.query(table as any).order("asc").take(BATCH_SIZE);
    let deleted = 0;
    for (const doc of batch) {
      if (doc._creationTime < cutoffMs) {
        await ctx.db.delete(doc._id);
        deleted++;
      } else {
        break; // ascending order: first young doc means the rest are younger
      }
    }
    const total = args.deletedSoFar + deleted;
    if (deleted === BATCH_SIZE) {
      await ctx.scheduler.runAfter(RESCHEDULE_DELAY_MS, internal.retention.pruneBatchV3, {
        tableIndex: args.tableIndex,
        nowMs: args.nowMs,
        deletedSoFar: total,
        batchesUsed: args.batchesUsed + 1,
      });
    } else {
      if (total > 0) console.log(`retention: ${table} done, pruned ${total} docs`);
      if (args.tableIndex + 1 < PRUNED_TABLES.length) {
        await ctx.scheduler.runAfter(RESCHEDULE_DELAY_MS, internal.retention.pruneBatchV3, {
          tableIndex: args.tableIndex + 1,
          nowMs: args.nowMs,
          deletedSoFar: 0,
          batchesUsed: args.batchesUsed + 1,
        });
      } else {
        console.log("retention: all tables pruned");
      }
    }
  },
});
