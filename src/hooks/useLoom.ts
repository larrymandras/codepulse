import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * useLoom.ts — Loom's read side (Phase 119).
 *
 * Both variants exist for the reason Phase 116 established: a bare
 * `useQuery(...) ?? []` collapses "loading" and "empty" into one value, and the
 * page renders those differently.
 */

export interface LoomStep {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  docMd?: string;
}

export interface LoomPipeline {
  _id: string;
  slug: string;
  name: string;
  description?: string;
  owner?: string;
  steps: LoomStep[];
  sourceRef?: string;
}

export interface LoomRun {
  _id: string;
  pipelineSlug: string;
  status: string;
  startedAt: number;
  endedAt?: number;
  currentStep?: string;
  stepEvents: Array<{ stepId: string; event: string; text?: string; at: number }>;
}

export function useLoomPipelinesState() {
  const pipelines = useQuery(api.loom.listPipelines);
  return {
    pipelines: (pipelines ?? []) as unknown as LoomPipeline[],
    isLoading: pipelines === undefined,
  };
}

/** Runs for one pipeline, newest first. `"skip"` while no pipeline is selected. */
export function useLoomRuns(pipelineSlug: string | null) {
  const runs = useQuery(
    api.loom.listRuns,
    pipelineSlug ? { pipelineSlug } : "skip"
  );
  return (runs ?? []) as unknown as LoomRun[];
}
