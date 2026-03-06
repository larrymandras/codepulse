import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * HTTP action: POST /ingest
 *
 * Build-time event ingest. Accepts a JSON body with session/event data
 * and routes to the appropriate domain tables.
 */
export const buildIngest = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const {
      sessionId,
      eventType,
      toolName,
      filePath,
      payload,
      hookType,
    } = body;
    const timestamp = body.timestamp ?? Date.now() / 1000;

    // 1. Store in events table
    await ctx.runMutation(api.events.ingest, {
      sessionId: sessionId ?? "unknown",
      eventType: eventType ?? "unknown",
      toolName,
      filePath,
      payload: payload ?? body,
      hookType,
      timestamp,
    });

    // 2. Upsert session (extract cwd/model from payload if present)
    const data = payload ?? body;
    await ctx.runMutation(api.sessions.upsert, {
      sessionId: sessionId ?? "unknown",
      cwd: data.cwd ?? body.cwd,
      model: data.model ?? body.model,
    });

    // 3. Route by eventType
    if (eventType && eventType.includes("SubagentStart")) {
      const data = payload ?? body;
      await ctx.runMutation(api.agents.register, {
        sessionId: sessionId ?? "unknown",
        agentId: data.agentId ?? data.agent_id ?? "unknown",
        parentAgentId: data.parentAgentId ?? data.parent_agent_id,
        agentType: data.agentType ?? data.agent_type ?? "subagent",
        model: data.model,
      });
    }

    if (eventType && eventType.includes("SubagentStop")) {
      const data = payload ?? body;
      await ctx.runMutation(api.agents.updateStatus, {
        agentId: data.agentId ?? data.agent_id ?? "unknown",
        status: "completed",
        endedAt: timestamp,
      });
    }

    // 4. File operations
    if (toolName === "Write" || toolName === "Edit" || toolName === "Read") {
      await ctx.runMutation(api.fileOps.record, {
        sessionId: sessionId ?? "unknown",
        operation: toolName.toLowerCase(),
        filePath: filePath ?? "unknown",
        timestamp,
      });
    }

    // 5. Context snapshots from status lines
    if (hookType === "StatusLine") {
      await ctx.runMutation(api.contextSnapshots.record, {
        sessionId: sessionId ?? "unknown",
        statusLine: typeof payload === "string" ? payload : JSON.stringify(payload),
        timestamp,
      });
    }

    // 6. Tool registration
    if (toolName) {
      await ctx.runMutation(api.registry.detectAndRegisterTool, {
        name: toolName,
        source: "builtin",
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
