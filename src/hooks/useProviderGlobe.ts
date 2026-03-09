import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { PROVIDER_LOCATIONS, USER_LOCATION } from "../lib/providerLocations";

export interface GlobePoint {
  lat: number;
  lng: number;
  color: string;
  altitude: number;
  label: string;
  provider: string;
  calls: number;
  cost: number;
  avgLatency: number;
}

export interface GlobeArc {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string;
  stroke: number;
  altitude: number;
  label: string;
}

export interface GlobeStats {
  totalTokens: number;
  totalCost: number;
  avgLatency: number;
  activeProviders: number;
}

export interface GlobeData {
  points: GlobePoint[];
  arcs: GlobeArc[];
  stats: GlobeStats;
}

export function useProviderGlobe(): GlobeData {
  const providerBreakdown = useQuery(api.llm.providerBreakdown);
  const recentCalls = useQuery(api.llm.recentCalls);

  return useMemo(() => {
    const breakdown = providerBreakdown ?? [];
    const calls = recentCalls ?? [];

    // Find max calls for altitude scaling
    const maxCalls = Math.max(1, ...breakdown.map((p) => p.calls));

    // Build points: one per active provider
    const points: GlobePoint[] = breakdown
      .filter((p) => PROVIDER_LOCATIONS[p.provider])
      .map((p) => {
        const loc = PROVIDER_LOCATIONS[p.provider];
        return {
          lat: loc.lat,
          lng: loc.lng,
          color: loc.color,
          altitude: 0.1 + (p.calls / maxCalls) * 0.9,
          label: p.provider,
          provider: p.provider,
          calls: p.calls,
          cost: p.cost,
          avgLatency: p.avgLatency,
        };
      });

    // Build arcs: recent LLM calls from user location to provider
    const arcs: GlobeArc[] = calls
      .filter((c) => PROVIDER_LOCATIONS[c.provider])
      .slice(0, 30) // limit arc count for performance
      .map((c) => {
        const loc = PROVIDER_LOCATIONS[c.provider];
        const tokenStroke = Math.max(0.3, Math.log2(Math.max(1, c.totalTokens)) * 0.5);
        const costAltitude = Math.min(0.6, 0.1 + (c.cost ?? 0) * 2);
        return {
          startLat: USER_LOCATION.lat,
          startLng: USER_LOCATION.lng,
          endLat: loc.lat,
          endLng: loc.lng,
          color: loc.color,
          stroke: tokenStroke,
          altitude: costAltitude,
          label: `${c.provider}/${c.model} — ${c.totalTokens} tokens`,
        };
      });

    // Aggregate stats
    const totalTokens = calls.reduce((sum, c) => sum + c.totalTokens, 0);
    const totalCost = calls.reduce((sum, c) => sum + (c.cost ?? 0), 0);
    const avgLatency =
      calls.length > 0
        ? Math.round(calls.reduce((sum, c) => sum + c.latencyMs, 0) / calls.length)
        : 0;
    const activeProviders = new Set(breakdown.map((p) => p.provider)).size;

    return {
      points,
      arcs,
      stats: { totalTokens, totalCost, avgLatency, activeProviders },
    };
  }, [providerBreakdown, recentCalls]);
}
