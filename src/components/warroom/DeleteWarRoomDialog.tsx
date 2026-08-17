/**
 * DeleteWarRoomDialog — shadcn AlertDialog confirm gate for deleting a war
 * room and its transcript (Phase 120, POLISH-03 / D-12 / D-14).
 *
 * Replaces the prior browser-native confirm() prompt in WarRoom.tsx: it is
 * unthemeable (ignores every data-theme block) and this is the more
 * destructive of the two POLISH-03 sites — it removes the room's transcript
 * too, with no undo. Copies DeleteSkillDialog's controlled-dialog structure
 * (open/onOpenChange props, no trigger, `e.preventDefault()` on
 * AlertDialogAction so a rejected onConfirm keeps the dialog open) — no
 * timer, no auto-focus-and-confirm shortcut, no countdown anywhere.
 *
 * This component holds no mutation of its own. The page owns the
 * closeWarRoom-then-deleteWarRoom sequence; this dialog only gates whether
 * `onConfirm` is ever called.
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

interface DeleteWarRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomName: string;
  onConfirm: () => Promise<void> | void;
}

export function DeleteWarRoomDialog({
  open,
  onOpenChange,
  roomName,
  onConfirm,
}: DeleteWarRoomDialogProps) {
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
      // Close ONLY on success — a rejected delete keeps the dialog open so
      // the operator can retry, with the error toasted instead.
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete room");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete war room &quot;{roomName}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes it and its transcript. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={submitting}
            onClick={(e) => {
              // Radix's Action auto-closes the dialog on click — prevent that
              // so a rejected delete keeps the dialog open; success closes
              // explicitly in handleConfirm.
              e.preventDefault();
              void handleConfirm();
            }}
            className="bg-destructive/10 text-destructive hover:bg-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30"
          >
            Delete room
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
