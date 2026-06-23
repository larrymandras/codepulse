import { FlexBarChart } from "./FlexBarChart";
import InfoTooltip from "./InfoTooltip";

interface ToolBreakdownProps {
  events: any[];
}

export default function ToolBreakdown({ events }: ToolBreakdownProps) {
  const counts = new Map<string, number>();
  for (const event of events) {
    if (event.toolName) {
      counts.set(event.toolName, (counts.get(event.toolName) || 0) + 1);
    }
  }

  const data = Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  return (
    <div className="glow-card bg-card/60 backdrop-blur-md border border-border/50 rounded-xl p-6 relative overflow-hidden flex flex-col max-h-[450px] hover:border-primary/50 transition-colors shadow-[0_0_15px_rgba(16,185,129,0.05)] hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]">
      <h2 className="text-sm font-mono tracking-widest text-primary uppercase mb-6 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        Tool Usage
        <InfoTooltip text="Top 10 most-used tools ranked by execution count" />
      </h2>
      {data.length === 0 ? (
        <p className="text-sm font-mono text-muted-foreground py-8 text-center">No tool data yet</p>
      ) : (
        <div className="mt-4">
          <FlexBarChart data={data} height={200} />
        </div>
      )}
    </div>
  );
}
