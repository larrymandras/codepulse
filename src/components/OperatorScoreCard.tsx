import { memo } from "react";
import { AnimatedNumber } from "./MetricCard";
import Sparkline from "./Sparkline";
import { GlassPanel } from "./GlassPanel";
import {
  useLatestOperatorScore,
  useOperatorScoreHistory,
  useOperatorScoreBackfill,
} from "../hooks/useOperatorScore";

/**
 * Score color per SCORE-02 thresholds.
 * Green >70, yellow 40-70, red <40.
 */
function scoreColor(score: number): string {
  if (score > 70) return "var(--status-ok, #22c55e)";
  if (score >= 40) return "var(--status-warn, #f59e0b)";
  return "var(--status-error, #ef4444)";
}

/**
 * Status label per SCORE-02 thresholds.
 */
function scoreLabel(score: number): string {
  if (score > 70) return "Healthy";
  if (score >= 40) return "Needs Attention";
  return "Critical";
}

/**
 * Trend arrow glyphs per D-09.
 */
const DAY_ARROWS: Record<string, string> = {
  up: "^",
  down: "v",
  flat: "->",
};
const WEEK_ARROWS: Record<string, string> = {
  improving: "/",
  declining: "\\",
  flat: "->",
};

interface SubScoreBarProps {
  label: string;
  weight: string;
  value: number;
}

function SubScoreBar({ label, weight, value }: SubScoreBarProps) {
  const barColor =
    value < 40
      ? "var(--status-error, #ef4444)"
      : "var(--chart-bar-accent, var(--primary, #6366f1))";
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground w-32 shrink-0">
        {label}
      </span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-8 shrink-0">
        {weight}
      </span>
      <div className="flex-1 h-2 rounded-full bg-gray-700/50">
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(value, 100)}%`, backgroundColor: barColor }}
        />
      </div>
      <span className="text-sm font-bold tabular-nums w-8 text-right">
        {Math.round(value)}
      </span>
    </div>
  );
}

function OperatorScoreCard() {
  const latest = useLatestOperatorScore();
  const history = useOperatorScoreHistory(30);

  // Trigger backfill from Supabase if no recent scores (D-14)
  useOperatorScoreBackfill();

  // Loading state
  if (latest === undefined) {
    return (
      <GlassPanel className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-3 h-3 rounded-full bg-muted animate-pulse" />
          <span className="text-base font-bold">Operator Score</span>
        </div>
        <div className="text-5xl font-bold tabular-nums text-muted-foreground">
          &mdash;
        </div>
        <p className="text-sm text-muted-foreground mt-2">Loading...</p>
      </GlassPanel>
    );
  }

  // Empty state — no scores yet
  if (latest === null) {
    return (
      <GlassPanel className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-3 h-3 rounded-full bg-muted" />
          <span className="text-base font-bold">Operator Score</span>
        </div>
        <p className="text-lg font-bold text-muted-foreground">No score yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Operator Score is computed after the nightly audit completes. Check
          back after midnight.
        </p>
      </GlassPanel>
    );
  }

  const score = latest.score;
  const color = scoreColor(score);
  const label = scoreLabel(score);
  const sparkData = history.map((h) => h.score);

  // Trend arrows — use backend-computed trendDay/trend7d from Convex record,
  // falling back to client-side computation from history only if not present
  const dayTrend =
    latest.trendDay ??
    (history.length >= 2
      ? score > history[history.length - 2].score + 1
        ? "up"
        : score < history[history.length - 2].score - 1
          ? "down"
          : "flat"
      : "flat");
  const dayArrow = DAY_ARROWS[dayTrend] ?? "->";

  const week7Scores = history.slice(-7).map((h) => h.score);
  const avg7 =
    week7Scores.length > 0
      ? week7Scores.reduce((a, b) => a + b, 0) / week7Scores.length
      : score;
  const weekTrend =
    latest.trend7d ??
    (score > avg7 + 3
      ? "improving"
      : score < avg7 - 3
        ? "declining"
        : "flat");
  const weekArrow = WEEK_ARROWS[weekTrend] ?? "->";

  return (
    <GlassPanel className="p-6">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="text-base font-bold">Operator Score</span>
          <span
            className="text-[10px] uppercase tracking-wider"
            style={{ color }}
          >
            {label}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span title="Day-over-day">{dayArrow} day</span>
          <span title="7-day trend">{weekArrow} 7d</span>
        </div>
      </div>

      {/* Score number */}
      <div className="text-5xl font-bold tabular-nums mb-2" style={{ color }}>
        <AnimatedNumber
          value={score}
          format={(v: number) => Math.round(v).toString()}
        />
        <span className="text-lg text-muted-foreground font-normal">/100</span>
      </div>

      {/* Sparkline */}
      {sparkData.length >= 2 && (
        <div className="mb-4">
          <Sparkline data={sparkData} height={32} color={color} />
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-gray-700/50 my-4" />

      {/* Sub-score breakdown (D-16) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <SubScoreBar
          label="Memory Freshness"
          weight="25%"
          value={latest.memoryFreshness}
        />
        <SubScoreBar label="Skill ROI" weight="35%" value={latest.skillRoi} />
        <SubScoreBar
          label="Activity Level"
          weight="30%"
          value={latest.activityLevel}
        />
        <SubScoreBar label="Uptime" weight="10%" value={latest.uptime} />
      </div>
    </GlassPanel>
  );
}

export default memo(OperatorScoreCard);
