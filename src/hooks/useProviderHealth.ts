import { usePollQuery } from "./usePollQuery";
import { api } from "../../convex/_generated/api";

export function useProviderHealth() {
  const { data } = usePollQuery(api.providerHealth.latest, {}, 10000);
  return data ?? {};
}
