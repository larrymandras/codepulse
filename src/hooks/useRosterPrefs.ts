import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ViewMode = "chart" | "grid" | "table";

export interface RosterPrefsFilters {
  tier: string;
  status: string;
  profile: string;
}

export interface RosterPrefs {
  viewMode: ViewMode;
  sortBy: string | null;
  filters: RosterPrefsFilters;
}

const DEFAULT_PREFS: RosterPrefs = {
  viewMode: "grid",
  sortBy: null,
  filters: { tier: "all", status: "all", profile: "all" },
};

const DEBOUNCE_MS = 500;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRosterPrefs() {
  const stored = useQuery(api.rosterViewPrefs.get);
  const saveMutation = useMutation(api.rosterViewPrefs.save);

  const [viewMode, setViewModeLocal] = useState<ViewMode>(DEFAULT_PREFS.viewMode);
  const [sortBy, setSortByLocal] = useState<string | null>(DEFAULT_PREFS.sortBy);
  const [filters, setFiltersLocal] = useState<RosterPrefsFilters>(DEFAULT_PREFS.filters);
  const [isLoaded, setIsLoaded] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate from Convex on first load
  useEffect(() => {
    if (stored !== undefined && !isLoaded) {
      if (stored) {
        setViewModeLocal((stored.viewMode as ViewMode) ?? DEFAULT_PREFS.viewMode);
        setSortByLocal(stored.sortBy ?? DEFAULT_PREFS.sortBy);
        setFiltersLocal(
          (stored.filters as RosterPrefsFilters | undefined) ?? DEFAULT_PREFS.filters,
        );
      }
      setIsLoaded(true);
    }
  }, [stored, isLoaded]);

  // Debounced persist
  const persist = useCallback(
    (vm: ViewMode, sb: string | null, f: RosterPrefsFilters) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        saveMutation({
          viewMode: vm,
          sortBy: sb ?? undefined,
          filters: f,
        }).catch(() => {
          /* silent — non-critical */
        });
      }, DEBOUNCE_MS);
    },
    [saveMutation],
  );

  const setViewMode = useCallback(
    (vm: ViewMode) => {
      setViewModeLocal(vm);
      persist(vm, sortBy, filters);
    },
    [persist, sortBy, filters],
  );

  const setSortBy = useCallback(
    (sb: string | null) => {
      setSortByLocal(sb);
      persist(viewMode, sb, filters);
    },
    [persist, viewMode, filters],
  );

  const setFilters = useCallback(
    (f: RosterPrefsFilters) => {
      setFiltersLocal(f);
      persist(viewMode, sortBy, f);
    },
    [persist, viewMode, sortBy],
  );

  return { viewMode, sortBy, filters, setViewMode, setSortBy, setFilters, isLoaded };
}
