/**
 * ForgeStopConfirmDialog — shadcn AlertDialog wrapper for the Stop Job confirm gate.
 *
 * D-01: surfaces the hard-kill fact (taskkill /T /F) explicitly
 * D-02: surfaces that in-progress work will be discarded
 * D-03: two-step confirm — no one-click stop
 * D-04: shows "Stopping…" button state (isStopping) — NOT derived from forgeJobs status
 *
 * onConfirmedStop is ONLY called after the user clicks "Yes, stop the job".
 * The caller (ForgeJobDetail) owns the isStoppingLocal state and mutation call.
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Prop interface
// ---------------------------------------------------------------------------

interface ForgeStopConfirmDialogProps {
  jobId: string;
  hostId: string;
  isStopping: boolean;
  onConfirmedStop: () => void;
}

// ---------------------------------------------------------------------------
// ForgeStopConfirmDialog
// ---------------------------------------------------------------------------

export function ForgeStopConfirmDialog({
  jobId: _jobId,
  hostId: _hostId,
  isStopping,
  onConfirmedStop,
}: ForgeStopConfirmDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="destructive"
          size="sm"
          disabled={isStopping}
          aria-label="Stop job"
          aria-disabled={isStopping}
        >
          {isStopping ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
              Stopping…
            </>
          ) : (
            "Stop"
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Stop this job?</AlertDialogTitle>
          <AlertDialogDescription>
            This will immediately kill the agent process (taskkill /T /F). Any
            work in progress — not yet promoted to the workspace — will be
            discarded. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirmedStop}>
            Yes, stop the job
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
