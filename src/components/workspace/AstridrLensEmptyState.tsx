/**
 * AstridrLensEmptyState — the Astridr lens's honest empty state (D-10/D-11).
 *
 * Presentational, prop-driven: takes the arms-probe result as `armsPresent`
 * rather than calling `useArmsProbe` internally, so it's testable without a
 * Convex mock and the data dependency stays visible at the page level.
 *
 * `armsPresent` states:
 * - `undefined` — probe still resolving. Render a skeleton, never the
 *   "isn't mapped yet" copy — claiming "nothing is mapped" before the probe
 *   answers is the exact hardcoded-claim failure D-11 forbids.
 * - `false` — probe answered: no ARMS sources exist yet. The honest empty
 *   state (D-10's copy, verbatim from the UI-SPEC Copywriting Contract).
 * - `true` — probe answered: ARMS sources exist. Do NOT render the "isn't
 *   mapped yet" heading — render a neutral placeholder instead. This branch
 *   is what makes D-11 real: a component that renders the same copy
 *   regardless of the probe result would make the probe purely cosmetic.
 *   Building the actual ARMS renderer is out of scope (parked with astridr
 *   A3 in v29 per CONTEXT.md § Deferred Ideas).
 */

import { Compass, Radar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export interface AstridrLensEmptyStateProps {
  armsPresent: boolean | undefined;
  onSwitchToWorkspace: () => void;
}

export function AstridrLensEmptyState({
  armsPresent,
  onSwitchToWorkspace,
}: AstridrLensEmptyStateProps) {
  // ── undefined: probe still resolving — skeleton only, no copy ────────────
  if (armsPresent === undefined) {
    return (
      <div className="h-[600px] flex flex-col items-center justify-center gap-3 rounded-[var(--radius)] border border-primary/20 bg-card/50">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-4 w-80" />
        <Skeleton className="h-4 w-48" />
      </div>
    );
  }

  // ── true: ARMS sources exist — neutral placeholder, never the empty-state
  //    heading. This is the assertion that proves the probe actually drives
  //    the copy rather than being decorative (see Task 2's test).
  if (armsPresent === true) {
    return (
      <div className="h-[600px] flex flex-col items-center justify-center gap-3 rounded-[var(--radius)] border border-primary/20 bg-card/50">
        <Radar className="h-8 w-8 text-primary/40" />
        <p className="text-base font-mono text-muted-foreground">
          An ARMS inventory is now reporting
        </p>
        <p className="text-sm text-muted-foreground/70 max-w-md text-center">
          Ástríðr's world lens renderer hasn't been built yet — this lens will
          render its map once that work lands.
        </p>
      </div>
    );
  }

  // ── false: probe answered — no ARMS sources exist. The honest empty state.
  return (
    <div className="h-[600px] flex flex-col items-center justify-center gap-3 rounded-[var(--radius)] border border-primary/20 bg-card/50">
      <Compass className="h-8 w-8 text-primary/40" />
      <p className="text-base font-mono text-muted-foreground">
        Ástríðr's world isn't mapped yet
      </p>
      <p className="text-sm text-muted-foreground/70 max-w-md text-center">
        The ARMS inventory (Skills, Memory, Routines, Applications) hasn't
        been built on Ástríðr's side — it's queued for a future milestone.
        This lens updates on its own the day that inventory starts reporting;
        nothing to configure here.
      </p>
      <Button variant="outline" onClick={onSwitchToWorkspace}>
        View Larry's Workspace
      </Button>
    </div>
  );
}

export default AstridrLensEmptyState;
