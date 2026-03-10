import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const recordStatus = mutation({
  args: {
    containerId: v.string(),
    name: v.string(),
    image: v.optional(v.string()),
    status: v.string(),
    health: v.optional(v.string()),
    cpuPercent: v.optional(v.float64()),
    memoryMb: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const now = Date.now() / 1000;
    const existing = await ctx.db
      .query("dockerContainers")
      .withIndex("by_containerId", (q) =>
        q.eq("containerId", args.containerId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        image: args.image,
        status: args.status,
        health: args.health,
        cpuPercent: args.cpuPercent,
        memoryMb: args.memoryMb,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("dockerContainers", {
        containerId: args.containerId,
        name: args.name,
        image: args.image,
        status: args.status,
        health: args.health,
        cpuPercent: args.cpuPercent,
        memoryMb: args.memoryMb,
        updatedAt: now,
      });
    }
  },
});

export const removeByContainerId = mutation({
  args: { containerId: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("dockerContainers")
      .withIndex("by_containerId", (q) => q.eq("containerId", args.containerId))
      .first();
    if (doc) await ctx.db.delete(doc._id);
  },
});

export const currentStatus = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("dockerContainers")
      .order("desc")
      .take(20);
  },
});

export const pollHealth = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now() / 1000;
    const staleThreshold = now - 300; // 5 minutes

    // Mark containers as "exited" if they haven't been updated recently
    const containers = await ctx.db
      .query("dockerContainers")
      .order("desc")
      .take(50);

    let staleCount = 0;
    for (const c of containers) {
      if (c.updatedAt < staleThreshold && c.status === "running") {
        await ctx.db.patch(c._id, {
          status: "unknown",
          health: "stale",
          updatedAt: now,
        });
        staleCount++;
      }
    }

    return { status: "ok", checked: containers.length, markedStale: staleCount };
  },
});
