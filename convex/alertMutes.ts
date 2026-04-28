import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

// ============================================================
// DURATION PARSER — converts string like "15m", "1h", "4h", "24h" to seconds
// ============================================================

function parseDurationSeconds(duration: string): number | null {
  switch (duration) {
    case "15m":
      return 900;
    case "1h":
      return 3600;
    case "4h":
      return 14400;
    case "24h":
      return 86400;
    case "indefinite":
      return null;
    default: {
      // Try to parse numeric suffix: e.g. "30m" -> 1800
      const match = duration.match(/^(\d+)(m|h|d)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        const unit = match[2];
        if (unit === "m") return num * 60;
        if (unit === "h") return num * 3600;
        if (unit === "d") return num * 86400;
      }
      return null; // treat unrecognized durations as indefinite
    }
  }
}

// ============================================================
// MUTE CRUD (D-10)
// ============================================================

export const muteTarget = mutation({
  args: {
    targetType: v.string(),
    targetId: v.string(),
    duration: v.string(),
    mutedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const now = Date.now() / 1000;

    // Upsert: delete any existing mute for the same target
    const existing = await ctx.db
      .query("alertMutes")
      .withIndex("by_target", (q) =>
        q.eq("targetType", args.targetType).eq("targetId", args.targetId)
      )
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    const durationSeconds = parseDurationSeconds(args.duration);
    const expiresAt = durationSeconds !== null ? now + durationSeconds : undefined;

    await ctx.db.insert("alertMutes", {
      targetType: args.targetType,
      targetId: args.targetId,
      duration: args.duration,
      expiresAt,
      mutedBy: args.mutedBy,
      createdAt: now,
    });
  },
});

export const unmuteTarget = mutation({
  args: {
    targetType: v.string(),
    targetId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const record = await ctx.db
      .query("alertMutes")
      .withIndex("by_target", (q) =>
        q.eq("targetType", args.targetType).eq("targetId", args.targetId)
      )
      .first();
    if (record) {
      await ctx.db.delete(record._id);
    }
  },
});

export const isTargetMuted = internalQuery({
  args: {
    targetType: v.string(),
    targetId: v.string(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("alertMutes")
      .withIndex("by_target", (q) =>
        q.eq("targetType", args.targetType).eq("targetId", args.targetId)
      )
      .first();

    if (!record) return false;
    if (record.expiresAt === undefined || record.expiresAt === null) return true; // indefinite
    if (record.expiresAt < Date.now() / 1000) return false; // expired
    return true;
  },
});

export const isTargetMutedPublic = query({
  args: {
    targetType: v.string(),
    targetId: v.string(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("alertMutes")
      .withIndex("by_target", (q) =>
        q.eq("targetType", args.targetType).eq("targetId", args.targetId)
      )
      .first();

    if (!record) return false;
    if (record.expiresAt === undefined || record.expiresAt === null) return true;
    if (record.expiresAt < Date.now() / 1000) return false;
    return true;
  },
});

export const listActiveMutes = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("alertMutes").collect();
    const now = Date.now() / 1000;
    return all.filter(
      (m) => m.expiresAt === undefined || m.expiresAt === null || m.expiresAt >= now
    );
  },
});

// Periodic cleanup of expired mute records to prevent unbounded table growth
export const cleanupExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("alertMutes").collect();
    const now = Date.now() / 1000;
    let deleted = 0;
    for (const m of all) {
      if (m.expiresAt !== undefined && m.expiresAt !== null && m.expiresAt < now) {
        await ctx.db.delete(m._id);
        deleted = deleted + 1;
      }
    }
    return { deleted };
  },
});
