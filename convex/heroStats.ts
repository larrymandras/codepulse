import { query } from "./_generated/server";

/**
 * Ceiling on the discoveredTools count read. Generous relative to real volume
 * (361 rows as of 2026-07-20) so the displayed stat stays exact, while making
 * it impossible for this query to blow the system-operation limit as the table
 * grows — see the note at the read site.
 */
const TOOLS_COUNT_CAP = 5000;

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

    // Recent events (last hour for sparkline + error rate).
    //
    // The index scan MUST be bounded to the hour we actually use. An unbounded
    // `.order("desc").take(500)` on this table blows Convex's system-operation
    // limit on a large deployment ("Your request timed out performing too many
    // system operations") — and because this query runs on every page via
    // useHeroStats, that error is unhandled and unmounts the whole React tree,
    // blanking the page. Measured on the self-hosted backend: unbounded
    // take(500) fails, take(50) works, and this range-bounded form returns the
    // same rows cheaply. `events` is the only table where this bites;
    // llmMetrics/securityEvents below use the same pattern at lower volume.
    //
    // Semantically identical to the old code, which took the newest 500 and
    // then discarded everything older than an hour.
    const recentEvents = await ctx.db
      .query("events")
      .withIndex("by_timestamp2", (q) => q.gte("timestamp", oneHourAgo))
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

    // Known tools — a plain count of the whole table.
    //
    // NOT indexable: there is no filter here, so an index cannot reduce the
    // work (discoveredTools already has by_name/by_source/by_usage and none of
    // them apply to an unfiltered count). The only way to keep this bounded is
    // to cap the read, which is what protects the query from the same
    // system-operation timeout that the events scan above hit.
    //
    // At 361 rows today the cap is nowhere near binding, so the displayed
    // count is exact. If the table ever exceeds it the stat saturates rather
    // than blanking the page — a wrong-but-large number beats an unhandled
    // error that unmounts the React tree. Swap to a maintained counter if an
    // exact count past the cap ever matters.
    const tools = await ctx.db.query("discoveredTools").take(TOOLS_COUNT_CAP);

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
