import { httpRouter } from "convex/server";
import { runtimeIngest } from "./runtimeIngest";
import { buildIngest } from "./ingest";
import { scanEndpoint } from "./scan";
import { healthCheck } from "./health";
import { otelMetricsIngest } from "./otelMetrics";
import { otelLogsIngest } from "./otelLogs";
import {
  preflightIngest,
  dreamingIngest,
  advisorIngest,
  importIngest,
  startupIngest,
  authAliasIngest,
} from "./v6Ingest";

const http = httpRouter();

http.route({ path: "/runtime-ingest", method: "POST", handler: runtimeIngest });
http.route({ path: "/ingest", method: "POST", handler: buildIngest });
http.route({ path: "/scan", method: "POST", handler: scanEndpoint });
http.route({ path: "/health", method: "GET", handler: healthCheck });

// OpenTelemetry-compatible ingest endpoints
http.route({ path: "/v1/metrics", method: "POST", handler: otelMetricsIngest });
http.route({ path: "/v1/metrics", method: "OPTIONS", handler: otelMetricsIngest });
http.route({ path: "/v1/logs", method: "POST", handler: otelLogsIngest });
http.route({ path: "/v1/logs", method: "OPTIONS", handler: otelLogsIngest });

// V6.0 telemetry ingest endpoints
http.route({ path: "/preflight-ingest", method: "POST", handler: preflightIngest });
http.route({ path: "/preflight-ingest", method: "OPTIONS", handler: preflightIngest });
http.route({ path: "/dreaming-ingest", method: "POST", handler: dreamingIngest });
http.route({ path: "/dreaming-ingest", method: "OPTIONS", handler: dreamingIngest });
http.route({ path: "/advisor-ingest", method: "POST", handler: advisorIngest });
http.route({ path: "/advisor-ingest", method: "OPTIONS", handler: advisorIngest });
http.route({ path: "/import-ingest", method: "POST", handler: importIngest });
http.route({ path: "/import-ingest", method: "OPTIONS", handler: importIngest });
http.route({ path: "/startup-ingest", method: "POST", handler: startupIngest });
http.route({ path: "/startup-ingest", method: "OPTIONS", handler: startupIngest });
http.route({ path: "/auth-alias-ingest", method: "POST", handler: authAliasIngest });
http.route({ path: "/auth-alias-ingest", method: "OPTIONS", handler: authAliasIngest });

export default http;
