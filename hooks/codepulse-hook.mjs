#!/usr/bin/env node
// CodePulse Hook Dispatcher
// Entry point for all Claude Code hooks. Reads hook event JSON from stdin,
// POSTs to the CodePulse /ingest endpoint, and triggers a scan on SessionStart.

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Resolve the CodePulse site URL.
 * Priority: CODEPULSE_URL env > VITE_CONVEX_URL from .env.local > hardcoded fallback.
 * Note: .env.local contains the .convex.cloud URL but we need the .convex.site URL,
 * so the env var lookup reads CONVEX_SITE_URL from .env.local as well.
 */
function resolveUrl() {
  if (process.env.CODEPULSE_URL) return process.env.CODEPULSE_URL;

  // Try reading .env.local in the codepulse project directory
  const envPath = join(__dirname, "..", ".env.local");
  if (existsSync(envPath)) {
    try {
      const envContent = readFileSync(envPath, "utf-8");
      // Prefer CONVEX_SITE_URL (the HTTP actions URL)
      const siteMatch = envContent.match(/^CONVEX_SITE_URL\s*=\s*(.+)$/m);
      if (siteMatch) return siteMatch[1].trim();
      // Fall back to VITE_CONVEX_URL but swap .cloud -> .site
      const viteMatch = envContent.match(/^VITE_CONVEX_URL\s*=\s*(.+)$/m);
      if (viteMatch) return viteMatch[1].trim().replace(".convex.cloud", ".convex.site");
    } catch {
      // ignore read errors
    }
  }

  return "https://ideal-sandpiper-297.convex.site";
}

async function main() {
  let input;
  try {
    input = readFileSync(0, "utf-8").trim();
  } catch {
    process.exit(0);
  }
  if (!input) process.exit(0);

  let data;
  try {
    data = JSON.parse(input);
  } catch {
    console.error("[codepulse-hook] Failed to parse stdin JSON");
    process.exit(0);
  }

  const codepulseUrl = resolveUrl();

  // Claude Code sends camelCase fields:
  //   { sessionId, event: { type, toolName, filePath, hookType } }
  const sessionId = data.sessionId || "unknown";
  const event = data.event || {};
  const eventType = event.type || "unknown";
  const toolName = event.toolName || undefined;
  const filePath = event.filePath || undefined;
  const hookType = event.hookType || undefined;

  // POST to /ingest
  const ingestBody = {
    sessionId,
    eventType,
    toolName,
    filePath,
    hookType,
    payload: event,
    timestamp: Math.floor(Date.now() / 1000),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    await fetch(`${codepulseUrl}/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ingestBody),
      signal: controller.signal,
    });
  } catch (err) {
    console.error(`[codepulse-hook] /ingest failed: ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }

  // On SessionStart, also run the environment scanner
  if (eventType === "SessionStart") {
    try {
      const scannerPath = pathToFileURL(join(__dirname, "scanner.mjs")).href;
      const { runScan } = await import(scannerPath);
      await runScan(sessionId, codepulseUrl);
    } catch (err) {
      console.error(`[codepulse-hook] scanner failed: ${err.message}`);
    }
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(`[codepulse-hook] Unexpected error: ${err.message}`);
  process.exit(0);
});
