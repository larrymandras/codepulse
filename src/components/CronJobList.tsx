import { useState } from "react";
import { CRON_SCHEDULES, estimateNextRun } from "../lib/cronSchedules";
import { formatTimestamp, formatDurationMs, relativeTime } from "../lib/formatters";
import InfoTooltip from "./InfoTooltip";

interface CronJobListProps {
  executions: any[];
}

function statusDot(success: boolean | null): string {
  if (success === null) return "bg-gray-500";
  return success ? "bg-green-400" : "bg-red-400";
}

export default function CronJobList({ executions }: CronJobListProps) {
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  // Group executions by job name
  const byJob = new Map<string, any[]>();
  for (const exec of executions) {
    const list = byJob.get(exec.jobName) || [];
    list.push(exec);
    byJob.set(exec.jobName, list);
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">
        Cron Jobs
        <span className="ml-2 text-xs text-gray-500 font-normal">{CRON_SCHEDULES.length}</span>
        <InfoTooltip text="Scheduled background jobs running in Convex. Click a job to see recent execution history." />
      </h2>
      <div className="space-y-1 max-h-[520px] overflow-y-auto">
        {CRON_SCHEDULES.map((schedule) => {
          const jobExecs = byJob.get(schedule.jobName) || [];
          const lastExec = jobExecs[0] ?? null;
          const lastSuccess = lastExec?.success ?? null;
          const isExpanded = expandedJob === schedule.jobName;
          const nextRun = estimateNextRun(schedule, lastExec?.timestamp);

          return (
            <div key={schedule.jobName}>
              <div
                onClick={() => setExpandedJob(isExpanded ? null : schedule.jobName)}
                className="flex items-center justify-between bg-gray-900/50 rounded-lg px-4 py-2.5 cursor-pointer hover:bg-gray-700/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot(lastSuccess)}`} />
                  <span className="text-sm font-mono text-gray-200 truncate">{schedule.label}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 flex-shrink-0">
                    {schedule.interval}
                  </span>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0 ml-2">
                  {lastExec ? (
                    <>
                      <span className="text-xs text-gray-400">{formatDurationMs(lastExec.durationMs)}</span>
                      <span className="text-xs text-gray-500 font-mono">{relativeTime(lastExec.timestamp)}</span>
                    </>
                  ) : (
                    <span className="text-xs text-gray-600">Never run</span>
                  )}
                  <span className="text-gray-600 text-xs">{isExpanded ? "\u25B2" : "\u25BC"}</span>
                </div>
              </div>
              {isExpanded && (
                <div className="ml-5 mt-1 mb-2 bg-gray-900/80 border border-gray-700/40 rounded-lg px-4 py-3 space-y-3 text-xs">
                  <div className="grid grid-cols-3 gap-x-6 gap-y-1.5">
                    <div>
                      <span className="text-gray-500">Job Name</span>
                      <p className="text-gray-200 font-mono">{schedule.jobName}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Schedule</span>
                      <p className="text-gray-300">{schedule.interval}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Next Run (est.)</span>
                      <p className="text-gray-300 font-mono">~{relativeTime(nextRun).replace(" ago", "")}</p>
                    </div>
                  </div>
                  {jobExecs.length > 0 ? (
                    <div>
                      <span className="text-gray-500 block mb-1">Recent Executions</span>
                      <div className="space-y-0.5">
                        {jobExecs.slice(0, 8).map((exec: any, i: number) => (
                          <div
                            key={exec._id}
                            className={`flex items-center gap-3 px-2 py-1 rounded ${i % 2 === 0 ? "bg-gray-800/30" : ""}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${exec.success ? "bg-green-400" : "bg-red-400"}`} />
                            <span className="text-gray-500 font-mono w-20">{formatTimestamp(exec.timestamp)}</span>
                            <span className="text-gray-400">{formatDurationMs(exec.durationMs)}</span>
                            {exec.error && <span className="text-red-400 truncate">{exec.error}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-600">No execution history</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
