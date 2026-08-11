// Pure-ish skill discovery for the CodePulse scanner. No network, no Convex.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const BLOCK_SCALAR = new Set([">", "|", ">-", "|-", ">+", "|+", ""]);

// D-02: plugin-sourced skills get their own origin, distinct from the personal
// ~/.claude/skills origin. Keep this in sync with hooks/scanner.mjs's expectations.
export const PLUGIN_ORIGIN = "claude-code:plugin";

export function parseFrontmatter(input) {
  // Normalize CRLF first: JS `.` does not match \r, so an unnormalized CRLF file
  // parses only its final frontmatter key. Every SKILL.md on Windows is CRLF.
  const text = input.replace(/\r\n?/g, "\n").replace(/^﻿/, "");
  const m = text.match(/^---\s*([\s\S]*?)\s*---/);
  if (!m) return {};
  const out = {};
  const lines = m[1].split("\n");
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^(\w[\w-]*):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    const raw = kv[2].trim();

    // `desc: >` / `desc: |` / `desc:` all continue on the following indented lines.
    if (BLOCK_SCALAR.has(raw)) {
      const folded = [];
      while (i + 1 < lines.length && (/^[ \t]/.test(lines[i + 1]) || !lines[i + 1].trim())) {
        folded.push(lines[++i].trim());
      }
      out[key] = folded.filter(Boolean).join(" ");
      continue;
    }

    out[key] = raw.replace(/\s+#.*$/, "").replace(/^["']|["']$/g, "").trim();
  }
  return out;
}

export function repoKey(repoRoot, platform = process.platform) {
  let canon = repoRoot.replace(/\\/g, "/").replace(/\/+$/, "");
  if (platform === "win32") canon = canon.toLowerCase();
  return createHash("sha1").update(canon).digest("hex").slice(0, 12);
}

export function findRepoRoot(startDir) {
  let dir = startDir;
  for (let i = 0; i < 30; i++) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = join(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

// Returns true only when the directory was actually enumerated (readdirSync succeeded),
// false on any early exit — missing dir or a readdirSync throw. An existing-but-EMPTY
// directory returns true: that is deliberate (98-05 "moved the last skill out, prune
// it" case) and must not be confused with "could not read this source."
function readSkillDir(skillsDir, origin, acc) {
  if (!existsSync(skillsDir)) return false;
  let names;
  try { names = readdirSync(skillsDir); } catch { return false; }
  for (const name of names) {
    const md = join(skillsDir, name, "SKILL.md");
    if (!existsSync(md)) continue;
    let fm = {};
    try { fm = parseFrontmatter(readFileSync(md, "utf8")); } catch {}
    acc.push({
      // Claude Code identifies a skill by its DIRECTORY, not by frontmatter `name:`.
      // Trusting fm.name produced rows the user cannot invoke: "Shadcn UI & Blocks",
      // "playwright-skill", "react:components".
      name,
      description: fm.description || "",
      source: md,
      origin,
      upstream: fm.upstream || undefined,
      command: fm.command || undefined,
    });
  }
  return true;
}

/**
 * Skills from the *installed* version of each plugin.
 *
 * The cache keeps every version ever fetched (superpowers 6.0.3/6.1.0/6.1.1;
 * frontend-design at eight commit SHAs). Walking the cache emits one row per cached
 * version, and since upsert is keyed on (name, origin) the winner is whichever the
 * walk happened to reach last. installed_plugins.json records the exact installPath.
 * Returns false when the manifest is unusable, so the caller can fall back.
 */
function readInstalledPluginSkills(home, origin, acc) {
  const manifest = join(home, ".claude", "plugins", "installed_plugins.json");
  if (!existsSync(manifest)) return false;
  let data;
  try {
    data = JSON.parse(readFileSync(manifest, "utf8"));
  } catch {
    return false;
  }
  const plugins = data?.plugins;
  if (!plugins || typeof plugins !== "object") return false;

  let found = 0;
  for (const entries of Object.values(plugins)) {
    for (const e of Array.isArray(entries) ? entries : [entries]) {
      if (!e?.installPath) continue;
      const skillsDir = join(e.installPath, "skills");
      if (!existsSync(skillsDir)) continue;
      readSkillDir(skillsDir, origin, acc);
      found++;
    }
  }
  return found > 0;
}

// Returns a boolean coverage signal: false when the walk short-circuited (depth cap,
// missing root, unreadable root) or any statSync/recursive-walk failure occurred
// anywhere in the tree; true only when every entry was walked cleanly. Does NOT
// early-return on the first failure — D-07 requires the rows a partial walk DID find
// to still be pushed into acc even though the walk as a whole is reported uncovered.
function walkPluginCache(dir, origin, acc, depth = 0) {
  if (depth > 8 || !existsSync(dir)) return false;
  let entries;
  try { entries = readdirSync(dir); } catch { return false; }
  let ok = true;
  for (const e of entries) {
    if (e === "node_modules" || e === ".git") continue;
    const p = join(dir, e);
    let st;
    try { st = statSync(p); } catch { ok = false; continue; }
    if (!st.isDirectory()) continue;
    if (e === "skills") readSkillDir(p, origin, acc);
    else if (!walkPluginCache(p, origin, acc, depth + 1)) ok = false;
  }
  return ok;
}

const samePath = (a, b, platform) => {
  const norm = (p) => {
    const s = p.replace(/\\/g, "/").replace(/\/+$/, "");
    return platform === "win32" ? s.toLowerCase() : s;
  };
  return norm(a) === norm(b);
};

/**
 * Like collectClaudeCodeSkills, but also reports which sub-sources this call actually
 * enumerated (D-01/D-03/D-07). `coveredOrigins` reflects real enumeration outcomes —
 * an origin is included only when the corresponding read genuinely succeeded, never
 * assumed. Downstream (hooks/scanner.mjs), this becomes the /scan wire's
 * `scannedOrigins` manifest: an origin absent here must not be prunable.
 */
export function collectClaudeCodeSkillsWithCoverage({ home, cwd, platform = process.platform }) {
  const acc = [];
  const coveredOrigins = [];

  const globalDir = join(home, ".claude", "skills");
  if (readSkillDir(globalDir, "claude-code", acc)) coveredOrigins.push("claude-code");

  // Plugin skills get their own origin (D-02), distinct from the personal skills dir,
  // specifically so a partial/failed plugin read cannot make the personal-skills origin
  // look complete — the failed sub-source stays isolated to its own origin instead of
  // silently under-counting a "claude-code" origin that is otherwise fully present.
  // Prefer the installed version of each plugin; fall back to walking the whole cache.
  // Covered only if one of the two actually succeeded.
  let pluginCovered = readInstalledPluginSkills(home, PLUGIN_ORIGIN, acc);
  if (!pluginCovered) {
    pluginCovered = walkPluginCache(join(home, ".claude", "plugins", "cache"), PLUGIN_ORIGIN, acc);
  }
  if (pluginCovered) coveredOrigins.push(PLUGIN_ORIGIN);

  // Cold storage: present on disk but NOT loaded by Claude Code. Distinct origin so
  // per-origin pruning keeps it isolated from the active-skill rows.
  if (readSkillDir(join(home, ".claude", "skills-available"), "claude-code:available", acc)) {
    coveredOrigins.push("claude-code:available");
  }

  const root = findRepoRoot(cwd);
  const projectDir = join(root, ".claude", "skills");
  // When the session's cwd is the home directory (no .git above it), findRepoRoot
  // returns home, and <root>/.claude/skills IS the global skills dir. Scanning it
  // again would emit every global skill a second time under a bogus project origin.
  // When skipped by this guard, no project origin is declared covered either.
  if (!samePath(projectDir, globalDir, platform)) {
    const projectOrigin = `claude-code:project:${repoKey(root, platform)}`;
    if (readSkillDir(projectDir, projectOrigin, acc)) coveredOrigins.push(projectOrigin);
  }

  // Dedup rule 1: a name can appear twice within one origin (e.g. two cached versions of
  // the same plugin, or two plugins that both ship a same-named skill). The server
  // upserts by (name, origin), so the survivor would otherwise depend on walk order —
  // keep the first.
  // Dedup rule 2: a name present under BOTH the personal skills dir (claude-code) and an
  // installed plugin (claude-code:plugin) must still yield exactly ONE row across all
  // origins, and it must be the personal-dir copy — a hand-installed skill beats a
  // plugin's copy of the same name. globalDir is read before plugins, so `acc` already
  // contains every "claude-code"-origin row by the time this dedup pass runs.
  const claudeCodeNames = new Set(acc.filter((s) => s.origin === "claude-code").map((s) => s.name));
  const seen = new Set();
  const skills = acc.filter((s) => {
    if (s.origin === PLUGIN_ORIGIN && claudeCodeNames.has(s.name)) return false;
    const key = `${s.origin}::${s.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { skills, coveredOrigins };
}

export function collectClaudeCodeSkills(args) {
  return collectClaudeCodeSkillsWithCoverage(args).skills;
}
