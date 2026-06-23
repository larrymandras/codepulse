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
      : "var(--primary, #10b981)";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
            {label} <span className="opacity-50 text-xs ml-1">({weight})</span>
          </span>
          <span className="text-sm font-bold tabular-nums font-mono text-foreground">
            {Math.round(value)}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden relative">
          <div
            className="absolute top-0 left-0 h-full rounded-full transition-all duration-500 shadow-[0_0_10px_currentColor]"
            style={{ width: `${Math.min(value, 100)}%`, backgroundColor: barColor, color: barColor }}
          />
        </div>
      </div>
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
        <p className="text-base text-muted-foreground mt-2">Loading...</p>
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
        <p className="text-base text-muted-foreground mt-1">
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
    <div className="glow-card bg-card/60 backdrop-blur-md border border-border/50 rounded-xl p-6 relative overflow-hidden hover:border-primary/50 transition-colors shadow-[0_0_15px_rgba(16,185,129,0.05)] hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]">
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-mono tracking-widest text-primary uppercase flex items-center gap-2">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: color }} />
          System Integrity <span className="text-xs text-muted-foreground">({label})</span>
        </h2>
        <div className="flex items-center gap-3 text-xs uppercase font-mono tracking-widest text-muted-foreground">
          <span title="Day-over-day" className="flex items-center gap-1"><span className="text-primary">{dayArrow}</span> 1D</span>
          <span title="7-day trend" className="flex items-center gap-1"><span className="text-primary">{weekArrow}</span> 7D</span>
        </div>
      </div>

      <div className="flex items-end gap-6 mb-8">
        {/* Score number */}
        <div className="text-5xl font-bold tabular-nums drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]" style={{ color }}>
          <AnimatedNumber
            value={score}
            format={(v: number) => Math.round(v).toString()}
          />
          <span className="text-lg text-muted-foreground font-normal opacity-50">/100</span>
        </div>

        {/* Sparkline inline */}
        {sparkData.length >= 2 && (
          <div className="flex-1 h-12 mb-1 opacity-80">
            <Sparkline data={sparkData} height={48} color={color} />
          </div>
        )}
      </div>

      {/* Sub-score breakdown (D-16) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
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
    </div>
  );
}

export default memo(OperatorScoreCard);
