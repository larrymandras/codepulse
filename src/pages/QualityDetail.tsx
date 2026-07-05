import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronLeft, FileText } from "lucide-react";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import { EntityRow } from "../components/EntityRow";
import { QualityTrendChart, RUBRIC_DIMENSIONS } from "../components/QualityTrendChart";
import { usePersonaDetail, useJudgedSessions } from "../hooks/useEvalScores";
import { formatTimestamp } from "../lib/formatters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Truncates from the end (rationale is a sentence, not a path — no leading-ellipsis semantics). */
function truncateText(text: string, maxLen = 120): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1).trimEnd() + "…";
}

const RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

function SubScoreBar({ label, value }: { label: string; value: number }) {
  const barColor =
    value < 40 ? "var(--status-error, #ef4444)" : "var(--primary, #10b981)";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
            {label}
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

export default function QualityDetail() {
  const { profileId } = useParams<{ profileId: string }>();
  const [rangeDays, setRangeDays] = useState(30);

  const detail = usePersonaDetail(profileId, rangeDays);
  const judgedSessions = useJudgedSessions(profileId, rangeDays);

  if (!profileId) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <p className="text-muted-foreground">No persona selected</p>
      </div>
    );
  }

  const series = detail?.series ?? [];
  const markers = detail?.markers ?? [];

  // Per-dimension breakdown: average each rubric dimension's score (0-1)
  // across the judged sessions in range, displayed 0-100 (matches KPI
  // display convention — never raw 0-1 decimals in the surface).
  const dimensionAverages = RUBRIC_DIMENSIONS.map((dim) => {
    const values = series
      .map((s) => s.dimensions?.[dim.key]?.score)
      .filter((v): v is number => v != null);
    const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    return { ...dim, value: Math.round(avg * 100), hasData: values.length > 0 };
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/quality"
          className="inline-flex items-center gap-1 text-sm font-mono text-muted-foreground hover:text-foreground border-l-2 border-primary/40 pl-2 py-1.5 hover:border-primary/70 transition-colors duration-200"
        >
          <ChevronLeft className="h-3 w-3" />
          Back to Quality
        </Link>
        <div className="flex items-center justify-between mt-3">
          <h1 className="text-2xl font-bold">{profileId}</h1>
          <Select value={String(rangeDays)} onValueChange={(v) => setRangeDays(Number(v))}>
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
        </div>
      </div>

      <SectionErrorBoundary name="Persona Detail">
        <QualityTrendChart series={series} markers={markers} />
      </SectionErrorBoundary>

      <SectionErrorBoundary name="Dimension Breakdown">
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-base font-semibold text-foreground mb-3">
            Per-Dimension Breakdown
          </h2>
          {series.length === 0 ? (
            <p className="text-base text-muted-foreground text-center py-4">
              No judged sessions yet for {profileId}.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              {dimensionAverages.map((dim) => (
                <SubScoreBar key={dim.key} label={dim.label} value={dim.value} />
              ))}
            </div>
          )}
        </div>
      </SectionErrorBoundary>

      <SectionErrorBoundary name="Judged Sessions">
        <div className="bg-card border border-border rounded-xl">
          <div className="p-4 pb-0">
            <h2 className="text-base font-semibold text-foreground mb-3">
              Judged Sessions
            </h2>
          </div>
          {judgedSessions.length === 0 ? (
            <p className="text-base text-muted-foreground text-center py-8">
              No judged sessions yet for {profileId}.
            </p>
          ) : (
            <div>
              {judgedSessions.map((s) => {
                const rationales = Object.values(s.dimensions ?? {})
                  .map((d) => (d as { rationale?: string }).rationale)
                  .filter((r): r is string => !!r);
                const rationale = rationales.join(" ");
                return (
                  <EntityRow
                    key={s.sessionId}
                    icon={<FileText className="h-4 w-4" />}
                    primary={`${formatTimestamp(s.timestamp)} — ${Math.round(s.overall * 100)}/100`}
                    secondary={rationale ? truncateText(rationale, 120) : undefined}
                    trailing={
                      <Link
                        to={`/sessions/${s.sessionId}`}
                        className="text-primary hover:underline"
                      >
                        View session →
                      </Link>
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      </SectionErrorBoundary>
    </div>
  );
}
