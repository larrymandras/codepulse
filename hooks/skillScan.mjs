// Pure-ish skill discovery for the CodePulse scanner. No network, no Convex.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const BLOCK_SCALAR = new Set([">", "|", ">-", "|-", ">+", "|+", ""]);

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

function readSkillDir(skillsDir, origin, acc) {
  if (!existsSync(skillsDir)) return;
  let names;
  try { names = readdirSync(skillsDir); } catch { return; }
  for (const name of names) {
    const md = join(skillsDir, name, "SKILL.md");
    if (!existsSync(md)) continue;
    let fm = {};
    try { fm = parseFrontmatter(readFileSync(md, "utf8")); } catch {}
    acc.push({
      name: fm.name || name,
      description: fm.description || "",
      source: md,
      origin,
      upstream: fm.upstream || undefined,
      command: fm.command || undefined,
    });
  }
}

function walkPluginCache(dir, origin, acc, depth = 0) {
  if (depth > 8 || !existsSync(dir)) return;
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const e of entries) {
    if (e === "node_modules" || e === ".git") continue;
    const p = join(dir, e);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (!st.isDirectory()) continue;
    if (e === "skills") readSkillDir(p, origin, acc);
    else walkPluginCache(p, origin, acc, depth + 1);
  }
}

const samePath = (a, b, platform) => {
  const norm = (p) => {
    const s = p.replace(/\\/g, "/").replace(/\/+$/, "");
    return platform === "win32" ? s.toLowerCase() : s;
  };
  return norm(a) === norm(b);
};

export function collectClaudeCodeSkills({ home, cwd, platform = process.platform }) {
  const acc = [];
  const globalDir = join(home, ".claude", "skills");
  readSkillDir(globalDir, "claude-code", acc);
  walkPluginCache(join(home, ".claude", "plugins", "cache"), "claude-code", acc);
  // Cold storage: present on disk but NOT loaded by Claude Code. Distinct origin so
  // per-origin pruning keeps it isolated from the active-skill rows.
  readSkillDir(join(home, ".claude", "skills-available"), "claude-code:available", acc);

  const root = findRepoRoot(cwd);
  const projectDir = join(root, ".claude", "skills");
  // When the session's cwd is the home directory (no .git above it), findRepoRoot
  // returns home, and <root>/.claude/skills IS the global skills dir. Scanning it
  // again would emit every global skill a second time under a bogus project origin.
  if (!samePath(projectDir, globalDir, platform)) {
    readSkillDir(projectDir, `claude-code:project:${repoKey(root, platform)}`, acc);
  }
  return acc;
}
