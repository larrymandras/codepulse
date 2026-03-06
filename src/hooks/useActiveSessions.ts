import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useActiveSessions() {
  const sessions = useQuery(api.sessions.listActive);
  return sessions ?? [];
}
