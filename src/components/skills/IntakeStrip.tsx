import { ChevronRight } from "lucide-react";
import {
  RowStatusBadge,
  VerdictBadge,
} from "@/components/skills/IntakeStatusBadge";
import { verdictOf } from "@/hooks/useIntakeFeed";
import type { IntakeCommandRow } from "@/hooks/useIntake";

interface IntakeStripProps {
  rows: IntakeCommandRow[];
  activeCount: number;
  labelFor: (row: IntakeCommandRow) => string;
  onOpen: () => void;
}

/**
 * One-line intake summary under the page header: latest row's status + label,
 * live count, click to open the IntakeSheet. Renders nothing when intake has
 * never been used — the fold belongs to the skills themselves.
 */
export function IntakeStrip({ rows, activeCount, labelFor, onOpen }: IntakeStripProps) {
  const latest = rows[0];
  if (!latest) return null;

  const chip =
    latest.status === "done" ? (
      <VerdictBadge verdict={verdictOf(latest)} />
    ) : (
      <RowStatusBadge status={latest.status as Exclude<IntakeCommandRow["status"], "done">} />
    );

  return (
    <button
      onClick={onOpen}
      aria-label="Open intake history"
      className="w-full bg-card border border-border rounded-lg px-4 py-2 flex items-center gap-3 hover:border-primary/50 hover:shadow-[var(--glow-xs)] transition-all text-left"
    >
      <span className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-primary/70 shrink-0">
        Intake
      </span>
      <span aria-live="polite">{chip}</span>
      <span className="text-sm text-foreground truncate flex-1">{labelFor(latest)}</span>
      {activeCount > 0 && (
        <span className="text-xs font-mono text-primary px-2 py-0.5 rounded border border-primary/40 bg-primary/10 shrink-0">
          {activeCount} active
        </span>
      )}
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
    </button>
  );
}
