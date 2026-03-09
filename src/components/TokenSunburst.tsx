import { useState } from "react";
import { SunburstChart, ResponsiveContainer, Tooltip } from "recharts";
import { useTokenSunburst } from "../hooks/useAdvancedAnalytics";

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "#a78bfa",
  openai: "#34d399",
  google: "#60a5fa",
  ollama: "#f97316",
};

function assignColors(node: any, depth = 0, parentColor?: string): any {
  const color =
    depth === 0
      ? "#6366f1"
      : depth === 1
        ? PROVIDER_COLORS[node.name?.toLowerCase()] ?? "#8b5cf6"
        : parentColor ?? "#94a3b8";

  if (node.children) {
    return {
      ...node,
      fill: color,
      children: node.children.map((c: any) => assignColors(c, depth + 1, color)),
    };
  }
  return { ...node, fill: color };
}

export default function TokenSunburst() {
  const { tree, totalCost, totalTokens } = useTokenSunburst();
  const [drillNode, setDrillNode] = useState<any>(null);

  const displayTree = drillNode ?? tree;
  const coloredTree = assignColors(displayTree);

  if (!tree.children || tree.children.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Token Distribution (Sunburst)</h2>
        <p className="text-gray-500 text-sm">No data yet.</p>
      </div>
    );
  }

  const handleClick = (node: any) => {
    if (node?.children && node.children.length > 0) {
      setDrillNode(node);
    }
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-300">Token Distribution (Sunburst)</h2>
        {drillNode && (
          <button
            onClick={() => setDrillNode(null)}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Reset
          </button>
        )}
      </div>
      <div className="relative">
        <ResponsiveContainer width="100%" height={350}>
          <SunburstChart data={coloredTree} onClick={handleClick}>
            <Tooltip
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value: any, name: any) => [
                typeof value === "number" ? value.toLocaleString() + " tokens" : value,
                name,
              ]}
            />
          </SunburstChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-lg font-bold text-gray-100">
              ${totalCost.toFixed(4)}
            </div>
            <div className="text-xs text-gray-400">
              {totalTokens.toLocaleString()} tokens
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
