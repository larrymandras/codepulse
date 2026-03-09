import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useYggdrasilTree() {
  return useQuery(api.forge.yggdrasilTree) ?? { sessions: [], recentActivity: 0, eventTypes: {} };
}

export function useConstellation() {
  return useQuery(api.forge.constellation) ?? [];
}

export function useReactor() {
  return useQuery(api.forge.reactor) ?? {
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalCost: 0,
    callsLast10Min: 0,
    byProvider: {},
    contextPressure: 0,
    particles: [],
  };
}
