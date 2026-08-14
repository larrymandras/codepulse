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
  MEDIA_TYPES,
  MEDIA_KINDS,
  THUMB_MAX_BYTES,
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
