import { useState, useEffect, useRef, useCallback } from "react";
import { ConvexHttpClient } from "convex/browser";
import type { FunctionReference } from "convex/server";

export function usePollQuery<Query extends FunctionReference<"query">>(
  queryFn: Query,
  args: Query["_args"],
  intervalMs: number = 5000
): { data: Query["_returnType"] | undefined; isStale: boolean; refetch: () => void } {
  const [data, setData] = useState<Query["_returnType"] | undefined>(undefined);
  const [isStale, setIsStale] = useState(false);
  const mountedRef = useRef(true);
  const clientRef = useRef<ConvexHttpClient | null>(null);

  if (!clientRef.current) {
    clientRef.current = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL);
  }

  const argsKey = JSON.stringify(args);

  const fetchData = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    try {
      const result = await clientRef.current!.query(queryFn, args);
      if (mountedRef.current) {
        setData(result);
        setIsStale(false);
      }
    } catch {
      if (mountedRef.current) {
        setIsStale(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryFn, argsKey]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    const id = setInterval(fetchData, intervalMs);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [fetchData, intervalMs]);

  return { data, isStale, refetch: fetchData };
}
