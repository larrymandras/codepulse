#!/usr/bin/env node
// Universal hook dispatcher for CodePulse
// Reads hook event from stdin, POSTs to /ingest endpoint
import { readFileSync } from "fs";

const CONVEX_SITE_URL = process.env.CONVEX_SITE_URL || "https://ideal-sandpiper-297.convex.site";

try {
  const input = readFileSync(0, "utf-8").trim();
  if (!input) process.exit(0);

  const event = JSON.parse(input);

  fetch(`${CONVEX_SITE_URL}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: event.session_id || "unknown",
      eventType: event.event?.type || event.type || "unknown",
      toolName: event.event?.tool_name || event.tool_name || undefined,
      filePath: event.event?.file_path || event.file_path || undefined,
      payload: event,
      hookType: event.hook_type || undefined,
      timestamp: Date.now() / 1000,
    }),
  }).catch(() => {}); // fire-and-forget
} catch {
  process.exit(0); // silent fail — never block Claude Code
}
