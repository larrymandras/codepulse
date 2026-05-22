import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FlexBarChart } from "./FlexBarChart";
import { PROVIDER_DISPLAY_NAMES } from "../lib/providers";
import InfoTooltip from "./InfoTooltip";

const PROVIDER_COLORS: Record<string, string> = {
  "claude-cli": "#10b981",
  "claude-sdk": "#10b981",
  "codex": "#22c55e",
  "antigravity": "#06b6d4",
  "anthropic_direct": "#f59e0b",
  "openrouter": "#a855f7",
  "ollama": "#6b7280",
};

export default function ProviderComparisonChart() {
  const stats = useQuery(api.gatewayTasks.providerStats, { lookbackHours: 24 }) ?? [];

  const successData = stats.map((s) => ({
    label: PROVIDER_DISPLAY_NAMES[s.provider] ?? s.provider,
    value: s.successRate,
  }));

  const latencyData = stats.map((s) => ({
    label: PROVIDER_DISPLAY_NAMES[s.provider] ?? s.provider,
    value: s.avgDurationSeconds,
  }));

  const countData = stats.map((s) => ({
    label: PROVIDER_DISPLAY_NAMES[s.provider] ?? s.provider,
    value: s.taskCount,
  }));

  return (
    <div className="space-y-3">
      <h2 className="text-xs font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">
        Provider Comparison
        <InfoTooltip text="Success rate, average latency, and task count per provider over the last 24 hours" />
      </h2>

      {stats.length === 0 ? (
        <p className="text-sm text-muted-foreground">No gateway task data in the last 24 hours.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
              Success Rate (%)
            </p>
            <FlexBarChart data={successData} height={200} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
              Avg Latency (s)
            </p>
            <FlexBarChart data={latencyData} height={200} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
              Task Count
            </p>
            <FlexBarChart data={countData} height={200} />
          </div>
        </div>
      )}
    </div>
  );
}
