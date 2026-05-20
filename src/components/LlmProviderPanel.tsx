import { useLlmMetrics } from "../hooks/useLlmMetrics";
import { formatCost } from "../lib/formatters";
import InfoTooltip from "./InfoTooltip";

export default function LlmProviderPanel() {
  const { calls } = useLlmMetrics();

  const totalCalls = calls.length;
  const totalTokens = calls.reduce(
    (sum: number, c: any) => sum + (c.totalTokens ?? 0),
    0
  );
  const totalCost = calls.reduce((sum: number, c: any) => sum + (c.cost ?? 0), 0);
  const avgLatency =
    totalCalls > 0
      ? calls.reduce((sum: number, c: any) => sum + (c.latencyMs ?? 0), 0) / totalCalls
      : 0;

  // Group by model
  const byModel = new Map<string, { count: number; cost: number; tokens: number }>();
  for (const c of calls as any[]) {
    const model = c.model ?? "unknown";
    const existing = byModel.get(model) ?? { count: 0, cost: 0, tokens: 0 };
    existing.count += 1;
    existing.cost += c.cost ?? 0;
    existing.tokens += c.totalTokens ?? 0;
    byModel.set(model, existing);
  }

  return (
    <div className="glow-card bg-card/60 backdrop-blur-md border border-border/50 rounded-xl p-6 relative overflow-hidden flex flex-col max-h-[450px] hover:border-primary/50 transition-colors shadow-[0_0_15px_rgba(16,185,129,0.05)] hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]">
      <h2 className="text-xs font-mono tracking-widest text-primary uppercase mb-6 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        LLM Metrics
        <InfoTooltip text="LLM usage metrics: API calls, token consumption, cost, and latency by provider and model" />
      </h2>
      {totalCalls === 0 ? (
        <p className="text-xs font-mono text-muted-foreground py-6 text-center">No LLM calls recorded</p>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 text-[10px] font-mono uppercase tracking-widest">
            <div className="bg-background/50 border border-border/30 rounded-lg p-3 text-center shadow-[0_0_10px_rgba(0,0,0,0.2)] hover:border-primary/40 transition-colors">
              <p className="text-primary/70 mb-1">Calls</p>
              <p className="text-foreground text-sm font-bold tracking-tight">{totalCalls}</p>
            </div>
            <div className="bg-background/50 border border-border/30 rounded-lg p-3 text-center shadow-[0_0_10px_rgba(0,0,0,0.2)] hover:border-primary/40 transition-colors">
              <p className="text-primary/70 mb-1">Tokens</p>
              <p className="text-foreground text-sm font-bold tracking-tight">{totalTokens.toLocaleString()}</p>
            </div>
            <div className="bg-background/50 border border-border/30 rounded-lg p-3 text-center shadow-[0_0_10px_rgba(0,0,0,0.2)] hover:border-primary/40 transition-colors">
              <p className="text-primary/70 mb-1">Cost</p>
              <p className="text-foreground text-sm font-bold tracking-tight">{formatCost(totalCost)}</p>
            </div>
            <div className="bg-background/50 border border-border/30 rounded-lg p-3 text-center shadow-[0_0_10px_rgba(0,0,0,0.2)] hover:border-primary/40 transition-colors">
              <p className="text-primary/70 mb-1">Avg Latency</p>
              <p className="text-foreground text-sm font-bold tracking-tight">{avgLatency.toFixed(0)}ms</p>
            </div>
          </div>

          <div className="border-t border-border/30 pt-4 flex-1 overflow-hidden flex flex-col">
            <p className="text-[10px] font-mono tracking-widest uppercase text-primary/70 mb-3 flex items-center gap-2">
              <span className="w-1 h-1 bg-primary/50 rounded-full" />
              By Model
            </p>
            <div className="space-y-2 overflow-y-auto pr-2">
              {Array.from(byModel.entries())
                .sort((a, b) => b[1].cost - a[1].cost)
                .map(([model, stats]) => (
                  <div key={model} className="flex justify-between items-center text-xs py-1 border-b border-border/10 last:border-0">
                    <span className="text-muted-foreground font-mono truncate mr-2">{model}</span>
                    <span className="text-foreground font-mono whitespace-nowrap">
                      {stats.count} calls <span className="text-primary/40 mx-1">|</span> {formatCost(stats.cost)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
