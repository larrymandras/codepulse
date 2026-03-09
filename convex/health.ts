import { httpAction } from "./_generated/server";
import { internalMutation } from "./_generated/server";
import { api } from "./_generated/api";

export const detectStaleSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const thirtyMinAgo = Date.now() / 1000 - 1800;
    const activeSessions = await ctx.db
      .query("sessions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    let marked = 0;
    for (const session of activeSessions) {
      if (session.lastEventAt < thirtyMinAgo) {
        await ctx.db.patch(session._id, { status: "completed" });
        marked++;
      }
    }
    return { marked };
  },
});

export const detectStaleAgents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const thirtyMinAgo = Date.now() / 1000 - 1800;
    const runningAgents = await ctx.db
      .query("agents")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .collect();

    let marked = 0;
    for (const agent of runningAgents) {
      if (agent.startedAt < thirtyMinAgo && !agent.endedAt) {
        await ctx.db.patch(agent._id, {
          status: "completed",
          endedAt: Date.now() / 1000,
        });
        marked++;
      }
    }
    return { marked };
  },
});

export const healthCheck = httpAction(async (ctx, _request) => {
  try {
    const [sessions, alerts] = await Promise.all([
      ctx.runQuery(api.sessions.listActive),
      ctx.runQuery(api.alerts.listActive),
    ]);

    return new Response(
      JSON.stringify({
        status: "ok",
        timestamp: Date.now(),
        version: "0.1.0",
        sessions: sessions.length,
        activeAlerts: alerts.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: "degraded",
        timestamp: Date.now(),
        version: "0.1.0",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
