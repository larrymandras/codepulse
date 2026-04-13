import type { NewTask, TaskPriority } from "@/types/kanban";

interface IdeationFinding {
  _id: string;
  description: string;
  suggestedFix?: string;
  severity: string;
  category: string;
  scanType: string;
}

const SEVERITY_TO_PRIORITY: Record<string, TaskPriority> = {
  critical: "high",
  high: "high",
  medium: "medium",
  low: "low",
};

export function findingToTaskDefaults(finding: IdeationFinding): Partial<NewTask> {
  return {
    title: finding.description,
    description: finding.suggestedFix,
    priority: SEVERITY_TO_PRIORITY[finding.severity] ?? "medium",
    labels: [finding.category, finding.scanType].filter(Boolean),
    findingId: finding._id,
  };
}
