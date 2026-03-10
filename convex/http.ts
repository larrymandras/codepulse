import { httpRouter } from "convex/server";
import { runtimeIngest } from "./runtimeIngest";
import { buildIngest } from "./ingest";
import { scanEndpoint } from "./scan";
import { healthCheck } from "./health";
import { otelMetricsIngest } from "./otelMetrics";
import { otelLogsIngest } from "./otelLogs";

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

export default http;
