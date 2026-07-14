import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

// ---------------------------------------------------------------------------
// Local type definitions — mirrors useForge.ts's local-type convention (do
// NOT import from forge's @/types alias).
// ---------------------------------------------------------------------------

export type IntakeDestination = "global" | "project" | "cold";

// "pending" is exclusively a client-fabricated pre-round-trip value — never
// returned by mapIntakeStatus, only ever set directly by Plan 07-02's
// IntakeModal when it builds the optimistic row before awaiting enqueueIntake.
export type IntakeRowStatus =
  | "pending"
  | "queued"
  | "executing"
  | "done"
  | "failed"
  | "expired";

// ---------------------------------------------------------------------------
// IntakeCommandRow: Convex forgeCommands doc (commandType="intake") adapted
// to CodePulse's component contract. Unlike ForgeCommandRow (launch/stop,
// two-table reconciliation), intake's terminal state lives on this row
// itself — status: "done" plus `report` IS the terminal state.
// ---------------------------------------------------------------------------

export interface IntakeCommandRow {
  commandId: string;
  status: IntakeRowStatus;
  hostId: string;
  destination: IntakeDestination | null;
  workspaceId: string | null;
  storageId: string | null;
  githubUrl: string | null;
  subpath: string | null;
  /**
   * Client-only convenience field — server rows never carry an original
   * filename. Only ever set by a client-built optimistic row before the
   * round-trip; adaptIntakeCommand always sets this to null.
   */
  fileName: string | null;
  report: unknown;
  error: string | null;
  createdAt: number;
  expiresAt: number;
}

// ---------------------------------------------------------------------------
// mapIntakeStatus: unlike useForge.ts's mapCommandStatus (which collapses
// queued|executing|done into "pending" because the real terminal state lives
// in a separate forgeJobs table), intake has no second table — pass every
// known raw status through UNCHANGED. Never collapse "done" into anything
// else. Defensive fallback for an unexpected raw value, never throws.
// ---------------------------------------------------------------------------

export function mapIntakeStatus(raw: string): IntakeRowStatus {
  switch (raw) {
    case "queued":
      return "queued";
    case "executing":
      return "executing";
    case "done":
      return "done";
    case "failed":
      return "failed";
    case "expired":
      return "expired";
    default:
      return "queued";
  }
}

// ---------------------------------------------------------------------------
// Adapter: Convex forgeCommands doc (commandType="intake") → IntakeCommandRow
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function adaptIntakeCommand(doc: any): IntakeCommandRow {
  const payload = doc.intakePayload ?? null;
  return {
    commandId: doc.commandId,
    status: mapIntakeStatus(doc.status),
    hostId: doc.hostId,
    destination: (payload?.destination as IntakeDestination | undefined) ?? null,
    workspaceId: payload?.workspaceId ?? null,
    storageId: payload?.storageId ?? null,
    githubUrl: payload?.githubUrl ?? null,
    subpath: payload?.subpath ?? null,
    fileName: null,
    report: doc.report ?? null,
    error: doc.error ?? null,
    createdAt: doc.createdAt,
    expiresAt: doc.expiresAt,
  };
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Returns the pre-coalesce value so callers can distinguish loading
 * (undefined) from empty ([]). Mirrors useForgeHostsRaw's convention.
 *
 * The useMemo wrap is mandatory (07-RESEARCH.md Pattern 4 / useForge.ts's own
 * repeated comments): an unmemoized .map() allocates a fresh array identity
 * every render, and any useEffect depending on it (Plan 07-02's
 * reconciliation effect) loops into "Maximum update depth exceeded" against
 * live Convex data — invisible against a test's stable-reference mock, only
 * surfaces in the real app.
 */
export function useIntakeCommandsRaw(): IntakeCommandRow[] | undefined {
  const raw = useQuery(api.forge.listIntakeCommands, {});
  return useMemo(
    () => (raw === undefined ? undefined : raw.map(adaptIntakeCommand)),
    [raw]
  );
}

// Module-level, stable identity — mirrors useForge.ts's EMPTY_HOSTS constant.
// Do NOT inline `?? []` in useIntakeCommands: that allocates a fresh
// empty-array identity every render, defeating the same memoization
// discipline useIntakeCommandsRaw relies on.
export const EMPTY_INTAKE_ROWS: IntakeCommandRow[] = [];

/**
 * Returns the adapted, newest-first list of intake commands, [] during load.
 * Use useIntakeCommandsRaw when you need to distinguish loading from empty.
 */
export function useIntakeCommands(): IntakeCommandRow[] {
  return useIntakeCommandsRaw() ?? EMPTY_INTAKE_ROWS;
}
