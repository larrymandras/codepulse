import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useAgentToolbelt(agentId: string | null) {
  const assignments = useQuery(
    api.toolAssignments.byAgent,
    agentId ? { agentId } : "skip"
  );

  if (!assignments) return null;

  const byTag: Record<string, Array<{ toolId: string; source: string; origin?: string }>> = {};
  const kits: string[] = assignments[0]?.kits ?? [];

  for (const a of assignments) {
    for (const tag of a.tags) {
      if (!byTag[tag]) byTag[tag] = [];
      byTag[tag].push({ toolId: a.toolId, source: a.assignmentSource, origin: a.origin });
    }
  }

  const overrides = assignments.filter((a: { assignmentSource: string }) => a.assignmentSource === "override");

  return {
    kits,
    byTag,
    overrides,
    toolCount: assignments.length,
  };
}

export function useToolMatrix() {
  return useQuery(api.toolAssignments.matrix) ?? null;
}

export function useUnassignedTools() {
  return useQuery(api.toolAssignments.unassigned) ?? [];
}

export function useRecentAssignmentChanges(limit: number = 20) {
  return useQuery(api.toolAssignments.recentChanges, { limit }) ?? [];
}
