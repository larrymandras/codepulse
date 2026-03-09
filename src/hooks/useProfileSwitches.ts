import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useProfileSwitches() {
  return useQuery(api.profiles.recentSwitches, { limit: 20 }) ?? [];
}
