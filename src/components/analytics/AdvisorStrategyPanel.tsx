import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { SectionHeader } from "../SectionHeader";
import { GlassPanel } from "../GlassPanel";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../ui/table";
import { useMetricState } from "@/hooks/useMetricState";
import { InlineMetricState } from "@/components/EmptyState";

/**
 * GlassPanel ownership: this COMPONENT owns all three GlassPanels (Total
 * Savings card, Escalation Rate card, cost-comparison table) plus the
 * SectionHeader that sits outside them as a sibling, matching the pre-move
 * nesting. The page's call site after 121-04 is just a boundary wrapping this
 * component directly, with no outer GlassPanel from the page.
 *
 * Self-fetching: owns advisorEvents.savingsSummary and advisorEvents.recent.
 * No error handling here (D-02) — relies entirely on the error-boundary
 * wrapper its parent supplies.
 */
export default function AdvisorStrategyPanel() {
  const advisorSavings = useQuery(api.advisorEvents.savingsSummary);
  const advisorRecent = useQuery(api.advisorEvents.recent, { limit: 20 });
  // 122-16 (D-19/D-20): distinguishes "the query hasn't resolved yet" from
  // "it resolved with zero advisor events" instead of collapsing both into
  // one ambiguous dash.
  const { state: advisorRecentState } = useMetricState(advisorRecent, undefined);

  return (
    <>
      <SectionHeader title="Advisor Strategy" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassPanel className="p-4">
          <p className="text-sm text-muted-foreground uppercase tracking-wide">Total Savings</p>
          <p className="text-2xl font-semibold tabular-nums mt-1">
            ${(advisorSavings?.totalSavings ?? 0).toFixed(2)}
          </p>
        </GlassPanel>
        <GlassPanel className="p-4">
          <p className="text-sm text-muted-foreground uppercase tracking-wide">Escalation Rate</p>
          <p className="text-2xl font-semibold tabular-nums mt-1">
            {advisorRecentState === "ready" ? (
              `${Math.round((advisorRecent!.filter((e) => e.used).length / advisorRecent!.length) * 100)}%`
            ) : (
              <InlineMetricState state={advisorRecentState} />
            )}
          </p>
        </GlassPanel>
      </div>
      {/* Cost comparison table */}
      <GlassPanel className="p-4 mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Provider</TableHead>
              <TableHead>Advisor Cost</TableHead>
              <TableHead>Standard Cost</TableHead>
              <TableHead>Saved</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(advisorRecent ?? []).slice(0, 10).map((evt, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-sm">{evt.provider}</TableCell>
                <TableCell className="tabular-nums">${evt.costUsd.toFixed(4)}</TableCell>
                <TableCell className="tabular-nums">${evt.standardCostUsd.toFixed(4)}</TableCell>
                <TableCell className="tabular-nums" style={{ color: "var(--status-ok)" }}>
                  ${(evt.standardCostUsd - evt.costUsd).toFixed(4)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </GlassPanel>
    </>
  );
}
