import { useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
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
 * Module-scope, so the "usage tracking is broken" warning fires at most once per
 * page load no matter how many links are opened. A per-call toast would punish
 * the operator with a notification storm for a background failure that does not
 * affect the thing they actually asked for.
 */
let usageFailureAnnounced = false;

/** Test seam — resets the once-per-load latch between cases. */
export function __resetUsageFailureLatch() {
  usageFailureAnnounced = false;
}

/**
 * The ONE place a link open is recorded. Both call sites — the command palette's
 * Enter and the /bifrost card's anchor — route through this rather than each
 * calling `useMutation` and inventing their own error handling, which is how the
 * two drifted into a pair of identical silent `.catch(() => {})`s in the first
 * place.
 *
 * The failure path is the point of this hook. A discarded rejection makes a
 * broken usage write INDISTINGUISHABLE from a link nobody opens: both leave
 * `usageCount` at zero forever, the palette silently degrades to creation order,
 * and nothing anywhere says so. That is the same "a zero is not authoritative
 * unless you know it was measured" shape the Inbox badge work is closing on the
 * other side of this repo.
 *
 * So: log EVERY failure (console, cheap, always available in devtools), and
 * surface at most one toast per load so a persistent failure is noticed without
 * being nagged about. Navigation is never blocked or delayed either way.
 */
export function useRecordLinkOpen(): (linkId: string) => void {
  const recordOpen = useMutation(api.bifrost.recordOpen);
  return useCallback(
    (linkId: string) => {
      void recordOpen({ linkId: linkId as never }).catch((err: unknown) => {
        console.error(
          "[bifrost] link usage write failed — palette ranking will not reflect this open",
          err
        );
        if (!usageFailureAnnounced) {
          usageFailureAnnounced = true;
          toast.warning(
            "Link usage tracking is failing — palette ordering may be stale."
          );
        }
      });
    },
    [recordOpen]
  );
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
