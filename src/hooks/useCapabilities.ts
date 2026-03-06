import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useCapabilitySummary() {
  return useQuery(api.registry.summary);
}

export function useMcpServers() {
  return useQuery(api.registry.listMcpServers) ?? [];
}

export function usePlugins() {
  return useQuery(api.registry.listPlugins) ?? [];
}

export function useSkills() {
  return useQuery(api.registry.listSkills) ?? [];
}

export function useHooks() {
  return useQuery(api.registry.listHooks) ?? [];
}

export function useSlashCommands() {
  return useQuery(api.registry.listSlashCommands) ?? [];
}

export function useConfigChanges(limit = 30) {
  return useQuery(api.registry.listConfigChanges, { limit }) ?? [];
}

export function useDiscoveredTools() {
  return useQuery(api.registry.listTools) ?? [];
}
