import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useNavCounts() {
  return useQuery(api.navCounts.navCounts) ?? {
    alerts: 0,
    notifications: 0,
    inbox: 0,
    tasks: 0,
  };
}
