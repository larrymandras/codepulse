import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { groupSkillRowsByName } from "./skillSync";

export const DEFAULT_ICONS: Record<string, string> = {
  gsd: "📋",
  legal: "⚖️",
  market: "📈",
  sales: "💼",
  geo: "🌐",
  codex: "🖥️",
  superpowers: "⚡",
  code: "💻",
  feature: "🔧",
  frontend: "🎨",
  skill: "🧩",
  bug: "🐛",
  ship: "🚀",
  review: "🔍",
};

export const DEFAULT_COLORS: Record<string, string> = {
  gsd: "indigo",
  legal: "red",
  market: "purple",
  sales: "amber",
  geo: "cyan",
  codex: "emerald",
  superpowers: "violet",
  code: "blue",
  feature: "orange",
  frontend: "pink",
  skill: "teal",
  bug: "rose",
  ship: "green",
  review: "yellow",
};

export function extractPrefix(skillName: string): string {
  if (!skillName) return "uncategorized";
  const normalized = skillName.replace(/^cc_/, "");
  const match = normalized.match(/^([a-zA-Z][a-zA-Z0-9]*)/);
  if (!match) return "uncategorized";
  return match[1].toLowerCase();
}

function titleCase(s: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function titleizeSegments(s: string): string {
  return s
    .split(/[-_:]+/)
    .filter(Boolean)
    .map(titleCase)
    .join(" ");
}

/** Minimum distinct members for a hyphen prefix to count as a real family. */
export const FAMILY_MIN_MEMBERS = 3;

/**
 * Which hyphen prefixes are real "families" (gsd, geo, superpowers, …) whose
 * shared prefix is worth stripping from the display name.
 *
 * Two corrections over a naive count:
 * 1. **cc_ bridge twins are deduped** — `deep-research` and its bridge mirror
 *    `cc_deep-research` are the SAME logical skill, so they count once. Without
 *    this every bridged standalone skill looks like a 2-member family.
 * 2. **Threshold is ≥3 distinct members** — a coincidental first-word overlap
 *    (agent-browser + agent-development) is not a curated namespace and would
 *    mangle both names if stripped. Real families (geo≈9, gsd, n8n) clear 3
 *    comfortably.
 *
 * Colon namespaces (`plugin:skill`) are handled directly in generateDisplayName
 * and never rely on this set.
 */
export function computeFamilyPrefixes(skillNames: string[]): Set<string> {
  const membersByPrefix = new Map<string, Set<string>>();
  for (const name of skillNames) {
    const base = name.replace(/^cc_/, ""); // collapse bridge twin onto native
    const prefix = extractPrefix(base);
    if (prefix === "uncategorized") continue;
    if (!membersByPrefix.has(prefix)) membersByPrefix.set(prefix, new Set());
    membersByPrefix.get(prefix)!.add(base);
  }
  return new Set(
    [...membersByPrefix.entries()]
      .filter(([, members]) => members.size >= FAMILY_MIN_MEMBERS)
      .map(([p]) => p)
  );
}

/**
 * Human-readable display name for a skill.
 *
 * - Explicit `plugin:skill` namespace → strip everything up to the first colon
 *   (`vercel:deploy` → "Deploy", `code-review:code-review` → "Code Review").
 * - Real hyphen family (isFamily) → strip the shared prefix
 *   (`gsd-plan-phase` → "Plan Phase").
 * - Otherwise → full title-cased name so it never reads as a fragment
 *   (`agent-browser` → "Agent Browser", `deploy-to-vercel` → "Deploy To Vercel").
 */
export function generateDisplayName(
  skillName: string,
  prefix: string,
  isFamily = false
): string {
  const normalized = skillName.replace(/^cc_/, "");
  const colonIdx = normalized.indexOf(":");
  if (colonIdx !== -1) {
    const skillPart = normalized.slice(colonIdx + 1);
    return titleizeSegments(skillPart || normalized);
  }
  if (isFamily && prefix !== "uncategorized") {
    const withoutPrefix = normalized.replace(new RegExp(`^${prefix}[-_]?`), "");
    if (!withoutPrefix) return titleCase(prefix);
    return titleizeSegments(withoutPrefix);
  }
  return titleizeSegments(normalized);
}

export const listCategories = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("skillCategories")
      .collect()
      .then((cats) => cats.sort((a, b) => a.sortOrder - b.sortOrder));
  },
});

export const countAutoAssigned = query({
  args: {},
  handler: async (ctx) => {
    const overrides = await ctx.db.query("skillOverrides").collect();
    return overrides.filter((o) => o.isAutoAssigned).length;
  },
});

export const getSkillsWithOverrides = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("skills").collect();
    const grouped = groupSkillRowsByName(rows);
    const overrides = await ctx.db.query("skillOverrides").collect();
    const categories = await ctx.db.query("skillCategories").collect();

    const overrideMap = new Map(overrides.map((o) => [o.skillName, o]));
    const categoryMap = new Map(categories.map((c) => [c.name, c]));

    return grouped.map((skill) => {
      const override = overrideMap.get(skill.name);
      const category = override ? categoryMap.get(override.categoryName) : null;
      return {
        ...skill,
        origin: skill.origins[0], // backward-compat: first origin
        displayName: override?.displayName ?? skill.name,
        categoryName: override?.categoryName ?? null,
        categoryDisplayName: category?.displayName ?? null,
        categoryIcon: category?.icon ?? "⚡",
        categoryColor: category?.color ?? "gray",
        overrideDescription: override?.description ?? null,
        hidden: override?.hidden ?? false,
        isAutoAssigned: override?.isAutoAssigned ?? true,
        favorite: override?.favorite ?? false,
      };
    });
  },
});

/**
 * The N most-recently-launched skills (by `lastUsedAt`, stamped by
 * recordSkillLaunch). Server-side sort + slice returns only N rows, so the Chat
 * command center's "Recent Launches" widget never ships the whole registry.
 */
export const getRecentlyUsedSkills = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, { limit }) => {
    const rows = await ctx.db.query("skills").collect();
    const grouped = groupSkillRowsByName(rows);
    const overrides = await ctx.db.query("skillOverrides").collect();
    const overrideMap = new Map(overrides.map((o) => [o.skillName, o]));
    return grouped
      .filter((s) => (s.lastUsedAt ?? 0) > 0)
      .sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0))
      .slice(0, limit ?? 6)
      .map((s) => ({
        name: s.name,
        displayName: overrideMap.get(s.name)?.displayName ?? s.name,
        useCount: s.useCount ?? 0,
        lastUsedAt: s.lastUsedAt ?? 0,
      }));
  },
});

export const createCategory = mutation({
  args: {
    name: v.string(),
    displayName: v.string(),
    description: v.string(),
    icon: v.string(),
    color: v.string(),
    sortOrder: v.float64(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("skillCategories")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("skillCategories", args);
  },
});

export const updateCategory = mutation({
  args: {
    id: v.id("skillCategories"),
    displayName: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    sortOrder: v.optional(v.float64()),
  },
  handler: async (ctx, { id, ...updates }) => {
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, val]) => val !== undefined)
    );
    await ctx.db.patch(id, filtered);
  },
});

export const deleteCategory = mutation({
  args: { id: v.id("skillCategories") },
  handler: async (ctx, { id }) => {
    const cat = await ctx.db.get(id);
    if (!cat) return;
    const overrides = await ctx.db
      .query("skillOverrides")
      .withIndex("by_categoryName", (q) => q.eq("categoryName", cat.name))
      .collect();
    if (overrides.length > 0) {
      throw new Error(
        `Cannot delete category "${cat.displayName}" — ${overrides.length} skills are assigned to it. Reassign them first.`
      );
    }
    await ctx.db.delete(id);
  },
});

export const updateSkillOverride = mutation({
  args: {
    skillName: v.string(),
    displayName: v.optional(v.string()),
    categoryName: v.optional(v.string()),
    description: v.optional(v.string()),
    hidden: v.optional(v.boolean()),
    favorite: v.optional(v.boolean()),
  },
  handler: async (ctx, { skillName, ...updates }) => {
    const existing = await ctx.db
      .query("skillOverrides")
      .withIndex("by_skillName", (q) => q.eq("skillName", skillName))
      .first();
    if (!existing) return;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, val]) => val !== undefined)
    );
    await ctx.db.patch(existing._id, { ...filtered, isAutoAssigned: false });
  },
});

export const toggleFavorite = mutation({
  args: { skillName: v.string() },
  handler: async (ctx, { skillName }) => {
    const existing = await ctx.db
      .query("skillOverrides")
      .withIndex("by_skillName", (q) => q.eq("skillName", skillName))
      .first();
    if (!existing) return;
    await ctx.db.patch(existing._id, { favorite: !existing.favorite });
  },
});

export const bulkAcceptAutoAssigned = mutation({
  args: {},
  handler: async (ctx) => {
    const overrides = await ctx.db.query("skillOverrides").collect();
    const autoAssigned = overrides.filter((o) => o.isAutoAssigned);
    for (const override of autoAssigned) {
      await ctx.db.patch(override._id, { isAutoAssigned: false });
    }
    return autoAssigned.length;
  },
});

export const autoSeedSkill = mutation({
  args: { skillName: v.string() },
  handler: async (ctx, { skillName }) => {
    const existingOverride = await ctx.db
      .query("skillOverrides")
      .withIndex("by_skillName", (q) => q.eq("skillName", skillName))
      .first();
    if (existingOverride) return;

    const prefix = extractPrefix(skillName);
    const allNames = groupSkillRowsByName(
      await ctx.db.query("skills").collect()
    ).map((s) => s.name);
    if (!allNames.includes(skillName)) allNames.push(skillName);
    const isFamily = computeFamilyPrefixes(allNames).has(prefix);

    let category = await ctx.db
      .query("skillCategories")
      .withIndex("by_name", (q) => q.eq("name", prefix))
      .first();

    if (!category) {
      const catId = await ctx.db.insert("skillCategories", {
        name: prefix,
        displayName: titleCase(prefix),
        description: "",
        icon: DEFAULT_ICONS[prefix] ?? "⚡",
        color: DEFAULT_COLORS[prefix] ?? "gray",
        sortOrder: Date.now(),
      });
      category = await ctx.db.get(catId);
    }

    await ctx.db.insert("skillOverrides", {
      skillName,
      displayName: generateDisplayName(skillName, prefix, isFamily),
      categoryName: prefix,
      description: undefined,
      hidden: false,
      isAutoAssigned: true,
    });
  },
});

export const seedExistingSkills = mutation({
  args: {},
  handler: async (ctx) => {
    const skills = await ctx.db.query("skills").collect();
    const families = computeFamilyPrefixes(
      groupSkillRowsByName(skills).map((s) => s.name)
    );
    let seeded = 0;
    for (const skill of skills) {
      const existing = await ctx.db
        .query("skillOverrides")
        .withIndex("by_skillName", (q) => q.eq("skillName", skill.name))
        .first();
      if (existing) continue;

      const prefix = extractPrefix(skill.name);

      let category = await ctx.db
        .query("skillCategories")
        .withIndex("by_name", (q) => q.eq("name", prefix))
        .first();

      if (!category) {
        const catId = await ctx.db.insert("skillCategories", {
          name: prefix,
          displayName: titleCase(prefix),
          description: "",
          icon: DEFAULT_ICONS[prefix] ?? "⚡",
          color: DEFAULT_COLORS[prefix] ?? "gray",
          sortOrder: Date.now(),
        });
        category = await ctx.db.get(catId);
      }

      await ctx.db.insert("skillOverrides", {
        skillName: skill.name,
        displayName: generateDisplayName(skill.name, prefix, families.has(prefix)),
        categoryName: prefix,
        description: undefined,
        hidden: false,
        isAutoAssigned: true,
      });
      seeded++;
    }
    return seeded;
  },
});
