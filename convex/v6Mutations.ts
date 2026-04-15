import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const insertMemoryPreflight = mutation({
  args: {
    sessionId: v.optional(v.string()),
    profileId: v.string(),
    hitCount: v.float64(),
    missCount: v.float64(),
    latencyMs: v.float64(),
    topMemoryIds: v.optional(v.array(v.string())),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("memoryPreflight", args);
  },
});

export const insertDreamingCycle = mutation({
  args: {
    runDate: v.string(),
    status: v.string(),
    rawCount: v.float64(),
    candidateCount: v.float64(),
    extractedCount: v.float64(),
    dedupedCount: v.float64(),
    storedCount: v.float64(),
    durationMs: v.optional(v.float64()),
    costUsd: v.optional(v.float64()),
    isBackfill: v.optional(v.boolean()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("dreamingCycles", args);
  },
});

export const insertDreamingFact = mutation({
  args: {
    cycleId: v.optional(v.string()),
    factText: v.string(),
    category: v.string(),
    confidence: v.float64(),
    sourceMemoryIds: v.optional(v.array(v.string())),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("dreamingFacts", args);
  },
});

export const insertAdvisorEvent = mutation({
  args: {
    sessionId: v.optional(v.string()),
    provider: v.string(),
    model: v.optional(v.string()),
    used: v.boolean(),
    inputTokens: v.float64(),
    outputTokens: v.float64(),
    costUsd: v.float64(),
    standardCostUsd: v.float64(),
    latencyMs: v.optional(v.float64()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("advisorEvents", args);
  },
});

export const insertConversationImport = mutation({
  args: {
    importId: v.string(),
    source: v.string(),
    status: v.string(),
    conversationCount: v.float64(),
    memoriesCreated: v.optional(v.float64()),
    errorMessage: v.optional(v.string()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("conversationImports", args);
  },
});

export const insertStartupEvent = mutation({
  args: {
    phase: v.string(),
    duration: v.float64(),
    totalMs: v.float64(),
    subsystem: v.optional(v.string()),
    order: v.optional(v.float64()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("startupEvents", args);
  },
});

export const upsertAuthAlias = mutation({
  args: {
    alias: v.string(),
    provider: v.string(),
    userId: v.string(),
    createdAt: v.float64(),
  },
  handler: async (ctx, args) => {
    // Upsert: if alias already exists, update provider/userId
    const existing = await ctx.db
      .query("authAliases")
      .withIndex("by_alias", (q) => q.eq("alias", args.alias))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        provider: args.provider,
        userId: args.userId,
      });
    } else {
      await ctx.db.insert("authAliases", args);
    }
  },
});
