import { useMemo } from "react";
import { useContextHistory, useLatestContext } from "../hooks/useContextSnapshots";

const MAX_TOKENS = 200_000;

function getGaugeColor(pct: number): string {
  if (pct < 50) return "#22c55e";
  if (pct < 75) return "#eab308";
  if (pct < 90) return "#f97316";
  return "#ef4444";
}

function getLabel(pct: number): string {
  if (pct < 50) return "NOMINAL";
  if (pct < 75) return "ELEVATED";
  if (pct < 90) return "HIGH";
  return "CRITICAL";
}

interface ContextGaugeProps {
  sessionId: string;
}

export default function ContextGauge({ sessionId }: ContextGaugeProps) {
  const latest = useLatestContext(sessionId);
  const history = useContextHistory(sessionId);

  const { burnRate, timeToFull, compactionCount, sparkline } = useMemo(() => {
    if (history.length < 2) {
      return { burnRate: 0, timeToFull: null as number | null, compactionCount: 0, sparkline: [] as number[] };
    }

    // History is desc-sorted — most recent first
    const sorted = [...history].sort((a, b) => a.timestamp - b.timestamp);

    // Burn rate: tokens/min over last 10 snapshots
    const recent = sorted.slice(-10);
    const firstSnap = recent[0];
    const lastSnap = recent[recent.length - 1];
    const timeDeltaMin = Math.max((lastSnap.timestamp - firstSnap.timestamp) / 60, 0.1);
    const tokenDelta = (lastSnap.contextTokens ?? 0) - (firstSnap.contextTokens ?? 0);
    const rate = tokenDelta / timeDeltaMin; // tokens/min (can be negative after compaction)

    // Time to full (only if burn rate is positive)
    const currentTokens = lastSnap.contextTokens ?? 0;
    const remaining = MAX_TOKENS - currentTokens;
    const ttf = rate > 0 ? remaining / rate : null; // minutes

    // Count compactions (drops in context tokens > 20%)
    let compactions = 0;
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1].contextTokens ?? 0;
      const curr = sorted[i].contextTokens ?? 0;
      if (prev > 0 && curr < prev * 0.8) compactions++;
    }

    // Sparkline: last 20 values normalized
    const spark = sorted.slice(-20).map((s) => s.contextTokens ?? 0);

    return { burnRate: rate, timeToFull: ttf, compactionCount: compactions, sparkline: spark };
  }, [history]);

  if (!latest || latest.contextTokens == null) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Context Window</h2>
        <p className="text-sm text-gray-500 py-6 text-center">No context data</p>
      </div>
    );
  }

  const tokens = latest.contextTokens;
  const pct = Math.min((tokens / MAX_TOKENS) * 100, 100);
  const color = getGaugeColor(pct);
  const label = getLabel(pct);

  // SVG arc gauge
  const arcRadius = 70;
  const arcStroke = 8;
  const circumference = Math.PI * arcRadius; // half circle
  const filled = (pct / 100) * circumference;

  // Format burn rate
  const burnLabel =
    burnRate > 0
      ? `+${(burnRate / 1000).toFixed(1)}k/min`
      : burnRate < 0
        ? `${(burnRate / 1000).toFixed(1)}k/min`
        : "stable";

  // Format time to full
  const ttfLabel =
    timeToFull != null
      ? timeToFull < 60
        ? `~${Math.round(timeToFull)}min`
        : `~${(timeToFull / 60).toFixed(1)}hr`
      : "—";

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-300">Context Window</h2>
        <span
          className="text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{ color, backgroundColor: `${color}15` }}
        >
          {label}
        </span>
      </div>

      <div className="flex items-start gap-6">
        {/* Arc gauge */}
        <div className="shrink-0 relative" style={{ width: 160, height: 90 }}>
          <svg width={160} height={90} viewBox="0 0 160 90">
            {/* Background arc */}
            <path
              d={`M ${80 - arcRadius} 85 A ${arcRadius} ${arcRadius} 0 0 1 ${80 + arcRadius} 85`}
              fill="none"
              stroke="#374151"
              strokeWidth={arcStroke}
              strokeLinecap="round"
            />
            {/* Filled arc */}
            <path
              d={`M ${80 - arcRadius} 85 A ${arcRadius} ${arcRadius} 0 0 1 ${80 + arcRadius} 85`}
              fill="none"
              stroke={color}
              strokeWidth={arcStroke}
              strokeLinecap="round"
              strokeDasharray={`${filled} ${circumference}`}
              style={{ transition: "stroke-dasharray 0.5s ease, stroke 0.5s ease" }}
            />
          </svg>
          {/* Center value */}
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-0">
            <span className="text-xl font-bold text-gray-100">{pct.toFixed(0)}%</span>
            <span className="text-[9px] text-gray-500">{(tokens / 1000).toFixed(0)}k / 200k</span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="flex-1 grid grid-cols-2 gap-2">
          <div>
            <p className="text-[9px] text-gray-500 uppercase">Burn Rate</p>
            <p
              className="text-sm font-medium"
              style={{ color: burnRate > 0 ? "#f97316" : burnRate < 0 ? "#22c55e" : "#9ca3af" }}
            >
              {burnLabel}
            </p>
          </div>
          <div>
            <p className="text-[9px] text-gray-500 uppercase">Time to Full</p>
            <p className="text-sm font-medium text-gray-200">{ttfLabel}</p>
          </div>
          <div>
            <p className="text-[9px] text-gray-500 uppercase">Compactions</p>
            <p className="text-sm font-medium text-gray-200">{compactionCount}</p>
          </div>
          <div>
            <p className="text-[9px] text-gray-500 uppercase">Remaining</p>
            <p className="text-sm font-medium text-gray-200">
              {((MAX_TOKENS - tokens) / 1000).toFixed(0)}k
            </p>
          </div>
        </div>
      </div>

      {/* Sparkline */}
      {sparkline.length > 2 && (
        <div className="mt-3 h-8 flex items-end gap-px">
          {sparkline.map((v, i) => {
            const h = Math.max((v / MAX_TOKENS) * 100, 2);
            const c = getGaugeColor((v / MAX_TOKENS) * 100);
            return (
              <div
                key={i}
                className="flex-1 rounded-t transition-all"
                style={{
                  height: `${h}%`,
                  backgroundColor: c,
                  opacity: 0.6,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
