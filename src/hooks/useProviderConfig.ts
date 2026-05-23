import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useProviderConfig() {
  const configs = useQuery(api.providerConfig.list) ?? [];
  const setEnabled = useMutation(api.providerConfig.setEnabled);
  const setPriority = useMutation(api.providerConfig.setPriority);
  return { configs, setEnabled, setPriority };
}
