import {
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import { z } from "zod";
import { internal } from "./_generated/api";

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

// ─── Judge tool schema (shared Anthropic tools[] / OpenAI response_format) ──

export const JUDGE_TOOL_NAME = "score_session";

// Rubric-shape source of truth (AI-SPEC Section 3) — reused verbatim for the
// Anthropic branch's `tools[0].input_schema` and (as-is, since every field is
// required — no nullable-union translation needed, Pitfall 3) the OpenAI
// branch's `response_format.json_schema.schema`.
export const JUDGE_TOOL = {
  name: JUDGE_TOOL_NAME,
  description:
    "Records rubric scores (0-1) for one Astridr agent session based on " +
    "observable behavior: task completion, error handling, tool-use " +
    "efficiency, and cost discipline. Each dimension score is a float in " +
    "[0,1]. Include a one-sentence rationale per dimension.",
  input_schema: {
    type: "object",
    properties: {
      task_completion: { type: "number", minimum: 0, maximum: 1 },
      task_completion_rationale: { type: "string" },
      error_handling: { type: "number", minimum: 0, maximum: 1 },
      error_handling_rationale: { type: "string" },
      tool_efficiency: { type: "number", minimum: 0, maximum: 1 },
      tool_efficiency_rationale: { type: "string" },
      cost_discipline: { type: "number", minimum: 0, maximum: 1 },
      cost_discipline_rationale: { type: "string" },
      overall: { type: "number", minimum: 0, maximum: 1 },
    },
    required: [
      "task_completion",
      "task_completion_rationale",
      "error_handling",
      "error_handling_rationale",
      "tool_efficiency",
      "tool_efficiency_rationale",
      "cost_discipline",
      "cost_discipline_rationale",
      "overall",
    ],
  },
} as const;

// E5 trend-attributability: bump this whenever the rubric wording/dimension
// set changes, so a KPI trend query can tell "quality changed" apart from
// "the ruler changed" (a version bump is a code change, reviewed by commit).
export const RUBRIC_VERSION = "v1";

// D-09/4b.3: rubric definition + 1-2 inline good/bad anchor examples so the
// judge has a concrete calibration point, not just a label to guess at.
const JUDGE_SYSTEM_PROMPT = `You are an LLM judge scoring one Astridr agent session on 4 dimensions, each 0-1, plus an overall score. Judge only observable behavior from the digest below (event/tool counts, errors, cost) — you have no access to the conversation transcript.

Dimensions:
- task_completion: Did the session's tool activity indicate the task was likely completed without abandonment? 1.0 = clean completion, no errors. 0.0 = session errored out or was abandoned.
- error_handling: Did the agent recover gracefully from errors/retries, or did errors compound? 1.0 = no errors, or errors were retried and resolved. 0.0 = repeated unrecovered failures.
- tool_efficiency: Was tool usage proportionate to the task, or was there thrashing/redundant calls? 1.0 = lean, purposeful tool use. 0.0 = excessive repeated/redundant tool calls.
- cost_discipline: Was token/cost usage reasonable for the apparent task size? 1.0 = cost proportionate to activity. 0.0 = costly session with little to show for it.

Examples:
- GOOD session digest: "Event count: 12. Tool activity: Read: 5, Edit: 4, Bash: 3. Cost: $0.02. Errors: none." -> scores near 1.0 on all dimensions (clean, proportionate, no errors).
- BAD session digest: "Event count: 40. Tool activity: Bash: 22, Read: 10. Cost: $0.35. Errors (6): [Bash] npm install failed: ENOTFOUND registry.npmjs.org (repeated)." -> task_completion low (repeated failure, likely abandoned), error_handling low (6 unrecovered retries of the same failure), tool_efficiency low (22 Bash calls for what looks like one blocked install), cost_discipline low (high cost, low apparent output).

Score strictly from the digest evidence. Always call the score_session tool with your scores and a one-sentence rationale per dimension citing the specific evidence (tool name, error, or count) that drove the score.`;

// ─── Structured-output validation (zod — TS equivalent of Pydantic, 4b.1) ───

export const JudgeOutputSchema = z.object({
  task_completion: z.number().min(0).max(1),
  task_completion_rationale: z.string().min(1).max(500),
  error_handling: z.number().min(0).max(1),
  error_handling_rationale: z.string().min(1).max(500),
  tool_efficiency: z.number().min(0).max(1),
  tool_efficiency_rationale: z.string().min(1).max(500),
  cost_discipline: z.number().min(0).max(1),
  cost_discipline_rationale: z.string().min(1).max(500),
  overall: z.number().min(0).max(1),
});
export type JudgeOutput = z.infer<typeof JudgeOutputSchema>;

// ─── Dual-provider judge callers (mirrors briefings.ts's provider branch) ───

export async function callAnthropicJudge(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<Record<string, unknown>> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      // No thinking/budget_tokens config here — forced tool_choice is
      // incompatible with extended thinking on the Messages API (Pitfall 4),
      // and Opus 4.8+/Claude 5 SDKs reject budget_tokens outright.
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      temperature: 0, // deterministic judging, not creative generation
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      tools: [JUDGE_TOOL],
      tool_choice: { type: "tool", name: JUDGE_TOOL_NAME },
    }),
  });
  if (!resp.ok) {
    throw new Error(
      `Anthropic judge error ${resp.status}: ${await resp.text()}`
    );
  }
  const json = await resp.json();
  const toolUse = json.content?.find((b: any) => b.type === "tool_use");
  if (!toolUse) throw new Error("Judge response contained no tool_use block");
  return toolUse.input;
}

export async function callOpenAIJudge(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<Record<string, unknown>> {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: JUDGE_TOOL_NAME,
          strict: true,
          schema: JUDGE_TOOL.input_schema,
        },
      },
    }),
  });
  if (!resp.ok) {
    throw new Error(`OpenAI judge error ${resp.status}: ${await resp.text()}`);
  }
  const json = await resp.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("Judge response contained no content");
  return JSON.parse(content);
}

const JUDGE_MAX_ATTEMPTS = 3; // 1 initial + 2 repairs (4b.1)

/**
 * Calls the configured judge LLM with a bounded retry loop:
 * - zod validation failure (well-formed JSON, wrong values) -> repair prompt
 *   appended for the next attempt.
 * - transport/HTTP failure -> retried without a repair message (the prompt
 *   was fine, the call itself failed).
 * - exhausts JUDGE_MAX_ATTEMPTS -> throws; caller writes NO row (Pitfall 6 —
 *   the session stays legitimately re-sampleable, no poisoned idempotency key).
 *
 * Never logs the apiKey (T-07-05).
 */
export async function callJudgeLLM(
  runQuery: (fn: any, args: any) => Promise<any>,
  systemPrompt: string,
  userPrompt: string
): Promise<{ output: JudgeOutput; model: string }> {
  const config = await runQuery(
    internal.evalScores.getEvalLLMConfigInternal,
    {}
  );
  if (!config?.apiKey) {
    throw new Error("Eval LLM not configured (intelligence.llm_eval)");
  }

  let prompt = userPrompt;
  let lastError: unknown;

  for (let attempt = 1; attempt <= JUDGE_MAX_ATTEMPTS; attempt++) {
    try {
      const raw =
        config.provider === "anthropic"
          ? await callAnthropicJudge(config.apiKey, config.model, systemPrompt, prompt)
          : await callOpenAIJudge(config.apiKey, config.model, systemPrompt, prompt);

      const parsed = JudgeOutputSchema.safeParse(raw);
      if (parsed.success) {
        return { output: parsed.data, model: config.model };
      }

      console.error(
        `[eval-judge] schema validation failed, attempt ${attempt}: ${parsed.error.message}`
      );
      lastError = parsed.error;
      prompt = `${userPrompt}\n\nYour previous response failed validation: ${parsed.error.message}. Return corrected values.`;
    } catch (err) {
      console.error(`[eval-judge] call failed, attempt ${attempt}: ${String(err)}`);
      lastError = err;
    }
  }

  throw new Error(
    `Judge failed after ${JUDGE_MAX_ATTEMPTS} attempts: ${String(lastError)}`
  );
}

// ─── Idempotent judge score store ───────────────────────────────────────────

export interface StoreEvalScoreArgs {
  sessionId: string;
  profileId: string;
  judgeModel: string;
  timestamp: number;
  task_completion: number;
  task_completion_rationale: string;
  error_handling: number;
  error_handling_rationale: string;
  tool_efficiency: number;
  tool_efficiency_rationale: string;
  cost_discipline: number;
  cost_discipline_rationale: string;
  overall: number;
}

interface EvalScoreDb {
  query: (table: string) => {
    withIndex: (
      indexName: string,
      cb: (q: { eq: (field: string, value: any) => any }) => any
    ) => { first: () => Promise<any> };
  };
  insert: (table: string, doc: any) => Promise<any>;
}

/**
 * Core insert logic, extracted so it can be unit-tested against a minimal
 * fake `ctx.db` without convex-test (which is not installed in this repo —
 * see convex/runtimeIngest.test.ts:9). Idempotent on `judge:${sessionId}` —
 * a redelivered/re-run judge score for the same session is a no-op, never a
 * second row (T-93-07 / Pitfall 6: a judge failure must leave zero rows, not
 * a partial/zeroed one, so the session stays re-sampleable).
 */
export async function storeEvalScoreHandler(
  ctx: { db: EvalScoreDb } | any,
  args: StoreEvalScoreArgs
): Promise<void> {
  const idempotencyKey = `judge:${args.sessionId}`;
  const existing = await ctx.db
    .query("evalScores")
    .withIndex("by_idempotencyKey", (q: { eq: (field: string, value: any) => any }) =>
      q.eq("idempotencyKey", idempotencyKey)
    )
    .first();
  if (existing) return;

  await ctx.db.insert("evalScores", {
    scoreName: "llm_judge",
    profileId: args.profileId,
    sessionId: args.sessionId,
    overall: args.overall,
    dimensions: {
      task_completion: {
        score: args.task_completion,
        rationale: args.task_completion_rationale,
      },
      error_handling: {
        score: args.error_handling,
        rationale: args.error_handling_rationale,
      },
      tool_efficiency: {
        score: args.tool_efficiency,
        rationale: args.tool_efficiency_rationale,
      },
      cost_discipline: {
        score: args.cost_discipline,
        rationale: args.cost_discipline_rationale,
      },
    },
    rubricVersion: RUBRIC_VERSION,
    judgeModel: args.judgeModel,
    idempotencyKey,
    timestamp: args.timestamp,
  });
}

export const storeEvalScore = internalMutation({
  args: {
    sessionId: v.string(),
    profileId: v.string(),
    judgeModel: v.string(),
    timestamp: v.float64(),
    task_completion: v.float64(),
    task_completion_rationale: v.string(),
    error_handling: v.float64(),
    error_handling_rationale: v.string(),
    tool_efficiency: v.float64(),
    tool_efficiency_rationale: v.string(),
    cost_discipline: v.float64(),
    cost_discipline_rationale: v.string(),
    overall: v.float64(),
  },
  handler: storeEvalScoreHandler,
});
