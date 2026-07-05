import { useState } from "react";
import { useNavigate } from "react-router-dom";
import MetricCard, { thresholdColor } from "../components/MetricCard";
import { SectionHeader } from "../components/SectionHeader";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import { StatusBadge } from "../components/StatusBadge";
import InfoTooltip from "../components/InfoTooltip";
import Sparkline from "../components/Sparkline";
import { useQualityKpis } from "../hooks/useEvalScores";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

function QualityKpiCard({
  profileId,
  currentMean,
  sparkline,
  delta,
  activeRegression,
  rangeDays,
}: {
  profileId: string;
  currentMean: number;
  sparkline: Array<{ timestamp: number; overall: number }>;
  delta: number;
  activeRegression: boolean;
  rangeDays: number;
}) {
  const navigate = useNavigate();
  const hasData = sparkline.length > 0;

  const cardClasses =
    "glow-card bg-card/60 backdrop-blur-md border border-border/50 rounded-xl p-5 relative overflow-hidden hover:border-primary/50 hover:scale-[1.01] transition-all duration-300 cursor-pointer";

  return (
    <div
      className={cardClasses}
      onClick={() => navigate(`/quality/${profileId}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") navigate(`/quality/${profileId}`);
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-mono tracking-widest text-primary uppercase truncate">
          {profileId}
        </h3>
        {activeRegression && (
          <span className="flex items-center shrink-0">
            <StatusBadge status="regression" />
            <InfoTooltip text="Quality regression detected. See Alerts for details." />
          </span>
        )}
      </div>

      {!hasData ? (
        <p className="text-base text-muted-foreground">
          No judged sessions in this range. Try a longer range, or check back
          after tonight&apos;s judge run.
        </p>
      ) : (
        <>
          <div className="flex items-end gap-4 mb-2">
            <div
              className="text-3xl font-bold tabular-nums"
              style={{ color: thresholdColor(currentMean, { ok: 0.8, warn: 0.5, invertDirection: true }) }}
            >
              {Math.round(currentMean * 100)}
              <span className="text-lg text-muted-foreground font-normal opacity-50">/100</span>
            </div>
            <div className="flex-1 h-10 opacity-80">
              <Sparkline
                data={sparkline.map((s) => s.overall)}
                height={40}
                color={thresholdColor(currentMean, { ok: 0.8, warn: 0.5, invertDirection: true })}
              />
            </div>
          </div>
          <DeltaBadge delta={delta} />
        </>
      )}
      <p className="text-xs text-muted-foreground mt-2 font-mono">
        {rangeDays}d window
      </p>
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  const pts = Math.round(delta * 100);
  const glyph = pts > 0 ? "▲" : pts < 0 ? "▼" : "→";
  const color =
    pts > 0 ? "text-emerald-500" : pts < 0 ? "text-red-500" : "text-muted-foreground";
  const sign = pts > 0 ? "+" : "";
  return (
    <div className={`text-sm font-mono ${color}`}>
      {glyph} {sign}
      {pts} pts vs previous 30d
    </div>
  );
}

export default function Quality() {
  const kpis = useQualityKpis();
  const [rangeDays, setRangeDays] = useState(30);

  const now = Date.now() / 1000;
  const rangeStart = now - rangeDays * 86400;

  const hasAnyData = kpis.some((k) => k.sparkline.length > 0);

  const rangeFilteredCounts = kpis.map((k) => ({
    profileId: k.profileId,
    filteredScores: k.sparkline.filter((s) => s.timestamp >= rangeStart),
  }));

  const sessionsJudgedInRange = rangeFilteredCounts.reduce(
    (sum, r) => sum + r.filteredScores.length,
    0
  );
  const personasWithDataInRange = rangeFilteredCounts.filter(
    (r) => r.filteredScores.length > 0
  ).length;
  const activeRegressions = kpis.filter((k) => k.activeRegression).length;

  const personaMeansInRange = rangeFilteredCounts
    .filter((r) => r.filteredScores.length > 0)
    .map(
      (r) =>
        r.filteredScores.reduce((s, p) => s + p.overall, 0) / r.filteredScores.length
    );
  const avgOverall =
    personaMeansInRange.length > 0
      ? personaMeansInRange.reduce((a, b) => a + b, 0) / personaMeansInRange.length
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Quality</h1>
        <p className="text-base text-muted-foreground mt-1">
          Per-persona LLM output quality — judged nightly, tracked over time.
        </p>
      </div>

      {!hasAnyData ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-lg font-bold text-muted-foreground">No quality data yet</p>
          <p className="text-base text-muted-foreground mt-1">
            Scores appear here once Ástríðr starts emitting task_quality scores
            and the nightly judge completes its first run. Check back after
            the next scheduled run.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Personas Judged" value={personasWithDataInRange} />
            <MetricCard label="Sessions Judged (range)" value={sessionsJudgedInRange} />
            <MetricCard
              label="Active Regressions"
              value={activeRegressions}
              severity={activeRegressions > 0 ? "critical" : "default"}
            />
            <MetricCard
              label="Avg Overall Score"
              value={`${Math.round(avgOverall * 100)}/100`}
              numericValue={avgOverall}
              threshold={{ ok: 0.8, warn: 0.5, invertDirection: true }}
              format={(v) => `${Math.round(v * 100)}/100`}
            />
          </div>

          <div>
            <SectionHeader
              title="Per-Persona Quality"
              action={
                <Select
                  value={String(rangeDays)}
                  onValueChange={(v) => setRangeDays(Number(v))}
                >
                  <SelectTrigger size="sm" className="h-8 w-40 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RANGE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
            <SectionErrorBoundary name="Quality KPIs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {kpis.map((kpi) => (
                  <QualityKpiCard
                    key={kpi.profileId}
                    profileId={kpi.profileId}
                    currentMean={kpi.currentMean}
                    sparkline={kpi.sparkline}
                    delta={kpi.delta}
                    activeRegression={kpi.activeRegression}
                    rangeDays={rangeDays}
                  />
                ))}
              </div>
            </SectionErrorBoundary>
          </div>
        </>
      )}
    </div>
  );
}
