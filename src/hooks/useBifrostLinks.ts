import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * useBifrostLinks.ts — the Bifröst link hub's read side (Phase 117).
 *
 * Two variants, for the reason Phase 116 learned the hard way: a bare
 * `useQuery(...) ?? []` collapses "still loading" and "genuinely empty" into
 * the same value, so any surface that must render those differently needs the
 * loading signal preserved.
 */

// `useBifrostLinks()` (the bare `?? []` wrapper) was removed 2026-08-11 by the
// v14.0 audit (INT-06) — zero non-test call sites. `useBifrostLinksState` below
// is what `Bifrost.tsx` actually consumes.

/** Links plus the loading signal the `?? []` fallback destroys. */
export function useBifrostLinksState() {
  const links = useQuery(api.bifrost.list);
  return { links: links ?? [], isLoading: links === undefined };
}

/**
 * D-02: liveness resolves by CONTAINER NAME, not host:port — no port or host
 * field exists anywhere in the schema. Returns a map of container name to its
 * reported status, built from the same `docker:currentStatus` rows DockerPanel
 * already renders. No new probing happens here or anywhere in this phase.
 */
export function useContainerStatusMap(): Record<string, string> {
  const containers = useQuery(api.docker.currentStatus) ?? [];
  const map: Record<string, string> = {};
  for (const c of containers as Array<{ name?: string; status?: string }>) {
    if (c.name && c.status) map[c.name] = c.status;
  }
  return map;
}
