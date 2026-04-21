import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import type { Id } from "../../convex/_generated/dataModel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TeamPreset {
  _id: Id<"teamPresets">;
  _creationTime: number;
  name: string;
  description?: string;
  agentIds: string[];
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
  lastUsedAt?: number;
  warRoomCount?: number;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTeamPresets() {
  const teams = useQuery(api.teamPresets.list) as TeamPreset[] | undefined;

  const createMutation = useMutation(api.teamPresets.create);
  const updateMutation = useMutation(api.teamPresets.update);
  const removeMutation = useMutation(api.teamPresets.remove);
  const incrementUsageMutation = useMutation(api.teamPresets.incrementUsage);

  const create = async (args: {
    name: string;
    description?: string;
    agentIds: string[];
    createdBy?: string;
  }) => {
    try {
      const id = await createMutation(args);
      toast.success("Team created");
      return id;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create team",
      );
      throw err;
    }
  };

  const update = async (args: {
    id: Id<"teamPresets">;
    name?: string;
    description?: string;
    agentIds?: string[];
  }) => {
    try {
      await updateMutation(args);
      toast.success("Team updated");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update team",
      );
      throw err;
    }
  };

  const remove = async (id: Id<"teamPresets">) => {
    try {
      await removeMutation({ id });
      toast.success("Team deleted");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete team",
      );
      throw err;
    }
  };

  const incrementUsage = (id: Id<"teamPresets">) => {
    // Silent — no toast for usage tracking
    incrementUsageMutation({ id }).catch(() => {
      // Silently ignore usage tracking failures
    });
  };

  return {
    teams: teams ?? [],
    isLoading: teams === undefined,
    create,
    update,
    remove,
    incrementUsage,
  };
}
