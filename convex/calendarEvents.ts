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
 *
 * The upsert/prune mutation and /calendar-ingest httpAction are added in
 * Task 3 of this plan.
 */
import { query } from "./_generated/server";
import { v } from "convex/values";

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
