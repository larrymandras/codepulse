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
  createdAt?: number;
}

/**
 * raise(): inserts an inbox row unconditionally. The governor sets
 * itemType="held" + heldReason for suppressed events and passes intentId
 * inline for high-priority deliveries (D-10). There is no setIntentId/update
 * op — intentId is only ever written at raise time.
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
    createdAt: args.createdAt ?? now,
    ackedAt: undefined,
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
    createdAt: v.optional(v.float64()),
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
