import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { getCorsHeaders, validateIngestAuth, unauthorizedResponse } from "./ingestAuth";

/** Helper: extract a string attribute value from an OTel attributes array */
function getAttr(
  attrs: Array<{ key: string; value: { stringValue?: string; intValue?: number } }> | undefined,
  key: string
): string | undefined {
  if (!attrs) return undefined;
  const attr = attrs.find((a) => a.key === key);
  if (!attr) return undefined;
  return attr.value.stringValue ?? (attr.value.intValue !== undefined ? String(attr.value.intValue) : undefined);
}

/** Helper: extract a numeric attribute value */
function getNumAttr(
  attrs: Array<{ key: string; value: { stringValue?: string; intValue?: number; doubleValue?: number } }> | undefined,
  key: string
): number | undefined {
  if (!attrs) return undefined;
  const attr = attrs.find((a) => a.key === key);
  if (!attr) return undefined;
  if (attr.value.intValue !== undefined) return typeof attr.value.intValue === "string" ? parseInt(attr.value.intValue, 10) : attr.value.intValue;
  if (attr.value.doubleValue !== undefined) return attr.value.doubleValue;
  if (attr.value.stringValue !== undefined) {
    const n = parseFloat(attr.value.stringValue);
    return isNaN(n) ? undefined : n;
  }
  return undefined;
}

/** Helper: convert OTel nanos timestamp to epoch seconds */
function nanoToSec(nanos: string | number | undefined): number {
  if (!nanos) return Date.now() / 1000;
  const n = typeof nanos === "string" ? parseInt(nanos, 10) : nanos;
  return n / 1_000_000_000;
}

/** Helper: collect all attributes into a plain object */
function attrsToObj(attrs: any[] | undefined): Record<string, string | number> {
  const obj: Record<string, string | number> = {};
  if (!attrs) return obj;
  for (const a of attrs) {
    if (a.value.stringValue !== undefined) obj[a.key] = a.value.stringValue;
    else if (a.value.intValue !== undefined) obj[a.key] = typeof a.value.intValue === "string" ? parseInt(a.value.intValue, 10) : a.value.intValue;
    else if (a.value.doubleValue !== undefined) obj[a.key] = a.value.doubleValue;
    else if (a.value.boolValue !== undefined) obj[a.key] = a.value.boolValue ? 1 : 0;
  }
  return obj;
}

/**
 * POST /v1/logs — OpenTelemetry-compatible logs/events receiver (JSON)
 *
 * Accepts the OTLP JSON logs export format and routes log records
 * to the appropriate Convex domain tables based on event.name.
 */
export const otelLogsIngest = httpAction(async (ctx, request) => {
  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(request) });
  }

  // Reject non-JSON content types (gRPC / protobuf)
  const ct = request.headers.get("Content-Type") ?? "";
  if (ct.includes("grpc") || ct.includes("protobuf") || ct.includes("octet-stream")) {
    return new Response(
      JSON.stringify({
        error: "Unsupported content type. This endpoint only accepts application/json. Send OTel data with OTEL_EXPORTER_OTLP_PROTOCOL=http/json.",
      }),
      { status: 415, headers: { "Content-Type": "application/json", ...getCorsHeaders(request) } }
    );
  }

  // CPHLTH-02: Require Bearer token auth on all ingest endpoints.
  if (!validateIngestAuth(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const resourceLogs: any[] = body.resourceLogs ?? [];
    let processed = 0;
    let failed = 0;
    const failures: Array<{ index: number; error: string }> = [];
    let recordIndex = 0;

    for (const rl of resourceLogs) {
      // Extract session.id from resource attributes
      const resourceAttrs: any[] = rl.resource?.attributes ?? [];
      const sessionId = getAttr(resourceAttrs, "session.id") ?? getAttr(resourceAttrs, "service.instance.id") ?? "unknown";

      const scopeLogs: any[] = rl.scopeLogs ?? [];
      for (const sl of scopeLogs) {
        const logRecords: any[] = sl.logRecords ?? [];
        for (const lr of logRecords) {
          const ts = nanoToSec(lr.timeUnixNano ?? lr.observedTimeUnixNano);
          const lrAttrs: any[] = lr.attributes ?? [];

          // Determine event name from attributes or body
          const eventName =
            getAttr(lrAttrs, "event.name") ??
            getAttr(lrAttrs, "name") ??
            lr.body?.stringValue ??
            "";

          const i = recordIndex++;
          try {
            await routeLogRecord(ctx, eventName, sessionId, ts, lrAttrs, lr);
            processed++;
          } catch (e: any) {
            console.error(`Failed to route log ${eventName}: ${e.message}`);
            failed++;
            if (failures.length < 10) {
              failures.push({ index: i, error: e.message });
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: failed === 0, processed, failed, failures }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
      }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    });
  }
});

/** Route an individual log record to the correct domain table */
async function routeLogRecord(
  ctx: any,
  eventName: string,
  sessionId: string,
  timestamp: number,
  attrs: any[],
  _logRecord: any
) {
  // Normalize: strip "claude_code." prefix for matching
  const normalized = eventName.startsWith("claude_code.")
    ? eventName.slice("claude_code.".length)
    : eventName;

  switch (normalized) {
    case "user_prompt": {
      const promptText = getAttr(attrs, "prompt") ?? getAttr(attrs, "message") ?? "";
      await ctx.runMutation(api.promptActivity.insert, {
        sessionId,
        promptLength: promptText.length,
        promptId: getAttr(attrs, "prompt_id"),
        timestamp,
      });
      break;
    }

    case "tool_result": {
      const toolName = getAttr(attrs, "tool_name") ?? "unknown";
      const success = getAttr(attrs, "success") !== "false";
      const durationMs = getNumAttr(attrs, "duration_ms");
      const errorMessage = getAttr(attrs, "error");
      await ctx.runMutation(api.toolExecutions.insert, {
        sessionId,
        toolName,
        success,
        durationMs,
        errorMessage,
        timestamp,
      });
      break;
    }

    case "api_request": {
      const model = getAttr(attrs, "model") ?? "unknown";
      const provider = getAttr(attrs, "provider") ?? "unknown";
      if (!getAttr(attrs, "provider")) {
        console.warn("otelLogs: api_request missing provider attribute — defaulting to unknown", { sessionId });
      }
      const promptTokens = getNumAttr(attrs, "input_tokens") ?? getNumAttr(attrs, "prompt_tokens") ?? 0;
      const completionTokens = getNumAttr(attrs, "output_tokens") ?? getNumAttr(attrs, "completion_tokens") ?? 0;
      const latencyMs = getNumAttr(attrs, "duration_ms") ?? 0;
      const cost = getNumAttr(attrs, "cost");
      await ctx.runMutation(api.llm.recordCall, {
        provider,
        model,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        latencyMs,
        cost,
        sessionId,
        timestamp,
      });
      break;
    }

    case "api_error": {
      const errorMessage = getAttr(attrs, "error") ?? getAttr(attrs, "message") ?? "unknown error";
      const model = getAttr(attrs, "model");
      const statusCode = getAttr(attrs, "status_code") ?? getAttr(attrs, "http.status_code");
      const durationMs = getNumAttr(attrs, "duration_ms");
      const attempt = getNumAttr(attrs, "attempt");
      await ctx.runMutation(api.apiErrors.insert, {
        sessionId,
        model,
        errorMessage,
        statusCode,
        durationMs,
        attempt,
        timestamp,
      });
      break;
    }

    case "tool_decision": {
      const toolName = getAttr(attrs, "tool_name") ?? "unknown";
      const decision = getAttr(attrs, "decision") ?? "allow";
      const decisionSource = getAttr(attrs, "decision_source") ?? "otel";
      await ctx.runMutation(api.permissionRequests.insert, {
        sessionId,
        toolName,
        decision,
        decisionSource,
        timestamp,
      });
      break;
    }

    case "gateway.task_completed": {
      await ctx.runMutation(api.gatewayTasks.upsert, {
        taskId: getAttr(attrs, "task_id") ?? getAttr(attrs, "taskId") ?? sessionId,
        sessionId,
        provider: getAttr(attrs, "provider") ?? "unknown",
        status: "completed",
        durationSeconds: getNumAttr(attrs, "duration_seconds"),
        timestamp,
      });
      // Keep session provider attribution (existing behavior)
      await ctx.runMutation(api.sessions.upsert, {
        sessionId,
        provider: getAttr(attrs, "provider"),
      });
      break;
    }

    case "gateway.task_failed": {
      await ctx.runMutation(api.gatewayTasks.upsert, {
        taskId: getAttr(attrs, "task_id") ?? getAttr(attrs, "taskId") ?? sessionId,
        sessionId,
        provider: getAttr(attrs, "provider") ?? "unknown",
        status: "failed",
        error: getAttr(attrs, "error") ?? "Task failed",
        timestamp,
      });
      break;
    }

    case "gateway.task_started": {
      await ctx.runMutation(api.gatewayTasks.upsert, {
        taskId: getAttr(attrs, "task_id") ?? getAttr(attrs, "taskId") ?? sessionId,
        sessionId,
        provider: getAttr(attrs, "provider") ?? "unknown",
        status: "running",
        timestamp,
      });
      break;
    }

    case "gateway.routing_decision": {
      await ctx.runMutation(api.routingDecisions.insert, {
        taskId: getAttr(attrs, "task_id") ?? getAttr(attrs, "taskId") ?? sessionId,
        requestedProvider: getAttr(attrs, "requested_provider") ?? "unknown",
        selectedProvider: getAttr(attrs, "selected_provider") ?? "unknown",
        quotaScore: getNumAttr(attrs, "quota_score"),
        latencyScore: getNumAttr(attrs, "latency_score"),
        costScore: getNumAttr(attrs, "cost_score"),
        finalScore: getNumAttr(attrs, "final_score"),
        fallbackUsed: getAttr(attrs, "fallback_used") === "true",
        timestamp,
      });
      break;
    }

    default: {
      // Store unrecognized events in the generic events table
      await ctx.runMutation(api.events.ingest, {
        sessionId,
        eventType: `otel_log:${eventName}`,
        payload: attrsToObj(attrs),
        timestamp,
      });
      break;
    }
  }
}
