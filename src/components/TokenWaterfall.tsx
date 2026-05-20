import { useMemo } from "react";
import { useTokenWaterfall } from "../hooks/useAdvancedAnalytics";
import InfoTooltip from "./InfoTooltip";

const MODEL_COLORS: Record<string, string> = {
  "claude-opus": "#fbbf24",
  "claude-sonnet": "#22d3ee",
  "claude-haiku": "#34d399",
  opus: "#fbbf24",
  sonnet: "#22d3ee",
  haiku: "#34d399",
  ollama: "#f97316",
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

  const rows = useMemo(() => {
    if (raw.length === 0) return [];

    const byModel: Record<string, { prompt: number; completion: number }> = {};
    for (const r of raw) {
      if (!byModel[r.model]) byModel[r.model] = { prompt: 0, completion: 0 };
      byModel[r.model].prompt += r.promptTokens;
      byModel[r.model].completion += r.completionTokens;
    }

    return Object.entries(byModel)
      .sort((a, b) => (b[1].prompt + b[1].completion) - (a[1].prompt + a[1].completion))
      .map(([model, counts]) => ({ model, ...counts }));
  }, [raw]);

  if (rows.length === 0) {
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
        {rows.map(({ model, prompt, completion }) => {
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
                <span className="text-[10px] text-gray-500">
                  In: {prompt.toLocaleString()}
                </span>
                <span className="text-[10px] text-gray-500">
                  Out: {completion.toLocaleString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
