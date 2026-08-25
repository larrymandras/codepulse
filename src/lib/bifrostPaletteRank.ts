/**
 * bifrostPaletteRank.ts — how Bifröst links are ordered and bounded INSIDE the
 * command palette.
 *
 * This is deliberately a SECOND ordering, not a replacement for
 * `compareLinks` in `convex/bifrost.ts`. The two surfaces want different
 * things and unifying them would break one of them:
 *
 *   /bifrost page  → a CATALOG. Ordered by hand (pinned, then explicit
 *                    `order`, then newest) so the operator can arrange it.
 *   Ctrl+K palette → a LAUNCHER. Ordered by what actually gets opened, so the
 *                    handful of links in daily use surface without curation.
 *
 * A future editor who "notices the duplication" and routes both through one
 * comparator will silently make the palette an unranked dump again. Don't.
 *
 * THE TRAP, stated plainly because the two fields look alike and sort by
 * OPPOSITE rules: in `compareLinks`, an absent `order` coerces to
 * POSITIVE_INFINITY so a never-ordered link sorts after every explicit one.
 * Here, an absent `usageCount` coerces to 0. Both land the row last — but via
 * opposite numeric sentinels, because one list ascends and the other descends.
 * Coercing absent usage to Infinity here would rank every never-opened link
 * ABOVE the ones you use every day.
 */

/** The subset of a link row the palette ordering actually reads. */
export interface RankableLink {
  pinned?: boolean;
  usageCount?: number;
  lastUsedAt?: number;
  createdAt: number;
}

/**
 * Matches the slice every other palette group already applies
 * (`useCommandPaletteSearch.ts` caps agents, sessions, alerts and crons at 20).
 * Links were the one unbounded group; this brings them into line.
 */
export const PALETTE_LINK_CAP = 20;

/**
 * Pinned → most-opened → most-recently-opened → newest.
 *
 * Pinned outranks usage on purpose: an explicit pin is a direct statement of
 * intent, and a launcher that could bury a pinned link under a frequently-hit
 * one would make pinning meaningless.
 *
 * `lastUsedAt` breaks ties among equal counts so a freshly-opened link beats a
 * stale one at the same count — which is what makes the ordering feel alive on
 * day one, when most rows are still at 0 or 1.
 */
export function comparePaletteLinks(a: RankableLink, b: RankableLink): number {
  if (Boolean(b.pinned) !== Boolean(a.pinned)) {
    return Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
  }
  const au = a.usageCount ?? 0;
  const bu = b.usageCount ?? 0;
  if (au !== bu) return bu - au;

  const al = a.lastUsedAt ?? 0;
  const bl = b.lastUsedAt ?? 0;
  if (al !== bl) return bl - al;

  return b.createdAt - a.createdAt;
}

/**
 * The palette's link list for a given search state.
 *
 * `hasQuery` is load-bearing and is the whole reason a cap is SAFE here. cmdk
 * filters the items that are RENDERED, so capping unconditionally would make
 * every link outside the top 20 permanently unsearchable — trading the
 * "unbounded dump" problem for a strictly worse one where links silently
 * cannot be found.
 *
 *   empty query → the cap applies. This is the resting state of the palette,
 *                 and an operator staring at 200 unfiltered rows is the
 *                 problem being solved.
 *   typing      → NO cap. Every link is rendered so cmdk can match against it;
 *                 the query is already doing the narrowing.
 */
export function paletteLinks<T extends RankableLink>(
  links: readonly T[],
  hasQuery: boolean,
  cap: number = PALETTE_LINK_CAP
): T[] {
  const ranked = [...links].sort(comparePaletteLinks);
  return hasQuery ? ranked : ranked.slice(0, cap);
}
