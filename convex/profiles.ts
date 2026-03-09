import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const recordMetrics = mutation({
  args: {
    profileId: v.string(),
    metric: v.string(),
    value: v.float64(),
    tags: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("profileMetrics", {
      profileId: args.profileId,
      metric: args.metric,
      value: args.value,
      tags: args.tags,
      timestamp: Date.now() / 1000,
    });
  },
});

export const overview = query({
  args: {},
  handler: async (ctx) => {
    const recent = await ctx.db
      .query("profileMetrics")
      .withIndex("by_profile")
      .order("desc")
      .take(100);

    const grouped: Record<string, (typeof recent)> = {};
    for (const record of recent) {
      if (!grouped[record.profileId]) {
        grouped[record.profileId] = [];
      }
      grouped[record.profileId].push(record);
    }
    return grouped;
  },
});

// Batch ingest from Astridr profile_activity telemetry
// Astridr sends: { activeProfiles, activeChannels, profileActivity: {profile_id: sender_count} }
export const recordActivityBatch = mutation({
  args: {
    activeProfiles: v.optional(v.float64()),
    activeChannels: v.optional(v.any()),
    profileActivity: v.optional(v.any()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    const now = args.timestamp;

    // Record aggregate active-profiles metric
    if (args.activeProfiles !== undefined) {
      await ctx.db.insert("profileMetrics", {
        profileId: "_aggregate",
        metric: "active_profiles",
        value: args.activeProfiles,
        tags: { activeChannels: args.activeChannels },
        timestamp: now,
      });
    }

    // Flatten per-profile activity into individual metric records
    if (args.profileActivity && typeof args.profileActivity === "object") {
      const activity = args.profileActivity as Record<string, number>;
      for (const [profileId, senderCount] of Object.entries(activity)) {
        await ctx.db.insert("profileMetrics", {
          profileId,
          metric: "sender_count",
          value: typeof senderCount === "number" ? senderCount : 0,
          timestamp: now,
        });
      }
    }
  },
});

// Profile config sync
export const upsertConfig = mutation({
  args: {
    profileId: v.string(),
    channels: v.optional(v.any()),
    budget: v.optional(v.any()),
    modelPreferences: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now() / 1000;
    const existing = await ctx.db
      .query("profileConfigs")
      .withIndex("by_profileId", (q) => q.eq("profileId", args.profileId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        channels: args.channels ?? existing.channels,
        budget: args.budget ?? existing.budget,
        modelPreferences: args.modelPreferences ?? existing.modelPreferences,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("profileConfigs", {
        profileId: args.profileId,
        channels: args.channels,
        budget: args.budget,
        modelPreferences: args.modelPreferences,
        updatedAt: now,
      });
    }
  },
});

export const listConfigs = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("profileConfigs")
      .withIndex("by_updatedAt")
      .order("desc")
      .collect();
  },
});

export const recordSwitch = mutation({
  args: {
    fromProfile: v.string(),
    toProfile: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("profileSwitches", {
      fromProfile: args.fromProfile,
      toProfile: args.toProfile,
      reason: args.reason,
      timestamp: Date.now() / 1000,
    });
  },
});

export const summarize = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now() / 1000;
    const fifteenMinAgo = now - 900;

    const recent = await ctx.db
      .query("profileMetrics")
      .withIndex("by_metric")
      .order("desc")
      .take(200);

    const recentActivity = recent.filter((m) => m.timestamp >= fifteenMinAgo);
    const byProfile: Record<string, number> = {};

    for (const m of recentActivity) {
      byProfile[m.profileId] = (byProfile[m.profileId] ?? 0) + m.value;
    }

    // Store summary
    await ctx.db.insert("profileMetrics", {
      profileId: "_summary",
      metric: "activity_summary",
      value: Object.keys(byProfile).length,
      tags: { profiles: byProfile },
      timestamp: now,
    });

    return { profiles: Object.keys(byProfile).length };
  },
});
