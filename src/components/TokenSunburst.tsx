import { useState } from "react";
import { useTokenSunburst } from "../hooks/useAdvancedAnalytics";
import InfoTooltip from "./InfoTooltip";

export default function TokenSunburst() {
  const { tree, totalCost, totalTokens } = useTokenSunburst();
  const [drillNode, setDrillNode] = useState<any>(null);

  const displayTree = drillNode ?? tree;

  if (!tree.children || tree.children.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-sm font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">Token Distribution<InfoTooltip text="Token distribution by provider and model — click a provider to drill down" /></h2>
        <p className="text-gray-500 text-base">No data yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-300">Token Distribution<InfoTooltip text="Token distribution by provider and model — click a provider to drill down" /></h2>
        {drillNode && (
          <button
            onClick={() => setDrillNode(null)}
            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Reset
          </button>
        )}
      </div>

      <div className="mb-3 flex gap-4 text-base">
        <div className="bg-gray-900/50 rounded-lg px-3 py-2 text-center">
          <p className="text-sm text-gray-400">Total Cost</p>
          <p className="font-bold text-gray-100">${totalCost.toFixed(4)}</p>
        </div>
        <div className="bg-gray-900/50 rounded-lg px-3 py-2 text-center">
          <p className="text-sm text-gray-400">Total Tokens</p>
          <p className="font-bold text-gray-100">{totalTokens.toLocaleString()}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-base">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2 pr-3 font-medium">Provider / Model</th>
              <th className="text-right py-2 pl-3 font-medium">Tokens</th>
            </tr>
          </thead>
          <tbody>
            {(displayTree.children ?? []).map((provider: any) => (
              <>
                <tr
                  key={provider.name}
                  className="border-b border-gray-700/50 hover:bg-gray-700/20 cursor-pointer"
                  onClick={() =>
                    provider.children?.length > 0
                      ? setDrillNode(provider)
                      : undefined
                  }
                >
                  <td className="py-2 pr-3 text-gray-200 font-semibold">
                    {provider.name}
                    {provider.children?.length > 0 && (
                      <span className="ml-1 text-xs text-indigo-400">&#9658;</span>
                    )}
                  </td>
                  <td className="py-2 pl-3 text-right text-gray-300">
                    {(provider.value ?? 0).toLocaleString()}
                  </td>
                </tr>
                {!drillNode &&
                  (provider.children ?? []).map((model: any) => (
                    <tr key={`${provider.name}-${model.name}`} className="border-b border-gray-700/30">
                      <td className="py-1.5 pr-3 pl-6 text-gray-400 text-sm font-mono">{model.name}</td>
                      <td className="py-1.5 pl-3 text-right text-gray-500 text-sm">
                        {(model.value ?? 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
