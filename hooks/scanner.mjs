#!/usr/bin/env node
// Environment scanner for CodePulse
// On SessionStart, scans MCP servers, plugins, skills, hooks, agents
// POSTs inventory to /scan endpoint
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const CONVEX_SITE_URL = process.env.CONVEX_SITE_URL || "https://ideal-sandpiper-297.convex.site";

try {
  const input = readFileSync(0, "utf-8").trim();
  if (!input) process.exit(0);

  const event = JSON.parse(input);
  // Only scan on session start
  const eventType = event.event?.type || event.type || "";
  if (eventType !== "SessionStart" && eventType !== "session_start") {
    process.exit(0);
  }

  const home = homedir();
  const claudeDir = join(home, ".claude");
  const snapshot = {
    sessionId: event.session_id || "unknown",
    scannedAt: Date.now() / 1000,
    mcpServers: [],
    plugins: [],
    skills: [],
    hooks: [],
    agents: [],
    slashCommands: [],
  };

  // Scan MCP servers from settings
  const settingsPath = join(claudeDir, "settings.json");
  if (existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
      if (settings.mcpServers) {
        snapshot.mcpServers = Object.entries(settings.mcpServers).map(([name, config]) => ({
          name,
          status: "discovered",
          config: typeof config === "object" ? config : {},
        }));
      }
      if (settings.hooks) {
        snapshot.hooks = Object.entries(settings.hooks).map(([hookType, cmds]) => ({
          hookType,
          commands: Array.isArray(cmds) ? cmds : [cmds],
        }));
      }
    } catch {}
  }

  // Scan agents directory
  const agentsDir = join(claudeDir, "agents");
  if (existsSync(agentsDir)) {
    try {
      const agentFiles = readdirSync(agentsDir).filter(f => f.endsWith(".md") || f.endsWith(".json"));
      snapshot.agents = agentFiles.map(f => ({
        name: f.replace(/\.(md|json)$/, ""),
        file: f,
      }));
    } catch {}
  }

  // Scan project-level settings
  const cwd = process.cwd();
  const projectClaudeDir = join(cwd, ".claude");
  if (existsSync(projectClaudeDir)) {
    // Check for project-level MCP
    const projectSettings = join(projectClaudeDir, "settings.json");
    if (existsSync(projectSettings)) {
      try {
        const ps = JSON.parse(readFileSync(projectSettings, "utf-8"));
        if (ps.mcpServers) {
          const projectServers = Object.entries(ps.mcpServers).map(([name, config]) => ({
            name,
            status: "discovered",
            config: typeof config === "object" ? config : {},
            source: "project",
          }));
          snapshot.mcpServers.push(...projectServers);
        }
      } catch {}
    }

    // Check for project agents
    const projectAgentsDir = join(projectClaudeDir, "agents");
    if (existsSync(projectAgentsDir)) {
      try {
        const agentFiles = readdirSync(projectAgentsDir).filter(f => f.endsWith(".md") || f.endsWith(".json"));
        snapshot.agents.push(...agentFiles.map(f => ({
          name: f.replace(/\.(md|json)$/, ""),
          file: f,
          source: "project",
        })));
      } catch {}
    }
  }

  // POST to scan endpoint
  fetch(`${CONVEX_SITE_URL}/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(snapshot),
  }).catch(() => {});
} catch {
  process.exit(0);
}
