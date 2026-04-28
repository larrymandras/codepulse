import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { classifyNotification } from "./notifications";
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
 * HTTP action: POST /ingest
 *
 * Build-time event ingest. Accepts a JSON body with session/event data
 * and routes to the appropriate domain tables.
 */
export const buildIngest = httpAction(async (ctx, request) => {
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
  const rateCheck = await ingestRateLimiter.limit(ctx, "ingest", { key: apiKey });
  if (!rateCheck.ok) {
    return rateLimitResponse(headers, rateCheck.retryAfter);
  }

  try {
    const body = await request.json();

    // D-09: Validate discriminator field for the generic routing endpoint.
    // This endpoint routes by eventType — strict extra-field rejection is not
    // applied here because payloads are variable per event type. The downstream
    // mutations handle field-level validation via their v.object() args.
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return validationErrorResponse(
        [{ field: "_body", message: "expected JSON object" }],
        headers,
      );
    }
    if (body.eventType !== undefined && typeof body.eventType !== "string") {
      return validationErrorResponse(
        [{ field: "eventType", message: `expected string, got ${typeof body.eventType}` }],
        headers,
      );
    }

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

    // 7. Session lifecycle events
    if (eventType === "session_end" || eventType === "session_stop") {
      await ctx.runMutation(api.sessions.markCompleted, {
        sessionId: sessionId ?? "unknown",
        status: eventType === "session_end" ? "completed" : "errored",
      });
      await ctx.runMutation(internal.briefings.onSessionCompleted, { sessionId: sessionId ?? "unknown" });
    }

    // 8. Subagent tracking from hooks
    if (eventType === "subagent_start") {
      const data = payload ?? body;
      await ctx.runMutation(api.agents.register, {
        sessionId: sessionId ?? "unknown",
        agentId: data.agentId ?? data.agent_id ?? `agent-${Date.now()}`,
        parentAgentId: data.parentAgentId ?? data.parent_agent_id,
        agentType: data.agentType ?? data.agent_type ?? "subagent",
        model: data.model,
      });
    }

    if (eventType === "subagent_stop") {
      const data = payload ?? body;
      await ctx.runMutation(api.agents.updateStatus, {
        agentId: data.agentId ?? data.agent_id ?? "unknown",
        status: data.status ?? "completed",
        endedAt: timestamp,
      });
    }

    // ============================================================
    // 9. Claude Code hook events
    // ============================================================

    const sid = sessionId ?? "unknown";

    // PostToolUse — successful tool execution
    if (eventType === "PostToolUse" || eventType === "claude_code.tool_result") {
      await ctx.runMutation(api.toolExecutions.insert, {
        sessionId: sid,
        toolName: toolName ?? data.tool_name ?? "unknown",
        durationMs: data.duration_ms ?? data.durationMs,
        success: true,
        decision: data.decision,
        decisionSource: data.decision_source ?? data.decisionSource,
        timestamp,
      });
    }

    // PostToolUseFailure — failed tool execution
    if (eventType === "PostToolUseFailure") {
      await ctx.runMutation(api.toolExecutions.insert, {
        sessionId: sid,
        toolName: toolName ?? data.tool_name ?? "unknown",
        durationMs: data.duration_ms ?? data.durationMs,
        success: false,
        errorMessage: data.error ?? data.errorMessage ?? data.error_message,
        timestamp,
      });
    }

    // PermissionRequest / tool_decision
    if (eventType === "PermissionRequest" || eventType === "claude_code.tool_decision") {
      await ctx.runMutation(api.permissionRequests.insert, {
        sessionId: sid,
        toolName: toolName ?? data.tool_name ?? "unknown",
        decision: data.decision ?? "unknown",
        decisionSource: data.decision_source ?? data.decisionSource ?? "unknown",
        timestamp,
      });
    }

    // Stop — mark session completed
    if (eventType === "Stop") {
      await ctx.runMutation(api.sessions.markCompleted, {
        sessionId: sid,
        status: "completed",
      });
      await ctx.runMutation(internal.briefings.onSessionCompleted, { sessionId: sid });
    }

    // TaskCompleted — agent coordination
    if (eventType === "TaskCompleted") {
      await ctx.runMutation(api.events.ingest, {
        sessionId: sid,
        eventType: "TaskCompleted",
        toolName,
        filePath,
        payload: data,
        hookType: "TaskCompleted",
        timestamp,
      });
    }

    // InstructionsLoaded — CLAUDE.md files
    if (eventType === "InstructionsLoaded") {
      const files = data.files ?? (data.filePath ? [data.filePath] : []);
      for (const fp of files) {
        await ctx.runMutation(api.instructionsLoaded.insert, {
          sessionId: sid,
          filePath: typeof fp === "string" ? fp : String(fp),
          timestamp,
        });
      }
    }

    // ConfigChange — store in configChanges for drift tracking
    if (eventType === "ConfigChange") {
      const configKey = data.config_source ?? data.configSource ?? data.key ?? "unknown";
      const oldVal = data.old_value ?? data.oldValue;
      const newVal = data.new_value ?? data.newValue ?? data.value;
      await ctx.runMutation(api.drift.recordChange, {
        configKey: `config:${configKey}`,
        oldValue: oldVal !== undefined ? String(oldVal) : undefined,
        newValue: newVal !== undefined ? String(newVal) : "changed",
        changedBy: data.changedBy ?? sid,
        changedAt: timestamp,
      });
    }

    // WorktreeCreate / WorktreeRemove
    if (eventType === "WorktreeCreate" || eventType === "WorktreeRemove") {
      await ctx.runMutation(api.worktreeEvents.insert, {
        sessionId: sid,
        type: eventType === "WorktreeCreate" ? "create" : "remove",
        worktreePath: data.worktree_path ?? data.worktreePath,
        branch: data.branch,
        timestamp,
      });
    }

    // PreCompact — context compaction
    if (eventType === "PreCompact") {
      await ctx.runMutation(api.compactionEvents.insert, {
        sessionId: sid,
        trigger: data.trigger ?? "auto",
        timestamp,
      });
    }

    // UserPromptSubmit / claude_code.user_prompt
    if (eventType === "UserPromptSubmit" || eventType === "claude_code.user_prompt") {
      await ctx.runMutation(api.promptActivity.insert, {
        sessionId: sid,
        promptLength: data.prompt_length ?? data.promptLength ?? 0,
        promptId: data.prompt_id ?? data.promptId,
        timestamp,
      });
    }

    // claude_code.api_error — API errors
    if (eventType === "claude_code.api_error") {
      await ctx.runMutation(api.apiErrors.insert, {
        sessionId: sid,
        model: data.model,
        errorMessage: data.error ?? data.errorMessage ?? data.error_message ?? "unknown",
        statusCode: data.status_code != null ? String(data.status_code) : data.statusCode,
        durationMs: data.duration_ms ?? data.durationMs,
        attempt: data.attempt,
        timestamp,
      });
    }

    // ============================================================
    // 10. Ástríðr runtime health events
    // ============================================================

    // channel_health — upsert latest per channel
    if (eventType === "channel_health") {
      await ctx.runMutation(api.channelHealth.upsert, {
        channelId: data.channelId ?? "unknown",
        status: data.status ?? "unknown",
        messagesLastHour: data.messagesLastHour ?? 0,
        avgResponseMs: data.avgResponseMs ?? 0,
        errorCount: data.errorCount ?? 0,
        lastMessageAt: data.lastMessageAt ?? 0,
        details: data.details,
        timestamp,
      });
    }

    // Classify channel health changes as notifications
    if (eventType === "channel_health" && (data.status === "degraded" || data.status === "down")) {
      const notification = classifyNotification({
        severity: data.status === "down" ? "error" : "warning",
        category: "channel",
        title: `${data.channelId} channel ${data.status}`,
        message: `Channel ${data.channelId} is ${data.status}. Error count: ${data.errorCount ?? 0}`,
      });
      await ctx.runMutation(api.notifications.create, {
        type: notification.type,
        category: notification.category,
        title: notification.title,
        message: notification.message,
        severity: notification.severity,
        expiresAt: notification.expiresAt,
      });
    }

    // provider_health — upsert latest per provider
    if (eventType === "provider_health") {
      await ctx.runMutation(api.providerHealth.upsert, {
        providerName: data.providerName ?? "unknown",
        state: data.state ?? "unknown",
        latencyEmaMs: data.latencyEmaMs ?? 0,
        successRate: data.successRate ?? 0,
        consecutiveFailures: data.consecutiveFailures ?? 0,
        lastSuccessAt: data.lastSuccessAt ?? 0,
        timestamp,
      });
    }

    // provider.state_change — insert historical record for sparklines
    if (eventType === "provider.state_change") {
      await ctx.runMutation(api.providerHealth.recordStateChange, {
        providerName: data.providerName ?? "unknown",
        state: data.state ?? "unknown",
        latencyEmaMs: data.latencyEmaMs ?? 0,
        successRate: data.successRate ?? 0,
        consecutiveFailures: data.consecutiveFailures ?? 0,
        lastSuccessAt: data.lastSuccessAt ?? 0,
        timestamp,
      });
    }

    // Classify provider state changes as notifications
    if (eventType === "provider.state_change") {
      const isRecovery = data.state === "closed";
      const notification = classifyNotification({
        severity: data.state === "open" ? "error" : isRecovery ? "info" : "warning",
        category: "provider",
        title: `Provider '${data.providerName}' ${isRecovery ? "recovered" : data.state}`,
        message: `Circuit breaker ${data.state}. Success rate: ${Math.round(data.successRate ?? 0)}%`,
      });
      await ctx.runMutation(api.notifications.create, {
        type: notification.type,
        category: notification.category,
        title: notification.title,
        message: notification.message,
        severity: notification.severity,
        expiresAt: notification.expiresAt,
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
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
