import { useState, useEffect, useCallback } from "react";
import { fetchEmailAssets } from "@/lib/astridrApi";
import type { EmailAssetItem } from "@/lib/astridrApi";

type AssetFolder = "all" | "avatars" | "logos";

export function useEmailAssets() {
  const [assets, setAssets] = useState<EmailAssetItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<AssetFolder>("all");

  const load = useCallback(
    async (folder: AssetFolder = "all") => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchEmailAssets(
          folder === "all" ? undefined : folder,
        );
        setAssets(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load assets");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load(filter);
  }, [load, filter]);

  const reload = useCallback(() => load(filter), [load, filter]);

  return { assets, loading, error, filter, setFilter, reload };
}
