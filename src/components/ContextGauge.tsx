import { useLatestContext } from "../hooks/useContextSnapshots";

const MAX_TOKENS = 200_000;

function getGaugeColor(pct: number): string {
  if (pct < 50) return "#22c55e";
  if (pct < 75) return "#eab308";
  if (pct < 90) return "#f97316";
  return "#ef4444";
}

interface ContextGaugeProps {
  sessionId: string;
}

export default function ContextGauge({ sessionId }: ContextGaugeProps) {
  const latest = useLatestContext(sessionId);

  if (!latest || latest.contextTokens == null) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Context Usage</h2>
        <p className="text-sm text-gray-500 py-6 text-center">No context data</p>
      </div>
    );
  }

  const tokens = latest.contextTokens;
  const pct = Math.min((tokens / MAX_TOKENS) * 100, 100);
  const color = getGaugeColor(pct);

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">Context Usage</h2>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-2xl font-semibold text-gray-100">
          {tokens.toLocaleString()}
        </span>
        <span className="text-xs text-gray-400">
          {pct.toFixed(1)}% of 200K
        </span>
      </div>
      <div className="w-full h-3 bg-gray-700/50 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, #22c55e, ${color})`,
          }}
        />
      </div>
    </div>
  );
}
