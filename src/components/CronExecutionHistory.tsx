import { formatTimestamp, formatDurationMs } from "../lib/formatters";
import InfoTooltip from "./InfoTooltip";

interface CronExecutionHistoryProps {
  executions: any[];
}

export default function CronExecutionHistory({ executions }: CronExecutionHistoryProps) {
  return (
    <div className="bg-card/50 border border-border/50 rounded-xl p-4">
      <h2 className="text-sm font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">
        Execution History
        <span className="ml-2 text-sm text-muted-foreground font-normal">{executions.length}</span>
        <InfoTooltip text="Recent cron job executions across all jobs, ordered by time." />
      </h2>
      {executions.length === 0 ? (
        <p className="text-base text-muted-foreground py-6 text-center">No executions recorded yet</p>
      ) : (
        <div className="max-h-[360px] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center gap-3 px-3 py-1.5 text-xs text-muted-foreground uppercase tracking-wider border-b border-border/30 sticky top-0 bg-card/80">
            <span className="w-20">Time</span>
            <span className="flex-1">Job</span>
            <span className="w-16 text-right">Duration</span>
            <span className="w-14 text-right">Status</span>
          </div>
          <div className="space-y-0">
            {executions.map((exec: any, i: number) => (
              <div
                key={exec._id}
                className={`flex items-center gap-3 px-3 py-1.5 text-sm ${i % 2 === 0 ? "bg-muted/30" : ""}`}
              >
                <span className="text-muted-foreground font-mono w-20">{formatTimestamp(exec.timestamp)}</span>
                <span className="flex-1 font-mono text-foreground truncate">{exec.jobName}</span>
                <span className="text-muted-foreground w-16 text-right">{formatDurationMs(exec.durationMs)}</span>
                <span className={`w-14 text-right ${exec.success ? "text-green-400" : "text-red-400"}`}>
                  {exec.success ? "OK" : "FAIL"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
