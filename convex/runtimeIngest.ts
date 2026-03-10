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
          // Astridr sends batch: { activeProfiles, activeChannels, profileActivity: {id: count} }
          // Route to batch handler if batch format detected, else fall back to single record
          if (d.profileActivity || d.activeProfiles !== undefined) {
            await ctx.runMutation(api.profiles.recordActivityBatch, {
              activeProfiles: d.activeProfiles ?? d.active_profiles,
              activeChannels: d.activeChannels ?? d.active_channels,
              profileActivity: d.profileActivity ?? d.profile_activity,
              timestamp,
            });
          } else {
            await ctx.runMutation(api.profiles.recordMetrics, {
              profileId: d.profileId ?? d.profile_id ?? "unknown",
              metric: d.metric ?? "activity",
              value: d.value ?? 0,
              tags: d.tags,
            });
          }
          break;
        }
        case "docker_status": {
          const d = data as any;

          // Aggregated format: { containers: [ { name, image, state, healthy, ... }, ... ] }
          if (Array.isArray(d.containers)) {
            for (const c of d.containers) {
              const cid = c.id ?? c.name ?? "unknown";
              const healthStr = c.health ?? (
                c.healthy === true ? "healthy"
                : c.healthy === false ? "unhealthy"
                : c.healthy === undefined ? undefined
                : String(c.healthy)
              );
              await ctx.runMutation(api.docker.recordStatus, {
                containerId: cid,
                name: c.name ?? cid,
                image: c.image,
                status: c.state ?? c.status ?? "unknown",
                health: healthStr,
                cpuPercent: c.cpuPercent ?? c.cpu_percent,
                memoryMb: c.memoryMb ?? c.memory_mb ?? c.memPercent ?? c.mem_percent,
              });
            }
          } else {
            // Single-container fallback
            const cid = d.containerId ?? d.container_id;
            if (cid) {
              await ctx.runMutation(api.docker.recordStatus, {
                containerId: cid,
                name: d.name ?? cid,
                image: d.image,
                status: d.state ?? d.status ?? "unknown",
                health: d.health,
                cpuPercent: d.cpuPercent ?? d.cpu_percent,
                memoryMb: d.memoryMb ?? d.memory_mb,
              });
            }
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
        case "cron_execution": {
          const d = data as any;
          await ctx.runMutation(api.automation.recordCron, {
            jobName: d.jobName ?? d.job_name ?? "unknown",
            startedAt: d.startedAt ?? d.started_at ?? timestamp,
            durationMs: d.durationMs ?? d.duration_ms ?? 0,
            success: d.success ?? true,
            error: d.error,
            timestamp,
          });
          break;
        }
        case "heartbeat_alerts": {
          const d = data as any;
          const alerts = d.alerts ?? [];
          await ctx.runMutation(api.automation.recordHeartbeat, {
            alerts,
            alertCount: Array.isArray(alerts) ? alerts.length : 0,
            timestamp: d.timestamp ?? timestamp,
          });
          break;
        }
        case "job_lifecycle": {
          const d = data as any;
          await ctx.runMutation(api.automation.recordJob, {
            jobId: d.jobId ?? d.job_id ?? "unknown",
            status: d.status ?? "pending",
            trigger: d.trigger,
            error: d.error,
            timestamp,
          });
          break;
        }
        case "proactive_message": {
          const d = data as any;
          await ctx.runMutation(api.automation.recordProactiveMessage, {
            messageType: d.type ?? d.messageType ?? d.message_type ?? "alert",
            channelId: d.channelId ?? d.channel_id,
            chatId: d.chatId ?? d.chat_id,
            timestamp: d.timestamp ?? timestamp,
          });
          break;
        }
        case "subagent_execution": {
          const d = data as any;
          await ctx.runMutation(api.automation.recordSubagentExecution, {
            agentId: d.agentId ?? d.agent_id ?? "unknown",
            success: d.success ?? true,
            durationMs: d.durationMs ?? d.duration_ms ?? 0,
            tokensUsed: d.tokensUsed ?? d.tokens_used ?? 0,
            error: d.error,
            timestamp,
          });
          break;
        }
        case "webhook_received": {
          const d = data as any;
          await ctx.runMutation(api.automation.recordWebhook, {
            hookId: d.hookId ?? d.hook_id ?? "unknown",
            taskId: d.taskId ?? d.task_id,
            source: d.source,
            timestamp: d.timestamp ?? timestamp,
          });
          break;
        }
        case "plugin_loaded": {
          const d = data as any;
          await ctx.runMutation(api.registry.upsertPlugin, {
            name: d.name ?? "unknown",
            version: d.version,
            pluginType: d.pluginType ?? d.plugin_type,
          });
          break;
        }
        case "version_bump": {
          const d = data as any;
          await ctx.runMutation(api.registry.recordVersionBump, {
            component: d.component ?? "astridr",
            version: d.new ?? d.version ?? "unknown",
            previousVersion: d.previous ?? d.previousVersion,
            changeType: d.change_type ?? d.changeType,
          });
          break;
        }
        case "episodic_event": {
          const d = data as any;
          await ctx.runMutation(api.episodic.recordEvent, {
            agentId: d.agentId ?? d.agent_id,
            eventType: d.memoryType ?? d.memory_type ?? d.eventType ?? d.event_type ?? "unknown",
            summary: d.summary ?? d.description ?? "",
            detail: d.detail ?? d.details ?? d.metadata,
            occurredAt: d.occurredAt ?? d.occurred_at ?? timestamp,
          });
          break;
        }
        case "profile_config": {
          const d = data as any;
          await ctx.runMutation(api.profiles.upsertConfig, {
            profileId: d.profileId ?? d.profile_id ?? "unknown",
            channels: d.channels,
            budget: d.budget,
            modelPreferences: d.modelPreferences ?? d.model_preferences,
          });
          break;
        }
        case "git_commit": {
          const d = data as any;
          await ctx.runMutation(api.git.recordCommit, {
            sha: d.sha ?? d.hash ?? "unknown",
            message: d.message ?? d.commit_message ?? "",
            branch: d.branch ?? "unknown",
            author: d.author ?? "unknown",
            filesChanged: d.filesChanged ?? d.files_changed ?? 0,
            timestamp: d.timestamp ?? timestamp,
          });
          break;
        }
        case "profile_switch": {
          const d = data as any;
          await ctx.runMutation(api.profiles.recordSwitch, {
            fromProfile: d.fromProfile ?? d.from_profile ?? "unknown",
            toProfile: d.toProfile ?? d.to_profile ?? "unknown",
            reason: d.reason,
          });
          break;
        }
        case "wsl2_status": {
          const d = data as any;
          await ctx.runMutation(api.wsl2.upsertStatus, {
            distro: d.distro ?? "unknown",
            status: d.status ?? "unknown",
            memoryMb: d.memoryMb ?? d.memory_mb,
            cpuPercent: d.cpuPercent ?? d.cpu_percent,
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
