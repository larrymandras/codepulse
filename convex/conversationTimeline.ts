import { query } from "./_generated/server";
import { v } from "convex/values";

export const buckets = query({
  args: {
    startTime: v.float64(),
    endTime: v.float64(),
    bucketMinutes: v.float64(),
  },
  handler: async (ctx, args) => {
    // Range-bound via the index using the args the caller already provides —
    // the old unbounded take(2000)+JS-filter scanned from the top of the index
    // and died under pressure (2026-07-22 incident).
    const events = await ctx.db
      .query("events")
      .withIndex("by_timestamp2", (q) =>
        q.gte("timestamp", args.startTime).lte("timestamp", args.endTime)
      )
      .order("desc")
      .take(2000);

    const filtered = events.filter(
      (e) => e.eventType === "message_received" || e.eventType === "message_sent"
    );

    const bucketSec = args.bucketMinutes * 60;
    const bucketMap = new Map<string, { timestamp: number; channel: string; inbound: number; outbound: number }>();

    for (const e of filtered) {
      const channel = (e.payload as any)?.channel ?? "unknown";
      const bucketStart = Math.floor(e.timestamp / bucketSec) * bucketSec;
      const key = `${channel}-${bucketStart}`;
      const existing = bucketMap.get(key);

      if (existing) {
        if (e.eventType === "message_received") existing.inbound++;
        else existing.outbound++;
      } else {
        bucketMap.set(key, {
          timestamp: bucketStart,
          channel,
          inbound: e.eventType === "message_received" ? 1 : 0,
          outbound: e.eventType === "message_sent" ? 1 : 0,
        });
      }
    }

    return Array.from(bucketMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  },
});

export const messageDetail = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event) return null;

    const session = await ctx.db
      .query("sessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", event.sessionId))
      .first();

    return {
      ...event,
      sessionStatus: session?.status,
      sessionCwd: session?.cwd,
    };
  },
});
