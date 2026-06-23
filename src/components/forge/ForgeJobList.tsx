/**
 * ForgeJobList — merged newest-first job card list (D-03).
 *
 * Port of forge JobList.tsx with all action controls stripped (D-01):
 * - REMOVED: delete-X button, handleDelete, deleting state
 * - REMOVED: Clear-failed toolbar, handleClearFailed, clearing state
 * - REMOVED: apiFetch import, TERMINAL set, onChanged prop
 *
 * Phase 80 additions:
 * - Clerk-gated "Launch Job" toolbar button (FI-08 — fail-closed UI; rendered
 *   only when isAuthenticated). The real gate is the server mutation (80-01);
 *   this is UI defense-in-depth.
 * - Optimistic "Queued" pending rows above the real jobs (D-10), with a
 *   Failed/Expired destructive flip (D-11) and reconciliation by
 *   resolvedForgeJobId (T-80-13 — no duplicate rows).
 *
 * Selection is keyed on the (hostId, forgeJobId) pair (D-03 — merged multi-host
 * list; forgeJobId is not unique across hosts).
 *
 * Security: prompt / agent rendered as JSX text children only; no dangerouslySetInnerHTML.
 */

import { Bot, Code, Zap, Rocket } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ForgeStatusBadge } from "./ForgeStatusBadge";
import { ForgeHostBadge } from "./ForgeHostBadge";
import { relativeTime } from "@/lib/formatters";
import type { ForgeJobRow, ForgeCommandRow } from "@/hooks/useForge";

/**
 * relativeTime against an ISO createdAt, guarding malformed/empty values.
 * A bad ingest payload (e.g. createdAt="") would otherwise yield NaN epoch
 * seconds and render "NaNd ago"; show an em dash instead.
 */
function safeRelativeTime(iso: string): string {
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? relativeTime(ms / 1000) : "—";
}

// ---------------------------------------------------------------------------
// AgentIcon — ported from forge JobList.tsx; unchanged
// ---------------------------------------------------------------------------

function AgentIcon({ agent }: { agent: string }) {
  switch (agent) {
    case "claude":
      return <Bot className="h-4 w-4 shrink-0" aria-label="Claude Code" />;
    case "codex":
      return <Code className="h-4 w-4 shrink-0" aria-label="Codex" />;
    case "agy":
      return <Zap className="h-4 w-4 shrink-0" aria-label="Antigravity" />;
    default:
      return <Bot className="h-4 w-4 shrink-0" aria-label={agent} />;
  }
}

// ---------------------------------------------------------------------------
// Reconciliation: drop a pending command once its resolvedForgeJobId is set AND
// the matching real forgeJobs row exists (T-80-13 — no duplicate render).
// ---------------------------------------------------------------------------

function visiblePendingRows(
  pendingCommands: ForgeCommandRow[],
  jobs: ForgeJobRow[]
): ForgeCommandRow[] {
  const jobIds = new Set(jobs.map((j) => j.id));
  return pendingCommands.filter(
    (cmd) =>
      !(cmd.resolvedForgeJobId != null && jobIds.has(cmd.resolvedForgeJobId))
  );
}

// ---------------------------------------------------------------------------
// Prop interface — updated for pair selection (D-03) + Phase 80 additions
// ---------------------------------------------------------------------------

interface ForgeJobListProps {
  jobs: ForgeJobRow[];
  /** Merged optimistic + server command rows (ForgePage owns the merge). */
  pendingCommands: ForgeCommandRow[];
  loading: boolean;
  selectedKey: { hostId: string; forgeJobId: string } | null;
  onSelect: (key: { hostId: string; forgeJobId: string }) => void;
  /** Opens ForgeLaunchModal. */
  onLaunchClick: () => void;
  /** Gates the Launch button (Clerk identity present) — fail-closed UI (FI-08). */
  isAuthenticated: boolean;
}

// ---------------------------------------------------------------------------
// PendingRow — optimistic Queued row (D-10) with Failed/Expired flip (D-11)
// ---------------------------------------------------------------------------

function PendingRow({ cmd }: { cmd: ForgeCommandRow }) {
  const isFailed = cmd.status === "failed" || cmd.status === "expired";
  const borderClass = isFailed ? "border-destructive" : "border-primary";
  return (
    <div
      className={`w-full text-left flex items-start gap-2 px-3 py-3 min-h-[72px] border-b border-border border-l-2 ${borderClass}`}
      data-pending-command={cmd.commandId}
    >
      <div className="mt-0.5 text-muted-foreground">
        <AgentIcon agent={cmd.agent ?? "codex"} />
      </div>
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <ForgeStatusBadge status={cmd.status} />
          <ForgeHostBadge hostId={cmd.hostId} />
          {cmd.agent && (
            <span className="text-sm text-muted-foreground capitalize">
              {cmd.agent}
            </span>
          )}
        </div>
        <p className="text-sm text-foreground truncate leading-relaxed">
          {cmd.prompt ?? <span className="text-muted-foreground">—</span>}
        </p>
        {isFailed && cmd.error && (
          <p className="text-sm text-destructive" role="alert">
            {cmd.error}
          </p>
        )}
        <p className="text-sm text-muted-foreground">Just now</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ForgeJobList
// ---------------------------------------------------------------------------

export function ForgeJobList({
  jobs,
  pendingCommands,
  loading,
  selectedKey,
  onSelect,
  onLaunchClick,
  isAuthenticated,
}: ForgeJobListProps) {
  // Reconcile pending rows against the real jobs list (no duplicates — T-80-13).
  const pending = visiblePendingRows(pendingCommands, jobs);

  // Toolbar — Clerk-gated Launch button (fail-closed: hidden when unauthenticated).
  const toolbar = isAuthenticated ? (
    <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
      <Button
        variant="default"
        size="sm"
        onClick={onLaunchClick}
        className="gap-2"
      >
        <Rocket className="h-4 w-4" />
        Launch Job
      </Button>
    </div>
  ) : null;

  // Loading state — 3 skeleton rows with aria-busy (toolbar still shown)
  if (loading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {toolbar}
        <div
          className="flex flex-col gap-2 p-3"
          aria-busy="true"
          aria-label="Loading jobs"
        >
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-2 p-3 rounded-md">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {toolbar}
      <ScrollArea className="flex-1">
        {/* Pending rows — D-10/D-11; announced for screen readers */}
        {pending.length > 0 && (
          <div className="flex flex-col" aria-live="polite">
            {pending.map((cmd) => (
              <PendingRow key={cmd.commandId} cmd={cmd} />
            ))}
          </div>
        )}

        {/* Empty state — only when there are no real jobs AND no pending rows */}
        {jobs.length === 0 && pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 py-8 text-center gap-2">
            <h3 className="text-base font-semibold text-foreground">No jobs yet</h3>
            <p className="text-sm text-muted-foreground">
              Jobs will appear here once the Forge daemon starts syncing.
            </p>
          </div>
        ) : (
          <div className="flex flex-col py-1">
            {jobs.map((job) => {
              // Selection check: both hostId and forgeJobId must match (D-03)
              const isSelected =
                selectedKey?.hostId === job.hostId &&
                selectedKey?.forgeJobId === job.id;

              return (
                <button
                  key={`${job.hostId}:${job.id}`}
                  type="button"
                  onClick={() =>
                    onSelect({ hostId: job.hostId, forgeJobId: job.id })
                  }
                  className={`w-full text-left flex items-start gap-2 px-3 py-3 min-h-[72px] border-b border-border transition-colors hover:bg-accent/50 ${
                    isSelected ? "bg-accent border-l-2 border-primary" : ""
                  }`}
                  aria-selected={isSelected}
                  aria-label={`Job ${job.id}: ${job.agent} — ${job.prompt ?? "(no prompt)"}`}
                >
                  {/* Agent icon */}
                  <div className="mt-0.5 text-muted-foreground">
                    <AgentIcon agent={job.agent} />
                  </div>

                  {/* Card content */}
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    {/* Status badge + host badge + agent name */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <ForgeStatusBadge status={job.status} />
                      <ForgeHostBadge hostId={job.hostId} />
                      <span className="text-sm text-muted-foreground capitalize">
                        {job.agent}
                      </span>
                    </div>

                    {/* Prompt preview (1-line truncated) */}
                    <p className="text-sm text-foreground truncate leading-relaxed">
                      {job.prompt ?? (
                        <span className="text-muted-foreground italic">
                          (no prompt)
                        </span>
                      )}
                    </p>

                    {/* Relative timestamp — epoch seconds (CodePulse relativeTime contract) */}
                    <p className="text-sm text-muted-foreground">
                      {safeRelativeTime(job.createdAt)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
