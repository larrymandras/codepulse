// Pure display helpers for the Skills page. Unit-tested — no React, no Convex.

export const DORMANT_ORIGIN = "claude-code:available";
const PROJECT_PREFIX = "claude-code:project:";

export type SkillLike = {
  name: string;
  displayName?: string;
  origins?: string[];
  source?: string;
  command?: string;
  upstream?: string;
  useCount?: number;
  lastUsedAt?: number;
  hidden?: boolean;
  favorite?: boolean;
};

/** True when the skill exists on disk but Claude Code does not load it. */
export function isDormant(skill: SkillLike): boolean {
  const origins = skill.origins ?? [];
  return origins.length > 0 && origins.every((o) => o === DORMANT_ORIGIN);
}

/** Skills present both dormant and active — activating the dormant copy would shadow. */
export function isShadowing(skill: SkillLike): boolean {
  const origins = skill.origins ?? [];
  return origins.includes(DORMANT_ORIGIN) && origins.some((o) => o !== DORMANT_ORIGIN);
}

/**
 * True when ANY origin is the dormant one — i.e. a copy of this skill sits in
 * cold storage, whether or not another copy is also active (98-REVIEW WR-04:
 * a shadowed skill's dormant copy must still be visible in Cold Storage;
 * filtering by isDormant alone made it unreachable in the UI).
 */
export function hasDormantCopy(skill: SkillLike): boolean {
  return (skill.origins ?? []).includes(DORMANT_ORIGIN);
}

/**
 * Recover the repo directory name from a project skill's SKILL.md path, so five
 * `claude-code:project:<hash>` origins don't all render as an identical "Project".
 * Returns null when the path doesn't look like `<repo>/.claude/skills/<name>/SKILL.md`.
 */
export function projectNameFromSource(source?: string): string | null {
  if (!source) return null;
  const norm = source.replace(/\\/g, "/");
  const idx = norm.toLowerCase().lastIndexOf("/.claude/");
  if (idx <= 0) return null;
  const repoRoot = norm.slice(0, idx);
  const seg = repoRoot.split("/").filter(Boolean).pop();
  return seg || null;
}

/** Human label for one origin string. */
export function originLabel(origin: string, projectName?: string | null): string {
  if (origin === DORMANT_ORIGIN) return "Dormant (cold storage)";
  if (origin === "claude-code") return "Claude Code";
  if (origin.startsWith(PROJECT_PREFIX)) {
    return projectName ? `Project · ${projectName}` : `Project · ${origin.slice(PROJECT_PREFIX.length, PROJECT_PREFIX.length + 7)}`;
  }
  return origin;
}

/**
 * Build the origin <select> options: one entry per distinct origin, each with a
 * label that actually distinguishes it. Sorted, stable, no duplicate labels.
 */
export function originOptions(skills: SkillLike[]): Array<{ value: string; label: string }> {
  const projectNameByOrigin = new Map<string, string>();
  for (const s of skills) {
    const origins = s.origins ?? [];
    // Skills are grouped by name, so `source` is whichever origin's row was seen first.
    // Only trust it when this skill belongs to exactly one origin; otherwise a vault
    // skill that also exists globally would name its project after the global path
    // (that is how `Project · Mandras` rendered as `Project · mandr`).
    if (origins.length !== 1) continue;
    const o = origins[0];
    if (!o.startsWith(PROJECT_PREFIX) || projectNameByOrigin.has(o)) continue;
    const n = projectNameFromSource(s.source);
    if (n) projectNameByOrigin.set(o, n);
  }

  const seen = new Set<string>();
  for (const s of skills) for (const o of s.origins ?? []) seen.add(o);

  const opts = [...seen].map((value) => ({
    value,
    label: originLabel(value, projectNameByOrigin.get(value)),
  }));

  // Disambiguate any labels that still collide (two repos with the same folder name).
  const counts = new Map<string, number>();
  for (const o of opts) counts.set(o.label, (counts.get(o.label) ?? 0) + 1);
  for (const o of opts) {
    if ((counts.get(o.label) ?? 0) > 1 && o.value.startsWith(PROJECT_PREFIX)) {
      o.label = `${o.label} (${o.value.slice(PROJECT_PREFIX.length, PROJECT_PREFIX.length + 7)})`;
    }
  }

  return opts.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * What to put on the clipboard for a skill. Suite skills declare an explicit
 * `command:` (e.g. `/legal nda <file>`); everything else invokes as `/<name>`.
 * Any argument placeholder is stripped — you want the command, not the docs.
 */
export function skillInvocation(skill: SkillLike): string {
  const cmd = skill.command?.trim();
  if (cmd) return cmd.replace(/\s*<[^>]*>/g, "").trim();
  return `/${skill.name}`;
}

/** Can this skill be checked for updates? Only if it records a real upstream. */
export function hasKnownUpstream(skill: SkillLike): boolean {
  const u = skill.upstream?.trim();
  return Boolean(u) && u !== "unknown";
}

/**
 * The pill row: most-used skills first. Dormant skills are excluded — they are not
 * loaded, so copying their invocation would hand the user a command that does nothing.
 * Falls back to favorites/recent only via the caller; here we just rank by real usage.
 */
export function topSkills(skills: SkillLike[], limit = 8): SkillLike[] {
  return skills
    .filter((s) => !s.hidden && !isDormant(s) && (s.useCount ?? 0) > 0)
    .sort((a, b) => {
      const d = (b.useCount ?? 0) - (a.useCount ?? 0);
      if (d !== 0) return d;
      return (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0);
    })
    .slice(0, limit);
}

/**
 * The Quick Deck: favorites pinned first (any useCount — a pinned skill is
 * pinned), then most-used non-favorites fill the remaining slots. Dormant
 * skills never appear — copying their invocation would do nothing.
 */
export function deckSkills(skills: SkillLike[], limit = 10): SkillLike[] {
  const eligible = skills.filter((s) => !s.hidden && !isDormant(s));
  const favorites = eligible
    .filter((s) => s.favorite)
    .sort(
      (a, b) =>
        (b.useCount ?? 0) - (a.useCount ?? 0) ||
        (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0)
    );
  const favoriteNames = new Set(favorites.map((s) => s.name));
  const fill = topSkills(eligible, limit).filter((s) => !favoriteNames.has(s.name));
  return [...favorites, ...fill].slice(0, limit);
}
