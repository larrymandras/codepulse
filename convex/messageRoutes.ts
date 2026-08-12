import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

// ============================================================
// MESSAGE ROUTES — Phase 112 (TELE-03, D-13)
// ============================================================
//
// The message_routed audit trail. astridr emits one message_routed event
// per routed message, carrying channel/profile/sender/session_id. D-13:
// this kind is ROUTED but deliberately NOT surfaced in the UI this phase —
// the UI is a recorded follow-up, not an ambiguity, because 112-UI-SPEC.md
// designed the governor_decision surface only and message_routed's
// channel/sender/session routing metadata needs its own design pass rather
// than a reskin.
//
// MESSAGE_ROUTE_CAP is declared and exported IN THIS FILE, not split into a
// separate filters module the way governorDecisionsFilters.ts is — per
// 112-PATTERNS.md seam 3 the split exists only when a browser file needs
// the constant, and message_routed has no UI this phase. A
// messageRoutesFilters.ts with zero importers would be cargo-culting the
// pattern rather than applying its rule.

/** Row cap for the message-route read. 50 mirrors governorDecisions'
 * GOVERNOR_DECISION_CAP sizing rationale for a full-width page section,
 * even though no page reads this yet — sized once so a future surface does
 * not have to choose it under pressure. */
export const MESSAGE_ROUTE_CAP = 50;

/**
 * record — Append-only insert of one message_routed row. Never patches or
 * deletes an existing row.
 *
 * D-13: this mutation is the ONLY write path for the message-route axis,
 * and it is reachable ONLY from the astridr `message_routed` telemetry
 * ingest case (convex/runtimeIngest.ts, plan 112-04). The UI must NEVER
 * call this directly to assert a message was routed.
 *
 * ENFORCED (CR-01 rule, same as governorDecisions.ts's record): declared
 * as an `internalMutation`, so it does not exist in the client-callable
 * `api.` namespace at all. This closes the devtools-forgeable write path a
 * plain `mutation` would leave open — any holder of the shipped
 * VITE_CONVEX_URL could otherwise call `api.messageRoutes.record` directly
 * and insert a fabricated "server-confirmed" routed-message row.
 */
export const record = internalMutation({
  args: {
    channel: v.string(),
    profile: v.string(),
    sender: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("messageRoutes", { ...args });
  },
});

/**
 * listRecent — Returns the most recent message-route rows, newest first,
 * bounded by MESSAGE_ROUTE_CAP over the by_timestamp index — never an
 * unbounded collect on this append-only table (T-112-02).
 *
 * NOT dead code despite D-13's no-UI decision: this is the read-only probe
 * plan 07's live post-deploy verification calls against this table, and it
 * is the read a future D-13 surface will build on. Do not delete it as
 * unused.
 */
export const listRecent = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("messageRoutes")
      .withIndex("by_timestamp")
      .order("desc")
      .take(MESSAGE_ROUTE_CAP);
  },
});
