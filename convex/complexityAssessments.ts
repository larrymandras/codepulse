import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const insert = mutation({
  args: {
    sessionId: v.string(),
    tier: v.string(),
    score: v.float64(),
    signals: v.optional(v.any()),
    model: v.string(),
    fromOverride: v.boolean(),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("complexityAssessments", args);
  },
});

export const distribution = query({
  args: { windowStart: v.float64() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("complexityAssessments")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", args.windowStart))
      .collect();
    const byTier: Record<string, { auto: number; override: number }> = {};
    for (const r of rows) {
      const key = r.tier;
      byTier[key] ??= { auto: 0, override: 0 };
      if (r.fromOverride) byTier[key].override++;
      else byTier[key].auto++;
    }
    return byTier;
  },
});

export const costSaved30d = query({
  args: {},
  handler: async (ctx) => {
    const windowStart = Date.now() / 1000 - 30 * 86400;
    const metrics = await ctx.db
      .query("agentMetrics")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", windowStart))
      .collect();

    // D-10: For each metric where model != opus, compute savings
    // Opus rates: input=$15/M, output=$75/M (claude-opus-4-5 rates)
    // Opus 4-6 uses same pricing tier
    const OPUS_INPUT = 15.00 / 1_000_000;
    const OPUS_OUTPUT = 75.00 / 1_000_000;

    // Model-specific rates (must match modelPricing.ts)
    const MODEL_RATES: Record<string, { input: number; output: number }> = {
      "claude-opus-4-5":   { input: 15.00 / 1_000_000, output: 75.00 / 1_000_000 },
      "claude-opus-4-6":   { input: 15.00 / 1_000_000, output: 75.00 / 1_000_000 },
      "claude-sonnet-4-5": { input:  3.00 / 1_000_000, output: 15.00 / 1_000_000 },
      "claude-sonnet-4-6": { input:  3.00 / 1_000_000, output: 15.00 / 1_000_000 },
      "claude-haiku-3-5":  { input:  0.80 / 1_000_000, output:  4.00 / 1_000_000 },
    };

    let totalSaved = 0;
    for (const m of metrics) {
      const model = m.modelUsed ?? "default";
      const rates = MODEL_RATES[model];
      if (!rates) continue; // unknown model, skip
      // Only count savings when model is cheaper than opus
      if (rates.input >= OPUS_INPUT && rates.output >= OPUS_OUTPUT) continue;
      const opusCost = m.inputTokens * OPUS_INPUT + m.outputTokens * OPUS_OUTPUT;
      const actualCost = m.inputTokens * rates.input + m.outputTokens * rates.output;
      totalSaved += opusCost - actualCost;
    }
    return { totalSaved, metricCount: metrics.length };
  },
});
