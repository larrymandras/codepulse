import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FlexBarChart } from "./FlexBarChart";
import { formatCost } from "../lib/formatters";
import InfoTooltip from "./InfoTooltip";

export default function LlmAnalyticsPanel() {
  // Phase 121 D-07: both migrated queries now return
  // { rows, asOf, expectedBuckets, presentBuckets, rowsRead, truncated } instead
  // of a bare array / bare record. `presentBuckets`/`expectedBuckets`/`truncated`
  // are carried in the payload for Phase 122's TOKEN-04 six-state tile and are
  // deliberately NOT rendered here — D-11 caps this phase at the one freshness
  // label below, not a full stale/partial/unavailable component.
  const providerResult = useQuery(api.llm.providerBreakdown, {});
  const providerData = providerResult?.rows ?? [];
  // Calls and tokens are raw MEASUREMENTS and are fine to read from llmMetrics.
  // The DOLLAR column is not: see the derived join below.
  const modelResult = useQuery(api.llm.costByModel);
  const modelResultRows = modelResult?.rows ?? [];

  // CR-01 follow-up (2026-08-03). This table used to format the legacy per-row
  // cost field directly from `api.llm.costByModel`, which sums the raw ingested
  // `llmMetrics.cost` field (`grouped[key].cost += r.cost ?? 0`). D-01 is explicit
  // that this value "continues to be stored but stops being the displayed truth",
  // and the whole premise of Phase 104 is that it is WRONG — measured on the live
  // instance, the legacy figure under-reported by ~13% against the derived one.
  //
  // So the money column now comes from `costDerived.costBreakdown` (tokens x live
  // rates), joined by model. 30-day window to match costByModel's own cutoff.
  // A model with no resolvable rate renders "Unpriced" rather than a $0.00 that
  // would read as "this model cost nothing" (D-03).
  //
  // Phase 121 D-07 note: `costByModel`/`providerBreakdown` carry no `cost` field
  // at all anymore (dropped deliberately). Do NOT be tempted to derive a dollar
  // value from their `calls`/`tokens` fields directly — Phase 104 D-01 forbids
  // any money figure that isn't the one derived from the join below.
  const breakdown = useQuery(api.costDerived.costBreakdown, {
    period: "hourly",
    lookbackHours: 30 * 24,
  });

  const derivedByModel = new Map<string, { billedUsd: number | null; priced: boolean }>();
  for (const r of breakdown?.rows ?? []) {
    const existing = derivedByModel.get(r.model);
    // Sum across providers/billingTypes for the same model id. `priced` is true if
    // ANY contributing bucket priced, so a partially-priced model is not shown as
    // wholly unpriced.
    derivedByModel.set(r.model, {
      billedUsd: (existing?.billedUsd ?? 0) + (r.billedUsd ?? 0),
      priced: (existing?.priced ?? false) || r.priced,
    });
  }

  const modelRows = modelResultRows
    .map((data) => {
      const d = derivedByModel.get(data.model);
      return {
        model: data.model,
        calls: data.calls,
        tokens: data.tokens,
        derivedCost: d?.priced ? d.billedUsd : null,
      };
    })
    // Priced rows first, most expensive down; unpriced rows last.
    .sort((a, b) => {
      if ((a.derivedCost === null) !== (b.derivedCost === null)) {
        return a.derivedCost === null ? 1 : -1;
      }
      return (b.derivedCost ?? 0) - (a.derivedCost ?? 0);
    });

  const barData = providerData.map((p) => ({
    label: p.provider,
    value: p.calls,
  }));

  // D-11 freshness label: one `as of HH:MM` for the whole panel, sourced from
  // the OLDER of the two queries' `asOf` values — the label describes the
  // panel, and the panel is only as fresh as its stalest input. `asOf` is
  // epoch SECONDS (a raw `aggregates.bucket_start`); a millisecond
  // interpretation renders a 1970 date, which is the tell to check for.
  const providerAsOf = providerResult?.asOf;
  const modelAsOf = modelResult?.asOf;
  let freshnessLabel: string | null = null;
  if (providerAsOf === undefined || modelAsOf === undefined) {
    // Still loading — render nothing rather than a placeholder time.
    freshnessLabel = null;
  } else if (providerAsOf === null && modelAsOf === null) {
    // Both queries returned zero rows — no rollup data exists yet.
    freshnessLabel = "no data yet";
  } else {
    const asOf =
      providerAsOf === null
        ? modelAsOf
        : modelAsOf === null
          ? providerAsOf
          : Math.min(providerAsOf, modelAsOf);
    if (asOf === null) {
      freshnessLabel = "no data yet";
    } else {
      // asOf is epoch SECONDS (a raw aggregates.bucket_start) — asOf * 1000
      // converts to millis for Date(). A bare `new Date(asOf)` would render 1970.
      const d = new Date(asOf * 1000);
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      freshnessLabel = `as of ${hh}:${mm}`;
    }
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 space-y-6">
      <div>
        <h2 className="text-sm font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">
          Provider Comparison<InfoTooltip text="Detailed LLM analytics: provider comparison and per-model performance breakdown" />
          {freshnessLabel !== null && (
            <span className="text-xs font-normal tracking-normal text-muted-foreground normal-case">{freshnessLabel}</span>
          )}
        </h2>
        {barData.length === 0 ? (
          <p className="text-gray-500 text-base">No provider data yet.</p>
        ) : (
          <FlexBarChart data={barData} height={220} />
        )}
      </div>

      <div>
        <h2 className="text-sm font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">Model Breakdown<InfoTooltip text="Cost is recomputed from tokens x the current rate in Model Pricing, not read from the value the agent reported. A model with no rate shows Unpriced instead of $0." /></h2>
        {modelRows.length === 0 ? (
          <p className="text-gray-500 text-base">No model data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left py-2 pr-3 font-medium">Model</th>
                  <th className="text-right py-2 px-3 font-medium">Calls</th>
                  <th className="text-right py-2 px-3 font-medium">Tokens</th>
                  <th className="text-right py-2 pl-3 font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {modelRows.map((row) => (
                  <tr key={row.model} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                    <td className="py-2 pr-3 text-gray-200 font-mono text-sm">{row.model}</td>
                    <td className="py-2 px-3 text-right text-gray-300">{row.calls}</td>
                    <td className="py-2 px-3 text-right text-gray-300">{row.tokens.toLocaleString()}</td>
                    <td className="py-2 pl-3 text-right text-gray-300 font-mono">
                      {breakdown === undefined ? (
                        // Loading is NOT $0.00 — an honest dash until the derivation lands.
                        <span className="text-muted-foreground">--</span>
                      ) : row.derivedCost === null ? (
                        <span className="text-muted-foreground">Unpriced</span>
                      ) : (
                        formatCost(row.derivedCost)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
