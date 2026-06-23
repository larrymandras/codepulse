import { memo } from "react";
import { useProviderHealth } from "../hooks/useProviderHealth";
import Sparkline from "./Sparkline";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ALL_PROVIDERS, PROVIDER_DISPLAY_NAMES } from "../lib/providers";

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

  const circuitState = data ? stateConfig[data.state] ?? stateConfig.closed : null;
  const displayName = PROVIDER_DISPLAY_NAMES[name] ?? name;

  // Status dot color per UI-SPEC:
  // available+authenticated = green, available+!authenticated = yellow, !available = red, no data = gray
  const dotColor = !data
    ? "bg-gray-600"
    : data.state === "open"
      ? "bg-red-500"
      : data.authenticated === false
        ? "bg-yellow-500"
        : "bg-green-500";

  // Billing type badge semantic
  const billingBadge = data?.billingType === "api"
    ? { label: "API-BILLED", cls: "bg-yellow-500/20 text-yellow-400" }
    : data?.billingType === "subscription"
      ? { label: "SUBSCRIPTION", cls: "bg-gray-700/50 text-gray-400" }
      : null;

  // Quota bar color
  const quotaBarColor = data?.quotaRemaining !== undefined
    ? data.quotaRemaining < 0.05
      ? "bg-red-500"
      : data.quotaRemaining < 0.20
        ? "bg-yellow-500"
        : "bg-emerald-500"
    : null;

  return (
    <div className="bg-gray-900/50 border border-gray-700/30 rounded-lg p-3">
      {/* Header row: dot + name + billing badge */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span className="text-base font-medium text-gray-200 flex-1">{displayName}</span>
        {billingBadge && (
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${billingBadge.cls}`}>
            {billingBadge.label}
          </span>
        )}
      </div>

      {data ? (
        <div className="space-y-1.5">
          {/* Availability */}
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Availability</span>
            <span className={data.state === "open" ? "text-red-400" : "text-green-400"}>
              {data.state === "open" ? "OFFLINE" : "ONLINE"}
            </span>
          </div>

          {/* Auth status — only if field present */}
          {data.authenticated !== undefined && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Auth</span>
              <span className={data.authenticated ? "text-green-400" : "text-red-400"}>
                {data.authenticated ? "AUTHENTICATED" : "NOT AUTHENTICATED"}
              </span>
            </div>
          )}

          {/* Billing type */}
          {data.billingType !== undefined && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Billing</span>
              <span className="text-gray-400">{data.billingType}</span>
            </div>
          )}

          {/* Quota bar — only if field present */}
          {data.quotaRemaining !== undefined && (
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Quota</span>
                <span className="text-sm font-medium font-mono tabular-nums text-gray-300">
                  {Math.round(data.quotaRemaining * 100)}%
                </span>
              </div>
              <div className="w-full h-1 bg-gray-700/50 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${quotaBarColor}`}
                  style={{ width: `${Math.round(data.quotaRemaining * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Existing fields */}
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Latency EMA</span>
            <span className="text-gray-400">{(data.latencyEmaMs / 1000).toFixed(1)}s</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Success</span>
            <span className="text-gray-400">{Math.round(data.successRate)}%</span>
          </div>

          {latencyData.length >= 2 && (
            <Sparkline data={latencyData} width={100} height={20} />
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-500">No data yet</p>
      )}
    </div>
  );
}

function ProviderHealthPanelInner() {
  const healthData = useProviderHealth();

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">
        Provider Health
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {ALL_PROVIDERS.map((p) => (
          <ProviderCard key={p} name={p} data={healthData[p]} />
        ))}
      </div>
    </div>
  );
}

const ProviderHealthPanel = memo(ProviderHealthPanelInner);
export default ProviderHealthPanel;
