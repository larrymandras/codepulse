/**
 * loomHttp.ts — the Loom step-event ingest surface (Phase 119, D-02/D-03/D-04).
 *
 * One route. Anything that can run `node loom-emit.mjs step:complete 2` drives
 * the live view: workflow scripts, skills, Ástríðr crons, GSD executors. There
 * is no WebSocket layer — the row updates and the UI animates through its
 * existing Convex subscription.
 *
 * D-04: agent/CLI only. No CORS headers and no OPTIONS partner, deliberately
 * unlike the ingest route pairs elsewhere in convex/http.ts. The browser never
 * calls this; it reads through subscriptions.
 */
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { validateLoomAuth, unauthorizedResponse } from "./ingestAuth";

/**
 * The single header-construction site for this file — Content-Type only, no
 * CORS — so there is exactly one place to audit for a CORS regression.
 */
function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * POST /loom/event  body { pipelineSlug, stepId, event, text? }
 *
 * D-03: fail-closed auth is the first executable statement, before any db
 * access — an unauthenticated emit must not be able to probe which pipelines
 * exist by comparing 404 against 200.
 *
 * D-06: an unknown pipelineSlug is a 404 REFUSAL, never an implicit create.
 */
export const loomEventPostHandler = async (ctx: any, request: Request) => {
  if (!validateLoomAuth(request)) return unauthorizedResponse();

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "INVALID_JSON" }, 400);
  }

  const pipelineSlug = typeof body?.pipelineSlug === "string" ? body.pipelineSlug : "";
  const stepId = typeof body?.stepId === "string" ? body.stepId : "";
  const event = typeof body?.event === "string" ? body.event : "";

  if (!pipelineSlug) return jsonResponse({ error: "MISSING_FIELD", field: "pipelineSlug" }, 400);
  if (!stepId) return jsonResponse({ error: "MISSING_FIELD", field: "stepId" }, 400);
  if (!event) return jsonResponse({ error: "MISSING_FIELD", field: "event" }, 400);

  const result = await ctx.runMutation(internal.loom.recordStepEvent, {
    pipelineSlug,
    stepId,
    event,
    text: typeof body?.text === "string" ? body.text : undefined,
  });

  if (!result?.ok) {
    // UNKNOWN_PIPELINE is a refusal (404); UNKNOWN_EVENT is a malformed
    // request (400). Distinguishing them matters to the emitter: one means
    // "author the pipeline first", the other means "you typo'd the verb".
    const status = result?.error === "UNKNOWN_PIPELINE" ? 404 : 400;
    return jsonResponse({ error: result?.error ?? "REFUSED" }, status);
  }

  return jsonResponse({ ok: true, runId: result.runId }, 200);
};

export const loomEventPost = httpAction(loomEventPostHandler);
