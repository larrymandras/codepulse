/**
 * ForgeJobList — merged newest-first job card list (D-03).
 *
 * Port of forge JobList.tsx with all action controls stripped (D-01):
 * - REMOVED: delete-X button, handleDelete, deleting state
 * - REMOVED: Clear-failed toolbar, handleClearFailed, clearing state
 * - REMOVED: apiFetch import, TERMINAL set, onChanged prop
 *
 * Selection is keyed on the (hostId, forgeJobId) pair (D-03 — merged multi-host
 * list; forgeJobId is not unique across hosts).
 *
 * Empty state: neutral "No jobs yet" copy (D-04 — no launch line).
 *
 * Security: prompt / agent rendered as JSX text children only; no dangerouslySetInnerHTML.
 */

import { Bot, Code, Zap } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ForgeStatusBadge } from "./ForgeStatusBadge";
import { ForgeHostBadge } from "./ForgeHostBadge";
import { relativeTime } from "@/lib/formatters";
import type { ForgeJobRow } from "@/hooks/useForge";

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
// Prop interface — updated for pair selection (D-03)
// ---------------------------------------------------------------------------

interface ForgeJobListProps {
  jobs: ForgeJobRow[];
  loading: boolean;
  selectedKey: { hostId: string; forgeJobId: string } | null;
  onSelect: (key: { hostId: string; forgeJobId: string }) => void;
}

// ---------------------------------------------------------------------------
// ForgeJobList
// ---------------------------------------------------------------------------

export function ForgeJobList({
  jobs,
  loading,
  selectedKey,
  onSelect,
}: ForgeJobListProps) {
  // Loading state — 3 skeleton rows with aria-busy
  if (loading) {
    return (
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
    );
  }

  // Empty state — D-04: neutral copy, no launch line
  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 py-8 text-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">No jobs yet</h3>
        <p className="text-xs text-muted-foreground">
          Jobs will appear here once the Forge daemon starts syncing.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ScrollArea className="flex-1">
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
                onClick={() => onSelect({ hostId: job.hostId, forgeJobId: job.id })}
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
                    <span className="text-xs text-muted-foreground capitalize">
                      {job.agent}
                    </span>
                  </div>

                  {/* Prompt preview (1-line truncated) */}
                  <p className="text-xs text-foreground truncate leading-relaxed">
                    {job.prompt ?? (
                      <span className="text-muted-foreground italic">
                        (no prompt)
                      </span>
                    )}
                  </p>

                  {/* Relative timestamp — epoch seconds (CodePulse relativeTime contract) */}
                  <p className="text-xs text-muted-foreground">
                    {relativeTime(new Date(job.createdAt).getTime() / 1000)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
