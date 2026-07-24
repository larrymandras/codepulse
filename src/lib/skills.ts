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

/** Result of {@link resolveLifecycleActions} — the shared scope-state predicate. */
export type LifecycleActionState = {
  dormant: boolean;
  shadowed: boolean;
  multiScope: boolean;
  activeOrigin?: string;
  moveDestinationIsProject: boolean;
};

/**
 * The ⋯ menu's per-row scope predicate, extracted so the drag matrix
 * (resolveScopeDrop) can never diverge from what the menu offers (D-02).
 * Reproduces SkillLifecycleMenu.tsx's former inline block byte-for-behavior.
 */
export function resolveLifecycleActions(
  skill: SkillLike,
  lane: "active" | "cold" = "active"
): LifecycleActionState {
  const dormant = isDormant(skill) || lane === "cold";
  const shadowed = isShadowing(skill);
  const nonDormantOrigins = (skill.origins ?? []).filter((o) => o !== DORMANT_ORIGIN);
  const multiScope = nonDormantOrigins.length > 1;
  const activeOrigin = nonDormantOrigins.length === 1 ? nonDormantOrigins[0] : undefined;
  return {
    dormant,
    shadowed,
    multiScope,
    activeOrigin,
    moveDestinationIsProject: activeOrigin === "claude-code",
  };
}

/** Result of {@link resolveScopeDrop} — a discriminated drag-matrix decision. */
export type ScopeDropResult =
  | { kind: "noop" }
  | { kind: "reject"; hint: string }
  | { kind: "dialog" }
  | {
      kind: "enqueue";
      action: "archive" | "restore" | "move";
      sourceOrigin: string;
      destination: "global" | "project" | "cold";
    };

/**
 * The complete drag matrix (D-02/D-04), encoded as a pure, testable decision.
 * Mirrors resolveLifecycleActions exactly — the ⋯ menu and the drag path
 * derive their allowed actions from this ONE shared predicate, so they can
 * never drift out of sync. Delete is NEVER a possible result — drag never
 * deletes (D-04); permanent delete stays menu-only behind type-to-confirm.
 *
 * `lane` mirrors resolveLifecycleActions' own param (default "active") — a
 * drag originating from the Cold Storage rail passes lane="cold" so a
 * shadowed-merged row (WR-04) is treated as dormant+shadowed here exactly as
 * the menu treats it, instead of falling through to the active-global branch.
 */
export function resolveScopeDrop(
  skill: SkillLike,
  targetScope: "global" | "project" | "cold",
  lane: "active" | "cold" = "active"
): ScopeDropResult {
  const { dormant, shadowed, multiScope, activeOrigin } = resolveLifecycleActions(skill, lane);

  if (multiScope) {
    return {
      kind: "reject",
      hint: "Active in multiple scopes — disambiguation ships in a later release.",
    };
  }

  if (dormant) {
    if (targetScope === "cold") {
      // Already cold regardless of shadow status — same-scope noop.
      return { kind: "noop" };
    }
    if (shadowed) {
      return { kind: "reject", hint: "Shadowed by an active skill — archive it first." };
    }
    if (targetScope === "global") {
      return { kind: "enqueue", action: "restore", sourceOrigin: DORMANT_ORIGIN, destination: "global" };
    }
    return { kind: "reject", hint: "Restore to Global first, then move." };
  }

  const isActiveGlobal = activeOrigin === "claude-code";
  const isActiveProject = activeOrigin?.startsWith(PROJECT_PREFIX) ?? false;

  if (isActiveGlobal) {
    if (targetScope === "global") return { kind: "noop" };
    if (targetScope === "project") return { kind: "dialog" };
    return { kind: "enqueue", action: "archive", sourceOrigin: "claude-code", destination: "cold" };
  }

  if (isActiveProject && activeOrigin) {
    if (targetScope === "global") {
      return { kind: "enqueue", action: "move", sourceOrigin: activeOrigin, destination: "global" };
    }
    if (targetScope === "project") return { kind: "noop" };
    return { kind: "enqueue", action: "archive", sourceOrigin: activeOrigin, destination: "cold" };
  }

  // Fallback for an origin-less or unrecognized-origin skill (activeOrigin
  // neither "claude-code" nor a project origin) — a safe no-op, not unreachable.
  return { kind: "noop" };
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
