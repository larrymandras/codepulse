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
import { normalizeLinkUrl } from "./bifrostUrl";

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

  // IDEMPOTENT BY URL. Adding a link that is already in the hub returns the
  // existing row's id and writes nothing.
  //
  // It RETURNS rather than THROWS, and that is the whole reason this shape was
  // chosen over Galdr's refuse-on-collision (`createPromptHandler`'s
  // SLUG_COLLISION). `QuickAddDialog` (src/pages/Bifrost.tsx) calls this as a
  // bare `void createLink(input)` with no error handling, so a throw would turn
  // the Add-link dialog into a silent no-op with no feedback. A quiet success
  // that returns the existing link is correct for both callers.
  //
  // Because the lookup and the insert happen inside one Convex mutation, which
  // is transactional and serializable, this ALSO closes the concurrent-write
  // gap that a check-then-write in the scanner could not: two simultaneous
  // applies cannot both insert the same URL.
  //
  // Matching is against VISIBLE links only. An archived link is an explicit
  // "remove this", so re-adding the same URL later is new intent and gets a new
  // row rather than silently resurrecting the old one with its stale title and
  // category.
  //
  // A full scan is correct here rather than lazy: identity is the NORMALIZED
  // url, and no index can answer that (Convex indexes raw field values, and
  // `links` stores whatever was typed). The table is a hand-curated hub of
  // dozens of rows, and `list` already collects all of it on every page load.
  const key = normalizeLinkUrl(url);
  const existing = await ctx.db.query("links").collect();
  const match = existing.find(
    (l: any) => isVisible(l) && normalizeLinkUrl(l.url) === key
  );
  if (match) return match._id;

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
 * Bumps usage on an ACTUAL open — the palette's Enter, or a click on a link
 * card's anchor. Nothing else counts: not viewing the hub, not searching, not
 * pinning. `usageCount` is what the palette ranks by, so anything that inflates
 * it without the operator having gone somewhere makes the launcher worse.
 *
 * Two properties borrowed deliberately from `galdr.ts`'s `recordUsageHandler`:
 *
 *  1. No-op on a missing or archived row rather than throwing. A palette entry
 *     can outlive the row behind it by a frame; surfacing an error mid-launch
 *     would be worse than silently not counting the open.
 *  2. It does NOT touch `updatedAt`. Opening a link is not a content change,
 *     and letting it move `updatedAt` would corrupt `compareLinks`' newest-first
 *     tiebreaker — every link you opened would drift to the top of its category
 *     on the /bifrost page as though it had just been edited.
 */
export async function recordOpenHandler(
  ctx: BifrostCtx,
  linkId: any,
  now: number
) {
  const link = await ctx.db.get(linkId);
  if (!link || !isVisible(link)) return;
  await ctx.db.patch(linkId, {
    usageCount: (link.usageCount ?? 0) + 1,
    lastUsedAt: now,
  });
}

export const recordOpen = mutation({
  args: { linkId: v.id("links") },
  handler: async (ctx, { linkId }) =>
    recordOpenHandler(ctx, linkId, Date.now()),
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
