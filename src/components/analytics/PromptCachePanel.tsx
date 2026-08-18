import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { thresholdColor } from "../MetricCard";

/**
 * GlassPanel ownership: the PAGE owns the outer GlassPanel (pure layout),
 * matching the existing "LLM Analytics" call site
 * (boundary wraps `<GlassPanel><LlmAnalyticsPanel /></GlassPanel>`).
 * This component renders only the header row and the table/empty-state content.
 *
 * Self-fetching: owns llm.cacheStats. No error handling here (D-02) — relies
 * entirely on the error-boundary wrapper its parent supplies.
 */
export default function PromptCachePanel() {
  const cacheStats = useQuery(api.llm.cacheStats, {});

  return (
    <>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
          Prompt Cache by Model — last 24h
        </h3>
        <span className="text-xs text-muted-foreground">
          cache reads bill at ~0.1× input
        </span>
      </div>
      {!cacheStats || cacheStats.byModel.length === 0 ? (
        <p className="text-sm text-muted-foreground">No Anthropic calls in the last 24h.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border/50">
                <th className="py-1 pr-4 font-medium">Model</th>
                <th className="py-1 pr-4 font-medium text-right">Calls</th>
                <th className="py-1 pr-4 font-medium text-right">Hit Rate</th>
                <th className="py-1 pr-4 font-medium text-right">Cache Read</th>
                <th className="py-1 font-medium text-right">Total Prompt</th>
              </tr>
            </thead>
            <tbody>
              {cacheStats.byModel.map((m) => (
                <tr key={m.model} className="border-b border-border/30 last:border-0">
                  <td className="py-1.5 pr-4 font-mono">{m.model}</td>
                  <td className="py-1.5 pr-4 text-right tabular-nums">{m.calls.toLocaleString()}</td>
                  <td
                    className="py-1.5 pr-4 text-right tabular-nums font-medium"
                    style={{ color: thresholdColor(m.hitRate * 100, { ok: 50, warn: 20, invertDirection: true }) }}
                  >
                    {(m.hitRate * 100).toFixed(1)}%
                  </td>
                  <td className="py-1.5 pr-4 text-right tabular-nums text-muted-foreground">
                    {m.cacheReadInputTokens.toLocaleString()}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                    {m.totalPromptTokens.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
