import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import type { Id } from "../../convex/_generated/dataModel";
import type { KgLens, KgFilters } from "./useKnowledgeGraph";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SavedKgView {
  _id: Id<"savedKgViews">;
  _creationTime: number;
  name: string;
  lens: string;
  filters: Record<string, unknown>; // KgFilters minus searchQuery (D-06)
  focus: string;                    // entityName for Entity/Temporal (D-05)
  hops: number;                     // hop depth (D-05)
  shareToken: string;               // opaque random UUID (D-03)
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSavedViews() {
  const views = useQuery(api.savedKgViews.list) as SavedKgView[] | undefined;

  const saveMutation = useMutation(api.savedKgViews.save);
  const removeMutation = useMutation(api.savedKgViews.remove);

  /**
   * Persist the current KG state as a named view. Strips searchQuery before
   * persisting (D-06 — search terms are ephemeral, not view config). Generates
   * a fresh shareToken client-side via crypto.randomUUID() (D-03).
   *
   * Returns the shareToken on success so callers can immediately offer a
   * share URL without a round-trip.
   */
  const saveView = async (
    name: string,
    lens: KgLens,
    filters: KgFilters,
    focus: string,
    hops: number,
  ): Promise<string> => {
    // D-06: strip the transient searchQuery before persisting
    const { searchQuery: _sq, ...persistable } = filters;

    // D-03: generate opaque share token client-side (avoids Convex runtime
    // crypto.randomUUID availability question — RESEARCH Open Question 1)
    const shareToken = crypto.randomUUID();

    try {
      await saveMutation({
        name,
        lens,
        filters: persistable,
        focus,
        hops,
        shareToken,
        createdAt: Date.now(),
      });
      toast.success(`View "${name}" saved`);
      return shareToken;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save view",
      );
      throw err;
    }
  };

  /**
   * Delete a saved view by its Convex _id. Silent — no toast (views are
   * reconstructable preferences, not data; UI-SPEC: single trash-icon click,
   * no confirmation).
   */
  const deleteView = async (id: Id<"savedKgViews">): Promise<void> => {
    await removeMutation({ id });
  };

  /**
   * Build the share URL for a saved view. Shape: /knowledge-graph?view=<token>
   * (D-03). Uses window.location.origin so it's always correct for the current
   * deployment.
   */
  const buildShareUrl = (shareToken: string): string => {
    return `${window.location.origin}/knowledge-graph?view=${shareToken}`;
  };

  return {
    views: views ?? [],
    /** true while the Convex list query is in-flight (needed by ?view hydration
     *  guard in KnowledgeGraph.tsx — RESEARCH Pitfall 1) */
    isLoading: views === undefined,
    saveView,
    deleteView,
    buildShareUrl,
  };
}
