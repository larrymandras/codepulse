/**
 * CostBreakdownTable — per-(provider, model, billingType) cost breakdown,
 * COST-01. Phase 104 Plan 09.
 *
 * D-01: every dollar rendered here comes from `costDerived.costBreakdown`
 * (the read-time tokens-to-dollars recomputation), never an ingested cost
 * field.
 * D-03: a row whose model has no pricing rate renders its own "Unpriced"
 * badge IN PLACE OF the Billed/Covered cells, carrying its real token
 * counts — never a fabricated $0.00, and never folded into either total.
 * D-05: Billed and Covered are two separately labelled footer figures,
 * never summed into one headline.
 *
 * Table structure mirrors CostBreakdown.tsx's existing shadcn Table usage;
 * the Unpriced badge tint mirrors MetricCard.tsx's status-token color-mix
 * pattern. No hardcoded hex, Lucide icons only (none needed here), no
 * Recharts.
 */

import { useState } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import InfoTooltip from "./InfoTooltip";
import { useCostBreakdown } from "../hooks/useCostDerived";
import { PROVIDER_DISPLAY_NAMES } from "../lib/providers";
import { formatCost } from "../lib/formatters";

type Window = "24h" | "7d" | "30d";

const WINDOW_QUERY: Record<Window, { period: string; lookbackHours: number }> = {
  "24h": { period: "hourly", lookbackHours: 24 },
  "7d": { period: "daily", lookbackHours: 168 },
  "30d": { period: "daily", lookbackHours: 720 },
};

const WINDOW_OPTIONS: Window[] = ["24h", "7d", "30d"];

// D-03: status-warn token via color-mix, matching MetricCard.tsx's
// severityConfig / CostBreakdown.tsx's UNPRICED_BADGE_CLASS convention.
const UNPRICED_BADGE_CLASS =
  "border-[var(--status-warn)]/60 text-[var(--status-warn)] bg-[color-mix(in_oklab,var(--status-warn)_12%,transparent)] text-xs font-mono w-fit";

const HEAD_CLASS = "text-xs font-mono uppercase tracking-widest text-muted-foreground h-7 px-1";
const CELL_CLASS = "text-sm tabular-nums px-1 py-1";

export default function CostBreakdownTable() {
  const [windowKey, setWindowKey] = useState<Window>("24h");
  const { period, lookbackHours } = WINDOW_QUERY[windowKey];
  const { rows, billedTotal, coveredTotal, unpricedTokenTotal } = useCostBreakdown(
    period,
    lookbackHours
  );

  const windowSelector = (
    <div role="group" aria-label="Cost breakdown window" className="flex items-center gap-1">
      {WINDOW_OPTIONS.map((w) => (
        <Button
          key={w}
          type="button"
          size="sm"
          variant={windowKey === w ? "default" : "outline"}
          aria-pressed={windowKey === w}
          onClick={() => setWindowKey(w)}
        >
          {w}
        </Button>
      ))}
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <h2 className="text-sm font-normal uppercase tracking-wide text-muted-foreground">
          Cost by Model
        </h2>
        {windowSelector}
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-base">No cost data yet.</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={HEAD_CLASS}>Provider</TableHead>
                <TableHead className={HEAD_CLASS}>Model</TableHead>
                <TableHead className={HEAD_CLASS}>Billing</TableHead>
                <TableHead className={HEAD_CLASS}>Prompt tokens</TableHead>
                <TableHead className={HEAD_CLASS}>Completion tokens</TableHead>
                <TableHead className={HEAD_CLASS}>Billed</TableHead>
                <TableHead className={HEAD_CLASS}>Covered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => {
                const key = `${row.provider}-${row.model}-${row.billingType}-${i}`;
                const providerName = PROVIDER_DISPLAY_NAMES[row.provider] ?? row.provider;

                if (!row.priced) {
                  // D-03: real token counts, no dollar cell — the Unpriced
                  // badge stands in place of Billed+Covered, never $0.00.
                  return (
                    <TableRow key={key}>
                      <TableCell className={CELL_CLASS}>{providerName}</TableCell>
                      <TableCell className={CELL_CLASS}>{row.model}</TableCell>
                      <TableCell className={`${CELL_CLASS} capitalize`}>{row.billingType}</TableCell>
                      <TableCell className={CELL_CLASS}>{row.promptTokens.toLocaleString()}</TableCell>
                      <TableCell className={CELL_CLASS}>{row.completionTokens.toLocaleString()}</TableCell>
                      <TableCell colSpan={2} className={CELL_CLASS}>
                        <Badge variant="outline" className={UNPRICED_BADGE_CLASS}>
                          Unpriced
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                }

                const isSubscription = row.billingType === "subscription";
                return (
                  <TableRow key={key}>
                    <TableCell className={CELL_CLASS}>{providerName}</TableCell>
                    <TableCell className={CELL_CLASS}>{row.model}</TableCell>
                    <TableCell className={`${CELL_CLASS} capitalize`}>{row.billingType}</TableCell>
                    <TableCell className={CELL_CLASS}>{row.promptTokens.toLocaleString()}</TableCell>
                    <TableCell className={CELL_CLASS}>{row.completionTokens.toLocaleString()}</TableCell>
                    <TableCell className={CELL_CLASS}>{formatCost(row.billedUsd ?? 0)}</TableCell>
                    <TableCell className={CELL_CLASS}>
                      {isSubscription ? (
                        <span className="inline-flex items-center">
                          {formatCost(row.coveredUsd ?? 0)}
                          <InfoTooltip
                            text={`Not billed — priced at the ${row.model} API rate to show what this would have cost without your subscription plan.`}
                          />
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              {/* D-05: two separately labelled figures, never summed into one. */}
              <TableRow>
                <TableCell colSpan={5} className={`${CELL_CLASS} text-right text-muted-foreground`}>
                  Billed total
                </TableCell>
                <TableCell className={`${CELL_CLASS} font-semibold`}>{formatCost(billedTotal)}</TableCell>
                <TableCell className={CELL_CLASS} />
              </TableRow>
              <TableRow>
                <TableCell colSpan={6} className={`${CELL_CLASS} text-right text-muted-foreground`}>
                  Covered total
                </TableCell>
                <TableCell className={`${CELL_CLASS} font-semibold`}>{formatCost(coveredTotal)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
          {unpricedTokenTotal > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              {unpricedTokenTotal.toLocaleString()} tokens in this window aren't priced and
              aren't in the totals above.
            </p>
          )}
        </>
      )}
    </div>
  );
}
