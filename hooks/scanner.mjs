#!/usr/bin/env node
// CodePulse Environment Scanner
// Scans Claude Code environment on SessionStart and POSTs inventory to /scan.
// Exported as a function so codepulse-hook.mjs can import and call it.

import { readFileSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";

/**
 * Run a full environment scan and POST results to CodePulse /scan endpoint.
 *
 * @param {string} sessionId - The Claude Code session ID
 * @param {string} codepulseUrl - The CodePulse Convex site URL (e.g. https://....convex.site)
 */
export async function runScan(sessionId, codepulseUrl) {
  const home = homedir();
  const globalClaudeDir = join(home, ".claude");
  const cwd = process.cwd();
  const projectClaudeDir = join(cwd, ".claude");

  const snapshot = {
    sessionId,
    scannedAt: Math.floor(Date.now() / 1000),
    mcpServers: [],
    hooks: [],
    plugins: [],
    skills: [],
    agents: [],
    slashCommands: [],
  };

  // ── Global settings (~/.claude/settings.json) ───────────────────────
  const globalSettingsPath = join(globalClaudeDir, "settings.json");
  if (existsSync(globalSettingsPath)) {
    try {
      const settings = JSON.parse(readFileSync(globalSettingsPath, "utf-8"));
      collectFromSettings(settings, snapshot, "global");
    } catch {
      // ignore parse errors
    }
  }

  // ── Global agents (~/.claude/agents/) ───────────────────────────────
  const globalAgentsDir = join(globalClaudeDir, "agents");
  if (existsSync(globalAgentsDir)) {
    try {
      const files = readdirSync(globalAgentsDir).filter(f => f.endsWith(".md") || f.endsWith(".json"));
      snapshot.agents.push(
        ...files.map(f => ({
          name: f.replace(/\.(md|json)$/, ""),
          file: f,
          source: "global",
        }))
      );
    } catch {
      // ignore read errors
    }
  }

  // ── Project settings (.claude/settings.json in cwd) ─────────────────
  const projectSettingsPath = join(projectClaudeDir, "settings.json");
  if (existsSync(projectSettingsPath)) {
    try {
      const settings = JSON.parse(readFileSync(projectSettingsPath, "utf-8"));
      collectFromSettings(settings, snapshot, "project");
    } catch {
      // ignore parse errors
    }
  }

  // ── Project agents (.claude/agents/ in cwd) ─────────────────────────
  const projectAgentsDir = join(projectClaudeDir, "agents");
  if (existsSync(projectAgentsDir)) {
    try {
      const files = readdirSync(projectAgentsDir).filter(f => f.endsWith(".md") || f.endsWith(".json"));
      snapshot.agents.push(
        ...files.map(f => ({
          name: f.replace(/\.(md|json)$/, ""),
          file: f,
          source: "project",
        }))
      );
    } catch {
      // ignore read errors
    }
  }

  // ── Project package.json metadata ───────────────────────────────────
  const pkgPath = join(cwd, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      snapshot.projectName = pkg.name || undefined;
      snapshot.projectVersion = pkg.version || undefined;
    } catch {
      // ignore parse errors
    }
  }

  // ── POST to /scan ───────────────────────────────────────────────────
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const resp = await fetch(`${codepulseUrl}/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
      signal: controller.signal,
    });
    if (!resp.ok) {
      console.error(`[codepulse-scanner] /scan responded ${resp.status}`);
    }
  } catch (err) {
    console.error(`[codepulse-scanner] /scan failed: ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Extract MCP servers, hooks, plugins, and skills from a settings object.
 */
function collectFromSettings(settings, snapshot, source) {
  if (settings.mcpServers && typeof settings.mcpServers === "object") {
    const servers = Object.entries(settings.mcpServers).map(([name, config]) => ({
      name,
      status: "discovered",
      config: typeof config === "object" ? config : {},
      source,
    }));
    snapshot.mcpServers.push(...servers);
  }

  if (settings.hooks && typeof settings.hooks === "object") {
    const hooks = Object.entries(settings.hooks).map(([hookType, cmds]) => ({
      hookType,
      commands: Array.isArray(cmds) ? cmds : [cmds],
      source,
    }));
    snapshot.hooks.push(...hooks);
  }

  if (settings.plugins && Array.isArray(settings.plugins)) {
    snapshot.plugins.push(
      ...settings.plugins.map(p => ({ name: typeof p === "string" ? p : p.name || "unknown", source }))
    );
  }

  if (settings.skills && Array.isArray(settings.skills)) {
    snapshot.skills.push(
      ...settings.skills.map(s => ({ name: typeof s === "string" ? s : s.name || "unknown", source }))
    );
  }
}

// Allow direct execution for testing: node scanner.mjs [sessionId]
const __scanner_dirname = dirname(fileURLToPath(import.meta.url));
const isDirectRun = process.argv[1] && process.argv[1].replace(/\\/g, "/").includes("scanner.mjs");

if (isDirectRun) {
  const sessionId = process.argv[2] || "manual-scan";

  // Inline URL resolution (same logic as codepulse-hook.mjs)
  let url = process.env.CODEPULSE_URL || "";
  if (!url) {
    const envPath = join(__scanner_dirname, "..", ".env.local");
    if (existsSync(envPath)) {
      try {
        const content = readFileSync(envPath, "utf-8");
        const m = content.match(/^CONVEX_SITE_URL\s*=\s*(.+)$/m);
        if (m) url = m[1].trim();
      } catch {}
    }
  }
  if (!url) url = "https://ideal-sandpiper-297.convex.site";

  runScan(sessionId, url).then(() => {
    console.log("[codepulse-scanner] Scan complete.");
    process.exit(0);
  }).catch(err => {
    console.error(`[codepulse-scanner] ${err.message}`);
    process.exit(0);
  });
}
