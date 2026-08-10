/**
 * galdr.ts — Phase 116 (Galdr Prompt Library), plan 116-03.
 *
 * Owns everything Convex cannot enforce for itself on the `prompts` /
 * `promptVersions` tables (116-01): slug uniqueness (D-06), the append-only
 * version trail (D-15), the per-prompt version cap (D-14), the soft-delete
 * filter (D-16), and the fuzzy-lookup-never-auto-injects contract (D-05).
 *
 * Every Convex function is a named exported plain async handler wrapped by a
 * thin `query({...})` / `mutation({...})` registration — the same
 * handler-extraction shape `convex/reminders.ts` uses — so each decision is
 * unit-testable against an in-memory fake `ctx.db` without `convex-test`
 * (deliberately not installed in this repo; see `convex/reminders.test.ts:140`).
 *
 * Variable detection (`detectVariables`) and slug derivation (`slugify`) are
 * NOT reimplemented here — both live in dependency-free sibling modules from
 * plan 116-02 (`convex/galdrVariables.ts`, `convex/galdrSlug.ts`) and are
 * imported so there is exactly one definition of each.
 */
import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { detectVariables } from "./galdrVariables";
import { slugify } from "./galdrSlug";

// ============================================================
// Minimal ctx.db surface — real Convex ctx.db for real, an in-memory
// table-aware fake for convex/__tests__/galdr.test.ts. Mirrors the
// `RemindersDb` shape in convex/reminders.ts.
// ============================================================

interface GaldrIndexedQuery {
  order: (direction: "asc" | "desc") => GaldrIndexedQuery;
  collect: () => Promise<any[]>;
  first: () => Promise<any | null>;
}

interface GaldrQuery {
  collect: () => Promise<any[]>;
  first: () => Promise<any | null>;
  withIndex: (
    indexName: string,
    cb?: (q: { eq: (field: string, value: any) => any }) => any
  ) => GaldrIndexedQuery;
}

interface GaldrDb {
  insert: (table: string, doc: Record<string, unknown>) => Promise<any>;
  get: (id: any) => Promise<any>;
  patch: (id: any, patch: Record<string, unknown>) => Promise<void>;
  delete: (id: any) => Promise<void>;
  query: (table: string) => GaldrQuery;
}

type GaldrCtx = { db: GaldrDb } | any;

// ============================================================
// Shared constants and helpers
// ============================================================

/**
 * D-14: `promptVersions` is bounded by newest-N-per-prompt rather than by
 * calendar age, because the real growth driver is edit frequency, not time —
 * see the D-13 exemption comment in `convex/schema.ts` for why age-based
 * pruning is the wrong mechanism for this table. This is the ONE tunable
 * constant for the cap; no other file may hardcode the number this holds.
 */
export const PROMPT_VERSION_CAP = 20;

/**
 * D-16: `undefined` and `false` both mean "not archived" — matching the nine
 * existing `archived: v.optional(v.boolean())` precedents in
 * `convex/schema.ts`. Use this everywhere a query filters instead of
 * re-testing `!prompt.archived` inline.
 */
export function isVisible(prompt: { archived?: boolean }): boolean {
  return !prompt.archived;
}

/**
 * Every read path returns this shape so the UI and the HTTP surface never
 * re-derive the variable list themselves — that derivation lives in exactly
 * one place (`convex/galdrVariables.ts`, plan 116-02).
 */
export function toPromptView(prompt: any) {
  return { ...prompt, variables: detectVariables(prompt.body) };
}

// ============================================================
// Read paths (Task 1)
// ============================================================

export async function listHandler(ctx: GaldrCtx) {
  // D-08 / UX: do NOT filter by category or search server-side here — the UI
  // filters the already-subscribed list client-side, matching how
  // src/pages/Skills.tsx treats its own set.
  const rows = await ctx.db
    .query("prompts")
    .withIndex("by_updatedAt")
    .order("desc")
    .collect();
  return rows.filter(isVisible).map(toPromptView);
}

export const list = query({
  args: {},
  handler: async (ctx) => listHandler(ctx),
});

export interface GaldrLookupResult {
  match: ReturnType<typeof toPromptView> | null;
  candidates: Array<{
    slug: string;
    title: string;
    category: string;
    usageCount: number;
  }>;
}

/**
 * D-05: a fuzzy lookup never auto-injects. `match` is non-null ONLY when
 * `searchTerm`, after `slugify`, is exactly equal to a visible prompt's
 * slug. Every other case — including a SINGLE fuzzy hit — comes back as a
 * candidate list projected to `{slug,title,category,usageCount}` only, never
 * the body, so a fuzzy result can never be the thing that gets injected. An
 * injected wrong prompt is indistinguishable from a right one until the
 * output is already wrong, so the caller must always wait for an explicit
 * pick when the identifier was not exact.
 */
export async function lookupHandler(
  ctx: GaldrCtx,
  searchTerm: string
): Promise<GaldrLookupResult> {
  const derivedSlug = slugify(searchTerm);
  let match: ReturnType<typeof toPromptView> | null = null;

  if (derivedSlug !== "") {
    const exact = await ctx.db
      .query("prompts")
      .withIndex("by_slug", (q: any) => q.eq("slug", derivedSlug))
      .first();
    if (exact && isVisible(exact)) {
      match = toPromptView(exact);
    }
  }

  if (match) {
    return { match, candidates: [] };
  }

  const needle = searchTerm.toLowerCase();
  const all = await ctx.db.query("prompts").collect();
  const candidates = all
    .filter(isVisible)
    .filter(
      (p: any) =>
        String(p.slug).toLowerCase().includes(needle) ||
        String(p.title).toLowerCase().includes(needle) ||
        String(p.category).toLowerCase().includes(needle) ||
        String(p.body).toLowerCase().includes(needle)
    )
    .sort((a: any, b: any) => {
      if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
      return b.updatedAt - a.updatedAt;
    })
    .slice(0, 10)
    .map((p: any) => ({
      slug: p.slug,
      title: p.title,
      category: p.category,
      usageCount: p.usageCount,
    }));

  return { match: null, candidates };
}

export const lookup = query({
  args: { query: v.string() },
  handler: async (ctx, { query: searchTerm }) => lookupHandler(ctx, searchTerm),
});

export async function listVersionsHandler(ctx: GaldrCtx, promptId: any) {
  return await ctx.db
    .query("promptVersions")
    .withIndex("by_promptId", (q: any) => q.eq("promptId", promptId))
    .order("desc")
    .collect();
}

export const listVersions = query({
  args: { promptId: v.id("prompts") },
  handler: async (ctx, { promptId }) => listVersionsHandler(ctx, promptId),
});

export interface GaldrCategoriesResult {
  categories: Array<{ category: string; count: number }>;
  favorites: Array<{
    slug: string;
    title: string;
    category: string;
    usageCount: number;
  }>;
}

/** D-08: powers the skill's bare `/galdr` listing — categories + favorites,
 * derived from visible prompts only. */
export async function listCategoriesHandler(
  ctx: GaldrCtx
): Promise<GaldrCategoriesResult> {
  const all = await ctx.db.query("prompts").collect();
  const visible = all.filter(isVisible);

  const counts = new Map<string, number>();
  for (const p of visible) {
    counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  }
  const categories = Array.from(counts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) =>
      b.count !== a.count ? b.count - a.count : a.category.localeCompare(b.category)
    );

  const favorites = visible
    .filter((p: any) => p.favorite === true)
    .sort((a: any, b: any) => b.usageCount - a.usageCount)
    .map((p: any) => ({
      slug: p.slug,
      title: p.title,
      category: p.category,
      usageCount: p.usageCount,
    }));

  return { categories, favorites };
}

export const listCategories = query({
  args: {},
  handler: async (ctx) => listCategoriesHandler(ctx),
});

// ============================================================
// Write paths (Task 2)
// ============================================================

/**
 * Private helper (D-15). Inserts one `promptVersions` row, then immediately
 * prunes that prompt's version trail back to `PROMPT_VERSION_CAP`.
 */
async function appendVersion(
  ctx: GaldrCtx,
  promptId: any,
  body: string,
  now: number
): Promise<void> {
  await ctx.db.insert("promptVersions", { promptId, body, savedAt: now });
  await pruneVersions(ctx, promptId);
}

/**
 * Private helper (D-14). Two properties must hold and are the reason this
 * shape is safe to run inline on every write:
 *   1. The read is scoped to a single `promptId` via the `by_promptId`
 *      index, so it can never become a table scan no matter how large
 *      `promptVersions` grows globally.
 *   2. The delete count per call is bounded by how many versions that ONE
 *      prompt has, so this is architecturally incapable of becoming the kind
 *      of mass delete that took the self-hosted instance down (repo
 *      CLAUDE.md, "Self-Hosted Convex — Operational Rules").
 * Deliberately NOT a `convex/retention.ts` `RETENTION_DAYS` entry: that
 * prunes by `_creationTime` across the whole table on an age cutoff, which
 * would delete versions of actively-edited prompts as readily as abandoned
 * ones — the opposite of what D-14 asks for.
 */
async function pruneVersions(ctx: GaldrCtx, promptId: any): Promise<void> {
  const versions = await ctx.db
    .query("promptVersions")
    .withIndex("by_promptId", (q: any) => q.eq("promptId", promptId))
    .order("desc")
    .collect();
  for (let i = PROMPT_VERSION_CAP; i < versions.length; i++) {
    await ctx.db.delete(versions[i]._id);
  }
}

export interface CreatePromptArgs {
  title: string;
  body: string;
  category: string;
  tags?: string[];
}

/**
 * D-06. The caller never supplies a slug — `slugify(title)` is the ONE
 * derivation, so "produces an existing slug" has exactly one meaning.
 */
export async function createPromptHandler(
  ctx: GaldrCtx,
  args: CreatePromptArgs,
  now: number
): Promise<any> {
  const slug = slugify(args.title);
  if (slug === "") {
    throw new ConvexError({ code: "EMPTY_SLUG", title: args.title });
  }

  // This lookup must see archived rows too — an archived prompt still owns
  // its slug, and silently reusing it would resurrect a confusing collision
  // later (a "new" prompt that is really a stale archived one's slug).
  const existing = await ctx.db
    .query("prompts")
    .withIndex("by_slug", (q: any) => q.eq("slug", slug))
    .first();
  if (existing) {
    throw new ConvexError({
      code: "SLUG_COLLISION",
      existingSlug: existing.slug,
      existingTitle: existing.title,
      existingUpdatedAt: existing.updatedAt,
      existingArchived: existing.archived ?? false,
    });
  }
  // The read-then-write above is safe as a uniqueness check because Convex
  // mutations are transactional/serializable — two concurrent saves for the
  // same slug cannot both commit. This is the only thing standing in for a
  // unique index (Convex has none).

  const promptId = await ctx.db.insert("prompts", {
    title: args.title,
    slug,
    body: args.body,
    category: args.category,
    tags: args.tags,
    favorite: false,
    usageCount: 0,
    archived: false,
    createdAt: now,
    updatedAt: now,
  });
  // D-15: creation is a body-changing write too — it gets its initial
  // snapshot the same as any later edit.
  await appendVersion(ctx, promptId, args.body, now);
  return promptId;
}

export const createPrompt = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    category: v.string(),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => createPromptHandler(ctx, args, Date.now()),
});

export interface UpdatePromptArgs {
  promptId: any;
  title?: string;
  body?: string;
  category?: string;
  tags?: string[];
}

/**
 * D-15. The slug is IMMUTABLE after creation: a title edit changes the
 * display title only and never re-slugs, so a title tweak can never
 * collide. The slug is the identifier every Claude Code session and every
 * "Copy as command" string already holds — re-slugging on a title tweak
 * would silently break live references. Renaming into a new slug is a
 * create-plus-archive, not an update, and is out of scope this phase.
 */
export async function updatePromptHandler(
  ctx: GaldrCtx,
  args: UpdatePromptArgs,
  now: number
): Promise<void> {
  const existing = await ctx.db.get(args.promptId);
  if (!existing) {
    throw new ConvexError({ code: "NOT_FOUND" });
  }

  const patch: Record<string, unknown> = { updatedAt: now };
  if (args.title !== undefined) patch.title = args.title;
  if (args.body !== undefined) patch.body = args.body;
  if (args.category !== undefined) patch.category = args.category;
  if (args.tags !== undefined) patch.tags = args.tags;
  await ctx.db.patch(args.promptId, patch);

  // Append a version ONLY when body was supplied AND differs from the
  // stored body. A title-only/category-only edit appends nothing, and a
  // no-op re-save of an identical body appends nothing either — otherwise
  // it would consume a version slot and evict a real one under the D-14 cap.
  if (args.body !== undefined && args.body !== existing.body) {
    await appendVersion(ctx, args.promptId, args.body, now);
  }
}

export const updatePrompt = mutation({
  args: {
    promptId: v.id("prompts"),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    category: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => updatePromptHandler(ctx, args, Date.now()),
});

export interface RestoreVersionArgs {
  promptId: any;
  versionId: any;
}

/**
 * D-15. Restore is append-only: the version trail moves forward, never
 * rewinds — the restored-from row is left exactly where it is.
 */
export async function restoreVersionHandler(
  ctx: GaldrCtx,
  args: RestoreVersionArgs,
  now: number
): Promise<void> {
  const version = await ctx.db.get(args.versionId);
  // Never restore a version belonging to another prompt.
  if (!version || version.promptId !== args.promptId) {
    throw new ConvexError({ code: "NOT_FOUND" });
  }
  await ctx.db.patch(args.promptId, { body: version.body, updatedAt: now });
  await appendVersion(ctx, args.promptId, version.body, now);
}

export const restoreVersion = mutation({
  args: { promptId: v.id("prompts"), versionId: v.id("promptVersions") },
  handler: async (ctx, args) => restoreVersionHandler(ctx, args, Date.now()),
});

export interface ArchivePromptArgs {
  promptId: any;
}

/**
 * D-16. Sets `archived: true`, hiding the row from `list` and `lookup`.
 * Touches no `promptVersions` row. There is no hard delete and no purge
 * mutation in this module — do not add one.
 */
export async function archivePromptHandler(
  ctx: GaldrCtx,
  args: ArchivePromptArgs,
  now: number
): Promise<void> {
  await ctx.db.patch(args.promptId, { archived: true, updatedAt: now });
}

export const archivePrompt = mutation({
  args: { promptId: v.id("prompts") },
  handler: async (ctx, args) => archivePromptHandler(ctx, args, Date.now()),
});

export interface ToggleFavoriteArgs {
  promptId: any;
}

/**
 * Toggles `favorite`, treating `undefined` as false. Does not touch
 * `usageCount`. Rule 2 addition beyond the plan's literal text: guards on a
 * missing prompt the same way `updatePromptHandler` and
 * `restoreVersionHandler` do, rather than letting a stale/bad id reach
 * `ctx.db.patch` unchecked.
 */
export async function toggleFavoriteHandler(
  ctx: GaldrCtx,
  args: ToggleFavoriteArgs,
  now: number
): Promise<void> {
  const existing = await ctx.db.get(args.promptId);
  if (!existing) {
    throw new ConvexError({ code: "NOT_FOUND" });
  }
  await ctx.db.patch(args.promptId, {
    favorite: !(existing.favorite ?? false),
    updatedAt: now,
  });
}

export const toggleFavorite = mutation({
  args: { promptId: v.id("prompts") },
  handler: async (ctx, args) => toggleFavoriteHandler(ctx, args, Date.now()),
});

export interface RecordUsageArgs {
  slug: string;
}

/**
 * No-op-safe on a lookup miss, matching `recordSkillLaunch`
 * (`convex/registry.ts:678-691`). Bumps `usageCount`/`lastUsedAt` only — it
 * must NOT change `updatedAt` and must NOT append a version, because a
 * usage is not a body-changing write. Letting it move `updatedAt` would
 * corrupt both the grid's recency ordering and the meaning of the version
 * trail.
 */
export async function recordUsageHandler(
  ctx: GaldrCtx,
  args: RecordUsageArgs,
  now: number
): Promise<void> {
  const existing = await ctx.db
    .query("prompts")
    .withIndex("by_slug", (q: any) => q.eq("slug", args.slug))
    .first();
  if (!existing || !isVisible(existing)) return;
  await ctx.db.patch(existing._id, {
    usageCount: (existing.usageCount ?? 0) + 1,
    lastUsedAt: now,
  });
}

export const recordUsage = mutation({
  args: { slug: v.string() },
  handler: async (ctx, args) => recordUsageHandler(ctx, args, Date.now()),
});
