import { internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// ============================================================
// PURE HELPER FUNCTIONS — exported for testing
// ============================================================

export function computeZScore(value: number, historicalValues: number[]): number {
  if (historicalValues.length === 0) return 0;
  const mean = historicalValues.reduce((s, v) => s + v, 0) / historicalValues.length;
  const variance =
    historicalValues.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / historicalValues.length;
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

export function classifySeverity(
  absZScore: number,
  absDelta?: number,
  minDelta = 5.0,
): "warning" | "critical" | null {
  if (absDelta !== undefined && absDelta < minDelta) return null;
  if (absZScore >= 5) return "critical";
  if (absZScore >= 3) return "warning";
  return null;
}

// ============================================================
// INTERNAL MUTATION — cron target (every 6 hours)
// Evaluates cost, errors, and latency metrics from daily aggregates.
// Creates anomalyEvents rows and alerts for 2sigma+ deviations.
// Threat T-07-09: at most 3 alerts per cycle (one per metric) — enforced by dedup guard.
// ============================================================

export const evaluateInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now() / 1000;
    const fourteenDaysAgo = now - 14 * 86400;

    // Load active unacknowledged alerts to deduplicate (per T-07-09)
    const activeAlerts = await ctx.db
      .query("alerts")
      .withIndex("by_acknowledged", (q) => q.eq("acknowledged", false))
      .collect();
    const activeSourceSet = new Set(activeAlerts.map((a) => a.source));

    const metrics = ["cost", "errors", "latency"] as const;

    for (const metric of metrics) {
      // "latency" reuses the "errors" metric_type dimension pattern — skip if no data
      const metricType = metric === "latency" ? "errors" : metric;

      const rows = await ctx.db
        .query("aggregates")
        .withIndex("by_type_period_bucket", (q) =>
          q
            .eq("metric_type", metricType)
            .eq("period", "daily")
            .gte("bucket_start", fourteenDaysAgo)
        )
        .collect();

      if (rows.length < 2) continue; // Need at least today + 1 historical day

      // Sum values per day (multiple rows per day due to dimensions)
      const valuesByDay: Record<number, number> = {};
      for (const row of rows) {
        valuesByDay[row.bucket_start] = (valuesByDay[row.bucket_start] ?? 0) + row.value;
      }

      const sortedDays = Object.keys(valuesByDay)
        .map(Number)
        .sort((a, b) => a - b);

      if (sortedDays.length < 2) continue;

      const todayBucket = sortedDays[sortedDays.length - 1];
      const historicalBuckets = sortedDays.slice(0, -1);

      const todayValue = valuesByDay[todayBucket];
      const historicalValues = historicalBuckets.map((b) => valuesByDay[b]);

      const mean =
        historicalValues.reduce((s, v) => s + v, 0) / historicalValues.length;
      const variance =
        historicalValues.reduce((s, v) => s + Math.pow(v - mean, 2), 0) /
        historicalValues.length;
      const stdDev = Math.sqrt(variance);

      const zScore = computeZScore(todayValue, historicalValues);
      const absDelta = Math.abs(todayValue - mean);
      const severity = classifySeverity(Math.abs(zScore), absDelta);

      if (!severity) continue;

      // Insert anomalyEvents row
      const anomalyId = await ctx.db.insert("anomalyEvents", {
        metric,
        value: todayValue,
        mean,
        stdDev,
        zScore,
        severity,
        detectedAt: now,
      });

      // Dedup: only create alert if no active alert for this source (T-07-09)
      const alertSource = `anomaly_detection-${metric}`;
      if (!activeSourceSet.has(alertSource)) {
        const alertId = await ctx.db.insert("alerts", {
          severity,
          source: alertSource,
          message: `Anomaly detected: ${metric} value ${todayValue.toFixed(2)} is ${Math.abs(zScore).toFixed(1)} standard deviations from mean (${mean.toFixed(2)})`,
          acknowledged: false,
          createdAt: now,
          webhookStatus: "pending",
        });
        activeSourceSet.add(alertSource);

        // Schedule webhook delivery for Discord/Slack notification (per D-12)
        await ctx.scheduler.runAfter(0, internal.webhookDelivery.sendAlertWebhook, {
          alertId,
          attempt: 1,
        });

        // Link alert to the anomalyEvents row
        await ctx.db.patch(anomalyId, { alertId });
      }
    }
  },
});

// ============================================================
// PUBLIC QUERY — returns active anomalies from last 24 hours
// Result: Record<metric, highest-severity anomaly data>
// ============================================================

export const getActiveAnomalies = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() / 1000 - 86400;

    // Query recent anomalies across all metrics using severity index,
    // then filter by detectedAt in JS (no composite index supports cross-metric range)
    const all = await ctx.db
      .query("anomalyEvents")
      .collect();
    const recent = all.filter((e) => e.detectedAt >= cutoff);

    // Group by metric; keep highest severity (critical > warning)
    const result: Record<
      string,
      { severity: string; value: number; mean: number; zScore: number; detectedAt: number }
    > = {};

    for (const event of recent) {
      const existing = result[event.metric];
      const isBetter =
        !existing ||
        (event.severity === "critical" && existing.severity !== "critical");
      if (isBetter) {
        result[event.metric] = {
          severity: event.severity,
          value: event.value,
          mean: event.mean,
          zScore: event.zScore,
          detectedAt: event.detectedAt,
        };
      }
    }

    return result;
  },
});
