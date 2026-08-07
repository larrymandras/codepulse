import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { getCorsHeaders, validateIngestAuth, unauthorizedResponse } from "./ingestAuth";
import { legacyEventData } from "./ingestSummary";
import { processTaskQualityEvent } from "./evalScores";
import { isUnresolvedRouting } from "./activeEngineFilters";
import { GATEWAY_PROVIDERS } from "./lib/providers";

/**
 * D-18 (Phase 104): resolves a `gateway_task_completed` event payload into the
 * args for api.llm.recordCall, or `null` when the reported provider id is not
 * a recognized GATEWAY_PROVIDERS member — a row keyed on an id no
 * `shadowForProvider` mapping row can match would be unpriceable noise, so no
 * llmMetrics row is written for it (the caller still logs a warning and lets
 * the unconditional generic events.insertEvent call above the switch stand as
 * the only record of the event).
 *
 * Exported for unit testing (convex-test is not installed in this repo;
 * mirrors the processTaskQualityEvent/processSwarmTaskEvent pure-function
 * extraction convention already used in this file's test suite).
 */
export function resolveGatewayTaskCompleted(
  d: Record<string, any>,
  timestamp: number
): {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  cost?: number;
  sessionId?: string;
  timestamp: number;
  toolName: string;
} | null {
  const provider = d.provider ?? d.account ?? "unknown";
  if (!(GATEWAY_PROVIDERS as readonly string[]).includes(provider)) {
    return null;
  }

  const promptTokens = d.promptTokens ?? d.prompt_tokens ?? d.input_tokens;
  const completionTokens = d.completionTokens ?? d.completion_tokens ?? d.output_tokens;
  // HONESTY REQUIREMENT (D-18 + D-03): both counts absent must be
  // distinguishable from a real zero-token turn — the derivation layer
  // (plan 104-05) must treat a subscription row with zero total tokens as
  // UNPRICEABLE and never render it as $0.00 of covered spend. The
  // `:tokens-unreported` toolName suffix is that distinguishing signal.
  const tokensReported = promptTokens != null || completionTokens != null;

  return {
    provider,
    // D-06: model = the SAME opaque gateway id as provider. No gateway event
    // carries a real model id anywhere in the pipe (RESEARCH.md verified) —
    // the fallback shadowForProvider mapping row is the only rate path.
    model: provider,
    promptTokens: promptTokens ?? 0,
    completionTokens: completionTokens ?? 0,
    totalTokens: (promptTokens ?? 0) + (completionTokens ?? 0),
    latencyMs: d.duration_ms ?? d.durationMs ?? 0,
    cost: d.cost_usd ?? d.costUsd,
    sessionId: d.session_id ?? d.sessionId,
    timestamp,
    toolName: tokensReported ? `gateway:${provider}` : `gateway:${provider}:tokens-unreported`,
  };
}

// ---------------------------------------------------------------------------
// Phase 105 D-01/D-02/D-05/D-06 — tool_executed + tool_policy_event helpers
// ---------------------------------------------------------------------------

/**
 * Constant provider tag for every `toolExecutions` row written from
 * Ástríðr's `tool_executed` runtime event. Assigned by the RECEIVER, never
 * read from the payload (T-105-12) — a mis-sent or absent `provider` field
 * in the payload can never land a row in another source's bucket. Plans
 * 105-01 and 105-06 both string-match on this exact value.
 */
export const ASTRIDR_TOOL_PROVIDER = "astridr";

/**
 * Resolves a `tool_executed` payload into the args for
 * `api.toolExecutions.insert` (D-01: per-call row, distinct from the
 * cumulative `callGraphEdges` counter this case also still writes).
 * Exported for unit testing.
 */
export function resolveToolExecutionRow(d: any, timestamp: number) {
  return {
    sessionId: d.sessionId ?? d.session_id ?? "unknown",
    toolName: d.toolName ?? d.tool_name ?? "unknown",
    success: d.success ?? true,
    durationMs: d.durationMs ?? d.duration_ms,
    traceId: d.traceId ?? d.trace_id,
    round: d.round,
    provider: ASTRIDR_TOOL_PROVIDER,
    timestamp,
  };
}

/**
 * Phase 105-09 (live gate, 2026-08-04): `command_execution` is sent
 * exclusively by astridr/engine/execution_tracker.py, which wraps EVERY
 * tool call loop.py makes (origin "user_request" included, not just
 * automation) — this insert was leaving a second, untagged toolExecutions
 * row for every single Ástríðr tool call, alongside the correctly-tagged
 * row `resolveToolExecutionRow` produces for the same call's "tool_executed"
 * event. Untagged meant D-15's `excludeProvider: "astridr"` filter never
 * caught it, so Ástríðr's tools were leaking into ToolExecutionPanel and
 * PermissionDecisionsChart (confirmed live: one real weather induction
 * bumped the Claude-Code-only successRate's "weather" count from 2 to 3).
 * Tagged the same way, extracted for unit-test coverage per this file's
 * established pure-function convention.
 */
export function resolveCommandExecutionToolRow(
  d: any,
  execStatus: string,
  timestamp: number
) {
  return {
    sessionId: d.profileId ?? d.profile_id ?? "unknown",
    toolName: d.toolName ?? d.tool_name ?? "unknown",
    durationMs: d.durationMs ?? d.duration_ms,
    success: execStatus === "completed",
    errorMessage: d.errorMessage ?? d.error_message ?? d.error,
    provider: ASTRIDR_TOOL_PROVIDER,
    timestamp,
  };
}

/** The 4 kinds Ástríðr's `tool_policy_event` can send — see docs/astridr-contract.md §2.34. */
export const TOOL_POLICY_EVENT_KINDS = [
  "malformed_policy_boot",
  "malformed_policy_reload_rejected",
  "execution_denied",
  "tool_call_leaked_as_text",
] as const;

/** Model-generated `tool` text and exception-derived `error` text are bounded
 * before they ever reach a persisted field (T-105-11). */
export const TOOL_POLICY_ERROR_MAX_LEN = 500;

export interface ToolPolicyEventArgs {
  event: string;
  tool?: string;
  sessionId?: string;
  agentId?: string;
  taskCategory?: string;
  toolWasOffered?: boolean;
  toolsOfferedCount?: number;
  round?: number;
  field?: string;
  error?: string;
  timestamp: number;
}

function truncatePolicyError(error: string | undefined): string | undefined {
  if (error == null) return undefined;
  if (error.length <= TOOL_POLICY_ERROR_MAX_LEN) return error;
  return error.slice(0, TOOL_POLICY_ERROR_MAX_LEN) + "... [truncated]";
}

/**
 * Parses a `tool_policy_event` payload into the args for
 * `internal.toolPolicyEvents.record`, or `null` for an unrecognised/absent
 * `event` value — an unknown kind is REJECTED, not stored under a made-up
 * label and not silently dropped without trace (the caller logs a warning
 * on `null`, D-05/D-06/T-105-15). Dual snake/camel coalescing on every
 * field per the WR-06/168-06 defensive-ingest convention: astridr sends
 * `tool_was_offered`/`tools_offered_count` in snake_case while sending
 * `sessionId`/`taskCategory` in camelCase (verified live in plan 105-02) —
 * the mixed casing is real, which is exactly why both are coalesced.
 * Exported for unit testing.
 */
export function parseToolPolicyEvent(d: any, timestamp: number): ToolPolicyEventArgs | null {
  const event = d?.event;
  if (typeof event !== "string" || !(TOOL_POLICY_EVENT_KINDS as readonly string[]).includes(event)) {
    return null;
  }

  return {
    event,
    tool: d.tool,
    sessionId: d.sessionId ?? d.session_id,
    agentId: d.agentId ?? d.agent_id,
    taskCategory: d.taskCategory ?? d.task_category,
    // toolsOfferedCount: 0 (the filter offered zero tools) must survive
    // distinctly from undefined (no filter was active) — `??` (not `||`)
    // preserves 0 because only null/undefined trigger the fallback.
    toolWasOffered: d.toolWasOffered ?? d.tool_was_offered,
    toolsOfferedCount: d.toolsOfferedCount ?? d.tools_offered_count,
    round: d.round,
    field: d.field,
    error: truncatePolicyError(d.error),
    timestamp,
  };
}

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
    return new Response(null, { status: 204, headers: getCorsHeaders(request) });
  }

  // CPHLTH-02: Require Bearer token auth on all ingest endpoints.
  if (!validateIngestAuth(request)) {
    return unauthorizedResponse();
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

      // Always insert into legacy runtime_events. For graph_snapshot, store a
      // compact summary (not the full nodes/links blob) so the insert stays
      // under Convex's ~1 MiB per-document limit — the full graph is persisted
      // row-based by the graphSnapshots receiver below.
      await ctx.runMutation(api.events.insertEvent, {
        eventType: evt.eventType,
        data: legacyEventData(evt.eventType, data),
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
            agentId: d.agentId ?? d.agent_id,
            toolName: d.toolName ?? d.tool_name,
            goalId: d.goalId ?? d.goal_id,            // Phase 149 PULSE-01 — cost-by-goal join
            traceId: d.traceId ?? d.trace_id,         // Phase 94 TRACE-01 — per-turn trace grouping
            cacheReadInputTokens: d.cacheReadInputTokens ?? d.cache_read_input_tokens,
            cacheCreationInputTokens: d.cacheCreationInputTokens ?? d.cache_creation_input_tokens,
            round: d.round, // Phase 105 D-10
          });
          break;
        }
        case "task_quality": {
          // Phase 93 (EVAL-01): Ástríðr's langfuse_eval.py task_quality scores,
          // currently dropped on the floor — now persisted to evalScores.
          // Inherits the validateIngestAuth Bearer gate above (T-93-02); no new
          // route or auth check added. WR-06: ingestTaskQuality is an
          // internalMutation reachable ONLY through this authenticated route —
          // as a public mutation it was directly callable with just the
          // deployment URL. Idempotent dedup + NaN/out-of-range rejection
          // happen inside ingestTaskQuality (T-93-01/T-93-03).
          const d = data as any;
          const parsed = processTaskQualityEvent(d, timestamp);
          await ctx.runMutation(internal.evalScores.ingestTaskQuality, {
            profileId: parsed.profileId,
            sessionId: parsed.sessionId,
            overall: parsed.overall,
            idempotencyKey: parsed.idempotencyKey,
            timestamp: parsed.timestamp,
          });
          break;
        }
        case "swarm_task": {
          // Phase 149 PULSE-01 — route Ástríðr swarm lifecycle events to swarmTasks.
          // Inherits the validateIngestAuth Bearer-token gate above (T-149-01).
          // Normalizes "completed" → "done" (UI vocabulary per RESEARCH L603-617).
          // Timestamp normalization: Ástríðr emits Python time.time() (seconds,
          // ~1.78e9). Store as ms (< 1e12 → multiply by 1000) so BlackboardPanel's
          // formatElapsed and Date.now() comparisons are in consistent units (gap-149).
          const d = data as any;
          const rawState: string = d.state ?? "pending";
          const state = rawState === "completed" ? "done" : rawState;
          const tsMs = timestamp < 1e12 ? timestamp * 1000 : timestamp;
          await ctx.runMutation(api.swarmTasks.upsert, {
            goalId: d.goal_id ?? d.goalId ?? "unknown",
            subtaskId: d.subtask_id ?? d.subtaskId ?? "unknown",
            state,
            subtask: d.subtask ?? "",
            dependsOn: d.depends_on ?? d.dependsOn ?? [],
            claimedBy: d.claimed_by ?? d.claimedBy,
            model: d.model,
            agentId: d.agent_id ?? d.agentId,
            timestamp: tsMs,
          });
          break;
        }
        case "subagent_job": {
          // Phase 168 (background subagents) — route a background delegate_task
          // TERMINAL-state event (completed/failed/cancelled — never queued/
          // running, those live only in Supabase, read via check_job) into the
          // standalone subagentJobs table (D-09: NOT swarmTasks). Inherits the
          // validateIngestAuth Bearer-token gate above. Dual snake/camel read
          // mirrors case "swarm_task", even though the live emitter (Phase
          // 168-04 fix) sends camelCase only. submittedAt/finishedAt are Unix
          // epoch SECONDS per docs/astridr-contract.md §2.31 (no ms conversion
          // — unlike swarm_task, this table has no shared ms-unit consumer).
          // submittedAt is documented as not-yet-populated by the emitter; the
          // upsert mutation itself falls back to finishedAt/now on first insert.
          const d = data as any;
          // 168-06 live fix: coalesce null → undefined on every optional
          // field. Convex v.optional(v.string()) accepts an ABSENT field,
          // not JSON null — one null resultSnippet from a legacy/null-
          // emitting runtime poisoned a whole 8-event batch live
          // (ArgumentValidationError). The emitter now strips None keys,
          // but this ingest boundary must be defensive regardless.
          await ctx.runMutation(api.subagentJobs.upsert, {
            jobId: d.job_id ?? d.jobId ?? "unknown",
            agentTypeId: d.agent_type_id ?? d.agentTypeId ?? "unknown",
            status: d.status ?? "unknown",
            taskSnippet: d.task_snippet ?? d.taskSnippet ?? "",
            resultSnippet: d.result_snippet ?? d.resultSnippet ?? undefined,
            error: d.error ?? undefined,
            channelId: d.channel_id ?? d.channelId ?? undefined,
            chatId: d.chat_id ?? d.chatId ?? undefined,
            submittedAt: d.submitted_at ?? d.submittedAt ?? undefined,
            finishedAt: d.finished_at ?? d.finishedAt ?? timestamp,
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
            const activeIds: string[] = [];
            for (const c of d.containers) {
              const cid = c.id ?? c.name ?? "unknown";
              activeIds.push(cid);
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
            // Remove orphan records not in the current container list
            await ctx.runMutation(api.docker.reconcile, {
              activeContainerIds: activeIds,
            });
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
            // WR-07: this is the Ástríðr runtime sync, not an operator action —
            // the configChanges audit row must not claim "dashboard".
            changedBy: "astridr-sync",
          });
          break;
        }
        case "model_routing": {
          // Phase 103 (BSC-01, D-14): astridr's ModelRouter._emit_model_routing
          // (router.py:426) already sends this event on every resolution — this
          // case extends it into the per-profile activeEngineSnapshots table
          // (103-CONTRACT.md §4). Dual snake/camelCase coalescing is
          // load-bearing, not decoration: this file's own WR-06/168-06 lesson
          // (see the subagent_job case above) records that a single unhandled
          // null here previously poisoned an 8-event production batch.
          const d = data as any;
          const routedProfileId = d.profileId ?? d.profile_id;
          const routedModel = d.model;
          // Phase 108 (ENGINE-01, research Item 6): latestByProfile has no status
          // filter, so a failed resolution would render as the live engine. Skip,
          // don't throw (WR-06/168-06). See controlVerbSwaps.ts for the D-13
          // contrast: refusals ARE valid rows there — this is a different table.
          if (d.status === "failed") {
            break;
          }
          // UAT 2026-07-29 (103-UAT.md test 2): this case used to coalesce BOTH fields to the
          // literal string "unknown" and store the row. That is not a defensive default here the
          // way it is for the display-only fields below — it manufactures a per-profile engine
          // reading out of the absence of one, and D-14 forbids exactly that. One such row
          // ({profileId:"unknown", model:"unknown"}) reached production and made the
          // dashboard-wide badge render "unknown" as a confirmed-live engine.
          // Skipping (never throwing) keeps this file's own WR-06/168-06 lesson intact: one
          // unusable event must not poison the rest of the batch.
          if (isUnresolvedRouting({ profileId: routedProfileId, model: routedModel })) {
            break;
          }
          await ctx.runMutation(internal.activeEngine.recordRouting, {
            profileId: routedProfileId,
            model: routedModel,
            mode: d.mode ?? "inherited",
            selectionPath: d.selectionPath ?? d.selection_path,
            expiresAt: d.expiresAt ?? d.expires_at,
            timestamp,
          });
          break;
        }
        case "control_verb_swap": {
          // Phase 108 (TELE-02, D-13/D-14): routes a swap-attempt event into
          // the controlVerbSwaps domain table (convex/controlVerbSwaps.ts,
          // plan 108-02), in addition to the generic runtime_events row this
          // file already writes for every event above. Dual snake/camelCase
          // coalescing on every field, same WR-06/168-06 discipline as the
          // model_routing case above: a single unhandled null here previously
          // poisoned an 8-event production batch.
          //
          // D-13: unlike model_routing, there is deliberately NO
          // isUnresolvedRouting-equivalent guard here. A refusal (affinity
          // guard, resolver failure) IS a valid row for this table — that is
          // the whole point of the swap-history axis: a history that stores
          // only successes claims every swap worked. Do not "harden" this
          // case into dropping refusals.
          const d = data as any;
          const verb = d.verb;
          const path_ = d.path;
          const channel = d.channel;
          if (!verb || !path_ || !channel) {
            break;
          }
          await ctx.runMutation(internal.controlVerbSwaps.record, {
            verb,
            target: d.target,
            resolved: d.resolved,
            providerAffinity: d.providerAffinity ?? d.provider_affinity,
            voiceId: d.voiceId ?? d.voice_id,
            path: path_,
            reason: d.reason,
            scope: d.scope ?? d.profileId ?? d.profile_id,
            sessionId: d.sessionId ?? d.session_id,
            channel,
            timestamp,
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
          // Bridge to gitActivity table for the GitActivityWidget
          await ctx.runMutation(api.gitActivity.insert, {
            sessionId: d.sessionId ?? d.session_id ?? "system:git",
            type: "commit",
            linesAdded: d.linesAdded ?? d.lines_added,
            linesRemoved: d.linesRemoved ?? d.lines_removed,
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
          const d = data as any;
          const execStatus = d.status ?? "queued";
          await ctx.runMutation(api.commandExecutions.upsertLifecycle, {
            executionId: d.executionId ?? d.execution_id ?? "unknown",
            toolName: d.toolName ?? d.tool_name,
            origin: d.origin,
            profileId: d.profileId ?? d.profile_id,
            channelId: d.channelId ?? d.channel_id,
            status: execStatus,
            queuedAt: d.queuedAt ?? d.queued_at ?? timestamp,
            startedAt: d.startedAt ?? d.started_at,
            completedAt: d.completedAt ?? d.completed_at,
            durationMs: d.durationMs ?? d.duration_ms,
            errorMessage: d.errorMessage ?? d.error_message ?? d.error,
            contextSnapshot: d.contextSnapshot ?? d.context_snapshot,
            parentExecutionId: d.parentExecutionId ?? d.parent_execution_id,
          });
          // Populate toolExecutions table on terminal states for the dashboard panel
          const terminalStates = ["completed", "failed", "timed_out", "cancelled"];
          if (terminalStates.includes(execStatus)) {
            await ctx.runMutation(
              api.toolExecutions.insert,
              resolveCommandExecutionToolRow(d, execStatus, timestamp)
            );
          }
          // Populate executionModes for execution depth distribution
          if (d.roundsDepth ?? d.rounds_depth) {
            await ctx.runMutation(api.executionModes.insert, {
              executionId: d.executionId ?? d.execution_id ?? "unknown",
              mode: d.mode ?? execStatus,
              roundsDepth: d.roundsDepth ?? d.rounds_depth ?? 1,
              fillerCount: d.fillerCount ?? d.filler_count,
              stalledAt: d.stalledAt ?? d.stalled_at,
              timestamp,
            });
          }
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
            costUsd: d.costUsd ?? d.cost_usd,
            sessionId: d.sessionId ?? d.session_id,
            toolCallCount: d.toolCallCount ?? d.tool_call_count,
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
          // Populate callGraphEdges from hive_mind_entry data (D-04, per RESEARCH.md A1 resolution)
          const hiveMindAgent = d.agent_type ?? d.agentType;
          if ((d.tool_name ?? d.toolName) && hiveMindAgent) {
            await ctx.runMutation(api.callGraphEdges.upsertEdge, {
              agentId: hiveMindAgent,
              toolName: d.tool_name ?? d.toolName ?? "unknown",
              sessionId: d.session_key ?? d.sessionKey ?? d.sessionId ?? d.session_id ?? "unknown",
              success: d.success ?? true,
              timestamp,
            });
          }
          break;
        }
        case "tool_executed": {
          // M1.P1: agent↔tool call-graph edge emitted on EVERY tool execution
          // (success or failure) by Ástríðr's agent loop. Broader source than
          // hive_mind_entry, which only covered multi-agent coordination calls.
          // Phase 105 D-01/D-02/D-03: this case now feeds BOTH callGraphEdges
          // (cumulative, unchanged, still powers Tool Galaxy) AND toolExecutions
          // (a per-call row tagged provider: "astridr", giving OBS-01 "over
          // time" history and OBS-03 trace-waterfall nesting via traceId/round —
          // neither existed from any Ástríðr source before this phase).
          const d = data as any;
          const toolExecutedAgent = d.agentId ?? d.agent_id;
          if (toolExecutedAgent) {
            await ctx.runMutation(api.callGraphEdges.upsertEdge, {
              agentId: toolExecutedAgent,
              toolName: d.toolName ?? d.tool_name ?? "unknown",
              sessionId: d.sessionId ?? d.session_id ?? "unknown",
              success: d.success ?? true,
              timestamp,
            });
          }
          await ctx.runMutation(api.toolExecutions.insert, resolveToolExecutionRow(d, timestamp));
          break;
        }
        case "kits_snapshot": {
          // Phase 72: tool-kit membership snapshot from Ástríðr. Upserts each
          // kit idempotently by name, replacing its `tools` array wholesale.
          const d = data as any;
          if (Array.isArray(d.kits)) {
            const updatedAt = d.timestamp ?? timestamp;
            for (const kit of d.kits) {
              const name = kit?.name;
              if (!name) continue;
              await ctx.runMutation(api.kits.upsertKit, {
                name,
                description: kit.description,
                tools: Array.isArray(kit.tools) ? kit.tools : [],
                updatedAt,
              });
            }
          }
          break;
        }
        case "kg_summary": {
          // Phase 135 emitter → Phase 74 KG Explorer summary cards (KG-01).
          // Latest-wins upsert of the single KG summary snapshot. Field names
          // mirror the live emitter (currentTripleCount / historicalTripleCount).
          const d = data as any;
          await ctx.runMutation(api.kg.upsertSummary, {
            entitiesByType: d.entitiesByType ?? d.entities_by_type ?? {},
            currentTripleCount:
              d.currentTripleCount ?? d.current_triple_count ?? d.currentTriples ?? 0,
            historicalTripleCount:
              d.historicalTripleCount ??
              d.historical_triple_count ??
              d.historicalTriples ??
              0,
            contradictionCount:
              d.contradictionCount ?? d.contradiction_count ?? 0,
            lastExtractionAt: d.lastExtractionAt ?? d.last_extraction_at ?? undefined,
            updatedAt: d.timestamp ?? timestamp,
          });
          break;
        }
        case "kg_answer_sync": {
          // Phase 187 emitter (GLXY-01) → /knowledge-graph 3D galaxy camera
          // fly + source-node lighting (docs/astridr-contract.md §2.41).
          // Latest-wins upsert (single row, mirrors kg_summary's discipline
          // exactly). Unknown/extra payload fields are dropped — only the
          // four declared args below reach the validated mutation (V5).
          const d = data as any;
          await ctx.runMutation(api.kg.upsertAnswerSync, {
            turnId: d.turnId ?? "",
            sourceNodeIds: d.sourceNodeIds ?? d.source_node_ids ?? [],
            primaryEntityName:
              d.primaryEntityName ?? d.primary_entity_name ?? undefined,
            updatedAt: d.timestamp ?? timestamp,
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
            createdAt: d.createdAt ?? d.created_at ?? Date.now(),
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
        case "operator_score": {
          const d = data as any;
          await ctx.runMutation(api.operatorScores.insert, {
            score: d.score ?? 0,
            memoryFreshness: d.memoryFreshness ?? d.memory_freshness ?? 0,
            skillRoi: d.skillRoi ?? d.skill_roi ?? 0,
            activityLevel: d.activityLevel ?? d.activity_level ?? 0,
            uptime: d.uptime ?? 0,
            trendDay: d.trendDay ?? d.trend_day ?? undefined,
            trend7d: d.trend7d ?? d.trend_7d ?? undefined,
            computedAt: d.computedAt ?? d.computed_at ?? Date.now(),
          });
          break;
        }
        case "gateway.task_completed": {
          const d = data as any;
          const provider = d.provider ?? "unknown";
          const sessionId = d.session_id ?? d.sessionId ?? "unknown";
          await ctx.runMutation(api.toolExecutions.insert, {
            sessionId,
            toolName: `gateway:${provider}`,
            provider,
            success: true,
            durationMs: d.duration_ms ?? d.durationMs,
            timestamp,
          });
          await ctx.runMutation(api.sessions.upsert, {
            sessionId,
            provider,
          });
          break;
        }
        case "gateway_task_completed": {
          // D-18 (Phase 104): UNDERSCORE — distinct from "gateway.task_completed"
          // (DOT) above. This is the CLI-gateway sidecar's task-completed
          // webhook, forwarded verbatim by astridr's web.py
          // /internal/gateway/task_completed handler, and the only gateway
          // event that carries cost_usd. Previously unrouted (fell through to
          // the generic events.insertEvent above, where cost/tokens/model were
          // never queryable). ADDITIVE ONLY: does not alter the dot-named case
          // above or any other case in this switch. Inherits the
          // validateIngestAuth Bearer gate above — no new route, no second
          // auth check. The recordCall write is isolated in its own try/catch
          // so a failure here cannot roll back the surrounding ingest
          // transaction or widen the hot path's failure surface (CLAUDE.md).
          const d = data as any;
          const recordCallArgs = resolveGatewayTaskCompleted(d, timestamp);
          if (recordCallArgs) {
            try {
              await ctx.runMutation(api.llm.recordCall, recordCallArgs);
            } catch (err) {
              console.warn(
                "[runtimeIngest] gateway_task_completed: recordCall failed:",
                (err as Error).message
              );
            }
          } else {
            console.warn(
              `[runtimeIngest] gateway_task_completed: unrecognized provider id "${d.provider ?? d.account ?? "unknown"}" — skipping llmMetrics write (unpriceable)`
            );
          }
          break;
        }
        case "gateway.task_failed": {
          const d = data as any;
          const provider = d.provider ?? "unknown";
          const sessionId = d.session_id ?? d.sessionId ?? "unknown";
          await ctx.runMutation(api.toolExecutions.insert, {
            sessionId,
            toolName: `gateway:${provider}`,
            provider,
            success: false,
            errorMessage: d.error ?? "Task failed",
            timestamp,
          });
          break;
        }
        case "gateway.task_started": {
          const d = data as any;
          const provider = d.provider ?? "unknown";
          const sessionId = d.session_id ?? d.sessionId ?? "unknown";
          await ctx.runMutation(api.toolExecutions.insert, {
            sessionId,
            toolName: `gateway:${provider}`,
            provider,
            success: true,
            timestamp,
          });
          break;
        }
        case "gateway.routing_decision": {
          const d = data as any;
          const sessionId = d.session_id ?? d.sessionId ?? "unknown";
          await ctx.runMutation(api.events.ingest, {
            sessionId,
            eventType: "gateway.routing_decision",
            payload: d,
            timestamp,
            // Phase 88 D-04: pass producer dedup key (D-05: undefined → counted as unique)
            idempotencyKey: d.idempotencyKey ?? d.event_id,
          });
          break;
        }
        case "graph_snapshot": {
          // Phase 83 (GH-01): Graph snapshot receiver — persists Ástríðr's nightly
          // graphify + vault snapshot instead of dropping it. Row-based storage to
          // avoid Convex array-element (8192) and doc-size (~1 MiB) limits.
          // internalMutation (not api.*) — httpAction has no Clerk identity (Pitfall 1).
          const d = data as any;
          await ctx.runMutation(internal.graphSnapshots.upsertGraphSnapshot, {
            snapshotId:  d.snapshotId ?? "astridr-project-graph",
            nodes:       Array.isArray(d.nodes) ? d.nodes : [],
            links:       Array.isArray(d.links) ? d.links : [],
            sources:     Array.isArray(d.sources) ? d.sources : [],
            nodeCount:   d.nodeCount ?? 0,
            linkCount:   d.linkCount ?? 0,
            generatedAt: d.generatedAt ?? timestamp,
            receivedAt:  timestamp,
          });
          break;
        }
        case "kg_benchmark": {
          // Phase 180 (KG-BENCH-02, D-09): CI KG-vs-vector benchmark run →
          // insert-only kgBenchmarkRuns table. recordRun is an internalMutation
          // (07 review #1) so this ingest path is genuinely gated by the
          // validateIngestAuth Bearer check above (T-180-10) and NOT directly
          // callable by an anonymous client — matching the WR-06 convention.
          // Field shape = docs/astridr-contract.md §2.33. Dual snake/camel
          // coalescing with typed defaults per the WR-06/168-06 ingest-boundary
          // convention — the boundary stays defensive regardless of emitter.
          const d = data as any;
          await ctx.runMutation(internal.kgBenchmark.recordRun, {
            runTag: d.runTag ?? d.run_tag ?? "unknown",
            verdict: d.verdict ?? "error",
            categories: d.categories ?? {},
            suiteSize: d.suiteSize ?? d.suite_size ?? 0,
            durationMs: d.durationMs ?? d.duration_ms ?? 0,
            workflowRunUrl: d.workflowRunUrl ?? d.workflow_run_url,
            timestamp,
          });
          break;
        }
        case "tool_policy_event": {
          // Phase 105 D-05/D-06: 4 kinds — malformed_policy_boot,
          // malformed_policy_reload_rejected, execution_denied,
          // tool_call_leaked_as_text. Before this case existed, all four were
          // silently discarded (no case, no default). record is an
          // internalMutation (T-105-10), so this table is reachable only
          // through this already-Bearer-gated httpAction. An unrecognised
          // kind is logged, never stored under a made-up label and never
          // silently dropped without trace (T-105-15) — deliberately NOT a
          // catch-all fallback arm on the switch itself (105-03-PLAN.md
          // finding F1: a catch-all here would mask a fifth future kind's
          // absence the same way this switch's missing case masked these four).
          const parsed = parseToolPolicyEvent(data as any, timestamp);
          if (parsed) {
            await ctx.runMutation(internal.toolPolicyEvents.record, parsed);
          } else {
            console.warn(
              `tool_policy_event: unrecognised or missing "event" value, dropped: ${(data as any)?.event}`
            );
          }
          break;
        }
      }
    }

    // Phase 6 critical-eval trigger DISABLED 2026-07-14 (self-hosted incident).
    // The inline runMutation blocked every ingest POST behind a 15s timeout;
    // deferring it via scheduler was worse: the rate-limit timestamp only
    // persists on SUCCESS (mutation rollback erases it on timeout), so every
    // POST enqueued another doomed 15s-burning job and saturated the executor.
    // Re-enable only once evaluateCriticalInternal reliably completes on this
    // instance AND the rate-limit timestamp is written outside the eval itself.
    // (Critical alerting is also covered by the hourly evaluate-alert-rules
    // cron once that is re-enabled — see convex/crons.ts.)

    return new Response(JSON.stringify({ ingested: events.length }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    });
  }
});
