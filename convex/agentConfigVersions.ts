import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** List all versions for an agent, newest first. */
export const listByAgent = query({
  args: { agentId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentConfigVersions")
      .withIndex("by_agent_created", (q) => q.eq("agentId", args.agentId))
      .order("desc")
      .take(100);
  },
});

/** Get a single version by agent + version number. */
export const getVersion = query({
  args: { agentId: v.string(), version: v.float64() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentConfigVersions")
      .withIndex("by_agent", (q) =>
        q.eq("agentId", args.agentId).eq("version", args.version),
      )
      .first();
  },
});

/** Get the latest version number for an agent. Returns 0 if none. */
export const latestVersion = query({
  args: { agentId: v.string() },
  handler: async (ctx, args) => {
    const latest = await ctx.db
      .query("agentConfigVersions")
      .withIndex("by_agent_created", (q) => q.eq("agentId", args.agentId))
      .order("desc")
      .first();
    return latest?.version ?? 0;
  },
});

/** List all known agents (latest config snapshot per agent). */
export const listAgents = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db
      .query("agentConfigVersions")
      .withIndex("by_createdAt")
      .order("desc")
      .take(500);

    const seen = new Map<string, typeof all[0]>();
    for (const row of all) {
      if (!seen.has(row.agentId)) {
        seen.set(row.agentId, row);
      }
    }

    return Array.from(seen.values()).map((row) => {
      const cfg = row.config as Record<string, unknown> | undefined;
      return {
        id: row.agentId,
        name: (cfg?.name as string) ?? row.agentId,
        description: (cfg?.description as string) ?? "",
        tier: (cfg?.tier as string) ?? "shared",
        active: true,
        budget_fraction: (cfg?.budget_fraction as number) ?? 0,
        profiles: (cfg?.profiles as string[]) ?? [],
        model: (cfg?.model_override as string) ?? undefined,
      };
    });
  },
});

/** Compare two versions — returns both config snapshots for client-side diff. */
export const compareVersions = query({
  args: {
    agentId: v.string(),
    versionA: v.float64(),
    versionB: v.float64(),
  },
  handler: async (ctx, args) => {
    const a = await ctx.db
      .query("agentConfigVersions")
      .withIndex("by_agent", (q) =>
        q.eq("agentId", args.agentId).eq("version", args.versionA),
      )
      .first();
    const b = await ctx.db
      .query("agentConfigVersions")
      .withIndex("by_agent", (q) =>
        q.eq("agentId", args.agentId).eq("version", args.versionB),
      )
      .first();
    return { a, b };
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Create a new version snapshot for an agent config change. */
export const createVersion = mutation({
  args: {
    agentId: v.string(),
    config: v.any(),
    changeSummary: v.string(),
    changeType: v.string(),
    author: v.optional(v.string()),
    parentVersion: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    // Get the next version number
    const latest = await ctx.db
      .query("agentConfigVersions")
      .withIndex("by_agent_created", (q) => q.eq("agentId", args.agentId))
      .order("desc")
      .first();
    const nextVersion = (latest?.version ?? 0) + 1;

    const id = await ctx.db.insert("agentConfigVersions", {
      agentId: args.agentId,
      version: nextVersion,
      config: args.config,
      changeSummary: args.changeSummary,
      changeType: args.changeType,
      author: args.author,
      parentVersion: args.parentVersion,
      createdAt: Date.now() / 1000,
    });

    return { id, version: nextVersion };
  },
});
