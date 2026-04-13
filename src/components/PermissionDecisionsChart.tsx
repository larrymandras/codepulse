import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FlexBarChart } from "./FlexBarChart";
import InfoTooltip from "./InfoTooltip";

export default function PermissionDecisionsChart() {
  const executions = useQuery(api.toolExecutions.recentExecutions) ?? [];

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
        <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide mb-4">
          Permission Decisions<InfoTooltip text="Tool permission decisions: accept vs reject ratio and breakdown by decision source" />
        </h2>
        <p className="text-sm text-gray-500 py-4 text-center">
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
      <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide mb-4">
        Permission Decisions
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-400 mb-2 text-center">
            Accept vs Reject
          </p>
          <FlexBarChart data={decisionData} height={180} />
        </div>

        <div>
          <p className="text-xs text-gray-400 mb-2 text-center">By Source</p>
          <FlexBarChart data={sourceData} height={180} />
        </div>
      </div>

      <div className="mt-3 text-center text-xs text-gray-500">
        {total} total decisions &middot; {((acceptCount / total) * 100).toFixed(1)}% accepted
      </div>
    </div>
  );
}
