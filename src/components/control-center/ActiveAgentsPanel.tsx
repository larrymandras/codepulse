/**
 * ActiveAgentsPanel — panel (b), Phase 188 Plan 10 (D-18).
 *
 * Renders currently-running background sub-agent jobs as a compact
 * horizontal-scroll tile row, in the shared `ControlCenterPanel` chrome.
 *
 * Hook choice (documented per this plan's Task 2 tie-breaker instruction —
 * "if more than one hook is involved, prefer the single one that most
 * directly answers 'which sub-agents are running right now'"):
 * `HivePage.tsx` itself only calls `useGoalList()` directly; its child
 * `SwarmGraph`/`BlackboardPanel` regions consume `useSwarmGraph(goalId)`,
 * which is GOAL-scoped (renders empty with no goal selected, or when the
 * newest goal has already completed) and whose rows carry no agent
 * name/identity — only a raw `agentId` string, unsuitable for a
 * "reuse AgentCard's visual language" tile. `useSubagentJobs()` is
 * 188-UI-SPEC's OTHER explicitly-named source for this exact panel
 * ("delegate_task/subagent_jobs/war-room swarm telemetry" — panel table
 * row (b)) and is goal-independent, always live, and answers "which
 * sub-agents are running right now" directly via `status === "running"` +
 * `agentTypeId` — chosen over `useSwarmGraph` for that reason. Zero new
 * backend query: reuses `api.subagentJobs.listRecent` (the SAME query
 * `JobsPanel.tsx` already issues), no args.
 *
 * `useSubagentJobs()` already defaults to `[]` internally (never returns
 * `undefined`), so this panel never crashes while the query is loading
 * (T-188-43).
 *
 * @see 188-UI-SPEC.md panel table row (b)
 */
import { Users, Zap } from "lucide-react";
import { useSubagentJobs } from "@/hooks/useSubagentJobs";

export function ActiveAgentsPanel() {
  const jobs = useSubagentJobs();
  const activeJobs = jobs.filter((job) => job.status === "running");

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-md p-5 flex flex-col gap-3 min-w-[240px]">
      <span className="font-mono text-sm tracking-[0.1em] text-muted-foreground flex items-center gap-2">
        <Users className="w-4 h-4" aria-hidden="true" />
        ACTIVE AGENTS
      </span>

      {activeJobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No agents running.</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto max-h-32">
          {activeJobs.map((job) => (
            <div
              key={job.jobId}
              data-testid="agent-tile"
              className="shrink-0 w-40 rounded-lg border border-border/50 bg-card/40 p-3 flex flex-col gap-1"
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground truncate">
                <Zap
                  className="w-3.5 h-3.5 text-(--status-ok) animate-pulse shrink-0"
                  aria-hidden="true"
                />
                {job.agentTypeId}
              </span>
              <span className="text-sm text-muted-foreground line-clamp-2">
                {job.taskSnippet}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ActiveAgentsPanel;
