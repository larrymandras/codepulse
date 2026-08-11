/**
 * Phase 189 Plan 10 (DIAL-01) — authed HTTP surface onto the gagLedger
 * store, giving Ástríðr the propose/confirm/retire/list/eligible/markUsed
 * lifecycle (D-21). Mirrors remindersIngest.ts's handler contract exactly:
 * OPTIONS->204, auth->401, missing field->400, ctx.runMutation/runQuery,
 * success->{ok:true,...} 200, throw->400.
 *
 * D-21/T-189-44: `propose` NEVER reads body.status or body.source — the
 * underlying mutation (gagLedger.ts propose()) hardcodes status:"proposed"
 * and source:"astridr" unconditionally, exactly like remindersIngest.ts's
 * source:"astridr" hardcode at its create op, for the same "never trust the
 * caller" reason. A caller cannot self-confirm a gag through this endpoint
 * no matter what fields it sends.
 */
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { getCorsHeaders, validateIngestAuth, unauthorizedResponse } from "./ingestAuth";

function badRequest(message: string, request: Request): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
  });
}

function ok(payload: Record<string, unknown>, request: Request): Response {
  return new Response(JSON.stringify({ ok: true, ...payload }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
  });
}

/**
 * POST /gag-ledger-ingest
 * body.op in {"propose","confirm","retire","list","eligible","markUsed"}.
 */
export const gagLedgerIngest = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(request) });
  }

  // T-189-43: fail-closed auth on every request before any body parse.
  if (!validateIngestAuth(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const op = body.op as string | undefined;

    if (!op) {
      return badRequest("Missing required field: op", request);
    }

    if (op === "propose") {
      if (!body.profileId || !body.text) {
        return badRequest("Missing required fields for propose: profileId, text", request);
      }
      // D-21: body.status and body.source are deliberately NEVER read here.
      const gag = await ctx.runMutation(api.gagLedger.propose, {
        profileId: body.profileId as string,
        text: body.text as string,
      });
      return ok({ gag }, request);
    } else if (op === "confirm") {
      if (!body.id) {
        return badRequest("Missing required field for confirm: id", request);
      }
      const gag = await ctx.runMutation(api.gagLedger.confirm, { id: body.id as any });
      return ok({ gag }, request);
    } else if (op === "retire") {
      if (!body.id) {
        return badRequest("Missing required field for retire: id", request);
      }
      const gag = await ctx.runMutation(api.gagLedger.retire, { id: body.id as any });
      return ok({ gag }, request);
    } else if (op === "list") {
      if (!body.profileId) {
        return badRequest("Missing required field for list: profileId", request);
      }
      const gags = await ctx.runQuery(api.gagLedger.list, {
        profileId: body.profileId as string,
      });
      return ok({ gags }, request);
    } else if (op === "eligible") {
      if (
        !body.profileId ||
        body.cooldownSeconds === undefined ||
        body.stalenessSeconds === undefined
      ) {
        return badRequest(
          "Missing required fields for eligible: profileId, cooldownSeconds, stalenessSeconds",
          request
        );
      }
      const gags = await ctx.runQuery(api.gagLedger.eligible, {
        profileId: body.profileId as string,
        cooldownSeconds: body.cooldownSeconds as number,
        stalenessSeconds: body.stalenessSeconds as number,
      });
      return ok({ gags }, request);
    } else if (op === "markUsed") {
      if (!body.id) {
        return badRequest("Missing required field for markUsed: id", request);
      }
      const gag = await ctx.runMutation(api.gagLedger.markUsed, { id: body.id as any });
      return ok({ gag }, request);
    } else {
      return badRequest(
        `Unknown op: ${op}. Expected "propose", "confirm", "retire", "list", "eligible", or "markUsed".`,
        request
      );
    }
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    });
  }
});
