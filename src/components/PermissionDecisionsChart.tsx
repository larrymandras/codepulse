import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const COLORS = {
  accept: "#34d399",
  reject: "#f87171",
  config: "#818cf8",
  hook: "#fbbf24",
  user: "#60a5fa",
};

export default function PermissionDecisionsChart() {
  const executions = useQuery(api.toolExecutions.recentExecutions) ?? [];

  // Aggregate accept vs reject
  let acceptCount = 0;
  let rejectCount = 0;
  const bySource: Record<string, { accept: number; reject: number }> = {};

  for (const exec of executions) {
    const decision = (exec as any).decision;
    const source = (exec as any).decisionSource ?? "unknown";
    if (decision === "accept") acceptCount++;
    else if (decision === "reject") rejectCount++;

    if (decision) {
      if (!bySource[source]) bySource[source] = { accept: 0, reject: 0 };
      if (decision === "accept") bySource[source].accept++;
      else bySource[source].reject++;
    }
  }

  const total = acceptCount + rejectCount;

  if (total === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide mb-4">
          Permission Decisions
        </h2>
        <p className="text-sm text-gray-500 py-4 text-center">
          No permission decision data yet
        </p>
      </div>
    );
  }

  const decisionData = [
    { name: "Accept", value: acceptCount },
    { name: "Reject", value: rejectCount },
  ].filter((d) => d.value > 0);

  const sourceData = Object.entries(bySource).map(([source, counts]) => ({
    name: source,
    value: counts.accept + counts.reject,
  }));

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide mb-4">
        Permission Decisions
      </h2>

      <div className="grid grid-cols-2 gap-4">
        {/* Accept vs Reject pie */}
        <div>
          <p className="text-xs text-gray-400 mb-2 text-center">
            Accept vs Reject
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={decisionData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={65}
                dataKey="value"
                stroke="none"
              >
                {decisionData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={
                      entry.name === "Accept"
                        ? COLORS.accept
                        : COLORS.reject
                    }
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Breakdown by source */}
        <div>
          <p className="text-xs text-gray-400 mb-2 text-center">By Source</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={sourceData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={65}
                dataKey="value"
                stroke="none"
              >
                {sourceData.map((entry, idx) => (
                  <Cell
                    key={entry.name}
                    fill={
                      (COLORS as Record<string, string>)[entry.name] ??
                      ["#818cf8", "#fbbf24", "#60a5fa", "#a78bfa", "#f472b6"][
                        idx % 5
                      ]
                    }
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-3 text-center text-xs text-gray-500">
        {total} total decisions &middot; {((acceptCount / total) * 100).toFixed(1)}% accepted
      </div>
    </div>
  );
}
