import { useState, useEffect, useCallback, useRef } from "react";
import {
  searchCatalog,
  getCatalogEntry,
  type CatalogEntry,
  type CatalogEntryDetail,
} from "@/lib/astridrApi";

export function useCatalogSearch(debounceMs = 300) {
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState<string | undefined>();
  const [results, setResults] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const doSearch = useCallback(async (q: string, t?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await searchCatalog({
        q: q || undefined,
        tier: t,
        limit: 50,
      });
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(query, tier), debounceMs);
    return () => clearTimeout(timerRef.current);
  }, [query, tier, debounceMs, doSearch]);

  return { query, setQuery, tier, setTier, results, loading, error };
}

export function useCatalogEntry(id: string | undefined) {
  const [entry, setEntry] = useState<CatalogEntryDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setEntry(null);
      return;
    }
    setLoading(true);
    getCatalogEntry(id)
      .then(setEntry)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load entry"),
      )
      .finally(() => setLoading(false));
  }, [id]);

  return { entry, loading, error };
}
