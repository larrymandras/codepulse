/**
 * Tests for convex/media.ts (Phase 118, plan 118-04).
 *
 * Four `describe` blocks, each using a different technique for a different
 * reason:
 *
 * 1. D-07 provenance — drives `deriveHasProvenance`, a pure function, with
 *    no ctx at all. Both the absent and present cases are asserted in the
 *    SAME test (control pair), and the absent case uses a prompt-shaped
 *    filename as an adversarial input, so an implementation that infers
 *    provenance from the filename fails loudly.
 * 2. D-01 thumbnail neutrality — drives `resolveThumbnailUrl` with a fake
 *    `ctx.storage.getUrl` spy, asserting both which branch calls it and
 *    which branch must NOT.
 * 3. D-08 mutation halves — drives the plain `*Handler` exports (never the
 *    `mutation({...})`-wrapped constants, which cannot be invoked outside
 *    a real Convex runtime) with a mock `ctx.db` whose `patch` is a
 *    recording spy, matching `convex/workspaceHttp.test.ts`'s
 *    `runMutation`-recording `mockCtx` pattern.
 * 4. Pitfall 4 — a source-level assertion over `convex/media.ts`'s own
 *    text (no Convex runtime, no `convex-test`, matching
 *    `convex/retention.test.ts`'s technique), because the thing under test
 *    is a declaration-level property (`mutation(` vs `internalMutation(`),
 *    not a runtime behaviour.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  deriveHasProvenance,
  resolveThumbnailUrl,
  toggleStarHandler,
  softDeleteHandler,
  restoreHandler,
  ingestMediaHandler,
  pruneTrashBatchHandler,
  getMediaHashIndexHandler,
  MEDIA_TYPES,
  MEDIA_KINDS,
  THUMB_MAX_BYTES,
  TRASH_PRUNE_BATCH_SIZE,
  TRASH_PRUNE_MAX_BATCHES,
  MEDIA_HASH_INDEX_CAP,
} from "./media";

// ---------------------------------------------------------------------------
// 1. D-07 — provenance absence is derived, never inferred from the filename
// ---------------------------------------------------------------------------

describe("D-07: hasProvenance is derived, never inferred from the filename", () => {
  it("false when prompt/model/provider are all absent (adversarial filename); true when prompt+model are present (control) — asserted together", () => {
    // Adversarial: a filename that LOOKS like a prompt. An implementation
    // that infers provenance (or a prompt value) from the filename would
    // pass a naive "is truthy" check on this row; it must not.
    const noSidecar = {
      filename: "sunset-over-mountains_v3.png",
      prompt: undefined,
      model: undefined,
      provider: undefined,
    };
    const withSidecar = {
      filename: "media-a1b2c3.webp",
      prompt: "a sunset over jagged mountains, golden hour",
      model: "kling-3-omni",
      provider: undefined,
    };

    // Both asserted in the same test — a helper that always returns one
    // constant value fails at least one of these two expectations.
    expect(deriveHasProvenance(noSidecar)).toBe(false);
    expect(deriveHasProvenance(withSidecar)).toBe(true);

    // The absent row's own `prompt` field is untouched by the derivation:
    // specifically `undefined`, never the sentinel string, and never a
    // value derived from the adversarial filename.
    expect(noSidecar.prompt).toBeUndefined();
    expect(noSidecar.prompt).not.toBe("No provenance recorded");
    expect(noSidecar.prompt).not.toBe(noSidecar.filename);
  });
});

// ---------------------------------------------------------------------------
// 2. D-01 — thumbnailUrl resolves through one branch-neutral helper
// ---------------------------------------------------------------------------

describe("D-01: resolveThumbnailUrl is branch-neutral", () => {
  it("returns null when neither transport field is set", async () => {
    const getUrl = vi.fn(async () => "SHOULD_NOT_BE_CALLED");
    const result = await resolveThumbnailUrl({ storage: { getUrl } }, {});
    expect(result).toBeNull();
    expect(getUrl).not.toHaveBeenCalled();
  });

  it("returns a non-empty string when the live branch's field (thumbStorageId) is set", async () => {
    const getUrl = vi.fn(
      async () => "https://lmofficenew.tail5bb6b3.ts.net/api/storage/abc123"
    );
    const result = await resolveThumbnailUrl(
      { storage: { getUrl } },
      { thumbStorageId: "kg28fq286rbx69w8thcepdgf218cf78w" }
    );
    expect(result).toBe(
      "https://lmofficenew.tail5bb6b3.ts.net/api/storage/abc123"
    );
    expect(getUrl).toHaveBeenCalledWith("kg28fq286rbx69w8thcepdgf218cf78w");
  });

  it("control: does NOT build a URL when only the OTHER (dead) branch's field (thumbRelPath) is set", async () => {
    const getUrl = vi.fn(async () => "SHOULD_NOT_BE_CALLED");
    const result = await resolveThumbnailUrl(
      { storage: { getUrl } },
      { thumbRelPath: "gen/2026-08-14/abc123.webp" }
    );
    expect(result).toBeNull();
    expect(getUrl).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 3. D-08 — toggleStar / softDelete / restore mutation halves
// ---------------------------------------------------------------------------

function makeMockCtx(row: any) {
  const patch = vi.fn(async (_id: any, _patchArgs: Record<string, unknown>) => {});
  const get = vi.fn(async (_id: any) => row);
  return { ctx: { db: { get, patch } }, patch, get };
}

describe("D-08: toggleStar / softDelete / restore", () => {
  it("softDelete on a row with no deletedAt patches exactly { deletedAt: <number> }", async () => {
    const { ctx, patch } = makeMockCtx({ _id: "m1", deletedAt: undefined });
    const before = Date.now();
    const result = await softDeleteHandler(ctx as any, { id: "m1" });
    const after = Date.now();

    expect(patch).toHaveBeenCalledTimes(1);
    const [patchedId, patchArgs] = patch.mock.calls[0];
    expect(patchedId).toBe("m1");
    expect(Object.keys(patchArgs)).toEqual(["deletedAt"]);
    expect(patchArgs.deletedAt).toBeGreaterThanOrEqual(before);
    expect(patchArgs.deletedAt).toBeLessThanOrEqual(after);
    expect(result).toEqual({ ok: true, alreadyDeleted: false });
  });

  it("softDelete on an already-deleted row patches NOTHING (control — call count, not truthy return)", async () => {
    const { ctx, patch } = makeMockCtx({ _id: "m1", deletedAt: 1_700_000_000_000 });
    const result = await softDeleteHandler(ctx as any, { id: "m1" });

    expect(patch).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, alreadyDeleted: true });
  });

  it("restore clears deletedAt", async () => {
    const { ctx, patch } = makeMockCtx({ _id: "m1", deletedAt: 1_700_000_000_000 });
    const result = await restoreHandler(ctx as any, { id: "m1" });

    expect(patch).toHaveBeenCalledWith("m1", { deletedAt: undefined });
    expect(result).toEqual({ ok: true, alreadyRestored: false });
  });

  it("restore on a row that is not deleted patches NOTHING (control)", async () => {
    const { ctx, patch } = makeMockCtx({ _id: "m1", deletedAt: undefined });
    const result = await restoreHandler(ctx as any, { id: "m1" });

    expect(patch).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, alreadyRestored: true });
  });

  it("toggleStar flips starred: false -> true", async () => {
    const { ctx, patch } = makeMockCtx({ _id: "m1", starred: false });
    await toggleStarHandler(ctx as any, { id: "m1" });
    expect(patch).toHaveBeenCalledWith("m1", { starred: true });
  });

  it("toggleStar flips starred: true -> false (both directions — a one-direction test would pass against a function that always writes true)", async () => {
    const { ctx, patch } = makeMockCtx({ _id: "m1", starred: true });
    await toggleStarHandler(ctx as any, { id: "m1" });
    expect(patch).toHaveBeenCalledWith("m1", { starred: false });
  });

  it("all three refuse with ConvexError, not a bare Error, when the row does not exist", async () => {
    const { ctx: ctx1 } = makeMockCtx(null);
    const { ctx: ctx2 } = makeMockCtx(null);
    const { ctx: ctx3 } = makeMockCtx(null);
    await expect(toggleStarHandler(ctx1 as any, { id: "missing" })).rejects.toMatchObject(
      { data: { code: "NOT_FOUND" } }
    );
    await expect(softDeleteHandler(ctx2 as any, { id: "missing" })).rejects.toMatchObject(
      { data: { code: "NOT_FOUND" } }
    );
    await expect(restoreHandler(ctx3 as any, { id: "missing" })).rejects.toMatchObject(
      { data: { code: "NOT_FOUND" } }
    );
  });
});

// ---------------------------------------------------------------------------
// 4. Pitfall 4 — the public/internal split (source-level, no runtime)
// ---------------------------------------------------------------------------

describe("Pitfall 4: toggleStar/softDelete/restore stay on the public side of the split", () => {
  const mediaSource = readFileSync(
    resolve(process.cwd(), "convex/media.ts"),
    "utf-8"
  );

  it("harness liveness check: the source file was actually read and is non-trivial", () => {
    // Guard the guard — if this were empty or unreadable, every assertion
    // below would pass vacuously.
    expect(mediaSource.length).toBeGreaterThan(1000);
    expect(mediaSource).toContain("export const list = query(");
  });

  it("toggleStar, softDelete and restore are each declared with mutation(, not internalMutation(", () => {
    expect(mediaSource).toMatch(/export const toggleStar = mutation\(\{/);
    expect(mediaSource).toMatch(/export const softDelete = mutation\(\{/);
    expect(mediaSource).toMatch(/export const restore = mutation\(\{/);
    expect(mediaSource).not.toMatch(/export const toggleStar = internalMutation\(/);
    expect(mediaSource).not.toMatch(/export const softDelete = internalMutation\(/);
    expect(mediaSource).not.toMatch(/export const restore = internalMutation\(/);
  });

  // The assertion above is meaningful only once this file ALSO contains at
  // least one internalMutation( export — otherwise "toggleStar isn't
  // internal" is true of a file with no internal/public split concept at
  // all. Plan 118-05 (this plan) adds ingestMedia / generateThumbUploadUrl
  // as internalMutation(...) exports, which is what turns the assertion
  // above from vacuous into real.
  it("convex/media.ts contains at least one internalMutation( export, and ingestMedia specifically is internalMutation( — not mutation(", () => {
    expect(mediaSource).toMatch(/internalMutation\(/);
    expect(mediaSource).toMatch(/export const ingestMedia = internalMutation\(\{/);
    expect(mediaSource).not.toMatch(/export const ingestMedia = mutation\(\{/);
  });
});

// ---------------------------------------------------------------------------
// 5. Task 1 (plan 118-05) — ingestMediaHandler: D-05/D-06/D-07/D-02 behaviour
// ---------------------------------------------------------------------------

/** Minimal mock ctx.db supporting exactly the query shapes ingestMediaHandler
 * issues: a `by_contentHash` lookup, a `by_slug` lookup on mediaStyles, and
 * `insert`. `first()` returns whatever the test wired for that table. */
function makeIngestMockCtx(opts: {
  existingByHash?: any;
  styleRowBySlug?: Record<string, any>;
} = {}) {
  const insert = vi.fn(async (_table: string, _doc: any) => "new-media-id");
  const db = {
    query: (table: string) => ({
      withIndex: (indexName: string, cb: (q: any) => any) => {
        // Capture the eq() call's value via a tiny fake query builder.
        let captured: { field: string; value: any } | undefined;
        const q = {
          eq: (field: string, value: any) => {
            captured = { field, value };
            return q;
          },
        };
        cb(q);
        return {
          first: async () => {
            if (table === "media" && indexName === "by_contentHash") {
              return opts.existingByHash ?? null;
            }
            if (table === "mediaStyles" && indexName === "by_slug") {
              return opts.styleRowBySlug?.[captured?.value] ?? null;
            }
            return null;
          },
        };
      },
    }),
    insert,
  };
  return { ctx: { db } as any, insert };
}

describe("ingestMediaHandler — D-06 dedup is checked before anything else", () => {
  it("existing contentHash -> zero writes, created:false, existing mediaId returned", async () => {
    const { ctx, insert } = makeIngestMockCtx({ existingByHash: { _id: "existing-id" } });
    const result = await ingestMediaHandler(
      ctx,
      {
        contentHash: "abc123",
        filename: "x.webp",
        absPath: "C:\\media-vault\\gen\\x.webp",
        mediaType: "not-even-a-valid-type", // deliberately invalid — must never be checked
        kind: "also-invalid",
        sizeBytes: 1000,
      },
      Date.now()
    );
    expect(result).toEqual({ ok: true, mediaId: "existing-id", created: false });
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("ingestMediaHandler — enum validation", () => {
  it("invalid mediaType -> INVALID_ENUM naming mediaType, zero writes", async () => {
    const { ctx, insert } = makeIngestMockCtx();
    const result = await ingestMediaHandler(
      ctx,
      {
        contentHash: "h1",
        filename: "x.webp",
        absPath: "C:\\x.webp",
        mediaType: "hologram",
        kind: "gen",
        sizeBytes: 1000,
      },
      Date.now()
    );
    expect(result).toEqual({ ok: false, error: "INVALID_ENUM", field: "mediaType" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("invalid kind -> INVALID_ENUM naming kind, zero writes", async () => {
    const { ctx, insert } = makeIngestMockCtx();
    const result = await ingestMediaHandler(
      ctx,
      {
        contentHash: "h2",
        filename: "x.webp",
        absPath: "C:\\x.webp",
        mediaType: "image",
        kind: "bogus",
        sizeBytes: 1000,
      },
      Date.now()
    );
    expect(result).toEqual({ ok: false, error: "INVALID_ENUM", field: "kind" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("control: every declared MEDIA_TYPES/MEDIA_KINDS value is accepted (reaches insert)", async () => {
    for (const mediaType of MEDIA_TYPES) {
      for (const kind of MEDIA_KINDS) {
        const { ctx, insert } = makeIngestMockCtx();
        const result = await ingestMediaHandler(
          ctx,
          {
            contentHash: `h-${mediaType}-${kind}`,
            filename: "x.webp",
            absPath: "C:\\x.webp",
            mediaType,
            kind,
            sizeBytes: 1000,
          },
          Date.now()
        );
        expect(result.ok).toBe(true);
        expect(insert).toHaveBeenCalledTimes(1);
      }
    }
  });
});

describe("ingestMediaHandler — D-02 THUMB_TOO_LARGE server-side backstop", () => {
  it("thumbBytes over THUMB_MAX_BYTES -> THUMB_TOO_LARGE, zero writes", async () => {
    const { ctx, insert } = makeIngestMockCtx();
    const result = await ingestMediaHandler(
      ctx,
      {
        contentHash: "h3",
        filename: "x.webp",
        absPath: "C:\\x.webp",
        mediaType: "image",
        kind: "gen",
        sizeBytes: 1000,
        thumbBytes: THUMB_MAX_BYTES + 1,
      },
      Date.now()
    );
    expect(result).toEqual({ ok: false, error: "THUMB_TOO_LARGE" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("control: thumbBytes at exactly THUMB_MAX_BYTES is accepted (reaches insert)", async () => {
    const { ctx, insert } = makeIngestMockCtx();
    const result = await ingestMediaHandler(
      ctx,
      {
        contentHash: "h4",
        filename: "x.webp",
        absPath: "C:\\x.webp",
        mediaType: "image",
        kind: "gen",
        sizeBytes: 1000,
        thumbBytes: THUMB_MAX_BYTES,
      },
      Date.now()
    );
    expect(result.ok).toBe(true);
    expect(insert).toHaveBeenCalledTimes(1);
  });
});

describe("ingestMediaHandler — D-07 provenance absence, never inferred from filename", () => {
  it("no sidecar -> every provenance field omitted on the inserted row (adversarial filename)", async () => {
    const { ctx, insert } = makeIngestMockCtx();
    await ingestMediaHandler(
      ctx,
      {
        contentHash: "h5",
        filename: "a-sunset-over-jagged-mountains-golden-hour.webp",
        absPath: "C:\\x.webp",
        mediaType: "image",
        kind: "gen",
        sizeBytes: 1000,
      },
      Date.now()
    );
    expect(insert).toHaveBeenCalledTimes(1);
    const [, doc] = insert.mock.calls[0];
    expect(doc.prompt).toBeUndefined();
    expect(doc.model).toBeUndefined();
    expect(doc.provider).toBeUndefined();
    expect(doc.project).toBeUndefined();
    expect(doc.styleId).toBeUndefined();
    expect(doc.prompt).not.toBe(doc.filename);
  });

  it("sidecar present -> provenance fields copied verbatim (control)", async () => {
    const { ctx, insert } = makeIngestMockCtx();
    await ingestMediaHandler(
      ctx,
      {
        contentHash: "h6",
        filename: "media-a1b2c3.webp",
        absPath: "C:\\x.webp",
        mediaType: "image",
        kind: "gen",
        sizeBytes: 1000,
        sidecar: {
          prompt: "a sunset over jagged mountains, golden hour",
          model: "kling-3-omni",
          provider: "higgsfield",
          project: "seidr-demo",
          params: JSON.stringify({ seed: 42 }),
          tags: ["landscape", "golden-hour"],
        },
      },
      Date.now()
    );
    expect(insert).toHaveBeenCalledTimes(1);
    const [, doc] = insert.mock.calls[0];
    expect(doc.prompt).toBe("a sunset over jagged mountains, golden hour");
    expect(doc.model).toBe("kling-3-omni");
    expect(doc.provider).toBe("higgsfield");
    expect(doc.project).toBe("seidr-demo");
    expect(doc.tags).toEqual(["landscape", "golden-hour"]);
  });

  it("sidecar.style resolves to styleId via the mediaStyles by_slug lookup when the slug matches", async () => {
    const { ctx, insert } = makeIngestMockCtx({
      styleRowBySlug: { "cinematic-noir": { _id: "style-123" } },
    });
    await ingestMediaHandler(
      ctx,
      {
        contentHash: "h7",
        filename: "x.webp",
        absPath: "C:\\x.webp",
        mediaType: "image",
        kind: "gen",
        sizeBytes: 1000,
        sidecar: { style: "cinematic-noir" },
      },
      Date.now()
    );
    const [, doc] = insert.mock.calls[0];
    expect(doc.styleId).toBe("style-123");
  });

  it("sidecar.style with an unrecognised slug resolves to styleId absent, never a refusal (control: unknown slug still inserts)", async () => {
    const { ctx, insert } = makeIngestMockCtx({ styleRowBySlug: {} });
    const result = await ingestMediaHandler(
      ctx,
      {
        contentHash: "h8",
        filename: "x.webp",
        absPath: "C:\\x.webp",
        mediaType: "image",
        kind: "gen",
        sizeBytes: 1000,
        sidecar: { style: "does-not-exist" },
      },
      Date.now()
    );
    expect(result.ok).toBe(true);
    const [, doc] = insert.mock.calls[0];
    expect(doc.styleId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 6. D-08 janitor (plan 118-06) — pruneTrashBatchHandler
// ---------------------------------------------------------------------------

/**
 * A mock ctx.db that ACTUALLY APPLIES the `q.gte(...).lt(...)` bounds
 * `pruneTrashBatchHandler` passes into `withIndex`, filtering a supplied
 * "table" (`rows`) the same way the real by_deletedAt index would. This is
 * deliberately more faithful than a mock that just hands back a
 * pre-decided array: if it did, the mutation proof mandated by the plan
 * (shorten TRASH_GRACE_MS, confirm the grace-period test goes RED) could
 * never actually turn red — the mock would ignore the cutoff either way.
 * By threading the real bounds through a real filter, the grace-period
 * test is actually exercising the constant, not just asserting a fixture.
 */
function makeJanitorMockCtx(rows: any[], opts: { storageDeleteImpl?: (id: any) => Promise<void> } = {}) {
  const calls: string[] = [];
  let takeCalledWith: number | undefined;

  const storageDelete = vi.fn(async (id: any) => {
    calls.push(`storage.delete:${id}`);
    if (opts.storageDeleteImpl) await opts.storageDeleteImpl(id);
  });
  const dbDelete = vi.fn(async (id: any) => {
    calls.push(`db.delete:${id}`);
  });
  const runAfter = vi.fn(async (_delayMs: number, _fnRef: any, _args: any) => "scheduled-id");

  const db = {
    query: (_table: string) => ({
      withIndex: (_indexName: string, cb: (q: any) => any) => {
        const bounds: { gte?: number; lt?: number } = {};
        const q = {
          gte: (_field: string, value: number) => {
            bounds.gte = value;
            return q;
          },
          lt: (_field: string, value: number) => {
            bounds.lt = value;
            return q;
          },
        };
        cb(q);
        return {
          order: (_dir: string) => ({
            take: async (n: number) => {
              takeCalledWith = n;
              return rows
                .filter(
                  (r) =>
                    r.deletedAt !== undefined &&
                    (bounds.gte === undefined || r.deletedAt >= bounds.gte) &&
                    (bounds.lt === undefined || r.deletedAt < bounds.lt)
                )
                .sort((a, b) => a.deletedAt - b.deletedAt)
                .slice(0, n);
            },
          }),
        };
      },
    }),
    delete: dbDelete,
  };

  return {
    ctx: { db, storage: { delete: storageDelete }, scheduler: { runAfter } } as any,
    dbDelete,
    storageDelete,
    runAfter,
    calls,
    getTakeCalledWith: () => takeCalledWith,
  };
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // hardcoded independently of TRASH_GRACE_MS,
// so this test suite is a real check on the grace period value rather than
// a restatement of whatever the constant currently says.
const ONE_DAY_MS_TEST = 24 * 60 * 60 * 1000;

describe("D-08 janitor: pruneTrashBatchHandler — blob-before-row ordering", () => {
  it("deletes the thumbnail blob BEFORE the row (control pair: relative call order, not merely that both happened)", async () => {
    const nowMs = 1_800_000_000_000;
    const { ctx, calls } = makeJanitorMockCtx([
      { _id: "m1", deletedAt: nowMs - THIRTY_DAYS_MS - ONE_DAY_MS_TEST, thumbStorageId: "s1" },
    ]);
    await pruneTrashBatchHandler(ctx, {}, nowMs);

    // Asserting only that both were called would pass against the reversed,
    // wrong order — the relative-index assertion is the point.
    const storageIdx = calls.indexOf("storage.delete:s1");
    const dbIdx = calls.indexOf("db.delete:m1");
    expect(storageIdx).toBeGreaterThanOrEqual(0);
    expect(dbIdx).toBeGreaterThanOrEqual(0);
    expect(storageIdx).toBeLessThan(dbIdx);
  });
});

describe("D-08 janitor: pruneTrashBatchHandler — 30-day grace period", () => {
  it("an old row (31 days) is deleted; a recent row (5 days) survives in the SAME run (control pair)", async () => {
    // "new" is deliberately 5 days old, not 1 — it must survive the REAL
    // 30-day grace (5 << 30) while still being old enough that a wrongly
    // SHORTENED grace (e.g. 1 day, the Task 2 mutation proof) would sweep
    // it. A "new" row at exactly 1 day would sit on the boundary of a
    // 1-day-grace mutation (deletedAt === cutoffMs, excluded by `.lt`
    // either way) and could not discriminate a shortened-grace bug from a
    // correct one — this value is chosen so the mutation proof actually
    // flips this assertion, not just the "old" row's.
    const nowMs = 1_800_000_000_000;
    const { ctx, dbDelete } = makeJanitorMockCtx([
      { _id: "old", deletedAt: nowMs - 31 * ONE_DAY_MS_TEST, thumbStorageId: undefined },
      { _id: "new", deletedAt: nowMs - 5 * ONE_DAY_MS_TEST, thumbStorageId: undefined },
    ]);
    const result = await pruneTrashBatchHandler(ctx, {}, nowMs);

    expect(result.deletedCount).toBe(1);
    expect(dbDelete).toHaveBeenCalledTimes(1);
    expect(dbDelete).toHaveBeenCalledWith("old");
    // A test with only the old row would pass against a janitor that
    // deletes everything — assert the survivor's id NEVER appears.
    const deletedIds = dbDelete.mock.calls.map((c) => c[0]);
    expect(deletedIds).not.toContain("new");
  });
});

describe("D-08 janitor: soft-delete never touches the blob (Restore stays whole)", () => {
  it("softDeleteHandler never calls storage.delete", async () => {
    const storageDelete = vi.fn(async (_id: any) => {});
    const patch = vi.fn(async (_id: any, _args: any) => {});
    const get = vi.fn(async (_id: any) => ({ _id: "m1", deletedAt: undefined }));
    const ctx = { db: { get, patch }, storage: { delete: storageDelete } } as any;

    await softDeleteHandler(ctx, { id: "m1" });

    expect(patch).toHaveBeenCalledTimes(1);
    expect(storageDelete).not.toHaveBeenCalled();
  });
});

describe("D-08 janitor: pruneTrashBatchHandler — batch bound and reschedule", () => {
  it("a FULL batch reads .take(TRASH_PRUNE_BATCH_SIZE) and reschedules with a strictly-advanced cursor", async () => {
    const nowMs = 1_800_000_000_000;
    const oldBase = nowMs - 31 * ONE_DAY_MS_TEST;
    const rows = Array.from({ length: TRASH_PRUNE_BATCH_SIZE }, (_, i) => ({
      _id: `m${i}`,
      deletedAt: oldBase + i, // strictly increasing, all well past the 30-day cutoff
      thumbStorageId: undefined,
    }));
    const { ctx, runAfter, getTakeCalledWith } = makeJanitorMockCtx(rows);

    const result = await pruneTrashBatchHandler(ctx, { cursorMs: 0, batchesDone: 0 }, nowMs);

    expect(getTakeCalledWith()).toBe(TRASH_PRUNE_BATCH_SIZE);
    expect(result.rescheduled).toBe(true);
    expect(runAfter).toHaveBeenCalledTimes(1);
    const [, , scheduledArgs] = runAfter.mock.calls[0];
    expect(scheduledArgs.cursorMs).toBeGreaterThan(0);
    expect(scheduledArgs.batchesDone).toBe(1);
  });

  it("control: a SHORT batch does NOT reschedule", async () => {
    const nowMs = 1_800_000_000_000;
    const { ctx, runAfter } = makeJanitorMockCtx([
      { _id: "only-one", deletedAt: nowMs - 31 * ONE_DAY_MS_TEST, thumbStorageId: undefined },
    ]);

    const result = await pruneTrashBatchHandler(ctx, {}, nowMs);

    expect(result.rescheduled).toBe(false);
    expect(runAfter).not.toHaveBeenCalled();
  });
});

describe("D-08 janitor: pruneTrashBatchHandler — per-chain batch ceiling (T-118-19)", () => {
  it("batchesDone already AT the ceiling: zero work, no reschedule", async () => {
    const nowMs = 1_800_000_000_000;
    const rows = Array.from({ length: TRASH_PRUNE_BATCH_SIZE }, (_, i) => ({
      _id: `m${i}`,
      deletedAt: nowMs - 31 * ONE_DAY_MS_TEST + i,
      thumbStorageId: undefined,
    }));
    const { ctx, runAfter, dbDelete } = makeJanitorMockCtx(rows);

    const result = await pruneTrashBatchHandler(
      ctx,
      { cursorMs: 0, batchesDone: TRASH_PRUNE_MAX_BATCHES },
      nowMs
    );

    expect(result.rescheduled).toBe(false);
    expect(runAfter).not.toHaveBeenCalled();
    expect(dbDelete).not.toHaveBeenCalled();
    expect(result.deletedCount).toBe(0);
  });

  it("a FULL batch that reaches the ceiling on THIS invocation still deletes rows but does not reschedule further", async () => {
    const nowMs = 1_800_000_000_000;
    const rows = Array.from({ length: TRASH_PRUNE_BATCH_SIZE }, (_, i) => ({
      _id: `m${i}`,
      deletedAt: nowMs - 31 * ONE_DAY_MS_TEST + i,
      thumbStorageId: undefined,
    }));
    const { ctx, runAfter, dbDelete } = makeJanitorMockCtx(rows);

    const result = await pruneTrashBatchHandler(
      ctx,
      { cursorMs: 0, batchesDone: TRASH_PRUNE_MAX_BATCHES - 1 },
      nowMs
    );

    // The work for this batch still happens — an unbounded self-reschedule
    // is the DoS risk, not doing the batch that's already in flight.
    expect(dbDelete).toHaveBeenCalledTimes(TRASH_PRUNE_BATCH_SIZE);
    expect(result.rescheduled).toBe(false);
    expect(runAfter).not.toHaveBeenCalled();
  });
});

describe("D-08 janitor: pruneTrashBatchHandler — resilience to a missing blob (T-118-21)", () => {
  it("storage.delete throwing for one row does not stop the row's own delete or the rest of the batch", async () => {
    const nowMs = 1_800_000_000_000;
    const rows = [
      { _id: "bad", deletedAt: nowMs - 31 * ONE_DAY_MS_TEST, thumbStorageId: "bad-blob" },
      { _id: "good", deletedAt: nowMs - 30 * ONE_DAY_MS_TEST - 1, thumbStorageId: "good-blob" },
    ];
    const { ctx, dbDelete } = makeJanitorMockCtx(rows, {
      storageDeleteImpl: async (id: any) => {
        if (id === "bad-blob") throw new Error("blob already gone");
      },
    });

    const result = await pruneTrashBatchHandler(ctx, {}, nowMs);

    expect(result.deletedCount).toBe(2);
    const deletedIds = dbDelete.mock.calls.map((c) => c[0]);
    expect(deletedIds).toContain("bad");
    expect(deletedIds).toContain("good");
  });
});

describe("D-08 janitor: source-level — never .collect(), always bounded by .take( (control pair)", () => {
  const mediaSource = readFileSync(resolve(process.cwd(), "convex/media.ts"), "utf-8");

  it("zero .collect() occurrences, paired with a .take( control that IS found (a zero from a broken pattern would be indistinguishable from a real zero without this)", () => {
    expect(mediaSource.match(/\.collect\(\)/g)).toBeNull();
    expect(mediaSource.match(/\.take\(/g)?.length ?? 0).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 7. D-08 host-side reconciliation support (plan 118-08) — getMediaHashIndexHandler
// ---------------------------------------------------------------------------

/**
 * Threads real `q.eq(field, value)` / `q.gt(field, value)` predicates
 * through a fake query builder over a supplied `rows` array, same
 * discipline as `makeJanitorMockCtx` above (a mock that just hands back a
 * fixed array could never distinguish the active-side read from the
 * trashed-side read, which is exactly the property the truncation test
 * below needs to exercise).
 */
function makeHashIndexMockCtx(rows: any[]) {
  const takeCalls: number[] = [];
  const db = {
    query: (_table: string) => ({
      withIndex: (_indexName: string, cb: (q: any) => any) => {
        const predicate: { kind?: "eq" | "gt"; value?: any } = {};
        const q = {
          eq: (_field: string, value: any) => {
            predicate.kind = "eq";
            predicate.value = value;
            return q;
          },
          gt: (_field: string, value: any) => {
            predicate.kind = "gt";
            predicate.value = value;
            return q;
          },
        };
        cb(q);
        return {
          take: async (n: number) => {
            takeCalls.push(n);
            if (predicate.kind === "eq") {
              // eq("deletedAt", undefined) -> active rows only.
              return rows.filter((r) => r.deletedAt === undefined).slice(0, n);
            }
            // gt("deletedAt", undefined) -> trashed rows only.
            return rows.filter((r) => r.deletedAt !== undefined).slice(0, n);
          },
        };
      },
    }),
  };
  return { ctx: { db } as any, takeCalls };
}

describe("D-08 host-side reconciliation (118-08): getMediaHashIndexHandler", () => {
  it("returns ONLY contentHash/deletedAt/kind per row, covering both active and trashed rows", async () => {
    const { ctx } = makeHashIndexMockCtx([
      {
        _id: "m1",
        contentHash: "hash-active",
        deletedAt: undefined,
        kind: "gen",
        filename: "should-not-leak.png",
        prompt: "should not leak either",
      },
      { _id: "m2", contentHash: "hash-trashed", deletedAt: 12345, kind: "ref" },
    ]);

    const result = await getMediaHashIndexHandler(ctx);

    expect(result.truncated).toBe(false);
    expect(result.rows).toHaveLength(2);
    const byHash = Object.fromEntries(result.rows.map((r: any) => [r.contentHash, r]));
    expect(byHash["hash-active"]).toEqual({
      contentHash: "hash-active",
      deletedAt: undefined,
      kind: "gen",
    });
    expect(byHash["hash-trashed"]).toEqual({
      contentHash: "hash-trashed",
      deletedAt: 12345,
      kind: "ref",
    });
    // No row's full shape (filename, prompt, ...) survives the projection —
    // a leak here would widen the bearer-gated route's exposure well
    // beyond the three fields the watcher actually needs.
    for (const row of result.rows) {
      expect(Object.keys(row).sort()).toEqual(["contentHash", "deletedAt", "kind"]);
    }
  });

  it("truncated is false under the cap (control), true when the active side hits MEDIA_HASH_INDEX_CAP exactly", async () => {
    const underCap = Array.from({ length: 3 }, (_, i) => ({
      _id: `active-${i}`,
      contentHash: `hash-${i}`,
      deletedAt: undefined,
      kind: "gen",
    }));
    const { ctx: underCapCtx } = makeHashIndexMockCtx(underCap);
    const underCapResult = await getMediaHashIndexHandler(underCapCtx);
    expect(underCapResult.truncated).toBe(false);

    const atCap = Array.from({ length: MEDIA_HASH_INDEX_CAP }, (_, i) => ({
      _id: `active-${i}`,
      contentHash: `hash-${i}`,
      deletedAt: undefined,
      kind: "gen",
    }));
    const { ctx: atCapCtx } = makeHashIndexMockCtx(atCap);
    const atCapResult = await getMediaHashIndexHandler(atCapCtx);
    // A caller (hooks/studioWatch.mjs's reconcileTrash) MUST treat this the
    // same as a failed read — a truncated active-row list could make a
    // real, still-live file look like an orphan.
    expect(atCapResult.truncated).toBe(true);
  });
});
