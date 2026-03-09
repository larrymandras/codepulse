import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const recordEvent = mutation({
  args: {
    component: v.string(),
    issue: v.string(),
    action: v.string(),
    outcome: v.string(),
    details: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("selfHealingEvents", {
      component: args.component,
      issue: args.issue,
      action: args.action,
      outcome: args.outcome,
      details: args.details,
      timestamp: Date.now() / 1000,
    });
  },
});

export const componentHealth = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("selfHealingEvents").order("desc").take(1000);
    const byComponent = new Map<string, (typeof all)[0]>();
    for (const record of all) {
      const existing = byComponent.get(record.component);
      if (!existing || record.timestamp > existing.timestamp) {
        byComponent.set(record.component, record);
      }
    }
    return Array.from(byComponent.values());
  },
});

export const recentRecoveries = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("selfHealingEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit ?? 30);
  },
});

export const uptimeStats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("selfHealingEvents").order("desc").take(1000);
    const resolved = all.filter((e) => e.outcome === "resolved").length;
    const failed = all.filter((e) => e.outcome === "failed").length;
    const pending = all.filter((e) => e.outcome === "pending").length;
    const actionCounts: Record<string, number> = {};
    for (const e of all) {
      actionCounts[e.action] = (actionCounts[e.action] ?? 0) + 1;
    }
    return { total: all.length, resolved, failed, pending, actionCounts };
  },
});

export const recordRecoveryWithCommit = mutation({
  args: {
    component: v.string(),
    issue: v.string(),
    action: v.string(),
    outcome: v.string(),
    details: v.optional(v.any()),
    commitSha: v.optional(v.string()),
    commitMessage: v.optional(v.string()),
    commitBranch: v.optional(v.string()),
    filesChanged: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const now = Date.now() / 1000;

    // Record self-healing event
    await ctx.db.insert("selfHealingEvents", {
      component: args.component,
      issue: args.issue,
      action: args.action,
      outcome: args.outcome,
      details: {
        ...(args.details ?? {}),
        commitSha: args.commitSha,
      },
      timestamp: now,
    });

    // Record associated git commit if provided
    if (args.commitSha) {
      await ctx.db.insert("gitCommits", {
        sha: args.commitSha,
        message:
          args.commitMessage ??
          `[self-healing] ${args.action}: ${args.issue}`,
        branch: args.commitBranch ?? "main",
        author: "astridr-self-healing",
        filesChanged: args.filesChanged ?? 1,
        timestamp: now,
      });
    }
  },
});

export const listVersions = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("versionHistory")
      .withIndex("by_changedAt")
      .order("desc")
      .take(args.limit ?? 20);
  },
});
