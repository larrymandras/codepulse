import { useState, useEffect, useCallback } from "react";
import { fetchLayouts } from "@/lib/astridrApi";
import type { EmailLayout } from "@/lib/astridrApi";

export function useEmailLayouts() {
  const [layouts, setLayouts] = useState<EmailLayout[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLayouts();
      // Belt-and-suspenders: API filters with ?is_active=eq.true but client
      // also filters in case server doesn't support that query param syntax.
      setLayouts(data.filter((l) => l.is_active === true));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load layouts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { layouts, loading, error, reload: load };
}
