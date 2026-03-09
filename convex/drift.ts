import { query } from "./_generated/server";

export const recentChanges = query({
  args: {},
  handler: async (ctx) => {
    const changes = await ctx.db
      .query("configChanges")
      .withIndex("by_changedAt")
      .order("desc")
      .take(100);

    return changes.map((c) => ({
      id: c._id,
      configKey: c.configKey,
      oldValue: c.oldValue,
      newValue: c.newValue,
      changedBy: c.changedBy,
      changedAt: c.changedAt,
      changeType: !c.oldValue ? "added" : c.newValue === null ? "removed" : "modified",
    }));
  },
});

export const driftSummary = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now() / 1000;
    const oneHourAgo = now - 3600;
    const oneDayAgo = now - 86400;

    const allChanges = await ctx.db
      .query("configChanges")
      .withIndex("by_changedAt")
      .order("desc")
      .take(500);

    const hourChanges = allChanges.filter((c) => c.changedAt >= oneHourAgo);
    const dayChanges = allChanges.filter((c) => c.changedAt >= oneDayAgo);

    // Group by config key prefix (e.g., "mcpServer:", "plugin:", "skill:")
    const byCategory: Record<string, number> = {};
    for (const c of dayChanges) {
      const prefix = c.configKey.split(":")[0] || "other";
      byCategory[prefix] = (byCategory[prefix] ?? 0) + 1;
    }

    // Drift velocity: changes per hour over last 24h, 6 buckets of 4h
    const velocity: number[] = Array(6).fill(0);
    for (const c of dayChanges) {
      const bucket = Math.min(5, Math.floor((now - c.changedAt) / 14400));
      velocity[5 - bucket]++;
    }

    return {
      changesLastHour: hourChanges.length,
      changesLast24h: dayChanges.length,
      byCategory,
      velocity,
      isDrifting: hourChanges.length > 5,
    };
  },
});
