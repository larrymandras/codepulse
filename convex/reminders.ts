/**
 * Phase 101 Plan 01 (REM-01/REM-04) — reminders Convex module.
 *
 * Convex is the single source of truth for reminders (D-01) — both CodePulse
 * (this module's mutations, called directly from the UI) and Ástríðr
 * (authed /reminders-ingest + /reminders-read httpActions, D-07) read/write
 * the same `reminders` table. `source` records origin only and is never a
 * write gate (D-09).
 *
 * Recurrence is "rrule-lite" (D-05): { freq, interval, byday?, until? }.
 * `computeNextDueAt` is the pure engine — see the "Task 2" section below.
 *
 * CRUD mutations/queries (Task 3) extract their business logic into plain
 * exported "*Handler" functions taking a minimal `{ db }` shape, so they are
 * unit-testable without convex-test (not installed in this repo — see
 * convex/runtimeIngest.test.ts:9 and convex/evalScores.ts's
 * storeEvalScoreHandler for the precedent). The mutation()/query() builders
 * below are thin wrappers that supply the real ctx and Date.now()/1000.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ============================================================
// Task 2 — computeNextDueAt (pure, unit-first recurrence engine)
// ============================================================

export type RecurrenceFreq = "daily" | "weekly" | "monthly";

export interface Recurrence {
  freq: RecurrenceFreq;
  interval: number;
  byday?: string[];
  until?: number;
}

const ICAL_DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/**
 * Given a UTC calendar date, add `months` months, clamping the day-of-month
 * to the last valid day of the target month (e.g. Jan 31 + 1mo -> Feb 28/29).
 * Preserves the original UTC time-of-day.
 */
function addMonthsClamped(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = date.getUTCSeconds();

  const targetMonthIndex = month + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;

  // Day 0 of (targetMonth + 1) is the last day of targetMonth.
  const daysInTargetMonth = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0)
  ).getUTCDate();
  const clampedDay = Math.min(day, daysInTargetMonth);

  return new Date(
    Date.UTC(targetYear, targetMonth, clampedDay, hours, minutes, seconds)
  );
}

/**
 * Weekly + byday: find the next date strictly after `date` whose weekday
 * matches one of the given iCal day codes (MO/TU/WE/TH/FR/SA/SU).
 */
function nextBydayOccurrence(date: Date, byday: string[]): Date {
  const codes = new Set(byday.map((d) => d.toUpperCase()));
  const next = new Date(date);
  for (let i = 0; i < 14; i++) {
    next.setUTCDate(next.getUTCDate() + 1);
    if (codes.has(ICAL_DAY_CODES[next.getUTCDay()])) return next;
  }
  // No match found in two weeks (malformed byday) — fall back to +7 days.
  const fallback = new Date(date);
  fallback.setUTCDate(fallback.getUTCDate() + 7);
  return fallback;
}

/**
 * Advances `dueAt` (epoch seconds) by one occurrence of `recurrence`.
 * Deterministic — operates only on the passed dueAt, never the wall clock.
 * Returns null for a one-off (no recurrence) or when the computed next
 * occurrence is past `recurrence.until` (bounded recurrence terminates).
 */
export function computeNextDueAt(
  dueAt: number,
  recurrence: Recurrence | undefined
): number | null {
  if (!recurrence) return null;
  const { freq, interval, byday, until } = recurrence;
  const date = new Date(dueAt * 1000);
  let next: Date;

  if (freq === "daily") {
    next = new Date(date);
    next.setUTCDate(next.getUTCDate() + interval);
  } else if (freq === "weekly") {
    next =
      byday && byday.length > 0
        ? nextBydayOccurrence(date, byday)
        : (() => {
            const d = new Date(date);
            d.setUTCDate(d.getUTCDate() + 7 * interval);
            return d;
          })();
  } else {
    next = addMonthsClamped(date, interval);
  }

  const nextEpoch = Math.round(next.getTime() / 1000);
  if (until !== undefined && nextEpoch > until) return null;
  return nextEpoch;
}

// ============================================================
// Task 3 — CRUD mutations + queries
// ============================================================

const recurrenceValidator = v.object({
  freq: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly")),
  interval: v.float64(),
  byday: v.optional(v.array(v.string())),
  until: v.optional(v.float64()),
});

/** Minimal ctx.db surface the handlers depend on — implemented for real by
 * Convex's ctx.db, and by an in-memory fake in convex/reminders.test.ts. */
interface RemindersDb {
  insert: (table: string, doc: Record<string, unknown>) => Promise<any>;
  get: (id: any) => Promise<any>;
  patch: (id: any, patch: Record<string, unknown>) => Promise<void>;
  delete: (id: any) => Promise<void>;
  query: (table: string) => {
    withIndex: (
      indexName: string,
      cb?: (q: { eq: (field: string, value: any) => any }) => any
    ) => { collect: () => Promise<any[]>; first: () => Promise<any> };
  };
}

export interface CreateReminderArgs {
  profileId: string;
  title: string;
  notes?: string;
  dueAt?: number;
  priority?: string; // "low" | "med" | "high", default "med"
  recurrence?: Recurrence;
  tags?: string[];
  source: string; // "dashboard" | "astridr" (D-09 — required, never gates)
}

export async function createReminderHandler(
  ctx: { db: RemindersDb } | any,
  args: CreateReminderArgs,
  now: number
) {
  return await ctx.db.insert("reminders", {
    profileId: args.profileId,
    title: args.title,
    notes: args.notes,
    dueAt: args.dueAt,
    priority: args.priority ?? "med",
    status: "open",
    recurrence: args.recurrence,
    tags: args.tags,
    source: args.source,
    createdAt: now,
    updatedAt: now,
  });
}

export const create = mutation({
  args: {
    profileId: v.string(),
    title: v.string(),
    notes: v.optional(v.string()),
    dueAt: v.optional(v.float64()),
    priority: v.optional(v.string()),
    recurrence: v.optional(recurrenceValidator),
    tags: v.optional(v.array(v.string())),
    source: v.string(),
  },
  handler: async (ctx, args) =>
    createReminderHandler(ctx, args, Date.now() / 1000),
});

export interface UpdateReminderArgs {
  title?: string;
  notes?: string;
  dueAt?: number;
  priority?: string;
  recurrence?: Recurrence;
  tags?: string[];
}

export async function updateReminderHandler(
  ctx: { db: RemindersDb } | any,
  id: any,
  fields: UpdateReminderArgs,
  now: number
) {
  const patch: Record<string, unknown> = { updatedAt: now };
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) patch[key] = value;
  }
  await ctx.db.patch(id, patch);
}

export const update = mutation({
  args: {
    id: v.id("reminders"),
    title: v.optional(v.string()),
    notes: v.optional(v.string()),
    dueAt: v.optional(v.float64()),
    priority: v.optional(v.string()),
    recurrence: v.optional(recurrenceValidator),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { id, ...fields }) =>
    updateReminderHandler(ctx, id, fields, Date.now() / 1000),
});

/**
 * D-05: completing a recurring reminder spawns the next open occurrence
 * (new row: same title/profile/priority/recurrence/tags/source, dueAt =
 * computeNextDueAt(original), status "open", notifiedAt cleared). A one-off
 * (no recurrence), or a recurrence whose next occurrence is past `until`,
 * spawns nothing.
 */
export async function completeReminderHandler(
  ctx: { db: RemindersDb } | any,
  id: any,
  now: number
) {
  const existing = await ctx.db.get(id);
  if (!existing) return;

  await ctx.db.patch(id, {
    status: "done",
    completedAt: now,
    updatedAt: now,
  });

  if (existing.recurrence && existing.dueAt !== undefined) {
    const nextDueAt = computeNextDueAt(existing.dueAt, existing.recurrence);
    if (nextDueAt !== null) {
      await ctx.db.insert("reminders", {
        profileId: existing.profileId,
        title: existing.title,
        notes: existing.notes,
        dueAt: nextDueAt,
        priority: existing.priority,
        status: "open",
        recurrence: existing.recurrence,
        tags: existing.tags,
        source: existing.source,
        notifiedAt: undefined,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}

export const complete = mutation({
  args: { id: v.id("reminders") },
  handler: async (ctx, { id }) =>
    completeReminderHandler(ctx, id, Date.now() / 1000),
});

export async function snoozeReminderHandler(
  ctx: { db: RemindersDb } | any,
  id: any,
  until: number,
  now: number
) {
  await ctx.db.patch(id, {
    status: "snoozed",
    snoozedUntil: until,
    updatedAt: now,
  });
}

export const snooze = mutation({
  args: { id: v.id("reminders"), until: v.float64() },
  handler: async (ctx, { id, until }) =>
    snoozeReminderHandler(ctx, id, until, Date.now() / 1000),
});

export async function removeReminderHandler(
  ctx: { db: RemindersDb } | any,
  id: any
) {
  await ctx.db.delete(id);
}

export const remove = mutation({
  args: { id: v.id("reminders") },
  handler: async (ctx, { id }) => removeReminderHandler(ctx, id),
});

export async function listByProfileHandler(
  ctx: { db: RemindersDb } | any,
  profileId: string
) {
  return await ctx.db
    .query("reminders")
    .withIndex("by_profile", (q: { eq: (field: string, value: any) => any }) =>
      q.eq("profileId", profileId)
    )
    .collect();
}

export const listByProfile = query({
  args: { profileId: v.string() },
  handler: async (ctx, { profileId }) =>
    listByProfileHandler(ctx, profileId),
});

/** Open|snoozed rows with dueAt <= now+withinSeconds, never status "done". */
export async function dueSoonHandler(
  ctx: { db: RemindersDb } | any,
  withinSeconds: number,
  now: number
) {
  const cutoff = now + withinSeconds;
  const rows = await ctx.db.query("reminders").withIndex("by_dueAt").collect();
  return rows.filter(
    (r: any) =>
      r.status !== "done" && r.dueAt !== undefined && r.dueAt <= cutoff
  );
}

export const dueSoon = query({
  args: { withinSeconds: v.float64() },
  handler: async (ctx, { withinSeconds }) =>
    dueSoonHandler(ctx, withinSeconds, Date.now() / 1000),
});

/** Open|snoozed rows with dueAt < now, never status "done". */
export async function overdueHandler(ctx: { db: RemindersDb } | any, now: number) {
  const rows = await ctx.db.query("reminders").withIndex("by_dueAt").collect();
  return rows.filter(
    (r: any) => r.status !== "done" && r.dueAt !== undefined && r.dueAt < now
  );
}

export const overdue = query({
  args: {},
  handler: async (ctx) => overdueHandler(ctx, Date.now() / 1000),
});
