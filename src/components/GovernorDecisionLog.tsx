import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { GOVERNOR_DECISION_CAP } from "../../convex/governorDecisionsFilters";
import { SectionHeader } from "./SectionHeader";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "./ui/table";
import { Badge } from "./ui/badge";
import { Check, EyeOff } from "lucide-react";

/**
 * GovernorDecisionLog — Phase 112 (TELE-03, D-04's "surfaced" half).
 *
 * Read-only audit table for `governor_decision` rows (astridr's interrupt
 * governor: did it speak, and if not, why). Global axis — no `profileId`
 * scoping exists on this kind (see `convex/schema.ts`'s `governorDecisions`
 * comment).
 *
 * Calls `useQuery(api.governorDecisions.listRecent, {})` directly, exactly
 * as `DeliveryHistory.tsx` does — no wrapper hook. See 112-05-PLAN.md
 * <settled_decisions> for why a coalescing hook (the `useControlVerbSwaps`
 * convention) was explicitly rejected here: the UI-SPEC requires loading
 * (`undefined`) and empty (`[]`) to render as two DISTINCT states, and a
 * coalescing hook would make that distinction unrepresentable.
 *
 * `GOVERNOR_DECISION_CAP` is imported from the dependency-free
 * `convex/governorDecisionsFilters.ts` — never from `convex/governorDecisions.ts`,
 * which imports the Convex server runtime and would drag it into the client
 * bundle (the documented 108-06 defect).
 */

/** Held-reason prose — reused verbatim from `InboxCard.tsx:170-174`'s
 * module-private `heldReasonCopy`. Re-implemented locally with byte-identical
 * strings rather than exported, per <settled_decisions>. */
function heldReasonCopy(reason?: string): string {
  if (reason === "quiet-hours") return "held during quiet hours";
  if (reason === "focus") return "held during focus mode";
  return "held";
}

export function GovernorDecisionLog() {
  const rows = useQuery(api.governorDecisions.listRecent, {});

  // Loading: `undefined` result. Distinguished from the empty-array state
  // below — collapsing the two would make a still-loading section look
  // like it has already confirmed zero decisions (T-112-17).
  if (rows === undefined) {
    return (
      <div className="space-y-4">
        <SectionHeader title="Governor Decisions" />
        <div className="h-32 w-full animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        <SectionHeader title="Governor Decisions" />
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-base font-semibold text-foreground mb-1">
            No governor decisions yet
          </p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Decision history appears here once the interrupt governor
            evaluates its first proactive event (reminder, watch pulse,
            heartbeat, or a similar automated nudge).
          </p>
        </div>
      </div>
    );
  }

  // listRecent is server-side .take()-bounded at GOVERNOR_DECISION_CAP, so
  // rows.length can equal but never exceed the cap — this is the same
  // exported constant the server query caps against, so the on-screen claim
  // and the server cap cannot drift apart (T-112-02).
  const atCap = rows.length >= GOVERNOR_DECISION_CAP;

  return (
    <div className="space-y-4">
      <SectionHeader title="Governor Decisions" />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Emitter</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row._id}>
              <TableCell>
                <div className="flex items-center gap-1.5 text-sm">
                  {row.spoke ? (
                    <Check
                      className="h-4 w-4 shrink-0 text-(--status-ok)"
                      aria-hidden="true"
                    />
                  ) : (
                    <EyeOff
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  )}
                  <span>{row.spoke ? "Spoke" : "Held"}</span>
                </div>
              </TableCell>
              <TableCell className="text-sm">{row.emitter}</TableCell>
              <TableCell>
                <Badge variant="outline" className="font-normal">
                  {row.priority}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {row.spoke ? "n/a" : heldReasonCopy(row.heldReason)}
              </TableCell>
              <TableCell className="tabular-nums text-sm text-muted-foreground">
                {new Date(row.timestamp * 1000).toLocaleTimeString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">
        {atCap
          ? `Showing the last ${GOVERNOR_DECISION_CAP} decisions — earlier decisions may exist.`
          : `Showing ${rows.length} decision${rows.length === 1 ? "" : "s"}.`}
      </p>
    </div>
  );
}
