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
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { partitionBatchForPrune } from "./retentionCursor";

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

// ============================================================
// Phase 127 (JANITOR-01, R-02) — ack-aware auto-close + prune janitor
// ============================================================
//
// See 127-CONTEXT.md's R-02 for the full design rationale (superseding the
// original D-05/D-06 ackedAt-stamping proposal, which this code must never
// resurrect): inbox grows ~100 rows/day and 83.7% of it is never acked, so a
// calendar prune alone would delete cards an operator never saw, and an
// ackedAt-keyed prune alone reaches at most 16% of the table. `closedAt` is
// a dedicated lifecycle field the janitor owns exclusively — it stamps
// EITHER an already-acked row OR a stale-open row the same way, then
// permanently deletes 14 days after that stamp. `ackedAt` itself is never
// written here; it stays the sole "the operator saw this" signal two
// frontend surfaces read (src/pages/Inbox.tsx:130,
// src/components/control-center/IntelligenceFeedPanel.tsx:64).

/** Ctx shape the janitor needs on top of `InboxDb` above: `scheduler.runAfter`
 * for self-rescheduling. `db` is typed `any`, same as media.ts's `MediaCtx`
 * (media.ts:58) — the two-field `by_closedAt` range queries below
 * (`.eq(field, undefined)`, `.gte().lt()`) need chained-builder forms
 * `InboxDb`'s narrower query interface does not describe. Narrower than
 * media.ts's own `JanitorCtx`, which also needs `storage`: inbox rows carry
 * no blobs. */
type JanitorCtx = {
  db: any;
  scheduler: { runAfter: (delayMs: number, fnRef: any, args: any) => Promise<any> };
};

/** D-05's M, re-expressed under R-02 — 30 days in SECONDS, matching every
 * other `inbox` timestamp (every existing writer above uses
 * `Date.now() / 1000`, never milliseconds). A row this old with `closedAt`
 * still undefined is stale-open and gets stamped closed here, whether or
 * not a human ever acked it. */
export const INBOX_AUTOCLOSE_AGE_SEC = 30 * 24 * 60 * 60;

/** D-05/R-02's G — 14 days in SECONDS past `closedAt` before a row is
 * permanently deleted. */
export const INBOX_CLOSED_GRACE_SEC = 14 * 24 * 60 * 60;

/**
 * Matches `TRASH_PRUNE_BATCH_SIZE` by name and value (media.ts:638).
 * Re-derived against the REAL ceiling this deployment enforces, the way
 * media.ts:624-636 does: a `.take(INBOX_JANITOR_BATCH_SIZE)` read costs up
 * to 200 reads, plus up to 200 `ctx.db.patch()` (closing step) or
 * `ctx.db.delete()` (deleting step) calls in the loop below — `ctx.db.delete()`
 * counting as a read is PROVEN on this self-hosted instance (the literal
 * error text is transcribed at convex/graphSnapshots.ts:505); `ctx.db.patch()`
 * is not proven to, so it is budgeted conservatively as if it does too
 * (D-07's own instruction). 200 + 200 = ~400 reads/invocation against the
 * **4,096-read** ceiling this deployment has actually enforced — never the
 * 16,000/32,000 figures on Convex's published platform-limits page, which
 * are NOT what this self-hosted instance enforces (Phase 115 hit the real
 * ceiling at caps of 4000, 2000, 1000 AND 500, all failing identically,
 * because every one of those was still bisecting against the wrong
 * number).
 */
export const INBOX_JANITOR_BATCH_SIZE = 200;

/**
 * Mirrors `TRASH_PRUNE_MAX_BATCHES` (media.ts:649) — the per-invocation-
 * chain ceiling, CARRIED ACROSS the `"closing"` -> `"deleting"` transition
 * (never reset — see the chain handler in the next section), so a
 * pathological backlog cannot turn this janitor into an unbounded
 * self-rescheduling loop.
 */
export const INBOX_JANITOR_MAX_BATCHES = 100;

/**
 * Inter-batch delay in MILLISECONDS — `ctx.scheduler.runAfter` takes a
 * millisecond delay regardless of what units the table's own fields use.
 * Named `_MS` precisely so this is the one mixed-unit boundary in this
 * janitor: every other constant above is in seconds.
 */
export const INBOX_JANITOR_RESCHEDULE_MS = 3000;

/**
 * shouldAutoClose(row) — the auto-close step's carve-out predicate (D-03,
 * R-02). `held` items are excluded unconditionally, including rows a human
 * has already acked — this phase must never partially touch a table whose
 * read side Phase 126 owns (D-03, D-11). `money` items are excluded UNLESS
 * a human has already acked them: D-03's own words are that `money`
 * "blocks only *silent* closure. Once a human genuinely acks a money item
 * it is ordinary closed data and ages out on the normal grace window." A
 * bare `priority !== "money"` guard would leave every human-acked money row
 * without a `closedAt` forever — the permanently-undeletable treatment D-03
 * reserves for `held` alone.
 */
export function shouldAutoClose(row: {
  itemType: string;
  priority: string;
  ackedAt?: number;
}): boolean {
  if (row.itemType === "held") return false;
  return row.ackedAt != null || row.priority !== "money";
}

/**
 * shouldDeleteClosed(row) — the delete step's carve-out predicate. `held`
 * is excluded unconditionally, mirroring `shouldAutoClose` above (D-03,
 * D-11) — kept as an explicit second guard here rather than relying solely
 * on the invariant that a `held` row can never acquire a `closedAt` in the
 * first place, so the two steps stay independently correct even if one of
 * them is edited later.
 */
export function shouldDeleteClosed(row: { itemType: string }): boolean {
  return row.itemType !== "held";
}

/**
 * The auto-close step: stamps `closedAt` on rows that are either stale-open
 * (older than `INBOX_AUTOCLOSE_AGE_SEC`) or already acked by a human,
 * excluding `held` unconditionally and `money` unless acked (see
 * `shouldAutoClose` above).
 *
 * One query serves both populations R-02 names: a row a human already acked
 * and a row nobody ever touched are both `closedAt === undefined` (Convex
 * indexes an absent field under `undefined` — controlVerbSwaps.ts:105-109,
 * media.ts:733-736), so one `.eq("closedAt", undefined)` range read and one
 * `{ closedAt: nowSec }` patch handle both. An already-acked row younger
 * than 30d simply waits until it crosses the age bound — that is D-05's 44d
 * worst case, not a gap.
 *
 * Cursor-seeked on `createdAt` (the field this step's cutoff is keyed on),
 * via `partitionBatchForPrune`'s optional `cursorField` extractor
 * (retentionCursor.ts, plan 127-01) rather than off the raw batch's patched
 * rows — a batch of entirely carved-out rows (e.g. an all-`held` run) must
 * still advance the cursor, or the ~45 `held` rows at the head of the index
 * would re-block the same batch every run forever (D-08; `held` is 2.7% of
 * the unacked population, so an all-skipped batch is normal operation, not
 * an edge case).
 *
 * The patch object below names `closedAt` and NOTHING else — never
 * `ackedAt` (R-02). This is the single defect this whole revision exists to
 * prevent.
 */
async function runClosingStep(
  ctx: JanitorCtx,
  cursor: number,
  nowSec: number
): Promise<{ actedCount: number; batchLength: number; nextCursor: number }> {
  const cutoff = nowSec - INBOX_AUTOCLOSE_AGE_SEC;

  const batch: any[] = await ctx.db
    .query("inbox")
    .withIndex("by_closedAt", (q: any) =>
      q.eq("closedAt", undefined).gte("createdAt", cursor).lt("createdAt", cutoff)
    )
    .order("asc")
    .take(INBOX_JANITOR_BATCH_SIZE);

  const { toDelete: toClose, lastCursorValue } = partitionBatchForPrune<any>(
    batch,
    shouldAutoClose,
    (doc: any) => doc.createdAt
  );

  for (const row of toClose) {
    await ctx.db.patch(row._id, { closedAt: nowSec });
  }

  return {
    actedCount: toClose.length,
    batchLength: batch.length,
    nextCursor: lastCursorValue ?? cursor,
  };
}

/**
 * The delete step: permanently removes rows whose `closedAt` is more than
 * `INBOX_CLOSED_GRACE_SEC` in the past, excluding `held` unconditionally
 * (`shouldDeleteClosed` above).
 *
 * Reads the SAME `by_closedAt` index as the closing step, this time as a
 * range on `closedAt` itself: rows with `closedAt` absent are STRUCTURALLY
 * excluded from this range rather than merely filtered out of it — Convex's
 * index value ordering is `undefined < null < all other values`
 * (controlVerbSwaps.ts:105-109, independently re-derived at
 * media.ts:733-736), so an absent `closedAt` sorts below any real cursor. A
 * not-yet-closed row cannot be reached by this query even if every
 * post-query predicate in this file were deleted — a stronger guarantee
 * than the carve-out predicates, which have no database-level backstop.
 *
 * Cursor-seeked on `closedAt` via `partitionBatchForPrune`'s extractor,
 * falling back to `0` only for the type-total case of a row somehow lacking
 * `closedAt` inside `toDelete` — unreachable given the structural exclusion
 * above, but keeps the extractor defined for every input.
 */
async function runDeletingStep(
  ctx: JanitorCtx,
  cursor: number,
  nowSec: number
): Promise<{ actedCount: number; batchLength: number; nextCursor: number }> {
  const cutoff = nowSec - INBOX_CLOSED_GRACE_SEC;

  const batch: any[] = await ctx.db
    .query("inbox")
    .withIndex("by_closedAt", (q: any) => q.gte("closedAt", cursor).lt("closedAt", cutoff))
    .order("asc")
    .take(INBOX_JANITOR_BATCH_SIZE);

  const { toDelete, lastCursorValue } = partitionBatchForPrune<any>(
    batch,
    shouldDeleteClosed,
    (doc: any) => doc.closedAt ?? 0
  );

  for (const row of toDelete) {
    await ctx.db.delete(row._id);
  }

  return {
    actedCount: toDelete.length,
    batchLength: batch.length,
    nextCursor: lastCursorValue ?? cursor,
  };
}

/**
 * `autoCloseAndPruneHandler(ctx, args, nowSec)` — the two-step
 * self-rescheduling chain. Args default to
 * `{ step: "closing", cursor: 0, batchesDone: 0 }` when omitted, which is
 * the chain's first invocation (kicked off by the cron with `{}`).
 *
 * `batchesDone` is carried ACROSS the `"closing"` -> `"deleting"`
 * transition and NEVER reset — resetting it would give one chain
 * invocation a fresh full budget for its second step, doubling the worst
 * case with no cap governing it. Only `cursor` resets between steps,
 * because the two steps range over different fields (`createdAt` vs
 * `closedAt`).
 *
 * Every reschedule decision is ALSO gated on
 * `batchesDone + 1 < INBOX_JANITOR_MAX_BATCHES` — the batch already in
 * flight still completes, but the chain must not reschedule past its own
 * ceiling. This is media.ts:765-779's exact arithmetic (`batchWasFull &&
 * batchesUsedAfter < MAX`), applied to both steps and to the
 * closing-to-deleting transition alike.
 *
 * Logs UNCONDITIONALLY on every invocation, including a zero-work one —
 * deliberately unlike media.ts's `pruneTrashBatchHandler`, which logs only
 * when `deletedCount > 0`. R-01 makes the ran-and-matched-nothing line a
 * hard requirement for the sibling `ideation` janitor, and Verification F
 * reads `docker logs convex-backend` rather than either janitor's own
 * success line, so a silent invocation is invisible to the only instrument
 * that can see this failure mode.
 */
export async function autoCloseAndPruneHandler(
  ctx: JanitorCtx,
  args: { step?: "closing" | "deleting"; cursor?: number; batchesDone?: number },
  nowSec: number
): Promise<{
  step: "closing" | "deleting";
  actedCount: number;
  nextCursor: number;
  rescheduled: boolean;
}> {
  const step = args.step ?? "closing";
  const cursor = args.cursor ?? 0;
  const batchesDone = args.batchesDone ?? 0;

  // Entry guard, before any read — mirrors media.ts:720-725's
  // TRASH_PRUNE_MAX_BATCHES check. Refuses to do ANY work, not even read a
  // batch, once this chain has already used its per-chain ceiling.
  if (batchesDone >= INBOX_JANITOR_MAX_BATCHES) {
    console.log(
      `inbox: auto-close/prune per-chain batch cap (${INBOX_JANITOR_MAX_BATCHES}) already reached at step "${step}", cursor ${cursor}; remainder deferred to the next scheduled run`
    );
    return { step, actedCount: 0, nextCursor: cursor, rescheduled: false };
  }

  const result =
    step === "closing"
      ? await runClosingStep(ctx, cursor, nowSec)
      : await runDeletingStep(ctx, cursor, nowSec);

  const batchesUsedAfter = batchesDone + 1;
  const batchWasFull = result.batchLength >= INBOX_JANITOR_BATCH_SIZE;
  const underCap = batchesUsedAfter < INBOX_JANITOR_MAX_BATCHES;

  let rescheduled = false;
  let nextStep: "closing" | "deleting" = step;
  let nextCursor = result.nextCursor;

  if (step === "closing") {
    if (batchWasFull && underCap) {
      // More stale-open/already-acked rows may remain past this batch —
      // continue the closing step with the advanced cursor.
      rescheduled = true;
      nextStep = "closing";
    } else if (underCap) {
      // Short batch: the open set past the cutoff is drained (the query is
      // already range-bounded by cutoff, so every returned doc was
      // eligible). Move to the deleting step. Only the cursor resets here
      // — batchesDone carries forward unchanged (see docstring above).
      rescheduled = true;
      nextStep = "deleting";
      nextCursor = 0;
    }
    // else: this batch itself hit the per-chain ceiling — fall through to
    // rescheduled = false, deferring the remainder (including the deleting
    // step) to the next scheduled run, same as media.ts's own cap behavior.
  } else {
    // "deleting"
    if (batchWasFull && underCap) {
      rescheduled = true;
      nextStep = "deleting";
    }
    // A short deleting batch means the range is drained (already
    // cutoff-bounded) — the chain is fully done, nothing left to
    // reschedule for.
  }

  if (rescheduled) {
    await ctx.scheduler.runAfter(INBOX_JANITOR_RESCHEDULE_MS, internal.inbox.autoCloseAndPrune, {
      step: nextStep,
      cursor: nextCursor,
      batchesDone: batchesUsedAfter,
    });
  }

  console.log(
    `inbox: auto-close/prune step "${step}" acted on ${result.actedCount} row(s), next cursor ${result.nextCursor}, batches used ${batchesUsedAfter}/${INBOX_JANITOR_MAX_BATCHES}${rescheduled ? `, rescheduled to step "${nextStep}"` : ", chain complete"}`
  );

  return { step, actedCount: result.actedCount, nextCursor: result.nextCursor, rescheduled };
}

/**
 * `internalMutation`, same rationale as media.ts's `pruneTrashBatch`
 * (T-118-02, mirrored here as T-127-08): an irreversible permanent delete
 * with no UI control anywhere in this phase; only the cron
 * (`convex/crons.ts`, wired outside this plan's `files_modified`) may reach
 * it.
 */
export const autoCloseAndPrune = internalMutation({
  args: {
    step: v.optional(v.union(v.literal("closing"), v.literal("deleting"))),
    cursor: v.optional(v.float64()),
    batchesDone: v.optional(v.float64()),
  },
  handler: async (ctx, args) =>
    autoCloseAndPruneHandler(ctx as JanitorCtx, args, Date.now() / 1000),
});
