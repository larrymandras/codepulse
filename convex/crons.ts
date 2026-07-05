import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Existing
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

// Phase 70: Email digest delivery (after daily digest generation, 06:05 UTC)
crons.daily(
  "send-email-digest",
  { hourUTC: 6, minuteUTC: 5 },
  internal.emailDigest.sendEmailDigest
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

// Docker container staleness cleanup (every 5 minutes)
crons.interval(
  "docker-health-cleanup",
  { minutes: 5 },
  internal.docker.pollHealth
);

// Phase 68: Gateway quota polling (every 5 minutes)
crons.interval(
  "poll-gateway-quota",
  { minutes: 5 },
  internal.gatewayQuota.pollAndStore
);

// Supabase health keepalive (every hour)
crons.interval(
  "supabase-health-poll",
  { hours: 1 },
  internal.supabase.pollHealth
);

// Phase 80: Forge command bridge — expire unclaimed commands past their TTL (D-12)
crons.interval(
  "expire-stale-forge-commands",
  { minutes: 1 },
  internal.forge.expireStaleCommands,
);

// Phase 81: Forge log retention (D-2)
crons.daily(
  "sweep-forge-log-chunks",
  { hourUTC: 3, minuteUTC: 30 },
  internal.forge.sweepForgeLogChunks,
);

// Phase 82: Forge file/artifact retention (D-05)
// Offset from the 03:30 log sweep to avoid scheduler contention.
crons.daily(
  "sweep-forge-file-records",
  { hourUTC: 4, minuteUTC: 0 },
  internal.forge.sweepForgeFileRecords,
);

// Phase 83: Graph snapshot version retention (D-03)
// Offset from the 04:00 file sweep to avoid scheduler contention.
crons.daily(
  "sweep-graph-snapshot-versions",
  { hourUTC: 4, minuteUTC: 30 },
  internal.graphSnapshots.sweepGraphSnapshotVersions,
);

// Phase 93: Nightly LLM-judge sampling (EVAL-02). Offset from the 04:30
// graph-snapshot sweep and the 06:00 daily-digest generation to avoid
// scheduler contention.
crons.daily(
  "judge-sampled-sessions",
  { hourUTC: 5, minuteUTC: 0 },
  internal.evalScores.judgeSessionsAction,
);

export default crons;
