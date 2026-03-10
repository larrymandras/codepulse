import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Record a GitHub Actions workflow run.
 * Called from the runtime-ingest handler when eventType === "github_workflow_run".
 */
export const recordWorkflowRun = mutation({
  args: {
    workflowName: v.string(),
    repo: v.string(),
    status: v.string(), // "success" | "failure" | "in_progress" | "queued"
    conclusion: v.optional(v.string()), // "success" | "failure" | "cancelled" | null
    runUrl: v.optional(v.string()),
    runId: v.optional(v.float64()),
    triggeredAt: v.float64(),
    completedAt: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("githubWorkflowRuns", args);
  },
});

/**
 * Return the 10 most recent workflow runs, ordered by triggeredAt desc.
 */
export const latestRuns = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("githubWorkflowRuns")
      .withIndex("by_triggeredAt")
      .order("desc")
      .take(10);
  },
});

/**
 * Internal mutation: mark stale in-progress runs (>1 hr old) as "unknown".
 * Actual data comes from the ingest endpoint; this is a safety net.
 */
export const internalPollRuns = internalMutation({
  args: {},
  handler: async (ctx) => {
    const oneHourAgo = Date.now() / 1000 - 3600;
    const staleRuns = await ctx.db
      .query("githubWorkflowRuns")
      .withIndex("by_triggeredAt")
      .order("desc")
      .take(50);

    for (const run of staleRuns) {
      if (
        (run.status === "in_progress" || run.status === "queued") &&
        run.triggeredAt < oneHourAgo
      ) {
        await ctx.db.patch(run._id, { status: "unknown", conclusion: "unknown" });
      }
    }
  },
});
