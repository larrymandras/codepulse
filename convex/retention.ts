import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// Nightly retention pruning (added 2026-07-14 after the self-hosted migration).
// Raw telemetry events are the ~90% bulk of the DB (events + runtime_events
// alone were ~3GB / >2.5M docs) and made snapshot exports, cold boots, and the
// maintenance sweeps time out on self-hosted Convex. Aggregates, llmMetrics
// (cost history), sessions, alerts, and config/audit tables are kept forever —
// trend dashboards keep working; only drill-down to old raw events ages out.
//
// Tables are pruned SEQUENTIALLY, one small batch at a time (the first version
// ran 14 parallel delete chains and starved ingest on SQLite's single writer).
// Each batch walks oldest-first by _creationTime via the built-in index.

export const RETENTION_DAYS = 90;
const BATCH_SIZE = 200;
const RESCHEDULE_DELAY_MS = 3000;

// Raw per-event tables only. Do NOT add: sessions, llmMetrics, aggregates,
// alerts, agentConfigs, configChanges, graphSnapshot* (version-based retention).
const PRUNED_TABLES = [
  "events",
  "runtime_events",
  "selfHealingEvents",
  "toolExecutions",
  "environmentSnapshots",
  "activeTime",
  "fileOps",
  "contextSnapshots",
  "metricSnapshots",
  "securityEvents",
  "cronExecutions",
  "jobLifecycle",
  "heartbeatAlerts",
  "agentCoordination",
];

export const startNightlyPrune = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoffMs = Date.now() - RETENTION_DAYS * 86400 * 1000;
    await ctx.scheduler.runAfter(0, internal.retention.pruneBatch, {
      tableIndex: 0,
      cutoffMs,
      deletedSoFar: 0,
    });
    console.log(`retention: sequential prune started, cutoff ${new Date(cutoffMs).toISOString()}`);
  },
});

export const pruneBatch = internalMutation({
  args: {
    tableIndex: v.number(),
    cutoffMs: v.number(),
    deletedSoFar: v.number(),
  },
  handler: async (ctx, args) => {
    const table = PRUNED_TABLES[args.tableIndex];
    if (!table) return;
    const batch = await ctx.db.query(table as any).order("asc").take(BATCH_SIZE);
    let deleted = 0;
    for (const doc of batch) {
      if (doc._creationTime < args.cutoffMs) {
        await ctx.db.delete(doc._id);
        deleted++;
      } else {
        break; // ascending order: first young doc means the rest are younger
      }
    }
    const total = args.deletedSoFar + deleted;
    if (deleted === BATCH_SIZE) {
      // More old docs in this table — continue after a pause so ingest breathes.
      await ctx.scheduler.runAfter(RESCHEDULE_DELAY_MS, internal.retention.pruneBatch, {
        tableIndex: args.tableIndex,
        cutoffMs: args.cutoffMs,
        deletedSoFar: total,
      });
    } else {
      if (total > 0) console.log(`retention: ${table} done, pruned ${total} docs`);
      if (args.tableIndex + 1 < PRUNED_TABLES.length) {
        await ctx.scheduler.runAfter(RESCHEDULE_DELAY_MS, internal.retention.pruneBatch, {
          tableIndex: args.tableIndex + 1,
          cutoffMs: args.cutoffMs,
          deletedSoFar: 0,
        });
      } else {
        console.log("retention: all tables pruned");
      }
    }
  },
});

// Emergency stop: cancels every pending retention.pruneBatch scheduled job.
export const cancelAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.db.system
      .query("_scheduled_functions")
      .filter((q) => q.eq(q.field("state.kind"), "pending"))
      .collect();
    let cancelled = 0;
    for (const job of pending) {
      if (String(job.name).includes("retention")) {
        await ctx.scheduler.cancel(job._id);
        cancelled++;
      }
    }
    console.log(`retention: cancelled ${cancelled} pending prune jobs`);
  },
});
