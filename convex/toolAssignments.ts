import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const syncAssignments = mutation({
  args: {
    agents: v.array(
      v.object({
        agentId: v.string(),
        agentName: v.string(),
        kits: v.array(v.string()),
        toolCount: v.float64(),
        tools: v.array(
          v.object({
            toolId: v.string(),
            tags: v.array(v.string()),
            origin: v.optional(v.string()),
            source: v.string(),
          })
        ),
      })
    ),
    unassigned: v.array(
      v.object({
        toolId: v.string(),
        status: v.string(),
      })
    ),
    totals: v.object({
      totalTools: v.float64(),
      assignedTools: v.float64(),
      pendingClassification: v.float64(),
      agents: v.float64(),
    }),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db.query("agentToolAssignments").collect();
    for (const row of existing) {
      await ctx.db.delete(row._id);
    }

    for (const agent of args.agents) {
      for (const tool of agent.tools) {
        await ctx.db.insert("agentToolAssignments", {
          agentId: agent.agentId,
          agentName: agent.agentName,
          kits: agent.kits,
          toolId: tool.toolId,
          tags: tool.tags,
          kitId: undefined,
          assignmentSource: tool.source,
          origin: tool.origin,
          syncedAt: now,
        });
      }
    }

    for (const tool of args.unassigned) {
      const existingClassification = await ctx.db
        .query("toolClassifications")
        .withIndex("by_toolId", (q) => q.eq("toolId", tool.toolId))
        .first();
      if (!existingClassification) {
        await ctx.db.insert("toolClassifications", {
          toolId: tool.toolId,
          toolName: tool.toolId,
          origin: "unknown",
          tags: [],
          classificationSource: "pending",
          status: tool.status,
          classifiedAt: now,
        });
      }
    }
  },
});

export const recordChange = mutation({
  args: {
    action: v.string(),
    tool: v.object({
      toolId: v.string(),
      tags: v.array(v.string()),
      confidence: v.optional(v.float64()),
      classificationSource: v.optional(v.string()),
    }),
    assignedTo: v.array(
      v.object({
        agentId: v.string(),
        kitId: v.optional(v.string()),
        matchedTag: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("toolAssignmentChanges", {
      action: args.action,
      toolId: args.tool.toolId,
      tags: args.tool.tags,
      confidence: args.tool.confidence,
      classificationSource: args.tool.classificationSource,
      assignedTo: args.assignedTo,
      timestamp: Date.now(),
    });
  },
});

export const byAgent = query({
  args: { agentId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentToolAssignments")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
  },
});

export const matrix = query({
  args: {},
  handler: async (ctx) => {
    const assignments = await ctx.db.query("agentToolAssignments").collect();
    const agentMap: Record<string, { name: string; kits: string[]; tags: Set<string>; toolCount: number }> = {};

    for (const a of assignments) {
      if (!agentMap[a.agentId]) {
        agentMap[a.agentId] = { name: a.agentName, kits: a.kits, tags: new Set(), toolCount: 0 };
      }
      for (const tag of a.tags) {
        agentMap[a.agentId].tags.add(tag);
      }
      agentMap[a.agentId].toolCount++;
    }

    const allTags = new Set<string>();
    for (const agent of Object.values(agentMap)) {
      for (const tag of agent.tags) {
        allTags.add(tag);
      }
    }

    return {
      agents: Object.entries(agentMap).map(([id, data]) => ({
        agentId: id,
        agentName: data.name,
        kits: data.kits,
        tags: [...data.tags],
        toolCount: data.toolCount,
      })),
      allTags: [...allTags].sort(),
    };
  },
});

export const unassigned = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("toolClassifications")
      .withIndex("by_status", (q) => q.eq("status", "pending_classification"))
      .collect();
  },
});

export const recentChanges = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    return await ctx.db
      .query("toolAssignmentChanges")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit);
  },
});
