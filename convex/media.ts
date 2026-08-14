/**
 * media.ts — the Studio gallery's read surface and D-08's browser write
 * surface (Phase 118, plan 118-04).
 *
 * Implements D-01 (thumbnail-transport neutrality — the browser never
 * knows which branch produced `thumbnailUrl`), D-02 (no query ever returns
 * the original file's bytes or a fetchable URL for them — `absPath` is a
 * copy-to-clipboard string only), D-07 (provenance absence is a derived
 * boolean the RENDERING layer turns into "No provenance recorded"; it is
 * never inferred from the filename and never stored as data) and D-08's
 * browser half (`toggleStar`/`softDelete`/`restore` as deliberately PUBLIC
 * mutations — see the split rationale above those three, below).
 *
 * Mirrors convex/loom.ts's handler/export split: every query and mutation
 * is a plain exported async function wrapped by `query({...})` /
 * `mutation({...})` only for the generated API, so each is directly
 * unit-testable without booting the Convex runtime (convex/media.test.ts
 * drives the plain exports with a mock ctx, same technique
 * convex/workspaceHttp.test.ts and convex/loom.ts's own tests use).
 *
 * `ingestMedia`, the thumbnail `generateUploadUrl` wrapper, and the 30-day
 * janitor's permanent-delete are NOT in this file — they land in plan
 * 118-05 as `internalMutation`s, and 118-05 is also the plan that deploys
 * this module. This plan does not deploy.
 */
import { query } from "./_generated/server";

// ============================================================
// Shared bounds and helper types
// ============================================================

/**
 * Every gallery/trash/styles/models read is bounded at this cap rather than
 * reading the whole table unbounded. This is the same defect class that has
 * already hit this repo's Convex mutations twice at the platform's
 * ~4,096-read ceiling (CLAUDE.md's self-hosted Convex operational rules,
 * T-118-08) — an unfiltered whole-table read purely to get `.length` or to
 * hand rows to the UI reads every row regardless of how few the UI
 * actually renders. `take(...)` only, everywhere below.
 */
export const GALLERY_ROW_CAP = 500;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const TRASH_GRACE_MS = 30 * ONE_DAY_MS;

/** Narrow ctx shape so the storage-touching helper is testable with a fake
 * ctx that implements nothing but `storage.getUrl`. */
type StorageReader = {
  storage: { getUrl: (id: any) => Promise<string | null> };
};

/** Narrow ctx shape for the query/mutation handlers below — `db` stays
 * `any`, matching the house convention (`convex/loom.ts`'s `LoomCtx`). */
type MediaCtx = StorageReader & { db: any };

interface ThumbnailSourceRow {
  thumbStorageId?: string | null;
  thumbRelPath?: string | null;
}

interface ProvenanceSourceRow {
  prompt?: string | null;
  model?: string | null;
  provider?: string | null;
}

/**
 * D-01: the ONE place `thumbnailUrl` is resolved — `list`, `listTrash` and
 * `listStyles` all call this same helper, so there is exactly one place to
 * audit if the transport branch is ever revisited.
 *
 * This deployment resolved BRANCH: convex-storage (plan 118-01,
 * `118-D01-EVIDENCE.md`) — `thumbStorageId` is the populated field on
 * every row. `thumbRelPath` (the `local-static-origin` fallback branch) is
 * declared on the schema but was never the live branch, and no static
 * origin exists to join it against — a row carrying only `thumbRelPath`
 * resolves to `null` here rather than fabricating a URL from a field this
 * deployment never populates. A resolver that "helpfully" built a URL from
 * the dead field would mask a mis-ingested row instead of surfacing it as
 * a broken thumbnail. If the `local-static-origin` branch is ever
 * revisited, the origin-join logic belongs HERE and only here.
 */
export async function resolveThumbnailUrl(
  ctx: StorageReader,
  row: ThumbnailSourceRow
): Promise<string | null> {
  if (row.thumbStorageId) {
    return await ctx.storage.getUrl(row.thumbStorageId as any);
  }
  return null;
}

/**
 * D-07: a row has provenance only when at least one of `prompt`/`model`/
 * `provider` is present — matching the `Missing Provenance` filter chip's
 * own definition. Pure so it is testable without a database.
 *
 * Where the "No provenance recorded" sentinel is produced: NOT here, and
 * NOT anywhere in this file. This function (and the queries that call it)
 * return the raw absent fields as `undefined` plus this boolean; the
 * RENDERING layer (plan 118-10) substitutes the literal string. A Convex
 * row carrying the sentinel as stored data would be indistinguishable from
 * a real prompt whose text happens to be that string, and would poison the
 * `Missing Provenance` filter (a row with the sentinel stored as `prompt`
 * would read as "has a prompt"). Keeping the absence a boolean, derived at
 * read time, is what keeps the filter and the display honest from the same
 * source of truth.
 */
export function deriveHasProvenance(row: ProvenanceSourceRow): boolean {
  return Boolean(row.prompt || row.model || row.provider);
}

// ============================================================
// Read paths (Task 1)
// ============================================================

/**
 * Gallery feed — rows where `deletedAt` is absent, newest-first.
 *
 * D-08 UX: no filter args — the UI filters the already-subscribed list
 * client-side (matching how `Galdr.tsx`/`Bifrost.tsx` treat their own
 * sets); pushing the filter chips into the query would multiply query
 * shapes for no benefit on a table this small.
 *
 * Filtering uses `q.eq("deletedAt", undefined)` on the `by_deletedAt`
 * index — the same "index on undefined matches the absent field" idiom
 * `convex/controlVerbSwaps.ts:116` already establishes in this repo
 * (`q.eq(field, null)` would silently match zero rows forever; Convex
 * indexes an absent field only under `undefined`). `.order("desc")` on
 * that index sorts by insertion order, which is not guaranteed to be
 * exactly `createdAt` order — so the already-bounded batch is re-sorted by
 * the schema's own `createdAt` field in memory afterward, which is O(cap
 * log cap) on an array already capped at `GALLERY_ROW_CAP`, not a further
 * database read.
 */
export async function listHandler(ctx: MediaCtx) {
  const rows = await ctx.db
    .query("media")
    .withIndex("by_deletedAt", (q: any) => q.eq("deletedAt", undefined))
    .order("desc")
    .take(GALLERY_ROW_CAP);

  const sorted = [...rows].sort((a: any, b: any) => b.createdAt - a.createdAt);

  const derived = await Promise.all(
    sorted.map(async (row: any) => ({
      // Full raw row, D-02: `absPath` passes through unchanged as a plain
      // string — the UI offers it as a copy-to-clipboard value only, it is
      // never turned into a fetchable URL or origin here or anywhere else
      // in this file.
      ...row,
      thumbnailUrl: await resolveThumbnailUrl(ctx, row),
      hasProvenance: deriveHasProvenance(row),
    }))
  );

  return { rows: derived, cap: GALLERY_ROW_CAP };
}

export const list = query({
  args: {},
  handler: async (ctx) => listHandler(ctx as MediaCtx),
});

/**
 * Trash feed — rows where `deletedAt` IS present, most-recently-deleted
 * first, plus a server-computed `daysUntilPurge` so the "Deletes
 * automatically in N days" caption is computed once here rather than in
 * three components.
 *
 * `q.gt("deletedAt", undefined)` selects every row with a defined
 * `deletedAt`, regardless of its value — Convex's index value ordering is
 * `undefined < null < all other values` (documented at
 * `convex/controlVerbSwaps.ts:105-109`), so "greater than undefined"
 * is exactly "the field is set," without hardcoding a lower timestamp
 * bound the way `.gte(0)` would.
 */
export async function listTrashHandler(ctx: MediaCtx) {
  const rows = await ctx.db
    .query("media")
    .withIndex("by_deletedAt", (q: any) => q.gt("deletedAt", undefined))
    .order("desc")
    .take(GALLERY_ROW_CAP);

  const sorted = [...rows].sort(
    (a: any, b: any) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0)
  );

  const now = Date.now();
  const derived = await Promise.all(
    sorted.map(async (row: any) => ({
      ...row,
      thumbnailUrl: await resolveThumbnailUrl(ctx, row),
      hasProvenance: deriveHasProvenance(row),
      daysUntilPurge: Math.ceil(
        ((row.deletedAt ?? now) + TRASH_GRACE_MS - now) / ONE_DAY_MS
      ),
    }))
  );

  return { rows: derived, cap: GALLERY_ROW_CAP };
}

export const listTrash = query({
  args: {},
  handler: async (ctx) => listTrashHandler(ctx as MediaCtx),
});

/**
 * Curated style presets. Each row's `previewMediaId` (when present and not
 * dangling) resolves through the SAME `resolveThumbnailUrl` helper `list`
 * and `listTrash` use, so a style preview and a gallery card can never
 * disagree about how a thumbnail resolves.
 */
export async function listStylesHandler(ctx: MediaCtx) {
  const styles = await ctx.db.query("mediaStyles").take(GALLERY_ROW_CAP);

  return await Promise.all(
    styles.map(async (style: any) => {
      let thumbnailUrl: string | null = null;
      if (style.previewMediaId) {
        const previewRow = await ctx.db.get(style.previewMediaId);
        if (previewRow) {
          thumbnailUrl = await resolveThumbnailUrl(ctx, previewRow);
        }
        // previewRow absent (dangling pointer) → thumbnailUrl stays null,
        // same "absent signal renders as absent" rule D-01/D-07 both use
        // (src/pages/Bifrost.tsx's livenessOf).
      }
      return { ...style, thumbnailUrl };
    })
  );
}

export const listStyles = query({
  args: {},
  handler: async (ctx) => listStylesHandler(ctx as MediaCtx),
});

/**
 * Curated model recipe cards (D-12). `recipeMd` is returned VERBATIM — no
 * markdown parsing, no HTML generation, no sanitisation-by-transformation
 * here. The rendering rule (plain `<pre>`, `font-mono`, never
 * `dangerouslySetInnerHTML` — T-118-05) belongs to plan 118-10; this query
 * only ever hands back the stored string.
 */
export async function listModelsHandler(ctx: MediaCtx) {
  return await ctx.db.query("mediaModels").take(GALLERY_ROW_CAP);
}

export const listModels = query({
  args: {},
  handler: async (ctx) => listModelsHandler(ctx as MediaCtx),
});
