import { query } from "./_generated/server";

export const listSessions = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("meetingBotSessions")
      .withIndex("by_status")
      .order("desc")
      .collect();
  },
});
