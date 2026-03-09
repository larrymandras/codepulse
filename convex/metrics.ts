import { query, internalMutation } from "./_generated/server";

export const dashboardSummary = query({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db.query("events").collect();
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const tools = await ctx.db.query("discoveredTools").collect();

    const uniqueToolNames = new Set(tools.map((t) => t.name));

    return {
      totalEvents: events.length,
      activeSessions: sessions.length,
      uniqueTools: uniqueToolNames.size,
    };
  },
});

export const rollup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now() / 1000;
    const oneHourAgo = now - 3600;

    // Aggregate recent metricSnapshots into hourly buckets
    const recent = await ctx.db
      .query("metricSnapshots")
      .withIndex("by_timestamp")
      .order("desc")
      .take(500);

    const hourMetrics = recent.filter((m) => m.timestamp >= oneHourAgo);
    const byMetric: Record<string, { sum: number; count: number }> = {};

    for (const m of hourMetrics) {
      if (!byMetric[m.metricName]) byMetric[m.metricName] = { sum: 0, count: 0 };
      byMetric[m.metricName].sum += m.value;
      byMetric[m.metricName].count++;
    }

    // Store rolled up averages
    for (const [name, data] of Object.entries(byMetric)) {
      await ctx.db.insert("metricSnapshots", {
        metricName: `${name}_hourly_avg`,
        value: data.sum / data.count,
        tags: { type: "rollup", count: data.count },
        timestamp: now,
      });
    }

    return { rolledUp: Object.keys(byMetric).length };
  },
});
