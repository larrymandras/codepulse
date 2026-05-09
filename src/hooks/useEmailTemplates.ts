import { useState, useEffect, useCallback } from "react";
import { fetchTemplates } from "@/lib/astridrApi";
import type { EmailTemplate } from "@/lib/astridrApi";

export function useEmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTemplates();
      // Belt-and-suspenders: API filters with ?is_active=eq.true but client
      // also filters in case server doesn't support that query param syntax.
      setTemplates(data.filter((t) => t.is_active !== false));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { templates, loading, error, reload: load };
}
