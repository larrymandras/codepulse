import {
  mutation,
  query,
  internalQuery,
  internalMutation,
  internalAction,
} from "./_generated/server";
import { v } from "convex/values";
import { z } from "zod";
import { internal, api } from "./_generated/api";
import { personaConfigChangeKey } from "./profiles";

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

// Rubric-shape source of truth (AI-SPEC Section 3) — used verbatim for the
// Anthropic branch's `tools[0].input_schema`. The OpenAI branch derives a
// strict-compatible variant from it (OPENAI_JUDGE_SCHEMA below) — the raw
// schema is NOT strict-valid as-is (CR-03).
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

/**
 * CR-03 (93-REVIEW): OpenAI strict structured outputs REQUIRE
 * `additionalProperties: false` on every object schema — sending
 * JUDGE_TOOL.input_schema verbatim produced a deterministic 400 on every
 * call (all 3 retry attempts) whenever provider=openai. This variant:
 * - adds the mandatory `additionalProperties: false`;
 * - strips the `minimum`/`maximum` range keywords, whose strict-mode support
 *   has been inconsistent across OpenAI API versions — range enforcement
 *   already lives in JudgeOutputSchema (zod) + the repair loop, so dropping
 *   them here loses nothing and removes the 400 risk entirely.
 */
export const OPENAI_JUDGE_SCHEMA = {
  type: "object",
  properties: Object.fromEntries(
    Object.entries(JUDGE_TOOL.input_schema.properties).map(([key, prop]) => [
      key,
      { type: (prop as { type: string }).type },
    ])
  ),
  required: [...JUDGE_TOOL.input_schema.required],
  additionalProperties: false,
};

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
          // CR-03: strict-compatible variant — NOT the raw tool schema.
          schema: OPENAI_JUDGE_SCHEMA,
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

// ============================================================
// EVAL-02 — Nightly sampling internalAction + cron (Task 3)
// ============================================================
//
// PERSONA DECISION (resolves RESEARCH Pitfall 1 / Open Question 1 — do not
// bake an unstated assumption into a query):
//
// "Active persona" = rows from `profiles.listConfigs` (profileConfigs:
// personal/business/consulting), consistent with UI-SPEC Assumption #6.
// `sessions`/`events` carry NO `profileId` field, so a candidate session is
// attributed to a persona via its `llmMetrics.agentId` where resolvable.
//
// Evidence for the `llmMetrics.agentId` -> persona join (verified in
// astridr-repo): `astridr/agent/loop.py` and `astridr/agent/insight_extractor.py`
// set `agent_id=self._active_profile` / `agent_id=profile_id` at most call
// sites, so `llmMetrics.agentId` carries the active operational profileId for
// those sessions -- BUT `astridr/agent/loop.py:1537` has one path
// (`self_improvement.py`) where `agent_id` falls back to `_agent_type`
// instead of the profile, so attribution is not total.
//
// When a session has no resolvable persona attribution, it is judged under
// an explicit `"unknown"` persona bucket rather than being dropped, and that
// bucket's volume is emitted as an `N unknown-persona` count in the action's
// liveness summary (console.error + return value) so attribution drift is
// visible in prod rather than silently absorbed. This is a first-class,
// documented decision -- not a silent join.

export interface SampleCandidate {
  sessionId: string;
  // Resolved via llmMetrics.agentId (may be unresolved -> undefined, see the
  // PERSONA DECISION comment above).
  profileId?: string;
}

export interface SamplingResult {
  sampled: Array<{ profileId: string; sessionId: string }>;
  unknownCount: number;
}

const MAX_SESSIONS_PER_PERSONA = 3; // D-08

/**
 * Pure, testable sampling function: given the set of active persona ids and a
 * candidate session pool (each pre-attributed to a persona id where
 * resolvable), returns at most `maxPerPersona` sessions per persona. Sessions
 * that don't attribute to a currently-active persona are bucketed under the
 * explicit `"unknown"` persona rather than dropped (see PERSONA DECISION
 * above) -- `unknownCount` reports how many candidates landed there so
 * attribution drift is observable.
 */
export function sampleSessionsForPersonas(
  activePersonaIds: string[],
  candidates: SampleCandidate[],
  maxPerPersona: number = MAX_SESSIONS_PER_PERSONA
): SamplingResult {
  const activeSet = new Set(activePersonaIds);
  const byPersona = new Map<string, string[]>();
  let unknownCount = 0;

  for (const c of candidates) {
    const pid = c.profileId && activeSet.has(c.profileId) ? c.profileId : "unknown";
    if (pid === "unknown") unknownCount++;
    const bucket = byPersona.get(pid) ?? [];
    bucket.push(c.sessionId);
    byPersona.set(pid, bucket);
  }

  const sampled: Array<{ profileId: string; sessionId: string }> = [];
  for (const [profileId, sessionIds] of byPersona.entries()) {
    // Random sample within the day (D-08), not always the first N.
    const shuffled = [...sessionIds].sort(() => Math.random() - 0.5);
    for (const sessionId of shuffled.slice(0, maxPerPersona)) {
      sampled.push({ profileId, sessionId });
    }
  }

  return { sampled, unknownCount };
}

/**
 * Runs the per-session judge calls with Promise.allSettled (NOT Promise.all
 * -- Pitfall 5/E2/4b.2): one session throwing must never drop the others in
 * the same batch. Returns settled/rejected counts for the liveness summary
 * (E7). Extracted as its own function so the allSettled-isolation behavior
 * is directly unit-testable without a Convex ctx.
 */
export async function runJudgeBatch(
  sampled: Array<{ profileId: string; sessionId: string }>,
  judgeOne: (s: { profileId: string; sessionId: string }) => Promise<void>
): Promise<{ scored: number; failed: number }> {
  const results = await Promise.allSettled(sampled.map((s) => judgeOne(s)));
  const scored = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    console.error(
      `[eval-judge] ${failed}/${results.length} sessions failed judging tonight`
    );
  }
  return { scored, failed };
}

/**
 * CR-01 (93-REVIEW): the nightly cron fires at 05:00 UTC (crons.ts). Judging
 * the CURRENT UTC day at that moment would only ever see sessions completed
 * between 00:00 and 05:00 UTC — everything completing later the same day
 * would fall in a window whose run has already happened, and would never be
 * sampled. The run therefore judges the PREVIOUS complete UTC day: it rides
 * right after that day closes. (The `judge:${sessionId}` idempotency key
 * already protects against any overlap double-judging.)
 */
export function judgeWindowDayStart(nowMs: number): number {
  return Math.floor(nowMs / 1000 / 86400) * 86400 - 86400;
}

export const getCandidateSessionsInternal = internalQuery({
  args: { dayStart: v.float64() },
  handler: async (ctx, { dayStart }) => {
    const dayEnd = dayStart + 86400;
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .filter((q) =>
        q.and(
          q.gte(q.field("lastEventAt"), dayStart),
          q.lt(q.field("lastEventAt"), dayEnd)
        )
      )
      .collect();

    const candidates: SampleCandidate[] = [];
    for (const s of sessions) {
      // See PERSONA DECISION above: best-effort attribution via
      // llmMetrics.agentId; unresolved -> undefined -> "unknown" bucket.
      const metric = await ctx.db
        .query("llmMetrics")
        .withIndex("by_session", (q) => q.eq("sessionId", s.sessionId))
        .first();
      candidates.push({ sessionId: s.sessionId, profileId: metric?.agentId });
    }
    return candidates;
  },
});

async function judgeOneSession(
  ctx: any,
  sessionId: string,
  profileId: string
): Promise<void> {
  const digestData = await ctx.runQuery(
    internal.evalScores.getJudgeDigestInternal,
    { sessionId }
  );
  const digest = buildJudgeDigest(digestData);
  const userPrompt = `Session digest:\n${digest}`;
  const { output, model } = await callJudgeLLM(
    ctx.runQuery.bind(ctx),
    JUDGE_SYSTEM_PROMPT,
    userPrompt
  );
  await ctx.runMutation(internal.evalScores.storeEvalScore, {
    sessionId,
    profileId,
    judgeModel: model,
    timestamp: Date.now() / 1000,
    ...output,
  });
}

export const judgeSessionsAction = internalAction({
  args: {},
  handler: async (ctx) => {
    // listConfigs is a public query (convex/profiles.ts) — internalActions can
    // call public queries via ctx.runQuery just as freely as internal ones.
    const personas = await ctx.runQuery(api.profiles.listConfigs, {});
    const activePersonaIds = (personas as Array<{ profileId: string }>).map(
      (p) => p.profileId
    );

    // Previous complete UTC day — see judgeWindowDayStart (CR-01).
    const dayStart = judgeWindowDayStart(Date.now());
    const candidates = await ctx.runQuery(
      internal.evalScores.getCandidateSessionsInternal,
      { dayStart }
    );

    const { sampled, unknownCount } = sampleSessionsForPersonas(
      activePersonaIds,
      candidates as SampleCandidate[]
    );

    const { scored, failed } = await runJudgeBatch(sampled, (s) =>
      judgeOneSession(ctx, s.sessionId, s.profileId)
    );

    // Plan 04 (EVAL-03): the night's own judge scores must be counted before
    // the before/after regression comparison runs (RESEARCH Open Question 3
    // — detectRegressions rides the tail of this action, no extra cron slot).
    await ctx.runAction(internal.evalScores.detectRegressions, {});

    // E7: liveness summary -- "no data" (zero scores) must be distinguishable
    // from "nothing happened" from this line alone.
    console.error(
      `[eval-judge] ${sampled.length} sampled / ${scored} scored / ${failed} failed / ${unknownCount} unknown-persona`
    );

    return {
      sampled: sampled.length,
      scored,
      failed,
      unknownPersonaCount: unknownCount,
    };
  },
});

// ============================================================
// EVAL-03 — KPI read queries + regression detector (Plan 04)
// ============================================================
//
// D-17: 30-day default history window; evalScores volume is tiny so a
// range-bound index read is fine (no archival sweep needed).
const DEFAULT_KPI_RANGE_DAYS = 30;
const LISTED_SESSIONS_LIMIT = 50;

// D-12: a ~7-day before/after window each side of a change event, plus a
// bounded lookback on change-event candidates so the profileSwitches/
// configChanges reads stay index-range-bound rather than an unbounded scan
// (the same "never .collect() unbounded" discipline the plan calls out for
// evalScores extends to these reads too).
const REGRESSION_WINDOW_SECONDS = 7 * 86400;
const CHANGE_EVENT_LOOKBACK_SECONDS = 30 * 86400;

// D-14: conservative, code-defined, zero-false-positive-biased constants —
// tuned by commit, no settings UI this phase.
export const MIN_SESSIONS_PER_SIDE = 5;
export const REGRESSION_DROP_THRESHOLD = 0.15; // 15 pts on the 0-100 display scale

// ─── Pure helpers (meanOverall / periodDelta) ───────────────────────────────

/** Arithmetic mean of `.overall` across rows; 0 for an empty set (never NaN). */
export function meanOverall(rows: Array<{ overall: number }>): number {
  if (rows.length === 0) return 0;
  return rows.reduce((sum, r) => sum + r.overall, 0) / rows.length;
}

/** Simple current-minus-previous delta — positive = improved, negative = dropped. */
export function periodDelta(current: number, previous: number): number {
  return current - previous;
}

// ─── Change-event markers (profileSwitches + persona-scoped configChanges) ─

export type ChangeEventType = "model" | "switch";

export interface ChangeEventMarker {
  timestamp: number;
  changeType: ChangeEventType;
}

interface ProfileSwitchRow {
  fromProfile: string;
  toProfile: string;
  timestamp: number;
}

interface ConfigChangeRow {
  configKey: string;
  changedAt: number;
}

/**
 * Merges profileSwitches (fromProfile/toProfile touching this persona) and
 * persona-scoped configChanges (D-11) into one sorted change-event list.
 * `changeType` distinguishes the two sources for both the KPI detail-page
 * markers and the regression-message copy ("a model change" vs "an
 * instruction change" — UI-SPEC L102 copy contract): a persona-scoped
 * configChanges row (`profile.<id>.modelPreferences`, written by
 * profiles.upsertConfig) is "model"; a profileSwitches row touching this
 * persona is "switch", rendered as "an instruction change" — D-11 defines
 * only these two change-source categories, so the mapping is exhaustive.
 */
export function buildChangeMarkers(
  profileId: string,
  switches: ProfileSwitchRow[],
  configChanges: ConfigChangeRow[]
): ChangeEventMarker[] {
  const markers: ChangeEventMarker[] = [];

  for (const s of switches) {
    if (s.fromProfile === profileId || s.toProfile === profileId) {
      markers.push({ timestamp: s.timestamp, changeType: "switch" });
    }
  }

  const configKey = personaConfigChangeKey(profileId);
  for (const c of configChanges) {
    if (c.configKey === configKey) {
      markers.push({ timestamp: c.changedAt, changeType: "model" });
    }
  }

  return markers.sort((a, b) => a.timestamp - b.timestamp);
}

// ─── KPI read queries ────────────────────────────────────────────────────────

export interface PersonaKpi {
  profileId: string;
  currentMean: number;
  sparkline: Array<{ timestamp: number; overall: number }>;
  delta: number;
  activeRegression: boolean;
}

/**
 * Pure combination of current/previous-period evalScores rows into the KPI
 * shape `listPersonaKpis` returns per persona — extracted so the mean/delta/
 * sparkline math is directly unit-testable without a Convex ctx.
 */
export function buildPersonaKpi(
  currentScores: Array<{ overall: number; timestamp: number }>,
  previousScores: Array<{ overall: number; timestamp: number }>,
  activeRegression: boolean
): Omit<PersonaKpi, "profileId"> {
  const currentMean = meanOverall(currentScores);
  const previousMean = meanOverall(previousScores);
  const sparkline = [...currentScores]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((s) => ({ timestamp: s.timestamp, overall: s.overall }));
  return {
    currentMean,
    sparkline,
    delta: periodDelta(currentMean, previousMean),
    activeRegression,
  };
}

export const listPersonaKpis = query({
  args: {},
  handler: async (ctx): Promise<PersonaKpi[]> => {
    // Mirrors profiles.listConfigs's body directly — a query cannot call
    // another query function, so the two-line read is duplicated here rather
    // than routed through ctx.runQuery (actions/mutations only).
    const personas = await ctx.db
      .query("profileConfigs")
      .withIndex("by_updatedAt")
      .order("desc")
      .collect();

    const now = Date.now() / 1000;
    const currentStart = now - DEFAULT_KPI_RANGE_DAYS * 86400;
    const previousStart = currentStart - DEFAULT_KPI_RANGE_DAYS * 86400;

    const results: PersonaKpi[] = [];
    for (const p of personas) {
      const profileId = p.profileId as string;

      // WR-03 (93-REVIEW): KPI means read ONLY judge rubric scores — blending
      // Ástríðr's binary 0/1 task_quality rows (per-turn success bit) into the
      // same mean corrupts the "judged nightly" metric the page advertises.
      // task_quality rows stay persisted (EVAL-01) but are excluded here,
      // matching listJudgedSessions' existing scoreName filter.
      const currentScores = await ctx.db
        .query("evalScores")
        .withIndex("by_profileId", (q) =>
          q.eq("profileId", profileId).gte("timestamp", currentStart)
        )
        .filter((q) => q.eq(q.field("scoreName"), "llm_judge"))
        .collect();

      const previousScores = await ctx.db
        .query("evalScores")
        .withIndex("by_profileId", (q) =>
          q
            .eq("profileId", profileId)
            .gte("timestamp", previousStart)
            .lt("timestamp", currentStart)
        )
        .filter((q) => q.eq(q.field("scoreName"), "llm_judge"))
        .collect();

      // T-93-12: never read/return apiKey — this query touches only
      // evalScores/profileConfigs/alerts, never agentConfigs.
      const activeAlert = await ctx.db
        .query("alerts")
        .withIndex("by_source", (q) =>
          q.eq("source", `eval-regression:${profileId}`)
        )
        .filter((q) => q.eq(q.field("status"), "active"))
        .first();

      const kpi = buildPersonaKpi(currentScores, previousScores, !!activeAlert);
      results.push({ profileId, ...kpi });
    }

    return results;
  },
});

export interface PersonaDetailSeriesPoint {
  timestamp: number;
  sessionId: string;
  overall: number;
  dimensions?: Record<string, { score: number; rationale: string }>;
}

/** Sorts evalScores rows into a chronological per-session series. */
export function buildPersonaDetailSeries(
  scores: Array<{
    timestamp: number;
    sessionId: string;
    overall: number;
    dimensions?: Record<string, { score: number; rationale: string }>;
  }>
): PersonaDetailSeriesPoint[] {
  return [...scores]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((s) => ({
      timestamp: s.timestamp,
      sessionId: s.sessionId,
      overall: s.overall,
      dimensions: s.dimensions,
    }));
}

export const getPersonaDetail = query({
  args: { profileId: v.string(), rangeDays: v.optional(v.float64()) },
  handler: async (ctx, { profileId, rangeDays }) => {
    const days = rangeDays ?? DEFAULT_KPI_RANGE_DAYS;
    const rangeStart = Date.now() / 1000 - days * 86400;

    // WR-03: detail series shows judge rubric scores only (see listPersonaKpis).
    const scores = await ctx.db
      .query("evalScores")
      .withIndex("by_profileId", (q) =>
        q.eq("profileId", profileId).gte("timestamp", rangeStart)
      )
      .filter((q) => q.eq(q.field("scoreName"), "llm_judge"))
      .collect();

    const switchRows = await ctx.db
      .query("profileSwitches")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", rangeStart))
      .collect();

    const configKey = personaConfigChangeKey(profileId);
    const configChangeRows = await ctx.db
      .query("configChanges")
      .withIndex("by_key", (q) =>
        q.eq("configKey", configKey).gte("changedAt", rangeStart)
      )
      .collect();

    return {
      series: buildPersonaDetailSeries(scores),
      markers: buildChangeMarkers(profileId, switchRows, configChangeRows),
    };
  },
});

export const listJudgedSessions = query({
  args: { profileId: v.string(), rangeDays: v.optional(v.float64()) },
  handler: async (ctx, { profileId, rangeDays }) => {
    const days = rangeDays ?? DEFAULT_KPI_RANGE_DAYS;
    const rangeStart = Date.now() / 1000 - days * 86400;

    const rows = await ctx.db
      .query("evalScores")
      .withIndex("by_profileId", (q) =>
        q.eq("profileId", profileId).gte("timestamp", rangeStart)
      )
      .filter((q) => q.eq(q.field("scoreName"), "llm_judge"))
      .order("desc")
      .take(LISTED_SESSIONS_LIMIT);

    return rows.map((r) => ({
      sessionId: r.sessionId,
      overall: r.overall,
      dimensions: r.dimensions,
      timestamp: r.timestamp,
    }));
  },
});

// ─── Regression detector ─────────────────────────────────────────────────────

export interface RegressionEvaluation {
  fire: boolean;
  meanBefore: number;
  meanAfter: number;
  drop: number;
}

/**
 * Pure D-12/D-14 gate: fires ONLY when both sides clear `minPerSide` judged
 * sessions AND the before-mean-minus-after-mean drop clears `dropThreshold`.
 * A 2-vs-2, 4-vs-6, sub-threshold-drop, or single-outlier-that-doesn't-move-
 * the-mean comparison all resolve to `fire: false` — the zero-false-positive
 * bar (T-93-10 / Larry's standing precision bar) lives entirely in this gate.
 */
export function evaluateRegression(
  beforeScores: Array<{ overall: number }>,
  afterScores: Array<{ overall: number }>,
  options: { minPerSide?: number; dropThreshold?: number } = {}
): RegressionEvaluation {
  const minPerSide = options.minPerSide ?? MIN_SESSIONS_PER_SIDE;
  const dropThreshold = options.dropThreshold ?? REGRESSION_DROP_THRESHOLD;

  const meanBefore = meanOverall(beforeScores);
  const meanAfter = meanOverall(afterScores);
  const drop = meanBefore - meanAfter;

  if (beforeScores.length < minPerSide || afterScores.length < minPerSide) {
    return { fire: false, meanBefore, meanAfter, drop };
  }

  return { fire: drop >= dropThreshold, meanBefore, meanAfter, drop };
}

/** Formats a unix-seconds timestamp as the UI-SPEC copy's "{date}" token, e.g. "Jul 3". */
function formatChangeDate(timestampSeconds: number): string {
  return new Date(timestampSeconds * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Builds the exact UI-SPEC copy (L102): "{persona} quality dropped {N} pts
 * after {change type} on {date} ({before} → {after})" — e.g. "business
 * quality dropped 18 pts after a model change on Jul 3 (82 → 64)." Scores
 * are stored 0-1 and rendered here on the 0-100 display scale ("pts").
 */
export function buildRegressionMessage(
  profileId: string,
  evaluation: RegressionEvaluation,
  changeTimestamp: number,
  changeType: ChangeEventType
): string {
  const changeTypeLabel =
    changeType === "model" ? "a model change" : "an instruction change";
  const beforePts = Math.round(evaluation.meanBefore * 100);
  const afterPts = Math.round(evaluation.meanAfter * 100);
  const dropPts = beforePts - afterPts;
  const dateLabel = formatChangeDate(changeTimestamp);
  return `${profileId} quality dropped ${dropPts} pts after ${changeTypeLabel} on ${dateLabel} (${beforePts} → ${afterPts})`;
}

/**
 * CR-02 (93-REVIEW): returns ALL prior regression alerts for this persona,
 * regardless of lifecycle status. Dedup must key on the immutable change
 * event (details.changeDate), NOT on `status === "active"` — the regression
 * inputs are immutable history, so a status-keyed dedup deterministically
 * re-fired the identical alert every night after the operator acknowledged
 * or resolved it, and (inversely) a stale active alert blocked detection of
 * any NEW regression for the persona indefinitely.
 */
export const getRegressionAlertsInternal = internalQuery({
  args: { profileId: v.string() },
  handler: async (ctx, { profileId }) => {
    return await ctx.db
      .query("alerts")
      .withIndex("by_source", (q) =>
        q.eq("source", `eval-regression:${profileId}`)
      )
      .collect();
  },
});

export const getPersonaChangeEventsInternal = internalQuery({
  args: { profileId: v.string() },
  handler: async (ctx, { profileId }) => {
    const lookbackStart = Date.now() / 1000 - CHANGE_EVENT_LOOKBACK_SECONDS;

    const switches = await ctx.db
      .query("profileSwitches")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", lookbackStart))
      .collect();

    const configKey = personaConfigChangeKey(profileId);
    const configChanges = await ctx.db
      .query("configChanges")
      .withIndex("by_key", (q) =>
        q.eq("configKey", configKey).gte("changedAt", lookbackStart)
      )
      .collect();

    return { switches, configChanges };
  },
});

export const getEvalScoresWindowInternal = internalQuery({
  args: {
    profileId: v.string(),
    start: v.float64(),
    end: v.float64(),
  },
  handler: async (ctx, { profileId, start, end }) => {
    // WR-03: regression windows compare judge rubric scores only — a burst of
    // binary 0/1 task_quality rows must never fire (or mask) a regression
    // (D-14 zero-false-positive bar).
    return await ctx.db
      .query("evalScores")
      .withIndex("by_profileId", (q) =>
        q.eq("profileId", profileId).gte("timestamp", start).lt("timestamp", end)
      )
      .filter((q) => q.eq(q.field("scoreName"), "llm_judge"))
      .collect();
  },
});

interface AlertInsertDb {
  insert: (table: string, doc: any) => Promise<any>;
}

/**
 * Extracted insert logic (mirrors storeEvalScoreHandler's pattern) so the
 * exact field set — especially `webhookStatus: "pending"` and the
 * `eval-regression:${profileId}` source — is directly unit-testable against
 * a fake `ctx.db`, without convex-test. Replicates alerts.ts's createIfNew
 * shape (L716-736) plus a `details` field, since createIfNew itself doesn't
 * accept one (T-93-11 / RESEARCH L340) — this insert call does not use the
 * shared createIfNew helper, and never calls the public alerts.create.
 */
export async function insertRegressionAlertHandler(
  ctx: { db: AlertInsertDb } | any,
  args: { profileId: string; message: string; details: unknown }
): Promise<any> {
  return await ctx.db.insert("alerts", {
    severity: "warning",
    source: `eval-regression:${args.profileId}`,
    message: args.message,
    acknowledged: false,
    status: "active",
    createdAt: Date.now() / 1000,
    webhookStatus: "pending",
    details: args.details,
  });
}

export const insertRegressionAlert = internalMutation({
  args: {
    profileId: v.string(),
    message: v.string(),
    details: v.any(),
  },
  handler: insertRegressionAlertHandler,
});

export interface DetectRegressionsCtx {
  runQuery: (fn: any, args: any) => Promise<any>;
  runMutation: (fn: any, args: any) => Promise<any>;
  scheduler: { runAfter: (delay: number, fn: any, args: any) => Promise<any> };
}

/**
 * Runs the D-12 before/after comparison for one persona's change events, in
 * chronological order, stopping at the first event that fires (one alert per
 * persona per run is enough). Dedup is keyed on the change event itself
 * (CR-02): any prior alert — active, acknowledged, or resolved — whose
 * `details.changeDate` matches an event blocks re-firing for that event
 * forever, while leaving OTHER (new) change events detectable. Extracted
 * from `detectRegressions` so the fire path (alert insert shape + scheduled
 * webhook delivery, NOT the public `alerts.create`) is directly
 * unit-testable against a fake ctx, without convex-test.
 */
export async function detectRegressionsForPersona(
  ctx: DetectRegressionsCtx,
  profileId: string
): Promise<{ fired: boolean }> {
  const priorAlerts = await ctx.runQuery(
    internal.evalScores.getRegressionAlertsInternal,
    { profileId }
  );
  const alertedChangeDates = new Set<number>(
    (priorAlerts as Array<{ details?: { changeDate?: number } }>)
      .map((a) => a.details?.changeDate)
      .filter((d): d is number => typeof d === "number")
  );

  const { switches, configChanges } = await ctx.runQuery(
    internal.evalScores.getPersonaChangeEventsInternal,
    { profileId }
  );
  const events = buildChangeMarkers(profileId, switches, configChanges);

  for (const event of events) {
    // CR-02: this change event already produced an alert (whatever its
    // current lifecycle status) — never re-fire for the same event.
    if (alertedChangeDates.has(event.timestamp)) continue;

    const beforeScores = await ctx.runQuery(
      internal.evalScores.getEvalScoresWindowInternal,
      {
        profileId,
        start: event.timestamp - REGRESSION_WINDOW_SECONDS,
        end: event.timestamp,
      }
    );
    const afterScores = await ctx.runQuery(
      internal.evalScores.getEvalScoresWindowInternal,
      {
        profileId,
        start: event.timestamp,
        end: event.timestamp + REGRESSION_WINDOW_SECONDS,
      }
    );

    const evaluation = evaluateRegression(beforeScores, afterScores);
    if (!evaluation.fire) continue;

    const message = buildRegressionMessage(
      profileId,
      evaluation,
      event.timestamp,
      event.changeType
    );

    const alertId = await ctx.runMutation(
      internal.evalScores.insertRegressionAlert,
      {
        profileId,
        message,
        details: {
          before: evaluation.meanBefore,
          after: evaluation.meanAfter,
          changeDate: event.timestamp,
          changeType: event.changeType,
        },
      }
    );

    // D-13: inherit the existing alert engine's delivery routing —
    // createIfNew's exact shape (webhookStatus pending + scheduled
    // sendAlertWebhook), never the non-delivering public alerts.create.
    await ctx.scheduler.runAfter(0, internal.webhookDelivery.sendAlertWebhook, {
      alertId,
      attempt: 1,
    });

    return { fired: true };
  }

  return { fired: false };
}

export const detectRegressions = internalAction({
  args: {},
  handler: async (ctx) => {
    // listConfigs is a public query — internalActions call it via api.,
    // same pattern as judgeSessionsAction above.
    const personas = await ctx.runQuery(api.profiles.listConfigs, {});
    for (const p of personas as Array<{ profileId: string }>) {
      await detectRegressionsForPersona(ctx, p.profileId);
    }
  },
});
