/**
 * BrainPickerRow.tsx — 103-03-T2. One catalogue row: dot · name · billing chip ·
 * health dot · quota bar (D-07's full row anatomy, UI-SPEC §3).
 *
 * Presentational only — owns no dispatch logic. The picker built in 103-05 owns
 * `expandedRowId` state and passes `isExpanded`/`onExpandChange` down as a
 * controlled pair, and owns the actual swap dispatch behind `onSelect`.
 *
 * Hard requirements carried over from BrainControl.tsx's three live operator
 * checkpoint rounds (see that file's docstring) — re-learning these costs another
 * checkpoint round, so they are treated as fixed here too:
 *  - The row is a `<button>` with `whitespace-normal break-words`. It must NEVER
 *    clip a long name with a single-line ellipsis utility class — the real
 *    catalogue is ~300+ entries with long model names.
 *  - Health/quota status colors are re-tokenized to `--status-*` CSS vars, never
 *    the hardcoded Tailwind color-500 literals `ProviderHealthPanel.tsx` still
 *    carries for its dots/bars (CLAUDE.md § Styling).
 *
 * 103-11 (WR-03/CR-02): the row exposes exactly ONE focusable element — its own `<button>`. The
 * health dot is purely presentational (`aria-hidden`, no `tabIndex`, no nested `TooltipTrigger`);
 * the `Tooltip` now wraps the button itself, and the health word is folded into the button's own
 * `aria-label` alongside the engine name, billing label, and quota state, so hover/focus discovery
 * and non-color redundancy both survive without a second, invalid-content-model tab stop. The
 * exported `needsCostConfirm` predicate is the single source of truth for the expand-to-confirm
 * branch — `BrainPicker.tsx`'s `handleActivate` calls the exact same function so the keyboard path
 * (cmdk `CommandItem.onSelect`) and this row's own mouse path can never decide differently.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useProviderHealth } from "@/hooks/useProviderHealth";
import type { CatalogueEntry } from "@/lib/brainsApi";
import { PROVIDER_COLORS } from "@/lib/providers";
import { cn } from "@/lib/utils";

export interface BrainPickerRowProps {
  entry: CatalogueEntry;
  /** True when this row is the currently active engine for the active scope —
   * drives the selected-row accent highlight (UI-SPEC "Accent" table). */
  isCurrent?: boolean;
  /** Controlled: true while this row's expensive/unknown-tier inline confirm
   * is expanded. Owned by the parent picker, not this row (UI-SPEC §3/§11). */
  isExpanded: boolean;
  onExpandChange: (expanded: boolean) => void;
  /** Fires immediately for normal-tier rows; fires only after the inline
   * confirm step for expensive/unknown-tier rows. */
  onSelect: (entry: CatalogueEntry) => void;
}

type HealthStatus = "reachable" | "degraded" | "unreachable";

const HEALTH_DOT_CLASS: Record<HealthStatus, string> = {
  reachable: "bg-(--status-ok)",
  degraded: "bg-(--status-warn)",
  unreachable: "bg-(--status-error)",
};

const HEALTH_LABEL: Record<HealthStatus, string> = {
  reachable: "reachable",
  degraded: "degraded",
  unreachable: "unreachable",
};

const QUOTA_INDICATOR_CLASS: Record<"ok" | "warn" | "error", string> = {
  ok: "[&>[data-slot=progress-indicator]]:bg-(--status-ok)",
  warn: "[&>[data-slot=progress-indicator]]:bg-(--status-warn)",
  error: "[&>[data-slot=progress-indicator]]:bg-(--status-error)",
};

const EXPENSIVE_TIER_COPY: Record<"expensive" | "unknown", string> = {
  expensive: "This model may be expensive per token. Confirm swap to",
  unknown: "Unknown model — cost tier not verified. Confirm swap to",
};

/**
 * needsCostConfirm — the single source of truth for the expand-to-confirm branch (UI-SPEC §3).
 * Exported so `BrainPicker.tsx`'s `handleActivate` (103-11, CR-02) can make the exact same
 * decision for the keyboard path (`CommandItem.onSelect`) that this row makes for the mouse path
 * — the condition itself must never be duplicated/inlined a second time.
 */
export function needsCostConfirm(entry: CatalogueEntry): boolean {
  return entry.costTier === "expensive" || entry.costTier === "unknown";
}

/**
 * quotaLevel — re-tokenized threshold logic copied from
 * ProviderHealthPanel.tsx:45-51's `quotaBarColor` (thresholds kept verbatim:
 * >=20% ok, 5-20% warn, <5% error — only the hardcoded Tailwind color-500
 * literals are replaced with status tokens). Exported for direct unit testing.
 */
export function quotaLevel(pct: number): "ok" | "warn" | "error" {
  if (pct < 0.05) return "error";
  if (pct < 0.2) return "warn";
  return "ok";
}

/**
 * resolveHealthStatus — prefers the catalogue entry's own server-reported
 * `health` field (103-CONTRACT.md §3 — a live per-entry read as of the last
 * catalogue fetch); falls back to a vendor-keyed `useProviderHealth()` read
 * (re-tokenized from ProviderHealthPanel.tsx:29-35's `dotColor` logic) only
 * when the entry carries no `health` field of its own. Exported for direct
 * unit testing.
 */
export function resolveHealthStatus(
  entry: CatalogueEntry,
  liveHealth: Record<string, { state?: string; authenticated?: boolean } | undefined>
): HealthStatus {
  if (entry.health) return entry.health;
  const data = liveHealth[entry.vendor];
  if (!data) return "unreachable";
  if (data.state === "open") return "unreachable";
  if (data.authenticated === false) return "degraded";
  return "reachable";
}

export function BrainPickerRow({
  entry,
  isCurrent = false,
  isExpanded,
  onExpandChange,
  onSelect,
}: BrainPickerRowProps) {
  const liveHealth = useProviderHealth();
  const healthStatus = resolveHealthStatus(entry, liveHealth);
  const needsConfirm = needsCostConfirm(entry);
  const dotColor = PROVIDER_COLORS[entry.vendor] ?? "#6b7280";
  const billingLabel = entry.billing === "sub" ? "SUB" : "API";
  const quotaStateLabel =
    entry.quotaRemainingPct !== undefined
      ? `${Math.round(entry.quotaRemainingPct * 100)}% quota remaining`
      : "unlimited quota";
  // WR-03: the health word (previously only on the now-non-focusable dot's own aria-label) must
  // still be reachable by assistive tech -- folded into the row button's own accessible name,
  // alongside the engine name, billing label, and quota state.
  const accessibleName = `${entry.name} — ${billingLabel} — ${HEALTH_LABEL[healthStatus]} — ${quotaStateLabel}`;

  // 103-11/CR-02: every one of these handlers stops propagation so a mouse click never ALSO
  // bubbles into the enclosing cmdk `CommandItem`'s own click-select handler (which now calls
  // `BrainPicker.tsx`'s `handleActivate` via `onSelect`, wired for the keyboard path) --
  // without this, a single click would double-fire `handleActivate`, and a Cancel click would
  // bubble into a false confirmation (the enclosing `CommandItem` cannot tell "Cancel" apart from
  // "the row" once the event reaches it).
  const handleActivate = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (needsConfirm) {
      onExpandChange(true);
      return;
    }
    onSelect(entry);
  };

  const handleConfirm = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onSelect(entry);
    onExpandChange(false);
  };

  const handleCancel = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onExpandChange(false);
  };

  return (
    <div
      className={cn(
        "flex flex-col rounded-md border px-2 py-1.5",
        isExpanded ? "border-(--status-warn)" : "border-transparent",
        isCurrent && !isExpanded && "bg-primary/10"
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleActivate}
            aria-label={accessibleName}
            className="flex w-full items-center gap-2 whitespace-normal break-words text-left"
          >
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: dotColor }}
            />
            <span className="flex-1 text-sm">{entry.name}</span>
            <Badge variant="outline" className="text-xs uppercase px-1 py-0">
              {billingLabel}
            </Badge>
            {/* WR-03 fix: purely presentational now -- no tabIndex, no nested TooltipTrigger. The
                health word survives via this button's own aria-label above, and hover/focus
                discovery survives via the Tooltip now wrapping this whole button instead. */}
            <span
              aria-hidden="true"
              data-testid="health-dot"
              className={cn("h-1.5 w-1.5 shrink-0 rounded-full", HEALTH_DOT_CLASS[healthStatus])}
            />
            {entry.quotaRemainingPct !== undefined ? (
              <Progress
                value={Math.round(entry.quotaRemainingPct * 100)}
                aria-label={`Quota remaining ${Math.round(entry.quotaRemainingPct * 100)}%`}
                className={cn("h-1 w-10", QUOTA_INDICATOR_CLASS[quotaLevel(entry.quotaRemainingPct)])}
              />
            ) : (
              <span className="font-mono text-xs text-muted-foreground" aria-label="Unlimited quota">
                ∞
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">{HEALTH_LABEL[healthStatus]}</p>
        </TooltipContent>
      </Tooltip>
      {isExpanded && needsConfirm && (
        <div className="mt-1.5 flex flex-col gap-1.5 border-t border-(--status-warn)/30 pt-1.5">
          <p className="text-xs text-(--status-warn)">
            {EXPENSIVE_TIER_COPY[entry.costTier as "expensive" | "unknown"]} {entry.name}?
          </p>
          <div className="flex justify-end gap-1.5">
            <Button type="button" variant="ghost" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              className="border border-(--status-warn)"
              onClick={handleConfirm}
            >
              Confirm swap
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
