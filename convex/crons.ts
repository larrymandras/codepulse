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
// COST-01: rollupDaily gained an optional `dayStart`; passing {} keeps the
// cron on its default target (yesterday UTC midnight) unchanged.
//
// COST-01 root-cause fix (2026-08-07): on the default path this ALSO re-checks
// a rotating slice of older days (DAILY_REPAIR_DAYS_PER_RUN), so an hourly row
// written for an already-past day self-heals instead of never getting a daily
// row. That is not hypothetical — Phase 104's backfillTokenSplit did exactly
// that and the daily cost series read 3.3x low until it was repaired by hand.
// The extra work is 2 indexed day-range reads per night and is wrapped in its
// own try/catch inside the handler, so it can never fail this cron and trigger
// the retry-backoff storm that got the three crons below disabled.
crons.daily(
  "aggregate-daily",
  { hourUTC: 1, minuteUTC: 0 },
  internal.aggregates.rollupDaily,
  {}
);

// DISABLED 2026-07-14 (self-hosted migration incident): markStaleArchived and
// evaluateInternal hit the 15s syscall cap on self-hosted Convex (single node,
// SQLite, 3.2M docs) and NEVER complete.
// A failing cron execution retries on its own backoff regardless of schedule,
// so throttling does not help — the retry storms starved ingest mutations.
// Re-enable once their queries are bounded / retention has shrunk the tables.
//
// sweepGraphSnapshotVersions was in this list until 2026-08-21 and is now
// RE-ENABLED below — its candidate-selection read was bounded by the
// storedVersions field landing 2026-08-16. Do not re-add it here.
//
// REVIEWED 2026-08-21 — this marker is what the astridr health watchdog's
// convex_disabled_crons probe reads. It used to key on age-since-DISABLED,
// which only grows, so it could never pass without re-enabling these crons —
// the one action that would redeploy the retry-storm incident. It now measures
// how long since the DECISION was last re-checked. Re-measure the two claims
// below (retention still catching up; alertRules still empty) and bump this
// date; do not bump it without re-measuring.
//
// Status of the two still listed, measured 2026-08-21 — BOTH are currently
// no-ops, so neither is urgent:
//   - markStaleArchived only SETS `archived: true`; convex/retention.ts already
//     DELETES these tables nightly (verdict=OK, all 21 tables caught up), so the
//     flag only affects the 30d–90d window, and the queries that read it are
//     themselves time-bounded to 48h.
//   - evaluateInternal evaluates `alertRules`, which currently has ZERO rows.
//     Alerts still fire — they come from costBudgetEval, a different path.
//
// Phase 5: Archival at 02:00 UTC
// crons.daily(
//   "archive-stale-events",
//   { hourUTC: 2, minuteUTC: 0 },
//   internal.archival.markStaleArchived
// );

// Phase 6: Alert rule evaluation (disabled — see note above)
// crons.interval(
//   "evaluate-alert-rules",
//   { hours: 1 },
//   internal.alerts.evaluateInternal
// );

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
//
// RE-ENABLED 2026-08-21. Both blockers that kept this disabled since 2026-07-14
// are now resolved, verified against the live backend:
//   1. Candidate selection no longer scans entity rows — `graphSnapshots
//      .storedVersions` landed 2026-08-16, so the sweep reads ONE meta field.
//      (This is what the 2026-08-13 "CAUSE PINNED / do NOT re-enable" note asked
//      for; that note was written before the field existed and was stale.)
//   2. The per-version delete cap was corrected 2026-08-13 from a .collect() with
//      a 15,000 cap justified against the 16,000-doc WRITE ceiling to a bounded
//      .take() at MAX_DELETES_PER_INVOCATION=1000, against the real binding limit
//      of 4,096 READS (a ctx.db.delete() counts as a read).
//
// HOURLY, not daily, and deliberately so. `storedVersions` was found on
// 2026-08-21 to be PRESENT BUT INCOMPLETE: the field was added to a table that
// already had rows, ingest appends to `existing?.storedVersions ?? []`, and
// backfillGraphStoredVersions SKIPS any doc where the field is already set
// (force=false default) — so it read [57,58,59,60] while versions 5..60 all had
// rows. Versions 5–56 were orphaned, unreachable by any delete path, forever.
// A force=true backfill corrected it to [5..60]; 49 versions (~321k rows) now
// need draining. At 1000 rows/invocation and ~7 invocations per version that is
// ~343 runs — 11 months daily, ~14 days hourly. Hourly is ~0.28 rows/sec, about
// 240x gentler than the 120,000 docs/night (~67/sec) convex/retention.ts already
// sustains, so this does NOT reintroduce the mass-delete tombstone hazard that
// took the dashboard down 2026-07-21/22. The 1000-row cap is untouched — pace was
// raised by FREQUENCY, never by cap. Once the backlog drains (storedVersions
// length <= GRAPH_SNAPSHOT_KEEP_VERSIONS) every run is a cheap no-op, so leaving
// it hourly afterwards costs one meta read per hour.
crons.interval(
  "sweep-graph-snapshot-versions",
  { hours: 1 },
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

// Nightly retention pruning (see convex/retention.ts: 30d runtime firehose,
// 90d history, batch-capped). The historical backlog was applied offline via
// trim+reimport (2026-07-14), so nightly runs age out ~1 day of docs.
crons.daily(
  "retention-prune",
  { hourUTC: 9, minuteUTC: 0 },
  internal.retention.startNightlyPrune
);

// Phase 118 D-08: Studio's 30-day trash janitor. `media` (and its curated
// siblings `mediaStyles`/`mediaModels`) is deliberately EXEMPT from
// RETENTION_DAYS above (D-03) — this cron is the ONLY thing bounding that
// table's growth. Offset to 07:00 UTC — genuinely unused by any entry in
// this file, active OR commented-out (02:00 is claimed by the disabled
// archive-stale-events entry above; picking it anyway would collide the
// moment that entry is ever re-enabled). Same deliberate-offset discipline
// every other entry in this file follows to avoid scheduler contention.
// Batch-capped and cursor-seeked (convex/media.ts's pruneTrashBatch) —
// never an unbounded read, per this file's other batch-capped entries.
crons.daily(
  "studio-trash-prune",
  { hourUTC: 7, minuteUTC: 0 },
  internal.media.pruneTrashBatch,
  {}
);

// Phase 127 D-09/R-04: inbox ack-aware auto-close/prune janitor.
// 08:00 UTC is NOT an empty slot even though no crons.daily claims it —
// sweep-graph-snapshot-versions above is crons.interval({ hours: 1 }) and
// therefore also fires at 08:00 UTC. R-04 moved this and its sibling
// findings janitor below to :20/:35 to avoid that contention outright,
// following this file's own deliberate-offset discipline, rather than
// judging the collision unlikely.
//
// This cron is the ONLY thing bounding `inbox` (D-09) — the table is
// deliberately exempt from RETENTION_DAYS because a plain _creationTime
// cutoff would delete unacked items the operator never saw (D-01/R-02).
// Batch-capped and cursor-seeked (convex/inbox.ts's autoCloseAndPrune),
// same discipline as studio-trash-prune above. The first run drains a
// known ~2,450-row backlog in roughly 13 batches.
crons.daily(
  "inbox-janitor",
  { hourUTC: 8, minuteUTC: 20 },
  internal.inbox.autoCloseAndPrune,
  {}
);

// Phase 127 D-09/R-04: ideationFindings ack-aware auto-dismiss/prune
// janitor. Offset 15 minutes from its sibling inbox janitor above, same
// anti-contention discipline.
//
// This cron is inert by design until roughly 2026-11-16: it auto-dismisses
// findings open past 180 days (M=180d), and the table's oldest row was
// only 94 days old on 2026-08-21. It logs unconditionally on every
// invocation, including zero-work runs, so a long inert stretch is
// attributable rather than looking broken — otherwise a future reader
// finding no deletions would reasonably conclude the cron is dead and
// "fix" it, reproducing the exact 2026-08-21 failure this phase exists to
// prevent.
crons.daily(
  "ideation-findings-janitor",
  { hourUTC: 8, minuteUTC: 35 },
  internal.ideation.autoCloseAndPrune,
  {}
);

export default crons;
