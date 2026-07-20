/**
 * Phase 101 Plan 02 (CAL-01) — read-only Google Calendar cache module.
 *
 * `calendarEvents` is a cache ONLY: the browser reads it via `listByProfile`,
 * and it is written ONLY by the authed `/calendar-ingest` httpAction (D-07),
 * which upserts a profile+account's pushed events by `googleEventId` and
 * prunes rows scoped to that (profileId, calendarAccount) pair that are no
 * longer in the push (D-10). No code path here writes to Google — this repo
 * has no Google client; Ástríðr fetches and pushes normalized events (D-02/D-03).
 *
 * Mirrors convex/reminders.ts's pattern: business logic lives in plain
 * exported "*Handler" functions taking a minimal `{ db }` shape so they are
 * unit-testable without convex-test (not installed in this repo).
 */
import { mutation, query, httpAction } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { getCorsHeaders, validateIngestAuth, unauthorizedResponse } from "./ingestAuth";

/** Minimal ctx.db surface the handlers depend on — implemented for real by
 * Convex's ctx.db, and by an in-memory fake in convex/remindersIngest.test.ts. */
interface CalendarEventsDb {
  insert: (table: string, doc: Record<string, unknown>) => Promise<any>;
  patch: (id: any, patch: Record<string, unknown>) => Promise<void>;
  delete: (id: any) => Promise<void>;
  query: (table: string) => {
    withIndex: (
      indexName: string,
      cb?: (q: { eq: (field: string, value: any) => any }) => any
    ) => { collect: () => Promise<any[]>; first: () => Promise<any> };
  };
}

// ============================================================
// listByProfile — read query for the page overlay
// ============================================================

export async function listByProfileHandler(
  ctx: { db: CalendarEventsDb } | any,
  profileId: string
) {
  return await ctx.db
    .query("calendarEvents")
    .withIndex("by_profile", (q: { eq: (field: string, value: any) => any }) =>
      q.eq("profileId", profileId)
    )
    .collect();
}

export const listByProfile = query({
  args: { profileId: v.string() },
  handler: async (ctx, { profileId }) => listByProfileHandler(ctx, profileId),
});

// ============================================================
// upsertBatch — upsert-by-googleEventId + scoped stale prune (D-10)
// ============================================================

export interface CalendarEventInput {
  googleEventId: string;
  title: string;
  start: number;
  end: number;
  allDay: boolean;
  location?: string;
}

export interface UpsertCalendarBatchArgs {
  profileId: string;
  calendarAccount: string;
  events: CalendarEventInput[];
  fetchedAt: number;
}

/**
 * Upserts every pushed event by `googleEventId` (patch if it already exists,
 * insert if not), then deletes rows for THIS (profileId, calendarAccount)
 * pair whose googleEventId is not in the pushed set (D-10). Rows belonging
 * to other profiles, or other accounts within the same profile, are left
 * untouched — the prune is strictly scoped to what this push claims
 * authority over (T-101-04).
 */
export async function upsertCalendarBatchHandler(
  ctx: { db: CalendarEventsDb } | any,
  args: UpsertCalendarBatchArgs
) {
  const { profileId, calendarAccount, events, fetchedAt } = args;
  const incomingIds = new Set(events.map((e) => e.googleEventId));

  for (const ev of events) {
    // Match scoped to THIS push's (profileId, calendarAccount) — Google gives
    // every attendee's copy of an invite the SAME event id, so an unscoped
    // by_googleEventId match let each account's 20-minute push steal the one
    // cached row (re-owning profileId/calendarAccount), ping-ponging a shared
    // event between profiles. Each (profile, account) pair keeps its own row,
    // and ownership fields are never patched.
    const existing = (
      await ctx.db
        .query("calendarEvents")
        .withIndex("by_googleEventId", (q: { eq: (field: string, value: any) => any }) =>
          q.eq("googleEventId", ev.googleEventId)
        )
        .collect()
    ).find(
      (r: any) => r.profileId === profileId && r.calendarAccount === calendarAccount
    );
    if (existing) {
      await ctx.db.patch(existing._id, {
        title: ev.title,
        start: ev.start,
        end: ev.end,
        allDay: ev.allDay,
        location: ev.location,
        fetchedAt,
      });
    } else {
      await ctx.db.insert("calendarEvents", {
        profileId,
        calendarAccount,
        googleEventId: ev.googleEventId,
        title: ev.title,
        start: ev.start,
        end: ev.end,
        allDay: ev.allDay,
        location: ev.location,
        fetchedAt,
      });
    }
  }

  // Scoped stale prune: only rows for THIS (profileId, calendarAccount).
  const scoped = await ctx.db
    .query("calendarEvents")
    .withIndex("by_profile", (q: { eq: (field: string, value: any) => any }) =>
      q.eq("profileId", profileId)
    )
    .collect();
  let pruned = 0;
  for (const row of scoped) {
    if (row.calendarAccount === calendarAccount && !incomingIds.has(row.googleEventId)) {
      await ctx.db.delete(row._id);
      pruned++;
    }
  }

  return { upserted: events.length, pruned };
}

export const upsertBatch = mutation({
  args: {
    profileId: v.string(),
    calendarAccount: v.string(),
    events: v.array(
      v.object({
        googleEventId: v.string(),
        title: v.string(),
        start: v.float64(),
        end: v.float64(),
        allDay: v.boolean(),
        location: v.optional(v.string()),
      })
    ),
    fetchedAt: v.float64(),
  },
  handler: async (ctx, args) => upsertCalendarBatchHandler(ctx, args),
});

// ============================================================
// /calendar-ingest — authed httpAction sink (D-07, CAL-01)
// ============================================================

/**
 * POST /calendar-ingest
 * Ástríðr's calendar cron pushes a profile+account's normalized Google
 * events here (D-03). Auth required (T-101-01); missing profileId/
 * calendarAccount/events -> 400. Delegates the upsert+prune to upsertBatch.
 * This is the ONLY write path into calendarEvents — no reminder or
 * CodePulse mutation ever writes here, and no Google write path exists
 * anywhere in this repo (D-02).
 */
export const calendarIngest = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(request) });
  }

  if (!validateIngestAuth(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;

    if (!body.profileId || !body.calendarAccount || !Array.isArray(body.events)) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: profileId, calendarAccount, events",
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...getCorsHeaders(request) } }
      );
    }

    await ctx.runMutation(api.calendarEvents.upsertBatch, {
      profileId: body.profileId as string,
      calendarAccount: body.calendarAccount as string,
      events: body.events as CalendarEventInput[],
      fetchedAt: (body.fetchedAt as number) ?? Date.now() / 1000,
    });

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
