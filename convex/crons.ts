import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "detect-stale-sessions",
  { minutes: 15 },
  internal.health.detectStaleSessions
);

crons.interval(
  "auto-acknowledge stale alerts",
  { hours: 1 },
  internal.alerts.autoAcknowledgeStaleInternal
);

// Phase 5: Hourly aggregation
crons.interval(
  "aggregate-hourly",
  { hours: 1 },
  internal.aggregates.computeHourly
);

// Phase 5: Daily rollup at 01:00 UTC
crons.daily(
  "aggregate-daily",
  { hourUTC: 1, minuteUTC: 0 },
  internal.aggregates.rollupDaily
);

// Phase 5: Archival at 02:00 UTC
crons.daily(
  "archive-stale-events",
  { hourUTC: 2, minuteUTC: 0 },
  internal.archival.markStaleArchived
);

// Phase 6: Alert rule evaluation (every 2 minutes)
crons.interval(
  "evaluate-alert-rules",
  { minutes: 2 },
  internal.alerts.evaluateInternal
);

// Phase 6: Digest delivery (every 1 hour — respects configurable interval preference)
crons.interval(
  "deliver-digest-alerts",
  { hours: 1 },
  internal.webhookDelivery.sendDigest
);

// Phase 6: Cleanup expired mute records (every 6 hours)
crons.interval(
  "cleanup-expired-mutes",
  { hours: 6 },
  internal.alertMutes.cleanupExpired
);

// Phase 7: Daily digest generation at 06:00 UTC
crons.daily(
  "generate-daily-digest",
  { hourUTC: 6, minuteUTC: 0 },
  internal.briefings.triggerDailyDigest
);

// Phase 7: Anomaly detection (every 6 hours)
crons.interval(
  "detect-anomalies",
  { hours: 6 },
  internal.anomalyDetection.evaluateInternal
);

// Phase 7: Memory quality evaluation (daily at 03:00 UTC)
crons.daily(
  "evaluate-memory-quality",
  { hourUTC: 3, minuteUTC: 0 },
  internal.memoryQuality.evaluateInternal
);

// Infrastructure: Supabase health poll (every 30 minutes)
crons.interval(
  "poll-supabase-health",
  { minutes: 30 },
  internal.supabase.pollHealth
);

// Phase 095: Transcript retention cleanup (daily at 04:00 UTC, D-11)
crons.daily(
  "cleanup transcript records older than 90 days",
  { hourUTC: 4, minuteUTC: 0 },
  internal.transcripts.cleanupOldRecords,
);

export default crons;
