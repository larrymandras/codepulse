import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useAgentProfiles() {
  return useQuery(api.agentProfiles.list) ?? [];
}

export function useAgentProfileMutations() {
  const create = useMutation(api.agentProfiles.create);
  const update = useMutation(api.agentProfiles.update);
  const remove = useMutation(api.agentProfiles.remove);
  return { create, update, remove };
}
