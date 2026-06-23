import { useMemo } from "react";
import { Activity, Clock, Coins, Cpu, Layers, Wrench } from "lucide-react";

type Block = { type: string; [key: string]: unknown };

interface RunSummaryProps {
  rounds?: number;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  startedAt?: number;
  completedAt?: number;
  status: "idle" | "running" | "completed" | "error";
  blocks: Block[];
}

function formatDuration(startMs: number, endMs: number): string {
  const seconds = (endMs - startMs) / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(0);
  return `${mins}m ${secs}s`;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function formatCost(n: number): string {
  return `$${n.toFixed(3)}`;
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-(--card) border border-(--border) rounded p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-(--muted-foreground)">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-lg font-semibold text-(--foreground) font-mono">{value}</span>
    </div>
  );
}

export function RunSummary({ rounds, inputTokens, outputTokens, cost, startedAt, completedAt, status, blocks }: RunSummaryProps) {
  const toolCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of blocks) {
      if (b.type === "tool_call") {
        const name = (b.tool_name as string) ?? "unknown";
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
    return counts;
  }, [blocks]);

  const failoverTrail = useMemo(() => {
    return blocks
      .filter((b) => b.type === "failover")
      .map((b) => ({
        from: (b.failedProvider as string) ?? "unknown",
        to: (b.newProvider as string) ?? "unknown",
      }));
  }, [blocks]);

  if (status === "idle") {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-base text-(--muted-foreground)">No run data yet.</p>
      </div>
    );
  }

  const isLive = status === "running";
  const duration = startedAt && completedAt ? formatDuration(startedAt, completedAt) : isLive && startedAt ? "running…" : "—";
  const statusColor = status === "completed" ? "text-(--status-ok)" : status === "error" ? "text-(--status-error)" : "text-(--status-warn)";

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={<Layers className="h-3.5 w-3.5" />} label="Rounds" value={rounds != null ? String(rounds) : "—"} />
        <StatCard icon={<Clock className="h-3.5 w-3.5" />} label="Duration" value={duration} />
        <div className="bg-(--card) border border-(--border) rounded p-3 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-(--muted-foreground)">
            <Activity className="h-3.5 w-3.5" />
            <span className="text-sm">Status</span>
          </div>
          <span className={`text-lg font-semibold font-mono ${statusColor}`}>{status}</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={<Cpu className="h-3.5 w-3.5" />} label="Input Tokens" value={inputTokens != null ? formatNumber(inputTokens) : "—"} />
        <StatCard icon={<Cpu className="h-3.5 w-3.5" />} label="Output Tokens" value={outputTokens != null ? formatNumber(outputTokens) : "—"} />
        <StatCard icon={<Coins className="h-3.5 w-3.5" />} label="Cost" value={cost != null ? formatCost(cost) : "—"} />
      </div>
      {failoverTrail.length > 0 && (
        <div className="bg-(--card) border border-(--border) rounded p-3">
          <div className="flex items-center gap-1.5 text-(--muted-foreground) mb-2">
            <Activity className="h-3.5 w-3.5" />
            <span className="text-sm">Provider Trail</span>
          </div>
          <div className="flex flex-col gap-1">
            {failoverTrail.map((f, i) => (
              <span key={i} className="text-sm font-mono text-(--foreground)">
                <span className="text-(--status-error)">{f.from}</span>{" → "}<span className="text-(--status-ok)">{f.to}</span>
              </span>
            ))}
          </div>
        </div>
      )}
      {toolCounts.size > 0 && (
        <div className="bg-(--card) border border-(--border) rounded p-3">
          <div className="flex items-center gap-1.5 text-(--muted-foreground) mb-2">
            <Wrench className="h-3.5 w-3.5" />
            <span className="text-sm">Tool Usage ({toolCounts.size} unique)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from(toolCounts.entries()).map(([name, count]) => (
              <span key={name} className="text-sm font-mono bg-(--secondary) text-(--foreground) px-2 py-0.5 rounded">
                {name} {count > 1 ? `×${count}` : ""}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
