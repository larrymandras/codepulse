import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Phase 197 (MISSION-05) — the Convex receiving end of the mission projection.
 *
 * D-01 makes Convex the board's data plane: Ástríðr PUSHES here over
 * `/runtime-ingest`; nothing on this side reads Ástríðr's Postgres and no
 * `supabase_realtime` publication exists. D-02 keeps what lands here a
 * PROJECTION, not a mirror — the schema itself is the enforcement, because a
 * Convex mutation's argument validator REJECTS an unexpected key rather than
 * storing it. `convex/schema.ts`'s missionRuns/missionRunEvents header records
 * the six Postgres columns that must never appear.
 *
 * READ POSTURE (D-05): `byId` / `listRecent` / `eventsForMission` are plain
 * `query()` with no `ctx.auth` gate, matching `subagentJobs.ts`. Per this
 * repo's CLAUDE.md the tailnet — not Clerk — is the auth boundary, so
 * everything readable here is readable by anything that can route to the host.
 * D-05 accepts that ONLY because D-02 keeps the mission brief and both result
 * JSONs out of the projection entirely. If any later change proposes pushing
 * `brief`, `draft_result` or `execute_result`, D-05 must be reopened IN THAT
 * SAME CHANGE, not after it.
 *
 * BOUNDED READS: every query here caps with `.take(...)`. There is no
 * `.collect()` in this file — that is the unbounded-read defect this repo's
 * CLAUDE.md records live at `automation.cronSummary`, and a projection table
 * grows without bound.
 *
 * Timestamps are epoch SECONDS throughout (matching subagentJobs and
 * docs/astridr-contract.md), never milliseconds.
 */

/** Newest-first page size for the board's mission list when the caller does
 * not ask for one. Exported so a test asserts the real default rather than a
 * hand-copied literal. */
export const DEFAULT_RECENT_LIMIT = 50;

/** Per-mission event page size default, same rationale as above. */
export const DEFAULT_EVENTS_LIMIT = 200;

/**
 * upsert — insert-or-patch one `missionRuns` row, keyed on `missionId`.
 *
 * Convex has no native upsert, so this is the query-then-patch-or-insert idiom
 * from `subagentJobs.ts` / `swarmTasks.ts`.
 *
 * PARTIAL PUSHES ARE NORMAL: D-20's token ticks push only
 * `{missionId, status, missionClass, promptTokens, ...}` mid-flight, and the
 * terminal push carries the cost. So every optional field coalesces to the
 * EXISTING value on patch — an absent arg must never null a field that was
 * already populated, or a mid-flight token tick would erase the containment
 * verdict a prior push recorded.
 *
 * `updatedAt` is deliberately NOT an argument: it is set server-side on every
 * write so it always means "when Convex last heard from this mission", which
 * is the only thing the board can honestly claim about it. Same posture as
 * `subagentJobs.upsert`.
 */
export const upsert = mutation({
  args: {
    missionId: v.string(),
    status: v.string(),
    missionClass: v.string(),
    startedAt: v.optional(v.float64()),
    finishedAt: v.optional(v.float64()),
    totalCostUsd: v.optional(v.float64()),
    promptTokens: v.optional(v.float64()),
    completionTokens: v.optional(v.float64()),
    cachedTokens: v.optional(v.float64()),
    contained: v.optional(v.boolean()),
    aborted: v.optional(v.boolean()),
    abortTool: v.optional(v.string()),
    offeredEscapes: v.optional(v.array(v.string())),
    voidReason: v.optional(v.string()),
    lastEventAt: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const now = Date.now() / 1000; // seconds-epoch, matching the contract

    const existing = await ctx.db
      .query("missionRuns")
      .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        missionClass: args.missionClass,
        startedAt: args.startedAt ?? existing.startedAt,
        finishedAt: args.finishedAt ?? existing.finishedAt,
        totalCostUsd: args.totalCostUsd ?? existing.totalCostUsd,
        promptTokens: args.promptTokens ?? existing.promptTokens,
        completionTokens: args.completionTokens ?? existing.completionTokens,
        cachedTokens: args.cachedTokens ?? existing.cachedTokens,
        // `?? existing` and not `??` on a plain boolean by accident: `false`
        // is a REAL containment verdict (ESCAPED) and `??` only falls through
        // on null/undefined, so an explicit `false` correctly overwrites a
        // prior `true`. Absent still means VOID and preserves what was there.
        contained: args.contained ?? existing.contained,
        aborted: args.aborted ?? existing.aborted,
        abortTool: args.abortTool ?? existing.abortTool,
        offeredEscapes: args.offeredEscapes ?? existing.offeredEscapes,
        voidReason: args.voidReason ?? existing.voidReason,
        lastEventAt: args.lastEventAt ?? existing.lastEventAt,
        updatedAt: now,
      });
      return;
    }

    await ctx.db.insert("missionRuns", {
      missionId: args.missionId,
      status: args.status,
      missionClass: args.missionClass,
      startedAt: args.startedAt,
      finishedAt: args.finishedAt,
      totalCostUsd: args.totalCostUsd,
      promptTokens: args.promptTokens,
      completionTokens: args.completionTokens,
      cachedTokens: args.cachedTokens,
      contained: args.contained,
      aborted: args.aborted,
      abortTool: args.abortTool,
      offeredEscapes: args.offeredEscapes,
      voidReason: args.voidReason,
      lastEventAt: args.lastEventAt,
      updatedAt: now,
    });
  },
});

/**
 * appendEvent — INSERT-OR-IGNORE one `missionRunEvents` row on the event
 * identity `(missionId, seq)`. Never a plain `ctx.db.insert`.
 *
 * Why this is not optional: `astridr/engine/telemetry.py:508-556` re-POSTs the
 * IDENTICAL payload on any `status_code >= 500` and on
 * `httpx.TimeoutException`/`ConnectError`, and a timeout is AMBIGUOUS — Convex
 * may well have committed before the response was lost. Postgres is idempotent
 * here BY CONSTRAINT (`UNIQUE (mission_id, seq)`,
 * `supabase/migrations/20260824210500_create_missions.sql:71`); Convex has no
 * unique constraint, so a plain insert is not. Without this lookup one retry
 * produces board events that do not exist in Postgres, which inverts D-06's
 * "the DB is the single authority" invariant. "Append-only" describes the
 * ACCESS PATTERN, not the delivery guarantee.
 *
 * On a repeat the row is returned untouched — NOT re-patched. A retried event
 * is byte-identical by construction, so rewriting it could only introduce
 * drift.
 *
 * `lastEventAt` on the parent row moves ONLY on a genuine insert, so a
 * delivery retry cannot make a stalled mission look alive. It is set to the
 * event's own `occurredAt` rather than `max(existing, occurredAt)` because the
 * emitter is a single ordered writer per mission; if out-of-order delivery is
 * ever observed, that is the place to add the monotonic guard.
 */
export const appendEvent = mutation({
  args: {
    missionId: v.string(),
    seq: v.float64(),
    eventType: v.string(),
    occurredAt: v.float64(),
    contained: v.optional(v.boolean()),
    aborted: v.optional(v.boolean()),
    abortTool: v.optional(v.string()),
    offeredEscapes: v.optional(v.array(v.string())),
    toolNames: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const duplicate = await ctx.db
      .query("missionRunEvents")
      .withIndex("by_missionId_seq", (q) =>
        q.eq("missionId", args.missionId).eq("seq", args.seq)
      )
      .first();

    if (duplicate) {
      // Idempotent no-op: no insert, no patch, and no lastEventAt movement.
      return;
    }

    await ctx.db.insert("missionRunEvents", {
      missionId: args.missionId,
      seq: args.seq,
      eventType: args.eventType,
      occurredAt: args.occurredAt,
      contained: args.contained,
      aborted: args.aborted,
      abortTool: args.abortTool,
      offeredEscapes: args.offeredEscapes,
      toolNames: args.toolNames,
    });

    const parent = await ctx.db
      .query("missionRuns")
      .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
      .first();

    if (parent) {
      await ctx.db.patch(parent._id, { lastEventAt: args.occurredAt });
    }
  },
});

/** byId — the single mission row for `missionId`, or null. */
export const byId = query({
  args: { missionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("missionRuns")
      .withIndex("by_missionId", (q) => q.eq("missionId", args.missionId))
      .first();
  },
});

/**
 * listRecent — the newest `limit` mission rows.
 *
 * Deliberately NOT `withIndex("by_status", ...)`: there is no status filter
 * here, and `withIndex` with no range callback plus a post-read `.filter()`
 * reads the WHOLE table and discards rows in JS (this repo's CLAUDE.md records
 * that exact defect live at `automation.cronSummary`). A plain descending scan
 * capped by `.take()` reads at most `limit` documents.
 *
 * `.order("desc")` here is by `_creationTime`, i.e. when the row FIRST landed
 * in Convex — stable per mission across every later token tick, which is what
 * a board wants. Do NOT `.collect()` and slice in JS.
 */
export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("missionRuns")
      .order("desc")
      .take(args.limit ?? DEFAULT_RECENT_LIMIT);
  },
});

/**
 * eventsForMission — one mission's events in seq order, bounded by `.take()`.
 * The bound is pushed INTO the index (`by_missionId_seq` prefixed on
 * `missionId`), not applied as a post-read `.filter()`.
 */
export const eventsForMission = query({
  args: { missionId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("missionRunEvents")
      .withIndex("by_missionId_seq", (q) => q.eq("missionId", args.missionId))
      .take(args.limit ?? DEFAULT_EVENTS_LIMIT);
  },
});
