import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * HTTP action: POST /runtime-ingest
 *
 * Supports dual formats:
 * - Legacy batch: { "events": [...] }
 * - New single: { "eventType": "...", ... }
 *
 * Inserts into legacy runtime_events AND routes to domain tables.
 */
export const runtimeIngest = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const now = Date.now() / 1000;

    // Normalize to array
    const events: Array<{
      eventType: string;
      data?: any;
      timestamp?: number;
      critical?: boolean;
    }> = body.events
      ? body.events
      : [body];

    for (const evt of events) {
      const timestamp = evt.timestamp ?? now;
      const data = evt.data ?? evt;

      // Always insert into legacy runtime_events
      await ctx.runMutation(api.events.insertEvent, {
        eventType: evt.eventType,
        data: data,
        timestamp: timestamp,
        critical: evt.critical ?? false,
        receivedAt: now,
      });

      // Route to domain tables based on eventType
      switch (evt.eventType) {
        case "llm_call": {
          const d = data as any;
          await ctx.runMutation(api.llm.recordCall, {
            provider: d.provider ?? "unknown",
            model: d.model ?? "unknown",
            promptTokens: d.promptTokens ?? d.prompt_tokens ?? d.inputTokens ?? d.input_tokens ?? 0,
            completionTokens: d.completionTokens ?? d.completion_tokens ?? d.outputTokens ?? d.output_tokens ?? 0,
            totalTokens: d.totalTokens ?? d.total_tokens ?? ((d.promptTokens ?? d.prompt_tokens ?? d.inputTokens ?? d.input_tokens ?? 0) + (d.completionTokens ?? d.completion_tokens ?? d.outputTokens ?? d.output_tokens ?? 0)),
            latencyMs: d.latencyMs ?? d.latency_ms ?? 0,
            cost: d.cost ?? d.costUsd ?? d.cost_usd,
            sessionId: d.sessionId ?? d.session_id,
            timestamp,
          });
          break;
        }
        case "security_event": {
          const d = data as any;
          await ctx.runMutation(api.security.recordEvent, {
            eventType: d.eventType ?? d.event_type ?? "unknown",
            severity: d.severity ?? "medium",
            source: d.source ?? "runtime",
            description: d.description ?? "",
            details: d.details,
          });
          break;
        }
        case "self_healing": {
          const d = data as any;
          await ctx.runMutation(api.selfHealing.recordEvent, {
            component: d.component ?? "unknown",
            issue: d.issue ?? "",
            action: d.action ?? "retry",
            outcome: d.outcome ?? "pending",
            details: d.details,
          });
          break;
        }
        case "profile_activity": {
          const d = data as any;
          await ctx.runMutation(api.profiles.recordMetrics, {
            profileId: d.profileId ?? d.profile_id ?? "unknown",
            metric: d.metric ?? "activity",
            value: d.value ?? 0,
            tags: d.tags,
          });
          break;
        }
        case "docker_status": {
          const d = data as any;
          const cid = d.containerId ?? d.container_id;
          if (cid) {
            await ctx.runMutation(api.docker.recordStatus, {
              containerId: cid,
              name: d.name ?? cid,
              image: d.image,
              status: d.status ?? "unknown",
              health: d.health,
              cpuPercent: d.cpuPercent ?? d.cpu_percent,
              memoryMb: d.memoryMb ?? d.memory_mb,
            });
          }
          break;
        }
        case "supabase_health": {
          const d = data as any;
          await ctx.runMutation(api.supabase.recordHealth, {
            projectRef: d.projectRef ?? d.project_ref,
            service: d.service ?? "unknown",
            status: d.status ?? "unknown",
            responseTimeMs: d.responseTimeMs ?? d.response_time_ms,
            details: d.details,
          });
          break;
        }
        case "build_progress": {
          const d = data as any;
          await ctx.runMutation(api.build.updateComponent, {
            component: d.component ?? "unknown",
            phase: d.phase ?? "unknown",
            status: d.status ?? "pending",
            progress: d.progress,
            message: d.message,
          });
          break;
        }
        case "pipeline_execution": {
          const d = data as any;
          await ctx.runMutation(api.pipelines.recordExecution, {
            pipelineId: d.pipelineId ?? d.pipeline_id ?? "unknown",
            name: d.name ?? "unknown",
            status: d.status ?? "queued",
            stages: d.stages,
            startedAt: d.startedAt ?? d.started_at ?? timestamp,
            completedAt: d.completedAt ?? d.completed_at,
            triggeredBy: d.triggeredBy ?? d.triggered_by,
          });
          break;
        }
        case "agent_coordination": {
          const d = data as any;
          await ctx.runMutation(api.coordination.recordEvent, {
            fromAgent: d.fromAgent ?? d.from_agent ?? "unknown",
            toAgent: d.toAgent ?? d.to_agent ?? "unknown",
            eventType: d.coordinationType ?? d.coordination_type ?? "message",
            payload: d.payload,
            status: d.status,
          });
          break;
        }
        case "mcp_connection": {
          const d = data as any;
          await ctx.runMutation(api.registry.upsertMcpServer, {
            name: d.name ?? d.serverName ?? d.server_name ?? "unknown",
            status: d.status ?? "connected",
            url: d.url,
            toolCount: d.toolCount ?? d.tool_count,
          });
          break;
        }
      }
    }

    return new Response(JSON.stringify({ ingested: events.length }), {
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
