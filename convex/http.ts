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
import {
  warRoomIngest,
  meetingBotIngest,
  transcriptIngest,
  missionControlIngest,
} from "./warRoomIngest";
import { hrIngest } from "./hrIngest";
import { configVersionIngest } from "./configVersionIngest";
import { forgeIngest } from "./forgeIngest";
import { forgeLogIngest } from "./forgeLogIngest";
import { forgeFileIngest } from "./forgeFileIngest";
import { forgeCommandsClaim, forgeCommandsAck } from "./forgeCommands";
import { remindersIngest, remindersRead } from "./remindersIngest";

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

// Phase 72: War Room + Meeting Bot ingest endpoints
http.route({ path: "/war-room-ingest", method: "POST", handler: warRoomIngest });
http.route({ path: "/war-room-ingest", method: "OPTIONS", handler: warRoomIngest });
http.route({ path: "/meeting-bot-ingest", method: "POST", handler: meetingBotIngest });
http.route({ path: "/meeting-bot-ingest", method: "OPTIONS", handler: meetingBotIngest });
http.route({ path: "/transcript-ingest", method: "POST", handler: transcriptIngest });
http.route({ path: "/transcript-ingest", method: "OPTIONS", handler: transcriptIngest });
http.route({ path: "/mission-control-ingest", method: "POST", handler: missionControlIngest });
http.route({ path: "/mission-control-ingest", method: "OPTIONS", handler: missionControlIngest });

// Phase 74: HR Section ingest endpoint
http.route({ path: "/hr-ingest", method: "POST", handler: hrIngest });
http.route({ path: "/hr-ingest", method: "OPTIONS", handler: hrIngest });

// Phase 80: Config Versioning ingest endpoint
http.route({ path: "/api/ingest/agent-config-version", method: "POST", handler: configVersionIngest });
http.route({ path: "/api/ingest/agent-config-version", method: "OPTIONS", handler: configVersionIngest });

// Phase 78: Forge integration ingest endpoint
http.route({ path: "/forge-ingest", method: "POST", handler: forgeIngest });
http.route({ path: "/forge-ingest", method: "OPTIONS", handler: forgeIngest });

// Phase 81: Forge log ingest endpoint
http.route({ path: "/forge-log-ingest", method: "POST",    handler: forgeLogIngest });
http.route({ path: "/forge-log-ingest", method: "OPTIONS", handler: forgeLogIngest });

// Phase 82: Forge file/artifact ingest endpoint
http.route({ path: "/forge-file-ingest", method: "POST",    handler: forgeFileIngest });
http.route({ path: "/forge-file-ingest", method: "OPTIONS", handler: forgeFileIngest });

// Phase 80: Forge command bridge — claim + ack (daemon-facing, bearer-authed, D-14)
http.route({ path: "/forge-commands-claim", method: "POST",    handler: forgeCommandsClaim });
http.route({ path: "/forge-commands-claim", method: "OPTIONS", handler: forgeCommandsClaim });
http.route({ path: "/forge-commands-ack",   method: "POST",    handler: forgeCommandsAck });
http.route({ path: "/forge-commands-ack",   method: "OPTIONS", handler: forgeCommandsAck });

// Phase 101: Reminders & Calendar Command Center — Ástríðr sync surface
// (REM-02, CAL-01). All fail-closed via validateIngestAuth (D-07).
http.route({ path: "/reminders-ingest", method: "POST",    handler: remindersIngest });
http.route({ path: "/reminders-ingest", method: "OPTIONS", handler: remindersIngest });
http.route({ path: "/reminders-read",   method: "POST",    handler: remindersRead });
http.route({ path: "/reminders-read",   method: "OPTIONS", handler: remindersRead });
// /calendar-ingest registered in Task 3 (convex/calendarEvents.ts).

export default http;
