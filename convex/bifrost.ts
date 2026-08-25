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

/**
 * Hard bound on the launcher read. Derived, not picked: `links` is a curated
 * hub (25 rows live at the time of writing), so 2000 is ~80x headroom while
 * staying far under Convex's 4,096-read ceiling. Reused verbatim from
 * `ALERT_COUNT_SCAN_CAP` (`convex/alerts.ts:122`) so the two shell-level
 * bounded reads share one number rather than drifting apart.
 */
export const LINK_LIST_SCAN_CAP = 2000;

/**
 * SWEEP-01 correctness guard, applied here 2026-08-25.
 *
 * This read is subscribed at SHELL level — `useCommandPaletteSearch` feeds the
 * command palette, which `DashboardLayout` renders unconditionally, so this
 * query runs on EVERY ROUTE. It was an unbounded `.collect()` that read every
 * row and filtered archived ones afterwards, and `links` is soft-delete only,
 * so archived rows accumulate forever and were read on every route.
 *
 * That is the identical defect class Phase 126's SWEEP-01 removed from the
 * Inbox badge, in a different module. Fixing one and leaving the other would
 * have shipped an app that still performs an unbounded shell read.
 *
 * `take(CAP + 1)` rather than `take(CAP)` so "more remain" is VISIBLE: the
 * house no-silent-caps rule (D-01) — a cap must be declared to its consumer,
 * never swallowed. Returns `{links, truncated}` for that reason; the bare-array
 * return it replaced had nowhere to put the flag.
 *
 * NOTE the filter runs AFTER the take, so `truncated` means "the SCAN hit the
 * cap", not "more visible links exist". With 25 rows against a 2000 cap that
 * distinction is academic today; it is stated so a future reader does not
 * mistake it for an exact count.
 */
export async function listHandler(ctx: BifrostCtx) {
  const rows = await ctx.db.query("links").take(LINK_LIST_SCAN_CAP + 1);
  const truncated = rows.length > LINK_LIST_SCAN_CAP;
  const scanned = truncated ? rows.slice(0, LINK_LIST_SCAN_CAP) : rows;
  return { links: scanned.filter(isVisible).sort(compareLinks), truncated };
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
