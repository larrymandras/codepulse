/**
 * AlertLifecycleActions — row-level action buttons for alert management.
 *
 * Renders a horizontal cluster of:
 *   - Acknowledge (ghost, single-click, optimistic opacity-60)
 *   - Mute / Unmute (via MuteDurationPicker popover)
 *   - Escalate (opens Dialog → creates Kanban task)
 *
 * Wired to:
 *   - api.alertLifecycle.acknowledgeAlert
 *   - api.alertMutes.muteTarget / unmuteTarget
 *   - api.alertLifecycle.escalateToTask
 *
 * Phase 06-05: ALR-01, ALR-06
 */

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { type Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MuteDurationPicker } from "./MuteDurationPicker";

// ─── Severity → priority map ──────────────────────────────────────────────────

const SEVERITY_PRIORITY: Record<string, string> = {
  critical: "urgent",
  error: "high",
  warning: "medium",
  info: "low",
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface AlertLifecycleActionsProps {
  alertId: Id<"alerts">;
  alertTitle: string;
  alertSeverity: string;
  status?: string;
  isMuted: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AlertLifecycleActions({
  alertId,
  alertTitle,
  alertSeverity,
  status,
  isMuted,
}: AlertLifecycleActionsProps) {
  // ─── Mutations ─────────────────────────────────────────────────────────────
  const acknowledgeAlert = useMutation(api.alertLifecycle.acknowledgeAlert);
  const muteTarget = useMutation(api.alertMutes.muteTarget);
  const unmuteTarget = useMutation(api.alertMutes.unmuteTarget);
  const escalateToTask = useMutation(api.alertLifecycle.escalateToTask);

  // ─── Escalate dialog state ─────────────────────────────────────────────────
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState(alertTitle);
  const [taskDescription, setTaskDescription] = useState("");
  const [taskPriority, setTaskPriority] = useState(
    SEVERITY_PRIORITY[alertSeverity] ?? "medium"
  );
  const [escalating, setEscalating] = useState(false);
  const [linkedToTask, setLinkedToTask] = useState(false);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function handleAcknowledge() {
    void acknowledgeAlert({ alertId, acknowledgedBy: "operator" });
  }

  function handleMuteSelect(duration: string) {
    void muteTarget({
      targetType: "alert",
      targetId: alertId,
      duration,
      mutedBy: "operator",
    });
  }

  function handleUnmute() {
    void unmuteTarget({ targetType: "alert", targetId: alertId });
  }

  async function handleEscalate() {
    if (!taskTitle.trim()) return;
    setEscalating(true);
    try {
      await escalateToTask({
        alertId,
        title: taskTitle.trim(),
        description: taskDescription.trim() || undefined,
        priority: taskPriority,
      });
      toast.success("Task created successfully.");
      setLinkedToTask(true);
      setEscalateOpen(false);
    } catch {
      toast.error("Failed to create task. Try again.");
    } finally {
      setEscalating(false);
    }
  }

  // ─── Visibility rules ──────────────────────────────────────────────────────

  const canAcknowledge =
    status !== "acknowledged" && status !== "resolved";

  return (
    <div className="flex items-center gap-1 shrink-0">
      {/* Acknowledge */}
      {canAcknowledge && (
        <Button
          variant="ghost"
          size="sm"
          className="text-base"
          onClick={handleAcknowledge}
        >
          Acknowledge
        </Button>
      )}

      {/* Mute / Unmute */}
      {isMuted ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-base"
          onClick={handleUnmute}
        >
          Unmute
        </Button>
      ) : (
        <MuteDurationPicker
          onSelect={handleMuteSelect}
          trigger={
            <Button variant="ghost" size="sm" className="text-base">
              Mute
            </Button>
          }
        />
      )}

      {/* Escalate */}
      <Button
        variant="ghost"
        size="sm"
        className="text-base"
        onClick={() => {
          setTaskTitle(alertTitle);
          setTaskDescription("");
          setTaskPriority(SEVERITY_PRIORITY[alertSeverity] ?? "medium");
          setEscalateOpen(true);
        }}
        disabled={linkedToTask}
      >
        {linkedToTask ? (
          <span className="text-sm bg-muted px-2 inline rounded">
            Linked to task
          </span>
        ) : (
          "Escalate"
        )}
      </Button>

      {/* Escalate Dialog */}
      <Dialog open={escalateOpen} onOpenChange={setEscalateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escalate to Task</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1">
              <label className="text-base font-medium">Task title</label>
              <Input
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Task title"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-base font-medium">
                Description{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </label>
              <Textarea
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Additional context…"
                rows={3}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-base font-medium">Priority</label>
              <Select value={taskPriority} onValueChange={setTaskPriority}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              onClick={() => void handleEscalate()}
              disabled={escalating || !taskTitle.trim()}
            >
              {escalating ? "Creating…" : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
