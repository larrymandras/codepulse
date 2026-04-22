import { query } from "./_generated/server";
import { v } from "convex/values";

export const listRooms = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("warRooms")
      .order("desc")
      .collect();
  },
});

export const getRoomEvents = query({
  args: { roomId: v.string(), limit: v.optional(v.float64()) },
  handler: async (ctx, { roomId, limit }) => {
    return await ctx.db.query("warRoomEvents")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .order("asc")
      .take(limit ?? 500);
  },
});
