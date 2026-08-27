import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

// ============================================================
// MESSAGE ROUTES — Phase 112 (TELE-03, D-13)
// ============================================================
//
// The message_routed audit trail. astridr emits one message_routed event
// per routed message, carrying channel/profile/sender/session_id.
//
// D-13 HISTORY — this kind was ROUTED but deliberately NOT surfaced in the
// UI during Phase 112: 112-UI-SPEC.md designed the governor_decision
// surface only, and message_routed's channel/sender/session routing
// metadata needed its own design pass rather than a reskin. That recorded
// follow-up is now CLOSED. `channelSummary` below backs the "Message
// Routing" section on /settings (src/components/MessageRoutingSummary.tsx),
// mounted beside GovernorDecisionLog.
//
// The design pass D-13 asked for produced an AGGREGATE surface, not the
// row table the governor_decision axis got, and that difference is the
// whole point of having waited. Measured live 2026-08-26 over the full
// 13-day table: 53 rows, ONE profile (`personal`), TWO channels (telegram
// 51, whatsapp 2), TWO senders (one per channel), 16 distinct sessions. A
// last-50 row table over that data renders fifty near-identical
// telegram/personal/Larry lines — it varies on nothing a reader is looking
// at — which is precisely the reskin D-13 refused. Channel mix and volume
// over time are what this data actually varies on.
//
// MESSAGE_ROUTE_CAP is declared and exported IN THIS FILE, not split into a
// separate filters module the way governorDecisionsFilters.ts is — per
// 112-PATTERNS.md seam 3 the split exists only when a browser file needs
// the constant. It still does not: the surface added for D-13 reads
// `channelSummary`, whose payload carries `windowDays` and `atCap` as DATA
// precisely so no browser file has to import a constant from this module.
// Importing from here would drag the Convex server runtime into the client
// bundle (the documented 108-06 defect). A messageRoutesFilters.ts with
// zero importers would still be cargo-culting the pattern rather than
// applying its rule.

/** Row cap for the message-route read. 50 mirrors governorDecisions'
 * GOVERNOR_DECISION_CAP sizing rationale for a full-width page section. */
export const MESSAGE_ROUTE_CAP = 50;

/** Window, in days, aggregated by `channelSummary`. 14 sits inside the
 * table's 90-day retention tier (retention.ts:184) and inside the data's
 * own extent (oldest row 2026-08-13 when the surface was built). */
export const MESSAGE_ROUTE_SUMMARY_WINDOW_DAYS = 14;

/** Row cap for the `channelSummary` window read.
 *
 * Sized as headroom, NOT as a display limit: the window held 53 rows at
 * ~4/day when this was written, so 2000 absorbs a ~35x volume spike before
 * it binds. It exists because a date range alone bounds the SCAN but not
 * the ROW COUNT — an unbounded `.collect()` inside a range is still an
 * unbounded read if the range fills up. When it does bind, the payload's
 * `atCap` flag says so on screen rather than truncating silently. */
export const MESSAGE_ROUTE_SUMMARY_CAP = 2000;

/** Clock-skew allowance on the window's UPPER bound, in seconds.
 *
 * `runtimeIngest.ts:630` takes an event's timestamp straight from the payload
 * (`evt.timestamp ?? now`) behind nothing stronger than `v.float64()`, so a
 * row can arrive stamped in the future or in epoch MILLISECONDS — the
 * seconds/millis confusion this repo already has a standing lesson about. On a
 * DESCENDING scan with only a lower bound, such a row sorts ahead of every
 * real row and never falls out of the window, so it occupies the top of the
 * read permanently, inflates the totals and clamps into the newest daily
 * bucket; enough of them evict all real activity from the cap.
 *
 * One hour matches `events.ts:88`'s `nowSec + 3600`, whose comment states the
 * same purpose verbatim: "Upper bound excludes any future/ms-scale junk rows."
 * It is deliberately nonzero — a row stamped a few seconds ahead by a skewed
 * emitter clock is legitimate traffic, not junk. */
export const MESSAGE_ROUTE_CLOCK_SKEW_SECONDS = 3600;

const SECONDS_PER_DAY = 86400;

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
 * NOT dead code, and NOT superseded by `channelSummary`: this is the
 * read-only probe plan 07's live post-deploy verification calls against
 * this table. The D-13 surface deliberately reads the aggregate instead,
 * so this query keeps exactly one caller and one purpose. Do not delete it
 * as unused.
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

/**
 * channelSummary — Aggregate of the last MESSAGE_ROUTE_SUMMARY_WINDOW_DAYS
 * days of routed messages: channel mix, per-day volume, and the profile /
 * session / sender cardinality behind it. Backs the "Message Routing"
 * section on /settings (D-13's closed follow-up).
 *
 * BOUNDED AT THE INDEX. The window is pushed into `by_timestamp` as a range
 * bound, never applied as a post-read `.filter()`. In Convex `.filter()`
 * runs on rows ALREADY READ, so the `withIndex("by_timestamp")` +
 * `.filter(q => q.gte(...))` + `.collect()` shape reads the WHOLE table and
 * discards rows in JS — the live defect fixed in `automation.cronSummary`
 * and still open at `briefings.ts:181-190`. Guarded by
 * `messageRoutesBounded.test.ts`, which asserts on the RECORDED QUERY
 * (index used, range bound present, no post-read filter) rather than on
 * these aggregates: a surviving unbounded read returns identical numbers on
 * a small fixture, so the numbers cannot discriminate.
 *
 * Aggregation happens SERVER-SIDE so the payload stays a few hundred bytes
 * regardless of how many rows the window holds.
 *
 * `senders` ships RAW. Masking is a client concern here, exactly as it is
 * at every other `mask*(value, enabled)` call site in this repo — the
 * surface masks through PrivacyContext (`src/lib/privacy.ts`'s
 * `maskHandle`), so the server has no privacy-mode state to consult and
 * must not pre-redact a value the operator may have chosen to see.
 *
 * `windowDays` and `atCap` are returned as DATA rather than imported by the
 * component, so no browser file has to import from this server module. See
 * the header comment.
 */
export const channelSummary = query({
  args: {},
  handler: async (ctx) => {
    // `messageRoutes.timestamp` is epoch SECONDS (schema.ts:2337), not
    // millis. Dividing Date.now() here — rather than comparing raw millis —
    // is what keeps the cutoff in the same unit as the column; a millis
    // cutoff would land in 1970 and match every row, i.e. an unbounded read
    // wearing a bound.
    const nowSec = Date.now() / 1000;
    const windowSeconds = MESSAGE_ROUTE_SUMMARY_WINDOW_DAYS * SECONDS_PER_DAY;
    const since = nowSec - windowSeconds;
    // Both bounds are complementary, never alternatives: the lower one sets
    // the window, the upper one excludes future/ms-scale junk that would
    // otherwise sit at the top of this descending scan forever. See
    // MESSAGE_ROUTE_CLOCK_SKEW_SECONDS.
    const until = nowSec + MESSAGE_ROUTE_CLOCK_SKEW_SECONDS;

    const rows = await ctx.db
      .query("messageRoutes")
      .withIndex("by_timestamp", (q) =>
        q.gte("timestamp", since).lte("timestamp", until)
      )
      .order("desc")
      .take(MESSAGE_ROUTE_SUMMARY_CAP);

    const byChannel = new Map<string, { count: number; senders: Set<string> }>();
    const profiles = new Set<string>();
    const sessions = new Set<string>();
    const daily = new Array<number>(MESSAGE_ROUTE_SUMMARY_WINDOW_DAYS).fill(0);

    for (const row of rows) {
      let entry = byChannel.get(row.channel);
      if (!entry) {
        entry = { count: 0, senders: new Set<string>() };
        byChannel.set(row.channel, entry);
      }
      entry.count++;
      if (row.sender) entry.senders.add(row.sender);

      profiles.add(row.profile);
      if (row.sessionId) sessions.add(row.sessionId);

      // Rolling 24h buckets measured forward from the cutoff, oldest first.
      // Clamped because a row on the exact boundary (or a clock skew of a
      // few ms between the cutoff and the read) can compute -1 or
      // WINDOW_DAYS and would otherwise write outside the array.
      const bucket = Math.floor((row.timestamp - since) / SECONDS_PER_DAY);
      const clamped = Math.min(
        MESSAGE_ROUTE_SUMMARY_WINDOW_DAYS - 1,
        Math.max(0, bucket)
      );
      daily[clamped]++;
    }

    const channels = [...byChannel.entries()]
      .map(([channel, entry]) => ({
        channel,
        count: entry.count,
        // Sorted so the rendered order is stable across subscription
        // updates — Set iteration order is insertion order, which for this
        // query means "whichever sender happened to message most recently".
        senders: [...entry.senders].sort(),
      }))
      // Busiest channel first; ties broken by name so the order never
      // flickers between two equally-busy channels.
      .sort((a, b) => b.count - a.count || a.channel.localeCompare(b.channel));

    return {
      windowDays: MESSAGE_ROUTE_SUMMARY_WINDOW_DAYS,
      since,
      total: rows.length,
      atCap: rows.length >= MESSAGE_ROUTE_SUMMARY_CAP,
      channels,
      profiles: [...profiles].sort(),
      sessionCount: sessions.size,
      daily,
    };
  },
});
