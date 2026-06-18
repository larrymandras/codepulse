// Pure-ish skill discovery for the CodePulse scanner. No network, no Convex.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

export function parseFrontmatter(text) {
  const m = text.match(/^---\s*([\s\S]*?)\s*---/);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].replace(/^["']|["']$/g, "").trim();
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
    acc.push({ name: fm.name || name, description: fm.description || "", source: md, origin });
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

export function collectClaudeCodeSkills({ home, cwd, platform = process.platform }) {
  const acc = [];
  readSkillDir(join(home, ".claude", "skills"), "claude-code", acc);
  walkPluginCache(join(home, ".claude", "plugins", "cache"), "claude-code", acc);
  const root = findRepoRoot(cwd);
  readSkillDir(join(root, ".claude", "skills"), `claude-code:project:${repoKey(root, platform)}`, acc);
  return acc;
}
