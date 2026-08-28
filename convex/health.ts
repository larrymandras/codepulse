import { httpAction } from "./_generated/server";
import { internalMutation } from "./_generated/server";
import { api } from "./_generated/api";

// How many rows one invocation may sweep. Both janitors below are bounded by
// this and self-drain across successive cron runs, so a backlog costs several
// runs rather than one mutation that reads the whole status prefix. Sized to
// match retention.ts, which batches deletes at 200 docs per mutation.
const STALE_SWEEP_BATCH = 200;

export const detectStaleSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const thirtyMinAgo = Date.now() / 1000 - 1800;
    // `by_status` is ["status", "lastEventAt"], so the staleness range belongs
    // IN the index rather than in a post-read filter or a JS loop -- see the
    // SWEEP-01 write-up in boundedReads.ratchet.test.ts. Rows come back oldest
    // first, so a batch always drains the stalest sessions.
    const staleSessions = await ctx.db
      .query("sessions")
      .withIndex("by_status", (q) =>
        q.eq("status", "active").lt("lastEventAt", thirtyMinAgo)
      )
      .take(STALE_SWEEP_BATCH);

    let marked = 0;
    for (const session of staleSessions) {
      await ctx.db.patch(session._id, { status: "completed" });
      marked++;
    }
    return { marked, batchLimit: STALE_SWEEP_BATCH };
  },
});

export const detectStaleAgents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const thirtyMinAgo = Date.now() / 1000 - 1800;
    // `agents.by_status` is ["status"] ONLY -- unlike sessions there is no
    // second index field, so `startedAt` cannot be pushed into the index
    // without a schema migration. The read is bounded by .take() instead:
    // measured 2026-08-28, a single 500-row page already held 122 rows stuck
    // in "running" and pagination was not done, so an unbounded .collect()
    // here had no ceiling at all.
    const runningAgents = await ctx.db
      .query("agents")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .take(STALE_SWEEP_BATCH);

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
    return { marked, batchLimit: STALE_SWEEP_BATCH };
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
