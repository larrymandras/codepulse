import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

// ---------------------------------------------------------------------------
// Local type definitions — do NOT import from forge's @/types alias
// ---------------------------------------------------------------------------

export type JobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "stopped"
  | "auth_failed";

export type JobMode = "chat" | "goal";

// ---------------------------------------------------------------------------
// ForgeJobRow: Convex forgeJobs doc adapted to CodePulse's component contract.
// Extends the forge Job fields with extra fields needed by CodePulse.
// logFile is intentionally omitted (stripped with Logs tab per D-02).
// ---------------------------------------------------------------------------

export interface ForgeJobRow {
  // Mapped from doc.forgeJobId
  id: string;
  agent: string;
  mode: JobMode;
  prompt: string | null;
  workspaceId: string;
  status: JobStatus;
  pid: number | null;
  exitCode: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  artifactCount: number;
  capabilities: string;
  model: string | null;
  createdAt: string;
  // Extra fields — NOT on forge Job type
  hostId: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Adapter: Convex forgeJobs doc → ForgeJobRow
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adaptJob(doc: any): ForgeJobRow {
  return {
    id: doc.forgeJobId,
    agent: doc.agent,
    mode: doc.mode as JobMode,
    prompt: doc.prompt,
    workspaceId: doc.workspaceId,
    status: doc.status as JobStatus,
    pid: doc.pid,
    exitCode: doc.exitCode,
    startedAt: doc.startedAt,
    finishedAt: doc.finishedAt,
    artifactCount: doc.artifactCount,
    capabilities: doc.capabilities,
    model: doc.model,
    createdAt: doc.createdAt,
    hostId: doc.hostId,
    updatedAt: doc.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Returns the pre-coalesce value so callers can distinguish loading
 * (undefined) from empty ([]).
 */
export function useForgeJobsRaw(): ForgeJobRow[] | undefined {
  const raw = useQuery(api.forge.listJobs, {});
  if (raw === undefined) return undefined;
  return raw.map(adaptJob);
}

/**
 * Returns the adapted, merged, newest-first list of forge jobs.
 * Returns [] during load (undefined → []).
 */
export function useForgeJobs(): ForgeJobRow[] {
  return useForgeJobsRaw() ?? [];
}

/**
 * Optional single-job lookup. Skips the query when either arg is null
 * (idiomatic Convex conditional-query pattern).
 * Note: the P79 detail panel renders from the listJobs row directly —
 * this hook is provided for completeness and future use (P80+).
 */
export function useForgeJob(
  hostId: string | null,
  forgeJobId: string | null
) {
  return useQuery(
    api.forge.getJob,
    hostId && forgeJobId ? { hostId, forgeJobId } : "skip"
  );
}
