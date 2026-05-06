import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

// -- Mutations (called from runtimeIngest) ------------------------------------

/**
 * Insert a canonical event from Astridr TranscriptDeriver.
 */
export const insertCanonicalEvent = mutation({
  args: {
    sessionKey: v.string(),
    eventType: v.string(),
    role: v.optional(v.string()),
    content: v.optional(v.string()),
    metadata: v.optional(v.any()),
    rawMessageId: v.optional(v.string()),
    schemaVersion: v.float64(),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("canonicalEvents", args);
  },
});

/**
 * Insert a raw message from Astridr persistence layer.
 */
export const insertRawMessage = mutation({
  args: {
    sessionKey: v.string(),
    channel: v.string(),
    direction: v.string(),
    senderId: v.optional(v.string()),
    rawPayload: v.any(),
    attachments: v.optional(v.any()),
    supabaseId: v.optional(v.string()),
    schemaVersion: v.float64(),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("rawMessages", args);
  },
});

// -- Queries (for transcript viewer UI) ---------------------------------------

/**
 * List canonical events for a session, optionally filtered by event type.
 * Ordered by timestamp ascending (chronological chat view).
 */
export const listBySession = query({
  args: {
    sessionKey: v.string(),
    eventType: v.optional(v.string()),
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 200;
    if (args.eventType) {
      return await ctx.db
        .query("canonicalEvents")
        .withIndex("by_session_type", (q) =>
          q.eq("sessionKey", args.sessionKey).eq("eventType", args.eventType!)
        )
        .order("asc")
        .take(limit);
    }
    return await ctx.db
      .query("canonicalEvents")
      .withIndex("by_session", (q) => q.eq("sessionKey", args.sessionKey))
      .order("asc")
      .take(limit);
  },
});

/**
 * Get a raw message by its Supabase UUID (for "Show raw" toggle).
 * Searches rawMessages table by supabaseId field.
 */
export const getRawMessage = query({
  args: {
    supabaseId: v.string(),
  },
  handler: async (ctx, args) => {
    // No index on supabaseId -- this is a rare on-demand lookup.
    // Filter in-memory from the session's raw messages.
    const result = await ctx.db
      .query("rawMessages")
      .filter((q) => q.eq(q.field("supabaseId"), args.supabaseId))
      .first();
    return result;
  },
});

/**
 * Get raw messages for a session (alternative for "Show raw" when
 * matching by session_key + direction + approximate timestamp).
 */
export const getRawMessagesBySession = query({
  args: {
    sessionKey: v.string(),
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    return await ctx.db
      .query("rawMessages")
      .withIndex("by_session", (q) => q.eq("sessionKey", args.sessionKey))
      .order("asc")
      .take(limit);
  },
});

/**
 * List distinct sessions that have canonical events (for session picker).
 * Returns unique session keys with their latest event timestamp.
 */
export const listSessions = query({
  args: {
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    // Get recent canonical events and extract unique sessions
    const recentEvents = await ctx.db
      .query("canonicalEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(500);

    const sessionMap = new Map<
      string,
      { sessionKey: string; lastEventAt: number; eventCount: number }
    >();
    for (const evt of recentEvents) {
      const existing = sessionMap.get(evt.sessionKey);
      if (!existing) {
        sessionMap.set(evt.sessionKey, {
          sessionKey: evt.sessionKey,
          lastEventAt: evt.timestamp,
          eventCount: 1,
        });
      } else {
        existing.eventCount++;
        if (evt.timestamp > existing.lastEventAt) {
          existing.lastEventAt = evt.timestamp;
        }
      }
    }

    return Array.from(sessionMap.values())
      .sort((a, b) => b.lastEventAt - a.lastEventAt)
      .slice(0, limit);
  },
});

// -- Retention Cleanup (D-11) -------------------------------------------------

/**
 * Delete canonical events and raw messages older than 90 days.
 * Called by daily Convex cron job.
 */
export const cleanupOldRecords = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000; // 90 days in ms
    const cutoffSeconds = cutoff / 1000; // Convex timestamps are in seconds

    // Delete old canonical events (batch 500 at a time)
    let canonicalDeleted = 0;
    const oldCanonical = await ctx.db
      .query("canonicalEvents")
      .withIndex("by_timestamp")
      .filter((q) => q.lt(q.field("timestamp"), cutoffSeconds))
      .take(500);
    for (const evt of oldCanonical) {
      await ctx.db.delete(evt._id);
      canonicalDeleted++;
    }

    // Delete old raw messages (batch 500 at a time)
    let rawDeleted = 0;
    const oldRaw = await ctx.db
      .query("rawMessages")
      .withIndex("by_timestamp")
      .filter((q) => q.lt(q.field("timestamp"), cutoffSeconds))
      .take(500);
    for (const msg of oldRaw) {
      await ctx.db.delete(msg._id);
      rawDeleted++;
    }

    return { canonicalDeleted, rawDeleted };
  },
});
