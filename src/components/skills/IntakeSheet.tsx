import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  RowStatusBadge,
  VerdictBadge,
  DestinationBadge,
} from "@/components/skills/IntakeStatusBadge";
import { IntakeReportView } from "@/components/skills/IntakeReportView";
import { formatCountdown, useCountdownNow } from "@/hooks/useIntakeFeed";
import type { IntakeFeed } from "@/hooks/useIntakeFeed";
import type { IntakeCommandRow } from "@/hooks/useIntake";

interface IntakeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feed: IntakeFeed;
}

/** Full intake history + reports, slid over from the right. State lives in
 * useIntakeFeed (owned by Skills.tsx) so closing the sheet loses nothing. */
export function IntakeSheet({ open, onOpenChange, feed }: IntakeSheetProps) {
  const { rows, isLoading, labelFor } = feed;
  const now = useCountdownNow(rows);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-primary/70">
            Intake
          </SheetTitle>
          <SheetDescription>
            Validation reports for submitted skills.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6">
          {isLoading && rows.length === 0 && (
            <div className="flex flex-col gap-2 mt-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}

          {!isLoading && rows.length === 0 && (
            <div className="mt-2">
              <p className="text-base font-medium">No intake commands yet</p>
              <p className="text-sm text-muted-foreground">
                Drop a SKILL.md or paste a GitHub URL with &quot;Validate
                skill&quot; — reports appear here.
              </p>
            </div>
          )}

          {rows.length > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              {rows.map((row) => {
                const label = labelFor(row);
                const isDone = row.status === "done";
                const isQueued = row.status === "queued";
                // Runtime-guaranteed by the isDone check above; RowStatusBadge's
                // status prop is typed Exclude<IntakeRowStatus, "done"> so a
                // "done" row can never render it (Plan 07-01 compile-time guard).
                const nonDoneStatus = row.status as Exclude<
                  IntakeCommandRow["status"],
                  "done"
                >;

                const chip = isDone ? (
                  <VerdictBadge
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    verdict={(row.report as any)?.verdict ?? "error"}
                  />
                ) : isQueued ? (
                  // A per-second live region is hostile to screen readers — the
                  // countdown text overrides the outer aria-live="polite" chip
                  // container with aria-live="off" (locked accessibility contract).
                  <span aria-live="off">
                    <RowStatusBadge
                      status={nonDoneStatus}
                      countdownLabel={`Expires in ${formatCountdown(row.expiresAt - now)}`}
                    />
                  </span>
                ) : (
                  <RowStatusBadge status={nonDoneStatus} />
                );

                const rowContent = (
                  <div className="flex items-center gap-3 py-2">
                    <span aria-live="polite">{chip}</span>
                    <span className="text-sm flex-1 truncate">{label}</span>
                    <DestinationBadge destination={row.destination ?? "global"} />
                    <span className="text-xs text-muted-foreground">
                      {new Date(row.createdAt).toLocaleTimeString()}
                    </span>
                    {isDone && (
                      <span className="text-muted-foreground" aria-hidden="true">
                        {expandedId === row.commandId ? "▾" : "▸"}
                      </span>
                    )}
                  </div>
                );

                return (
                  <div key={row.commandId} className="border-b border-border last:border-b-0">
                    {isDone ? (
                      <Collapsible
                        open={expandedId === row.commandId}
                        onOpenChange={(o) => setExpandedId(o ? row.commandId : null)}
                      >
                        <CollapsibleTrigger asChild>
                          <button type="button" className="w-full text-left">
                            {rowContent}
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <IntakeReportView row={row} />
                        </CollapsibleContent>
                      </Collapsible>
                    ) : (
                      rowContent
                    )}

                    {row.status === "expired" && (
                      <div className="pb-2">
                        <p className="text-sm text-foreground">
                          Expired — no daemon claimed this command.
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Intake execution ships with the Forge daemon (Phase 8).
                        </p>
                      </div>
                    )}

                    {row.status === "failed" && (
                      <p className="text-sm text-foreground pb-2">Failed: {row.error}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
