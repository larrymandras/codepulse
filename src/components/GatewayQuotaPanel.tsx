import { memo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ALL_PROVIDERS, PROVIDER_BILLING, PROVIDER_DISPLAY_NAMES } from "../lib/providers";
import InfoTooltip from "./InfoTooltip";

function GatewayQuotaPanelInner() {
  const snapshots = useQuery(api.gatewayQuota.latestByProvider) ?? [];

  const byProvider = new Map(snapshots.map((s) => [s.provider, s]));

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">
        Gateway Quota
        <InfoTooltip text="Live remaining capacity for each gateway provider. API-billed providers show spend gauges; subscription providers show unlimited status." />
      </h2>

      {snapshots.length === 0 ? (
        <p className="text-base text-muted-foreground">
          No quota data yet. Gateway quota polling begins on next cron cycle.
        </p>
      ) : (
        <div className="space-y-3">
          {ALL_PROVIDERS.map((p) => {
            const billing = PROVIDER_BILLING[p];
            const displayName = PROVIDER_DISPLAY_NAMES[p] ?? p;

            if (billing === "subscription") {
              return (
                <div key={p} className="flex items-center justify-between">
                  <span className="text-base text-gray-300">{displayName}</span>
                  <span className="text-sm px-1.5 py-0.5 bg-gray-700/50 text-gray-400 font-mono uppercase tracking-wider">
                    UNLIMITED
                  </span>
                </div>
              );
            }

            // API-billed
            const snapshot = byProvider.get(p);

            if (!snapshot) {
              return (
                <div key={p} className="flex items-center justify-between">
                  <span className="text-base text-gray-300">{displayName}</span>
                  <span className="text-base text-gray-600">No data</span>
                </div>
              );
            }

            const color =
              snapshot.remainingPct < 0.05
                ? "bg-red-500"
                : snapshot.remainingPct < 0.20
                  ? "bg-yellow-500"
                  : "bg-emerald-500";

            return (
              <div key={p} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-base text-gray-300">{displayName}</span>
                  <span className="font-mono tabular-nums text-base text-gray-300">
                    {Math.round(snapshot.remainingPct * 100)}%{" "}
                    <span className="text-gray-500">${snapshot.spendUsd.toFixed(2)}</span>
                  </span>
                </div>
                <div className="w-full h-1 bg-gray-700/50 overflow-hidden">
                  <div
                    className={`h-full ${color}`}
                    style={{ width: `${Math.round(snapshot.remainingPct * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default memo(GatewayQuotaPanelInner);
