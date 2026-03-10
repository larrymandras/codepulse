import { useGithubWorkflowRuns } from "../hooks/useGithubActions";
import InfoTooltip from "./InfoTooltip";

/**
 * GitHub Actions workflow status panel.
 *
 * To feed data into this widget, add a step to your GitHub Actions workflow
 * that POSTs the run result to the CodePulse runtime-ingest endpoint:
 *
 *   - name: Notify CodePulse
 *     if: always()
 *     run: |
 *       curl -sf -X POST "${{ secrets.CODEPULSE_INGEST_URL }}/runtime-ingest" \
 *         -H "Content-Type: application/json" \
 *         -d '{
 *           "eventType": "github_workflow_run",
 *           "data": {
 *             "workflowName": "Asset Repo Sync Check",
 *             "repo": "larrymandras/astridr",
 *             "status": "${{ job.status }}",
 *             "conclusion": "${{ job.status }}",
 *             "runUrl": "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}",
 *             "runId": ${{ github.run_id }},
 *             "triggeredAt": '"$(date +%s)"'
 *           }
 *         }'
 */

function relativeTime(epochSeconds: number): string {
  const now = Date.now() / 1000;
  const diff = now - epochSeconds;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function statusIcon(status: string, conclusion?: string): { icon: string; color: string; spin: boolean } {
  const resolved = conclusion ?? status;
  switch (resolved) {
    case "success":
      return { icon: "\u2705", color: "text-green-400", spin: false };
    case "failure":
      return { icon: "\u274C", color: "text-red-400", spin: false };
    case "in_progress":
      return { icon: "\uD83D\uDD04", color: "text-yellow-400", spin: true };
    case "queued":
      return { icon: "\u23F3", color: "text-gray-400", spin: false };
    default:
      return { icon: "\u2753", color: "text-gray-500", spin: false };
  }
}

function shortRepo(repo: string): string {
  const parts = repo.split("/");
  return parts.length > 1 ? parts[parts.length - 1] : repo;
}

export default function GithubActionsPanel() {
  const runs = useGithubWorkflowRuns();

  const lastRun = runs.length > 0 ? runs[0] : null;
  const lastStatus = lastRun ? (lastRun.conclusion ?? lastRun.status) : null;

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">
        GitHub Actions
        <InfoTooltip text="Workflow run status for automated sync checks and CI/CD pipelines" />
      </h2>

      {/* Summary bar */}
      <div className="flex items-center gap-3 mb-3 text-xs text-gray-400">
        {lastRun ? (
          <>
            <span>
              Last run:{" "}
              <span
                className={
                  lastStatus === "success"
                    ? "text-green-400"
                    : lastStatus === "failure"
                      ? "text-red-400"
                      : "text-yellow-400"
                }
              >
                {lastStatus}
              </span>
            </span>
            <span className="text-gray-600">|</span>
          </>
        ) : null}
        <span>Next check: ~9:17 AM / 5:43 PM UTC</span>
      </div>

      {runs.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-gray-400">No workflow runs recorded yet</p>
          <p className="text-xs text-gray-500 mt-1">
            Runs will appear after the sync-check workflow executes
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {runs.map((run) => {
            const si = statusIcon(run.status, run.conclusion ?? undefined);
            return (
              <div
                key={run._id}
                className="flex items-center justify-between bg-gray-900/50 border border-gray-700/30 rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`text-sm flex-shrink-0 ${si.color} ${si.spin ? "animate-spin" : ""}`}
                  >
                    {si.icon}
                  </span>
                  <span className="text-sm text-gray-200 truncate">
                    {run.workflowName}
                  </span>
                  <span className="text-xs text-gray-500 flex-shrink-0">
                    {shortRepo(run.repo)}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 flex-shrink-0 ml-2">
                  <span className="text-[11px] text-gray-500">
                    {relativeTime(run.triggeredAt)}
                  </span>
                  {run.runUrl && (
                    <a
                      href={run.runUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-blue-400/70 hover:text-blue-300 transition-colors"
                    >
                      View
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
