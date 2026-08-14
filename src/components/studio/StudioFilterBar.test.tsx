/**
 * StudioFilterBar — the filter/search pipeline `Studio.tsx`'s Gallery tab
 * renders from (Phase 118, plan 118-10 Task 3).
 *
 * Assertions land on `applyStudioFilters`'s actual output, matching this
 * repo's own precedent (`Galdr.test.tsx`'s comment: "the ordering override
 * only matters if it survives into the DOM" — here it's the filter pipeline
 * that must survive, not just look right in isolation). Every check below
 * is paired with a control per the plan's mutation-test rule.
 */
import { describe, test, expect } from "vitest";
import {
  applyStudioFilters,
  matchesStudioSearch,
  DEFAULT_STUDIO_FILTERS,
  type StudioFilterState,
} from "./StudioFilterBar";
import type { MediaRow } from "./MediaCard";

function makeRow(overrides: Partial<MediaRow> = {}): MediaRow {
  return {
    _id: "m1",
    filename: "sunset.webp",
    absPath: "C:\\media-vault\\gen\\sunset.webp",
    mediaType: "image",
    kind: "gen",
    hasProvenance: true,
    thumbnailUrl: "https://example.test/thumb.webp",
    createdAt: 1000,
    ...overrides,
  };
}

const OLDER_STARRED = makeRow({
  _id: "old-starred",
  filename: "older.webp",
  starred: true,
  createdAt: 1_000,
  mediaType: "image",
});
const NEWER_UNSTARRED = makeRow({
  _id: "new-unstarred",
  filename: "newer.webp",
  starred: false,
  createdAt: 9_000,
  mediaType: "image",
});
const VIDEO_ROW = makeRow({
  _id: "video-row",
  filename: "clip.mp4",
  mediaType: "video",
  createdAt: 5_000,
});
const NO_PROVENANCE_ROW = makeRow({
  _id: "no-prov",
  filename: "mystery.webp",
  hasProvenance: false,
  createdAt: 3_000,
});

describe("applyStudioFilters — default sort is createdAt desc, no favorites-float-up", () => {
  test("newest first, regardless of starred status", () => {
    const rows = [OLDER_STARRED, NEWER_UNSTARRED];
    const visible = applyStudioFilters(rows, DEFAULT_STUDIO_FILTERS, "");
    // A favorites-first comparator (Galdr's own default) would put the
    // OLDER starred row ahead of the newer unstarred one. It must not here.
    expect(visible.map((r) => r._id)).toEqual(["new-unstarred", "old-starred"]);
  });
});

describe("applyStudioFilters — chip filtering", () => {
  test("CONTROL: the 'all' chip returns every row", () => {
    const rows = [OLDER_STARRED, NEWER_UNSTARRED, VIDEO_ROW, NO_PROVENANCE_ROW];
    const visible = applyStudioFilters(rows, { ...DEFAULT_STUDIO_FILTERS, chip: "all" }, "");
    expect(visible).toHaveLength(4);
  });

  test("the 'video' chip excludes image rows", () => {
    const rows = [OLDER_STARRED, VIDEO_ROW];
    const visible = applyStudioFilters(rows, { ...DEFAULT_STUDIO_FILTERS, chip: "video" }, "");
    expect(visible.map((r) => r._id)).toEqual(["video-row"]);
  });

  test("the 'starred' chip excludes unstarred rows", () => {
    const rows = [OLDER_STARRED, NEWER_UNSTARRED];
    const visible = applyStudioFilters(rows, { ...DEFAULT_STUDIO_FILTERS, chip: "starred" }, "");
    expect(visible.map((r) => r._id)).toEqual(["old-starred"]);
  });

  test("the 'missing-provenance' chip isolates provenance-absent rows", () => {
    const rows = [OLDER_STARRED, NO_PROVENANCE_ROW];
    const visible = applyStudioFilters(
      rows,
      { ...DEFAULT_STUDIO_FILTERS, chip: "missing-provenance" },
      ""
    );
    expect(visible.map((r) => r._id)).toEqual(["no-prov"]);
  });
});

describe("applyStudioFilters — Select filters (kind/model/project)", () => {
  const GEN_ROW = makeRow({ _id: "gen", kind: "gen", model: "kling-3", project: "alpha" });
  const REF_ROW = makeRow({ _id: "ref", kind: "ref", model: "midjourney", project: "beta" });

  test("CONTROL: kind='any' returns both rows", () => {
    const visible = applyStudioFilters([GEN_ROW, REF_ROW], DEFAULT_STUDIO_FILTERS, "");
    expect(visible).toHaveLength(2);
  });

  test("kind filters to the exact enum value", () => {
    const filters: StudioFilterState = { ...DEFAULT_STUDIO_FILTERS, kind: "ref" };
    const visible = applyStudioFilters([GEN_ROW, REF_ROW], filters, "");
    expect(visible.map((r) => r._id)).toEqual(["ref"]);
  });

  test("model filters to the exact model value", () => {
    const filters: StudioFilterState = { ...DEFAULT_STUDIO_FILTERS, model: "midjourney" };
    const visible = applyStudioFilters([GEN_ROW, REF_ROW], filters, "");
    expect(visible.map((r) => r._id)).toEqual(["ref"]);
  });

  test("project filters to the exact project value", () => {
    const filters: StudioFilterState = { ...DEFAULT_STUDIO_FILTERS, project: "alpha" };
    const visible = applyStudioFilters([GEN_ROW, REF_ROW], filters, "");
    expect(visible.map((r) => r._id)).toEqual(["gen"]);
  });
});

describe("matchesStudioSearch", () => {
  test("CONTROL: an empty needle matches every row", () => {
    expect(matchesStudioSearch(makeRow(), "")).toBe(true);
  });

  test("matches on filename", () => {
    expect(matchesStudioSearch(makeRow({ filename: "hero-shot.webp" }), "hero")).toBe(true);
  });

  test("matches on prompt", () => {
    expect(matchesStudioSearch(makeRow({ prompt: "a dragon over the city" }), "dragon")).toBe(true);
  });

  test("matches on model", () => {
    expect(matchesStudioSearch(makeRow({ model: "kling-3-omni" }), "kling")).toBe(true);
  });

  test("matches on project", () => {
    expect(matchesStudioSearch(makeRow({ project: "ProtectAll" }), "protectall")).toBe(true);
  });

  test("a needle matching nothing returns false", () => {
    expect(matchesStudioSearch(makeRow(), "zzz-no-such-thing")).toBe(false);
  });
});
