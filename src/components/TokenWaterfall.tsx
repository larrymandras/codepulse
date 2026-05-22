import { useMemo } from "react";
import { useTokenWaterfall } from "../hooks/useAdvancedAnalytics";
import { PROVIDER_DISPLAY_NAMES } from "../lib/providers";
import InfoTooltip from "./InfoTooltip";

const MODEL_COLORS: Record<string, string> = {
  // Claude family (existing gold/cyan/emerald)
  "claude-opus": "#fbbf24",
  "claude-sonnet": "#22d3ee",
  "claude-haiku": "#34d399",
  opus: "#fbbf24",
  sonnet: "#22d3ee",
  haiku: "#34d399",
  ollama: "#f97316",
  // GPT family (green tones per D-09)
  "gpt-4o": "#22c55e",
  "gpt-4o-mini": "#4ade80",
  gpt: "#22c55e",
  // Gemini family (purple tones per D-09)
  "gemini-2.5-pro": "#a855f7",
  "gemini-2.5-flash": "#c084fc",
  gemini: "#a855f7",
};

function getModelColor(model: string): string {
  const lower = model.toLowerCase();
  for (const [key, color] of Object.entries(MODEL_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return "#94a3b8";
}

export default function TokenWaterfall() {
  const raw = useTokenWaterfall();

  const providerGroups = useMemo(() => {
    if (raw.length === 0) return [];

    // Group by provider -> model
    const byProvider: Record<string, Record<string, { prompt: number; completion: number }>> = {};
    for (const r of raw) {
      const prov = r.provider ?? "unknown";
      if (!byProvider[prov]) byProvider[prov] = {};
      if (!byProvider[prov][r.model]) byProvider[prov][r.model] = { prompt: 0, completion: 0 };
      byProvider[prov][r.model].prompt += r.promptTokens;
      byProvider[prov][r.model].completion += r.completionTokens;
    }

    // Build sorted provider groups: sort providers by total tokens desc, models within each provider by total desc
    return Object.entries(byProvider)
      .map(([provider, models]) => {
        const modelRows = Object.entries(models)
          .sort((a, b) => (b[1].prompt + b[1].completion) - (a[1].prompt + a[1].completion))
          .map(([model, counts]) => ({ model, ...counts }));
        const totalTokens = modelRows.reduce((s, m) => s + m.prompt + m.completion, 0);
        return { provider, models: modelRows, totalTokens };
      })
      .sort((a, b) => b.totalTokens - a.totalTokens);
  }, [raw]);

  if (providerGroups.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-xs font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">Token Usage (30 min)<InfoTooltip text="Prompt vs completion token breakdown per model over the last 30 minutes" /></h2>
        <p className="text-gray-500 text-sm">No data yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-xs font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">Token Usage (30 min)<InfoTooltip text="Prompt vs completion token breakdown per model over the last 30 minutes" /></h2>
      <div className="space-y-3">
        {providerGroups.map(({ provider, models, totalTokens: provTotal }) => (
          <div key={provider} className="space-y-2">
            {/* Provider header per UI-SPEC: text-xs font-semibold uppercase with color dot */}
            <div className="flex items-center gap-2 pt-2">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: getModelColor(models[0]?.model ?? provider) }}
              />
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                {PROVIDER_DISPLAY_NAMES[provider] ?? provider}
              </span>
              <span className="text-[10px] text-gray-500 ml-auto">
                {provTotal.toLocaleString()} tokens
              </span>
            </div>
            {/* Nested model bars with pl-2 indent per UI-SPEC */}
            <div className="pl-2 space-y-2">
              {models.map(({ model, prompt, completion }) => {
                const total = prompt + completion;
                const color = getModelColor(model);
                const promptPct = total > 0 ? (prompt / total) * 100 : 0;
                const completionPct = total > 0 ? (completion / total) * 100 : 0;
                return (
                  <div key={model}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono text-gray-300">{model}</span>
                      <span className="text-xs text-gray-500">{total.toLocaleString()} tokens</span>
                    </div>
                    <div className="flex h-4 rounded overflow-hidden gap-px">
                      <div
                        className="h-full"
                        style={{ width: `${promptPct}%`, backgroundColor: color, opacity: 0.5 }}
                        title={`Prompt: ${prompt.toLocaleString()}`}
                      />
                      <div
                        className="h-full"
                        style={{ width: `${completionPct}%`, backgroundColor: color, opacity: 0.9 }}
                        title={`Completion: ${completion.toLocaleString()}`}
                      />
                    </div>
                    <div className="flex gap-3 mt-0.5">
                      <span className="text-[10px] text-gray-500">In: {prompt.toLocaleString()}</span>
                      <span className="text-[10px] text-gray-500">Out: {completion.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
