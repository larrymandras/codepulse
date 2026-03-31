import { useThrottledQuery } from "./useThrottledQuery";
import { api } from "../../convex/_generated/api";

export function useRecentEvents(limit = 50) {
  const events = useThrottledQuery(api.events.listRecent, { limit }, 500);
  return events ?? [];
}
