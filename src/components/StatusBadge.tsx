import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "ok" | "error" | "warn" | "idle" | string;
  label?: string;
}

const semanticStyles: Record<string, string> = {
  ok: "bg-(--status-ok) text-white",
  error: "bg-(--status-error) text-white",
  warn: "bg-(--status-warn) text-white",
  idle: "bg-muted text-muted-foreground",
};

const legacyMap: Record<string, { semantic: string; label: string }> = {
  queued: { semantic: "idle", label: "QUEUED" },
  running: { semantic: "warn", label: "RUNNING" },
  completed: { semantic: "ok", label: "DONE" },
  failed: { semantic: "error", label: "FAILED" },
  cancelled: { semantic: "warn", label: "CANCELLED" },
  timed_out: { semantic: "warn", label: "TIMEOUT" },
  // Execution modes (v6.0)
  strict: { semantic: "error", label: "STRICT" },
  adaptive: { semantic: "warn", label: "ADAPTIVE" },
  standard: { semantic: "ok", label: "STANDARD" },
  filler: { semantic: "warn", label: "FILLER" },
  stalled: { semantic: "error", label: "STALLED" },
  // Voice call statuses (Phase 72)
  live: { semantic: "ok", label: "LIVE" },
  ended: { semantic: "idle", label: "ENDED" },
  joining: { semantic: "warn", label: "JOINING" },
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const legacy = legacyMap[status];
  const resolvedSemantic = legacy?.semantic ?? status;
  const resolvedLabel = label ?? legacy?.label ?? status.toUpperCase();
  const style = semanticStyles[resolvedSemantic] ?? semanticStyles.idle;

  return (
    <Badge variant="secondary" className={cn("rounded-sm text-xs", style)}>
      {resolvedLabel}
    </Badge>
  );
}

export default StatusBadge;
