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

// Phase 93 (RESEARCH Pitfall 2 / D-11): audit-trail key for persona model
// changes, matching the `profile.<id>.<field>` naming of the existing
// updateEmail precedent (L144-150 below). Exported so EVAL-03's regression
// detection and tests can assert the exact key shape without re-deriving it.
export function personaConfigChangeKey(profileId: string): string {
  return `profile.${profileId}.modelPreferences`;
}

// Profile config sync
export const upsertConfig = mutation({
  args: {
    profileId: v.string(),
    channels: v.optional(v.any()),
    budget: v.optional(v.any()),
    modelPreferences: v.optional(v.any()),
    emailAddress: v.optional(v.string()),
    // WR-07 (93-REVIEW): audit-trail actor. Defaults to "dashboard" (the
    // operator UI path); the Ástríðr profile_config runtime sync passes
    // "astridr-sync" so configChanges rows — and the "model change"
    // regression markers derived from them (D-11) — name the real actor.
    changedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now() / 1000;
    const existing = await ctx.db
      .query("profileConfigs")
      .withIndex("by_profileId", (q) => q.eq("profileId", args.profileId))
      .first();

    // Phase 93 (RESEARCH Pitfall 2): audit a persona's modelPreferences change.
    // Only write the audit row when modelPreferences is actually part of THIS
    // update and differs from the stored value — a channels/budget-only patch
    // must not emit a no-op audit row. Deliberately scoped to profileConfigs
    // only (NOT agentProfiles.update): per RESEARCH Assumption A1, agentProfiles
    // has zero rows and is not the real persona-model change path.
    if (
      args.modelPreferences !== undefined &&
      JSON.stringify(args.modelPreferences) !==
        JSON.stringify(existing?.modelPreferences)
    ) {
      await ctx.db.insert("configChanges", {
        configKey: personaConfigChangeKey(args.profileId),
        oldValue: existing?.modelPreferences,
        newValue: args.modelPreferences,
        changedBy: args.changedBy ?? "dashboard",
        changedAt: now,
      });
    }

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

/**
 * removeConfig — Phase 109-10. Deletes exactly ONE `profileConfigs` row, by its unique
 * `profileId`.
 *
 * Why this exists: before it, `profileConfigs` had `upsertConfig` but no delete anywhere in
 * `convex/` — a profile could be created and never removed. The Phase 109-09 live gate's Probe F
 * needs a throwaway telemetry-less profile to prove the canonical "Not reported" absent state, and
 * without a delete that throwaway would be a permanent addition to the operator's live config.
 *
 * Single-row, index-seeked, and keyed on a unique id — deliberately NOT a bulk delete. The
 * self-hosted single-node instance cannot absorb mass deletes (CLAUDE.md, the 2026-07-21/22
 * tombstone incident); this deletes at most one document per call and refuses nothing else.
 *
 * Audited like `upsertConfig`: the removal writes a `configChanges` row so a profile disappearing
 * from the dashboard is traceable to an actor rather than looking like data loss.
 */
export const removeConfig = mutation({
  args: {
    profileId: v.string(),
    changedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("profileConfigs")
      .withIndex("by_profileId", (q) => q.eq("profileId", args.profileId))
      .first();

    // Idempotent: removing an absent profile is a no-op, not an error, and writes no audit row.
    if (!existing) return { deleted: false };

    await ctx.db.insert("configChanges", {
      configKey: personaConfigChangeKey(args.profileId),
      oldValue: existing.modelPreferences,
      // MUST be null, never undefined. `configChanges.newValue` is `v.any()` and therefore
      // REQUIRED (`schema.ts:271`), while `oldValue` is `v.optional(v.any())`. Convex omits
      // undefined-valued fields from the inserted document, so `newValue: undefined` produces a
      // document with no `newValue` key at all and the insert fails validation — which aborts the
      // whole mutation, leaving the row undeleted. Caught by running this against the live
      // instance in the 109-10 gate; the source-level tests below passed the whole time.
      newValue: null,
      changedBy: args.changedBy ?? "dashboard",
      changedAt: Date.now() / 1000,
    });

    await ctx.db.delete(existing._id);
    return { deleted: true };
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
        modelPreferences: { primary: "claude-opus-4-8", fallback: "claude-sonnet-4-6" },
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
        modelPreferences: { primary: "claude-opus-4-8", fallback: "claude-sonnet-4-6" },
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
