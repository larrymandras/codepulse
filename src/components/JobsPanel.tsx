/**
 * JobsPanel — post-hoc mission history board over terminal-state
 * `subagentJobs` rows.
 *
 * Phase 111 (mission board) — D-08/D-09/D-10, subtracting the live-streaming
 * chrome this surface inherited from Phase 168 (background subagents,
 * SC-2/SC-3) but cannot honestly back: `subagentJobs` holds only terminal
 * rows (`runtimeIngest.ts:594-596` never writes `queued`/`running`), so this
 * is a history board, not a live queue. It still composes EntityRow +
 * StatusBadge via useSubagentJobs(), mirroring BlackboardPanel's
 * header/empty-state/list template, and still auto-updates when the Convex
 * query returns a newly-finished mission — that part of Phase 168's design
 * was accurate and is unchanged.
 */

import {
  Clock,
  CheckCircle,
  XCircle,
  Ban,
  ListTodo,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EntityRow } from "./EntityRow";
import StatusBadge from "./StatusBadge";
import { useSubagentJobs, type SubagentJobRow } from "../hooks/useSubagentJobs";

// ── State icon mapping — the three terminal subagentJobs statuses ───────────
// queued/running are absent on purpose: runtimeIngest.ts:594-596 never
// writes them for this table, so every row reaching this panel is already
// terminal. An unmapped status (including "unknown") falls through to the
// <Clock ... /> default at the call site below — do not add a key here.
const stateIcon: Record<string, React.ReactNode> = {
  completed: <CheckCircle className="h-3.5 w-3.5 text-primary/80" />,
  failed: <XCircle className="h-3.5 w-3.5 text-(--status-error)" />,
  cancelled: <Ban className="h-3.5 w-3.5 text-muted-foreground" />,
};

// D-09: subagentJobs.submittedAt/finishedAt are Unix epoch seconds (docs/
// astridr-contract.md sec2.31); Date.now() is ms. The ternary below scales
// a seconds value up to ms while tolerating an already-ms value, so this
// function has exactly one meaning now that D-08 removed the non-terminal
// states — "how long ago this mission finished" — and says so explicitly.
function formatElapsed(job: SubagentJobRow): string {
  const ref = job.finishedAt ?? job.submittedAt;
  if (!ref) return "";
  const refMs = ref < 1e12 ? ref * 1000 : ref; // defensive: tolerate an already-ms value
  const diffMs = Date.now() - refMs;
  const s = Math.floor(diffMs / 1000);
  if (s < 0) return "";
  if (s < 60) return `finished moments ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `finished ${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `finished ${h}h ago`;
  return `finished ${Math.floor(h / 24)}d ago`;
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
        <h2
          id="mission-history-heading"
          className="text-xs font-mono uppercase tracking-widest text-primary flex items-center gap-2"
        >
          MISSION HISTORY
        </h2>
        <Badge variant="outline" className="text-xs font-mono">
          {jobCount} missions
        </Badge>
      </div>

      {jobCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
          <ListTodo className="h-6 w-6 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">No mission history</p>
          <p className="text-sm text-muted-foreground">
            Background missions run via delegate_task(background=True) will appear here once they finish.
          </p>
        </div>
      ) : (
        // WCAG 2.1.1 / axe `scrollable-region-focusable`: a region that scrolls
        // must be reachable by keyboard, or its overflowed content is simply
        // unavailable to anyone not using a pointer. `tabIndex={0}` is the fix.
        //
        // This was NOT caught by the phase's earlier passes because the rule
        // only fires once the live `useSubagentJobs()` subscription returns
        // enough rows to actually overflow `max-h-[280px]` — so the criterion
        // gate failed on roughly half of runs and passed on the rest, against
        // identical code. The defect was constant; only its detection varied.
        //
        // `role="region"` + `aria-labelledby` rather than a bare `aria-label`:
        // aria-label on a role-less div is what raised `aria-prohibited-attr`
        // on /forge (fixed in 123-06), and a focusable region with no
        // accessible name is a worse experience than an unfocusable one.
        // Pointing at the existing <h2> avoids duplicating its text.
        <div
          className="overflow-y-auto max-h-[280px]"
          tabIndex={0}
          role="region"
          aria-labelledby="mission-history-heading"
        >
          {jobs.map((job) => {
            const elapsed = formatElapsed(job);
            return (
              <EntityRow
                key={job.jobId}
                wrapPrimary
                onClick={onSelectJob ? () => onSelectJob(job) : undefined}
                icon={stateIcon[job.status] ?? <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
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
