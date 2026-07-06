/**
 * JobsPanel — live background subagent job list with completion surfacing.
 *
 * Phase 168 (background subagents) — SC-2/SC-3.
 * Composes EntityRow + StatusBadge, live-query-driven via useSubagentJobs(),
 * mirroring BlackboardPanel's header/empty-state/list template. A job that
 * flips to completed/failed/cancelled surfaces its terminal state
 * automatically the next time the live Convex query updates — no manual
 * polling (SC-3).
 */

import {
  Clock,
  Zap,
  CheckCircle,
  XCircle,
  Ban,
  ListTodo,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EntityRow } from "./EntityRow";
import StatusBadge from "./StatusBadge";
import { useSubagentJobs, type SubagentJobRow } from "../hooks/useSubagentJobs";

// ── State icon mapping — covers all five subagentJobs statuses ──────────────
const stateIcon: Record<string, React.ReactNode> = {
  queued: <Clock className="h-3.5 w-3.5 text-muted-foreground/50" />,
  running: <Zap className="h-3.5 w-3.5 text-[#22c55e] animate-pulse" />,
  completed: <CheckCircle className="h-3.5 w-3.5 text-primary/80" />,
  failed: <XCircle className="h-3.5 w-3.5 text-[#ef4444]" />,
  cancelled: <Ban className="h-3.5 w-3.5 text-muted-foreground" />,
};

// Format elapsed time from a seconds-epoch timestamp to a short string.
// subagentJobs.submittedAt/finishedAt are Unix epoch SECONDS (docs/
// astridr-contract.md sec2.31) — no ms conversion needed, unlike swarmTasks.
function formatElapsed(job: SubagentJobRow): string {
  const ref = job.finishedAt ?? job.submittedAt;
  if (!ref) return "";
  const refMs = ref < 1e12 ? ref * 1000 : ref; // defensive: tolerate an already-ms value
  const diffMs = Date.now() - refMs;
  const s = Math.floor(diffMs / 1000);
  if (s < 0) return "";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

interface JobsPanelProps {
  /** Called when a row is clicked, with the job for a detail view. */
  onSelectJob?: (job: SubagentJobRow) => void;
}

export default function JobsPanel({ onSelectJob }: JobsPanelProps) {
  const jobs = useSubagentJobs();
  const jobCount = jobs.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-mono uppercase tracking-widest text-primary flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          BACKGROUND JOBS
        </h2>
        <Badge variant="outline" className="text-xs font-mono">
          {jobCount} jobs
        </Badge>
      </div>

      {jobCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
          <ListTodo className="h-6 w-6 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">No background jobs yet</p>
          <p className="text-sm text-muted-foreground">
            Jobs submitted via delegate_task(background=True) will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-y-auto max-h-[280px]">
          {jobs.map((job) => {
            const elapsed = formatElapsed(job);
            return (
              <EntityRow
                key={job.jobId}
                wrapPrimary
                onClick={onSelectJob ? () => onSelectJob(job) : undefined}
                icon={stateIcon[job.status] ?? <Clock className="h-3.5 w-3.5 text-muted-foreground/50" />}
                primary={job.taskSnippet}
                secondary={
                  job.status === "failed" && job.error
                    ? `${job.agentTypeId} — ${job.error}`
                    : job.agentTypeId
                }
                trailing={
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={job.status} />
                    {elapsed && (
                      <span className="text-xs font-mono text-muted-foreground">{elapsed}</span>
                    )}
                  </div>
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
