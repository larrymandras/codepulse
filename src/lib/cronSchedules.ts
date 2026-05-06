export interface CronSchedule {
  jobName: string;
  label: string;
  interval: string;
  source: "convex";
  intervalSeconds: number;
  dailyUTC?: { hour: number; minute: number };
}

export const CRON_SCHEDULES: CronSchedule[] = [
  { jobName: "auto-acknowledge stale alerts", label: "Auto-Ack Stale Alerts", interval: "Every 1 hour", source: "convex", intervalSeconds: 3600 },
  { jobName: "aggregate-hourly", label: "Hourly Aggregation", interval: "Every 1 hour", source: "convex", intervalSeconds: 3600 },
  { jobName: "aggregate-daily", label: "Daily Rollup", interval: "Daily 01:00 UTC", source: "convex", intervalSeconds: 86400, dailyUTC: { hour: 1, minute: 0 } },
  { jobName: "archive-stale-events", label: "Archive Stale Events", interval: "Daily 02:00 UTC", source: "convex", intervalSeconds: 86400, dailyUTC: { hour: 2, minute: 0 } },
  { jobName: "evaluate-alert-rules", label: "Alert Rule Evaluation", interval: "Every 2 min", source: "convex", intervalSeconds: 120 },
  { jobName: "deliver-digest-alerts", label: "Digest Delivery", interval: "Every 1 hour", source: "convex", intervalSeconds: 3600 },
  { jobName: "cleanup-expired-mutes", label: "Cleanup Expired Mutes", interval: "Every 6 hours", source: "convex", intervalSeconds: 21600 },
  { jobName: "generate-daily-digest", label: "Daily Digest", interval: "Daily 06:00 UTC", source: "convex", intervalSeconds: 86400, dailyUTC: { hour: 6, minute: 0 } },
  { jobName: "detect-anomalies", label: "Anomaly Detection", interval: "Every 6 hours", source: "convex", intervalSeconds: 21600 },
  { jobName: "evaluate-memory-quality", label: "Memory Quality Eval", interval: "Daily 03:00 UTC", source: "convex", intervalSeconds: 86400, dailyUTC: { hour: 3, minute: 0 } },
  { jobName: "poll-supabase-health", label: "Supabase Health Poll", interval: "Every 30 min", source: "convex", intervalSeconds: 1800 },
];

export function estimateNextRun(schedule: CronSchedule, lastRunAt?: number): number {
  const now = Date.now() / 1000;
  if (schedule.dailyUTC) {
    const d = new Date();
    d.setUTCHours(schedule.dailyUTC.hour, schedule.dailyUTC.minute, 0, 0);
    let next = d.getTime() / 1000;
    if (next <= now) next += 86400;
    return next;
  }
  if (lastRunAt) {
    const next = lastRunAt + schedule.intervalSeconds;
    return next > now ? next : now + schedule.intervalSeconds;
  }
  return now + schedule.intervalSeconds;
}
