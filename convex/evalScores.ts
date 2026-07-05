import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Phase 93 (EVAL-01) — evalScores ingest.
 *
 * Ástríðr's `task_quality` scores (emitted by `langfuse_eval.py`) are currently
 * written to Langfuse only and dropped on the floor. This module closes the
 * persistence half: a pure coalescing helper (unit-tested directly, since
 * convex-test is not installed — see convex/runtimeIngest.test.ts:9) plus the
 * idempotent `ingestTaskQuality` mutation fed by the `task_quality` case in
 * convex/runtimeIngest.ts.
 */

export interface ProcessedTaskQualityEvent {
  scoreName: "task_quality";
  profileId: string;
  sessionId: string;
  overall: number;
  idempotencyKey: string | undefined;
  timestamp: number;
}

/**
 * Pure function mirroring the task_quality dispatch case in runtimeIngest.ts.
 * Coalesces snake_case/camelCase fields exactly like the existing llm_call
 * case (d.field ?? d.field_name).
 *
 * Missing optional fields default: absent profileId/sessionId → "unknown".
 * Absent/non-numeric score → `overall` comes back NaN — the caller
 * (ingestTaskQuality) rejects NaN/out-of-range values before persisting
 * (T-93-03); this pure function never persists anything itself.
 */
export function processTaskQualityEvent(
  data: Record<string, any>,
  timestamp: number
): ProcessedTaskQualityEvent {
  const d = data ?? {};
  const rawScore = d.overall ?? d.score;
  const overall = typeof rawScore === "number" ? rawScore : Number(rawScore);
  return {
    scoreName: "task_quality",
    profileId: d.profileId ?? d.profile_id ?? "unknown",
    sessionId: d.sessionId ?? d.session_id ?? "unknown",
    overall,
    idempotencyKey: d.idempotencyKey ?? d.event_id,
    timestamp,
  };
}

export const ingestTaskQuality = mutation({
  args: {
    profileId: v.string(),
    sessionId: v.string(),
    overall: v.float64(),
    idempotencyKey: v.optional(v.string()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    // T-93-03: reject out-of-range or NaN scores — never persist a corrupt row.
    if (
      !Number.isFinite(args.overall) ||
      args.overall < 0 ||
      args.overall > 1
    ) {
      return;
    }

    // T-93-01: idempotent dedup — same-mutation query-then-insert, mirrors
    // convex/events.ts:20-30. Redelivered events (same idempotencyKey) are a
    // no-op.
    if (args.idempotencyKey) {
      const existing = await ctx.db
        .query("evalScores")
        .withIndex("by_idempotencyKey", (q) =>
          q.eq("idempotencyKey", args.idempotencyKey!)
        )
        .first();
      if (existing) return;
    }

    await ctx.db.insert("evalScores", {
      scoreName: "task_quality",
      profileId: args.profileId,
      sessionId: args.sessionId,
      overall: args.overall,
      idempotencyKey: args.idempotencyKey,
      timestamp: args.timestamp,
    });
  },
});
