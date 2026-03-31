import { memo } from "react";
import { useProviderHealth } from "../hooks/useProviderHealth";
import Sparkline from "./Sparkline";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

const stateConfig: Record<string, { dot: string; label: string }> = {
  closed: { dot: "bg-green-500", label: "closed (ok)" },
  half_open: { dot: "bg-yellow-500", label: "half_open" },
  open: { dot: "bg-red-500", label: "open (tripped)" },
};

function ProviderCard({ name, data }: { name: string; data: any }) {
  const history = useQuery(api.providerHealth.recentByProvider, {
    providerName: name,
    minutes: 30,
  });

  const latencyData = (history ?? [])
    .sort((a: any, b: any) => a.timestamp - b.timestamp)
    .map((r: any) => r.latencyEmaMs);

  const state = data ? stateConfig[data.state] ?? stateConfig.closed : null;

  return (
    <div className="bg-gray-900/50 border border-gray-700/30 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`w-2 h-2 rounded-full ${state?.dot ?? "bg-gray-600"}`}
        />
        <span className="text-sm font-medium text-gray-200">{name}</span>
      </div>
      {data ? (
        <div className="space-y-1.5">
          <div className="text-xs text-gray-400">{state?.label}</div>
          <div className="text-xs text-gray-400">
            {Math.round(data.successRate)}% success
          </div>
          <div className="text-xs text-gray-400">
            {(data.latencyEmaMs / 1000).toFixed(1)}s latency
          </div>
          {latencyData.length >= 2 && (
            <Sparkline data={latencyData} width={100} height={20} />
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-600">No data</p>
      )}
    </div>
  );
}

function ProviderHealthPanelInner() {
  const healthData = useProviderHealth();
  const providers = ["anthropic_direct", "openrouter", "ollama"];

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">
        Provider Health
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {providers.map((p) => (
          <ProviderCard key={p} name={p} data={healthData[p]} />
        ))}
      </div>
    </div>
  );
}

const ProviderHealthPanel = memo(ProviderHealthPanelInner);
export default ProviderHealthPanel;
