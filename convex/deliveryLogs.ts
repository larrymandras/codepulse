import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ============================================================
// DELIVERY LOGS — audit trails for email, PagerDuty, GitHub (Phase 59)
// ============================================================

export const insertEmailLog = mutation({
  args: {
    alertId: v.optional(v.id("alerts")),
    ruleId: v.string(),
    attempt: v.float64(),
    status: v.string(),
    errorMessage: v.optional(v.string()),
    recipient: v.optional(v.string()),
    subject: v.optional(v.string()),
    sentAt: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("emailDeliveryLog", {
      alertId: args.alertId,
      ruleId: args.ruleId,
      attempt: args.attempt,
      status: args.status,
      errorMessage: args.errorMessage,
      recipient: args.recipient,
      subject: args.subject,
      sentAt: args.sentAt,
    });
  },
});

export const insertPagerdutyLog = mutation({
  args: {
    alertId: v.id("alerts"),
    ruleId: v.string(),
    attempt: v.float64(),
    status: v.string(),
    errorMessage: v.optional(v.string()),
    dedupKey: v.optional(v.string()),
    incidentKey: v.optional(v.string()),
    action: v.optional(v.string()),
    sentAt: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("pagerdutyDeliveryLog", {
      alertId: args.alertId,
      ruleId: args.ruleId,
      attempt: args.attempt,
      status: args.status,
      errorMessage: args.errorMessage,
      dedupKey: args.dedupKey,
      incidentKey: args.incidentKey,
      action: args.action,
      sentAt: args.sentAt,
    });
  },
});

export const insertGithubLog = mutation({
  args: {
    alertId: v.id("alerts"),
    ruleId: v.string(),
    attempt: v.float64(),
    status: v.string(),
    errorMessage: v.optional(v.string()),
    dispatchId: v.optional(v.string()),
    runUrl: v.optional(v.string()),
    rateLimited: v.optional(v.boolean()),
    repo: v.optional(v.string()),
    workflowFile: v.optional(v.string()),
    sentAt: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("githubTriggerLog", {
      alertId: args.alertId,
      ruleId: args.ruleId,
      attempt: args.attempt,
      status: args.status,
      errorMessage: args.errorMessage,
      dispatchId: args.dispatchId,
      runUrl: args.runUrl,
      rateLimited: args.rateLimited,
      repo: args.repo,
      workflowFile: args.workflowFile,
      sentAt: args.sentAt,
    });
  },
});

export const listEmailLogs = query({
  args: { ruleId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.ruleId) {
      return await ctx.db
        .query("emailDeliveryLog")
        .withIndex("by_rule", (q) => q.eq("ruleId", args.ruleId!))
        .order("desc")
        .filter((q) => q.neq(q.field("archived"), true))
        .take(100);
    }
    return await ctx.db
      .query("emailDeliveryLog")
      .withIndex("by_timestamp")
      .order("desc")
      .filter((q) => q.neq(q.field("archived"), true))
      .take(100);
  },
});

export const listPagerdutyLogs = query({
  args: { ruleId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.ruleId) {
      return await ctx.db
        .query("pagerdutyDeliveryLog")
        .withIndex("by_rule", (q) => q.eq("ruleId", args.ruleId!))
        .order("desc")
        .filter((q) => q.neq(q.field("archived"), true))
        .take(100);
    }
    return await ctx.db
      .query("pagerdutyDeliveryLog")
      .withIndex("by_timestamp")
      .order("desc")
      .filter((q) => q.neq(q.field("archived"), true))
      .take(100);
  },
});

export const listGithubLogs = query({
  args: { ruleId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.ruleId) {
      return await ctx.db
        .query("githubTriggerLog")
        .withIndex("by_rule", (q) => q.eq("ruleId", args.ruleId!))
        .order("desc")
        .filter((q) => q.neq(q.field("archived"), true))
        .take(100);
    }
    return await ctx.db
      .query("githubTriggerLog")
      .withIndex("by_timestamp")
      .order("desc")
      .filter((q) => q.neq(q.field("archived"), true))
      .take(100);
  },
});
