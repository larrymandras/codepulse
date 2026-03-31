import { useQuery } from "convex/react";
import { useState, useEffect, useRef } from "react";

export function useThrottledQuery<T>(
  queryFn: any,
  args: any,
  intervalMs: number = 500
): T | undefined {
  const raw = useQuery(queryFn, args);
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
