import { useState, useEffect, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { fetchAgents, type AgentListItem } from "@/lib/astridrApi";
import type { Id } from "../../convex/_generated/dataModel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AvatarData {
  name: string;
  emoji?: string;
  color?: string;
  imageStorageId?: Id<"_storage">;
}

export interface RosterAgent extends AgentListItem {
  status: "active" | "idle" | "pending";
  approvalId?: string;
  requestedAt?: number;
  configSnapshot?: unknown;
  avatarData?: AvatarData;
}

export interface RosterFilters {
  tier?: string;
  status?: string;
  profile?: string;
  search?: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const POLL_INTERVAL = 30_000;

export function useRosterAgents() {
  const [apiAgents, setApiAgents] = useState<AgentListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pendingApprovals = useQuery(api.approvalQueue.list, { status: "pending" }) ?? [];
  const convexAgents = useQuery(api.agentConfigVersions.listAgents) ?? [];
  const agentProfiles = useQuery(api.agentProfiles.list) ?? [];
  const avatarRecords = useQuery(api.avatars.list) ?? [];

  const load = useCallback(async () => {
    try {
      const data = await fetchAgents();
      setApiAgents(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agents");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [load]);

  // Merge API agents (or Convex fallback) with pending approvals.
  // Only fall back to Convex after the API call has resolved to avoid
  // flashing partial data while the fetch is still in-flight.
  const agents: RosterAgent[] = (() => {
    const baseAgents: AgentListItem[] = apiAgents.length > 0
      ? apiAgents
      : isLoading ? [] : convexAgents as AgentListItem[];
    const apiIds = new Set(baseAgents.map((a) => a.id));

    const merged: RosterAgent[] = baseAgents.map((a) => {
      const profile = agentProfiles.find(
        (p) => p.profileId === a.id || p.name === a.name,
      );
      const avatar = profile?.avatarId
        ? avatarRecords.find((av) => av._id === profile.avatarId)
        : undefined;
      return {
        ...a,
        status: a.active ? ("active" as const) : ("idle" as const),
        avatarData: avatar
          ? {
              name: avatar.name,
              emoji: avatar.emoji,
              color: avatar.color,
              imageStorageId: avatar.imageStorageId,
            }
          : undefined,
      };
    });

    // Append pending approvals not yet in API list
    for (const approval of pendingApprovals) {
      if (!apiIds.has(approval.agentId)) {
        merged.push({
          id: approval.agentId,
          name: approval.agentName,
          tier: approval.tier as "command" | "domain" | "shared",
          active: false,
          budget_fraction: approval.budgetFraction ?? 0,
          status: "pending",
          approvalId: approval.requestId,
          requestedAt: approval.requestedAt,
          configSnapshot: approval.configSnapshot,
        });
      }
    }

    return merged;
  })();

  return { agents, isLoading, error, refetch: load };
}

// ---------------------------------------------------------------------------
// Filter & sort utilities
// ---------------------------------------------------------------------------

export function filterAgents(
  agents: RosterAgent[],
  filters: RosterFilters,
): RosterAgent[] {
  return agents.filter((a) => {
    if (filters.tier && filters.tier !== "all" && a.tier !== filters.tier)
      return false;
    if (
      filters.status &&
      filters.status !== "all" &&
      a.status !== filters.status
    )
      return false;
    if (
      filters.profile &&
      filters.profile !== "all" &&
      !(a.profiles ?? []).includes(filters.profile)
    )
      return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!a.name.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

export function sortAgents(
  agents: RosterAgent[],
  sortBy: string | null,
  direction: "asc" | "desc" = "asc",
): RosterAgent[] {
  if (!sortBy) return agents;
  const dir = direction === "asc" ? 1 : -1;
  return [...agents].sort((a, b) => {
    const aVal = (a as unknown as Record<string, unknown>)[sortBy];
    const bVal = (b as unknown as Record<string, unknown>)[sortBy];
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return dir;
    if (bVal == null) return -dir;
    if (typeof aVal === "string" && typeof bVal === "string")
      return aVal.localeCompare(bVal) * dir;
    if (typeof aVal === "number" && typeof bVal === "number")
      return (aVal - bVal) * dir;
    return 0;
  });
}
