import { useState, useEffect, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAstridrWS } from "@/contexts/AstridrWSContext";

// ─── Threshold helpers ────────────────────────────────────────────────────────
// Thresholds per D-12: green <60%, amber 60-85%, red >85%

function getGaugeColor(pct: number): string {
  if (pct < 60) return "#22c55e";   // green
  if (pct < 85) return "#eab308";   // amber
  return "#ef4444";                  // red
}

function getLabel(pct: number): string {
  if (pct < 60) return "NOMINAL";
  if (pct < 85) return "ELEVATED";
  return "CRITICAL";
}

// ─── WS overlay type ──────────────────────────────────────────────────────────

interface ContextPressureOverlay {
  fillPercent: number;
  tokensUsed: number;
  tokensMax: number;
  turnDelta: number;
  avgPerTurn: number;
  thresholdCrossed: boolean;
  timestamp: number;
  stale: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ContextGauge() {
  const convexData = useQuery(api.contextPressure.latestForActiveSession);
  const history = useQuery(api.contextPressure.historyForActiveSession, { limit: 20 });
  const { subscribeEvent } = useAstridrWS();
  const [wsOverlay, setWsOverlay] = useState<ContextPressureOverlay | null>(null);

  useEffect(() => {
    const unsub = subscribeEvent("context_pressure", (event) => {
      const d = event.data as any;
      if (d) {
        setWsOverlay({
          fillPercent: d.fill_percent ?? d.fillPercent ?? 0,
          tokensUsed: d.tokens_used ?? d.tokensUsed ?? 0,
          tokensMax: d.tokens_max ?? d.tokensMax ?? 0,
          turnDelta: d.turn_delta ?? d.turnDelta ?? 0,
          avgPerTurn: d.avg_per_turn ?? d.avgPerTurn ?? 0,
          thresholdCrossed: d.threshold_crossed ?? d.thresholdCrossed ?? false,
          timestamp: d.timestamp ?? Date.now() / 1000,
          stale: false,
        });
      }
    });
    return unsub;
  }, [subscribeEvent]);

  // Use WS overlay if newer than Convex data (instant update before Convex reactivity round-trip)
  const latest = useMemo(() => {
    if (!wsOverlay && !convexData) return null;
    if (!convexData) return wsOverlay;
    if (!wsOverlay) return convexData;
    return wsOverlay.timestamp > (convexData.timestamp ?? 0) ? wsOverlay : convexData;
  }, [convexData, wsOverlay]);

  // Stale: server marked it stale, or last event older than 30s
  const isStale =
    latest?.stale === true ||
    (latest != null && Date.now() / 1000 - latest.timestamp > 30);

  // Sparkline from history (fillPercent 0-100)
  const sparkline = useMemo(() => {
    if (!history || history.length === 0) return [] as number[];
    return [...history]
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-20)
      .map((s) => s.fillPercent);
  }, [history]);

  // Compaction count: drops in fillPercent > 20 points
  const compactionCount = useMemo(() => {
    if (!history || history.length < 2) return 0;
    const sorted = [...history].sort((a, b) => a.timestamp - b.timestamp);
    let count = 0;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i - 1].fillPercent - sorted[i].fillPercent > 20) count++;
    }
    return count;
  }, [history]);

  // Empty state
  if (!latest) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Context Window</h2>
        <p className="text-sm text-gray-500 py-6 text-center">No context data</p>
      </div>
    );
  }

  const pct = Math.min(Math.max(latest.fillPercent, 0), 100);
  const tokens = latest.tokensUsed;
  const tokensMax = latest.tokensMax || 200_000;
  const color = getGaugeColor(pct);
  const label = getLabel(pct);

  // SVG arc gauge (160×90px, radius 70, stroke 8 — existing geometry unchanged)
  const arcRadius = 70;
  const arcStroke = 8;
  const circumference = Math.PI * arcRadius; // half circle
  const filled = (pct / 100) * circumference;

  // Turn delta formatting
  const turnDelta = latest.turnDelta ?? 0;
  const turnDeltaLabel =
    turnDelta > 0 ? `+${turnDelta.toFixed(0)}tok` : `${turnDelta.toFixed(0)}tok`;
  const turnDeltaColor = turnDelta > 0 ? "#eab308" : "#22c55e";

  // Avg per turn
  const avgPerTurn = latest.avgPerTurn ?? 0;
  const avgPerTurnLabel = `${avgPerTurn.toFixed(0)}tok`;

  // Time to full (approximate from avgPerTurn and remaining)
  const remaining = tokensMax - tokens;
  const remainingPct = 100 - pct;
  const ttfLabel =
    avgPerTurn > 0 && remainingPct > 0
      ? (() => {
          const turnsLeft = (remaining / avgPerTurn);
          return turnsLeft < 60
            ? `~${Math.round(turnsLeft)} turns`
            : `~${(turnsLeft / 60).toFixed(1)}hr`;
        })()
      : "—";

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-300">Context Window</h2>
        <span
          className="text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{ color, backgroundColor: `${color}15`, opacity: isStale ? 0.4 : 1 }}
        >
          {label}
        </span>
      </div>

      <div className="flex items-start gap-6">
        {/* Arc gauge */}
        <div className="shrink-0 relative" style={{ width: 160, height: 90 }}>
          <svg
            width={160}
            height={90}
            viewBox="0 0 160 90"
            style={{ opacity: isStale ? 0.4 : 1, transition: "opacity 0.3s ease" }}
          >
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
          <div
            className="absolute inset-0 flex flex-col items-center justify-end pb-0"
            style={{ opacity: isStale ? 0.4 : 1 }}
          >
            <span className="text-xl font-bold text-gray-100">{pct.toFixed(0)}%</span>
            {isStale && <span className="text-[9px] text-gray-500">STALE</span>}
            {!isStale && (
              <span className="text-[9px] text-gray-500">
                {(tokens / 1000).toFixed(0)}k / {(tokensMax / 1000).toFixed(0)}k
              </span>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div className="flex-1 grid grid-cols-2 gap-2">
          <div>
            <p className="text-[9px] text-gray-500 uppercase">Avg/turn</p>
            <p className="text-sm font-medium text-gray-200">{avgPerTurnLabel}</p>
          </div>
          <div>
            <p className="text-[9px] text-gray-500 uppercase">Time to Full</p>
            <p className="text-sm font-medium text-gray-200">{ttfLabel}</p>
          </div>
          <div>
            <p className="text-[9px] text-gray-500 uppercase">Turn Delta</p>
            <p className="text-sm font-medium" style={{ color: turnDeltaColor }}>
              {turnDeltaLabel}
            </p>
          </div>
          <div>
            <p className="text-[9px] text-gray-500 uppercase">Compactions</p>
            <p className="text-sm font-medium text-gray-200">{compactionCount}</p>
          </div>
        </div>
      </div>

      {/* Sparkline — fillPercent bars */}
      {sparkline.length > 2 && (
        <div className="mt-3 h-8 flex items-end gap-px">
          {sparkline.map((v, i) => {
            const h = Math.max(v, 2);
            const c = getGaugeColor(v);
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
