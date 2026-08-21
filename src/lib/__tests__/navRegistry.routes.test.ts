/**
 * Criterion-3 guard for Phase 124 (SHELL-02): "a route-list diff taken before
 * and after the sidebar regroup must be identical."
 *
 * GOLDEN_ROUTE_SET is a committed LITERAL array of the 44 `to` values in
 * `navGroups`, captured live from `src/lib/navRegistry.ts` on 2026-08-21 —
 * before plan 124-04 rewrites `navGroups` to move items between domains. It
 * is a plain literal, deliberately NOT read from version control at runtime
 * (no git-object lookup, no relative ref like `HEAD~1` or `main`), because
 * such refs rot in a shared checkout (this repo has been bitten by exactly
 * that: an anchor commit can be amended or squashed, silently voiding a
 * SHA-anchored fixture — see the 2026-08-18 revision-drift lesson). A plain
 * array survives every future commit on this branch unchanged.
 *
 * This test compares the ROUTE SET only, never the group structure — SHELL-02
 * is precisely a change to which `NavGroupConfig` each item sits in, so
 * asserting on group membership would fail by design on every regroup. The
 * `to` values themselves must never change: no URL may move.
 */
import { describe, it, expect } from 'vitest';
import { navGroups, navItems, type NavGroupConfig } from '../navRegistry';

// Captured live via `npx vitest run` against the pre-regroup registry,
// 2026-08-21. Sorted lexicographically. 44 entries — see SUMMARY for the
// verbatim derivation output this was copied from.
const GOLDEN_ROUTE_SET: readonly string[] = [
  '/',
  '/alerts',
  '/analytics',
  '/automation',
  '/bifrost',
  '/briefings',
  '/build',
  '/capabilities',
  '/channels/whatsapp',
  '/chat',
  '/config',
  '/doc-comments',
  '/dreaming',
  '/executions',
  '/forge',
  '/galdr',
  '/graphs',
  '/hive',
  '/hr/analytics',
  '/hr/catalog',
  '/hr/onboarding',
  '/hr/roster',
  '/hr/teams',
  '/ideation',
  '/inbox',
  '/infrastructure',
  '/insights',
  '/knowledge-graph',
  '/live-run',
  '/loom',
  '/mcp-inventory',
  '/meeting-bot',
  '/memory',
  '/quality',
  '/reminders',
  '/security',
  '/self-healing',
  '/skills',
  '/studio',
  '/tasks',
  '/tool-galaxy',
  '/tools',
  '/war-room',
  '/workspace-map',
];

function sortedTo(items: { to: string }[]): string[] {
  return items.map((i) => i.to).slice().sort();
}

function flattenGroups(groups: NavGroupConfig[]): { to: string }[] {
  return groups.flatMap((g) => g.items);
}

describe('navRegistry route set (SHELL-02 Criterion 3 guard)', () => {
  it('navItems (flattened, deduped) matches the golden route set', () => {
    expect(sortedTo(navItems)).toEqual(GOLDEN_ROUTE_SET);
  });

  it('navGroups flattened directly (before dedup) matches the golden route set', () => {
    // Guards against an item duplicated across two domains during the
    // regroup — `navItems`' own dedup-by-`to` would otherwise absorb that
    // silently and this test alone would still pass.
    expect(sortedTo(flattenGroups(navGroups))).toEqual(GOLDEN_ROUTE_SET);
  });

  it('the golden fixture itself holds no duplicate routes', () => {
    // Self-check on the fixture: a bad capture (e.g. copy-paste duplication)
    // must not be able to make the two assertions above vacuously pass.
    expect(new Set(GOLDEN_ROUTE_SET).size).toBe(GOLDEN_ROUTE_SET.length);
  });

  it('a label-only rename does not move the route set (negative control)', () => {
    // This is what D-05's Analytics/Agent Analytics rename and the D-01
    // regroup itself must be permitted to do: change `label` and `group`
    // freely, as long as no `to` value changes.
    const mutated: NavGroupConfig[] = navGroups.map((g) => ({
      group: g.group,
      items: g.items.map((item) => ({ ...item })),
    }));
    // Alter one item's label...
    mutated[0].items[0] = { ...mutated[0].items[0], label: 'Renamed Label Only' };
    // ...and a different item's group (simulating the regroup moving it
    // between domains) without touching its `to`.
    const lastGroup = mutated[mutated.length - 1];
    lastGroup.items[0] = { ...lastGroup.items[0], group: 'SOME_OTHER_DOMAIN' };

    expect(sortedTo(flattenGroups(mutated))).toEqual(GOLDEN_ROUTE_SET);
  });
});
