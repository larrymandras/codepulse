import { useToolFlowSankey } from "../hooks/useAdvancedAnalytics";
import InfoTooltip from "./InfoTooltip";

export default function SankeyFlow() {
  const { nodes, links } = useToolFlowSankey();

  if (nodes.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Tool Flow<InfoTooltip text="Tool execution flow from event sources through tools to outcomes (success, error, human-in-the-loop)" /></h2>
        <p className="text-gray-500 text-sm">No data yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">Tool Flow<InfoTooltip text="Tool execution flow from event sources through tools to outcomes (success, error, human-in-the-loop)" /></h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2 pr-3 font-medium">From</th>
              <th className="text-left py-2 px-3 font-medium">To</th>
              <th className="text-right py-2 pl-3 font-medium">Volume</th>
            </tr>
          </thead>
          <tbody>
            {links.map((link: any, i: number) => {
              const sourceName = nodes[link.source]?.name ?? String(link.source);
              const targetName = nodes[link.target]?.name ?? String(link.target);
              return (
                <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                  <td className="py-2 pr-3 text-gray-300">{sourceName}</td>
                  <td className="py-2 px-3 text-gray-300">{targetName}</td>
                  <td className="py-2 pl-3 text-right text-gray-400">{link.value}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
