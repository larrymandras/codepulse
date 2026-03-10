import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

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

/** Helper: extract a numeric value from an OTel data point */
function getPointValue(dp: { asInt?: string | number; asDouble?: number }): number {
  if (dp.asInt !== undefined) return typeof dp.asInt === "string" ? parseInt(dp.asInt, 10) : dp.asInt;
  if (dp.asDouble !== undefined) return dp.asDouble;
  return 0;
}

/** Helper: convert OTel nanos timestamp to epoch seconds */
function nanoToSec(nanos: string | number | undefined): number {
  if (!nanos) return Date.now() / 1000;
  const n = typeof nanos === "string" ? parseInt(nanos, 10) : nanos;
  return n / 1_000_000_000;
}

/**
 * POST /v1/metrics — OpenTelemetry-compatible metrics receiver (JSON)
 *
 * Accepts the OTLP JSON metrics export format and routes metrics
 * to the appropriate Convex domain tables.
 */
export const otelMetricsIngest = httpAction(async (ctx, request) => {
  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Reject non-JSON content types (gRPC / protobuf)
  const ct = request.headers.get("Content-Type") ?? "";
  if (ct.includes("grpc") || ct.includes("protobuf") || ct.includes("octet-stream")) {
    return new Response(
      JSON.stringify({
        error: "Unsupported content type. This endpoint only accepts application/json. Send OTel data with OTEL_EXPORTER_OTLP_PROTOCOL=http/json.",
      }),
      { status: 415, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  try {
    const body = await request.json();
    const resourceMetrics: any[] = body.resourceMetrics ?? [];
    let processed = 0;

    for (const rm of resourceMetrics) {
      // Extract session.id from resource attributes
      const resourceAttrs: any[] = rm.resource?.attributes ?? [];
      const sessionId = getAttr(resourceAttrs, "session.id") ?? getAttr(resourceAttrs, "service.instance.id") ?? "unknown";

      const scopeMetrics: any[] = rm.scopeMetrics ?? [];
      for (const sm of scopeMetrics) {
        const metrics: any[] = sm.metrics ?? [];
        for (const metric of metrics) {
          const name: string = metric.name ?? "";
          // Collect data points from sum, gauge, or histogram
          const dataPoints: any[] =
            metric.sum?.dataPoints ??
            metric.gauge?.dataPoints ??
            metric.histogram?.dataPoints ??
            [];

          for (const dp of dataPoints) {
            const ts = nanoToSec(dp.timeUnixNano ?? dp.startTimeUnixNano);
            const dpAttrs: any[] = dp.attributes ?? [];
            const value = getPointValue(dp);

            try {
              await routeMetric(ctx, name, sessionId, value, ts, dpAttrs);
              processed++;
            } catch (e: any) {
              // Log but don't fail the whole request for one bad metric
              console.error(`Failed to route metric ${name}: ${e.message}`);
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, processed }), {
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

/** Route an individual metric data point to the correct domain table */
async function routeMetric(
  ctx: any,
  name: string,
  sessionId: string,
  value: number,
  timestamp: number,
  attrs: any[]
) {
  switch (name) {
    case "claude_code.session.count": {
      // Increment session tracking — upsert into sessions table
      await ctx.runMutation(api.sessions.upsert, {
        sessionId,
      });
      break;
    }

    case "claude_code.lines_of_code.count": {
      const locType = getAttr(attrs, "type"); // "added" or "removed"
      const type = locType === "added" || locType === "removed" ? locType : "added";
      await ctx.runMutation(api.gitActivity.insert, {
        sessionId,
        type,
        linesAdded: type === "added" ? value : undefined,
        linesRemoved: type === "removed" ? value : undefined,
        timestamp,
      });
      break;
    }

    case "claude_code.pull_request.count": {
      await ctx.runMutation(api.gitActivity.insert, {
        sessionId,
        type: "pull_request",
        timestamp,
      });
      break;
    }

    case "claude_code.commit.count": {
      await ctx.runMutation(api.gitActivity.insert, {
        sessionId,
        type: "commit",
        timestamp,
      });
      break;
    }

    case "claude_code.cost.usage": {
      const model = getAttr(attrs, "model") ?? "unknown";
      const provider = getAttr(attrs, "provider") ?? "anthropic";
      await ctx.runMutation(api.llm.recordCall, {
        provider,
        model,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        latencyMs: 0,
        cost: value,
        sessionId,
        timestamp,
      });
      break;
    }

    case "claude_code.token.usage": {
      const tokenType = getAttr(attrs, "type"); // "input" or "output"
      const model = getAttr(attrs, "model") ?? "unknown";
      const provider = getAttr(attrs, "provider") ?? "anthropic";
      await ctx.runMutation(api.llm.recordCall, {
        provider,
        model,
        promptTokens: tokenType === "input" ? value : 0,
        completionTokens: tokenType === "output" ? value : 0,
        totalTokens: value,
        latencyMs: 0,
        sessionId,
        timestamp,
      });
      break;
    }

    case "claude_code.code_edit_tool.decision": {
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

    case "claude_code.active_time.total": {
      const timeType = getAttr(attrs, "type") ?? "active";
      await ctx.runMutation(api.activeTime.insert, {
        sessionId,
        type: timeType,
        durationSeconds: value,
        timestamp,
      });
      break;
    }

    default: {
      // Store unknown metrics in the generic events table as a fallback
      await ctx.runMutation(api.events.ingest, {
        sessionId,
        eventType: `otel_metric:${name}`,
        payload: { value, attributes: attrs },
        timestamp,
      });
      break;
    }
  }
}
