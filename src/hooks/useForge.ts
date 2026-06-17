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
  // Memoize so the adapted array is referentially stable across renders.
  // `raw.map(...)` allocates a fresh array every render; ForgePage feeds this
  // into a reconcile effect (deps [jobs, serverCommands]) that would otherwise
  // loop into "Maximum update depth exceeded" with live data (the test mock
  // returns a stable array, so only the live app surfaces it).
  return useMemo(
    () => (raw === undefined ? undefined : raw.map(adaptJob)),
    [raw]
  );
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
 * Returns the forgeHosts liveness rows (newest-seen first), or `undefined`
 * while the query is still loading. Distinguishes "still loading" from
 * "no hosts have ever polled" so the UI can show a skeleton vs. an empty state
 * (WR-01). Referentially stable across renders via useMemo.
 */
export function useForgeHostsRaw(): ForgeHostRow[] | undefined {
  const raw = useQuery(api.forge.listHosts, {});
  return useMemo(() => {
    if (raw === undefined) return undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return raw.map((doc: any) => ({
      hostId: doc.hostId,
      lastSeenAt: doc.lastSeenAt,
      hostname: doc.hostname ?? null,
    }));
  }, [raw]);
}

/**
 * Returns the forgeHosts liveness rows (newest-seen first), [] during load.
 * Drives the launch modal host picker (D-08). Use useForgeHostsRaw when you
 * need to distinguish the loading state from the genuinely-empty state.
 */
export function useForgeHosts(): ForgeHostRow[] {
  return useForgeHostsRaw() ?? EMPTY_HOSTS;
}

const EMPTY_HOSTS: ForgeHostRow[] = [];

// ---------------------------------------------------------------------------
// ForgeLogChunk: Convex forgeLogChunks doc adapted for the log pane.
// ---------------------------------------------------------------------------

export interface ForgeLogChunk {
  /** doc._id */
  id: string;
  seq: number;
  lines: string[];
  sentAt: string | null;
}

// ---------------------------------------------------------------------------
// Adapter: Convex forgeLogChunks doc → ForgeLogChunk
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adaptLogChunk(doc: any): ForgeLogChunk {
  return {
    id: doc._id,
    seq: doc.seq,
    lines: doc.lines,
    sentAt: doc.sentAt ?? null,
  };
}

/**
 * Returns log chunks for a specific job, ordered by seq asc.
 * Returns [] during load (undefined → []) or when either arg is null.
 *
 * Skip-query pattern: passes "skip" when either hostId or forgeJobId is null
 * (idiomatic Convex conditional-query pattern, mirrors useForgeJob).
 *
 * Phase 80 memoization rule: raw.map(...) allocates a fresh array every render.
 * Without useMemo, a reactive query delivering live log updates would cause
 * referential instability, breaking any useEffect with this array as a
 * dependency and looping into "Maximum update depth exceeded" under live data.
 * Always wrap .map() output in useMemo([raw]).
 */
export function useForgeJobLogs(
  hostId: string | null,
  forgeJobId: string | null
): ForgeLogChunk[] {
  const raw = useQuery(
    api.forge.listJobLogs,
    hostId && forgeJobId ? { hostId, forgeJobId } : "skip"
  );
  return useMemo(
    () => (raw === undefined ? [] : raw.map(adaptLogChunk)),
    [raw]
  );
}

// ---------------------------------------------------------------------------
// Phase 82: Workspace lookup hook
// ---------------------------------------------------------------------------

/**
 * Returns the rootPath for a specific workspace, or null while loading / not found.
 * Used by ForgeFilesPane to resolve rootPath for VS Code deep links (A7).
 * Calls listWorkspaces scoped to hostId; finds the matching workspaceId entry.
 */
export function useForgeWorkspace(
  hostId: string | null,
  workspaceId: string | null
): { rootPath: string } | null | undefined {
  const raw = useQuery(
    api.forge.listWorkspaces,
    hostId ? { hostId } : "skip"
  );
  return useMemo(() => {
    if (raw === undefined) return undefined; // loading
    if (!workspaceId) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ws = (raw as any[]).find((w: any) => w.workspaceId === workspaceId);
    if (!ws) return null;
    return { rootPath: ws.rootPath as string };
  }, [raw, workspaceId]);
}

// ---------------------------------------------------------------------------
// Phase 82: File browser types + hooks (FI-12 / FI-14)
// ---------------------------------------------------------------------------

/**
 * ForgeFileRow: Convex forgeFiles doc adapted for the FileBrowser component.
 * Sourced from listJobFiles query (82-01 backend).
 */
export interface ForgeFileRow {
  /** doc._id */
  id: string;
  /** Relative path within workspace (e.g. "output/report.html") */
  path: string;
  /** Kind tag: "text" | "image" | "video" | "audio" | "pdf" | "binary" */
  kind: string;
  sizeBytes: number;
}

/**
 * ForgeArtifactRow: Convex forgeArtifacts doc adapted for ArtifactPreview.
 * Returned by getJobArtifact (82-01 backend), which resolves imageUrl server-side.
 */
export interface ForgeArtifactRow {
  path: string;
  kind: string;
  sizeBytes: number;
  /** Text/HTML content for previewable text artifacts (≤ 1 MB). */
  textContent?: string;
  /** Convex File Storage URL for image artifacts (resolved by ctx.storage.getUrl). */
  imageUrl?: string | null;
}

// ---------------------------------------------------------------------------
// Adapter: Convex forgeFiles doc → ForgeFileRow
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function adaptFileEntry(doc: any): ForgeFileRow {
  return {
    id: doc._id,
    path: doc.path,
    kind: doc.kind,
    sizeBytes: doc.sizeBytes,
  };
}

/**
 * Returns file rows for a specific job, ordered asc by path.
 * Returns undefined while the query is loading, [] when empty or args are null.
 *
 * Skip-query pattern: passes "skip" when either hostId or forgeJobId is null
 * (idiomatic Convex conditional-query pattern, mirrors useForgeJobLogs).
 *
 * Phase 80 memoization rule: raw.map(...) allocates a fresh array every render.
 * Without useMemo, a reactive query delivering live file updates would cause
 * referential instability and "Maximum update depth exceeded" under live data.
 * Always wrap .map() output in useMemo([raw]).
 *
 * Note: returns undefined (loading) vs [] (empty or skipped) to allow callers
 * to distinguish the loading state from the genuinely-empty state (mirrors
 * useForgeJobsRaw pattern). Use useForgeJobFiles() for [] coalescing.
 */
export function useForgeJobFilesRaw(
  hostId: string | null,
  forgeJobId: string | null
): ForgeFileRow[] | undefined {
  const raw = useQuery(
    api.forge.listJobFiles,
    hostId && forgeJobId ? { hostId, forgeJobId } : "skip"
  );
  return useMemo(
    () => (raw === undefined ? undefined : raw.map(adaptFileEntry)),
    [raw]
  );
}

/**
 * Returns file rows for a specific job, [] during load (undefined → []).
 * Convenience wrapper over useForgeJobFilesRaw for callers that don't
 * need to distinguish loading from empty.
 */
export function useForgeJobFiles(
  hostId: string | null,
  forgeJobId: string | null
): ForgeFileRow[] {
  return useForgeJobFilesRaw(hostId, forgeJobId) ?? [];
}

/**
 * Returns the artifact for a specific file path within a job.
 * Returns undefined while loading, null if not found, or the artifact row.
 *
 * No useMemo needed — returns a single object (not an array), so referential
 * stability is not a concern for render-loop prevention.
 * Passes "skip" when any of hostId / forgeJobId / path is null/undefined.
 */
export function useForgeJobArtifact(
  hostId: string | null,
  forgeJobId: string | null,
  path: string | null
): ForgeArtifactRow | null | undefined {
  return useQuery(
    api.forge.getJobArtifact,
    hostId && forgeJobId && path ? { hostId, forgeJobId, path } : "skip"
  );
}
