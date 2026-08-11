/**
 * Phase 189 Plan 10 (DIAL-01) — authed HTTP surface onto the personaDials
 * store, giving Ástríðr write and read access to per-profile, per-persona
 * humor/candor dial values (D-20). Mirrors remindersIngest.ts's handler
 * contract exactly: OPTIONS->204, auth->401, missing field->400,
 * ctx.runMutation/runQuery, success->{ok:true,...} 200, throw->400.
 */
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { getCorsHeaders, validateIngestAuth, unauthorizedResponse } from "./ingestAuth";

/**
 * POST /persona-dials-ingest
 * body.op in {"get","set"} dispatches to the matching personaDials
 * query/mutation. Reuses the EXISTING ASTRIDR_INGEST_API_KEY — no new
 * second key (astridr/tools/reminders.py:41 precedent).
 */
export const personaDialsIngest = httpAction(async (ctx, request) => {
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
      return new Response(
        JSON.stringify({ error: "Missing required field: op" }),
        { status: 400, headers: { "Content-Type": "application/json", ...getCorsHeaders(request) } }
      );
    }

    if (op === "get") {
      if (!body.profileId || !body.personaId) {
        return new Response(
          JSON.stringify({ error: "Missing required fields for get: profileId, personaId" }),
          { status: 400, headers: { "Content-Type": "application/json", ...getCorsHeaders(request) } }
        );
      }
      const dial = await ctx.runQuery(api.personaDials.get, {
        profileId: body.profileId as string,
        personaId: body.personaId as string,
      });
      return new Response(JSON.stringify({ ok: true, dial: dial ?? null }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
      });
    } else if (op === "set") {
      if (
        !body.profileId ||
        !body.personaId ||
        body.humor === undefined ||
        body.candor === undefined
      ) {
        return new Response(
          JSON.stringify({
            error: "Missing required fields for set: profileId, personaId, humor, candor",
          }),
          { status: 400, headers: { "Content-Type": "application/json", ...getCorsHeaders(request) } }
        );
      }
      const dial = await ctx.runMutation(api.personaDials.set, {
        profileId: body.profileId as string,
        personaId: body.personaId as string,
        humor: body.humor as number,
        candor: body.candor as number,
      });
      return new Response(JSON.stringify({ ok: true, dial }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
      });
    } else {
      return new Response(
        JSON.stringify({ error: `Unknown op: ${op}. Expected "get" or "set".` }),
        { status: 400, headers: { "Content-Type": "application/json", ...getCorsHeaders(request) } }
      );
    }
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    });
  }
});
