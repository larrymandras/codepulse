import { useMemo } from "react";
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
  | "auth_failed"
  | "pending" // optimistic cloud-initiated state (Phase 80, D-10)
  | "stopping_pending" // D-04: async stop, waiting for daemon
  | "expired"; // D-12: TTL-expired command

export type JobMode = "chat" | "goal";

// ---------------------------------------------------------------------------
// ForgeCommandRow: Convex forgeCommands doc adapted to CodePulse's component
// contract. Used for optimistic "Queued" pending rows (D-10) and their
// Failed / Expired flip (D-11). Sourced from useForgeCommands() (server rows)
// and ForgePage-local pendingLocal state (optimistic rows, B2).
// ---------------------------------------------------------------------------

export interface ForgeCommandRow {
  /** Stable client-generated id used for optimistic reconciliation. */
  commandId: string;
  commandType: "launch" | "stop";
  /** "pending" | "queued" | "executing" | "done" | "failed" | "expired" */
  status: JobStatus;
  agent: string | null;
  mode: JobMode | null;
  prompt: string | null;
  hostId: string;
  /** Set by the daemon ack once a real forgeJobs row exists (reconciliation). */
  resolvedForgeJobId: string | null;
  error: string | null;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// ForgeHostRow: Convex forgeHosts doc — liveness record for the host picker.
// ---------------------------------------------------------------------------

export interface ForgeHostRow {
  hostId: string;
  lastSeenAt: number;
  hostname: string | null;
}

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
// Adapter: Convex forgeCommands doc → ForgeCommandRow
//
// The backend status state-machine is queued → executing → done | failed |
// expired. For the optimistic-row UX (D-10/D-11) we surface:
//   queued | executing → "pending"  (shows ForgeStatusBadge "Queued…")
//   failed             → "failed"
//   expired            → "expired"
//   done               → "pending"  (reconciled away by ForgePage once the
//                                     real forgeJobs row appears)
// ---------------------------------------------------------------------------

function mapCommandStatus(raw: string): JobStatus {
  switch (raw) {
    case "failed":
      return "failed";
    case "expired":
      return "expired";
    case "queued":
    case "executing":
    case "done":
    default:
      return "pending";
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adaptCommand(doc: any): ForgeCommandRow {
  const launch = doc.launchPayload ?? null;
  return {
    commandId: doc.commandId,
    commandType: doc.commandType,
    status: mapCommandStatus(doc.status),
    agent: launch?.agent ?? null,
    mode: (launch?.mode as JobMode | undefined) ?? null,
    prompt: launch?.prompt ?? null,
    hostId: doc.hostId,
    resolvedForgeJobId: doc.resolvedForgeJobId ?? null,
    error: doc.error ?? null,
    createdAt: doc.createdAt,
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

/**
 * Returns the server-side forgeCommands rows (optionally scoped to one host).
 * Passing `null` lists all hosts ({}). Returns { commands } as an adapted,
 * coalesced array ([] during load). Used by ForgePage to merge with its local
 * optimistic pendingLocal state (B2).
 */
export function useForgeCommands(hostId: string | null): {
  commands: ForgeCommandRow[];
} {
  const raw = useQuery(
    api.forge.listForgeCommands,
    hostId ? { hostId } : {}
  );
  // Memoize so the returned array is referentially stable across renders.
  // `raw.map(...)` allocates a fresh array every render; consumers (e.g.
  // ForgePage's reconcile effect, deps [jobs, serverCommands]) would otherwise
  // see a new identity each render and loop into "Maximum update depth exceeded".
  const commands = useMemo(
    () => (raw === undefined ? [] : raw.map(adaptCommand)),
    [raw]
  );
  return { commands };
}

/**
 * Returns the forgeHosts liveness rows (newest-seen first), [] during load.
 * Drives the launch modal host picker (D-08).
 */
export function useForgeHosts(): ForgeHostRow[] {
  const raw = useQuery(api.forge.listHosts, {});
  if (raw === undefined) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return raw.map((doc: any) => ({
    hostId: doc.hostId,
    lastSeenAt: doc.lastSeenAt,
    hostname: doc.hostname ?? null,
  }));
}
