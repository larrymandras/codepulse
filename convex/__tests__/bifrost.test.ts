/**
 * bifrost.ts — link ordering (Phase 117).
 *
 * `compareLinks` is the only real logic in the module; everything else is a
 * db call. Its subtle rule is that an ABSENT `order` must sort after every
 * explicit one. Coercing `undefined` to 0 — the obvious-looking
 * `a.order ?? 0` — would make a never-ordered link leap to the front of its
 * category, which reads as a reordering bug rather than a default.
 */
import { describe, test, expect } from "vitest";
import { compareLinks } from "../bifrost";

type L = { title: string; pinned?: boolean; order?: number; createdAt: number };

const sortTitles = (links: L[]) =>
  [...links].sort(compareLinks).map((l) => l.title);

describe("compareLinks", () => {
  test("pinned links come first regardless of order or age", () => {
    const links: L[] = [
      { title: "plain", order: 0, createdAt: 100 },
      { title: "pinned", pinned: true, order: 99, createdAt: 1 },
    ];
    expect(sortTitles(links)).toEqual(["pinned", "plain"]);
  });

  test("explicit order ascending within the same pinned state", () => {
    const links: L[] = [
      { title: "third", order: 3, createdAt: 1 },
      { title: "first", order: 1, createdAt: 1 },
      { title: "second", order: 2, createdAt: 1 },
    ];
    expect(sortTitles(links)).toEqual(["first", "second", "third"]);
  });

  test("an absent order sorts AFTER every explicit one, never as 0", () => {
    const links: L[] = [
      { title: "unordered", createdAt: 500 },
      { title: "ordered-5", order: 5, createdAt: 1 },
      { title: "ordered-0", order: 0, createdAt: 1 },
    ];
    expect(sortTitles(links)).toEqual(["ordered-0", "ordered-5", "unordered"]);
  });

  test("ties break on newest createdAt", () => {
    const links: L[] = [
      { title: "older", order: 1, createdAt: 100 },
      { title: "newer", order: 1, createdAt: 200 },
    ];
    expect(sortTitles(links)).toEqual(["newer", "older"]);
  });

  test("two unordered links still tie-break on newest, not arbitrarily", () => {
    const links: L[] = [
      { title: "older", createdAt: 100 },
      { title: "newer", createdAt: 200 },
    ];
    expect(sortTitles(links)).toEqual(["newer", "older"]);
  });

  test("pinned + unordered still beats unpinned + ordered", () => {
    const links: L[] = [
      { title: "unpinned-first", order: 0, createdAt: 999 },
      { title: "pinned-unordered", pinned: true, createdAt: 1 },
    ];
    expect(sortTitles(links)).toEqual(["pinned-unordered", "unpinned-first"]);
  });
});
