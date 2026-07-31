import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FlexBarChart, type StackedSegment } from "./FlexBarChart";
import { PROVIDER_DISPLAY_NAMES, PROVIDER_COLORS } from "../lib/providers";
import InfoTooltip from "./InfoTooltip";
import { Button } from "@/components/ui/button";

type CostSeriesMode = "billed" | "billed+covered";

export default function CostTrendChart() {
  const [mode, setMode] = useState<CostSeriesMode>("billed");

  const buckets =
    useQuery(api.costDerived.costOverTime, {
      period: "hourly",
      lookbackHours: 24,
    }) ?? [];

  // D-08: the default `Billed` view constructs segments exclusively from
  // billedByProvider — no covered value is ever read in that mode. Billed
  // segments are pushed first, covered segments (when toggled on) always
  // second, so the covered portion reads as an appended explanation rather
  // than as part of the billed stack.
  const data = buckets.map((b) => {
    const segments: StackedSegment[] = [];

    for (const [provider, value] of Object.entries(b.billedByProvider)) {
      segments.push({
        value,
        color: PROVIDER_COLORS[provider] ?? "#6b7280",
        label: PROVIDER_DISPLAY_NAMES[provider] ?? provider,
      });
    }

    if (mode === "billed+covered") {
      for (const [provider, value] of Object.entries(b.coveredByProvider)) {
        const color = PROVIDER_COLORS[provider] ?? "#6b7280";
        // Same provider hex, reduced opacity via color-mix — D-08: no second
        // color scale, and the two segments stay separate array entries so
        // they can never be summed into one provider value (D-05).
        segments.push({
          value,
          color: `color-mix(in srgb, ${color} 35%, transparent)`,
          label: `${PROVIDER_DISPLAY_NAMES[provider] ?? provider} (covered)`,
        });
      }
    }

    return {
      label: new Date(b.bucket_start * 1000).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      segments,
    };
  });

  // D-03: excluded unpriced traffic is stated, never dropped silently and
  // never added as a misleading zero-valued segment.
  const unpricedTokenTotal = buckets.reduce((sum, b) => {
    return (
      sum +
      Object.values(b.unpricedTokensByProvider).reduce((s, v) => s + v, 0)
    );
  }, 0);

  const toggle = (
    <div role="group" aria-label="Cost series" className="flex items-center gap-1">
      <Button
        type="button"
        size="sm"
        variant={mode === "billed" ? "default" : "outline"}
        aria-pressed={mode === "billed"}
        onClick={() => setMode("billed")}
      >
        Billed
      </Button>
      <Button
        type="button"
        size="sm"
        variant={mode === "billed+covered" ? "default" : "outline"}
        aria-pressed={mode === "billed+covered"}
        onClick={() => setMode("billed+covered")}
      >
        Billed + Covered
      </Button>
    </div>
  );

  const heading =
    data.length === 0 ? "Cost Trend" : "Cost Trend (Hourly by Provider)";

  return (
    <div>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <h2 className="text-sm font-mono tracking-widest text-primary uppercase flex items-center gap-2">
          {heading}
          <InfoTooltip text="Hourly spend trend broken down by provider over the last 24 hours" />
        </h2>
        {toggle}
      </div>

      {data.length === 0 ? (
        <p className="text-muted-foreground text-base">No cost data yet.</p>
      ) : (
        <>
          <FlexBarChart data={data} height={300} />
          {unpricedTokenTotal > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              {unpricedTokenTotal.toLocaleString()} tokens in this window
              aren't priced and aren't in this chart.
            </p>
          )}
        </>
      )}
    </div>
  );
}
