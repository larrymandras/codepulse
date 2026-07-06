import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { getBillingType } from "./lib/providers";

export const recordCall = mutation({
  args: {
    provider: v.string(),
    model: v.string(),
    promptTokens: v.float64(),
    completionTokens: v.float64(),
    totalTokens: v.float64(),
    latencyMs: v.float64(),
    cost: v.optional(v.float64()),
    sessionId: v.optional(v.string()),
    timestamp: v.float64(),
    agentId: v.optional(v.string()),
    toolName: v.optional(v.string()),
    goalId: v.optional(v.string()),   // Phase 149 PULSE-01 — swarm cost join
    traceId: v.optional(v.string()),  // Phase 94 TRACE-01 — per-turn trace grouping
    cacheReadInputTokens: v.optional(v.float64()),      // prompt-cache hit monitoring
    cacheCreationInputTokens: v.optional(v.float64()),  // prompt-cache write monitoring
  },
  handler: async (ctx, args) => {
    const billingType = getBillingType(args.provider);
    await ctx.db.insert("llmMetrics", {
      provider: args.provider,
      model: args.model,
      promptTokens: args.promptTokens,
      completionTokens: args.completionTokens,
      totalTokens: args.totalTokens,
      latencyMs: args.latencyMs,
      cost: args.cost,
      sessionId: args.sessionId,
      timestamp: args.timestamp,
      agentId: args.agentId,
      toolName: args.toolName,
      billingType,
      goalId: args.goalId,
      traceId: args.traceId,
      cacheReadInputTokens: args.cacheReadInputTokens,
      cacheCreationInputTokens: args.cacheCreationInputTokens,
    });
  },
});

/**
 * Prompt-cache hit rate for Anthropic providers (cache_control only applies
 * there), windowed (default 24h so it stays responsive instead of being diluted
 * by historical pre-fix rows) and broken down per-model — the main agent
 * (sonnet/opus) caches a large stable system prefix, while the haiku classifier
 * has too small a prefix to cache, so a single org-wide number hides the win.
 *
 * hitRate = cache_read / total prompt tokens, where
 * total = uncached input + cache writes + cache reads.
 */
type CacheAcc = { calls: number; read: number; creation: number; uncached: number };

function shapeCacheAcc(a: CacheAcc) {
  const total = a.read + a.creation + a.uncached;
  return {
    calls: a.calls,
    cacheReadInputTokens: a.read,
    cacheCreationInputTokens: a.creation,
    uncachedInputTokens: a.uncached,
    totalPromptTokens: total,
    hitRate: total > 0 ? a.read / total : 0,
  };
}

export const cacheStats = query({
  args: { windowHours: v.optional(v.float64()), sessionId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const hours = args.windowHours ?? 24;
    const cutoff = Date.now() / 1000 - hours * 3600;
    // Per-session rollup when sessionId is given (uses the existing by_session index);
    // otherwise the global window. Both feed the same aggregation below.
    const all = args.sessionId
      ? await ctx.db
          .query("llmMetrics")
          .withIndex("by_session", (q) =>
            q.eq("sessionId", args.sessionId!).gte("timestamp", cutoff)
          )
          .filter((q) => q.neq(q.field("archived"), true))
          .collect()
      : await ctx.db
          .query("llmMetrics")
          .withIndex("by_timestamp", (q) => q.gte("timestamp", cutoff))
          .filter((q) => q.neq(q.field("archived"), true))
          .collect();

    const overall: CacheAcc = { calls: 0, read: 0, creation: 0, uncached: 0 };
    const perModel: Record<string, CacheAcc> = {};
    for (const r of all) {
      if (!r.provider.startsWith("anthropic")) continue; // cache only applies to Anthropic
      const read = r.cacheReadInputTokens ?? 0;
      const creation = r.cacheCreationInputTokens ?? 0;
      const uncached = r.promptTokens ?? 0;
      overall.calls++;
      overall.read += read;
      overall.creation += creation;
      overall.uncached += uncached;
      if (!perModel[r.model]) perModel[r.model] = { calls: 0, read: 0, creation: 0, uncached: 0 };
      const m = perModel[r.model];
      m.calls++;
      m.read += read;
      m.creation += creation;
      m.uncached += uncached;
    }

    const byModel = Object.entries(perModel)
      .map(([model, a]) => ({ model, ...shapeCacheAcc(a) }))
      .sort((x, y) => y.totalPromptTokens - x.totalPromptTokens);

    return { windowHours: hours, overall: shapeCacheAcc(overall), byModel };
  },
});

/**
 * Full-session, chronological, non-archived llmMetrics rows for the Trace
 * Waterfall (Phase 94 TRACE-02). Unlike cacheStats, no rolling-window cutoff
 * is applied — the Trace tab shows the whole session so the client can group
 * rows by traceId. No server-side grouping/cost estimation/cache derivation;
 * the UI component owns presentation (D-14/D-13).
 */
export const sessionCalls = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("llmMetrics")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .filter((q) => q.neq(q.field("archived"), true))
      .collect();
  },
});

export const recentCalls = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("llmMetrics")
      .withIndex("by_timestamp")
      .order("desc")
      .filter((q) => q.neq(q.field("archived"), true))
      .take(50);
  },
});

export const recentCallsPaginated = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("llmMetrics")
      .withIndex("by_timestamp")
      .order("desc")
      .filter((q) => q.neq(q.field("archived"), true))
      .paginate(args.paginationOpts);
  },
});

export const costByProvider = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() / 1000 - 30 * 86400;
    const all = await ctx.db.query("llmMetrics")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", cutoff))
      .filter((q) => q.neq(q.field("archived"), true))
      .collect();
    const grouped: Record<string, number> = {};
    for (const record of all) {
      grouped[record.provider] =
        (grouped[record.provider] ?? 0) + (record.cost ?? 0);
    }
    return grouped;
  },
});

export const costByModel = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() / 1000 - 30 * 86400;
    const all = await ctx.db.query("llmMetrics")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", cutoff))
      .filter((q) => q.neq(q.field("archived"), true))
      .collect();
    const grouped: Record<string, { calls: number; tokens: number; cost: number }> = {};
    for (const r of all) {
      const key = r.model;
      if (!grouped[key]) grouped[key] = { calls: 0, tokens: 0, cost: 0 };
      grouped[key].calls++;
      grouped[key].tokens += r.totalTokens;
      grouped[key].cost += r.cost ?? 0;
    }
    return grouped;
  },
});

export const providerBreakdown = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() / 1000 - 30 * 86400;
    const all = await ctx.db.query("llmMetrics")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", cutoff))
      .filter((q) => q.neq(q.field("archived"), true))
      .collect();
    const grouped: Record<string, { calls: number; totalLatency: number; cost: number }> = {};
    for (const r of all) {
      if (!grouped[r.provider]) grouped[r.provider] = { calls: 0, totalLatency: 0, cost: 0 };
      grouped[r.provider].calls++;
      grouped[r.provider].totalLatency += r.latencyMs;
      grouped[r.provider].cost += r.cost ?? 0;
    }
    return Object.entries(grouped).map(([provider, data]) => ({
      provider,
      calls: data.calls,
      avgLatency: Math.round(data.totalLatency / data.calls),
      cost: data.cost,
    }));
  },
});

export const costOverTime = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() / 1000 - 30 * 86400;
    const all = await ctx.db
      .query("llmMetrics")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", cutoff))
      .order("asc")
      .filter((q) => q.neq(q.field("archived"), true))
      .collect();
    return all.map((r) => ({
      timestamp: r.timestamp,
      provider: r.provider,
      cost: r.cost ?? 0,
      tokens: r.totalTokens,
    }));
  },
});

export const latencyOverTime = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() / 1000 - 30 * 86400;
    const all = await ctx.db
      .query("llmMetrics")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", cutoff))
      .order("asc")
      .filter((q) => q.neq(q.field("archived"), true))
      .collect();
    return all.map((r) => ({
      timestamp: r.timestamp,
      provider: r.provider,
      latencyMs: r.latencyMs,
    }));
  },
});

export const rollupCosts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now() / 1000;
    const oneDayAgo = now - 86400;

    const recent = await ctx.db
      .query("llmMetrics")
      .withIndex("by_timestamp")
      .order("desc")
      .filter((q) => q.neq(q.field("archived"), true))
      .take(1000);

    const dayMetrics = recent.filter((m) => m.timestamp >= oneDayAgo);
    const byProvider: Record<string, { cost: number; tokens: number; calls: number }> = {};

    for (const m of dayMetrics) {
      if (!byProvider[m.provider]) byProvider[m.provider] = { cost: 0, tokens: 0, calls: 0 };
      byProvider[m.provider].cost += m.cost ?? 0;
      byProvider[m.provider].tokens += m.totalTokens;
      byProvider[m.provider].calls++;
    }

    // Store daily rollup as metricSnapshots
    for (const [provider, data] of Object.entries(byProvider)) {
      await ctx.db.insert("metricSnapshots", {
        metricName: `llm_daily_cost_${provider}`,
        value: data.cost,
        tags: { provider, tokens: data.tokens, calls: data.calls, type: "daily_rollup" },
        timestamp: now,
      });
    }

    return { providers: Object.keys(byProvider).length };
  },
});

/** Phase 67 D-01: Subscription provider usage (call count + token total).
 *  Used by Analytics page Subscription Usage MetricCard. */
export const subscriptionUsage = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() / 1000 - 30 * 86400;
    const all = await ctx.db.query("llmMetrics")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", cutoff))
      .filter((q) => q.neq(q.field("archived"), true))
      .collect();

    const subRows = all.filter((r) => getBillingType(r.provider) === "subscription");

    let totalCalls = 0;
    let totalTokens = 0;
    for (const r of subRows) {
      totalCalls++;
      totalTokens += r.totalTokens;
    }

    return { calls: totalCalls, tokens: totalTokens };
  },
});

export const backfillAgentId = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Process in batches of 100 to avoid mutation timeout
    const rows = await ctx.db
      .query("llmMetrics")
      .withIndex("by_timestamp")
      .filter((q) => q.eq(q.field("agentId"), undefined))
      .take(100);

    let patched = 0;
    for (const row of rows) {
      // Attempt to derive agentId via sessionId -> agents table lookup
      let derivedAgentId: string | undefined;

      if (row.sessionId) {
        const agent = await ctx.db
          .query("agents")
          .withIndex("by_session", (q) => q.eq("sessionId", row.sessionId!))
          .first();
        if (agent) {
          derivedAgentId = agent.agentId;
        }
      }

      await ctx.db.patch(row._id, {
        agentId: derivedAgentId ?? "_unknown",
      });
      patched++;
    }

    // Return processed count: caller repeats until processed === 0
    return { processed: rows.length, patched };
  },
});
