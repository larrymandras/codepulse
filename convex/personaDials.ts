/**
 * Phase 189 Plan 10 (DIAL-01) — personaDials Convex module.
 *
 * Per-profile, per-persona humor/candor dial values (D-20). Convex is the
 * single source of truth — both CodePulse (this module's mutations, called
 * directly from the UI) and Ástríðr (authed /persona-dials-ingest
 * httpAction) read/write the same `personaDials` table. Deliberately
 * departs from 185 D-02/D-16's clears-on-restart brain-swap semantics: a
 * dial is a preference, not a temporary swap state, and rebuilds here are
 * frequent enough that clearing it would make the feature useless. Scoped
 * to profileId AND personaId because other personas' tone stays locked per
 * 185 D-14 — the persona is part of the key, not an assumption.
 *
 * Business logic is extracted into plain exported "*Handler" functions
 * taking a minimal `{ db }` shape (reminders.ts precedent — convex-test is
 * not installed in this repo, see convex/runtimeIngest.test.ts:9), so
 * personaDialsIngest.test.ts can wire ctx.runMutation/ctx.runQuery to these
 * handlers against an in-memory fake db and exercise a REAL set-then-get
 * round trip, not just assert on mocked dispatch args.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Clamp a dial value to 0-100 SERVER-SIDE (T-189-45). The band thresholds
 * (>=90/>=60/>=30) live in astridr, but an out-of-range stored value would
 * make every band comparison meaningless, and the server is the only place
 * that cannot be bypassed by a caller.
 */
export function clampDial(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

/** Minimal ctx.db surface the handlers depend on — implemented for real by
 * Convex's ctx.db, and by an in-memory fake in personaDialsIngest.test.ts. */
interface PersonaDialsDb {
  insert: (table: string, doc: Record<string, unknown>) => Promise<any>;
  patch: (id: any, patch: Record<string, unknown>) => Promise<void>;
  query: (table: string) => {
    withIndex: (
      indexName: string,
      cb?: (q: { eq: (field: string, value: any) => any }) => any
    ) => { first: () => Promise<any> };
  };
}

export interface GetPersonaDialsArgs {
  profileId: string;
  personaId: string;
}

export async function getPersonaDialsHandler(
  ctx: { db: PersonaDialsDb } | any,
  args: GetPersonaDialsArgs
) {
  return await ctx.db
    .query("personaDials")
    .withIndex(
      "by_profile_persona",
      (q: { eq: (field: string, value: any) => any }) =>
        q.eq("profileId", args.profileId).eq("personaId", args.personaId)
    )
    .first();
}

export const get = query({
  args: { profileId: v.string(), personaId: v.string() },
  handler: async (ctx, args) => getPersonaDialsHandler(ctx, args),
});

export interface SetPersonaDialsArgs {
  profileId: string;
  personaId: string;
  humor: number;
  candor: number;
}

/**
 * Upserts by the by_profile_persona index. Clamps humor/candor to 0-100
 * before storing (T-189-45) regardless of what the caller sent.
 */
export async function setPersonaDialsHandler(
  ctx: { db: PersonaDialsDb } | any,
  args: SetPersonaDialsArgs,
  now: number
) {
  const humor = clampDial(args.humor);
  const candor = clampDial(args.candor);
  const existing = await getPersonaDialsHandler(ctx, args);
  if (existing) {
    await ctx.db.patch(existing._id, { humor, candor, updatedAt: now });
    return { ...existing, humor, candor, updatedAt: now };
  }
  const id = await ctx.db.insert("personaDials", {
    profileId: args.profileId,
    personaId: args.personaId,
    humor,
    candor,
    updatedAt: now,
  });
  return {
    _id: id,
    profileId: args.profileId,
    personaId: args.personaId,
    humor,
    candor,
    updatedAt: now,
  };
}

export const set = mutation({
  args: {
    profileId: v.string(),
    personaId: v.string(),
    humor: v.float64(),
    candor: v.float64(),
  },
  handler: async (ctx, args) =>
    setPersonaDialsHandler(ctx, args, Date.now() / 1000),
});
