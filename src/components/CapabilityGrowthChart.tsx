import { FlexBarChart } from "./FlexBarChart";
import { useCapabilityGrowth } from "../hooks/useAnalytics";
import InfoTooltip from "./InfoTooltip";

export default function CapabilityGrowthChart() {
  const data = useCapabilityGrowth();

  if (data.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-xs font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">Capability Growth<InfoTooltip text="Growth of registered tools, MCP servers, plugins, and skills over time" /></h2>
        <p className="text-gray-500 text-sm">No capability data yet.</p>
      </div>
    );
  }

  // Sum all capability types per date entry into a single total
  const chartData = data.map((d: any) => ({
    label: d.date,
    value: (d.tools ?? 0) + (d.mcpServers ?? 0) + (d.plugins ?? 0) + (d.skills ?? 0),
  }));

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-xs font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">Capability Growth</h2>
      <FlexBarChart data={chartData} height={300} />
    </div>
  );
}
