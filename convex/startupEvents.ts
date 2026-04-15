import { query } from "./_generated/server";
import { v } from "convex/values";

export const recent = query({
  args: {
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    // Fetch recent startup events
    const events = await ctx.db
      .query("startupEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit * 10); // overfetch to find latest batch

    if (events.length === 0) {
      return [];
    }

    // Return events sharing the same startup waterfall:
    // all events within 1 second of the most recent timestamp
    const maxTimestamp = events[0].timestamp;
    const windowMs = 1000; // 1 second window
    const latestBatch = events.filter(
      (e) => maxTimestamp - e.timestamp <= windowMs
    );

    return latestBatch.slice(0, limit);
  },
});
