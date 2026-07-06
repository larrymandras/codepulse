/**
 * useSubagentJobs — Convex live-query hook for background subagent job status.
 *
 * Phase 168 (background subagents) — SC-2/SC-3.
 * Mirrors useSwarmGraph's useQuery + typed-row + `?? []` fallback template.
 * useSubagentJobs(): returns recent subagentJobs rows, newest-first.
 * useSubagentJob(jobId): returns a single job's row by jobId, or undefined
 * while loading / not found. Uses the "skip" sentinel so no query fires
 * when jobId is null/undefined.
 */

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export type SubagentJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface SubagentJobRow {
  jobId: string;
  agentTypeId: string;
  status: SubagentJobStatus;
  taskSnippet: string;
  resultSnippet?: string;
  error?: string;
  channelId?: string;
  chatId?: string;
  submittedAt: number;
  finishedAt?: number;
  updatedAt?: number;
}

/**
 * Returns recent subagentJobs rows across all statuses, newest-first.
 * Returns [] while loading (query result undefined).
 */
export function useSubagentJobs(): SubagentJobRow[] {
  return (
    (useQuery(api.subagentJobs.listRecent, {}) as SubagentJobRow[] | undefined) ?? []
  );
}

/**
 * Returns a single subagentJobs row by jobId, or undefined while loading /
 * when jobId is null/undefined (uses the "skip" sentinel so no query fires).
 */
export function useSubagentJob(
  jobId: string | null | undefined
): SubagentJobRow | undefined {
  return useQuery(
    api.subagentJobs.byId,
    jobId ? { jobId } : "skip"
  ) as SubagentJobRow | undefined;
}
