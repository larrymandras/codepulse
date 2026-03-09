import { query } from "./_generated/server";

// Yggdrasil: sessions → agents tree + recent event activity
export const yggdrasilTree = query({
  args: {},
  handler: async (ctx) => {
    const sessions = await ctx.db
      .query("sessions")
      .order("desc")
      .take(20);

    const agents = await ctx.db
      .query("agents")
      .order("desc")
      .take(200);

    // Recent events for particle flow (last 5 minutes)
    const now = Date.now() / 1000;
    const recentEvents = await ctx.db
      .query("events")
      .withIndex("by_timestamp")
      .order("desc")
      .take(200);
    const fiveMinEvents = recentEvents.filter((e) => e.timestamp >= now - 300);

    // Group agents by session
    const agentsBySession: Record<string, any[]> = {};
    for (const a of agents) {
      if (!agentsBySession[a.sessionId]) agentsBySession[a.sessionId] = [];
      agentsBySession[a.sessionId].push({
        agentId: a.agentId,
        parentAgentId: a.parentAgentId,
        agentType: a.agentType,
        status: a.status,
        model: a.model,
      });
    }

    return {
      sessions: sessions.map((s) => ({
        sessionId: s.sessionId,
        status: s.status,
        eventCount: s.eventCount,
        agents: agentsBySession[s.sessionId] ?? [],
      })),
      recentActivity: fiveMinEvents.length,
      eventTypes: Object.fromEntries(
        Object.entries(
          fiveMinEvents.reduce((acc: Record<string, number>, e) => {
            acc[e.eventType] = (acc[e.eventType] ?? 0) + 1;
            return acc;
          }, {})
        ).slice(0, 10)
      ),
    };
  },
});

// Constellation: context snapshots across all sessions
export const constellation = query({
  args: {},
  handler: async (ctx) => {
    const snapshots = await ctx.db
      .query("contextSnapshots")
      .withIndex("by_timestamp")
      .order("desc")
      .take(200);

    return snapshots.map((s) => ({
      id: s._id,
      sessionId: s.sessionId,
      agentId: s.agentId,
      contextTokens: s.contextTokens ?? 0,
      summaryTokens: s.summaryTokens ?? 0,
      timestamp: s.timestamp,
    }));
  },
});

// Reactor: real-time token flow from LLM metrics
export const reactor = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now() / 1000;
    const tenMinAgo = now - 600;

    const recentLlm = await ctx.db
      .query("llmMetrics")
      .withIndex("by_timestamp")
      .order("desc")
      .take(100);

    const active = recentLlm.filter((m) => m.timestamp >= tenMinAgo);

    let totalPrompt = 0;
    let totalCompletion = 0;
    let totalCost = 0;
    const byProvider: Record<string, { tokens: number; calls: number }> = {};

    for (const m of active) {
      totalPrompt += m.promptTokens;
      totalCompletion += m.completionTokens;
      totalCost += m.cost ?? 0;
      if (!byProvider[m.provider]) byProvider[m.provider] = { tokens: 0, calls: 0 };
      byProvider[m.provider].tokens += m.totalTokens;
      byProvider[m.provider].calls++;
    }

    // Latest context snapshot for overall context pressure
    const latestContext = await ctx.db
      .query("contextSnapshots")
      .withIndex("by_timestamp")
      .order("desc")
      .first();

    return {
      totalPromptTokens: totalPrompt,
      totalCompletionTokens: totalCompletion,
      totalCost,
      callsLast10Min: active.length,
      byProvider,
      contextPressure: latestContext?.contextTokens
        ? Math.min((latestContext.contextTokens / 200000) * 100, 100)
        : 0,
      particles: active.slice(0, 40).map((m) => ({
        provider: m.provider,
        model: m.model,
        tokens: m.totalTokens,
        cost: m.cost ?? 0,
        age: now - m.timestamp,
      })),
    };
  },
});
