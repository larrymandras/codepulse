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
import { calendarIngest } from "./calendarEvents";
import { personaDialsIngest } from "./personaDialsIngest";
import { gagLedgerIngest } from "./gagLedgerIngest";
import { inboxIngest, inboxRead, inboxReadAll, inboxReadHeldUnacked } from "./inboxIngest";
import { galdrPromptGet, galdrListGet, galdrPromptPost, galdrUsagePost } from "./galdrHttp";
import { loomEventPost } from "./loomHttp";
import { studioIngestPost, studioUploadUrlPost } from "./studioHttp";
import { workspaceIngestPost } from "./workspaceHttp";

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
http.route({ path: "/calendar-ingest",  method: "POST",    handler: calendarIngest });
http.route({ path: "/calendar-ingest",  method: "OPTIONS", handler: calendarIngest });
http.route({ path: "/persona-dials-ingest", method: "POST",    handler: personaDialsIngest });
http.route({ path: "/persona-dials-ingest", method: "OPTIONS", handler: personaDialsIngest });
http.route({ path: "/gag-ledger-ingest",    method: "POST",    handler: gagLedgerIngest });
http.route({ path: "/gag-ledger-ingest",    method: "OPTIONS", handler: gagLedgerIngest });

// Phase 186: Governor Inbox — the record-everything store the interrupt
// governor writes to (GOV-01, D-10). All fail-closed via validateIngestAuth
// (T-186-02-01); /inbox-read-all is the D-12 aggregate all-profiles read
// (T-186-02-03) — same bearer check, never a public GET.
http.route({ path: "/inbox-ingest",   method: "POST",    handler: inboxIngest });
http.route({ path: "/inbox-ingest",   method: "OPTIONS", handler: inboxIngest });
http.route({ path: "/inbox-read",     method: "POST",    handler: inboxRead });
http.route({ path: "/inbox-read",     method: "OPTIONS", handler: inboxRead });
http.route({ path: "/inbox-read-all", method: "POST",    handler: inboxReadAll });
http.route({ path: "/inbox-read-all", method: "OPTIONS", handler: inboxReadAll });
http.route({ path: "/inbox-read-held-unacked", method: "POST",    handler: inboxReadHeldUnacked });
http.route({ path: "/inbox-read-held-unacked", method: "OPTIONS", handler: inboxReadHeldUnacked });

// Phase 116: Galdr Prompt Library — agent/CLI only (D-04). The absence of an
// OPTIONS line under each of these four routes is deliberate and IS the
// access-control boundary itself, not an oversight: no CORS headers, no
// allowlist entry, no OPTIONS handler. `/health` above (line 37) is the
// existing precedent for a route with no OPTIONS partner. Anyone adding an
// OPTIONS route here is reversing a locked decision — see 116-CONTEXT.md D-04.
http.route({ path: "/galdr/prompt", method: "GET",  handler: galdrPromptGet });
http.route({ path: "/galdr/list",   method: "GET",  handler: galdrListGet });
http.route({ path: "/galdr/prompt", method: "POST", handler: galdrPromptPost });
http.route({ path: "/galdr/usage",  method: "POST", handler: galdrUsagePost });

// Phase 119 Loom (D-02/D-04). One emit route, agent/CLI only — no OPTIONS
// partner and no CORS headers, same boundary as the /galdr routes above.
http.route({ path: "/loom/event", method: "POST", handler: loomEventPost });

// Phase 118 Studio (D-15). Agent/CLI-only ingest surface for
// hooks/studioWatch.mjs — no preflight partner and no CORS headers, same
// boundary as /galdr and /loom/event above. /studio/upload-url is
// registered because the live D-01 branch is convex-storage
// (118-D01-EVIDENCE.md); the browser never calls either route.
http.route({ path: "/studio/ingest", method: "POST", handler: studioIngestPost });
http.route({ path: "/studio/upload-url", method: "POST", handler: studioUploadUrlPost });

// Phase 115 workspace scanner (D-04/D-10). One ingest route, host-script only:
// the producer is hooks/workspaceScan.mjs, which sends no Origin and issues no
// preflight, and Phase 114 reads this data through useQuery rather than here.
// The absence of an OPTIONS partner and of CORS headers IS the boundary, not an
// oversight — same shape as the /loom/event and /galdr routes above. Anyone
// adding an OPTIONS route here is widening the surface for no consumer.
http.route({ path: "/workspace-ingest", method: "POST", handler: workspaceIngestPost });

export default http;
