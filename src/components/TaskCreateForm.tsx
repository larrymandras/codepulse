/**
 * TaskCreateForm — dialog form for creating a new Kanban task.
 * Supports pre-fill from ideation findings.
 * Phase 04 Plan 06: finding pre-fill, labels, due date.
 */

import { useState } from "react";
import type { NewTask, TaskColumn, TaskPriority } from "../types/kanban";

interface TaskCreateFormProps {
  open: boolean;
  defaultColumn?: TaskColumn;
  prefillData?: Partial<NewTask> | null;
  onCancel: () => void;
  onSubmit: (task: NewTask) => void | Promise<void>;
}

const COLUMN_LABELS: Record<TaskColumn, string> = {
  backlog: "Backlog",
  queued: "Queued",
  running: "Running",
  review: "Review",
  done: "Done",
  cancelled: "Cancelled",
};

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const AGENT_OPTIONS = [
  { id: "astrid", name: "Ástríðr" },
  { id: "hildr", name: "Hildr" },
  { id: "gondul", name: "Gondul" },
  { id: "ragnhildr", name: "Ragnhildr" },
  { id: "freya", name: "Freya" },
];

export function TaskCreateForm({
  open,
  defaultColumn = "backlog",
  prefillData,
  onCancel,
  onSubmit,
}: TaskCreateFormProps) {
  const [title, setTitle] = useState(prefillData?.title ?? "");
  const [description, setDescription] = useState(prefillData?.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(prefillData?.priority ?? "medium");
  const [labelsInput, setLabelsInput] = useState((prefillData?.labels ?? []).join(", "));
  const [dueDate, setDueDate] = useState("");
  const [agentId, setAgentId] = useState("");

  if (!open) return null;

  function parseLabels(input: string): string[] {
    return input
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    const agent = AGENT_OPTIONS.find((a) => a.id === agentId);
    const labels = parseLabels(labelsInput);

    await onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      labels: labels.length ? labels : undefined,
      dueAt: dueDate ? new Date(dueDate).getTime() / 1000 : undefined,
      findingId: prefillData?.findingId,
      agentId: agent?.id,
      agentName: agent?.name,
    });

    // Reset
    setTitle("");
    setDescription("");
    setPriority("medium");
    setLabelsInput("");
    setDueDate("");
    setAgentId("");
  }

  const labels = parseLabels(labelsInput);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onCancel}
    >
      {/* Dialog panel */}
      <div
        className="bg-(--card) border border-(--border) w-full max-w-md mx-4 p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-(--foreground)">New Task</h2>
          <button
            onClick={onCancel}
            className="text-(--muted-foreground) hover:text-(--foreground) text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <p className="text-xs text-(--muted-foreground)">
          Adding to:{" "}
          <span className="font-medium text-(--foreground)">
            {COLUMN_LABELS[defaultColumn]}
          </span>
        </p>

        {/* Pre-fill notice (per UI-SPEC) */}
        {prefillData?.findingId && (
          <p className="text-xs text-(--muted-foreground) italic mb-4">
            Pre-filled from finding: {prefillData.title}
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Title */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-(--muted-foreground) uppercase tracking-wider">
              Title <span className="text-(--status-error)">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title..."
              required
              autoFocus
              className="bg-(--background) border border-(--border) text-(--foreground) text-sm px-3 py-2 outline-none focus:ring-1 focus:ring-(--primary) placeholder:text-(--muted-foreground)"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-(--muted-foreground) uppercase tracking-wider">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={3}
              className="bg-(--background) border border-(--border) text-(--foreground) text-sm px-3 py-2 outline-none focus:ring-1 focus:ring-(--primary) placeholder:text-(--muted-foreground) resize-none"
            />
          </div>

          {/* Priority */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-(--muted-foreground) uppercase tracking-wider">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="bg-(--background) border border-(--border) text-(--foreground) text-sm px-3 py-2 outline-none focus:ring-1 focus:ring-(--primary)"
            >
              {PRIORITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Labels */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-(--muted-foreground) uppercase tracking-wider">
              Labels
            </label>
            <input
              type="text"
              value={labelsInput}
              onChange={(e) => setLabelsInput(e.target.value)}
              placeholder="Comma-separated, e.g. security, critical"
              className="bg-(--background) border border-(--border) text-(--foreground) text-sm px-3 py-2 outline-none focus:ring-1 focus:ring-(--primary) placeholder:text-(--muted-foreground)"
            />
            {labels.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {labels.map((label) => (
                  <span
                    key={label}
                    className="text-[10px] px-1.5 py-0.5 bg-(--muted) text-(--muted-foreground) border border-(--border)"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Due Date */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-(--muted-foreground) uppercase tracking-wider">
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-(--background) border border-(--border) text-(--foreground) text-sm px-3 py-2 outline-none focus:ring-1 focus:ring-(--primary)"
            />
          </div>

          {/* Agent */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-(--muted-foreground) uppercase tracking-wider">
              Assign Agent
            </label>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="bg-(--background) border border-(--border) text-(--foreground) text-sm px-3 py-2 outline-none focus:ring-1 focus:ring-(--primary)"
            >
              <option value="">Unassigned</option>
              {AGENT_OPTIONS.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2 border-t border-(--border)">
            <button
              type="button"
              onClick={onCancel}
              className="text-sm text-(--muted-foreground) hover:text-(--foreground) px-3 py-1.5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="text-sm bg-(--primary) text-(--primary-foreground) px-4 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
