/**
 * SwapHistoryList.tsx — Phase 109 (TELE-02, D-10/D-11/D-12).
 *
 * The ONE row-rendering implementation for the swap-history readout, shared by
 * `GlobalSwapModal`'s `SwapHistorySection` (unscoped — always renders nothing, per its own
 * long-standing D-15 gate) and `Settings.tsx`'s new per-profile collapsible history section
 * (D-10's real host). Lifted from `SwapHistorySection`'s pre-Phase-109 row body essentially
 * verbatim, then extended with:
 *
 *  - the COMBINED scoped+global read (`useCombinedSwapHistory`, D-11) in place of the
 *    scoped-only `useControlVerbSwaps` — a global swap genuinely CAN change an unpinned
 *    profile's engine (D-04's precedence), so a scoped-only history would silently omit swaps
 *    that did affect this profile.
 *  - a `GLOBAL` badge on rows whose `origin === "global"` (D-12) — its ABSENCE on a scoped row
 *    IS the "this profile's own swap" signal; no second badge is needed for the common case.
 *  - a live-derived pinned note (D-12): rendered if and only if
 *    `useProfileBrainOverrides()[profileId]` is present RIGHT NOW. This is deliberately NEVER
 *    reconstructed from the history rows themselves — pin state over time is stored nowhere (the
 *    override is in-memory on the Ástríðr side, and `controlVerbSwaps` rows carry no pin-state
 *    field), so a reconstruction would have to be inferred from scoped set/restore rows and would
 *    be silently wrong across any astridr restart, which clears overrides with no row left behind
 *    to say so. Do not "improve" this into a reconstruction — see 109-CONTEXT.md D-12's explicit
 *    rejection of that option.
 *
 * No new outcome vocabulary, no fourth icon, no new color token: `describeSwapOutcome`'s
 * existing four-way split (Check/X/AlertTriangle) is reused unchanged.
 */

import { AlertTriangle, Check, Pin, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { describeSwapOutcome, useCombinedSwapHistory, SWAP_HISTORY_CAP } from "@/hooks/useControlVerbSwaps";
import { useProfileBrainOverrides } from "@/hooks/useResolvedBrain";
import { InlineMetricState } from "@/components/EmptyState";

/** `timestamp` on a `controlVerbSwaps` row is epoch SECONDS (`runtimeIngest.ts`'s
 * `now = Date.now() / 1000`), never milliseconds — multiply before handing to `Date`. Short
 * clock-time only; the row list is capped so a full date is rarely needed to disambiguate.
 * Mirrors the pre-Phase-109 `formatSwapTime` this file's docstring describes lifting from
 * `GlobalSwapModal.tsx`. */
function formatSwapTime(timestampSeconds: number): string {
  return new Date(timestampSeconds * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SwapHistoryList({ profileId }: { profileId: string | undefined }) {
  const { rows, atCap } = useCombinedSwapHistory(profileId);
  const profileOverrides = useProfileBrainOverrides();

  // Same honest render-nothing gate `SwapHistorySection` has always had: an unscoped mount has
  // no profile to show history FOR. Both hooks above are still called unconditionally (Rules of
  // Hooks) — only the render is gated.
  if (profileId === undefined) {
    return null;
  }

  // D-12: derived from LIVE override state only, never reconstructed from `rows` — see the file
  // docstring above.
  const isPinned = profileOverrides[profileId] !== undefined;

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border p-2">
      {isPinned && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Pin className="h-3 w-3 shrink-0" aria-hidden="true" />
          This profile is pinned — global swaps below did not change its engine.
        </p>
      )}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No swaps recorded yet for this profile — includes both direct swaps and global
          overrides.
        </p>
      ) : (
        <>
          {rows.map((row) => {
            const outcome = describeSwapOutcome(row);
            return (
              <div key={row._id} className="flex items-center gap-2 text-sm">
                {outcome.kind === "refused" ? (
                  <X className="h-4 w-4 shrink-0 text-(--status-error)" aria-hidden="true" />
                ) : outcome.kind === "unresolved" ? (
                  <AlertTriangle
                    className="h-4 w-4 shrink-0 text-(--status-warn)"
                    aria-hidden="true"
                  />
                ) : (
                  // "success" and "restore" both read as the OK token — neither is a refusal
                  // and neither leaves the outcome ambiguous the way "unresolved" does.
                  <Check className="h-4 w-4 shrink-0 text-(--status-ok)" aria-hidden="true" />
                )}
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatSwapTime(row.timestamp)}
                </span>
                {row.origin === "global" && (
                  <Badge variant="outline" className="text-xs uppercase px-1 py-0">
                    Global
                  </Badge>
                )}
                <span className="flex-1 inline-flex items-center gap-1">
                  {row.target ?? <InlineMetricState state="empty" label="no target" />}
                  {" → "}
                  {/* `resolved` is already explained by `outcome.label` rendered
                      right below (Unresolved/Refused branch on this exact
                      condition in `describeSwapOutcome`) — n/a, not empty. */}
                  {row.resolved ?? "n/a"}
                </span>
                <span className="text-muted-foreground">{outcome.label}</span>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            {atCap
              ? `Showing the last ${SWAP_HISTORY_CAP} combined swaps (per-profile + global) — earlier swaps may exist.`
              : `Showing ${rows.length} swap${rows.length === 1 ? "" : "s"} (per-profile + global).`}
          </p>
        </>
      )}
    </div>
  );
}
