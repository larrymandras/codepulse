import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Phase 149 PULSE-01 — Swarm task observability mutations + queries.
 *
 * upsert: query-then-insert-or-patch (Convex has no native upsert).
 *         Also maintains the swarmGoals denorm table (OQ-2 resolved approach):
 *         - First sighting of a goalId → insert swarmGoals row
 *         - Subsequent calls → patch latestState + updatedAt
 *
 * byGoal:    returns swarmTasks rows for a goalId ordered by timestamp
 * listGoals: returns swarmGoals rows newest-first (for GoalPicker)
 */

export const upsert = mutation({
  args: {
    goalId: v.string(),
    subtaskId: v.string(),
    state: v.string(),
    subtask: v.string(),
    dependsOn: v.array(v.string()),
    claimedBy: v.optional(v.string()),
    model: v.optional(v.string()),
    agentId: v.optional(v.string()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    // Use ms epoch throughout. args.timestamp is already ms (normalized in runtimeIngest).
    // Fallback to Date.now() (ms) so updatedAt/createdAt stay in the same unit.
    const now = args.timestamp ?? Date.now();

    // --- swarmTasks: query-then-insert-or-patch ---------------------------------
    const existing = await ctx.db
      .query("swarmTasks")
      .withIndex("by_subtask", (q) => q.eq("subtaskId", args.subtaskId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        state: args.state,
        claimedBy: args.claimedBy,
        model: args.model,
        agentId: args.agentId,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("swarmTasks", {
        goalId: args.goalId,
        subtaskId: args.subtaskId,
        state: args.state,
        subtask: args.subtask,
        dependsOn: args.dependsOn,
        claimedBy: args.claimedBy,
        model: args.model,
        agentId: args.agentId,
        timestamp: now,
        updatedAt: now,
      });
    }

    // --- swarmGoals: maintain denorm row (OQ-2) ---------------------------------
    const existingGoal = await ctx.db
      .query("swarmGoals")
      .withIndex("by_created", (q) => q.gte("createdAt", 0))
      .filter((q) => q.eq(q.field("goalId"), args.goalId))
      .first();

    if (existingGoal) {
      await ctx.db.patch(existingGoal._id, {
        latestState: args.state,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("swarmGoals", {
        goalId: args.goalId,
        firstSubtask: args.subtask,
        latestState: args.state,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const byGoal = query({
  args: { goalId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("swarmTasks")
      .withIndex("by_goal", (q) => q.eq("goalId", args.goalId))
      .collect();
  },
});

export const listGoals = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("swarmGoals")
      .withIndex("by_created")
      .order("desc")
      .collect();
  },
});

/**
 * goalsByAgent: distinct goalIds an agent participated in (claimed or assigned),
 * newest-first by the agent's most-recent task in each goal. Powers the inbound
 * cross-graph link (Tool Galaxy agent → its Hive swarm goals). No agent index
 * exists, so this scans swarmTasks — fine at swarm scale.
 */
export const goalsByAgent = query({
  args: { agentId: v.string() },
  handler: async (ctx, args) => {
    const tasks = await ctx.db.query("swarmTasks").collect();
    const latestByGoal = new Map<string, number>();
    for (const t of tasks) {
      if (t.agentId === args.agentId || t.claimedBy === args.agentId) {
        const prev = latestByGoal.get(t.goalId) ?? 0;
        if (t.timestamp > prev) latestByGoal.set(t.goalId, t.timestamp);
      }
    }
    return [...latestByGoal.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([goalId]) => goalId);
  },
});
