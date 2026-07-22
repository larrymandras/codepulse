/**
 * Phase 101 Plan 02 (REM-02) — authed HTTP surface onto the plan-01 reminders
 * store, giving Ástríðr write and read access over the same `reminders`
 * table CodePulse writes directly (D-01/D-07). Mirrors the v6Ingest.ts
 * handler contract exactly: OPTIONS->204, auth->401, missing field->400,
 * ctx.runMutation/runQuery, success->{ok:true} 200, throw->400.
 */
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { getCorsHeaders, validateIngestAuth, unauthorizedResponse } from "./ingestAuth";

/**
 * POST /reminders-ingest
 * body.op in {"create","update","complete","snooze","markNotified"} dispatches to the matching
 * reminders mutation. `create` always writes source:"astridr" — any
 * body.source is ignored (D-09: source is Ástríðr's own write path here,
 * never trusted from the caller).
 */
export const remindersIngest = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(request) });
  }

  // T-101-01: fail-closed auth on every write.
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

    if (op === "create") {
      if (!body.profileId || !body.title) {
        return new Response(
          JSON.stringify({ error: "Missing required fields for create: profileId, title" }),
          { status: 400, headers: { "Content-Type": "application/json", ...getCorsHeaders(request) } }
        );
      }
      await ctx.runMutation(api.reminders.create, {
        profileId: body.profileId as string,
        title: body.title as string,
        notes: body.notes as string | undefined,
        dueAt: body.dueAt as number | undefined,
        priority: body.priority as string | undefined,
        recurrence: body.recurrence as any,
        tags: body.tags as string[] | undefined,
        source: "astridr", // D-09: never trust body.source on this endpoint
      });
    } else if (op === "update") {
      if (!body.id) {
        return new Response(
          JSON.stringify({ error: "Missing required field for update: id" }),
          { status: 400, headers: { "Content-Type": "application/json", ...getCorsHeaders(request) } }
        );
      }
      await ctx.runMutation(api.reminders.update, {
        id: body.id as any,
        title: body.title as string | undefined,
        notes: body.notes as string | undefined,
        dueAt: body.dueAt as number | undefined,
        priority: body.priority as string | undefined,
        recurrence: body.recurrence as any,
        tags: body.tags as string[] | undefined,
      });
    } else if (op === "complete") {
      if (!body.id) {
        return new Response(
          JSON.stringify({ error: "Missing required field for complete: id" }),
          { status: 400, headers: { "Content-Type": "application/json", ...getCorsHeaders(request) } }
        );
      }
      await ctx.runMutation(api.reminders.complete, { id: body.id as any });
    } else if (op === "snooze") {
      // REM-03: a real snooze (status "snoozed" + snoozedUntil), NOT an
      // update with a shifted dueAt — the latter loses the snooze state that
      // reminder_nudge.py's client-side _is_due() consumes via
      // /reminders-read + listByProfile (the surviving canonical nudge
      // mechanism; no dedicated Convex queries key off it).
      if (!body.id || body.until === undefined) {
        return new Response(
          JSON.stringify({ error: "Missing required fields for snooze: id, until" }),
          { status: 400, headers: { "Content-Type": "application/json", ...getCorsHeaders(request) } }
        );
      }
      await ctx.runMutation(api.reminders.snooze, {
        id: body.id as any,
        until: body.until as number,
      });
    } else if (op === "markNotified") {
      // REM-05: lets the Ástríðr nudge cron close its dedupe loop by stamping
      // notifiedAt after it sends an alert. Omitting notifiedAt stamps "now".
      if (!body.id) {
        return new Response(
          JSON.stringify({ error: "Missing required field for markNotified: id" }),
          { status: 400, headers: { "Content-Type": "application/json", ...getCorsHeaders(request) } }
        );
      }
      await ctx.runMutation(api.reminders.markNotified, {
        id: body.id as any,
        notifiedAt: body.notifiedAt as number | undefined,
      });
    } else {
      return new Response(
        JSON.stringify({
          error: `Unknown op: ${op}. Expected "create", "update", "complete", "snooze", or "markNotified".`,
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...getCorsHeaders(request) } }
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    });
  }
});

/**
 * POST /reminders-read
 * body.profileId required. Authed (D-07) — reminders are personal data and
 * are never exposed to an anonymous cross-origin read. Not a public GET.
 */
export const remindersRead = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(request) });
  }

  // T-101-02/D-07: fail-closed auth — read is never anonymous.
  if (!validateIngestAuth(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;

    if (!body.profileId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: profileId" }),
        { status: 400, headers: { "Content-Type": "application/json", ...getCorsHeaders(request) } }
      );
    }

    const reminders = await ctx.runQuery(api.reminders.listByProfile, {
      profileId: body.profileId as string,
    });

    return new Response(JSON.stringify({ ok: true, reminders }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    });
  }
});
