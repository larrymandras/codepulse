import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { type IntakeRowStatus, mapIntakeStatus } from "./useIntake";

// ---------------------------------------------------------------------------
// Local type definitions — sibling of useIntake.ts (Phase 98, LIFE-06). The
// status enum is REUSED, not redefined: IntakeRowStatus already covers every
// state a lifecycle command row can be in (pending/queued/executing/done/
// failed/expired), and mapIntakeStatus's defensive fallback ("queued" for any
// unrecognized raw value) applies identically here — lifecycle rows ride the
// exact same forgeCommands queue/TTL/expiry machinery as intake rows.
// ---------------------------------------------------------------------------

export type LifecycleAction = "archive" | "restore" | "move" | "delete";

export type LifecycleDestination = "global" | "project" | "cold";

/**
 * mapLifecycleStatus is mapIntakeStatus under a lifecycle-specific name —
 * same switch, same defensive fallback (never throws). Kept as a distinct
 * export (rather than re-exporting mapIntakeStatus directly) so lifecycle
 * call sites read as lifecycle-domain code, not a leaked intake dependency.
 */
export function mapLifecycleStatus(raw: string): IntakeRowStatus {
  return mapIntakeStatus(raw);
}

// ---------------------------------------------------------------------------
// LifecycleCommandRow: Convex forgeCommands doc (commandType="lifecycle")
// adapted to CodePulse's component contract. Unlike IntakeCommandRow,
// skillName + action are MANDATORY (lifecycle always acts on an existing
// named skill) — this is the (skillName, action) key SkillRow/ColdStorageView
// use to look up "is there an in-flight command for me" (Plan 98-04).
// ---------------------------------------------------------------------------

export interface LifecycleCommandRow {
  commandId: string;
  status: IntakeRowStatus;
  skillName: string;
  action: LifecycleAction;
  sourceOrigin: string | null;
  destination: LifecycleDestination | null;
  workspaceId: string | null;
  error: string | null;
  createdAt: number;
  expiresAt: number;
}

// ---------------------------------------------------------------------------
// Adapter: Convex forgeCommands doc (commandType="lifecycle") ->
// LifecycleCommandRow. Reads doc.lifecyclePayload (Plan 98-01 schema:
// { action, skillName, sourceOrigin, destination, workspaceId }). Never
// throws on a malformed/null payload — every payload-derived field resolves
// to null/undefined-safe defaults, mirroring adaptIntakeCommand's discipline.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function adaptLifecycleCommand(doc: any): LifecycleCommandRow {
  const payload = doc.lifecyclePayload ?? null;
  return {
    commandId: doc.commandId,
    status: mapLifecycleStatus(doc.status),
    skillName: payload?.skillName ?? "",
    action: (payload?.action as LifecycleAction | undefined) ?? "archive",
    sourceOrigin: payload?.sourceOrigin ?? null,
    destination: (payload?.destination as LifecycleDestination | undefined) ?? null,
    workspaceId: payload?.workspaceId ?? null,
    error: doc.error ?? null,
    createdAt: doc.createdAt,
    expiresAt: doc.expiresAt,
  };
}

// ---------------------------------------------------------------------------
// LAYER-1 refusal message extraction (98-REVIEW CR-03). enqueueLifecycle
// deliberately THROWS before any row is inserted on a preflight refusal, so
// no forgeCommands doc (and no badge) ever exists — the rejection itself is
// the only signal. Callers catch it and toast this message. The thrown
// message may carry the internal `lifecycle-refused:<kind>:<raw>` token
// (possibly wrapped in Convex's own error prefix) — never leak the token to
// the user; surface only the raw human-readable reason.
// ---------------------------------------------------------------------------

export function lifecycleRefusalMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const match = /lifecycle-refused:[^:]+:([\s\S]+)/.exec(raw);
  const message = (match ? match[1] : raw).split("\n")[0].trim();
  return message || "Lifecycle command failed";
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Returns the pre-coalesce value so callers can distinguish loading
 * (undefined) from empty ([]). Mirrors useIntakeCommandsRaw's convention.
 *
 * The useMemo wrap is MANDATORY (same discipline as useIntakeCommandsRaw): an
 * unmemoized .map() allocates a fresh array identity every render, and any
 * effect depending on it loops into "Maximum update depth exceeded" against
 * live Convex data — invisible against a test's stable-reference mock, only
 * surfaces in the real app.
 */
export function useLifecycleCommandsRaw(): LifecycleCommandRow[] | undefined {
  const raw = useQuery(api.forge.listLifecycleCommands, {});
  return useMemo(
    () => (raw === undefined ? undefined : raw.map(adaptLifecycleCommand)),
    [raw]
  );
}

// Module-level, stable identity — mirrors EMPTY_INTAKE_ROWS. Do NOT inline
// `?? []` in useLifecycleCommands: that allocates a fresh empty-array
// identity every render, defeating the memoization discipline above.
export const EMPTY_LIFECYCLE_ROWS: LifecycleCommandRow[] = [];

/**
 * Returns the adapted, newest-first list of lifecycle commands, [] during
 * load. Use useLifecycleCommandsRaw when you need to distinguish loading
 * from empty.
 */
export function useLifecycleCommands(): LifecycleCommandRow[] {
  return useLifecycleCommandsRaw() ?? EMPTY_LIFECYCLE_ROWS;
}

/**
 * Resolves the newest in-flight (or terminal) lifecycle command row for a
 * given skill name, or null if none exists. "Newest" is determined by
 * createdAt (not list order) so callers don't depend on the query's own
 * ordering guarantee. Used by SkillRow/ColdStorageView (Plan 98-04) to
 * render a per-row status badge for an in-flight command.
 */
export function latestLifecycleForSkill(
  rows: LifecycleCommandRow[],
  skillName: string
): LifecycleCommandRow | null {
  let latest: LifecycleCommandRow | null = null;
  for (const row of rows) {
    if (row.skillName !== skillName) continue;
    if (latest === null || row.createdAt > latest.createdAt) {
      latest = row;
    }
  }
  return latest;
}
