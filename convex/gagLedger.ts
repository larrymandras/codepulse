/**
 * Phase 189 Plan 10 (DIAL-01) — gagLedger Convex module.
 *
 * Propose/confirm running-gag callback ledger (D-21). Entries are created
 * from an explicit signal — Larry saying so, or a post-turn extraction
 * filing a candidate he confirms — never the model unilaterally deciding
 * what's funny about him. D-21 is enforced HERE, server-side, not in the
 * caller: `propose` can only ever create a "proposed" row, and `source` is
 * hardcoded "astridr" (see gagLedgerIngest.ts). A caller that could
 * self-confirm would make the ledger self-inventing, which is precisely
 * what D-21 rejects.
 *
 * Business logic is extracted into plain exported "*Handler" functions
 * taking a minimal `{ db }` shape (reminders.ts precedent — convex-test is
 * not installed in this repo, see convex/runtimeIngest.test.ts:9), so
 * gagLedgerIngest.test.ts can wire ctx.runMutation/ctx.runQuery to these
 * handlers against an in-memory fake db and exercise real propose/confirm/
 * eligible/markUsed round trips, not just assert on mocked dispatch args.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/** Minimal ctx.db surface the handlers depend on — implemented for real by
 * Convex's ctx.db, and by an in-memory fake in gagLedgerIngest.test.ts. */
interface GagLedgerDb {
  insert: (table: string, doc: Record<string, unknown>) => Promise<any>;
  get: (id: any) => Promise<any>;
  patch: (id: any, patch: Record<string, unknown>) => Promise<void>;
  query: (table: string) => {
    withIndex: (
      indexName: string,
      cb?: (q: { eq: (field: string, value: any) => any }) => any
    ) => { collect: () => Promise<any[]> };
  };
}

// ---------------------------------------------------------------------------
// propose — always creates a "proposed" row, source hardcoded "astridr"
// ---------------------------------------------------------------------------

export interface ProposeGagArgs {
  profileId: string;
  text: string;
}

export async function proposeGagHandler(
  ctx: { db: GagLedgerDb } | any,
  args: ProposeGagArgs,
  now: number
) {
  // D-21/T-189-44: this insert hardcodes status "proposed" and source
  // "astridr" unconditionally — there is NO parameter here that lets a
  // caller pass a different status or source through to storage, no matter
  // what the caller's request body contains. See gagLedgerIngest.ts for the
  // enforcement at the HTTP boundary (any body.status/body.source is simply
  // never read).
  const id = await ctx.db.insert("gagLedger", {
    profileId: args.profileId,
    text: args.text,
    status: "proposed",
    source: "astridr",
    proposedAt: now,
    useCount: 0,
  });
  return { _id: id, profileId: args.profileId, text: args.text, status: "proposed", source: "astridr", proposedAt: now, useCount: 0 };
}

export const propose = mutation({
  args: { profileId: v.string(), text: v.string() },
  handler: async (ctx, args) => proposeGagHandler(ctx, args, Date.now() / 1000),
});

// ---------------------------------------------------------------------------
// confirm — proposed -> confirmed; no-op on already-confirmed or retired
// ---------------------------------------------------------------------------

export async function confirmGagHandler(
  ctx: { db: GagLedgerDb } | any,
  id: any,
  now: number
) {
  const existing = await ctx.db.get(id);
  if (!existing || existing.status !== "proposed") return existing ?? null;
  await ctx.db.patch(id, { status: "confirmed", confirmedAt: now });
  return { ...existing, status: "confirmed", confirmedAt: now };
}

export const confirm = mutation({
  args: { id: v.id("gagLedger") },
  handler: async (ctx, { id }) => confirmGagHandler(ctx, id, Date.now() / 1000),
});

// ---------------------------------------------------------------------------
// retire — any status -> retired; a retired entry is never eligible again
// ---------------------------------------------------------------------------

export async function retireGagHandler(
  ctx: { db: GagLedgerDb } | any,
  id: any,
  now: number
) {
  const existing = await ctx.db.get(id);
  if (!existing || existing.status === "retired") return existing ?? null;
  await ctx.db.patch(id, { status: "retired", retiredAt: now });
  return { ...existing, status: "retired", retiredAt: now };
}

export const retire = mutation({
  args: { id: v.id("gagLedger") },
  handler: async (ctx, { id }) => retireGagHandler(ctx, id, Date.now() / 1000),
});

// ---------------------------------------------------------------------------
// list — every entry for a profile, any status (dashboard rendering)
// ---------------------------------------------------------------------------

export async function listGagsHandler(
  ctx: { db: GagLedgerDb } | any,
  profileId: string
) {
  return await ctx.db
    .query("gagLedger")
    .withIndex(
      "by_profile_status",
      (q: { eq: (field: string, value: any) => any }) => q.eq("profileId", profileId)
    )
    .collect();
}

export const list = query({
  args: { profileId: v.string() },
  handler: async (ctx, { profileId }) => listGagsHandler(ctx, profileId),
});

// ---------------------------------------------------------------------------
// eligible — confirmed, cool (not used within cooldownSeconds), and fresh
// (proposed within stalenessSeconds). Reads through by_last_used, never a
// full .collect() + JS filter (T-189-46) — bound: one profile's row set.
// ---------------------------------------------------------------------------

export interface EligibleGagsArgs {
  profileId: string;
  cooldownSeconds: number;
  stalenessSeconds: number;
}

export async function eligibleGagsHandler(
  ctx: { db: GagLedgerDb } | any,
  args: EligibleGagsArgs,
  now: number
) {
  // .collect() here is bound by the by_last_used index to exactly this
  // profile's rows (T-189-46) — it is not an unbounded table scan. The
  // status/staleness/cooldown filtering below runs in JS over that
  // already-bounded set, which Convex query indexes require for anything
  // beyond a simple equality/range prefix.
  const rows = await ctx.db
    .query("gagLedger")
    .withIndex(
      "by_last_used",
      (q: { eq: (field: string, value: any) => any }) => q.eq("profileId", args.profileId)
    )
    .collect();

  return rows.filter((row: any) => {
    if (row.status !== "confirmed") return false;
    if (row.proposedAt <= now - args.stalenessSeconds) return false;
    if (row.lastUsedAt !== undefined && row.lastUsedAt >= now - args.cooldownSeconds) {
      return false;
    }
    return true;
  });
}

export const eligible = query({
  args: {
    profileId: v.string(),
    cooldownSeconds: v.float64(),
    stalenessSeconds: v.float64(),
  },
  handler: async (ctx, args) => eligibleGagsHandler(ctx, args, Date.now() / 1000),
});

// ---------------------------------------------------------------------------
// markUsed — stamp lastUsedAt, increment useCount
// ---------------------------------------------------------------------------

export async function markUsedGagHandler(
  ctx: { db: GagLedgerDb } | any,
  id: any,
  now: number
) {
  const existing = await ctx.db.get(id);
  if (!existing) return null;
  const useCount = (existing.useCount ?? 0) + 1;
  await ctx.db.patch(id, { lastUsedAt: now, useCount });
  return { ...existing, lastUsedAt: now, useCount };
}

export const markUsed = mutation({
  args: { id: v.id("gagLedger") },
  handler: async (ctx, { id }) => markUsedGagHandler(ctx, id, Date.now() / 1000),
});
