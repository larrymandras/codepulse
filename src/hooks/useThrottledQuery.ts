import { useQuery } from "convex/react";
import { useState, useEffect, useRef } from "react";
import type { FunctionReference } from "convex/server";

/**
 * Wraps useQuery with throttled React state updates.
 *
 * NOTE (CPHLTH-05): This hook throttles UI re-renders, NOT the underlying
 * Convex subscription. The subscription stays live and reactive. This is
 * intentional — Convex manages subscription lifecycle internally.
 *
 * The sidebar fan-out that originally motivated CPHLTH-05 is now resolved
 * by CPHLTH-04 (server-side navCounts query). Remaining callers of this
 * hook benefit from the re-render throttle without needing server-side
 * polling, since Convex subscriptions are lightweight by design.
 */
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
