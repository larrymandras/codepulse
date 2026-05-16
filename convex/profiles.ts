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
    emailAddress: v.optional(v.string()),
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
        ...(args.emailAddress !== undefined && { emailAddress: args.emailAddress }),
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("profileConfigs", {
        profileId: args.profileId,
        channels: args.channels,
        budget: args.budget,
        modelPreferences: args.modelPreferences,
        emailAddress: args.emailAddress,
        updatedAt: now,
      });
    }
  },
});

export const updateEmail = mutation({
  args: {
    profileId: v.string(),
    emailAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now() / 1000;
    const existing = await ctx.db
      .query("profileConfigs")
      .withIndex("by_profileId", (q) => q.eq("profileId", args.profileId))
      .first();

    const oldEmail = existing?.emailAddress;

    if (existing) {
      await ctx.db.patch(existing._id, {
        emailAddress: args.emailAddress,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("profileConfigs", {
        profileId: args.profileId,
        emailAddress: args.emailAddress,
        updatedAt: now,
      });
    }

    // Audit trail
    await ctx.db.insert("configChanges", {
      configKey: `profile.${args.profileId}.emailAddress`,
      oldValue: oldEmail,
      newValue: args.emailAddress,
      changedBy: "dashboard",
      changedAt: now,
    });
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

export const recentSwitches = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("profileSwitches")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit ?? 20);
  },
});

// Seed the three operational profiles
export const seedProfiles = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if already seeded
    const existing = await ctx.db
      .query("profileConfigs")
      .withIndex("by_profileId", (q) => q.eq("profileId", "personal"))
      .first();
    if (existing) {
      return { seeded: false, message: "Profiles already seeded" };
    }

    const now = Date.now() / 1000;
    const profiles = [
      {
        profileId: "personal",
        channels: [
          { type: "telegram", status: "active" },
          { type: "email", status: "active" },
          { type: "calendar", status: "active" },
        ],
        budget: { spent: 12.50, limit: 50, period: "monthly" },
        modelPreferences: { primary: "claude-sonnet-4-6", fallback: "claude-haiku-4-5" },
      },
      {
        profileId: "business",
        channels: [
          { type: "slack", status: "active" },
          { type: "github", status: "active" },
          { type: "email", status: "active" },
          { type: "notion", status: "active" },
        ],
        budget: { spent: 87.30, limit: 200, period: "monthly" },
        modelPreferences: { primary: "claude-opus-4-6", fallback: "claude-sonnet-4-6" },
      },
      {
        profileId: "consulting",
        channels: [
          { type: "slack", status: "active" },
          { type: "github", status: "active" },
          { type: "email", status: "active" },
          { type: "notion", status: "inactive" },
          { type: "linear", status: "active" },
        ],
        budget: { spent: 156.80, limit: 500, period: "monthly" },
        modelPreferences: { primary: "claude-opus-4-6", fallback: "claude-sonnet-4-6" },
      },
    ];

    for (const p of profiles) {
      await ctx.db.insert("profileConfigs", {
        profileId: p.profileId,
        channels: p.channels,
        budget: p.budget,
        modelPreferences: p.modelPreferences,
        updatedAt: now,
      });
    }

    return { seeded: true, message: "Seeded 3 operational profiles" };
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
