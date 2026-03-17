export interface CronSchedule {
  jobName: string;
  label: string;
  interval: string;
  source: "convex";
  intervalSeconds: number;
  dailyUTC?: { hour: number; minute: number };
}

export const CRON_SCHEDULES: CronSchedule[] = [
  { jobName: "stale sessions", label: "Stale Session Detection", interval: "Every 5 min", source: "convex", intervalSeconds: 300 },
  { jobName: "alert evaluation", label: "Alert Evaluation", interval: "Every 1 min", source: "convex", intervalSeconds: 60 },
  { jobName: "metric rollup", label: "Metric Aggregation", interval: "Every 5 min", source: "convex", intervalSeconds: 300 },
  { jobName: "docker poll", label: "Docker Health Poll", interval: "Every 2 min", source: "convex", intervalSeconds: 120 },
  { jobName: "supabase poll", label: "Supabase Health Poll", interval: "Every 1 hour", source: "convex", intervalSeconds: 3600 },
  { jobName: "llm cost rollup", label: "LLM Cost Aggregation", interval: "Every 10 min", source: "convex", intervalSeconds: 600 },
  { jobName: "stale agents", label: "Stale Agent Cleanup", interval: "Every 10 min", source: "convex", intervalSeconds: 600 },
  { jobName: "profile summary", label: "Profile Activity Summary", interval: "Every 15 min", source: "convex", intervalSeconds: 900 },
  { jobName: "memory prune", label: "Episodic Memory Pruning", interval: "Daily", source: "convex", intervalSeconds: 86400 },
  { jobName: "purge old telemetry events", label: "Purge Old Telemetry", interval: "Daily 03:00 UTC", source: "convex", intervalSeconds: 86400, dailyUTC: { hour: 3, minute: 0 } },
  { jobName: "purge old heartbeat alerts", label: "Purge Old Heartbeats", interval: "Daily 03:15 UTC", source: "convex", intervalSeconds: 86400, dailyUTC: { hour: 3, minute: 15 } },
  { jobName: "purge old memory events", label: "Purge Old Memory Events", interval: "Daily 03:30 UTC", source: "convex", intervalSeconds: 86400, dailyUTC: { hour: 3, minute: 30 } },
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
