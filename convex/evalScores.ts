import {
  mutation,
  internalQuery,
} from "./_generated/server";
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
 *
 * Phase 93 (EVAL-02) — nightly LLM-judge machinery (config slot, digest
 * builder, dual-provider caller, sampling action) lives further down this
 * file — see the "EVAL-02" section marker below.
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

// ============================================================
// EVAL-02 — Nightly LLM-judge machinery
// ============================================================
//
// D-07: a dedicated `intelligence.llm_eval` config slot, isolated from
// briefings.ts's `intelligence.llm_primary`/`intelligence.llm_backup` so a
// briefing-model change never silently reweights judge scoring. The judge's
// own dual-provider caller lives in this file (not briefings.ts) for the
// same reason — see Task 2.

export const getEvalLLMConfigInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const config = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", "intelligence.llm_eval"))
      .first();
    if (!config) return null;
    const val = config.value as {
      provider?: string;
      model?: string;
      apiKey?: string;
    };
    return {
      provider: val.provider ?? "anthropic",
      model: val.model ?? "claude-haiku-4-5",
      apiKey: val.apiKey ?? "",
    };
  },
});

export const getJudgeDigestInternal = internalQuery({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .first();
    const events = await ctx.db
      .query("events")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .filter((q) => q.neq(q.field("archived"), true))
      .take(200);
    const llmMetrics = await ctx.db
      .query("llmMetrics")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
    return { session, events, llmMetrics };
  },
});

// ─── Digest builder (pure, unit-testable) ───────────────────────────────────

export interface JudgeDigestSession {
  sessionId?: string;
  status?: string;
  provider?: string;
  model?: string;
}

export interface JudgeDigestEvent {
  eventType?: string;
  toolName?: string;
  payload?: unknown;
}

export interface JudgeDigestLLMMetric {
  cost?: number;
  totalTokens?: number;
}

export interface JudgeDigestInput {
  session: JudgeDigestSession | null | undefined;
  events: JudgeDigestEvent[];
  llmMetrics: JudgeDigestLLMMetric[];
}

// Free-text event fields (payload) are truncated to this many chars before
// inclusion — a single verbose stack trace should not dominate the prompt
// (D-06 Context Window Strategy / AI-SPEC Section 4).
const DIGEST_TRUNCATE_CHARS = 250;
// Cap on how many distinct error/failure snippets are surfaced in the digest —
// keeps the digest bounded even for a session with many failures (E6 still
// only needs the failing tool/operation to survive, not every occurrence).
const DIGEST_MAX_ERROR_SNIPPETS = 5;

/**
 * Builds a compact, evidence-preserving digest string from Convex-resident
 * session/event/llmMetrics data for the judge's user prompt (D-06 — no
 * transcript fetch, no per-event dump). Aggregates events into tool/eventType
 * counts, truncates free-text payload content, and summarizes llmMetrics into
 * cost/token totals. For an error-heavy session, the failing tool/operation
 * name is preserved verbatim (untruncated) even though the free-text payload
 * snippet around it is capped (E6 digest-fidelity requirement).
 */
export function buildJudgeDigest(input: JudgeDigestInput): string {
  const { session, events, llmMetrics } = input;

  const counts: Record<string, number> = {};
  const errorSnippets: string[] = [];

  for (const e of events) {
    const key = e.toolName || e.eventType || "unknown";
    counts[key] = (counts[key] ?? 0) + 1;

    const typeLower = (e.eventType ?? "").toLowerCase();
    const isError = typeLower.includes("error") || typeLower.includes("failure");
    if (isError) {
      const raw =
        typeof e.payload === "string"
          ? e.payload
          : JSON.stringify(e.payload ?? {});
      const truncated =
        raw.length > DIGEST_TRUNCATE_CHARS
          ? `${raw.slice(0, DIGEST_TRUNCATE_CHARS)}…`
          : raw;
      // The failing tool/operation name is kept verbatim outside the
      // truncation window so it always survives (E6).
      errorSnippets.push(`[${key}] ${truncated}`);
    }
  }

  const activitySummary = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([tool, count]) => `${tool}: ${count}`)
    .join(", ");

  const totalCost = llmMetrics.reduce((sum, m) => sum + (m.cost ?? 0), 0);
  const totalTokens = llmMetrics.reduce(
    (sum, m) => sum + (m.totalTokens ?? 0),
    0
  );
  const callCount = llmMetrics.length;

  const lines = [
    `Session: ${session?.sessionId ?? "unknown"} | status: ${session?.status ?? "unknown"} | provider: ${session?.provider ?? "unknown"} | model: ${session?.model ?? "unknown"}`,
    `Event count: ${events.length}`,
    `Tool/event activity: ${activitySummary || "none"}`,
    `Cost: $${totalCost.toFixed(4)} | LLM calls: ${callCount} | total tokens: ${totalTokens}`,
  ];

  if (errorSnippets.length > 0) {
    lines.push(
      `Errors (${errorSnippets.length}): ${errorSnippets.slice(0, DIGEST_MAX_ERROR_SNIPPETS).join(" | ")}`
    );
  }

  return lines.join("\n");
}
