import { internalMutation, internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const BATCH_SIZE = 500;

/**
 * Inspect the `skills` table by origin. Read-only.
 *
 * Used to identify orphaned origins: `computeSkillPrunes` only prunes origins that
 * are PRESENT in an incoming snapshot, so an origin the scanner stops emitting
 * survives forever. That happened with `claude-code:project:<hash>` rows produced
 * when a session's cwd was the home directory (see hooks/skillScan.mjs).
 */
export const listSkillOrigins = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("skills").collect();
    const byOrigin = new Map<string, { count: number; sampleName: string; sampleSource?: string }>();
    for (const r of rows) {
      const o = r.origin ?? "unknown";
      const cur = byOrigin.get(o);
      if (cur) cur.count++;
      else byOrigin.set(o, { count: 1, sampleName: r.name, sampleSource: r.source });
    }
    return {
      total: rows.length,
      origins: [...byOrigin.entries()]
        .map(([origin, v]) => ({ origin, ...v }))
        .sort((a, b) => b.count - a.count),
    };
  },
});

/**
 * Delete every `skills` row for one origin. Dry-run unless `apply: true`.
 * Deliberately NOT batched-with-continuation: the orphan origins are ~130 rows each.
 */
export const purgeSkillsByOrigin = internalMutation({
  args: { origin: v.string(), apply: v.optional(v.boolean()) },
  handler: async (ctx, { origin, apply }) => {
    const rows = (await ctx.db.query("skills").collect()).filter((r) => (r.origin ?? "unknown") === origin);
    if (!apply) {
      return { origin, matched: rows.length, deleted: 0, dryRun: true, names: rows.slice(0, 5).map((r) => r.name) };
    }
    for (const r of rows) await ctx.db.delete(r._id);
    return { origin, matched: rows.length, deleted: rows.length, dryRun: false };
  },
});

/**
 * Purge events with sessionId="unknown" in batches.
 */
export const purgeUnknownEventsBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db
      .query("events")
      .withIndex("by_session", (q) => q.eq("sessionId", "unknown"))
      .take(BATCH_SIZE);

    for (const event of events) {
      await ctx.db.delete(event._id);
    }

    return { deleted: events.length, done: events.length < BATCH_SIZE };
  },
});

/**
 * Purge toolExecutions with sessionId="unknown" in batches.
 */
export const purgeUnknownToolExecBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("toolExecutions")
      .withIndex("by_session", (q) => q.eq("sessionId", "unknown"))
      .take(BATCH_SIZE);

    for (const row of rows) {
      await ctx.db.delete(row._id);
    }

    return { deleted: rows.length, done: rows.length < BATCH_SIZE };
  },
});

/**
 * Purge fileOps with sessionId="unknown" in batches.
 */
export const purgeUnknownFileOpsBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("fileOps")
      .withIndex("by_session", (q) => q.eq("sessionId", "unknown"))
      .take(BATCH_SIZE);

    for (const row of rows) {
      await ctx.db.delete(row._id);
    }

    return { deleted: rows.length, done: rows.length < BATCH_SIZE };
  },
});

/**
 * Purge contextSnapshots with sessionId="unknown" in batches.
 */
export const purgeUnknownSnapshotsBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("contextSnapshots")
      .withIndex("by_session", (q) => q.eq("sessionId", "unknown"))
      .take(BATCH_SIZE);

    for (const row of rows) {
      await ctx.db.delete(row._id);
    }

    return { deleted: rows.length, done: rows.length < BATCH_SIZE };
  },
});

/**
 * Purge agents with sessionId="unknown" in batches.
 */
export const purgeUnknownAgentsBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("agents")
      .withIndex("by_session", (q) => q.eq("sessionId", "unknown"))
      .take(BATCH_SIZE);

    for (const row of rows) {
      await ctx.db.delete(row._id);
    }

    return { deleted: rows.length, done: rows.length < BATCH_SIZE };
  },
});

/**
 * Delete the "unknown" session record and reset eventCounts on real sessions.
 */
export const cleanupSessionRecords = internalMutation({
  args: {},
  handler: async (ctx) => {
    const unknownSession = await ctx.db
      .query("sessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", "unknown"))
      .first();

    if (unknownSession) {
      await ctx.db.delete(unknownSession._id);
    }

    // Recalculate eventCounts on real sessions
    const sessions = await ctx.db.query("sessions").collect();
    let updated = 0;

    for (const session of sessions) {
      const events = await ctx.db
        .query("events")
        .withIndex("by_session", (q) => q.eq("sessionId", session.sessionId))
        .collect();

      if (events.length !== session.eventCount) {
        await ctx.db.patch(session._id, { eventCount: events.length });
        updated++;
      }
    }

    return { deletedUnknown: !!unknownSession, sessionsUpdated: updated };
  },
});

/**
 * Orchestrator: Purge all "unknown" session data and clean up.
 */
export const runFullPurge = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log("[purge] Starting cleanup of unknown-session data...");

    const tables = [
      { name: "events", fn: internal.migrations.purgeUnknownEventsBatch },
      { name: "toolExecutions", fn: internal.migrations.purgeUnknownToolExecBatch },
      { name: "fileOps", fn: internal.migrations.purgeUnknownFileOpsBatch },
      { name: "contextSnapshots", fn: internal.migrations.purgeUnknownSnapshotsBatch },
      { name: "agents", fn: internal.migrations.purgeUnknownAgentsBatch },
    ] as const;

    for (const { name, fn } of tables) {
      let total = 0;
      let done = false;

      while (!done) {
        const result: any = await ctx.runMutation(fn, {});
        total += result.deleted;
        done = result.done;
      }
      console.log(`[purge] ${name}: deleted ${total} rows`);
    }

    const cleanup: any = await ctx.runMutation(
      internal.migrations.cleanupSessionRecords,
      {}
    );
    console.log(`[purge] Deleted unknown session: ${cleanup.deletedUnknown}, updated ${cleanup.sessionsUpdated} session counts`);

    console.log("[purge] Complete! New sessions will track correctly.");
  },
});
