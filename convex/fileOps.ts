import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const record = mutation({
  args: {
    sessionId: v.string(),
    operation: v.string(),
    filePath: v.string(),
    linesChanged: v.optional(v.float64()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("fileOps", {
      sessionId: args.sessionId,
      operation: args.operation,
      filePath: args.filePath,
      linesChanged: args.linesChanged,
      timestamp: args.timestamp,
    });
  },
});

export const bySession = query({
  args: {
    sessionId: v.string(),
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("fileOps")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(limit);
  },
});

export const summaryBySession = query({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const ops = await ctx.db
      .query("fileOps")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const byFile = new Map<string, { ops: number; linesChanged: number; lastOp: string; lastTimestamp: number }>();
    for (const op of ops) {
      const existing = byFile.get(op.filePath);
      if (existing) {
        existing.ops++;
        existing.linesChanged += op.linesChanged ?? 0;
        if (op.timestamp > existing.lastTimestamp) {
          existing.lastOp = op.operation;
          existing.lastTimestamp = op.timestamp;
        }
      } else {
        byFile.set(op.filePath, {
          ops: 1,
          linesChanged: op.linesChanged ?? 0,
          lastOp: op.operation,
          lastTimestamp: op.timestamp,
        });
      }
    }

    return Array.from(byFile.entries())
      .map(([filePath, data]) => ({ filePath, ...data }))
      .sort((a, b) => b.lastTimestamp - a.lastTimestamp);
  },
});
