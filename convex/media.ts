/**
 * media.ts — the Studio gallery's read surface, D-08's browser write
 * surface, and (as of plan 118-05) the agent-only ingest write surface.
 *
 * Implements D-01 (thumbnail-transport neutrality — the browser never
 * knows which branch produced `thumbnailUrl`), D-02 (no query ever returns
 * the original file's bytes or a fetchable URL for them — `absPath` is a
 * copy-to-clipboard string only, and `ingestMedia` refuses an oversized
 * thumbnail as a server-side backstop), D-06 (a duplicate `contentHash` is
 * a zero-write idempotent no-op), D-07 (provenance absence is a derived
 * boolean the RENDERING layer turns into "No provenance recorded"; it is
 * never inferred from the filename and never stored as data) and D-08's
 * browser half (`toggleStar`/`softDelete`/`restore` as deliberately PUBLIC
 * mutations — see the split rationale above those three, below).
 *
 * Mirrors convex/loom.ts's handler/export split: every query and mutation
 * is a plain exported async function wrapped by `query({...})` /
 * `mutation({...})` / `internalMutation({...})` only for the generated
 * API, so each is directly unit-testable without booting the Convex
 * runtime (convex/media.test.ts drives the plain exports with a mock ctx,
 * same technique convex/workspaceHttp.test.ts and convex/loom.ts's own
 * tests use).
 *
 * The 30-day janitor's permanent-delete is NOT in this file — it lands in
 * plan 118-06.
 */
import { mutation, internalMutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";

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

// ============================================================
// D-08 browser write surface — deliberately PUBLIC mutations (Task 2)
// ============================================================

/**
 * `toggleStar` / `softDelete` / `restore` are plain `mutation`s, not
 * `internalMutation`s — the INVERSE of `convex/loom.ts`'s `upsertPipeline`
 * rationale (`loom.ts:140-148`). There the concern was a plain mutation
 * landing in the client-callable `api.` namespace and bypassing
 * `validateLoomAuth` in `loomHttp.ts` entirely. Here there is no
 * bearer-gated route to bypass in the first place: the UI-SPEC's card
 * overlay and Sheet footer invoke these three directly from the browser
 * via `useMutation`, and a single-click star toggle or move-to-trash
 * cannot round-trip through a host-side agent — inventing a browser-side
 * bearer flow for it is a shape that exists nowhere else in this repo
 * (`118-RESEARCH.md` Pitfall 4).
 *
 * Trust argument, stated explicitly per CLAUDE.md's SEED-008 decision (the
 * tailnet is the auth boundary; Clerk gates the UI, not the data — making
 * one module's mutations auth-gated in isolation is precisely the shape
 * SEED-008 rejected): this is a LOWER-trust surface than ingest. Ingest
 * (118-05's `ingestMedia`) CREATES new provenance-bearing rows from
 * watcher-scanned file bytes; these three PATCH exactly one boolean or
 * timestamp field on an EXISTING row and can create nothing. Flipping a
 * star or setting a reversible trash timestamp on a single-operator,
 * tailnet-bounded instance is not a privilege this repo gates for its
 * direct analogs either (`convex/galdr.ts`'s `toggleFavorite`,
 * `Bifrost.tsx`'s archive button are both plain public mutations too).
 *
 * Functions that must NOT follow this pattern — they land in plan 118-05
 * as `internalMutation`s, same rationale as `loom.ts`'s `upsertPipeline`:
 * `ingestMedia` (creates rows from watcher-posted bytes), the thumbnail
 * `generateUploadUrl` wrapper (mints a write-capable upload token), and
 * the D-08 janitor's permanent-delete (irreversible, no UI control exists
 * for it in this phase). This is the seam most likely to be got wrong
 * later — said here at the seam, not only in the plan.
 */
export async function toggleStarHandler(ctx: MediaCtx, args: { id: any }) {
  const existing = await ctx.db.get(args.id);
  if (!existing) {
    throw new ConvexError({ code: "NOT_FOUND", message: "media row not found" });
  }
  await ctx.db.patch(args.id, { starred: !existing.starred });
  return { ok: true as const };
}

export const toggleStar = mutation({
  args: { id: v.id("media") },
  handler: async (ctx, args) => toggleStarHandler(ctx as MediaCtx, args),
});

/**
 * Idempotent: an already-deleted row is a no-op that still returns
 * success, never a second timestamp overwriting the original `deletedAt`
 * — that would silently extend the 30-day grace period past what the
 * first delete established (T-118-15).
 *
 * This mutation does NOT delete the thumbnail blob. D-08 requires the
 * blob to survive until the janitor (118-05/118-06), precisely so Restore
 * stays whole — the file moves to `trash\` on the watcher's next cycle,
 * but nothing this mutation touches removes any bytes.
 */
export async function softDeleteHandler(ctx: MediaCtx, args: { id: any }) {
  const existing = await ctx.db.get(args.id);
  if (!existing) {
    throw new ConvexError({ code: "NOT_FOUND", message: "media row not found" });
  }
  if (existing.deletedAt !== undefined) {
    return { ok: true as const, alreadyDeleted: true };
  }
  await ctx.db.patch(args.id, { deletedAt: Date.now() });
  return { ok: true as const, alreadyDeleted: false };
}

export const softDelete = mutation({
  args: { id: v.id("media") },
  handler: async (ctx, args) => softDeleteHandler(ctx as MediaCtx, args),
});

/** Idempotent on a row that is not currently deleted. */
export async function restoreHandler(ctx: MediaCtx, args: { id: any }) {
  const existing = await ctx.db.get(args.id);
  if (!existing) {
    throw new ConvexError({ code: "NOT_FOUND", message: "media row not found" });
  }
  if (existing.deletedAt === undefined) {
    return { ok: true as const, alreadyRestored: true };
  }
  await ctx.db.patch(args.id, { deletedAt: undefined });
  return { ok: true as const, alreadyRestored: false };
}

export const restore = mutation({
  args: { id: v.id("media") },
  handler: async (ctx, args) => restoreHandler(ctx as MediaCtx, args),
});

// ============================================================
// Agent-only ingest write surface — internalMutation (Task 1, plan 118-05)
// ============================================================

/** D-02: `mediaType` and `kind` are closed enums — an unknown value is a
 * refusal, never a written-but-unvalidated string. */
export const MEDIA_TYPES = ["image", "video", "audio"] as const;
export const MEDIA_KINDS = ["gen", "ref", "style"] as const;

/**
 * D-02 server-side backstop: 200 KB, matching `hooks/studioWatch.mjs`'s
 * (plan 118-08) own `THUMB_MAX_BYTES` client-side encoder cap by name and
 * value. Two independent checks exist because "a full-size upload is a bug,
 * not a tuning issue" (D-02) and a single client-side guard is one bug away
 * from a 7.1 GB database growing without bound.
 */
export const THUMB_MAX_BYTES = 200 * 1024;

export interface IngestMediaArgs {
  contentHash: string;
  filename: string;
  absPath: string;
  mediaType: string;
  kind: string;
  sizeBytes: number;
  thumbBytes?: number;
  thumbStorageId?: any;
  thumbRelPath?: string;
  width?: number;
  height?: number;
  durationSec?: number;
  sidecar?: {
    prompt?: string;
    model?: string;
    provider?: string;
    style?: string;
    project?: string;
    params?: string;
    tags?: string[];
  };
}

/**
 * D-05/D-06/D-07 ingest handler. Order is load-bearing — see the plan's
 * numbered rationale, restated at each step below:
 *
 * 1. Dedup lookup FIRST, before any write or validation. A rescan of an
 *    unchanged vault must produce zero writes; running enum/size checks
 *    ahead of the dedup lookup would make a duplicate hash's re-ingest
 *    behaviour depend on whether its (already-accepted) fields still pass
 *    today's validation, which is not what "idempotent no-op" means.
 * 2. Enum validation — refuse rather than write an unknown value.
 * 3. D-02 blob-discipline backstop — refuse an oversized thumbnail
 *    independent of the watcher's own cap.
 * 4. D-07 — provenance fields are copied from `sidecar` verbatim when
 *    present; when `sidecar` is absent (or every field on it is absent),
 *    every provenance field is simply omitted (`undefined`) on the
 *    inserted row. Nothing here ever derives a value from `filename` —
 *    that is the specific failure this rule exists to prevent (a
 *    filename-derived prompt would be indistinguishable from a real one).
 * 5. Insert and return `{ ok: true, mediaId, created: true }`.
 */
export async function ingestMediaHandler(
  ctx: MediaCtx,
  args: IngestMediaArgs,
  now: number
) {
  // 1. D-06 dedup FIRST — zero writes on a known hash.
  const existing = await ctx.db
    .query("media")
    .withIndex("by_contentHash", (q: any) => q.eq("contentHash", args.contentHash))
    .first();
  if (existing) {
    return { ok: true as const, mediaId: existing._id, created: false as const };
  }

  // 2. Enum validation.
  if (!(MEDIA_TYPES as readonly string[]).includes(args.mediaType)) {
    return { ok: false as const, error: "INVALID_ENUM" as const, field: "mediaType" };
  }
  if (!(MEDIA_KINDS as readonly string[]).includes(args.kind)) {
    return { ok: false as const, error: "INVALID_ENUM" as const, field: "kind" };
  }

  // 3. D-02 blob-discipline backstop — bounds the THUMBNAIL's byte count,
  // never the original's `sizeBytes`.
  if (args.thumbBytes !== undefined && args.thumbBytes > THUMB_MAX_BYTES) {
    return { ok: false as const, error: "THUMB_TOO_LARGE" as const };
  }

  // 4. D-07 provenance — verbatim from `sidecar` when present, every field
  // omitted (not blanked, not derived from `filename`) when absent.
  const sidecar = args.sidecar;
  // `sidecar.style` is a curated-style SLUG on the wire (matching every
  // other slug-keyed lookup in this repo, e.g. mediaModels.slug); it
  // resolves to the schema's `styleId` reference via `mediaStyles`'
  // `by_slug` index. An unrecognised slug resolves to `styleId` absent
  // (same "absence is safe, never an error that skips the file" shape as
  // D-07 itself) rather than refusing the whole ingest over a style label.
  let styleId: any = undefined;
  if (sidecar?.style) {
    const styleRow = await ctx.db
      .query("mediaStyles")
      .withIndex("by_slug", (q: any) => q.eq("slug", sidecar.style))
      .first();
    if (styleRow) styleId = styleRow._id;
  }

  // 5. Insert.
  const mediaId = await ctx.db.insert("media", {
    filename: args.filename,
    absPath: args.absPath,
    mediaType: args.mediaType,
    kind: args.kind,
    contentHash: args.contentHash,
    sizeBytes: args.sizeBytes,
    starred: false,
    createdAt: now,
    model: sidecar?.model,
    provider: sidecar?.provider,
    prompt: sidecar?.prompt,
    project: sidecar?.project,
    styleId,
    params: sidecar?.params,
    tags: sidecar?.tags,
    width: args.width,
    height: args.height,
    durationSec: args.durationSec,
    thumbStorageId: args.thumbStorageId,
    thumbRelPath: args.thumbRelPath,
  });

  return { ok: true as const, mediaId, created: true as const };
}

/**
 * `internalMutation`, not `mutation` (same rule as `convex/loom.ts:140-148`'s
 * `upsertPipeline`, restated here) — a plain `mutation` lands in the
 * client-callable `api.` namespace, so any holder of the shipped
 * `VITE_CONVEX_URL` could create a provenance-bearing row straight from
 * devtools, bypassing `validateStudioAuth` in `studioHttp.ts` entirely. The
 * UI never calls this; `hooks/studioWatch.mjs` (plan 118-08) reaches it only
 * through the bearer-gated `POST /studio/ingest` route.
 */
export const ingestMedia = internalMutation({
  args: {
    contentHash: v.string(),
    filename: v.string(),
    absPath: v.string(),
    mediaType: v.string(),
    kind: v.string(),
    sizeBytes: v.number(),
    thumbBytes: v.optional(v.number()),
    thumbStorageId: v.optional(v.id("_storage")),
    thumbRelPath: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    durationSec: v.optional(v.number()),
    sidecar: v.optional(
      v.object({
        prompt: v.optional(v.string()),
        model: v.optional(v.string()),
        provider: v.optional(v.string()),
        style: v.optional(v.string()),
        project: v.optional(v.string()),
        params: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
      })
    ),
  },
  handler: async (ctx, args) => ingestMediaHandler(ctx as MediaCtx, args, Date.now()),
});

/**
 * `internalMutation`, same rationale as `ingestMedia` immediately above —
 * this mints a write-capable upload token, so only the bearer-gated route
 * may reach it. Copies `convex/avatars.ts:63-68`'s `ctx.storage.*` call
 * shape verbatim; the only change is the `mutation` -> `internalMutation`
 * wrapper, because avatars are edited from the UI and Studio's thumbnails
 * are not (D-01 note, `118-PATTERNS.md`).
 *
 * Included because the live D-01 branch is `convex-storage`
 * (`118-D01-EVIDENCE.md`) — on the `local-static-origin` branch this
 * function would be omitted entirely, since that fallback uploads nothing
 * to Convex.
 */
export const generateThumbUploadUrl = internalMutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});
