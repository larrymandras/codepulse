import { query } from "./_generated/server";
import { v } from "convex/values";

export const listRooms = query({
  args: {
    closedLimit: v.optional(v.float64()),
  },
  handler: async (ctx, { closedLimit = 20 }) => {
    const limit = Math.min(closedLimit, 200);

    // Active rooms are always fully listed — expected < 20 concurrent (T-90-DOS: no cap needed here).
    const active = await ctx.db
      .query("warRooms")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .order("desc")
      .collect();

    // Bounded closed section: query "closed" and "idle" separately (N6: idle treated as closed),
    // take limit+1 from each to detect overflow, then merge and sort most-recent first.
    const closedRaw = await ctx.db
      .query("warRooms")
      .withIndex("by_status", (q) => q.eq("status", "closed"))
      .order("desc")
      .take(limit + 1);

    const idleRaw = await ctx.db
      .query("warRooms")
      .withIndex("by_status", (q) => q.eq("status", "idle"))
      .order("desc")
      .take(limit + 1);

    const mergedClosed = [...closedRaw, ...idleRaw].sort(
      (a, b) => b.createdAt - a.createdAt
    );

    const hasMore = mergedClosed.length > limit;
    const closed = hasMore ? mergedClosed.slice(0, limit) : mergedClosed;

    return { active, closed, hasMore };
  },
});

export const getRoomEvents = query({
  args: { roomId: v.string(), limit: v.optional(v.float64()) },
  handler: async (ctx, { roomId, limit }) => {
    // Switched from by_room (timestamp) to by_room_seq for deterministic ordering (ROOM-04).
    // Legacy rows with missing seq sort before seq=0 under order("asc") — acceptable (Pitfall 5).
    return await ctx.db.query("warRoomEvents")
      .withIndex("by_room_seq", (q) => q.eq("roomId", roomId))
      .order("asc")
      .take(limit ?? 500);
  },
});
