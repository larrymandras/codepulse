import { useState } from "react";
import { Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/StatusBadge";
import { cronToHuman } from "@/lib/cronToHuman";

export interface CronJob {
  name: string;
  expression: string;
  enabled?: boolean;
}

interface CronJobListProps {
  jobs: CronJob[];
  onTrigger: (jobName: string) => void;
  onToggle: (jobName: string, enabled: boolean) => void;
  onEdit: (job: CronJob) => void;
}

export default function CronJobList({
  jobs,
  onTrigger,
  onToggle,
  onEdit,
}: CronJobListProps) {
  const [triggeringJob, setTriggeringJob] = useState<string | null>(null);

  async function handleTrigger(jobName: string) {
    setTriggeringJob(jobName);
    onTrigger(jobName);
    // Reset after timeout (actual reset should happen on WS ack)
    setTimeout(() => setTriggeringJob(null), 3000);
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2 border border-(--border) bg-(--card)">
        <h3 className="text-sm font-semibold text-(--foreground)">
          No cron jobs configured
        </h3>
        <p className="text-xs text-(--muted-foreground)">
          Add a scheduled job to automate Astrid tasks.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-(--border) bg-(--card)">
      {jobs.map((job) => (
        <div
          key={job.name}
          className="flex items-center gap-3 px-3 py-2.5 border-b border-(--border) last:border-b-0 min-h-[44px]"
        >
          {/* Job info */}
          <div
            className="flex flex-col gap-0.5 flex-1 min-w-0 cursor-pointer"
            onClick={() => onEdit(job)}
          >
            <span className="text-sm font-medium text-(--foreground) truncate">
              {job.name}
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-(--muted-foreground)">
                {job.expression}
              </span>
              <span className="text-xs text-(--muted-foreground)">
                {cronToHuman(job.expression)}
              </span>
            </div>
          </div>

          {/* Trailing controls */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Play button - manual trigger */}
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7"
              onClick={() => handleTrigger(job.name)}
              disabled={triggeringJob === job.name}
            >
              {triggeringJob === job.name ? (
                <Loader2 className="animate-spin w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </Button>

            {/* Toggle switch - enable/disable */}
            <Switch
              checked={job.enabled !== false}
              onCheckedChange={(checked) => onToggle(job.name, checked)}
            />

            {/* Status badge */}
            <StatusBadge
              status={job.enabled !== false ? "ok" : "idle"}
              label={job.enabled !== false ? "ACTIVE" : "DISABLED"}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
