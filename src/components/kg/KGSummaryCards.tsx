import { Database } from "lucide-react";
import MetricCard from "../MetricCard";
import { entityTypeColor } from "../../lib/kg-graph";
import { useKgSummary } from "../../hooks/useKgSummary";

/** Relative "Xm ago" from an ISO timestamp; "never" when null. */
function relativeFrom(iso?: string): string {
  if (!iso) return "never";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "unknown";
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/**
 * Always-on KG summary cards (KG-01). Sourced from Convex `kgSummary` (pushed
 * `kg_summary` telemetry) so they render even when Ástríðr is offline. Shows
 * total entities + by-type breakdown, current vs historical triples,
 * contradiction count (alert-colored when > 0), and last-extraction time.
 */
export default function KGSummaryCards() {
  const { summary, loading } = useKgSummary();

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-[78px] rounded-[var(--radius)] border border-border bg-card/50 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex items-start gap-3 rounded-[var(--radius)] border border-border bg-card/50 px-4 py-3">
        <Database className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
        <div className="text-sm font-mono leading-relaxed">
          <p className="text-foreground">No KG summary telemetry yet.</p>
          <p className="text-muted-foreground mt-0.5">
            Cards populate once Ástríðr emits a{" "}
            <span className="text-primary">kg_summary</span> event after a
            knowledge-extraction cycle.
          </p>
        </div>
      </div>
    );
  }

  const byType = Object.entries(summary.entitiesByType).sort(
    (a, b) => b[1] - a[1],
  );
  const hasContradictions = summary.contradictionCount > 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard
          label="Entities"
          value={summary.totalEntities}
          numericValue={summary.totalEntities}
        />
        <MetricCard
          label="Current Triples"
          value={summary.currentTripleCount}
          numericValue={summary.currentTripleCount}
        />
        <MetricCard
          label="Historical Triples"
          value={summary.historicalTripleCount}
          numericValue={summary.historicalTripleCount}
        />
        <MetricCard
          label="Contradictions"
          value={summary.contradictionCount}
          numericValue={summary.contradictionCount}
          severity={hasContradictions ? "warning" : "default"}
        />
        <MetricCard label="Last Extraction" value={relativeFrom(summary.lastExtractionAt)} />
      </div>

      {/* By-type breakdown chips, colored by the stable entity-type palette */}
      {byType.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Database className="h-3 w-3" /> By type
          </span>
          {byType.map(([type, count]) => (
            <span
              key={type}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-border bg-card/60 px-2 py-0.5 text-sm font-mono"
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: entityTypeColor(type) }}
              />
              {type}
              <span className="text-muted-foreground">{count}</span>
            </span>
          ))}
        </div>
      )}

      <p className="sr-only">
        {summary.totalEntities} entities, {summary.currentTripleCount} current
        triples, {summary.historicalTripleCount} historical,{" "}
        {summary.contradictionCount} contradictions.
        {hasContradictions ? " Contradictions present." : ""}
      </p>
    </div>
  );
}
