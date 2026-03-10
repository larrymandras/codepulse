import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// 1. Stale session detection — every 5 min
crons.interval("stale sessions", { minutes: 5 }, internal.health.detectStaleSessions);

// 2. Alert evaluation — every 1 min
crons.interval("alert evaluation", { minutes: 1 }, internal.alerts.evaluateInternal);

// 3. Metric aggregation — every 5 min
crons.interval("metric rollup", { minutes: 5 }, internal.metrics.rollup);

// 4. Docker health poll — every 2 min
crons.interval("docker poll", { minutes: 2 }, internal.docker.pollHealth);

// 5. Supabase health poll — every hour
crons.interval("supabase poll", { hours: 1 }, internal.supabase.pollHealth);

// 6. LLM cost aggregation — every 10 min
crons.interval("llm cost rollup", { minutes: 10 }, internal.llm.rollupCosts);

// 7. Stale agent cleanup — every 10 min
crons.interval("stale agents", { minutes: 10 }, internal.health.detectStaleAgents);

// 8. Profile activity summary — every 15 min
crons.interval("profile summary", { minutes: 15 }, internal.profiles.summarize);

// 9. Episodic memory pruning — daily
crons.interval("memory prune", { hours: 24 }, internal.episodic.prune);

// ── Data retention purge jobs ──────────────────────────────────────

// 10. Purge telemetry events older than 30 days — daily at 3:00 AM UTC
crons.daily(
  "purge old telemetry events",
  { hourUTC: 3, minuteUTC: 0 },
  internal.dataRetention.purgeOldTelemetryEvents
);

// 11. Purge agent heartbeat alerts older than 7 days — daily at 3:15 AM UTC
crons.daily(
  "purge old heartbeat alerts",
  { hourUTC: 3, minuteUTC: 15 },
  internal.dataRetention.purgeOldHeartbeatAlerts
);

// 12. Purge memory events older than 90 days — daily at 3:30 AM UTC
crons.daily(
  "purge old memory events",
  { hourUTC: 3, minuteUTC: 30 },
  internal.dataRetention.purgeOldMemoryEvents
);

export default crons;
