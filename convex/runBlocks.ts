import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const record = mutation({
  args: {
    sessionId: v.string(),
    blocks: v.array(v.any()),
    roundNum: v.optional(v.float64()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("run_blocks", {
      sessionId: args.sessionId,
      blocks: args.blocks,
      roundNum: args.roundNum,
      timestamp: args.timestamp,
    });
  },
});
