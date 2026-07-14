/**
 * IntakePanel — optimistic pendingLocal state + live query + row list +
 * Collapsible report expansion for the CodePulse Intake feature (Phase
 * 07-02, CP-06). Owns and mounts IntakeModal internally; Skills.tsx (Task 3)
 * only owns the trivial open/close boolean needed to place the "Validate
 * skill" button in PageHeader (D-P7-01).
 *
 * Reconciliation is simpler than ForgePage's launch/stop pattern (ported
 * from ForgePage.tsx's dedupeByCommandId/pendingLocal shape): there is no
 * second forgeJobs table for intake — a pendingLocal row is dropped once
 * ANY server row shares its commandId, since the server row IS the terminal
 * state for intake.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  RowStatusBadge,
  VerdictBadge,
  DestinationBadge,
} from "@/components/skills/IntakeStatusBadge";
import { IntakeModal } from "@/components/skills/IntakeModal";
import { IntakeReportView } from "@/components/skills/IntakeReportView";
import { useIntakeCommandsRaw } from "@/hooks/useIntake";
import type { IntakeCommandRow } from "@/hooks/useIntake";

/** Display cap applied AFTER merge — pendingLocal rows can transiently push
 * the total above the server's already-20-capped listIntakeCommands result. */
const DISPLAY_LIMIT = 20;

/** Dedupe by commandId — the local optimistic row (listed first) wins. */
function dedupeByCommandId(rows: IntakeCommandRow[]): IntakeCommandRow[] {
  const seen = new Set<string>();
  const out: IntakeCommandRow[] = [];
  for (const row of rows) {
    if (seen.has(row.commandId)) continue;
    seen.add(row.commandId);
    out.push(row);
  }
  return out;
}

/** Formats a millisecond duration as "m:ss" for the queued-row countdown. */
function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Strips the github.com host prefix for a compact row label (Claude's Discretion, CONTEXT.md grant). */
function extractRepoLabel(url: string): string {
  return url.replace(/^https?:\/\/github\.com\//, "");
}

interface IntakePanelProps {
  modalOpen: boolean;
  onModalOpenChange: (open: boolean) => void;
}

export function IntakePanel({
  modalOpen,
  onModalOpenChange,
}: IntakePanelProps) {
  // Distinguish "still loading" (undefined) from "no commands yet" ([]) so
  // the panel can show Skeleton rows instead of the empty-state copy (WR-01).
  // Deliberately NOT the coalescing useIntakeCommands() — that would collapse
  // this distinction.
  const raw = useIntakeCommandsRaw();
  const isLoading = raw === undefined;
  // Stable identity: raw ?? [] would allocate a fresh [] every render while
  // loading, churning the reconciliation effect below (deps [serverCommands])
  // into an infinite update loop (mirrors ForgePage.tsx's own documented
  // caution for the identical raw ?? [] pattern).
  const serverCommands = useMemo(() => raw ?? [], [raw]);

  const [pendingLocal, setPendingLocal] = useState<IntakeCommandRow[]>([]);

  // Session-scoped commandId -> fileName memory. Server rows always carry
  // fileName: null (07-01's documented client-only contract), so once the
  // reconciliation effect below drops the optimistic row, an upload row's
  // label would fall through to "Unknown" (UI-SPEC line 158 violation).
  // A ref is sufficient: the label render is driven by serverCommands/
  // pendingLocal state changes, and the ref is always written before the
  // setPendingLocal render that first paints the row. After a page reload
  // the filename is legitimately unknown — this memory is session-scoped
  // by design, never round-tripped through Convex.
  const fileNameMemory = useRef<Record<string, string>>({});

  const handleEnqueued = (row: IntakeCommandRow) => {
    if (row.fileName !== null) {
      fileNameMemory.current[row.commandId] = row.fileName;
    }
    setPendingLocal((prev) => [row, ...prev]);
  };

  const handleEnqueueFailed = (commandId: string, message: string) =>
    setPendingLocal((prev) =>
      prev.map((r) =>
        r.commandId === commandId
          ? { ...r, status: "failed" as const, error: message }
          : r
      )
    );

  // Simplified reconciliation (no second jobs table — see module docstring):
  // drop a pendingLocal row once ANY server row shares its commandId.
  useEffect(() => {
    setPendingLocal((prev) =>
      prev.filter(
        (r) => !serverCommands.some((s) => s.commandId === r.commandId)
      )
    );
  }, [serverCommands]);

  const mergedRows = dedupeByCommandId([
    ...pendingLocal,
    ...serverCommands,
  ]).slice(0, DISPLAY_LIMIT);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Shared per-second tick for the queued countdown — a single timer, not N
  // independent per-row timers.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h2 className="text-lg font-semibold">Intake</h2>

      {isLoading && mergedRows.length === 0 && (
        <div className="flex flex-col gap-2 mt-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {!isLoading && mergedRows.length === 0 && (
        <div className="mt-4">
          <p className="text-base font-medium">No intake commands yet</p>
          <p className="text-sm text-muted-foreground">
            Drop a SKILL.md or paste a GitHub URL with &quot;Validate
            skill&quot; — reports appear here.
          </p>
        </div>
      )}

      {mergedRows.length > 0 && (
        <div className="flex flex-col gap-2 mt-4">
          {mergedRows.map((row) => {
            const label =
              row.fileName ??
              fileNameMemory.current[row.commandId] ??
              (row.githubUrl
                ? `${extractRepoLabel(row.githubUrl)}${
                    row.subpath ? " " + row.subpath : ""
                  }`
                : "Unknown");
            const isDone = row.status === "done";
            const isQueued = row.status === "queued";
            // Runtime-guaranteed by the isDone check above; RowStatusBadge's
            // status prop is typed Exclude<IntakeRowStatus, "done"> so a
            // "done" row can never render it (Plan 07-01 compile-time guard).
            const nonDoneStatus = row.status as Exclude<
              IntakeCommandRow["status"],
              "done"
            >;

            const chip = isDone ? (
              <VerdictBadge
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                verdict={(row.report as any)?.verdict ?? "error"}
              />
            ) : isQueued ? (
              // A per-second live region is hostile to screen readers — the
              // countdown text overrides the outer aria-live="polite" chip
              // container with aria-live="off" (locked accessibility contract).
              <span aria-live="off">
                <RowStatusBadge
                  status={nonDoneStatus}
                  countdownLabel={`Expires in ${formatCountdown(
                    row.expiresAt - now
                  )}`}
                />
              </span>
            ) : (
              <RowStatusBadge status={nonDoneStatus} />
            );

            const rowContent = (
              <div className="flex items-center gap-3 py-2">
                <span aria-live="polite">{chip}</span>
                <span className="text-sm flex-1">{label}</span>
                <DestinationBadge destination={row.destination ?? "global"} />
                <span className="text-xs text-muted-foreground">
                  {new Date(row.createdAt).toLocaleTimeString()}
                </span>
                {isDone && (
                  <span className="text-muted-foreground" aria-hidden="true">
                    {expandedId === row.commandId ? "▾" : "▸"}
                  </span>
                )}
              </div>
            );

            return (
              <div
                key={row.commandId}
                className="border-b border-border last:border-b-0"
              >
                {isDone ? (
                  <Collapsible
                    open={expandedId === row.commandId}
                    onOpenChange={(open) =>
                      setExpandedId(open ? row.commandId : null)
                    }
                  >
                    <CollapsibleTrigger asChild>
                      <button type="button" className="w-full text-left">
                        {rowContent}
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <IntakeReportView row={row} />
                    </CollapsibleContent>
                  </Collapsible>
                ) : (
                  rowContent
                )}

                {row.status === "expired" && (
                  <div className="pb-2">
                    <p className="text-sm text-foreground">
                      Expired — no daemon claimed this command.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Intake execution ships with the Forge daemon (Phase 8).
                    </p>
                  </div>
                )}

                {row.status === "failed" && (
                  <p className="text-sm text-foreground pb-2">
                    Failed: {row.error}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <IntakeModal
        open={modalOpen}
        onClose={() => onModalOpenChange(false)}
        onEnqueued={handleEnqueued}
        onEnqueueFailed={handleEnqueueFailed}
      />
    </div>
  );
}
