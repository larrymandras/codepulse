import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useDailyRhythm() {
  return useQuery(api.dailyRhythm.list) ?? [];
}
