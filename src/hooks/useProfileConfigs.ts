import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useProfileConfigs() {
  return useQuery(api.profiles.listConfigs) ?? [];
}
