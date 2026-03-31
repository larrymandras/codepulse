import { useThrottledQuery } from "./useThrottledQuery";
import { api } from "../../convex/_generated/api";

export function useProviderHealth() {
  return useThrottledQuery(api.providerHealth.latest, {}, 5000) ?? {};
}
