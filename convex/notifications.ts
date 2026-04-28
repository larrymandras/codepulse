import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

interface NotificationInput {
  severity: string;
  category: string;
  title: string;
  message: string;
}

interface ClassifiedNotification {
  type: "toast" | "bell" | "alert";
  category: string;
  title: string;
  message: string;
  severity: string;
  expiresAt?: number;
}

export function classifyNotification(input: NotificationInput): ClassifiedNotification {
  const now = Date.now() / 1000;

  if (input.severity === "critical" || input.severity === "error") {
    return {
      type: "alert",
      category: input.category,
      title: input.title,
      message: input.message,
      severity: input.severity,
    };
  }

  if (input.severity === "warning") {
    return {
      type: "bell",
      category: input.category,
      title: input.title,
      message: input.message,
      severity: input.severity,
      expiresAt: now + 7 * 86400,
    };
  }

  return {
    type: "toast",
    category: input.category,
    title: input.title,
    message: input.message,
    severity: input.severity,
    expiresAt: now + 3600,
  };
}

export const create = mutation({
  args: {
    type: v.string(),
    category: v.string(),
    title: v.string(),
    message: v.string(),
    severity: v.string(),
    expiresAt: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    await ctx.db.insert("notifications", {
      type: args.type,
      category: args.category,
      title: args.title,
      message: args.message,
      severity: args.severity,
      read: false,
      createdAt: Date.now() / 1000,
      expiresAt: args.expiresAt,
    });
  },
});

export const bellUnread = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("notifications")
      .withIndex("by_type_read", (q) => q.eq("type", "bell").eq("read", false))
      .order("desc")
      .take(20);
  },
});

export const bellAll = query({
  args: {},
  handler: async (ctx) => {
    const results = await ctx.db
      .query("notifications")
      .withIndex("by_created")
      .order("desc")
      .take(100);
    return results.filter((n) => n.type === "bell" || n.type === "toast");
  },
});

export const latestUnread = query({
  args: { type: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("notifications")
      .withIndex("by_type_read", (q) => q.eq("type", args.type).eq("read", false))
      .order("desc")
      .take(10);
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_type_read", (q) => q.eq("type", "bell").eq("read", false))
      .collect();
    return unread.length;
  },
});

export const markRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    await ctx.db.patch(args.id, { read: true });
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_type_read", (q) => q.eq("type", "bell").eq("read", false))
      .collect();
    for (const n of unread) {
      await ctx.db.patch(n._id, { read: true });
    }
    return { marked: unread.length };
  },
});

export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);
    const all = await ctx.db
      .query("notifications")
      .withIndex("by_created")
      .order("desc")
      .take(200);
    const bellAndToast = all.filter((n) => n.type === "bell" || n.type === "toast");
    for (const n of bellAndToast) {
      await ctx.db.delete(n._id);
    }
    return { deleted: bellAndToast.length };
  },
});
