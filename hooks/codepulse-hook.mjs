#!/usr/bin/env node
// CodePulse Hook Dispatcher
// Entry point for all Claude Code hooks. Reads hook event JSON from stdin and
// hands it to a DETACHED background worker, then exits immediately (~50ms) so
// telemetry never blocks the Claude Code loop. The worker POSTs to /ingest,
// detects git commits, and (on SessionStart) runs the environment scan — all
// out-of-band, each guarded by its own timeout.
//
// Two modes:
//   (default)          read stdin -> temp file -> spawn `--worker <file>` detached -> exit 0
//   --worker <file>    read the payload file, do all network/exec work, delete file, exit
//
// Rationale: the previous version awaited a network POST (up to 3s) on every one
// of 8 wired events, plus a blocking docker/wsl/scan POST on SessionStart. A cold
// backend or Docker daemon turned that into multi-second-per-prompt latency and a
// 170s SessionStart tail. Detaching removes the blocking wait entirely.

import { readFileSync, existsSync, writeFileSync, unlinkSync, mkdirSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { execSync, spawn } from "child_process";
import { tmpdir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Dispatcher: fast path. Read stdin, spawn detached worker, exit. ─────────
async function dispatch() {
  let input;
  try {
    input = readFileSync(0, "utf-8").trim();
  } catch {
    process.exit(0);
  }
  if (!input) process.exit(0);

  // Validate JSON cheaply; if it's junk, drop it without spawning a worker.
  try {
    JSON.parse(input);
  } catch {
    process.exit(0);
  }

  // Persist the payload to a temp file the detached worker can read. argv is too
  // small/risky for a full hook payload, and detached stdin is unreliable on Windows.
  let payloadFile;
  try {
    const dir = join(tmpdir(), "codepulse-hooks");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    // No Date.now()/random needed for uniqueness: pid + hrtime is unique per spawn.
    payloadFile = join(dir, `evt-${process.pid}-${process.hrtime.bigint()}.json`);
    writeFileSync(payloadFile, input, "utf-8");
  } catch {
    // Can't stage the payload — give up silently rather than block.
    process.exit(0);
  }

  try {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "--worker", payloadFile], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
  } catch {
    // Spawn failed — clean up the staged payload and exit.
    try { unlinkSync(payloadFile); } catch {}
  }
  process.exit(0);
}

// ── Worker: runs detached. Does all the slow work, then deletes its payload. ──
async function worker(payloadFile) {
  let data;
  try {
    data = JSON.parse(readFileSync(payloadFile, "utf-8"));
  } catch {
    cleanup(payloadFile);
    return;
  }

  const codepulseUrl = resolveUrl();
  const ingestKey = resolveIngestKey();

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

  const ingestHeaders = { "Content-Type": "application/json" };
  if (ingestKey) ingestHeaders["Authorization"] = `Bearer ${ingestKey}`;
  await postJson(`${codepulseUrl}/ingest`, ingestHeaders, ingestBody, 3000);

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
        const rtHeaders = { "Content-Type": "application/json" };
        if (ingestKey) rtHeaders["Authorization"] = `Bearer ${ingestKey}`;
        await postJson(`${codepulseUrl}/runtime-ingest`, rtHeaders, {
          eventType: "git_commit",
          data: { sha, message, author, branch, filesChanged },
          timestamp: Math.floor(Date.now() / 1000),
        }, 3000);
      } catch {
        // git log failed — initial commit or not a repo
      }
    }
  }

  // Run the environment scanner on session start
  if (resolvedEventType === "SessionStart") {
    try {
      const scannerPath = pathToFileURL(join(__dirname, "scanner.mjs")).href;
      const { runScan } = await import(scannerPath);
      await runScan(sessionId, codepulseUrl, resolveScanKey());
    } catch (err) {
      console.error(`[codepulse-hook] scanner failed: ${err.message}`);
    }
  }

  cleanup(payloadFile);
}

function cleanup(payloadFile) {
  try { unlinkSync(payloadFile); } catch {}
  // Best-effort sweep of stale payloads left by any crashed worker (older than 1h).
  try {
    const dir = dirname(payloadFile);
    const cutoff = Date.now() - 3600_000;
    for (const f of readdirSync(dir)) {
      if (!f.startsWith("evt-")) continue;
      const p = join(dir, f);
      try {
        if (statSync(p).mtimeMs < cutoff) unlinkSync(p);
      } catch {}
    }
  } catch {}
}

async function postJson(url, headers, body, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: controller.signal });
  } catch (err) {
    console.error(`[codepulse-hook] POST ${url} failed: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve the CodePulse site URL.
 * Priority: CODEPULSE_URL env > CONVEX_SITE_URL / VITE_CONVEX_URL from .env.local > fallback.
 */
function resolveUrl() {
  if (process.env.CODEPULSE_URL) return process.env.CODEPULSE_URL;
  const envPath = join(__dirname, "..", ".env.local");
  if (existsSync(envPath)) {
    try {
      const envContent = readFileSync(envPath, "utf-8");
      const siteMatch = envContent.match(/^CONVEX_SITE_URL\s*=\s*(.+)$/m);
      if (siteMatch) return siteMatch[1].trim();
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

function resolveScanKey() {
  if (process.env.ASTRIDR_INGEST_API_KEY) return process.env.ASTRIDR_INGEST_API_KEY;
  const envPath = join(__dirname, "..", ".env.local");
  if (existsSync(envPath)) {
    try {
      const envContent = readFileSync(envPath, "utf-8");
      const keyMatch = envContent.match(/^ASTRIDR_INGEST_API_KEY\s*=\s*(.+)$/m);
      if (keyMatch) return keyMatch[1].trim();
    } catch {
      // ignore read errors
    }
  }
  return null;
}

// ── Entry point ─────────────────────────────────────────────────────────────
if (process.argv[2] === "--worker") {
  worker(process.argv[3])
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`[codepulse-hook] worker error: ${err.message}`);
      process.exit(0);
    });
} else {
  dispatch().catch(() => process.exit(0));
}
