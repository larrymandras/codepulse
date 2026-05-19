import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
  const match = skillName.match(/^([a-zA-Z]+)/);
  if (!match) return "uncategorized";
  return match[1].toLowerCase();
}

function titleCase(s: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function generateDisplayName(
  skillName: string,
  prefix: string
): string {
  if (prefix === "uncategorized") {
    return skillName.split(/[-_]/).map(titleCase).join(" ");
  }
  const withoutPrefix = skillName.replace(new RegExp(`^${prefix}[-_]?`), "");
  if (!withoutPrefix) return titleCase(prefix);
  return withoutPrefix
    .split(/[-_]/)
    .map(titleCase)
    .join(" ");
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
    const skills = await ctx.db.query("skills").collect();
    const overrides = await ctx.db.query("skillOverrides").collect();
    const categories = await ctx.db.query("skillCategories").collect();

    const overrideMap = new Map(overrides.map((o) => [o.skillName, o]));
    const categoryMap = new Map(categories.map((c) => [c.name, c]));

    return skills.map((skill) => {
      const override = overrideMap.get(skill.name);
      const category = override
        ? categoryMap.get(override.categoryName)
        : null;
      return {
        ...skill,
        displayName: override?.displayName ?? skill.name,
        categoryName: override?.categoryName ?? null,
        categoryDisplayName: category?.displayName ?? null,
        categoryIcon: category?.icon ?? "⚡",
        categoryColor: category?.color ?? "gray",
        overrideDescription: override?.description ?? null,
        hidden: override?.hidden ?? false,
        isAutoAssigned: override?.isAutoAssigned ?? true,
      };
    });
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
      displayName: generateDisplayName(skillName, prefix),
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
        displayName: generateDisplayName(skill.name, prefix),
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

export const resetAllCategoriesAndOverrides = mutation({
  args: {},
  handler: async (ctx) => {
    const categories = await ctx.db.query("skillCategories").collect();
    for (const cat of categories) {
      await ctx.db.delete(cat._id);
    }
    const overrides = await ctx.db.query("skillOverrides").collect();
    for (const ov of overrides) {
      await ctx.db.delete(ov._id);
    }
    return { deletedCategories: categories.length, deletedOverrides: overrides.length };
  },
});
