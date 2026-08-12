/**
 * Phase 186 Plan 02 (GOV-01, D-10/D-12) — authed HTTP surface onto the
 * plan-01 inbox store (inbox.ts), giving Ástríðr's interrupt governor (Plan
 * 04) write access and CodePulse (Plan 07 Inbox surface + Plan 13 focus-exit
 * digest) authed read access over the same `inbox` table. Mirrors
 * remindersIngest.ts's handler contract exactly: OPTIONS->204, auth->401,
 * missing field->400, ctx.runMutation/runQuery, success->200, throw->400.
 */
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { getCorsHeaders, validateIngestAuth, unauthorizedResponse } from "./ingestAuth";

function jsonResponse(request: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
  });
}

/**
 * POST /inbox-ingest
 * body.op in {"raise","ack","dismiss"} dispatches to the matching inbox
 * mutation. `raise` forwards itemType/heldReason/intentId straight through
 * (D-10) — the governor sets itemType="held"+heldReason for suppressed
 * events and passes intentId inline for high-priority deliveries; there is
 * NO setIntentId/update op (Blocker 3).
 */
export const inboxIngest = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(request) });
  }

  // T-186-02-01: fail-closed auth on every write.
  if (!validateIngestAuth(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const op = body.op as string | undefined;

    if (!op) {
      return jsonResponse(request, 400, { error: "Missing required field: op" });
    }

    if (op === "raise") {
      if (!body.profileId || !body.title || !body.body || !body.itemType) {
        return jsonResponse(request, 400, {
          error: "Missing required fields for raise: profileId, title, body, itemType",
        });
      }
      await ctx.runMutation(api.inbox.raise, {
        profileId: body.profileId as string,
        emitter: body.emitter as string,
        priority: body.priority as string,
        title: body.title as string,
        body: body.body as string,
        spoken: (body.spoken as boolean) ?? false,
        itemType: body.itemType as string,
        heldReason: body.heldReason as string | undefined,
        intentId: body.intentId as string | undefined,
        source: body.source as string | undefined,
        sourceId: body.sourceId as string | undefined,
        createdAt: body.createdAt as number | undefined,
        // Phase 188.5 WR-04: machine-only signal rows (emitter
        // watch_pulse_grace) are born read, since nothing ever acks them
        // and they would otherwise sit in the Inbox as permanently-unread
        // notifications forever. Absent for every human-facing caller.
        ackedAt: body.ackedAt as number | undefined,
      });
    } else if (op === "ack") {
      if (!body.id) {
        return jsonResponse(request, 400, { error: "Missing required field for ack: id" });
      }
      await ctx.runMutation(api.inbox.ack, { id: body.id as any });
    } else if (op === "dismiss") {
      if (!body.id) {
        return jsonResponse(request, 400, { error: "Missing required field for dismiss: id" });
      }
      await ctx.runMutation(api.inbox.dismiss, { id: body.id as any });
    } else {
      return jsonResponse(request, 400, {
        error: `Unknown op: ${op}. Expected "raise", "ack", or "dismiss".`,
      });
    }

    return jsonResponse(request, 200, { ok: true });
  } catch (e: any) {
    return jsonResponse(request, 400, { error: e.message });
  }
});

/**
 * POST /inbox-read
 * body.profileId required. Authed (T-186-02-01) — inbox rows are personal
 * data and are never exposed to an anonymous cross-origin read. Not a
 * public GET. UNCHANGED per-profile shape — D-12's aggregate read
 * (inboxReadAll, below) is additive and does not touch this route.
 */
export const inboxRead = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(request) });
  }

  if (!validateIngestAuth(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;

    if (!body.profileId) {
      return jsonResponse(request, 400, { error: "Missing required field: profileId" });
    }

    const items = await ctx.runQuery(api.inbox.listByProfile, {
      profileId: body.profileId as string,
    });

    return jsonResponse(request, 200, { ok: true, items });
  } catch (e: any) {
    return jsonResponse(request, 400, { error: e.message });
  }
});

/**
 * POST /inbox-read-all (D-12 — aggregate all-profiles read)
 * Requires NO profileId — returns rows across ALL profiles so the Inbox
 * surface (Plan 07) and the focus-exit digest (Plan 13) see business/
 * consulting cards and held items, not just personal. Reuses the SAME
 * fail-closed bearer check as /inbox-read (T-186-02-03) — no separate or
 * weaker auth for the widest personal-data surface, never a public GET.
 */
export const inboxReadAll = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(request) });
  }

  if (!validateIngestAuth(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const limit = body.limit as number | undefined;

    const items = await ctx.runQuery(api.inbox.listAll, { limit });

    return jsonResponse(request, 200, { ok: true, items });
  } catch (e: any) {
    return jsonResponse(request, 400, { error: e.message });
  }
});

/**
 * POST /inbox-read-held-unacked (WR-01 fix — dedicated held-only read)
 * Mirrors /inbox-read-all's auth/validation exactly (same fail-closed
 * bearer check, no anonymous access, no new field exposure) but forwards to
 * inbox.listHeldUnacked instead of inbox.listAll -- so focus_digest.py's
 * held-focus row count/ack loop is no longer bounded by listAll()'s generic
 * 200-row DEFAULT_LIST_ALL_LIMIT across ALL itemTypes. No body fields
 * required.
 */
export const inboxReadHeldUnacked = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(request) });
  }

  if (!validateIngestAuth(request)) {
    return unauthorizedResponse();
  }

  try {
    const items = await ctx.runQuery(api.inbox.listHeldUnacked, {});

    return jsonResponse(request, 200, { ok: true, items });
  } catch (e: any) {
    return jsonResponse(request, 400, { error: e.message });
  }
});
