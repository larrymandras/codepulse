import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const recordCommit = mutation({
  args: {
    sha: v.string(),
    message: v.string(),
    branch: v.string(),
    author: v.string(),
    filesChanged: v.float64(),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("gitCommits", {
      sha: args.sha,
      message: args.message,
      branch: args.branch,
      author: args.author,
      filesChanged: args.filesChanged,
      timestamp: args.timestamp,
    });
  },
});

export const recentCommits = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("gitCommits")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const byBranch = query({
  args: { branch: v.string(), limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("gitCommits")
      .withIndex("by_branch", (q) => q.eq("branch", args.branch))
      .order("desc")
      .take(args.limit ?? 50);
  },
});
