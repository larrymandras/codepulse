import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FlexBarChart } from "./FlexBarChart";
import { PROVIDER_DISPLAY_NAMES } from "../lib/providers";
import InfoTooltip from "./InfoTooltip";

import { ScrollArea } from "./ui/scroll-area";

export default function LlmProviderPanel() {
  const raw = useQuery(api.analytics.tokenWaterfall) ?? [];

  const byProvider: Record<string, { model: string; tokens: number }[]> = {};
  for (const entry of raw) {
    const p = entry.provider ?? "unknown";
    if (!byProvider[p]) byProvider[p] = [];
    const totalTokens = (entry.promptTokens ?? 0) + (entry.completionTokens ?? 0);
    const existing = byProvider[p].find((m) => m.model === entry.model);
    if (existing) {
      existing.tokens += totalTokens;
    } else {
      byProvider[p].push({ model: entry.model, tokens: totalTokens });
    }
  }

  if (raw.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-sm font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">
          LLM by Provider
          <InfoTooltip text="Token consumption grouped by provider then model" />
        </h2>
        <p className="text-base text-muted-foreground">No LLM metrics yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 space-y-4">
      <h2 className="text-sm font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">
        LLM by Provider
        <InfoTooltip text="Token consumption grouped by provider then model" />
      </h2>
      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-4">
          {Object.entries(byProvider).map(([provider, models]) => (
            <div key={provider} className="space-y-2">
              <p className="text-sm text-muted-foreground uppercase tracking-wide">
                {PROVIDER_DISPLAY_NAMES[provider] ?? provider}
              </p>
              <FlexBarChart
                data={models.map((m) => ({ label: m.model, value: m.tokens }))}
                height={80}
              />
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
