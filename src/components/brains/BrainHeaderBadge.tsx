/**
 * BrainHeaderBadge.tsx — 103-06-T1. The dashboard-wide, always-visible active-brain badge
 * (D-05 item 2, UI-SPEC §2). Mounted once in `DashboardLayout`'s status cluster and rendered on
 * every page — an honest per-profile-fleet reading that says "Mixed brains" rather than silently
 * picking one profile's value when profiles disagree (the BSC-01 VitalsRail trap this phase
 * exists to remove).
 *
 * Reads exclusively through `useActiveEngine()` + the pure `deriveMixedState()` (103-03) — the
 * same shared view-model every brain surface reads, so this badge cannot disagree with itself
 * (D-14).
 *
 * Reuses `BrainPicker` (103-05) verbatim rather than building a second picker (prior_wave_context:
 * "if the badge opens a picker, mount THIS one"). `BrainPicker` owns its own Popover open-state
 * and trigger button internally — it exposes no controlled-open/custom-trigger prop, and
 * `BrainPicker.tsx` is out of this plan's file scope — so this component mounts a real
 * `BrainPicker` instance positioned invisibly (`opacity-0`, non-interactive) exactly behind its
 * own visible, accessible badge button, and relays clicks to `BrainPicker`'s real trigger
 * (identified by its own `aria-label="Active brain: …"` prefix) via a DOM ref. Because Radix
 * `PopoverContent` renders through a portal, the *content* of that real, hidden-trigger popover
 * still opens fully visible and interactive once relayed — only the trigger button itself stays
 * invisible, sitting exactly where the visible badge is.
 *
 * A `MutationObserver` mirrors `BrainPicker`'s own honestly-tracked pending-suffix DOM node
 * (`data-testid="brain-picker-pending-suffix"`, D-15) into this component's own visible pending
 * state, so the badge's accessible surface reflects the real in-flight dispatch `BrainPicker` is
 * already tracking, without this component duplicating any dispatch logic of its own.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Clock, Pin } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BrainPicker } from "@/components/brains/BrainPicker";
import { useActiveEngine, deriveMixedState } from "@/hooks/useActiveEngine";
import { useProfileConfigs } from "@/hooks/useProfileConfigs";
import { brainsApi, BRAINS_STUB_ACTIVE, type CatalogueEntry } from "@/lib/brainsApi";
import { PROVIDER_COLORS } from "@/lib/providers";
import { cn } from "@/lib/utils";

const PICKER_TRIGGER_SELECTOR = 'button[aria-label^="Active brain"]';
const PENDING_SUFFIX_SELECTOR = '[data-testid="brain-picker-pending-suffix"]';

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

  const pickerHostRef = useRef<HTMLDivElement>(null);

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

  // Mirrors the real, hidden BrainPicker's own pending-suffix DOM node into this component's
  // visible state (see file docstring) — never a second, independently-tracked dispatch state.
  useEffect(() => {
    const host = pickerHostRef.current;
    if (!host) return;
    const sync = () => {
      const suffix = host.querySelector(PENDING_SUFFIX_SELECTOR);
      setPendingLabel(suffix ? suffix.textContent : null);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(host, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
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

  const handleBadgeClick = () => {
    pickerHostRef.current?.querySelector<HTMLButtonElement>(PICKER_TRIGGER_SELECTOR)?.click();
  };

  return (
    <div className="relative inline-flex">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={ariaLabel}
            onClick={handleBadgeClick}
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
        <TooltipContent side="bottom" sideOffset={8}>
          <p className="text-xs">{ariaLabel}</p>
        </TooltipContent>
      </Tooltip>
      {/* The real BrainPicker instance this badge relays clicks into — see file docstring for
          why it is mounted invisibly rather than replaced with a second, hand-built picker. */}
      <div
        ref={pickerHostRef}
        aria-hidden="true"
        className="absolute inset-0 opacity-0 pointer-events-none"
      >
        <BrainPicker profileId={effectiveProfileId} entryScope={isMixed ? "global" : undefined} />
      </div>
    </div>
  );
}
