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
 * D-08's 30-day janitor (permanent delete of trashed rows + their thumb
 * blobs) lives in this file too, added by plan 118-06 — see the
 * `pruneTrashBatch` section near the end.
 */
import { mutation, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
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

/**
 * D-08 host-side reconciliation support (plan 118-08). `hooks/studioWatch.mjs`
 * needs to know, for every row, whether it is currently soft-deleted and
 * which top-level directory it belongs in — that is the entire input its
 * `reconcileTrash` needs to move files `gen\`<->`trash\` and to reclaim an
 * orphaned `trash\` file the janitor has already deleted server-side. This
 * returns a BOUNDED projection of exactly those three fields
 * (`contentHash`/`deletedAt`/`kind`) — never `absPath`, `prompt`, or any
 * other provenance field, so the watcher's in-memory hash index does not
 * become a second copy of the gallery's full data.
 *
 * `internalQuery`, not `query` — reached only via the bearer-gated
 * `GET /studio/media-hashes` route in `studioHttp.ts`, same rationale as
 * `ingestMedia`/`generateThumbUploadUrl` above: a plain `query` would land
 * in the client-callable `api.` namespace.
 *
 * Two bounded `by_deletedAt` reads (active + trashed) together cover the
 * WHOLE table, matching `listHandler`/`listTrashHandler`'s own split of the
 * same index. Bounded at `MEDIA_HASH_INDEX_CAP` per side, well under the
 * ~4,096-read ceiling this repo has already hit twice (T-118-08) — a plain
 * query has no writes to also count as reads the way `pruneTrashBatch`'s
 * mutation does, so there is no delete-as-read arithmetic here, only the
 * two `.take()` bounds themselves.
 *
 * `truncated: true` when EITHER side hits its cap — the caller (the
 * watcher's `reconcileTrash`) MUST treat a truncated result as
 * untrustworthy, not merely incomplete: a truncated active-row list could
 * make a real, still-live file look like an orphan and get deleted. This
 * extends T-118-27's "a failed read must never read as 'no rows exist'"
 * rule to "a partial read must never read as 'these are all the rows'."
 */
export const MEDIA_HASH_INDEX_CAP = 1500;

export async function getMediaHashIndexHandler(ctx: MediaCtx) {
  const active = await ctx.db
    .query("media")
    .withIndex("by_deletedAt", (q: any) => q.eq("deletedAt", undefined))
    .take(MEDIA_HASH_INDEX_CAP);
  const trashed = await ctx.db
    .query("media")
    .withIndex("by_deletedAt", (q: any) => q.gt("deletedAt", undefined))
    .take(MEDIA_HASH_INDEX_CAP);

  const truncated =
    active.length >= MEDIA_HASH_INDEX_CAP || trashed.length >= MEDIA_HASH_INDEX_CAP;

  const rows = [...active, ...trashed].map((row: any) => ({
    contentHash: row.contentHash as string,
    deletedAt: row.deletedAt as number | undefined,
    kind: row.kind as string,
  }));

  return { rows, truncated };
}

export const getMediaHashIndex = internalQuery({
  args: {},
  handler: async (ctx) => getMediaHashIndexHandler(ctx as MediaCtx),
});

// ============================================================
// D-08's 30-day trash janitor — internalMutation (Task 1, plan 118-06)
// ============================================================

/** Ctx shape the janitor needs on top of `MediaCtx`: `storage.delete` (blob
 * removal) and `scheduler.runAfter` (self-rescheduling). Narrowed the same
 * way `StorageReader`/`MediaCtx` are above, so a fake ctx implementing only
 * these three surfaces is enough to unit-test the handler. */
type JanitorCtx = MediaCtx & {
  storage: MediaCtx["storage"] & { delete: (id: any) => Promise<void> };
  scheduler: { runAfter: (delayMs: number, fnRef: any, args: any) => Promise<any> };
};

/**
 * D-08's batch size — matching `retention.ts`'s `BATCH_SIZE` by name and
 * value. Arithmetic against T-118-08's actual ceiling (spelled out because
 * this repo has already lost two sessions to a cap justified against the
 * WRONG number): a `.take(TRASH_PRUNE_BATCH_SIZE)` read costs up to 200
 * reads, and every `ctx.db.delete()` in the loop below ALSO counts as a
 * read against Convex's ~4,096-read-per-mutation ceiling — not the
 * 16,000-document WRITE ceiling the Convex limits page (and this repo's
 * own older comments) name. 200 (read) + 200 (delete-as-read) = ~400
 * reads/invocation, comfortably under 4,096 with >10x headroom. Do not
 * raise this constant without re-deriving that arithmetic — Phase 115 hit
 * the read ceiling at caps of 4000, 2000, 1000 AND 500, all failing
 * identically, because every one of those was still bisecting against the
 * wrong ceiling (118-RESEARCH.md § "Pitfall 2").
 */
export const TRASH_PRUNE_BATCH_SIZE = 200;

/**
 * Per-invocation-chain ceiling, mirroring `retention.ts`'s
 * `MAX_BATCHES_PER_NIGHT` (T-118-19). At 200 rows/batch this bounds a
 * single scheduled chain to 100 * 200 = 20,000 permanent deletes before it
 * stops rescheduling itself and simply waits for the next cron firing —
 * the same "a capped run defers its remainder rather than looping
 * forever" shape `retention.ts` uses, so a pathological trash backlog
 * cannot turn this janitor into an unbounded self-rescheduling loop.
 */
export const TRASH_PRUNE_MAX_BATCHES = 100;

/**
 * Inter-batch delay, matching `retention.ts`'s `RESCHEDULE_DELAY_MS` — a
 * moment between batches so a long trash-day doesn't starve ingest/browser
 * reads on this single-node SQLite instance with one long back-to-back
 * delete chain.
 */
const TRASH_PRUNE_RESCHEDULE_MS = 3000;

/**
 * `pruneTrashBatch` — D-08's permanent-delete half. Modelled structurally
 * on `retention.ts`'s `pruneBatchV3` (the POSITIVE donor: cursor-seeked
 * `withIndex` range read, one bounded `.take()`, self-rescheduling via
 * `ctx.scheduler.runAfter` carrying the cursor forward, a per-chain batch
 * ceiling) — deliberately NOT on `forge.ts:1828-1877`'s
 * `sweepForgeFileRecords` (the NEGATIVE donor: an unbounded whole-table
 * `collect` read that is a live, already-shipped instance of the exact
 * T-118-08 defect class). The one thing `forge.ts` DOES get right, and
 * which this function keeps, is deleting the blob before the row (`forge.ts`'s own D-05
 * comment: "CRITICAL: storage.delete(storageId) BEFORE db.delete to
 * prevent blob leak").
 *
 * `TRASH_GRACE_MS` (declared above, shared with `listTrashHandler`'s
 * `daysUntilPurge`) is the single source of the 30-day grace period — the
 * Trash view's countdown and this janitor's cutoff can never drift apart
 * because they read the same constant.
 *
 * Ordering matters and is deliberate (T-118-20/T-118-21):
 * 1. Delete the thumbnail blob FIRST, when `thumbStorageId` is populated
 *    (the live D-01 branch — `convex-storage`, `118-D01-EVIDENCE.md`; the
 *    `local-static-origin` fallback branch was never live on this
 *    deployment, so there is no `thumbRelPath`-keyed blob to delete here —
 *    see the host-side orphan-file rule below, which is that branch's
 *    reclamation path instead). Wrapped in try/catch: a row whose blob is
 *    already gone must still have its row deleted, or the janitor wedges
 *    forever on one bad row and stops bounding the only retention-exempt
 *    table in this schema (T-118-21).
 * 2. Delete the row. If step 1 threw, the row is STILL deleted here — a
 *    missing blob is not a reason to leave an unreachable trash row
 *    around forever.
 *
 * If step 1 succeeds but the mutation aborts before step 2 for some other
 * reason, the row survives to be retried on the next batch (this is why
 * blob-before-row is the safe ordering: an orphaned blob with no row
 * pointing at it is unreclaimable, but a surviving row with an
 * already-deleted blob just retries a no-op storage.delete next time).
 *
 * Host-side orphan reconciliation (the other half of D-08, owned by plan
 * 118-08's watcher — NOT duplicated here as a second 30-day constant,
 * which could drift from this one): once this janitor deletes a `media`
 * row, the corresponding file sitting in `media-vault\trash\` on disk has
 * nothing left pointing at it. `hooks/studioWatch.mjs` reconciles that on
 * its own next cycle by deleting any `trash\` file whose `contentHash`
 * matches no `media` row — self-reconciling by construction, so plan
 * 118-08 needs no second grace-period constant to stay in sync with this
 * one.
 */
export async function pruneTrashBatchHandler(
  ctx: JanitorCtx,
  args: { cursorMs?: number; batchesDone?: number },
  nowMs: number
): Promise<{ deletedCount: number; nextCursorMs: number; rescheduled: boolean }> {
  const cursorMs = args.cursorMs ?? 0;
  const batchesDone = args.batchesDone ?? 0;

  // T-118-19 entry guard: refuse to do ANY work — not even read a batch —
  // once this chain has already used its per-invocation-chain ceiling.
  // Mirrors retention.ts's pruneBatchV3 entry check (`args.batchesUsed >=
  // MAX_BATCHES_PER_NIGHT`). The remainder waits for the next cron firing
  // rather than looping.
  if (batchesDone >= TRASH_PRUNE_MAX_BATCHES) {
    console.log(
      `studio: trash-prune per-chain batch cap (${TRASH_PRUNE_MAX_BATCHES}) already reached; remainder deferred to the next scheduled run`
    );
    return { deletedCount: 0, nextCursorMs: cursorMs, rescheduled: false };
  }

  const cutoffMs = nowMs - TRASH_GRACE_MS;

  // Cursor-seeked, cutoff-bounded range read via by_deletedAt. NEVER an
  // unbounded whole-table read (T-118-08) — the
  // `.take(TRASH_PRUNE_BATCH_SIZE)` bound comes from the index range
  // itself, not from a post-filter over an unbounded
  // read. `.gte(cursorMs)` naturally excludes rows with `deletedAt`
  // absent — Convex's index value ordering is `undefined < null < all
  // other values` (documented at controlVerbSwaps.ts:105-109), so an
  // absent `deletedAt` sorts below any real cursor and is never matched.
  const batch = await ctx.db
    .query("media")
    .withIndex("by_deletedAt", (q: any) =>
      q.gte("deletedAt", cursorMs).lt("deletedAt", cutoffMs)
    )
    .order("asc")
    .take(TRASH_PRUNE_BATCH_SIZE);

  let deletedCount = 0;
  let lastDeletedAt = cursorMs;

  for (const row of batch) {
    // 1. Blob before row (T-118-20/T-118-21) — see the docstring above.
    if (row.thumbStorageId) {
      try {
        await ctx.storage.delete(row.thumbStorageId);
      } catch (err) {
        console.log(
          `studio: trash-prune blob delete failed for media ${row._id} (thumbStorageId ${row.thumbStorageId}); deleting the row anyway so the janitor does not wedge: ${err}`
        );
      }
    }
    // 2. The row.
    await ctx.db.delete(row._id);
    deletedCount++;
    if (typeof row.deletedAt === "number") lastDeletedAt = row.deletedAt;
  }

  const batchesUsedAfter = batchesDone + 1;
  const batchWasFull = batch.length >= TRASH_PRUNE_BATCH_SIZE;
  // A short batch means the index range is drained (it is already bounded
  // by cutoffMs, so every row past it was eligible) — the sweep is done
  // and there is nothing left to reschedule for. A full batch may have
  // more eligible rows past what this batch covered, UNLESS this
  // invocation just hit the per-chain ceiling itself (T-118-19).
  const rescheduled = batchWasFull && batchesUsedAfter < TRASH_PRUNE_MAX_BATCHES;

  if (rescheduled) {
    await ctx.scheduler.runAfter(TRASH_PRUNE_RESCHEDULE_MS, internal.media.pruneTrashBatch, {
      cursorMs: lastDeletedAt,
      batchesDone: batchesUsedAfter,
    });
  }

  if (deletedCount > 0) {
    console.log(
      `studio: trash-prune deleted ${deletedCount} row(s), cursor now ${lastDeletedAt}${rescheduled ? ", rescheduled" : ""}`
    );
  }

  return { deletedCount, nextCursorMs: lastDeletedAt, rescheduled };
}

/**
 * `internalMutation`, same rationale as `ingestMedia`/`generateThumbUploadUrl`
 * above (T-118-02) — this is an irreversible permanent delete with no UI
 * control anywhere in this phase; only the nightly cron (`convex/crons.ts`)
 * may reach it.
 */
export const pruneTrashBatch = internalMutation({
  args: {
    cursorMs: v.optional(v.number()),
    batchesDone: v.optional(v.number()),
  },
  handler: async (ctx, args) => pruneTrashBatchHandler(ctx as JanitorCtx, args, Date.now()),
});

// ============================================================
// D-12 recipe cards — the mediaModels write path (plan 118-12)
// ============================================================

/**
 * D-12's secrets rule, enforced in code as a BACKSTOP — not as the control.
 * The control is authoring discipline: `recipeMd` references environment
 * variable NAMES only, and Convex stores no key material at all. This
 * function exists because a card is an authoritative-looking instruction set
 * that someone will later copy-paste from, and a pasted key inside one would
 * be replicated by every reader.
 *
 * WHAT IT CATCHES (deliberately narrow — only shapes that are unambiguously a
 * VALUE, never a name):
 *   A. a credential-shaped NAME assigned a credential-shaped LITERAL, e.g.
 *      `HIGGSFIELD_API_KEY=hf3x9q2v8m1p0zt4` — the assignment plus a value
 *      that is >=16 chars of key alphabet AND mixes letters with digits;
 *   B. a well-known provider key PREFIX with a long tail (`sk-`, `sk_live_`,
 *      `sb_secret_`, `sbp_`, `ghp_`, `github_pat_`, `xox[bp]-`, `AKIA`,
 *      `AIza`), or a three-segment JWT;
 *   C. a standalone high-entropy token of >=40 chars mixing lower, upper and
 *      digit — the generic backstop for a key with no recognisable prefix.
 *
 * KNOWN FALSE POSITIVE, so a confusing refusal is diagnosable: rule C fires on
 * any >=40-char run of key-alphabet characters mixing case and digits, and a
 * long timestamped FILENAME qualifies — e.g.
 * `studio_control-no-sidecar_a1_20260815T144553.png` (47 chars; the `T`
 * separator supplies the uppercase). If a legitimate card is refused with
 * `HIGH_ENTROPY_TOKEN`, look for a long filename before assuming a leak; break
 * it across lines or shorten it. The threshold is deliberately NOT relaxed to
 * accommodate this — a shorter bound would start missing real keys, and a
 * false refusal is recoverable while a published key is not.
 *
 * WHAT IT DOES NOT CATCH, stated so nobody mistakes it for a boundary:
 *   - a short secret, an all-lowercase secret, an all-digit PIN;
 *   - a secret broken across lines, or embedded inside prose;
 *   - anything in `name`/`slug`/`docsUrl`/any field other than `recipeMd`;
 *   - a secret that simply does not look like one.
 *
 * WHAT IT MUST NEVER REFUSE, because naming the variable is exactly what D-12
 * REQUIRES: a card that says "reads `FAL_KEY` from the environment", a table
 * row listing `HIGGSFIELD_API_KEY`, a placeholder (`$FAL_KEY`,
 * `${HIGGSFIELD_API_KEY}`, `<your-key>`), or a shell line that passes the
 * variable by reference. `convex/media.test.ts`'s acceptance case is the
 * control that proves this guard discriminates rather than refusing
 * everything.
 */
const CREDENTIAL_NAME_ASSIGNMENT =
  /\b[A-Za-z0-9_]*(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL)[A-Za-z0-9_]*\s*[:=]\s*["'`]?([A-Za-z0-9_\-+/.=]{16,})/i;

const CREDENTIAL_PREFIXES =
  /\b(?:sk-[A-Za-z0-9_-]{16,}|sk_(?:live|test)_[A-Za-z0-9]{16,}|sb_secret_[A-Za-z0-9_-]{16,}|sbp_[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[bpsa]-[A-Za-z0-9-]{16,}|AKIA[A-Z0-9]{12,}|AIza[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/;

const HIGH_ENTROPY_TOKEN = /(?:^|[\s"'`(=:,])([A-Za-z0-9_-]{40,})(?:$|[\s"'`),.;])/;

/** A captured "value" that is plainly a reference or a placeholder, not key
 * material. Checked before the mixed-class test so `$FAL_KEY`-style
 * indirection is accepted by name rather than by luck. */
function looksLikePlaceholder(value: string): boolean {
  if (/^[$<{*.]/.test(value)) return true;
  if (/^[*.\-_x]+$/i.test(value)) return true;
  return /^(?:your|my|the|some|example|sample|placeholder|redacted|changeme|null|undefined|none|xxx)/i.test(
    value
  );
}

/** Key material mixes letter classes with digits; prose separated by `-`
 * (`read-from-environment`) does not. Requiring a digit AND a letter is what
 * keeps this from firing on English. */
function looksLikeKeyMaterial(value: string): boolean {
  return /[A-Za-z]/.test(value) && /[0-9]/.test(value);
}

/** Returns the matched rule's name when `recipeMd` appears to contain a
 * credential VALUE, or null when it does not. Exported for direct testing. */
export function detectCredentialValue(recipeMd: string): string | null {
  const prefixed = CREDENTIAL_PREFIXES.exec(recipeMd);
  if (prefixed) return "PROVIDER_KEY_PREFIX";

  const assigned = CREDENTIAL_NAME_ASSIGNMENT.exec(recipeMd);
  if (assigned) {
    const value = assigned[1];
    if (!looksLikePlaceholder(value) && looksLikeKeyMaterial(value)) {
      return "CREDENTIAL_NAME_ASSIGNED_A_VALUE";
    }
  }

  const entropic = HIGH_ENTROPY_TOKEN.exec(recipeMd);
  if (entropic) {
    const token = entropic[1];
    if (/[a-z]/.test(token) && /[A-Z]/.test(token) && /[0-9]/.test(token)) {
      return "HIGH_ENTROPY_TOKEN";
    }
  }

  return null;
}

export interface UpsertModelCardArgs {
  slug: string;
  name: string;
  type: string;
  provider: string;
  recipeMd: string;
  docsUrl?: string;
  aspect?: string;
  resolution?: string;
  duration?: number;
  enabled: boolean;
}

/**
 * Keyed on `slug` (the `by_slug` index): an existing slug is PATCHED, a new
 * slug is INSERTED. Never two rows for one slug — a card is a curated
 * singleton, and a second row for the same model would make "which recipe is
 * authoritative" unanswerable.
 *
 * D-12: a card exists only for a model that has actually been run end to end.
 * Seeding from a provider's model list was rejected as transcription rather
 * than verification, and `enabled` is not a substitute for having run the
 * thing.
 */
export async function upsertModelCardHandler(ctx: MediaCtx, args: UpsertModelCardArgs) {
  const offendingRule = detectCredentialValue(args.recipeMd);
  if (offendingRule) {
    // The error names the RULE, never the matched text — echoing the match
    // back would put the credential into the caller's terminal and this
    // repo's session transcript, which is the exact disclosure the guard
    // exists to prevent (T-118-04).
    throw new ConvexError({
      code: "CREDENTIAL_IN_RECIPE",
      rule: offendingRule,
      message:
        "recipeMd appears to contain a credential VALUE. D-12: reference environment-variable NAMES only; Convex stores no keys.",
    });
  }

  const existing = await ctx.db
    .query("mediaModels")
    .withIndex("by_slug", (q: any) => q.eq("slug", args.slug))
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, {
      name: args.name,
      type: args.type,
      provider: args.provider,
      recipeMd: args.recipeMd,
      docsUrl: args.docsUrl,
      aspect: args.aspect,
      resolution: args.resolution,
      duration: args.duration,
      enabled: args.enabled,
    });
    return { ok: true as const, modelId: existing._id, created: false as const };
  }

  const modelId = await ctx.db.insert("mediaModels", {
    slug: args.slug,
    name: args.name,
    type: args.type,
    provider: args.provider,
    recipeMd: args.recipeMd,
    docsUrl: args.docsUrl,
    aspect: args.aspect,
    resolution: args.resolution,
    duration: args.duration,
    enabled: args.enabled,
  });
  return { ok: true as const, modelId, created: true as const };
}

/**
 * `internalMutation`, not `mutation` — the same rule as `ingestMedia` above,
 * and for a sharper reason. A recipe card is an INSTRUCTION SET that
 * `/studio-generate` executes next time: a public card writer would let
 * anything that can route to this host author an authoritative-looking recipe
 * (CLAUDE.md's self-hosted-Convex rule — every public Convex function is
 * callable with no credential by anything that can reach the backend). The UI
 * renders `mediaModels` read-only and calls nothing here.
 *
 * INVOKED ATTENDED, never automatically. Card authoring is a rare operator
 * action performed once per model that has been proven end to end, via:
 *
 *   npx convex run internal.media.upsertModelCard '<json>' \
 *     --env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile
 *
 * Never add `--push` or `--prod` to that command: `convex run` is read-only,
 * but `--push` DEPLOYS the working tree first, which in a shared checkout
 * ships another session's uncommitted work (the 2026-08-11 unauthorised
 * production deploy).
 */
export const upsertModelCard = internalMutation({
  args: {
    slug: v.string(),
    name: v.string(),
    type: v.string(),
    provider: v.string(),
    recipeMd: v.string(),
    docsUrl: v.optional(v.string()),
    aspect: v.optional(v.string()),
    resolution: v.optional(v.string()),
    duration: v.optional(v.number()),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => upsertModelCardHandler(ctx as MediaCtx, args),
});
