import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function usePipelineStepEvents(executionId?: string) {
  return useQuery(
    api.pipelineStepEvents.byExecution,
    executionId ? { executionId } : "skip"
  ) ?? [];
}

export function useRecentPipelineExecutionIds(limit?: number) {
  return useQuery(
    api.pipelineStepEvents.recentExecutionIds,
    limit ? { limit } : {}
  ) ?? [];
}
