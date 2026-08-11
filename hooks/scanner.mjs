// CodePulse Environment Scanner
// Scans Claude Code environment on SessionStart and POSTs inventory to /scan.
// Exported as a function so codepulse-hook.mjs can import and call it.
//
// No shebang here (deliberately removed, DEBT-05/113-01-verify): this file is never invoked
// as `./scanner.mjs` anywhere in the repo — only via `node hooks/scanner.mjs ...` (see the
// isDirectRun branch below) or as an ESM import from codepulse-hook.mjs / test files. A
// shebang has no effect on either invocation path, but Vite/Rolldown's SSR module transform
// (used by hooks/__tests__/scanner.test.mjs) hoists import statements above line 1, and a
// shebang left there breaks parsing of the resulting file with a hard "Invalid Character `!`".

import { readFileSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { homedir, cpus, totalmem, freemem } from "os";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { collectClaudeCodeSkillsWithCoverage } from "./skillScan.mjs";
import { readSkillUsage, mergeUsage } from "./skillUsage.mjs";

/**
 * Run a full environment scan and POST results to CodePulse /scan endpoint.
 *
 * @param {string} sessionId - The Claude Code session ID
 * @param {string} codepulseUrl - The CodePulse Convex site URL (e.g. https://....convex.site)
 * @param {string} ingestKey - Bearer token for the /scan endpoint
 * @param {object} [deps] - Injectable overrides for testability only. Every existing
 *   3-arg call site (codepulse-hook.mjs, this file's own --dry-run/direct-run branch)
 *   omits this param entirely and gets identical behavior to before this parameter
 *   existed: real homedir()/process.cwd()/collectClaudeCodeSkillsWithCoverage. Tests use
 *   `collectSkills` to reach the D-07 abort path (a thrown collector) without needing to
 *   monkeypatch the live ESM binding, which import live-bindings do not allow.
 */
export async function runScan(sessionId, codepulseUrl, ingestKey, deps = {}) {
  const {
    home = homedir(),
    cwd = process.cwd(),
    collectSkills = collectClaudeCodeSkillsWithCoverage,
  } = deps;
  const globalClaudeDir = join(home, ".claude");
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

  // ── Claude Code skills (personal + plugin cache + per-repo project) ──
  try {
    const { skills, coveredOrigins } = collectSkills({ home, cwd });
    // Join real invocation counts from the host skill-usage log so the dashboard can
    // rank by use. Without this every row sits at useCount 0 and "Most Used" is empty.
    mergeUsage(skills, readSkillUsage(home));
    snapshot.skills.push(...skills);
    // D-03: declare which origins this scan actually enumerated. Assigned only after a
    // successful collection — their ABSENCE (see the snapshot literal above) is the
    // legacy signal for producers that never send this manifest. If the whole skill
    // scan throws below, these two keys are simply never set: the snapshot carries zero
    // skills, and convex/registry.ts's existing `snap.skills.length > 0` guard already
    // makes such a snapshot incapable of pruning anything (D-07 abort path).
    snapshot.scannedOrigins = coveredOrigins;
    snapshot.scannedOriginsComplete = true;
  } catch (err) {
    console.error(`[codepulse-scanner] skill scan failed: ${err.message}`);
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

  // ── Docker containers ───────────────────────────────────────────
  snapshot.docker = [];
  try {
    // windowsHide: the scan runs inside the detached console-less hook worker;
    // without it each console child pops a new visible console window.
    const dockerOutput = execSync("docker ps --format json", {
      encoding: "utf-8",
      timeout: 5000,
      windowsHide: true,
    });
    const lines = dockerOutput.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const container = JSON.parse(line);
        snapshot.docker.push({
          id: container.ID,
          name: container.Names,
          image: container.Image,
          status: container.Status,
          state: container.State,
          ports: container.Ports,
        });
      } catch {
        // skip unparseable lines
      }
    }
  } catch {
    // Docker not available or not running — non-fatal
  }

  // ── System resources ────────────────────────────────────────────
  snapshot.system = {
    cpus: cpus().length,
    cpuModel: cpus()[0]?.model ?? "unknown",
    totalMemoryMb: Math.round(totalmem() / 1024 / 1024),
    freeMemoryMb: Math.round(freemem() / 1024 / 1024),
    arch: process.arch,
    platform: process.platform,
    nodeVersion: process.version,
  };

  // ── WSL2 detection (Windows only) ──────────────────────────────
  snapshot.wsl2 = [];
  if (process.platform === "win32") {
    try {
      const wslOutput = execSync("wsl --list --quiet", {
        encoding: "utf-8",
        timeout: 5000,
        windowsHide: true,
      });
      const distros = wslOutput
        .trim()
        .split("\n")
        .map((d) => d.trim().replace(/\0/g, ""))
        .filter(Boolean);
      snapshot.wsl2 = distros.map((name) => ({ distro: name, status: "available" }));
    } catch {
      // WSL not available — non-fatal
    }
  }

  // ── Supabase project detection ─────────────────────────────────
  snapshot.supabase = null;
  const supabaseConfigPath = join(cwd, "supabase", "config.toml");
  if (existsSync(supabaseConfigPath)) {
    snapshot.supabase = {
      detected: true,
      configPath: supabaseConfigPath,
    };
    try {
      const configContent = readFileSync(supabaseConfigPath, "utf-8");
      const projectMatch = configContent.match(/^project_id\s*=\s*"?(.+?)"?\s*$/m);
      if (projectMatch) {
        snapshot.supabase.projectId = projectMatch[1];
      }
    } catch {
      // ignore read errors
    }
  }

  // ── POST to /scan ───────────────────────────────────────────────────
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const headers = { "Content-Type": "application/json" };
    if (ingestKey) headers["Authorization"] = `Bearer ${ingestKey}`;
    else console.warn("[codepulse-scanner] no ASTRIDR_INGEST_API_KEY set — posting unauthenticated (server may reject)");
    const resp = await fetch(`${codepulseUrl}/scan`, {
      method: "POST",
      headers,
      body: JSON.stringify(snapshot),
      signal: controller.signal,
    });
    if (!resp.ok) {
      console.error(`[codepulse-scanner] /scan responded ${resp.status}: ${await resp.text()}`);
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
  const dryRun = process.argv.includes("--dry-run");

  // Inline URL resolution (same logic as codepulse-hook.mjs)
  let url = process.env.CODEPULSE_URL || "";
  if (!url) {
    const envPath = join(__scanner_dirname, "..", ".env.local");
    if (existsSync(envPath)) {
      try {
        const content = readFileSync(envPath, "utf-8");
        const siteMatch = content.match(/^CONVEX_SITE_URL\s*=\s*(.+)$/m);
        if (siteMatch) url = siteMatch[1].trim();
        else {
          // Fall back to VITE_CONVEX_URL but swap .cloud -> .site (same as codepulse-hook.mjs)
          const viteMatch = content.match(/^VITE_CONVEX_URL\s*=\s*(.+)$/m);
          if (viteMatch) url = viteMatch[1].trim().replace(".convex.cloud", ".convex.site");
        }
      } catch {}
    }
  }
  if (!url) url = "https://ideal-sandpiper-297.convex.site";

  // Resolve the ingest key (env first, then .env.local)
  let key = process.env.ASTRIDR_INGEST_API_KEY || "";
  if (!key) {
    const envPath = join(__scanner_dirname, "..", ".env.local");
    if (existsSync(envPath)) {
      try {
        const content = readFileSync(envPath, "utf-8");
        const m = content.match(/^ASTRIDR_INGEST_API_KEY\s*=\s*(.+)$/m);
        if (m) key = m[1].trim();
      } catch {}
    }
  }

  if (dryRun) {
    const { homedir } = await import("node:os");
    const { collectClaudeCodeSkillsWithCoverage } = await import("./skillScan.mjs");
    const { readSkillUsage, mergeUsage } = await import("./skillUsage.mjs");
    const home = homedir();
    const { skills: collected, coveredOrigins } = collectClaudeCodeSkillsWithCoverage({ home, cwd: process.cwd() });
    const skills = mergeUsage(collected, readSkillUsage(home));
    console.log(JSON.stringify(skills, null, 2));
    const used = skills.filter((s) => s.useCount).length;
    console.log(`[codepulse-scanner] DRY RUN — ${skills.length} skills would be posted (${used} with usage).`);
    console.log(`[codepulse-scanner] DRY RUN — covered origins: ${coveredOrigins.join(", ")}`);
    process.exit(0);
  }

  runScan(sessionId, url, key).then(() => {
    console.log("[codepulse-scanner] Scan complete.");
    process.exit(0);
  });
}
