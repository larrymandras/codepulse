import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

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
