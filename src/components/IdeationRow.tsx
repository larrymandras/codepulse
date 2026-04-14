import { Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/StatusBadge";

export interface IdeationRowFinding {
  _id: string;
  scanType: string;
  severity: string;
  category: string;
  description: string;
  suggestedFix?: string;
  status?: string;
  taskId?: string;
  dismissed: boolean;
  createdAt: number;
}

interface IdeationRowProps {
  finding: IdeationRowFinding;
  isSelected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onCreateTask: (finding: IdeationRowFinding) => void;
  onAcknowledge: (id: string) => void;
  onDismiss: (id: string) => void;
}

const SEVERITY_CLASSES: Record<string, string> = {
  critical: "bg-(--status-error) text-white",
  high: "bg-(--status-error)/70 text-white",
  medium: "bg-(--status-warn) text-(--foreground)",
  low: "bg-(--status-ok) text-white",
};

const FINDING_STATUS_MAP: Record<string, { semantic: string; label: string }> = {
  open: { semantic: "idle", label: "OPEN" },
  acknowledged: { semantic: "warn", label: "ACK'D" },
  converted: { semantic: "ok", label: "CONVERTED" },
  dismissed: { semantic: "idle", label: "DISMISSED" },
};

export function IdeationRow({
  finding,
  isSelected,
  onSelect,
  onCreateTask,
  onAcknowledge,
  onDismiss,
}: IdeationRowProps) {
  const effectiveStatus = finding.status ?? (finding.dismissed ? "dismissed" : "open");
  const statusEntry = FINDING_STATUS_MAP[effectiveStatus] ?? FINDING_STATUS_MAP.open;
  const severityClass = SEVERITY_CLASSES[finding.severity] ?? "bg-muted text-muted-foreground";

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 border-b border-(--border) last:border-b-0${effectiveStatus === "dismissed" ? " opacity-60" : ""}`}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={(c) => onSelect(finding._id, !!c)}
      />

      <span
        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-none shrink-0 ${severityClass}`}
      >
        {finding.severity.toUpperCase()}
      </span>

      <span className="text-[10px] font-mono text-(--muted-foreground) shrink-0">
        {finding.scanType}
      </span>

      <span className="text-xs text-(--muted-foreground) shrink-0">
        {finding.category}
      </span>

      <span className="text-sm text-(--foreground) flex-1 truncate">
        {finding.description}
      </span>

      <StatusBadge status={statusEntry.semantic} label={statusEntry.label} />

      {finding.taskId && (
        <span className="text-[10px] px-1 py-0.5 bg-(--status-ok)/20 text-(--status-ok) shrink-0">
          Task linked
        </span>
      )}

      <div className="flex items-center gap-1 shrink-0">
        {effectiveStatus !== "converted" && (
          <button
            onClick={() => onCreateTask(finding)}
            title="Create Task"
            aria-label="Create Task"
            className="p-0.5 text-(--muted-foreground) hover:text-(--foreground) transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}

        {effectiveStatus === "open" && (
          <button
            onClick={() => onAcknowledge(finding._id)}
            className="text-[10px] px-1.5 py-0.5 text-(--muted-foreground) hover:text-(--foreground) transition-colors"
          >
            ACK
          </button>
        )}

        {effectiveStatus !== "dismissed" && (
          <button
            onClick={() => onDismiss(finding._id)}
            className="text-[10px] px-1.5 py-0.5 text-(--muted-foreground) hover:text-(--foreground) transition-colors"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}

export default IdeationRow;
