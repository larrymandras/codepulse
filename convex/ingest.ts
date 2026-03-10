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

    // 7. Session lifecycle events
    if (eventType === "session_end" || eventType === "session_stop") {
      await ctx.runMutation(api.sessions.markCompleted, {
        sessionId: sessionId ?? "unknown",
        status: eventType === "session_end" ? "completed" : "errored",
      });
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
