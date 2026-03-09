import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useDisabledRules() {
  return useQuery(api.alertRulesConfig.getDisabledRules) ?? [];
}
