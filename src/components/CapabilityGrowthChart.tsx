import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useCapabilityGrowth } from "../hooks/useAnalytics";
import InfoTooltip from "./InfoTooltip";

export default function CapabilityGrowthChart() {
  const data = useCapabilityGrowth();

  if (data.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Capability Growth<InfoTooltip text="Growth of registered tools, MCP servers, plugins, and skills over time" /></h2>
        <p className="text-gray-500 text-sm">No capability data yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">Capability Growth</h2>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 11 }} />
          <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1f2937",
              border: "1px solid #374151",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value: any) => [value, undefined]}
          />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          <Area
            type="monotone"
            dataKey="tools"
            stackId="1"
            stroke="#60a5fa"
            fill="#60a5fa"
            fillOpacity={0.3}
            name="Tools"
          />
          <Area
            type="monotone"
            dataKey="mcpServers"
            stackId="1"
            stroke="#a78bfa"
            fill="#a78bfa"
            fillOpacity={0.3}
            name="MCP Servers"
          />
          <Area
            type="monotone"
            dataKey="plugins"
            stackId="1"
            stroke="#34d399"
            fill="#34d399"
            fillOpacity={0.3}
            name="Plugins"
          />
          <Area
            type="monotone"
            dataKey="skills"
            stackId="1"
            stroke="#fbbf24"
            fill="#fbbf24"
            fillOpacity={0.3}
            name="Skills"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
