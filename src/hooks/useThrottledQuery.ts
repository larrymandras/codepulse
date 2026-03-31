import { useQuery } from "convex/react";
import { useState, useEffect, useRef } from "react";
import type { FunctionReference } from "convex/server";

export function useThrottledQuery<Query extends FunctionReference<"query">>(
  queryFn: Query,
  args: Query["_args"],
  intervalMs: number = 500
): Query["_returnType"] | undefined {
  const raw = useQuery(queryFn, args as any);
  const [throttled, setThrottled] = useState(raw);
  const lastUpdate = useRef(0);

  useEffect(() => {
    const now = Date.now();
    if (now - lastUpdate.current >= intervalMs) {
      setThrottled(raw);
      lastUpdate.current = now;
    } else {
      const remaining = intervalMs - (now - lastUpdate.current);
      const timer = setTimeout(() => {
        setThrottled(raw);
        lastUpdate.current = Date.now();
      }, remaining);
      return () => clearTimeout(timer);
    }
  }, [raw, intervalMs]);

  return throttled;
}
