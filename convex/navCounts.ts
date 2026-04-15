import { query } from "./_generated/server";

/**
 * Server-side aggregated navigation counts (CPHLTH-04).
 *
 * Replaces potential N individual client-side subscriptions with a single
 * reactive query. Uses .withIndex() where indexes are available for
 * efficient counting.
 */
export const navCounts = query({
  args: {},
  handler: async (ctx) => {
    const [unacknowledgedAlerts, unreadNotifications] = await Promise.all([
      ctx.db
        .query("alerts")
        .withIndex("by_acknowledged", (q) => q.eq("acknowledged", false))
        .collect(),
      ctx.db
        .query("notifications")
        .withIndex("by_type_read", (q) => q.eq("type", "bell").eq("read", false))
        .collect(),
    ]);

    return {
      alerts: unacknowledgedAlerts.length,
      notifications: unreadNotifications.length,
    };
  },
});
