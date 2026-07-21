/**
 * MoveToProjectDialog — small workspace-picker Move dialog (Phase 98, LIFE-03).
 *
 * NOT a port of IntakeModal — no host picker, no destination toggle, no
 * file/URL XOR. Reuses IntakeModal's workspace `Select` block verbatim
 * (98-PATTERNS.md, `MoveToProjectDialog.tsx` section): `workspaces` comes
 * from `useQuery(api.forge.listWorkspaces, hostId ? { hostId } : "skip")`
 * with NO `class`-based filter (Pitfall 2 — both "synced" and "local-only"
 * workspaces render identically). "Move to Global…" has no sub-target and
 * is enqueued directly by the caller (Plan 98-04) — this dialog only ever
 * handles the project-scope direction.
 */

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface MoveToProjectDialogProps {
  skillName: string;
  sourceOrigin: string;
  hostId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired after enqueueLifecycle resolves (fire-and-forget by the caller). */
  onMoved?: () => void;
}

export function MoveToProjectDialog({
  skillName,
  sourceOrigin,
  hostId,
  open,
  onOpenChange,
  onMoved,
}: MoveToProjectDialogProps) {
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const enqueueLifecycle = useMutation(api.forge.enqueueLifecycle);

  // NO class-based filter — Pitfall 2. Both "synced" and "local-only"
  // workspaces appear identically, mirroring IntakeModal's workspace picker.
  const workspacesRaw = useQuery(
    api.forge.listWorkspaces,
    hostId ? { hostId } : "skip"
  );
  const workspaces = workspacesRaw ?? [];

  // Reset the picker each time the dialog opens, so a stale selection from a
  // previous open never survives (mirrors IntakeModal's open-reset effect).
  useEffect(() => {
    if (open) {
      setWorkspaceId("");
      setSubmitting(false);
    }
  }, [open]);

  const confirmDisabled = workspaceId === "" || submitting;

  const handleConfirm = async () => {
    if (confirmDisabled) return;
    setSubmitting(true);
    const commandId = crypto.randomUUID();
    try {
      await enqueueLifecycle({
        hostId,
        commandId,
        action: "move",
        skillName,
        sourceOrigin,
        destination: "project",
        workspaceId,
      });
      onMoved?.();
    } finally {
      setSubmitting(false);
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Move &quot;{skillName}&quot; to Project</DialogTitle>
          <DialogDescription>
            Choose a synced workspace. The skill moves immediately once you
            confirm.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="move-workspace-select" className="text-base">
            Workspace
          </label>
          <Select
            value={workspaceId}
            onValueChange={setWorkspaceId}
            disabled={workspaces.length === 0}
          >
            <SelectTrigger id="move-workspace-select" aria-label="Workspace">
              <SelectValue placeholder="Select workspace" />
            </SelectTrigger>
            <SelectContent>
              {workspaces.map((ws) => (
                <SelectItem key={ws.workspaceId} value={ws.workspaceId}>
                  <span className="flex items-center gap-2">
                    {ws.name}
                    <Badge
                      variant={ws.class === "synced" ? "default" : "outline"}
                      className="text-sm"
                    >
                      {ws.class}
                    </Badge>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {workspaces.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No workspaces synced from this host yet.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel Move
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={handleConfirm}
            disabled={confirmDisabled}
          >
            Move skill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
