/**
 * DeleteSkillDialog — GitHub-style type-to-confirm permanent-delete AlertDialog
 * (Phase 98, LIFE-04 / D-06).
 *
 * Copies ForgeStopConfirmDialog's AlertDialog structure and adds the D-06
 * type-to-confirm gate on top: the destructive AlertDialogAction stays
 * disabled until the typed confirmation text exactly (case-sensitive, trimmed)
 * matches the skill's real name. `.claude/` is gitignored — there is no git
 * safety net, so a misclick or stray paste must never be enough to delete.
 *
 * Only ever mounted for cold-storage/dormant rows (D-05 — true deletion is
 * cold-only; Plan 98-04 gates which rows render this dialog).
 */

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

interface DeleteSkillDialogProps {
  skillName: string;
  sourceOrigin: string;
  hostId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired after enqueueLifecycle resolves (fire-and-forget by the caller). */
  onDeleted?: () => void;
}

export function DeleteSkillDialog({
  skillName,
  sourceOrigin,
  hostId,
  open,
  onOpenChange,
  onDeleted,
}: DeleteSkillDialogProps) {
  // No pre-fill, no autofocus-and-select-all (D-06) — deliberate typing (or
  // an explicit paste) is required every time the dialog opens.
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const enqueueLifecycle = useMutation(api.forge.enqueueLifecycle);

  useEffect(() => {
    if (open) {
      setConfirmText("");
      setSubmitting(false);
    }
  }, [open]);

  // Case-sensitive, trimmed exact match — "  legal  " matches "legal";
  // "Legal" does NOT match "legal" (no case-fold).
  const canDelete = confirmText.trim() === skillName && !submitting;

  const handleConfirm = async () => {
    if (!canDelete) return;
    setSubmitting(true);
    const commandId = crypto.randomUUID();
    try {
      await enqueueLifecycle({
        hostId,
        commandId,
        action: "delete",
        skillName,
        sourceOrigin,
        destination: "cold",
        workspaceId: null,
      });
      onDeleted?.();
    } finally {
      setSubmitting(false);
      onOpenChange(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete &quot;{skillName}&quot; permanently?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This removes the file from disk. There is no undo and no git
            history for .claude/ — type the skill name to confirm.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={`Type "${skillName}" to confirm`}
          aria-label={`Type "${skillName}" to confirm deletion`}
        />

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!canDelete}
            onClick={handleConfirm}
            className="bg-destructive/10 text-destructive hover:bg-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30"
          >
            Delete Permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
