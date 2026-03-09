import { query } from "./_generated/server";

export const summary = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now() / 1000;
    const oneHourAgo = now - 3600;

    // Active sessions
    const activeSessions = await ctx.db
      .query("sessions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    // Running agents
    const runningAgents = await ctx.db
      .query("agents")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .collect();

    // Recent events (last hour for sparkline + error rate)
    const recentEvents = await ctx.db
      .query("events")
      .withIndex("by_timestamp")
      .order("desc")
      .take(500);
    const hourEvents = recentEvents.filter((e) => e.timestamp >= oneHourAgo);
    const errorEvents = hourEvents.filter(
      (e) => e.eventType === "error" || e.eventType === "tool_error"
    );
    const errorRate =
      hourEvents.length > 0
        ? Math.round((errorEvents.length / hourEvents.length) * 100)
        : 0;

    // Events sparkline: 12 buckets of 5 min each over last hour
    const sparkline: number[] = Array(12).fill(0);
    for (const e of hourEvents) {
      const bucket = Math.min(11, Math.floor((now - e.timestamp) / 300));
      sparkline[11 - bucket]++;
    }

    // Active alerts
    const activeAlerts = await ctx.db
      .query("alerts")
      .withIndex("by_acknowledged", (q) => q.eq("acknowledged", false))
      .collect();
    const criticalAlerts = activeAlerts.filter((a) => a.severity === "critical").length;
    const errorAlerts = activeAlerts.filter((a) => a.severity === "error").length;

    // LLM cost this hour
    const recentLlm = await ctx.db
      .query("llmMetrics")
      .withIndex("by_timestamp")
      .order("desc")
      .take(200);
    const hourLlm = recentLlm.filter((m) => m.timestamp >= oneHourAgo);
    const hourlyCost = hourLlm.reduce((s, m) => s + (m.cost ?? 0), 0);
    const hourlyTokens = hourLlm.reduce((s, m) => s + m.totalTokens, 0);

    // Cost sparkline: 12 × 5-min buckets
    const costSparkline: number[] = Array(12).fill(0);
    for (const m of hourLlm) {
      const bucket = Math.min(11, Math.floor((now - m.timestamp) / 300));
      costSparkline[11 - bucket] += m.cost ?? 0;
    }

    // Known tools
    const tools = await ctx.db.query("discoveredTools").collect();

    // Security events this hour
    const recentSecurity = await ctx.db
      .query("securityEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(100);
    const hourSecurity = recentSecurity.filter((e) => e.timestamp >= oneHourAgo);

    // Overall health: green / yellow / red
    const health: "green" | "yellow" | "red" =
      criticalAlerts > 0 || errorRate > 30
        ? "red"
        : errorAlerts > 0 || errorRate > 10
          ? "yellow"
          : "green";

    return {
      activeSessions: activeSessions.length,
      runningAgents: runningAgents.length,
      errorRate,
      errorsThisHour: errorEvents.length,
      eventsThisHour: hourEvents.length,
      eventSparkline: sparkline,
      activeAlerts: activeAlerts.length,
      criticalAlerts,
      errorAlerts,
      hourlyCost,
      hourlyTokens,
      costSparkline,
      knownTools: tools.length,
      securityEvents: hourSecurity.length,
      health,
    };
  },
});
