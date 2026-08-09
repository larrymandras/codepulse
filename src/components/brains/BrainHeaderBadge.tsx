/**
 * BrainHeaderBadge.tsx — 103-06-T1, rewritten under 103-06 to use `BrainPicker`'s composition API.
 * The dashboard-wide, always-visible active-brain badge (D-05 item 2, UI-SPEC §2). Mounted once in
 * `DashboardLayout`'s status cluster and rendered on every page — an honest per-profile-fleet
 * reading that says "Mixed brains" rather than silently picking one profile's value when profiles
 * disagree (the BSC-01 VitalsRail trap this phase exists to remove).
 *
 * Reads exclusively through `useResolvedBrain()` (103-09) — the one shared "what brain is
 * actually running" resolution order (global override, then the per-profile fleet reading via
 * `useActiveEngine()`/`deriveMixedState()`, then an honest "none") every brain surface reads, so
 * this badge cannot disagree with itself, the Chat composer pill, or Control Center's
 * `BrainControl` (D-14). Before 103-09, this badge only ever *subscribed* to global-override
 * *changes* (`swap.state`) and never requested a snapshot on mount — an override already active
 * before page load rendered as the pre-Phase-109 absent-state string until the next live change.
 * `useResolvedBrain`
 * closes that gap for every consumer at once.
 *
 * This component's own visible button IS `BrainPicker`'s real Popover trigger — passed in via
 * `BrainPicker`'s `trigger` prop and rendered through `PopoverTrigger asChild`, so Radix clones the
 * real open/close `onClick` (and focus/ref wiring) directly onto this button. There is exactly one
 * "Active brain" control in the accessibility tree; no second, hidden `BrainPicker` instance, no
 * DOM-scraped click relay, no `MutationObserver` mirroring a `data-testid` node. Pending/in-flight
 * state arrives via `onPendingChange`, a plain callback `BrainPicker` fires whenever its own
 * pending-swap suffix (D-15) changes — this component never re-derives or duplicates that state.
 *
 * The button is wrapped by `Tooltip`/`TooltipTrigger` OUTSIDE of `BrainPicker` (in this file) and
 * passed down as the `trigger` prop containing `<TooltipTrigger asChild><button/></TooltipTrigger>`
 * — not `<Tooltip>` wrapping the whole thing — because `Tooltip`'s Radix `Root` is a pure context
 * provider that does not forward arbitrary cloned props (the `onClick`/ref `PopoverTrigger asChild`
 * clones onto whatever `trigger` resolves to) down to a real DOM node. `TooltipTrigger`, given
 * `asChild`, forwards everything it receives via `{...props}` down its own internal `Slot` onto the
 * `<button>`, so both Tooltip's hover/focus wiring and Popover's click wiring land on the one real
 * button — the standard Radix "stacked triggers on one element" composition. `<TooltipContent>`
 * stays a sibling of `<BrainPicker>` inside the same outer `<Tooltip>`, which still provides its
 * context correctly since both live in this file, deeper in the fiber tree than the JSX authoring
 * position but still descendants of `<Tooltip>` once mounted.
 */

import { useState } from "react";
import { Clock, Pin } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BrainPicker } from "@/components/brains/BrainPicker";
import { useBrainCatalogue } from "@/hooks/useBrainCatalogue";
import { useGlobalModelNames, useResolvedBrain } from "@/hooks/useResolvedBrain";
import { modelIdsMatch, resolveModelDisplayName } from "@/lib/brainsApi";
import { PROVIDER_COLORS } from "@/lib/providers";
import { cn } from "@/lib/utils";

function formatTtl(expiresAt?: number): string {
  if (!expiresAt) return "soon";
  const remainingMs = expiresAt * 1000 - Date.now();
  const minutes = Math.max(0, Math.round(remainingMs / 60000));
  return `${minutes}m`;
}

export function BrainHeaderBadge() {
  // 103-09: the badge is dashboard-wide, so it reads the shared resolver with no `profileId` —
  // the same module (`useResolvedBrain`) the Chat composer pill and (via `swapModelOverride`)
  // Control Center's `BrainControl` read, so this badge cannot disagree with them (BSC-01).
  const resolved = useResolvedBrain();
  const globalModelNames = useGlobalModelNames();

  // Phase 109 D-01/D-03: the catalogue and Ástríðr's own resolved `default_profile_id` now come
  // from the ONE swap.catalogue fetcher (display-metadata resolution — provider identity dot,
  // dispatch target profile — never the engine truth itself, which comes exclusively from
  // useResolvedBrain above). There is NO Convex `profileConfigs`-ordering fallback here — that
  // ordering is different from Ástríðr's own resolved config, so it could address a per-profile
  // swap at a profile the operator never named (D-03's explicitly rejected option). When
  // `defaultProfileId` is empty, `effectiveProfileId` is honestly empty too.
  const { entries: catalogue, defaultProfileId } = useBrainCatalogue();
  const effectiveProfileId = defaultProfileId;

  const [pendingLabel, setPendingLabel] = useState<string | null>(null);

  // D-08: the catalogue's ids are bare ("claude-sonnet-5") while a resolved `inherited`-mode
  // reading can be vendor-prefixed ("anthropic/claude-sonnet-5") — a raw `===` here missed every
  // such row and the provider dot fell back to the neutral color for the whole inherited class.
  const vendorForModel = (modelId: string): string | undefined =>
    catalogue?.find((e) => modelIdsMatch(e.id, modelId))?.vendor;

  const dotColor = (modelId: string): string =>
    PROVIDER_COLORS[vendorForModel(modelId) ?? ""] ?? "var(--muted-foreground)";

  // 103-09: every visual derives from `resolved.source`, the shared resolution order
  // (global override wins outright, then the per-profile fleet reading, then an honest "none")
  // — the badge can no longer independently decide when to show a global reading; that decision
  // now lives once, in `resolveActiveBrain`.
  const isMixed = resolved.source === "mixed";
  const isGlobal = resolved.source === "global";
  // Phase 109 D-06: "override" (a live per-profile pin reported over swap.state) renders through
  // the exact same JSX branch as "profile" — the operator never needs to know which of the two
  // live signals answered the question (both are genuinely live server state, UI-SPEC §B).
  const isProfile = resolved.source === "profile" || resolved.source === "override";
  const isAbsent = resolved.source === "none";

  // UAT cosmetic fix (2026-07-29): show the catalogue display name when one is known, instead of the
  // raw model id ("claude-sonnet-5" where the swap dialog said "Claude Sonnet 5"). Falls back to the
  // id unchanged when the catalogue has no entry — never a fabricated name.
  // Phase 109 D-07/UI-SPEC §A: the honest "no telemetry yet" state renders the one canonical
  // string across every brain surface — never a per-surface-specific absent string, and never a
  // fabricated claim that a resolution happened.
  const baseLabel = isMixed
    ? "Mixed brains"
    : isAbsent
      ? "Not reported"
      : resolveModelDisplayName(resolved.model as string, catalogue, globalModelNames);
  // A global reading must never present itself as an honest per-profile reading — the
  // "(global)" qualifier is folded into the accessible name itself (not just the visible "Global"
  // chip) since an explicit `aria-label` on the button replaces all descendant text for
  // assistive tech. No parenthetical is added for the absent state (UI-SPEC §A) — "Not reported"
  // already reads as absence without qualification.
  const ariaLabel = `Active brain: ${baseLabel}${isGlobal ? " (global)" : ""}`;

  // Confirmed-live pulse (UI-SPEC "Accent" table item 4): Phase 109 D-01 retired the build-time
  // stub seam entirely — every reading source is live now, so this simplifies to "a global or
  // profile reading, with no swap pending."
  const isConfirmedLive = !pendingLabel && (isGlobal || isProfile);

  return (
    <TooltipProvider>
    <Tooltip>
      <BrainPicker
        profileId={effectiveProfileId}
        entryScope={isMixed || isGlobal ? "global" : undefined}
        onPendingChange={setPendingLabel}
        trigger={
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={ariaLabel}
              className="flex h-8 items-center gap-1.5 rounded-full border border-border px-2 text-sm hover:border-primary"
            >
              {isConfirmedLive && (
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary animate-pulse"
                />
              )}
              {isMixed ? (
                <span aria-hidden="true" className="flex items-center">
                  {resolved.distinctModels.slice(0, 3).map((model, i) => (
                    <span
                      key={model}
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full border border-background",
                        i > 0 && "-ml-1"
                      )}
                      style={{ backgroundColor: dotColor(model) }}
                    />
                  ))}
                </span>
              ) : resolved.model ? (
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: dotColor(resolved.model) }}
                />
              ) : null}
              <span
                data-testid="brain-header-badge-label"
                className={cn(
                  "hidden sm:inline",
                  isAbsent && "italic text-muted-foreground"
                )}
              >
                {baseLabel}
              </span>
              {isGlobal && (
                <span
                  data-testid="brain-header-badge-global-chip"
                  className="hidden rounded border border-border px-1 text-xs uppercase text-muted-foreground sm:inline"
                >
                  Global
                </span>
              )}
              {pendingLabel && (
                <span
                  data-testid="brain-header-badge-pending"
                  className="hidden text-xs text-muted-foreground sm:inline"
                >
                  {pendingLabel}
                </span>
              )}
              {isProfile && !pendingLabel && resolved.mode === "session" && (
                <span
                  data-testid="brain-header-badge-session"
                  className="hidden items-center gap-0.5 text-xs text-(--status-info) sm:inline-flex"
                >
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  session override · expires in {formatTtl(resolved.expiresAt)}
                </span>
              )}
              {isProfile && !pendingLabel && resolved.mode === "pinned" && (
                <span
                  data-testid="brain-header-badge-pinned"
                  className="hidden items-center gap-0.5 text-xs text-muted-foreground sm:inline-flex"
                >
                  <Pin className="h-3 w-3" aria-hidden="true" />
                  pinned default
                </span>
              )}
            </button>
          </TooltipTrigger>
        }
      />
      <TooltipContent side="bottom" sideOffset={8}>
        <p className="text-xs">{ariaLabel}</p>
        {isAbsent && (
          <p className="text-xs text-muted-foreground">No engine telemetry yet for this profile.</p>
        )}
      </TooltipContent>
    </Tooltip>
    </TooltipProvider>
  );
}
