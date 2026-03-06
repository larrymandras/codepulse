import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useRecentEvents(limit = 50) {
  const events = useQuery(api.events.listRecent, { limit });
  return events ?? [];
}
