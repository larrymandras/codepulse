import { internalMutation } from "./_generated/server";

/**
 * missionWatch.ts — durable watcher for MISSION-01's closing condition.
 *
 * WHY THIS EXISTS AT ALL. MISSION-01 is built on both halves (orphan recovery
 * shipped in astridr 168-06; the duration fix in astridr `e435f71a` gave
 * `emit_subagent_job_terminal` a `submitted_at`) but it is NOT satisfiable by
 * writing more code — the fix works going forward only, and the existing
 * `subagentJobs` rows all have `submittedAt === finishedAt`. It closes when a
 * real background job produces a row with a real duration, which could be
 * tomorrow or next month.
 *
 * Until now the only thing tracking that was a paragraph in a handoff doc, i.e.
 * a human remembering. A rule that depends on remembering has already failed as
 * a rule; the fix is a mechanism. This is the mechanism.
 *
 * WHY A CONVEX CRON rather than a scheduled agent or an OS task: the condition
 * is a Convex query over Convex data, the alerting surface is the Convex
 * `alerts` table that `/alerts` already renders, and a cron in `crons.ts` lives
 * in the repo — it survives this session, a machine rebuild, and anyone's
 * memory. Nothing external has to be installed or remembered.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: tick MISSION-01's checkbox. GSD tooling
 * auto-ticked that requirement twice and it was reverted both times. A watcher
 * that also mutates status is how that happens a third time. This reports that
 * the condition flipped; a human decides what the requirement now says.
 */

/** Rows scanned per run. `subagentJobs` is a low-volume table (7 rows measured
 * 2026-08-27) and this is a bounded `.take()`, never a `.collect()` — the read
 * cannot grow into the SWEEP-01 defect `boundedReads.ratchet.test.ts` guards. */
export const MISSION01_SCAN_CAP = 200;

/** Idempotency key. `alerts` has a `by_source` index (["source","createdAt"]),
 * so the "have I already raised this?" check is itself an indexed point read
 * rather than a table scan. */
export const MISSION01_ALERT_SOURCE = "mission-watch:MISSION-01";

/**
 * A row satisfies MISSION-01 when it carries a REAL elapsed duration.
 *
 * Note this is `>`, deliberately stricter than the handoff's documented probe,
 * which uses `!==`. A row with `finishedAt < submittedAt` is a clock anomaly,
 * not evidence the duration plumbing works, and `!==` would count it as
 * success. Both fields must also be present: `finishedAt == null` is an
 * in-flight or malformed row, not a completed one.
 */
export function hasRealDuration(row: {
  submittedAt?: number | null;
  finishedAt?: number | null;
}): boolean {
  const { submittedAt, finishedAt } = row;
  if (submittedAt == null || finishedAt == null) return false;
  return finishedAt > submittedAt;
}

/**
 * checkMission01 — runs daily. Raises exactly ONE alert, the first time a
 * `subagentJobs` row shows a real duration, then never again.
 *
 * `internalMutation`, not `mutation`: its only caller is the cron, and the same
 * CR-01/INT-03 rule the rest of this repo's writes follow applies — a plain
 * `mutation` would land in the client-callable `api.` namespace, letting anyone
 * with the shipped VITE_CONVEX_URL forge a "MISSION-01 is satisfied" alert.
 *
 * Returns a small verdict object so the behaviour is assertable in tests and
 * legible in the Convex logs. It is NOT evidence on its own — a verb's success
 * payload never is; the tests assert on what was written.
 */
export const checkMission01 = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Already raised? Indexed point read on the idempotency key. This is what
    // stops a daily cron from becoming a daily nag once the condition is met —
    // and it survives restarts, because the state lives in the table rather
    // than in the scheduler.
    const existing = await ctx.db
      .query("alerts")
      .withIndex("by_source", (q) => q.eq("source", MISSION01_ALERT_SOURCE))
      .first();
    if (existing) {
      return { raised: false as const, reason: "already-raised" as const };
    }

    const rows = await ctx.db
      .query("subagentJobs")
      .order("desc")
      .take(MISSION01_SCAN_CAP);

    const satisfying = rows.filter(hasRealDuration);
    if (satisfying.length === 0) {
      return {
        raised: false as const,
        reason: "not-yet" as const,
        scanned: rows.length,
      };
    }

    const sample = satisfying[0];
    await ctx.db.insert("alerts", {
      severity: "info",
      source: MISSION01_ALERT_SOURCE,
      message:
        "MISSION-01 is now verifiable: a subagentJobs row has a real duration " +
        "(finishedAt > submittedAt). The requirement was left PARTIAL pending " +
        "exactly this. Re-read the code and close it by hand — do not let " +
        "tooling tick it.",
      details: {
        scanned: rows.length,
        satisfyingRows: satisfying.length,
        sampleJobId: sample.jobId ?? null,
        sampleDurationSeconds:
          sample.finishedAt != null && sample.submittedAt != null
            ? sample.finishedAt - sample.submittedAt
            : null,
      },
      acknowledged: false,
      status: "active",
      // Seconds, matching `alerts.create` and every other writer of this table.
      createdAt: Date.now() / 1000,
    });

    return {
      raised: true as const,
      reason: "condition-met" as const,
      scanned: rows.length,
      satisfying: satisfying.length,
    };
  },
});
