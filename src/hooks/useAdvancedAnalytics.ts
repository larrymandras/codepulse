import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useActivityHeatmap() {
  return useQuery(api.analytics.activityHeatmap) ?? { cells: [], maxCount: 1 };
}

export function useToolFlowSankey() {
  return useQuery(api.analytics.toolFlowSankey) ?? { nodes: [], links: [] };
}

export function useTokenSunburst() {
  return useQuery(api.analytics.tokenSunburst) ?? { tree: { name: "All Providers", children: [] }, totalCost: 0, totalTokens: 0 };
}

export function useTokenWaterfall() {
  return useQuery(api.analytics.tokenWaterfall) ?? [];
}
