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

export default crons;
