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
 * before page load rendered as "No brain reported" until the next live change. `useResolvedBrain`
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

import { useEffect, useState } from "react";
import { Clock, Pin } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BrainPicker } from "@/components/brains/BrainPicker";
import { useGlobalModelNames, useResolvedBrain } from "@/hooks/useResolvedBrain";
import { useProfileConfigs } from "@/hooks/useProfileConfigs";
import { brainsApi, BRAINS_STUB_ACTIVE, type CatalogueEntry, resolveModelDisplayName } from "@/lib/brainsApi";
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
  const profiles = useProfileConfigs();

  const [catalogue, setCatalogue] = useState<CatalogueEntry[] | null>(null);
  const [defaultProfileId, setDefaultProfileId] = useState("");
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);

  // The catalogue and default-profile-id reads share the D-16 seam every per-profile brain
  // surface uses — this is display-metadata resolution (provider identity dot, dispatch target
  // profile), never the engine truth itself, which comes exclusively from useActiveEngine above.
  useEffect(() => {
    let cancelled = false;
    brainsApi
      .getCatalogue()
      .then((list) => {
        if (!cancelled) setCatalogue(list);
      })
      .catch(() => {
        /* honest degrade: dot falls back to a neutral color below */
      });
    brainsApi
      .getDefaultProfileId()
      .then((id) => {
        if (!cancelled && id) setDefaultProfileId(id);
      })
      .catch(() => {
        /* honest degrade: falls back to the first known profile below */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const effectiveProfileId = defaultProfileId || profiles[0]?.profileId || "";

  const vendorForModel = (modelId: string): string | undefined =>
    catalogue?.find((e) => e.id === modelId)?.vendor;

  const dotColor = (modelId: string): string =>
    PROVIDER_COLORS[vendorForModel(modelId) ?? ""] ?? "var(--muted-foreground)";

  // 103-09: every visual derives from `resolved.source`, the shared resolution order
  // (global override wins outright, then the per-profile fleet reading, then an honest "none")
  // — the badge can no longer independently decide when to show a global reading; that decision
  // now lives once, in `resolveActiveBrain`.
  const isMixed = resolved.source === "mixed";
  const isGlobal = resolved.source === "global";
  const isProfile = resolved.source === "profile";

  // UAT cosmetic fix (2026-07-29): show the catalogue display name when one is known, instead of the
  // raw model id ("claude-sonnet-5" where the swap dialog said "Claude Sonnet 5"). Falls back to the
  // id unchanged when the catalogue has no entry — never a fabricated name.
  const baseLabel = isMixed
    ? "Mixed brains"
    : resolved.source === "none"
      ? "No brain reported"
      : resolveModelDisplayName(resolved.model as string, catalogue, globalModelNames);
  // A global reading must never present itself as an honest per-profile reading — the
  // "(global)" qualifier is folded into the accessible name itself (not just the visible "Global"
  // chip) since an explicit `aria-label` on the button replaces all descendant text for
  // assistive tech.
  const ariaLabel = `Active brain: ${baseLabel}${isGlobal ? " (global)" : ""}`;

  // Confirmed-live pulse (UI-SPEC "Accent" table item 4): a global reading is live regardless of
  // the D-16 stub flag (VITE_BRAINS_STUB gates only the per-profile seam); a profile reading is
  // gated on the stub flag as before. Never pulses while a swap is pending.
  const isConfirmedLive =
    !pendingLabel && (isGlobal || (isProfile && !BRAINS_STUB_ACTIVE));

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
              <span data-testid="brain-header-badge-label" className="hidden sm:inline">
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
              {BRAINS_STUB_ACTIVE && (
                <span
                  data-testid="brain-header-badge-stub-chip"
                  className="hidden rounded border border-dashed border-muted-foreground/40 px-1 text-xs text-muted-foreground sm:inline"
                >
                  STUB
                </span>
              )}
            </button>
          </TooltipTrigger>
        }
      />
      <TooltipContent side="bottom" sideOffset={8}>
        <p className="text-xs">{ariaLabel}</p>
      </TooltipContent>
    </Tooltip>
    </TooltipProvider>
  );
}
