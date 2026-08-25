/**
 * Palette ordering + bounding for Bifröst links.
 *
 * Two rules here are the ones that will actually bite:
 *
 *  - An absent `usageCount` must coerce to 0, NOT to the POSITIVE_INFINITY
 *    sentinel `compareLinks` uses for an absent `order`. The fields look alike
 *    and sort by opposite rules; getting it wrong ranks every never-opened
 *    link above the ones in daily use, which is exactly backwards.
 *  - The cap must NOT apply while the operator is typing. Capping
 *    unconditionally makes every link outside the top 20 unsearchable — a
 *    worse failure than the unbounded list it replaced, and a silent one.
 */
import { describe, test, expect } from "vitest";
import {
  comparePaletteLinks,
  paletteLinks,
  PALETTE_LINK_CAP,
  type RankableLink,
} from "./bifrostPaletteRank";

type L = RankableLink & { title: string };

const order = (links: L[]) =>
  [...links].sort(comparePaletteLinks).map((l) => l.title);

describe("comparePaletteLinks", () => {
  test("most-opened first", () => {
    const links: L[] = [
      { title: "rare", usageCount: 1, createdAt: 1 },
      { title: "hot", usageCount: 90, createdAt: 1 },
      { title: "warm", usageCount: 12, createdAt: 1 },
    ];
    expect(order(links)).toEqual(["hot", "warm", "rare"]);
  });

  test("a pinned link outranks a more-opened unpinned one", () => {
    const links: L[] = [
      { title: "hot", usageCount: 500, createdAt: 1 },
      { title: "pinned", pinned: true, usageCount: 0, createdAt: 1 },
    ];
    expect(order(links)).toEqual(["pinned", "hot"]);
  });

  test("an absent usageCount sorts as 0 — never ahead of a real count", () => {
    const links: L[] = [
      { title: "never-opened", createdAt: 999 },
      { title: "opened-once", usageCount: 1, createdAt: 1 },
    ];
    expect(order(links)).toEqual(["opened-once", "never-opened"]);
  });

  test("absent and explicit-zero usage are indistinguishable", () => {
    const links: L[] = [
      { title: "absent", createdAt: 100 },
      { title: "explicit-zero", usageCount: 0, createdAt: 200 },
    ];
    // Same count, so the createdAt tiebreak decides — proving neither value
    // got a sentinel that would have jumped it past the other.
    expect(order(links)).toEqual(["explicit-zero", "absent"]);
  });

  test("equal counts break on most-recently-opened", () => {
    const links: L[] = [
      { title: "stale", usageCount: 3, lastUsedAt: 100, createdAt: 1 },
      { title: "fresh", usageCount: 3, lastUsedAt: 900, createdAt: 1 },
    ];
    expect(order(links)).toEqual(["fresh", "stale"]);
  });

  test("a never-opened link falls back to newest, not to random order", () => {
    const links: L[] = [
      { title: "older", createdAt: 100 },
      { title: "newer", createdAt: 200 },
    ];
    expect(order(links)).toEqual(["newer", "older"]);
  });

  test("lastUsedAt cannot rescue a lower usage count", () => {
    const links: L[] = [
      { title: "just-opened-once", usageCount: 1, lastUsedAt: 9999, createdAt: 1 },
      { title: "opened-often", usageCount: 50, lastUsedAt: 1, createdAt: 1 },
    ];
    expect(order(links)).toEqual(["opened-often", "just-opened-once"]);
  });
});

describe("paletteLinks — the cap is conditional on the search state", () => {
  const many: L[] = Array.from({ length: 60 }, (_, i) => ({
    title: `link-${i}`,
    usageCount: 60 - i, // link-0 is hottest, link-59 coldest
    createdAt: 1,
  }));

  test("empty query caps at PALETTE_LINK_CAP", () => {
    expect(paletteLinks(many, false)).toHaveLength(PALETTE_LINK_CAP);
  });

  test("empty query keeps the MOST-used, not an arbitrary 20", () => {
    const titles = paletteLinks(many, false).map((l) => l.title);
    expect(titles[0]).toBe("link-0");
    expect(titles).toContain("link-19");
    expect(titles).not.toContain("link-20");
  });

  test("a query lifts the cap so every link stays searchable", () => {
    expect(paletteLinks(many, true)).toHaveLength(60);
  });

  test("the long tail is reachable ONLY because the query lifts the cap", () => {
    // The control: this link is deliberately outside the top 20, so its
    // presence-when-typing and absence-when-idle are what prove the branch
    // does something. Without this pair the test would pass on a function
    // that ignored `hasQuery` entirely.
    const coldest = "link-59";
    expect(paletteLinks(many, false).map((l) => l.title)).not.toContain(coldest);
    expect(paletteLinks(many, true).map((l) => l.title)).toContain(coldest);
  });

  test("ranking is applied even when the cap is lifted", () => {
    expect(paletteLinks(many, true)[0].title).toBe("link-0");
  });

  test("does not mutate the input array", () => {
    const input: L[] = [
      { title: "cold", usageCount: 1, createdAt: 1 },
      { title: "hot", usageCount: 99, createdAt: 1 },
    ];
    paletteLinks(input, false);
    expect(input.map((l) => l.title)).toEqual(["cold", "hot"]);
  });

  test("a set smaller than the cap is returned whole", () => {
    const few = many.slice(0, 3);
    expect(paletteLinks(few, false)).toHaveLength(3);
  });
});
