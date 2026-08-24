/**
 * Phase 186 Plan 02 (GOV-01, D-10/D-12) — governor inbox Convex module.
 *
 * The inbox is the architectural spine of GOV-01's "record-everything vs
 * interrupt-now" split (D-10): every proactive event the governor (Plan 04)
 * evaluates lands here unconditionally, carrying itemType/heldReason/intentId
 * so a suppressed event is recorded as held, never lost (D-15). Mirrors
 * convex/reminders.ts's structure exactly — mutations/queries extract their
 * business logic into plain exported "*Handler" functions taking a minimal
 * `{ db }` shape, unit-testable without convex-test (not installed in this
 * repo — see convex/runtimeIngest.test.ts:9). The mutation()/query()
 * builders below are thin wrappers that supply the real ctx and Date.now()/1000.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/** Minimal ctx.db surface the handlers depend on — implemented for real by
 * Convex's ctx.db, and by an in-memory fake in convex/inboxIngest.test.ts. */
interface InboxDb {
  insert: (table: string, doc: Record<string, unknown>) => Promise<any>;
  get: (id: any) => Promise<any>;
  patch: (id: any, patch: Record<string, unknown>) => Promise<void>;
  query: (table: string) => {
    withIndex: (
      indexName: string,
      cb?: (q: { eq: (field: string, value: any) => any }) => any
    ) => {
      order: (direction: "asc" | "desc") => {
        take: (n: number) => Promise<any[]>;
        collect: () => Promise<any[]>;
      };
      collect: () => Promise<any[]>;
    };
  };
}

export interface RaiseArgs {
  profileId: string;
  emitter: string;
  priority: string; // "money" | "high" | "normal" | "low" (D-06, validated at the writer)
  title: string;
  body: string;
  spoken: boolean;
  itemType: string; // "card" | "held" | "notification" | "alert" (Plan 07 UI union)
  heldReason?: string; // "focus" | "quiet-hours" (D-07, held items only)
  intentId?: string; // Supabase intents lifecycle row — set inline here only (Blocker 3)
  source?: string;
  sourceId?: string; // Phase 188.2 D-08 — stable per-item id, forwarded unchanged
  createdAt?: number;
  /** Phase 188.5 WR-04 — lets a MACHINE-only signal row be born read.
   * Omitted (the overwhelmingly common case) the row is inserted unacked
   * exactly as before, so this changes nothing for human-facing cards and
   * notifications. Only writers that emit rows no human will ever ack
   * should set it — see the ackedAt note on raiseHandler. */
  ackedAt?: number;
}

/**
 * raise(): inserts an inbox row unconditionally. The governor sets
 * itemType="held" + heldReason for suppressed events and passes intentId
 * inline for high-priority deliveries (D-10). There is no setIntentId/update
 * op — intentId is only ever written at raise time.
 *
 * ackedAt (Phase 188.5 WR-04): previously hardcoded to `undefined` here, so
 * every row was necessarily born unread. That is right for anything a human
 * acts on, but astridr also writes MACHINE-only signal rows (emitter
 * `watch_pulse_grace`, itemType "signal") that exist purely to be COUNTED by
 * an operator instrument. Nothing ever acks them — the producing module is
 * read-only by design — so they accumulated in the Inbox surface as
 * permanently-unread notifications: `inboxRowToInboxItem` coerces every
 * itemType other than "card"/"held" to "notification", and derives
 * `read: row.ackedAt != null`. Honouring a caller-supplied ackedAt lets such
 * a row be born read. Defaults to `undefined` when absent, so every existing
 * caller is unaffected.
 */
export async function raiseHandler(
  ctx: { db: InboxDb } | any,
  args: RaiseArgs,
  now: number
) {
  return await ctx.db.insert("inbox", {
    profileId: args.profileId,
    emitter: args.emitter,
    priority: args.priority,
    title: args.title,
    body: args.body,
    spoken: args.spoken,
    itemType: args.itemType,
    heldReason: args.heldReason,
    intentId: args.intentId,
    source: args.source,
    sourceId: args.sourceId,
    createdAt: args.createdAt ?? now,
    ackedAt: args.ackedAt,
  });
}

export const raise = mutation({
  args: {
    profileId: v.string(),
    emitter: v.string(),
    priority: v.string(),
    title: v.string(),
    body: v.string(),
    spoken: v.boolean(),
    itemType: v.string(),
    heldReason: v.optional(v.string()),
    intentId: v.optional(v.string()),
    source: v.optional(v.string()),
    sourceId: v.optional(v.string()),
    createdAt: v.optional(v.float64()),
    ackedAt: v.optional(v.float64()),
  },
  handler: async (ctx, args) => raiseHandler(ctx, args, Date.now() / 1000),
});

/** ack()/dismiss(): stamp ackedAt on an existing row. No-op if the row is
 * already gone or already acked (idempotent, mirrors reminders.ts's
 * completeReminderHandler guard). */
export async function ackHandler(
  ctx: { db: InboxDb } | any,
  id: any,
  now: number
) {
  const existing = await ctx.db.get(id);
  if (!existing) return;
  await ctx.db.patch(id, { ackedAt: now });
}

export const ack = mutation({
  args: { id: v.id("inbox") },
  handler: async (ctx, { id }) => ackHandler(ctx, id, Date.now() / 1000),
});

/** dismiss() carries the same "stamp ackedAt on an existing row" semantics as
 * ack() — the inbox has no separate dismissed/acked status field (schema),
 * both close out a row from future unacknowledged-count surfaces. */
export async function dismissHandler(
  ctx: { db: InboxDb } | any,
  id: any,
  now: number
) {
  const existing = await ctx.db.get(id);
  if (!existing) return;
  await ctx.db.patch(id, { ackedAt: now });
}

export const dismiss = mutation({
  args: { id: v.id("inbox") },
  handler: async (ctx, { id }) => dismissHandler(ctx, id, Date.now() / 1000),
});

/** listByProfile(): rows for a single profileId, newest first. UNCHANGED
 * per-profile shape — D-12's aggregate read (listAll, below) is additive. */
export async function listByProfileHandler(
  ctx: { db: InboxDb } | any,
  profileId: string
) {
  return await ctx.db
    .query("inbox")
    .withIndex("by_profile", (q: { eq: (field: string, value: any) => any }) =>
      q.eq("profileId", profileId)
    )
    .order("desc")
    .collect();
}

export const listByProfile = query({
  args: { profileId: v.string() },
  handler: async (ctx, { profileId }) => listByProfileHandler(ctx, profileId),
});

const DEFAULT_LIST_ALL_LIMIT = 200;

/**
 * listAll() (D-12): the aggregate all-profiles read — rows across personal,
 * business, AND consulting ordered by createdAt desc, bounded via the
 * by_createdAt index + .take(limit). Backs the Inbox surface (Plan 07) and
 * the focus-exit digest (Plan 13) so business/consulting cards and held
 * items are visible, not just personal.
 */
export async function listAllHandler(ctx: { db: InboxDb } | any, limit?: number) {
  return await ctx.db
    .query("inbox")
    .withIndex("by_createdAt")
    .order("desc")
    .take(limit ?? DEFAULT_LIST_ALL_LIMIT);
}

export const listAll = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, { limit }) => listAllHandler(ctx, limit),
});

/**
 * listHeldUnacked() (WR-01 fix, pairs with focus_digest.py's
 * _gather_unacked_held_focus_rows): a DEDICATED held-only read, indexed on
 * itemType (by_itemType) so it is NOT bounded by listAll()'s generic
 * DEFAULT_LIST_ALL_LIMIT across ALL itemTypes/profiles. Returns every
 * itemType="held" row that has not yet been acked (ackedAt undefined),
 * across all profiles -- the caller (focus_digest.py) further filters to
 * heldReason="focus" + the requested profiles, mirroring listAll()'s
 * existing division of labor (DB-side scoping by index, application-side
 * business-rule filtering).
 */
export async function listHeldUnackedHandler(ctx: { db: InboxDb } | any) {
  const rows = await ctx.db
    .query("inbox")
    .withIndex("by_itemType", (q: { eq: (field: string, value: any) => any }) =>
      q.eq("itemType", "held")
    )
    .collect();
  return rows.filter((row: any) => row.ackedAt === undefined);
}

export const listHeldUnacked = query({
  args: {},
  handler: async (ctx) => listHeldUnackedHandler(ctx),
});

// SWEEP-01 (126-CONTEXT.md D-03/D-04): listHeldUnacked above is subscribed at
// shell level (src/layouts/DashboardLayout.tsx) so the sidebar badge can show
// a live unacked-held count -- but that means the badge's unbounded
// .collect() now runs on EVERY route, not one widget, which is the exact
// every-route DoS risk convex/alerts.ts:109-131's countBySeverity/
// ALERT_COUNT_SCAN_CAP already closed for the sibling Alerts badge (Phase
// 124, D-13). countHeldUnacked is the same fix applied here: a count-only,
// index-scoped, hard-capped read that ships two numbers to every route
// instead of shipping up to 2,001 inbox row objects (title/body/profileId)
// the badge never reads -- it only needs `.length`.
//
// listHeldUnackedHandler/listHeldUnacked above are DELIBERATELY left
// untouched: convex/inboxIngest.ts:174 (inboxReadHeldUnacked httpAction)
// calls listHeldUnacked directly to feed focus_digest.py, which needs the
// TRUE unbounded unacked-held set across all profiles. Capping the shared
// query would silently truncate that cross-repo consumer with no error.
//
// 2000 is ALERT_COUNT_SCAN_CAP's value reused verbatim -- ~43x headroom over
// the 46 held-unacked rows measured live 2026-08-24 -- and it is deliberately
// high because plan 126-06 renders this number as the /inbox Held tab's
// "of M" denominator (D-04): a cap that binds here would propagate into that
// display. When `truncated` is true, `count` is a FLOOR on the true unacked
// total, not the total, because the take() window is the newest
// HELD_COUNT_SCAN_CAP held rows (by_itemType ends in createdAt, order desc).
const HELD_COUNT_SCAN_CAP = 2000;

/**
 * countHeldUnacked() (SWEEP-01, D-03/D-04): bounded, count-only sibling to
 * listHeldUnacked() above, for the every-route shell badge.
 *
 * Reads by_itemType eq("itemType","held") -- the same index listHeldUnacked
 * uses -- and takes CAP+1 rows (the graphSnapshots.ts:252-259 idiom: the
 * extra row is the signal that more remain, not a row to count) with NO
 * `.filter()` before the take. Filtering ackedAt===undefined BEFORE the take
 * would make the scan run until it accumulated CAP+1 *matching* rows, so the
 * number of rows actually read would depend on the table's acked:unacked
 * ratio rather than on the cap -- not a bounded read. Instead this takes
 * CAP+1 rows unconditionally (reads are always exactly min(heldRows, CAP+1))
 * and counts ackedAt===undefined in JavaScript afterward.
 *
 * `truncated` uses the strict `rows.length > CAP` form, NOT
 * countBySeverity's older `length === CAP` form (convex/alerts.ts:143) --
 * `=== CAP` reports true on a table holding EXACTLY CAP rows, a false
 * positive D-04 cannot afford since `truncated` is load-bearing for a number
 * rendered on /inbox.
 */
export async function countHeldUnackedHandler(
  ctx: { db: InboxDb } | any
): Promise<{ count: number; truncated: boolean }> {
  const rows = await ctx.db
    .query("inbox")
    .withIndex("by_itemType", (q: { eq: (field: string, value: any) => any }) =>
      q.eq("itemType", "held")
    )
    .order("desc")
    .take(HELD_COUNT_SCAN_CAP + 1);

  const truncated = rows.length > HELD_COUNT_SCAN_CAP;
  const window = truncated ? rows.slice(0, HELD_COUNT_SCAN_CAP) : rows;
  let count = 0;
  for (const row of window as any[]) {
    if (row.ackedAt === undefined) count++;
  }

  return { count, truncated };
}

// args: {} -- NO client-supplied cap. Load-bearing, not tidiness: every
// public Convex function on this deployment is callable with no credential
// (CLAUDE.md SEED-008, measured 2026-08-11), so a caller-widenable limit on a
// publicly-callable function would reopen the exact DoS this query exists to
// close (mirrors convex/events.ts:253-260's listRecentRuntimeWindow).
export const countHeldUnacked = query({
  args: {},
  handler: async (ctx) => countHeldUnackedHandler(ctx),
});

/**
 * dismissAllCards() (Phase 186 checkpoint round 4 backlog cleanup): bulk-
 * stamps ackedAt on every currently-unacked itemType="card" row across ALL
 * profiles in one call. Held rows (and any other itemType) are NEVER
 * touched -- scoped narrowly to clearing the pre-dedup card flood (198
 * accumulated cards from before watch_pulse's dedup fix landed, D-06/D-12).
 * Idempotent: re-running finds nothing left to dismiss (ackedAt already
 * set) and returns 0. Kept as a permanent admin affordance -- a bulk-clear
 * mutation is legitimately useful beyond this one-time cleanup.
 */
export async function dismissAllCardsHandler(
  ctx: { db: InboxDb } | any,
  now: number
): Promise<number> {
  const rows = await ctx.db.query("inbox").withIndex("by_createdAt").collect();
  let dismissed = 0;
  for (const row of rows) {
    if (row.itemType === "card" && row.ackedAt === undefined) {
      await ctx.db.patch(row._id, { ackedAt: now });
      dismissed++;
    }
  }
  return dismissed;
}

export const dismissAllCards = mutation({
  args: {},
  handler: async (ctx) => dismissAllCardsHandler(ctx, Date.now() / 1000),
});
