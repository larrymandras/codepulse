/**
 * breadcrumbs.ts — Phase 124 Plan 09 (SHELL-01, D-16).
 *
 * Derives the header breadcrumb trail from `navRegistry.ts` so the 44
 * registry-mapped routes stay correct automatically whenever `navGroups`
 * changes — there is exactly one place that knows a route's domain and
 * label (the registry itself), never a second copy that can drift. The
 * rejected alternative was every page declaring its own breadcrumb, which
 * would maintain the domain name in two places.
 *
 * Six routes carry a URL param and therefore have NO registry entry (a
 * registry item is one fixed `to` string, not a pattern): `/sessions/:id`,
 * `/quality/:profileId`, `/war-room/:roomId`, `/hr/roster/:agentId`,
 * `/hr/onboarding/:catalogId`, `/hr/teams/:teamId`. A seventh route,
 * `/settings`, is a real route (`src/App.tsx`) that renders inside this
 * shell but is deliberately absent from the registry too, because D-04
 * keeps Settings footer-pinned rather than in the nav. All seven are
 * covered by `DETAIL_ROUTE_PARENTS` below.
 *
 * The trailing detail segment (the id/roomId/etc.) is rendered as the RAW
 * URL param, never a resolved display name — resolving `{agentId}` to
 * "Hildr" needs a per-record read this shell does not have (D-11 declines
 * to add shell-level backend reads), and inventing one would be the
 * fabrication class POLISH-04 exists to prevent. A later phase with a
 * per-record read can improve this deliberately.
 *
 * An unmatched or unmapped path returns an EMPTY array — never a guessed
 * segment derived from the URL. An empty zone 1 is honest; an invented
 * trail is not.
 *
 * Correction to the UI-SPEC: an earlier draft of `124-UI-SPEC.md` showed
 * `/sessions/:id` as "System / Executions". `/executions` is row 14 of the
 * locked 44-row map in `124-CONTEXT.md` and maps to **Observe**, not
 * System — this module uses the locked map (Observe), and the UI-SPEC
 * prose is stale on that one row. See 124-09-SUMMARY.md for the citation.
 */
import { navGroups } from "./navRegistry";

interface DetailRouteParent {
  /** Static path prefix; the remaining pathname segment after this prefix
   *  becomes the trail's final (detail) segment. */
  prefix: string;
  /** ["Domain", "Label"] as they should render — independent of the
   *  registry, since these routes have no registry entry to read from. */
  trail: [string, string];
}

// D-16: the six param routes with no registry entry, plus /settings. Order
// matters only for readability; matching below checks every entry.
export const DETAIL_ROUTE_PARENTS: DetailRouteParent[] = [
  { prefix: "/sessions/", trail: ["Observe", "Executions"] },
  { prefix: "/quality/", trail: ["Observe", "Quality"] },
  { prefix: "/war-room/", trail: ["Agents", "War Room"] },
  { prefix: "/hr/roster/", trail: ["Agents", "Roster"] },
  { prefix: "/hr/onboarding/", trail: ["Agents", "Onboarding"] },
  { prefix: "/hr/teams/", trail: ["Agents", "Teams"] },
];

// Exact-match lookup built once from navGroups: `to` -> [group, label].
const EXACT_TRAIL_BY_PATH: Map<string, [string, string]> = new Map();
for (const grp of navGroups) {
  for (const item of grp.items) {
    EXACT_TRAIL_BY_PATH.set(item.to, [grp.group, item.label]);
  }
}

/**
 * Pure path -> breadcrumb trail derivation.
 *
 * - Exact registry match -> `[domain, label]` (44 mapped routes).
 * - `/settings` -> `["Settings"]` (single segment, no domain — D-04).
 * - One of the six `DETAIL_ROUTE_PARENTS` prefixes -> `[domain, label, rawParam]`.
 * - Anything else (redirect-only routes, unmapped/unmatched paths) -> `[]`.
 */
export function getBreadcrumbTrail(pathname: string): string[] {
  const exact = EXACT_TRAIL_BY_PATH.get(pathname);
  if (exact) return [...exact];

  if (pathname === "/settings") return ["Settings"];

  for (const parent of DETAIL_ROUTE_PARENTS) {
    if (pathname.startsWith(parent.prefix)) {
      const detail = pathname.slice(parent.prefix.length);
      if (detail.length === 0) continue; // e.g. bare "/quality/" — no param present
      return [...parent.trail, detail];
    }
  }

  return [];
}
