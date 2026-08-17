/**
 * MoveToActionConfirmDialog — shadcn AlertDialog confirm gate for moving a task
 * into an action column (running/cancelled), which dispatches a WS command to
 * Ástríðr (Phase 120, POLISH-03 / D-12 / D-14).
 *
 * Replaces the prior 5-second auto-dismissing toast confirm in Tasks.tsx: a
 * decision that can expire on its own is not a confirm. Copies
 * DeleteSkillDialog's controlled-dialog structure (open/onOpenChange props, no
 * trigger, `e.preventDefault()` on AlertDialogAction so a rejected onConfirm
 * keeps the dialog open) — no timer, no auto-focus-and-confirm shortcut, no
 * countdown anywhere.
 *
 * This component holds no mutation of its own. The page owns `moveColumn` and
 * `dispatch`; this dialog only gates whether `onConfirm` is ever called.
 */

import { useState, useEffect } from "react";
import { toast } from "sonner";
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

interface MoveToActionConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTitle: string;
  column: string;
  onConfirm: () => Promise<void> | void;
}

export function MoveToActionConfirmDialog({
  open,
  onOpenChange,
  taskTitle,
  column,
  onConfirm,
}: MoveToActionConfirmDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  // Reset on open, not on close — mirrors DeleteSkillDialog.
  useEffect(() => {
    if (open) {
      setSubmitting(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm();
      // Close ONLY on success — a rejected dispatch keeps the dialog open so
      // the operator can retry, with the error toasted instead.
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to move task");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Move &quot;{taskTitle}&quot; to {column}?</AlertDialogTitle>
          <AlertDialogDescription>
            Confirming sends a command to Ástríðr to move &quot;{taskTitle}&quot; into the{" "}
            {column} column.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={submitting}
            onClick={(e) => {
              // Radix's Action auto-closes the dialog on click — prevent that
              // so a rejected dispatch keeps the dialog open; success closes
              // explicitly in handleConfirm.
              e.preventDefault();
              void handleConfirm();
            }}
          >
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
