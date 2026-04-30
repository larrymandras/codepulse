import { query } from "./_generated/server";

export const navCounts = query({
  args: {},
  handler: async (ctx) => {
    const [unacknowledgedAlerts, unreadNotifications, pendingInbox, allTasks] =
      await Promise.all([
        ctx.db
          .query("alerts")
          .withIndex("by_acknowledged", (q) => q.eq("acknowledged", false))
          .collect(),
        ctx.db
          .query("notifications")
          .withIndex("by_type_read", (q) =>
            q.eq("type", "bell").eq("read", false)
          )
          .collect(),
        ctx.db
          .query("approvalQueue")
          .withIndex("by_status", (q) => q.eq("status", "pending"))
          .collect(),
        ctx.db.query("tasks").collect(),
      ]);

    return {
      alerts: unacknowledgedAlerts.length,
      notifications: unreadNotifications.length,
      inbox: pendingInbox.length,
      tasks: allTasks.filter((t) => t.column !== "done").length,
    };
  },
});
