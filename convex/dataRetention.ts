import { internalMutation } from "./_generated/server";

const BATCH_SIZE = 500;

// Delete telemetry events older than 30 days
export const purgeOldTelemetryEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() / 1000 - 30 * 86400;
    const old = await ctx.db
      .query("events")
      .withIndex("by_timestamp")
      .filter((q) => q.lt(q.field("timestamp"), cutoff))
      .take(BATCH_SIZE);

    for (const doc of old) {
      await ctx.db.delete(doc._id);
    }
    return { deleted: old.length };
  },
});

// Delete heartbeat alerts older than 7 days
export const purgeOldHeartbeatAlerts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() / 1000 - 7 * 86400;
    const old = await ctx.db
      .query("heartbeatAlerts")
      .withIndex("by_timestamp")
      .filter((q) => q.lt(q.field("timestamp"), cutoff))
      .take(BATCH_SIZE);

    for (const doc of old) {
      await ctx.db.delete(doc._id);
    }
    return { deleted: old.length };
  },
});

// Delete memory (episodic) events older than 90 days
export const purgeOldMemoryEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() / 1000 - 90 * 86400;
    const old = await ctx.db
      .query("episodicEvents")
      .withIndex("by_timestamp")
      .filter((q) => q.lt(q.field("timestamp"), cutoff))
      .take(BATCH_SIZE);

    for (const doc of old) {
      await ctx.db.delete(doc._id);
    }
    return { deleted: old.length };
  },
});
