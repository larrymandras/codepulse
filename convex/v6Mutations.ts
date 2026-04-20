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

// ============================================================
// WAR ROOM + MEETING BOT (Phase 72)
// ============================================================

export const upsertWarRoom = mutation({
  args: {
    roomId: v.string(),
    name: v.string(),
    status: v.string(),
    participantIds: v.optional(v.array(v.string())),
    createdAt: v.float64(),
    updatedAt: v.float64(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("warRooms")
      .withIndex("by_roomId", (q) => q.eq("roomId", args.roomId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("warRooms", args);
    }
  },
});

export const insertWarRoomEvent = mutation({
  args: {
    roomId: v.string(),
    eventType: v.string(),
    speakerId: v.optional(v.string()),
    speakerName: v.optional(v.string()),
    text: v.optional(v.string()),
    payload: v.optional(v.any()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("warRoomEvents", args);
  },
});

export const upsertVoiceCall = mutation({
  args: {
    callId: v.string(),
    botSessionId: v.optional(v.string()),
    status: v.string(),
    platform: v.optional(v.string()),
    agentProfileId: v.optional(v.string()),
    durationMs: v.optional(v.float64()),
    participantCount: v.optional(v.float64()),
    costUsd: v.optional(v.float64()),
    startedAt: v.float64(),
    endedAt: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("voiceCalls")
      .withIndex("by_callId", (q) => q.eq("callId", args.callId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args });
    } else {
      await ctx.db.insert("voiceCalls", args);
    }
  },
});

export const insertCallTranscript = mutation({
  args: {
    callId: v.string(),
    speakerId: v.optional(v.string()),
    speakerName: v.optional(v.string()),
    text: v.string(),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("callTranscripts", args);
  },
});

export const upsertMeetingBotSession = mutation({
  args: {
    sessionId: v.string(),
    callId: v.optional(v.string()),
    recallBotId: v.optional(v.string()),
    agentProfileId: v.optional(v.string()),
    meetingUrl: v.optional(v.string()),
    status: v.string(),
    wordCount: v.optional(v.float64()),
    summaryText: v.optional(v.string()),
    createdAt: v.float64(),
    updatedAt: v.float64(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("meetingBotSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("meetingBotSessions", args);
    }
  },
});

export const insertMissionControlTask = mutation({
  args: {
    taskId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.string(),
    column: v.string(),
    agentId: v.string(),
    agentName: v.string(),
    source: v.optional(v.string()),
    progress: v.optional(v.float64()),
    dueAt: v.optional(v.number()),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("tasks", { ...args, columnEnteredAt: Date.now() / 1000 });
  },
});

export const updateMissionControlTask = mutation({
  args: {
    taskId: v.string(),
    agentId: v.optional(v.string()),
    agentName: v.optional(v.string()),
    column: v.optional(v.string()),
    priority: v.optional(v.string()),
    progress: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tasks")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .first();

    if (existing) {
      const patch: Record<string, unknown> = {};
      if (args.agentId !== undefined) patch.agentId = args.agentId;
      if (args.agentName !== undefined) patch.agentName = args.agentName;
      if (args.column !== undefined) patch.column = args.column;
      if (args.priority !== undefined) patch.priority = args.priority;
      if (args.progress !== undefined) patch.progress = args.progress;
      patch.columnEnteredAt = Date.now() / 1000;
      await ctx.db.patch(existing._id, patch);
    }
  },
});
