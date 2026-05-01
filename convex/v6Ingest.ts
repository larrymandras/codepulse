import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import {
  getCorsHeaders,
  validateIngestAuth,
  unauthorizedResponse,
  checkBodySize,
  payloadTooLargeResponse,
  rateLimitResponse,
  validationErrorResponse,
} from "./ingestAuth";
import { ingestRateLimiter } from "./ingestRateLimit";
import { validatePayload, type FieldSchema } from "./lib/validation";

// ── Schema definitions per endpoint ──────────────────────────────────────

const preflightSchema: Record<string, FieldSchema> = {
  profileId: { type: "string", required: true },
  sessionId: { type: "string", required: false },
  hitCount: { type: "number", required: false },
  missCount: { type: "number", required: false },
  latencyMs: { type: "number", required: false },
  topMemoryIds: { type: "array", required: false },
  timestamp: { type: "number", required: false },
};

const dreamingSchema: Record<string, FieldSchema> = {
  type: { type: "string", required: true },
  // cycle fields
  runDate: { type: "string", required: false },
  status: { type: "string", required: false },
  rawCount: { type: "number", required: false },
  candidateCount: { type: "number", required: false },
  extractedCount: { type: "number", required: false },
  dedupedCount: { type: "number", required: false },
  storedCount: { type: "number", required: false },
  durationMs: { type: "number", required: false },
  costUsd: { type: "number", required: false },
  isBackfill: { type: "boolean", required: false },
  // fact fields
  cycleId: { type: "string", required: false },
  factText: { type: "string", required: false },
  category: { type: "string", required: false },
  confidence: { type: "number", required: false },
  sourceMemoryIds: { type: "array", required: false },
  timestamp: { type: "number", required: false },
};

const advisorSchema: Record<string, FieldSchema> = {
  type: { type: "string", required: false },
  provider: { type: "string", required: true },
  sessionId: { type: "string", required: false },
  model: { type: "string", required: false },
  used: { type: "boolean", required: false },
  inputTokens: { type: "number", required: false },
  outputTokens: { type: "number", required: false },
  costUsd: { type: "number", required: false },
  standardCostUsd: { type: "number", required: false },
  latencyMs: { type: "number", required: false },
  timestamp: { type: "number", required: false },
};

const importSchema: Record<string, FieldSchema> = {
  importId: { type: "string", required: true },
  source: { type: "string", required: true },
  status: { type: "string", required: true },
  conversationCount: { type: "number", required: false },
  memoriesCreated: { type: "number", required: false },
  errorMessage: { type: "string", required: false },
  timestamp: { type: "number", required: false },
};

const startupSchema: Record<string, FieldSchema> = {
  phase: { type: "string", required: true },
  duration: { type: "number", required: false },
  totalMs: { type: "number", required: false },
  subsystem: { type: "string", required: false },
  order: { type: "number", required: false },
  timestamp: { type: "number", required: false },
};

const authAliasSchema: Record<string, FieldSchema> = {
  alias: { type: "string", required: true },
  provider: { type: "string", required: true },
  userId: { type: "string", required: true },
  createdAt: { type: "number", required: false },
};

// ── Shared pipeline preamble ─────────────────────────────────────────────

/** Run the shared auth/size/rate-limit pipeline. Returns headers + null on success, or a Response to short-circuit. */
async function pipeline(
  ctx: any,
  request: Request,
): Promise<{ headers: Record<string, string>; apiKey: string } | Response> {
  const origin = request.headers.get("Origin");
  const headers = getCorsHeaders(origin);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (!validateIngestAuth(request)) {
    return unauthorizedResponse(headers);
  }

  if (!checkBodySize(request)) {
    return payloadTooLargeResponse(headers);
  }

  const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "") ?? "anonymous";
  const rateCheck = await ingestRateLimiter.limit(ctx, "general", { key: apiKey });
  if (!rateCheck.ok) {
    return rateLimitResponse(headers, rateCheck.retryAfter);
  }

  return { headers, apiKey };
}

// ── Endpoint handlers ────────────────────────────────────────────────────

/**
 * POST /preflight-ingest
 * Ingest a memoryPreflight record.
 */
export const preflightIngest = httpAction(async (ctx, request) => {
  const result = await pipeline(ctx, request);
  if (result instanceof Response) return result;
  const { headers } = result;

  try {
    const body = await request.json() as Record<string, unknown>;

    // D-09/D-11: Strict schema validation
    const errors = validatePayload(body, preflightSchema);
    if (errors.length > 0) return validationErrorResponse(errors, headers);

    await ctx.runMutation(api.v6Mutations.insertMemoryPreflight, {
      sessionId: body.sessionId as string | undefined,
      profileId: body.profileId as string,
      hitCount: (body.hitCount as number) ?? 0,
      missCount: (body.missCount as number) ?? 0,
      latencyMs: (body.latencyMs as number) ?? 0,
      topMemoryIds: body.topMemoryIds as string[] | undefined,
      timestamp: (body.timestamp as number) ?? Date.now(),
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...headers },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...headers },
    });
  }
});

/**
 * POST /dreaming-ingest
 * Dispatches by `type` field: "cycle" or "fact".
 */
export const dreamingIngest = httpAction(async (ctx, request) => {
  const result = await pipeline(ctx, request);
  if (result instanceof Response) return result;
  const { headers } = result;

  try {
    const body = await request.json() as Record<string, unknown>;

    // D-09/D-11: Strict schema validation
    const errors = validatePayload(body, dreamingSchema);
    if (errors.length > 0) return validationErrorResponse(errors, headers);

    if (body.type === "cycle") {
      if (!body.runDate || !body.status) {
        return validationErrorResponse(
          [
            ...(!body.runDate ? [{ field: "runDate", message: "required for cycle type" }] : []),
            ...(!body.status ? [{ field: "status", message: "required for cycle type" }] : []),
          ],
          headers,
        );
      }
      await ctx.runMutation(api.v6Mutations.insertDreamingCycle, {
        runDate: body.runDate as string,
        status: body.status as string,
        rawCount: (body.rawCount as number) ?? 0,
        candidateCount: (body.candidateCount as number) ?? 0,
        extractedCount: (body.extractedCount as number) ?? 0,
        dedupedCount: (body.dedupedCount as number) ?? 0,
        storedCount: (body.storedCount as number) ?? 0,
        durationMs: body.durationMs as number | undefined,
        costUsd: body.costUsd as number | undefined,
        isBackfill: body.isBackfill as boolean | undefined,
        timestamp: (body.timestamp as number) ?? Date.now(),
      });
    } else if (body.type === "fact") {
      if (!body.factText || !body.category) {
        return validationErrorResponse(
          [
            ...(!body.factText ? [{ field: "factText", message: "required for fact type" }] : []),
            ...(!body.category ? [{ field: "category", message: "required for fact type" }] : []),
          ],
          headers,
        );
      }
      await ctx.runMutation(api.v6Mutations.insertDreamingFact, {
        cycleId: body.cycleId as string | undefined,
        factText: body.factText as string,
        category: body.category as string,
        confidence: (body.confidence as number) ?? 1.0,
        sourceMemoryIds: body.sourceMemoryIds as string[] | undefined,
        timestamp: (body.timestamp as number) ?? Date.now(),
      });
    } else {
      return validationErrorResponse(
        [{ field: "type", message: `expected "cycle" or "fact", got "${body.type}"` }],
        headers,
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...headers },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...headers },
    });
  }
});

/**
 * POST /advisor-ingest
 * Ingest an advisorEvents record.
 */
export const advisorIngest = httpAction(async (ctx, request) => {
  const result = await pipeline(ctx, request);
  if (result instanceof Response) return result;
  const { headers } = result;

  try {
    const rawBody = await request.json() as Record<string, unknown>;
    // Convex v.optional() rejects null — coerce to undefined
    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rawBody)) {
      body[k] = v === null ? undefined : v;
    }

    // D-09/D-11: Strict schema validation
    const errors = validatePayload(body, advisorSchema);
    if (errors.length > 0) return validationErrorResponse(errors, headers);

    await ctx.runMutation(api.v6Mutations.insertAdvisorEvent, {
      sessionId: body.sessionId as string | undefined,
      provider: body.provider as string,
      model: body.model as string | undefined,
      used: (body.used as boolean) ?? false,
      inputTokens: (body.inputTokens as number) ?? 0,
      outputTokens: (body.outputTokens as number) ?? 0,
      costUsd: (body.costUsd as number) ?? 0,
      standardCostUsd: (body.standardCostUsd as number) ?? 0,
      latencyMs: body.latencyMs as number | undefined,
      timestamp: (body.timestamp as number) ?? Date.now(),
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...headers },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...headers },
    });
  }
});

/**
 * POST /import-ingest
 * Ingest a conversationImports record.
 */
export const importIngest = httpAction(async (ctx, request) => {
  const result = await pipeline(ctx, request);
  if (result instanceof Response) return result;
  const { headers } = result;

  try {
    const body = await request.json() as Record<string, unknown>;

    // D-09/D-11: Strict schema validation
    const errors = validatePayload(body, importSchema);
    if (errors.length > 0) return validationErrorResponse(errors, headers);

    await ctx.runMutation(api.v6Mutations.insertConversationImport, {
      importId: body.importId as string,
      source: body.source as string,
      status: body.status as string,
      conversationCount: (body.conversationCount as number) ?? 0,
      memoriesCreated: body.memoriesCreated as number | undefined,
      errorMessage: body.errorMessage as string | undefined,
      timestamp: (body.timestamp as number) ?? Date.now(),
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...headers },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...headers },
    });
  }
});

/**
 * POST /startup-ingest
 * Ingest a startupEvents record.
 */
export const startupIngest = httpAction(async (ctx, request) => {
  const result = await pipeline(ctx, request);
  if (result instanceof Response) return result;
  const { headers } = result;

  try {
    const body = await request.json() as Record<string, unknown>;

    // D-09/D-11: Strict schema validation
    const errors = validatePayload(body, startupSchema);
    if (errors.length > 0) return validationErrorResponse(errors, headers);

    await ctx.runMutation(api.v6Mutations.insertStartupEvent, {
      phase: body.phase as string,
      duration: (body.duration as number) ?? 0,
      totalMs: (body.totalMs as number) ?? 0,
      subsystem: body.subsystem as string | undefined,
      order: body.order as number | undefined,
      timestamp: (body.timestamp as number) ?? Date.now(),
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...headers },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...headers },
    });
  }
});

/**
 * POST /auth-alias-ingest
 * Ingest an authAliases record.
 */
export const authAliasIngest = httpAction(async (ctx, request) => {
  const result = await pipeline(ctx, request);
  if (result instanceof Response) return result;
  const { headers } = result;

  try {
    const body = await request.json() as Record<string, unknown>;

    // D-09/D-11: Strict schema validation
    const errors = validatePayload(body, authAliasSchema);
    if (errors.length > 0) return validationErrorResponse(errors, headers);

    await ctx.runMutation(api.v6Mutations.upsertAuthAlias, {
      alias: body.alias as string,
      provider: body.provider as string,
      userId: body.userId as string,
      createdAt: (body.createdAt as number) ?? Date.now(),
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...headers },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...headers },
    });
  }
});
