import { Sankey, Tooltip, ResponsiveContainer, Layer, Rectangle } from "recharts";
import { useToolFlowSankey } from "../hooks/useAdvancedAnalytics";

const NODE_COLORS: Record<string, string> = {
  "Tool Use": "#a78bfa",
  LLM: "#a78bfa",
  "File Ops": "#a78bfa",
  Agents: "#a78bfa",
  Other: "#a78bfa",
  Success: "#34d399",
  Error: "#f87171",
  HITL: "#fbbf24",
};

function getNodeColor(name: string): string {
  return NODE_COLORS[name] ?? "#60a5fa";
}

function CustomNode({ x, y, width, height, payload }: any) {
  return (
    <Layer>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={getNodeColor(payload.name)}
        fillOpacity={0.9}
        radius={[4, 4, 4, 4]}
      />
      {height > 14 && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#fff"
          fontSize={10}
        >
          {payload.name}
        </text>
      )}
    </Layer>
  );
}

function CustomLink({ sourceX, sourceY, sourceControlX, targetX, targetY, targetControlX, linkWidth, payload }: any) {
  return (
    <path
      d={`M${sourceX},${sourceY}C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      fill="none"
      stroke="#818cf8"
      strokeOpacity={0.3}
      strokeWidth={Math.max(linkWidth, 1)}
    />
  );
}

export default function SankeyFlow() {
  const { nodes, links } = useToolFlowSankey();

  if (nodes.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Tool Flow (Sankey)</h2>
        <p className="text-gray-500 text-sm">No data yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">Tool Flow (Sankey)</h2>
      <ResponsiveContainer width="100%" height={350}>
        <Sankey
          data={{ nodes, links }}
          node={<CustomNode />}
          link={<CustomLink />}
          nodePadding={24}
          nodeWidth={12}
          margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
        >
          <Tooltip
            contentStyle={{
              backgroundColor: "#1f2937",
              border: "1px solid #374151",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
        </Sankey>
      </ResponsiveContainer>
    </div>
  );
}
