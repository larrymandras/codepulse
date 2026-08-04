import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FlexBarChart } from "./FlexBarChart";
import InfoTooltip from "./InfoTooltip";

export default function PermissionDecisionsChart() {
  // D-15/D-02: exclude Ástríðr rows — this panel is the operator's own Claude
  // Code session view; Ástríðr's own tool activity lives on the /tools page.
  const executions =
    useQuery(api.toolExecutions.recentExecutions, {
      excludeProvider: "astridr",
    }) ?? [];

  let acceptCount = 0;
  let rejectCount = 0;
  const bySource: Record<string, number> = {};

  for (const exec of executions) {
    const decision = (exec as any).decision;
    const source = (exec as any).decisionSource ?? "unknown";
    if (decision === "accept") acceptCount++;
    else if (decision === "reject") rejectCount++;

    if (decision) {
      bySource[source] = (bySource[source] ?? 0) + 1;
    }
  }

  const total = acceptCount + rejectCount;

  if (total === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
        <h2 className="text-base font-semibold text-gray-200 uppercase tracking-wide mb-4">
          Permission Decisions<InfoTooltip text="Tool permission decisions: accept vs reject ratio and breakdown by decision source" />
        </h2>
        <p className="text-base text-gray-500 py-4 text-center">
          No permission decision data yet
        </p>
      </div>
    );
  }

  const decisionData = [
    { label: "Accept", value: acceptCount },
    { label: "Reject", value: rejectCount },
  ].filter((d) => d.value > 0);

  const sourceData = Object.entries(bySource).map(([label, value]) => ({ label, value }));

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
      <h2 className="text-base font-semibold text-gray-200 uppercase tracking-wide">
        Permission Decisions
      </h2>
        <Link to="/tools" className="text-primary text-xs font-mono tracking-widest uppercase hover:underline">View in Tools →</Link>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-400 mb-2 text-center">
            Accept vs Reject
          </p>
          <FlexBarChart data={decisionData} height={180} />
        </div>

        <div>
          <p className="text-sm text-gray-400 mb-2 text-center">By Source</p>
          <FlexBarChart data={sourceData} height={180} />
        </div>
      </div>

      <div className="mt-3 text-center text-sm text-gray-500">
        {total} total decisions &middot; {((acceptCount / total) * 100).toFixed(1)}% accepted
      </div>
    </div>
  );
}
