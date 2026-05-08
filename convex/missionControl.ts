import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

export const listTasksByAgent = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("tasks")
      .withIndex("by_column")
      .collect();
    return all.filter((t) => t.agentId !== undefined);
  },
});

export const reassignTask = mutation({
  args: {
    taskId: v.id("tasks"),
    newAgentId: v.string(),
    newAgentName: v.string(),
  },
  handler: async (ctx, { taskId, newAgentId, newAgentName }) => {
    await requireAuth(ctx);
    await ctx.db.patch(taskId, {
      agentId: newAgentId,
      agentName: newAgentName,
      columnEnteredAt: Date.now() / 1000,
    });
  },
});
