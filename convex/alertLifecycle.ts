import { mutation } from "./_generated/server";
import { v } from "convex/values";

// ============================================================
// ALERT LIFECYCLE MUTATIONS (D-09, D-11)
// ============================================================

export const acknowledgeAlert = mutation({
  args: {
    alertId: v.id("alerts"),
    acknowledgedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.alertId, {
      status: "acknowledged",
      acknowledged: true,
      acknowledgedBy: args.acknowledgedBy ?? "operator",
      acknowledgedAt: Date.now() / 1000,
    });
  },
});

export const resolveAlert = mutation({
  args: {
    alertId: v.id("alerts"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.alertId, {
      status: "resolved",
      resolvedAt: Date.now() / 1000,
    });
  },
});

// Maps alert severity to task priority
function severityToPriority(severity: string): string {
  switch (severity) {
    case "critical":
      return "urgent";
    case "error":
      return "high";
    case "warning":
      return "medium";
    case "info":
    default:
      return "low";
  }
}

export const escalateToTask = mutation({
  args: {
    alertId: v.id("alerts"),
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const alert = await ctx.db.get(args.alertId);
    if (!alert) {
      throw new Error(`Alert ${args.alertId} not found`);
    }

    const priority = args.priority ?? severityToPriority(alert.severity);
    const now = Date.now() / 1000;

    const taskDocId = await ctx.db.insert("tasks", {
      taskId: crypto.randomUUID(),
      title: args.title,
      description: args.description,
      priority,
      column: "backlog",
      columnEnteredAt: now,
      createdAt: now,
      alertId: args.alertId,
    });

    await ctx.db.patch(args.alertId, {
      linkedTaskId: taskDocId,
    });

    return taskDocId;
  },
});
