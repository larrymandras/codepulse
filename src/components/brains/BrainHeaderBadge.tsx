/**
 * BrainHeaderBadge.tsx — 103-06-T1, rewritten under 103-06 to use `BrainPicker`'s composition API.
 * The dashboard-wide, always-visible active-brain badge (D-05 item 2, UI-SPEC §2). Mounted once in
 * `DashboardLayout`'s status cluster and rendered on every page — an honest per-profile-fleet
 * reading that says "Mixed brains" rather than silently picking one profile's value when profiles
 * disagree (the BSC-01 VitalsRail trap this phase exists to remove).
 *
 * Reads exclusively through `useActiveEngine()` + the pure `deriveMixedState()` (103-03) — the
 * same shared view-model every brain surface reads, so this badge cannot disagree with itself
 * (D-14).
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

import { useEffect, useMemo, useState } from "react";
import { Clock, Pin } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BrainPicker } from "@/components/brains/BrainPicker";
import { useActiveEngine, deriveMixedState } from "@/hooks/useActiveEngine";
import { useProfileConfigs } from "@/hooks/useProfileConfigs";
import { brainsApi, BRAINS_STUB_ACTIVE, type CatalogueEntry } from "@/lib/brainsApi";
import { PROVIDER_COLORS } from "@/lib/providers";
import { cn } from "@/lib/utils";

function formatTtl(expiresAt?: number): string {
  if (!expiresAt) return "soon";
  const remainingMs = expiresAt * 1000 - Date.now();
  const minutes = Math.max(0, Math.round(remainingMs / 60000));
  return `${minutes}m`;
}

export function BrainHeaderBadge() {
  const activeEngines = useActiveEngine();
  const mixedState = useMemo(() => deriveMixedState(activeEngines), [activeEngines]);
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

  const isMixed = mixedState.mixed;
  const engine = mixedState.single;

  const baseLabel = isMixed ? "Mixed brains" : (engine?.model ?? "No brain reported");
  const ariaLabel = `Active brain: ${baseLabel}`;

  // Confirmed-live pulse (UI-SPEC "Accent" table item 4): only when a single, server-reported
  // engine is showing, and it is neither an in-flight guess nor stub-sourced data.
  const isConfirmedLive = !isMixed && !!engine && !pendingLabel && !BRAINS_STUB_ACTIVE;

  return (
    <Tooltip>
      <BrainPicker
        profileId={effectiveProfileId}
        entryScope={isMixed ? "global" : undefined}
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
                  {mixedState.distinctModels.slice(0, 3).map((model, i) => (
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
              ) : (
                engine && (
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: dotColor(engine.model) }}
                  />
                )
              )}
              <span data-testid="brain-header-badge-label" className="hidden sm:inline">
                {baseLabel}
              </span>
              {pendingLabel && (
                <span
                  data-testid="brain-header-badge-pending"
                  className="hidden text-xs text-muted-foreground sm:inline"
                >
                  {pendingLabel}
                </span>
              )}
              {!isMixed && !pendingLabel && engine?.mode === "session" && (
                <span
                  data-testid="brain-header-badge-session"
                  className="hidden items-center gap-0.5 text-xs text-(--status-info) sm:inline-flex"
                >
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  session override · expires in {formatTtl(engine.expiresAt)}
                </span>
              )}
              {!isMixed && !pendingLabel && engine?.mode === "pinned" && (
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
  );
}
