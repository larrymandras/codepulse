/**
 * bifrost.ts — the Bifröst link hub domain module (Phase 117).
 *
 * Mirrors convex/galdr.ts's handler/export split: each operation is a plain
 * exported async function taking a minimal ctx, wrapped by a query/mutation only
 * for the generated API. That keeps every one of them directly unit-testable
 * without the Convex runtime.
 *
 * D-02 note, because it will otherwise look like an omission: this module does
 * NO liveness probing and stores no reachability state. A link declares which
 * container backs it (`containerName`) and the UI joins that against the live
 * `dockerContainers` rows the docker ingest already maintains. The design doc's
 * "join on host:port" is not implementable — no port or host field exists
 * anywhere in the schema (verified 2026-08-10).
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

type BifrostCtx = {
  db: any;
};

/** Archived links are hidden everywhere, mirroring prompts' soft-delete. */
function isVisible(link: { archived?: boolean }): boolean {
  return link.archived !== true;
}

/**
 * Pinned first, then explicit `order` ascending, then newest.
 *
 * `order` is optional, and an absent value must sort AFTER every explicit one
 * rather than being coerced to 0 — a link that has never been ordered would
 * otherwise leap to the front of its category.
 */
export function compareLinks(
  a: { pinned?: boolean; order?: number; createdAt: number },
  b: { pinned?: boolean; order?: number; createdAt: number }
): number {
  if (Boolean(b.pinned) !== Boolean(a.pinned)) {
    return Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
  }
  const ao = a.order ?? Number.POSITIVE_INFINITY;
  const bo = b.order ?? Number.POSITIVE_INFINITY;
  if (ao !== bo) return ao - bo;
  return b.createdAt - a.createdAt;
}

// ============================================================
// Read paths
// ============================================================

export async function listHandler(ctx: BifrostCtx) {
  const rows = await ctx.db.query("links").collect();
  return rows.filter(isVisible).sort(compareLinks);
}

export const list = query({
  args: {},
  handler: async (ctx) => listHandler(ctx),
});

// ============================================================
// Write paths
// ============================================================

export async function createLinkHandler(
  ctx: BifrostCtx,
  args: {
    title: string;
    url: string;
    description?: string;
    category?: string;
    icon?: string;
    isLocalService?: boolean;
    containerName?: string;
  },
  now: number
) {
  const title = args.title.trim();
  const url = args.url.trim();
  if (!title) throw new Error("MISSING_TITLE");
  if (!url) throw new Error("MISSING_URL");

  return await ctx.db.insert("links", {
    title,
    url,
    description: args.description?.trim() || undefined,
    category: args.category?.trim() || "uncategorized",
    icon: args.icon?.trim() || undefined,
    pinned: false,
    isLocalService: args.isLocalService ?? false,
    containerName: args.containerName?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  });
}

export const createLink = mutation({
  args: {
    title: v.string(),
    url: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    icon: v.optional(v.string()),
    isLocalService: v.optional(v.boolean()),
    containerName: v.optional(v.string()),
  },
  handler: async (ctx, args) => createLinkHandler(ctx, args, Date.now()),
});

export async function updateLinkHandler(
  ctx: BifrostCtx,
  args: {
    linkId: any;
    title?: string;
    url?: string;
    description?: string;
    category?: string;
    icon?: string;
    isLocalService?: boolean;
    containerName?: string;
    order?: number;
  },
  now: number
) {
  const { linkId, ...rest } = args;
  const patch: Record<string, unknown> = { updatedAt: now };
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) patch[key] = value;
  }
  await ctx.db.patch(linkId, patch);
}

export const updateLink = mutation({
  args: {
    linkId: v.id("links"),
    title: v.optional(v.string()),
    url: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    icon: v.optional(v.string()),
    isLocalService: v.optional(v.boolean()),
    containerName: v.optional(v.string()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => updateLinkHandler(ctx, args, Date.now()),
});

export async function togglePinHandler(
  ctx: BifrostCtx,
  linkId: any,
  now: number
) {
  const link = await ctx.db.get(linkId);
  if (!link) return;
  await ctx.db.patch(linkId, { pinned: !link.pinned, updatedAt: now });
}

export const togglePin = mutation({
  args: { linkId: v.id("links") },
  handler: async (ctx, { linkId }) => togglePinHandler(ctx, linkId, Date.now()),
});

/**
 * Soft delete only, matching Galdr's D-16 and the standing "archive, don't rm"
 * rule. No purge mutation exists here, so no UI control can grow one.
 */
export async function archiveLinkHandler(
  ctx: BifrostCtx,
  linkId: any,
  now: number
) {
  await ctx.db.patch(linkId, { archived: true, updatedAt: now });
}

export const archiveLink = mutation({
  args: { linkId: v.id("links") },
  handler: async (ctx, { linkId }) =>
    archiveLinkHandler(ctx, linkId, Date.now()),
});
