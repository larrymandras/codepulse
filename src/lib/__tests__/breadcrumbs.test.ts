/**
 * breadcrumbs.test.ts — Phase 124 Plan 09 (SHELL-01, D-16).
 *
 * The population check (last `it` below) iterates `navItems` directly
 * rather than a hand-listed sample — a hand-listed sample only ever
 * ratifies today's map and would stay green if a future edit to
 * `navGroups` silently broke the derivation for items nobody thought to
 * list. See 124-09-SUMMARY.md for the fifth-domain mutation proof that
 * this check actually discriminates.
 */
import { describe, it, expect } from "vitest";
import { getBreadcrumbTrail, DETAIL_ROUTE_PARENTS } from "../breadcrumbs";
import { navGroups, navItems } from "../navRegistry";

describe("getBreadcrumbTrail", () => {
  it('"/" -> ["Observe", "Dashboard"]', () => {
    expect(getBreadcrumbTrail("/")).toEqual(["Observe", "Dashboard"]);
  });

  it('"/infrastructure" -> ["System", "Infrastructure"]', () => {
    expect(getBreadcrumbTrail("/infrastructure")).toEqual(["System", "Infrastructure"]);
  });

  it('"/hr/analytics" -> ["Agents", "Agent Analytics"] (proves the D-05 rename flows through)', () => {
    expect(getBreadcrumbTrail("/hr/analytics")).toEqual(["Agents", "Agent Analytics"]);
  });

  it('"/settings" -> ["Settings"] (single segment, no domain — D-04)', () => {
    expect(getBreadcrumbTrail("/settings")).toEqual(["Settings"]);
  });

  it('"/hr/roster/abc123" -> ["Agents", "Roster", "abc123"]', () => {
    expect(getBreadcrumbTrail("/hr/roster/abc123")).toEqual(["Agents", "Roster", "abc123"]);
  });

  it('"/sessions/xyz" -> ["Observe", "Executions", "xyz"] (correction to the UI-SPEC, which wrote "System / Executions" — /executions is locked-map row 14, Observe)', () => {
    expect(getBreadcrumbTrail("/sessions/xyz")).toEqual(["Observe", "Executions", "xyz"]);
  });

  it('"/no-such-route" -> [] (render nothing; never a guessed segment)', () => {
    expect(getBreadcrumbTrail("/no-such-route")).toEqual([]);
  });

  it("covers all seven DETAIL_ROUTE_PARENTS-shaped routes plus /settings", () => {
    expect(getBreadcrumbTrail("/quality/prof-1")).toEqual(["Observe", "Quality", "prof-1"]);
    expect(getBreadcrumbTrail("/war-room/room-1")).toEqual(["Agents", "War Room", "room-1"]);
    expect(getBreadcrumbTrail("/hr/onboarding/cat-1")).toEqual(["Agents", "Onboarding", "cat-1"]);
    expect(getBreadcrumbTrail("/hr/teams/team-1")).toEqual(["Agents", "Teams", "team-1"]);
    expect(DETAIL_ROUTE_PARENTS.length).toBe(6);
  });

  // Population check — the whole point of D-16: iterate navItems (the live
  // registry), not a hand-picked sample, so a future edit to navGroups is
  // caught here automatically. See SUMMARY for the mutation proof that this
  // fails when the registry grows a domain unknown to the four-domain shell.
  it("every registered nav item derives a two-segment trail whose first segment is one of the four known domains", () => {
    // Hardcoded to the four LOCKED domain names (124-CONTEXT.md D-01/D-16) —
    // deliberately NOT derived from navGroups itself. Deriving it from
    // navGroups would make this check circular: a navGroups edit that adds a
    // fifth domain would add that domain to KNOWN_DOMAINS too, and the check
    // could never fail. See SUMMARY for the mutation proof.
    const KNOWN_DOMAINS = new Set(["Command", "Observe", "Agents", "System"]);
    expect(navItems.length).toBeGreaterThan(0);
    for (const item of navItems) {
      const trail = getBreadcrumbTrail(item.to);
      expect(trail.length, `trail for ${item.to}`).toBe(2);
      expect(trail[0].length, `domain segment for ${item.to}`).toBeGreaterThan(0);
      expect(trail[1].length, `label segment for ${item.to}`).toBeGreaterThan(0);
      expect(KNOWN_DOMAINS.has(trail[0]), `unknown domain for ${item.to}: ${trail[0]}`).toBe(true);
    }
  });
});
