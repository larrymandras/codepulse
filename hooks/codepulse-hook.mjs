#!/usr/bin/env node
// CodePulse Hook Dispatcher
// Entry point for all Claude Code hooks. Reads hook event JSON from stdin,
// POSTs to the CodePulse /ingest endpoint, and triggers a scan on SessionStart.

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { execSync } from "child_process";

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

function resolveIngestKey() {
  if (process.env.CODEPULSE_INGEST_KEY) return process.env.CODEPULSE_INGEST_KEY;

  const envPath = join(__dirname, "..", ".env.local");
  if (existsSync(envPath)) {
    try {
      const envContent = readFileSync(envPath, "utf-8");
      const keyMatch = envContent.match(/^CODEPULSE_INGEST_KEY\s*=\s*(.+)$/m);
      if (keyMatch) return keyMatch[1].trim();
    } catch {
      // ignore read errors
    }
  }
  return null;
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
  const ingestKey = resolveIngestKey();

  // Claude Code sends flat snake_case fields:
  //   { session_id, hook_event_name, tool_name, tool_input, cwd, ... }
  const sessionId = data.session_id || "unknown";
  const hookEventName = data.hook_event_name || "unknown";
  const toolName = data.tool_name || undefined;
  const toolInput = data.tool_input || {};
  const filePath = toolInput.file_path || undefined;

  const resolvedEventType = hookEventName;

  // POST to /ingest
  const ingestBody = {
    sessionId,
    eventType: resolvedEventType,
    toolName,
    filePath,
    hookType: hookEventName,
    payload: data,
    timestamp: Math.floor(Date.now() / 1000),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  const ingestHeaders = { "Content-Type": "application/json" };
  if (ingestKey) ingestHeaders["Authorization"] = `Bearer ${ingestKey}`;

  try {
    await fetch(`${codepulseUrl}/ingest`, {
      method: "POST",
      headers: ingestHeaders,
      body: JSON.stringify(ingestBody),
      signal: controller.signal,
    });
  } catch (err) {
    console.error(`[codepulse-hook] /ingest failed: ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }

  // Detect git commits from Bash PostToolUse and emit to /runtime-ingest
  if (resolvedEventType === "PostToolUse" && toolName === "Bash") {
    const cmd = toolInput.command || "";
    const output = data.stdout || data.output || "";
    if (/\bgit\s+commit\b/.test(cmd) && output && !/nothing to commit/.test(output)) {
      try {
        const cwd = data.cwd || process.cwd();
        const log = execSync("git log -1 --format=%H%n%s%n%an%n%D", { cwd, timeout: 3000, encoding: "utf-8" }).trim();
        const [sha, message, author, refs] = log.split("\n");
        const branch = (refs || "").replace(/.*HEAD -> /, "").split(",")[0].trim() || "unknown";
        const numstat = execSync("git diff --numstat HEAD~1..HEAD", { cwd, timeout: 3000, encoding: "utf-8" }).trim();
        const filesChanged = numstat ? numstat.split("\n").length : 0;

        const ctrl2 = new AbortController();
        const t2 = setTimeout(() => ctrl2.abort(), 3000);
        const rtHeaders = { "Content-Type": "application/json" };
        if (ingestKey) rtHeaders["Authorization"] = `Bearer ${ingestKey}`;
        await fetch(`${codepulseUrl}/runtime-ingest`, {
          method: "POST",
          headers: rtHeaders,
          body: JSON.stringify({
            eventType: "git_commit",
            data: { sha, message, author, branch, filesChanged },
            timestamp: Math.floor(Date.now() / 1000),
          }),
          signal: ctrl2.signal,
        }).catch(() => {});
        clearTimeout(t2);
      } catch {
        // git log failed — initial commit or not a repo
      }
    }
  }

  // Run the environment scanner on session start (triggered manually via scanner.mjs)
  if (resolvedEventType === "SessionStart") {
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
