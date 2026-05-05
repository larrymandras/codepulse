import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import {
  getCorsHeaders,
  validateIngestAuth,
  unauthorizedResponse,
  checkBodySize,
  payloadTooLargeResponse,
  rateLimitResponse,
  validationErrorResponse,
} from "./ingestAuth";
import { ingestRateLimiter } from "./ingestRateLimit";

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
  const origin = request.headers.get("Origin");
  const headers = getCorsHeaders(origin);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  // CPHLTH-02: Require Bearer token auth on all ingest endpoints.
  if (!validateIngestAuth(request)) {
    return unauthorizedResponse(headers);
  }

  // D-08: Reject oversized payloads before parsing.
  if (!checkBodySize(request)) {
    return payloadTooLargeResponse(headers);
  }

  // D-06/D-07: Rate limit per API key.
  const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "") ?? "anonymous";
  const rateCheck = await ingestRateLimiter.limit(ctx, "runtime", { key: apiKey });
  if (!rateCheck.ok) {
    return rateLimitResponse(headers, rateCheck.retryAfter);
  }

  try {
    const body = await request.json();

    // D-09: Validate body structure for the generic routing endpoint.
    // Accepts { events: [...] } (batch) or { eventType: "...", ... } (single).
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return validationErrorResponse(
        [{ field: "_body", message: "expected JSON object" }],
        headers,
      );
    }
    if (body.events !== undefined && !Array.isArray(body.events)) {
      return validationErrorResponse(
        [{ field: "events", message: `expected array, got ${typeof body.events}` }],
        headers,
      );
    }
    if (!body.events && body.eventType !== undefined && typeof body.eventType !== "string") {
      return validationErrorResponse(
        [{ field: "eventType", message: `expected string, got ${typeof body.eventType}` }],
        headers,
      );
    }

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
      const rawData = evt.data ?? (evt as any).payload ?? evt;
      // Convex v.optional() rejects null — coerce to undefined for all top-level fields
      const data: Record<string, any> = {};
      for (const [k, v] of Object.entries(rawData)) {
        data[k] = v === null ? undefined : v;
      }

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
          const eventType = d.eventType ?? d.event_type ?? d.layer ?? "unknown";
          const rawSeverity = d.severity ?? "medium";
          const severity = rawSeverity === "warning" ? "medium" : rawSeverity;
          const description =
            d.description ||
            (d.layer && d.action ? `${d.layer}: ${d.action}` : "");
          await ctx.runMutation(api.security.recordEvent, {
            eventType,
            severity,
            source: d.source ?? d.layer ?? "runtime",
            description,
            details: d.details,
          });
          break;
        }
        case "llm_gate_changed": {
          const d = data as any;
          await ctx.runMutation(api.llmGateEvents.record, {
            enabled: d.enabled ?? true,
            reason: d.reason ?? "",
            queuedCount: d.queued_replayed ?? d.queuedCount,
            timestamp,
          });
          break;
        }
        case "self_healing": {
          const d = data as any;
          // Compaction events have their own table — skip self-healing recording
          if (d.healEventType === "compaction") break;
          const action = d.action ?? d.method ?? "retry";
          const outcome =
            d.outcome ??
            (d.success === true
              ? "resolved"
              : d.success === false
                ? "failed"
                : "pending");
          await ctx.runMutation(api.selfHealing.recordEvent, {
            component: d.component ?? "unknown",
            issue: d.issue ?? d.healEventType ?? "",
            action,
            outcome,
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
            name: d.name ?? d.server ?? d.serverName ?? d.server_name ?? "unknown",
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
        case "pipe_execution": {
          const d = data as any;
          await ctx.runMutation(api.automation.recordCron, {
            jobName: `pipe:${d.pipe_name ?? d.pipeName ?? "unknown"}`,
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
        case "credential_access": {
          const d = data as any;
          await ctx.runMutation(api.credentialAudit.recordAccess, {
            toolName: d.toolName ?? d.tool_name ?? "unknown",
            credentialKey: d.credentialKey ?? d.credential_key ?? "***",
            agentId: d.agentId ?? d.agent_id,
            granted: d.granted ?? true,
            timestamp,
          });
          break;
        }
        case "memory_tier_stats": {
          const d = data as any;
          await ctx.runMutation(api.memoryTiers.recordStats, {
            agentId: d.agentId ?? d.agent_id ?? "unknown",
            contentLength: d.contentLength ?? d.content_length ?? 0,
            l0Length: d.l0Length ?? d.l0_length ?? 0,
            l1Length: d.l1Length ?? d.l1_length ?? 0,
            tokenSavingsPercent: d.tokenSavingsPercent ?? d.token_savings_percent ?? 0,
            hadLlmSummarizer: d.hadLlmSummarizer ?? d.had_llm_summarizer ?? false,
            timestamp,
          });
          break;
        }
        case "reflection_result": {
          const d = data as any;
          await ctx.runMutation(api.reflections.recordResult, {
            agentId: d.agentId ?? d.agent_id ?? "unknown",
            eventsAnalyzed: d.eventsAnalyzed ?? d.events_analyzed ?? 0,
            memoriesExtracted: d.memoriesExtracted ?? d.memories_extracted ?? 0,
            categories: d.categories ?? {},
            avgConfidence: d.avgConfidence ?? d.avg_confidence ?? 0,
            reflectionDurationMs: d.reflectionDurationMs ?? d.reflection_duration_ms ?? 0,
            timestamp,
          });
          break;
        }
        case "checkpoint_event": {
          const d = data as any;
          await ctx.runMutation(api.pipelineCheckpoints.recordEvent, {
            executionId: d.executionId ?? d.execution_id ?? "unknown",
            pipelineName: d.pipelineName ?? d.pipeline_name ?? "unknown",
            stepIndex: d.stepIndex ?? d.step_index ?? 0,
            stepName: d.stepName ?? d.step_name ?? "unknown",
            completedSteps: d.completedSteps ?? d.completed_steps ?? [],
            status: d.status ?? "saved",
            timestamp,
          });
          break;
        }
        case "integration_call": {
          const d = data as any;
          await ctx.runMutation(api.integrationCalls.recordCall, {
            integrationName: d.integrationName ?? d.integration_name ?? "unknown",
            endpointName: d.endpointName ?? d.endpoint_name ?? "unknown",
            method: d.method ?? "GET",
            statusCode: d.statusCode ?? d.status_code ?? 0,
            durationMs: d.durationMs ?? d.duration_ms ?? 0,
            success: d.success ?? false,
            error: d.error,
            timestamp,
          });
          break;
        }
        case "sandbox_violation": {
          const d = data as any;
          await ctx.runMutation(api.sandboxViolations.recordViolation, {
            toolName: d.toolName ?? d.tool_name ?? "unknown",
            permission: d.permission ?? "unknown",
            detail: d.detail,
            strict: d.strict ?? false,
            timestamp,
          });
          break;
        }
        case "worktree_event": {
          const d = data as any;
          await ctx.runMutation(api.worktrees.recordEvent, {
            type: d.type ?? "unknown",
            worktreeId: d.worktreeId ?? d.worktree_id,
            agentId: d.agentId ?? d.agent_id,
            branch: d.branch,
            baseBranch: d.baseBranch ?? d.base_branch,
            proofPassed: d.proofPassed ?? d.proof_passed,
            timestamp,
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
        case "github_workflow_run": {
          const d = data as any;
          await ctx.runMutation(api.githubActions.recordWorkflowRun, {
            workflowName: d.workflowName ?? d.workflow_name ?? "unknown",
            repo: d.repo ?? d.repository ?? "unknown",
            status: d.status ?? "unknown",
            conclusion: d.conclusion,
            runUrl: d.runUrl ?? d.run_url ?? d.html_url,
            runId: d.runId ?? d.run_id,
            triggeredAt: d.triggeredAt ?? d.triggered_at ?? timestamp,
            completedAt: d.completedAt ?? d.completed_at,
          });
          break;
        }
        case "tool_inventory_sync": {
          const d = data as any;
          if (Array.isArray(d.tools)) {
            await ctx.runMutation(api.registry.importToolInventory, {
              tools: d.tools,
              importSource: d.importSource ?? "github:astridr-tools",
            });
          }
          break;
        }
        case "mcp_server_sync": {
          const d = data as any;
          if (Array.isArray(d.items)) {
            await ctx.runMutation(api.registry.importMcpServers, {
              items: d.items,
              importSource: d.importSource ?? "github:mandras-mcp-servers",
            });
          }
          break;
        }
        case "skills_sync": {
          const d = data as any;
          if (Array.isArray(d.items)) {
            await ctx.runMutation(api.registry.importSkills, {
              items: d.items,
              importSource: d.importSource ?? "github:mandras-skills",
            });
          }
          break;
        }
        case "hooks_sync": {
          const d = data as any;
          if (Array.isArray(d.items)) {
            await ctx.runMutation(api.registry.importHooks, {
              items: d.items,
              importSource: d.importSource ?? "github:mandras-hooks",
            });
          }
          break;
        }
        case "plugins_sync": {
          const d = data as any;
          if (Array.isArray(d.items)) {
            await ctx.runMutation(api.registry.importPlugins, {
              items: d.items,
              importSource: d.importSource ?? "github:mandras-plugins",
            });
          }
          break;
        }
        case "capability_sync":
          await ctx.runMutation(api.registry.syncFullInventory, {
            snapshot: data,
          });
          break;
        case "ideation_finding": {
          const d = data as any;
          await ctx.runMutation(api.ideation.recordFinding, {
            scanType: d.scanType ?? d.scan_type ?? "unknown",
            severity: d.severity ?? "low",
            category: d.category ?? "unknown",
            location: d.location ?? "",
            description: d.description ?? "",
            suggestedFix: d.suggestedFix ?? d.suggested_fix,
            contentHash: d.contentHash ?? d.content_hash ?? "",
          });
          break;
        }
        case "command_execution": {
          const d = data as {
            executionId?: string; execution_id?: string;
            toolName?: string; tool_name?: string;
            origin?: string;
            profileId?: string; profile_id?: string;
            channelId?: string; channel_id?: string;
            status?: string;
            queuedAt?: number; queued_at?: number;
            startedAt?: number; started_at?: number;
            completedAt?: number; completed_at?: number;
            durationMs?: number; duration_ms?: number;
            errorMessage?: string; error_message?: string; error?: string;
            contextSnapshot?: unknown; context_snapshot?: unknown;
            parentExecutionId?: string; parent_execution_id?: string;
            cancelRequested?: boolean;
          };
          await ctx.runMutation(api.commandExecutions.upsertLifecycle, {
            executionId: d.executionId ?? d.execution_id ?? "unknown",
            toolName: d.toolName ?? d.tool_name,
            origin: d.origin,
            profileId: d.profileId ?? d.profile_id,
            channelId: d.channelId ?? d.channel_id,
            status: d.status ?? "queued",
            queuedAt: d.queuedAt ?? d.queued_at ?? timestamp,
            startedAt: d.startedAt ?? d.started_at,
            completedAt: d.completedAt ?? d.completed_at,
            durationMs: d.durationMs ?? d.duration_ms,
            errorMessage: d.errorMessage ?? d.error_message ?? d.error,
            contextSnapshot: d.contextSnapshot ?? d.context_snapshot,
            parentExecutionId: d.parentExecutionId ?? d.parent_execution_id,
            cancelRequested: d.cancelRequested,
          });
          break;
        }
        case "run.blocks": {
          const d = data as any;
          await ctx.runMutation(api.runBlocks.record, {
            sessionId: d.session_id ?? d.sessionId ?? "unknown",
            blocks: d.blocks ?? [],
            roundNum: d.round_num ?? d.roundNum,
            timestamp,
          });
          break;
        }
        case "agent_metric": {
          const d = data as any;
          await ctx.runMutation(api.agentMetrics.insertMetric, {
            agentId: d.agentId ?? d.agent_id ?? "unknown",
            responseTimeMs: d.responseTimeMs ?? d.response_time_ms,
            taskOutcome: d.taskOutcome ?? d.task_outcome ?? "success",
            inputTokens: d.inputTokens ?? d.input_tokens ?? 0,
            outputTokens: d.outputTokens ?? d.output_tokens ?? 0,
            modelUsed: d.modelUsed ?? d.model_used ?? d.model,
            complexityTier: d.complexityTier ?? d.complexity_tier,
            fromOverride: d.fromOverride ?? d.from_override,
            timestamp,
          });
          break;
        }
        case "complexity_assessed": {
          const d = data as any;
          await ctx.runMutation(api.complexityAssessments.insert, {
            sessionId: d.session_id ?? d.sessionId ?? "unknown",
            tier: d.tier ?? "unknown",
            score: d.score ?? 0,
            signals: d.signals,
            model: d.model ?? "unknown",
            fromOverride: d.from_override ?? d.fromOverride ?? false,
            timestamp,
          });
          break;
        }
        case "hive_mind_entry": {
          const d = data as any;
          await ctx.runMutation(api.hiveMind.recordEntry, {
            agentType: d.agent_type ?? d.agentType ?? "unknown",
            instanceId: d.instance_id ?? d.instanceId ?? "unknown",
            profileId: d.profile_id ?? d.profileId ?? "unknown",
            actionType: d.action_type ?? d.actionType ?? "tool_call",
            toolName: d.tool_name ?? d.toolName,
            target: d.target,
            resultSummary: d.result_summary ?? d.resultSummary,
            success: d.success ?? true,
            durationMs: d.duration_ms ?? d.durationMs,
            correlationId: d.correlation_id ?? d.correlationId,
            sourceAgent: d.source_agent ?? d.sourceAgent,
            targetAgent: d.target_agent ?? d.targetAgent,
            taskDescription: d.task_description ?? d.taskDescription,
            sessionKey: d.session_key ?? d.sessionKey,
            timestamp,
          });
          break;
        }
        case "channel_health": {
          const d = data as any;
          await ctx.runMutation(api.channelHealth.upsert, {
            channelId: d.channelId ?? d.channel_id ?? "unknown",
            status: d.status ?? "unknown",
            messagesLastHour: d.messagesLastHour ?? d.messages_last_hour ?? 0,
            avgResponseMs: d.avgResponseMs ?? d.avg_response_ms ?? 0,
            errorCount: d.errorCount ?? d.error_count ?? 0,
            lastMessageAt: d.lastMessageAt ?? d.last_message_at ?? 0,
            details: d.details,
            timestamp,
          });
          break;
        }
        case "provider_health": {
          const d = data as any;
          await ctx.runMutation(api.providerHealth.upsert, {
            providerName: d.providerName ?? d.provider_name ?? d.name ?? "unknown",
            state: d.state ?? "unknown",
            latencyEmaMs: d.latencyEmaMs ?? d.latency_ema_ms ?? 0,
            successRate: d.successRate ?? d.success_rate ?? 0,
            consecutiveFailures: d.consecutiveFailures ?? d.consecutive_failures ?? 0,
            lastSuccessAt: d.lastSuccessAt ?? d.last_success_at ?? 0,
            timestamp,
          });
          break;
        }
        case "provider.state_change": {
          const d = data as any;
          await ctx.runMutation(api.providerHealth.recordStateChange, {
            providerName: d.provider ?? d.providerName ?? d.provider_name ?? d.name ?? "unknown",
            state: d.new_state ?? d.state ?? "unknown",
            latencyEmaMs: d.latencyEmaMs ?? d.latency_ema_ms ?? 0,
            successRate: d.successRate ?? d.success_rate ?? 0,
            consecutiveFailures: d.consecutiveFailures ?? d.consecutive_failures ?? 0,
            lastSuccessAt: d.lastSuccessAt ?? d.last_success_at ?? 0,
            timestamp,
          });
          break;
        }
        case "startup_event": {
          const d = data as any;
          await ctx.runMutation(api.v6Mutations.insertStartupEvent, {
            phase: d.phase ?? "unknown",
            duration: d.duration ?? 0,
            totalMs: d.totalMs ?? d.total_ms ?? 0,
            subsystem: d.subsystem,
            order: d.order,
            timestamp: d.timestamp ?? timestamp,
          });
          break;
        }
        case "auth_alias": {
          const d = data as any;
          await ctx.runMutation(api.v6Mutations.upsertAuthAlias, {
            alias: d.alias ?? "unknown",
            provider: d.provider ?? "unknown",
            userId: d.userId ?? d.user_id ?? "unknown",
            createdAt: d.createdAt ?? d.created_at ?? timestamp,
            lastUsedAt: d.lastUsedAt ?? d.last_used_at,
          });
          break;
        }
        case "network_policy_config": {
          const d = data as any;
          await ctx.runMutation(api.networkPolicy.upsertRule, {
            host: d.host,
            cidr: d.cidr,
            port: d.port,
            provider: d.provider,
            source: d.source ?? "config",
            timestamp,
          });
          break;
        }
        case "network_egress_summary": {
          const d = data as any;
          await ctx.runMutation(api.networkPolicy.recordEgressSummary, {
            hosts: d.hosts ?? {},
            blockedCount: d.blockedCount ?? d.blocked_count ?? 0,
            timestamp,
          });
          break;
        }
        case "advisor_event": {
          const d = data as any;
          await ctx.runMutation(api.v6Mutations.insertAdvisorEvent, {
            sessionId: d.sessionId ?? d.session_id,
            provider: d.provider ?? "unknown",
            model: d.model,
            used: d.used ?? false,
            inputTokens: d.inputTokens ?? d.input_tokens ?? 0,
            outputTokens: d.outputTokens ?? d.output_tokens ?? 0,
            costUsd: d.costUsd ?? d.cost_usd ?? 0,
            standardCostUsd: d.standardCostUsd ?? d.standard_cost_usd ?? 0,
            latencyMs: d.latencyMs ?? d.latency_ms,
            timestamp: d.timestamp ?? timestamp,
          });
          break;
        }
        case "compaction": {
          const d = data as any;
          await ctx.runMutation(api.compactionEvents.insert, {
            sessionId: d.sessionId ?? d.session_id ?? "unknown",
            trigger: d.trigger ?? "auto",
            timestamp: d.timestamp ?? timestamp,
          });
          break;
        }
        case "metric_snapshot": {
          const d = data as any;
          await ctx.runMutation(api.metrics.insertSnapshot, {
            metricName: d.metricName ?? d.metric_name ?? "unknown",
            value: d.value ?? 0,
            tags: d.tags,
            timestamp: d.timestamp ?? timestamp,
          });
          break;
        }
        case "tool_assignment_sync":
          await ctx.runMutation(api.toolAssignments.syncAssignments, {
            agents: data.agents ?? [],
            unassigned: data.unassigned ?? [],
            totals: data.totals ?? { totalTools: 0, assignedTools: 0, pendingClassification: 0, agents: 0 },
          });
          break;

        case "tool_assignment_change":
          await ctx.runMutation(api.toolAssignments.recordChange, {
            action: data.action ?? "unknown",
            tool: data.tool ?? { toolId: "unknown", tags: [] },
            assignedTo: data.assignedTo ?? [],
          });
          break;
        case "prompt_assembly": {
          const d = data as any;
          await ctx.runMutation(api.promptAssembly.record, {
            sessionId: d.sessionId ?? d.session_id,
            profileId: d.profileId ?? d.profile_id,
            totalTokens: d.totalTokens ?? d.total_tokens ?? 0,
            tiersIncluded: d.tiersIncluded ?? d.tiers_included ?? [],
            soul: d.soul ?? 0,
            behavior: d.behavior ?? 0,
            userProfile: d.userProfile ?? d.user_profile ?? 0,
            briefingPrefs: d.briefingPrefs ?? d.briefing_prefs ?? 0,
            memoryContext: d.memoryContext ?? d.memory_context ?? 0,
            profileContext: d.profileContext ?? d.profile_context ?? 0,
            googleWorkspace: d.googleWorkspace ?? d.google_workspace ?? 0,
            toolNames: d.toolNames ?? d.tool_names ?? 0,
            agentRoster: d.agentRoster ?? d.agent_roster ?? 0,
            skillInstructions: d.skillInstructions ?? d.skill_instructions ?? 0,
            timestamp,
          });
          break;
        }
        case "context_pressure": {
          const d = data as any;
          await ctx.runMutation(api.contextPressure.insert, {
            sessionId: d.session_id ?? d.sessionId ?? "unknown",
            fillPercent: d.fill_percent ?? d.fillPercent ?? 0,
            tokensUsed: d.tokens_used ?? d.tokensUsed ?? 0,
            tokensMax: d.tokens_max ?? d.tokensMax ?? 0,
            turnDelta: d.turn_delta ?? d.turnDelta ?? 0,
            avgPerTurn: d.avg_per_turn ?? d.avgPerTurn ?? 0,
            thresholdCrossed: d.threshold_crossed ?? d.thresholdCrossed ?? false,
            systemPromptOverhead: d.system_prompt_overhead ?? d.systemPromptOverhead,
            turnNumber: d.turn_number ?? d.turnNumber,
            timestamp,
          });
          break;
        }
        case "rate_limit_hit": {
          const d = data as any;
          await ctx.runMutation(api.rateLimitEvents.insert, {
            provider: d.provider ?? d.provider_name ?? "unknown",
            eventType: "rate_limit_hit",
            httpStatus: d.http_status ?? d.httpStatus ?? 429,
            retryAfter: d.retry_after ?? d.retryAfter,
            remainingQuota: d.remaining_quota ?? d.remainingQuota,
            timestamp,
          });
          break;
        }
        case "rate_limit_warning": {
          const d = data as any;
          await ctx.runMutation(api.rateLimitEvents.insert, {
            provider: d.provider ?? "unknown",
            eventType: "rate_limit_warning",
            currentRpm: d.current_rpm ?? d.currentRpm,
            limitRpm: d.limit_rpm ?? d.limitRpm,
            percentUsed: d.percent_used ?? d.percentUsed,
            timestamp,
          });
          break;
        }
        case "system_resources": {
          const d = data as any;
          await ctx.runMutation(api.wsl2.upsertStatus, {
            distro: "astridr-docker",
            status: "running",
            memoryMb: d.ram_used_mb ?? d.ramUsedMb,
            cpuPercent: d.cpu ?? d.cpuPercent,
          });
          break;
        }
        case "agent_status": {
          const d = data as any;
          await ctx.runMutation(api.agentStatus.recordEvent, {
            agentId: d.agentId ?? d.agent_id ?? "unknown",
            state: d.state ?? "idle",
            currentTask: d.currentTask ?? d.current_task ?? undefined,
            errorCount: d.errorCount ?? d.error_count ?? undefined,
            profileId: d.profileId ?? d.profile_id ?? undefined,
            timestamp,
          });
          break;
        }
        case "daily_rhythm_sync": {
          const d = data as any;
          if (Array.isArray(d.entries)) {
            await ctx.runMutation(api.dailyRhythm.upsertEntries, {
              agentTypeId: d.agentTypeId ?? d.agent_type_id ?? "unknown",
              entries: d.entries,
              syncedAt: timestamp,
            });
          }
          break;
        }
        case "step_started":
        case "step_completed": {
          const d = data as any;
          await ctx.runMutation(api.pipelineStepEvents.recordEvent, {
            executionId: d.executionId ?? d.execution_id ?? "unknown",
            pipelineName: d.pipelineName ?? d.pipeline_name ?? "message_pipeline",
            stepName: d.stepName ?? d.step_name ?? "unknown",
            stepIndex: d.stepIndex ?? d.step_index ?? 0,
            status: evt.eventType,
            durationMs: d.durationMs ?? d.duration_ms ?? undefined,
            inputSize: d.inputSize ?? d.input_size ?? undefined,
            outputSize: d.outputSize ?? d.output_size ?? undefined,
            error: d.error ?? undefined,
            timestamp,
          });
          break;
        }
      }
    }

    // Phase 6: Trigger critical rule evaluation on ingest for sub-60s alerting (per D-04)
    // Schedules asynchronously — does NOT block ingest response
    // Rate-limit: skip if evaluated within last 15 seconds to avoid DB read amplification
    const lastEvalConfig = await ctx.runQuery(internal.alerts.getLastCriticalEvalTimestamp);
    const nowForEval = Date.now() / 1000;
    if (!lastEvalConfig || nowForEval - lastEvalConfig > 15) {
      await ctx.runMutation(internal.alerts.evaluateCriticalInternal);
    }

    return new Response(JSON.stringify({ ingested: events.length }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...headers },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...headers },
    });
  }
});
