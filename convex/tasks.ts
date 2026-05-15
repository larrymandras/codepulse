import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

const VALID_COLUMNS = ["backlog", "queued", "running", "review", "done", "cancelled"] as const;
const validPriority = v.union(v.literal("high"), v.literal("medium"), v.literal("low"));

export const listByColumn = query({
  handler: async (ctx) => {
    return await ctx.db.query("tasks").order("desc").collect();
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    priority: validPriority,
    agentId: v.optional(v.string()),
    agentName: v.optional(v.string()),
    labels: v.optional(v.array(v.string())),
    dueAt: v.optional(v.number()),
    findingId: v.optional(v.id("ideationFindings")),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const now = Date.now() / 1000;
    return await ctx.db.insert("tasks", {
      taskId: crypto.randomUUID(),
      title: args.title,
      description: args.description,
      priority: args.priority,
      column: "backlog",
      agentId: args.agentId,
      agentName: args.agentName,
      labels: args.labels,
      dueAt: args.dueAt,
      findingId: args.findingId,
      columnEnteredAt: now,
      createdAt: now,
    });
  },
});

export const moveColumn = mutation({
  args: {
    id: v.id("tasks"),
    column: v.string(),
  },
  handler: async (ctx, { id, column }) => {
    await requireAuth(ctx);
    if (!(VALID_COLUMNS as readonly string[]).includes(column)) {
      throw new Error(`Invalid column: ${column}. Must be one of: ${VALID_COLUMNS.join(", ")}`);
    }
    await ctx.db.patch(id, {
      column,
      columnEnteredAt: Date.now() / 1000,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    priority: v.optional(validPriority),
    labels: v.optional(v.array(v.string())),
    dueAt: v.optional(v.number()),
    agentId: v.optional(v.string()),
    agentName: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    await requireAuth(ctx);
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) patch[key] = value;
    }
    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, { id }) => {
    await requireAuth(ctx);
    await ctx.db.delete(id);
  },
});

const TERMINAL_COLUMNS = ["done", "cancelled"];
const RETENTION_MS = 24 * 60 * 60 * 1000;

export const cleanupTerminalTasks = internalMutation({
  handler: async (ctx) => {
    const cutoff = (Date.now() - RETENTION_MS) / 1000;
    let deleted = 0;
    for (const column of TERMINAL_COLUMNS) {
      const stale = await ctx.db
        .query("tasks")
        .withIndex("by_column", (q) => q.eq("column", column))
        .filter((q) => q.lt(q.field("columnEnteredAt"), cutoff))
        .collect();
      for (const task of stale) {
        await ctx.db.delete(task._id);
        deleted++;
      }
    }
    return { deleted };
  },
});
