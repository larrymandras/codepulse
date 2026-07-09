// Reads the host-written Claude Code skill-invocation log. Pure: no network, no Convex.
//
// The log is appended by ~/.claude/hooks/skill-usage-tracker.mjs (Astridr phase 167) and
// lives at ~/.claude/astridr-skill-usage/events.jsonl, one JSON object per line:
//   {"skill":"superpowers:brainstorming","success":true,"session_id":"...","ts":"...Z"}
//
// Skill names may carry a `plugin:` prefix. Skill *rows* are keyed by directory name,
// so the prefix is stripped. Names that match no row are simply never joined.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/** `superpowers:brainstorming` -> `brainstorming`; `wrap` -> `wrap`. */
export function normalizeSkillName(raw) {
  if (typeof raw !== "string") return "";
  const s = raw.trim();
  const i = s.lastIndexOf(":");
  return i === -1 ? s : s.slice(i + 1);
}

/**
 * Aggregate the log into { [skillName]: { useCount, lastUsedAt } }.
 * `lastUsedAt` is epoch ms, matching the `skills` table.
 * Malformed lines are skipped; a missing log yields {}.
 */
export function readSkillUsage(home, { path } = {}) {
  const file = path ?? join(home, ".claude", "astridr-skill-usage", "events.jsonl");
  if (!existsSync(file)) return {};

  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return {};
  }

  const out = {};
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue; // a torn final line during an append is normal
    }
    const name = normalizeSkillName(e?.skill);
    if (!name) continue;

    const ts = Date.parse(e?.ts ?? "");
    const cur = out[name] ?? { useCount: 0, lastUsedAt: undefined };
    cur.useCount += 1; // failed invocations are still invocations
    if (Number.isFinite(ts) && (cur.lastUsedAt === undefined || ts > cur.lastUsedAt)) {
      cur.lastUsedAt = ts;
    }
    out[name] = cur;
  }
  return out;
}

/** Attach usage to a skill snapshot in place, returning it. */
export function mergeUsage(skills, usage) {
  for (const s of skills) {
    const u = usage[s.name];
    if (!u) continue;
    s.useCount = u.useCount;
    if (u.lastUsedAt !== undefined) s.lastUsedAt = u.lastUsedAt;
  }
  return skills;
}
