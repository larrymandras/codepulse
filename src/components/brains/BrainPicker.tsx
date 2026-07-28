/**
 * BrainPicker.tsx — 103-05-T1. The phase's single interactive surface: a Popover-hosted cmdk
 * picker, grouped Subscription / API / Local (D-07), with an explicit This profile / All
 * profiles scope selector (D-08) whose two branches dispatch to two genuinely different places:
 *
 *  - "This profile" — `brainsApi.dispatchSwap` with the `gateway.model.set` shape from
 *    103-CONTRACT.md, `scope: "profile"`. This branch is stub-backed (D-16) and carries the STUB
 *    indicator.
 *  - "All profiles" — opens `GlobalSwapModal` (103-04), which owns the live, shipped `swap.set`
 *    dispatch itself. This branch never touches `brainsApi` and is never marked stub — labelling
 *    live data as stub would be its own honesty failure.
 *
 * Structurally follows `BrainControl.tsx` (Phase 186-09) — the single most important analog in
 * this phase, whose docstring records three live operator checkpoint rounds. Every one of those
 * lessons is carried forward here: the popover is wide enough for a ~300-entry catalogue, rows
 * wrap instead of clipping with a single-line ellipsis class, rows are grouped under section
 * headers, and the catalogue is re-fetched every time the popover opens rather than cached
 * client-side.
 *
 * No keyboard shortcut is bound here — the app's global open-palette binding lives in
 * `DashboardLayout.tsx` and the Skills palette owns its own separate binding; this picker opens
 * by click only.
 *
 * Pending treatment (D-15): the trigger keeps rendering the actually-active engine from
 * `useActiveEngine()` and layers a purely additive "switching to X…" suffix on top — the base
 * label is never touched optimistically. On a failed dispatch the suffix simply drops; there is
 * nothing to roll back because the UI never claimed the swap had landed. The real success toast
 * fires from a separate effect that watches the reactive engine query for confirmation, never
 * from the dispatch ack alone (D-14).
 *
 * Composition API (103-06): optional `trigger` / `open` / `onOpenChange` / `onPendingChange` props
 * let a consumer (`BrainHeaderBadge`) supply its own accessible trigger element and read pending
 * state via a callback, instead of mounting a second, invisibly-hidden `BrainPicker` instance and
 * relaying clicks/DOM-scraping pending state into it (the pre-103-06 shape, which left a real,
 * focusable trigger button sitting inside `aria-hidden="true"` — an axe `aria-hidden-focus`
 * violation). All four props are optional and independent of each other; every existing consumer
 * that omits them keeps the exact prior self-managed-Popover, own-default-trigger behavior.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlaskConical } from "lucide-react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BrainPickerRow } from "@/components/brains/BrainPickerRow";
import { GlobalSwapModal, type GlobalSwapProfile } from "@/components/brains/GlobalSwapModal";
import { useActiveEngine } from "@/hooks/useActiveEngine";
import { useProfileConfigs } from "@/hooks/useProfileConfigs";
import { brainsApi, BRAINS_STUB_ACTIVE, type CatalogueEntry } from "@/lib/brainsApi";
import { cn } from "@/lib/utils";

/** D-08's contextual, one-time exception to the reset-on-open rule: the mixed-state header badge
 * (a later plan's caller) may request the picker open on "All profiles" scope exactly once. Every
 * later open — including a later open with this same prop still supplied — resets to "This
 * profile"; it is a one-time entry-point default, never a persisted preference. */
export type PickerEntryScope = "profile" | "global";

export interface BrainPickerProps {
  /** The profile the "This profile" scope branch dispatches against, and whose active engine
   * drives the trigger's base label. */
  profileId: string;
  /** D-08's one-time contextual default. Omit for the normal reset-every-open behavior. */
  entryScope?: PickerEntryScope;
  /**
   * Custom trigger content, rendered via `PopoverTrigger asChild` in place of this component's own
   * default trigger button. Same `trigger: React.ReactNode` render-prop shape
   * `MuteDurationPicker.tsx` already establishes in this codebase (`<PopoverTrigger
   * asChild>{trigger}</PopoverTrigger>`) — chosen over a `renderTrigger` function because the
   * consumer's element (`BrainHeaderBadge`'s own visible, accessible button) needs no picker
   * internals passed into it, just Radix's own onClick/ref cloned onto it via `asChild`. Omit for
   * the default trigger (base label + pending suffix + STUB chip), which every existing consumer
   * (Chat composer, Settings row, 103-07) keeps using unchanged.
   */
  trigger?: React.ReactNode;
  /**
   * Controlled open state, mirroring the `open`/`onOpenChange` contract every other controlled
   * Popover in this codebase already exposes (`BrainControl.tsx`, `VoiceControl.tsx`,
   * `MuteDurationPicker.tsx`). Optional and independent of `trigger` — supplying a custom `trigger`
   * is already enough for a consumer's own button to open this popover (Radix's `asChild` clones
   * the real onClick handler onto it), so `BrainHeaderBadge` doesn't need to pass these. They exist
   * for any future consumer that needs to open/close the picker programmatically. Omit both for the
   * default self-managed open state.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Fires whenever the picker's own in-flight pending-swap suffix (D-15) changes, formatted
   * exactly as the default trigger renders it (`"· switching to {name}…"`, or `null` when idle).
   * Lets a consumer supplying a custom `trigger` mirror the real pending state into its own visible
   * label via a plain callback — never by scraping the DOM for `data-testid="brain-picker-pending-
   * suffix"`, which is the bug this API replaces.
   */
  onPendingChange?: (pendingLabel: string | null) => void;
}

type PickerScope = "profile" | "global";

const GROUP_ORDER: { group: CatalogueEntry["group"]; label: string }[] = [
  { group: "subscription", label: "Subscription" },
  { group: "api", label: "API" },
  { group: "local", label: "Local" },
];

export function BrainPicker({
  profileId,
  entryScope,
  trigger,
  open: openProp,
  onOpenChange,
  onPendingChange,
}: BrainPickerProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  // Controlled iff the consumer supplies `open` — checked once per render via `!== undefined`
  // rather than tracked in a ref, matching the plain-prop-comparison controlled/uncontrolled idiom
  // React itself uses (e.g. <input value>). No existing consumer passes `open`, so this is always
  // `false` today and every call below falls through to the original uncontrolled behavior.
  const isOpenControlled = openProp !== undefined;
  const open = isOpenControlled ? openProp : uncontrolledOpen;
  const [scope, setScope] = useState<PickerScope>("profile");
  const [entries, setEntries] = useState<CatalogueEntry[] | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingTarget, setPendingTarget] = useState<CatalogueEntry | null>(null);
  const [globalTarget, setGlobalTarget] = useState<CatalogueEntry | null>(null);

  // Consumed at most once, ever, across this component's lifetime — the mixed-badge contextual
  // default (D-08) is not a preference that can re-arm itself.
  const consumedEntryScope = useRef(false);

  const activeEngines = useActiveEngine();
  const activeEngine = activeEngines[profileId] ?? null;
  const allProfiles = useProfileConfigs();

  const fetchCatalogue = useCallback(async () => {
    setFetchError(false);
    setEntries(null);
    try {
      const list = await brainsApi.getCatalogue();
      setEntries(list);
    } catch {
      setFetchError(true);
    }
  }, []);

  const handleOpenChange = (next: boolean) => {
    if (!isOpenControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
    if (next) {
      if (entryScope === "global" && !consumedEntryScope.current) {
        setScope("global");
        consumedEntryScope.current = true;
      } else {
        setScope("profile");
      }
      setExpandedId(null);
      void fetchCatalogue();
    }
  };

  // D-14: the real per-profile success toast fires only once the reactive engine query confirms
  // the switch actually landed — never from the dispatch ack alone, which means "accepted," not
  // "switched."
  useEffect(() => {
    if (!pendingTarget) return;
    if (activeEngine?.model === pendingTarget.id) {
      toast.success(`${profileId} switched to ${pendingTarget.name}.`);
      setPendingTarget(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEngine?.model]);

  // Mirrors the pending suffix out to a custom-trigger consumer (see BrainPickerProps.onPendingChange
  // doc) — formatted identically to the string the default trigger's own DOM renders below, so a
  // consumer's display never disagrees with what the default trigger would have shown.
  useEffect(() => {
    onPendingChange?.(pendingTarget ? `· switching to ${pendingTarget.name}…` : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTarget]);

  const handleProfileDispatch = useCallback(
    async (entry: CatalogueEntry) => {
      setPendingTarget(entry);
      handleOpenChange(false);
      const ack = await brainsApi.dispatchSwap({
        type: "gateway.model.set",
        request_id: "",
        scope: "profile",
        profile_id: profileId,
        model: entry.id,
        mode: "session",
      });
      if (ack.status === "error") {
        setPendingTarget(null);
        const stillOn = activeEngine?.model ?? "its current brain";
        toast.error(
          `Couldn't switch to ${entry.name} — ${ack.error ?? "unknown error"}. ${profileId} is still on ${stillOn}.`
        );
      }
    },
    [profileId, activeEngine]
  );

  const handleSelect = useCallback(
    (entry: CatalogueEntry) => {
      if (scope === "global") {
        setGlobalTarget(entry);
        handleOpenChange(false);
        return;
      }
      void handleProfileDispatch(entry);
    },
    [scope, handleProfileDispatch]
  );

  const groups = useMemo(() => {
    if (!entries) return [];
    return GROUP_ORDER.map(({ group, label }) => ({
      label,
      entries: entries.filter((e) => e.group === group),
    })).filter((g) => g.entries.length > 0);
  }, [entries]);

  const globalSwapProfiles = useMemo<GlobalSwapProfile[]>(() => {
    return allProfiles.map((p) => {
      const engine = activeEngines[p.profileId] ?? null;
      const currentModel = engine?.model ?? "auto";
      const currentEntry = entries?.find((e) => e.id === currentModel);
      return {
        profileId: p.profileId,
        currentModel,
        currentModelDisplayName: currentEntry?.name ?? (engine ? currentModel : "Auto"),
        mode: engine?.mode ?? "inherited",
      };
    });
  }, [allProfiles, activeEngines, entries]);

  const baseLabel = activeEngine?.model ?? "Auto";

  return (
    <>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          {trigger ?? (
            <button
              type="button"
              aria-label={`Active brain: ${baseLabel}`}
              className="flex h-8 items-center gap-1.5 rounded-full border border-border px-2 text-sm hover:border-primary"
            >
              {pendingTarget && (
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-(--status-info) animate-pulse"
                />
              )}
              <span data-testid="brain-picker-base-label">{baseLabel}</span>
              {pendingTarget && (
                <span
                  data-testid="brain-picker-pending-suffix"
                  className="text-xs text-muted-foreground"
                >
                  · switching to {pendingTarget.name}…
                </span>
              )}
              {BRAINS_STUB_ACTIVE && (
                <span
                  data-testid="brain-picker-trigger-stub-chip"
                  className="rounded border border-dashed border-muted-foreground/40 px-1 text-xs text-muted-foreground"
                >
                  STUB
                </span>
              )}
            </button>
          )}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-96 p-2">
          <Command>
            <div className="flex flex-col gap-2">
              {BRAINS_STUB_ACTIVE && (
                <div className="flex items-center gap-2 rounded-md bg-(--status-warn)/10 px-3 py-2 text-sm text-(--status-warn)">
                  <FlaskConical className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Running on stub brain data — live Ástríðr backend not connected
                </div>
              )}
              <ToggleGroup
                type="single"
                value={scope}
                onValueChange={(next) => {
                  if (next) setScope(next as PickerScope);
                }}
                variant="outline"
                className="w-full"
              >
                <ToggleGroupItem value="profile" className="flex-1">
                  This profile
                </ToggleGroupItem>
                <ToggleGroupItem value="global" className="flex-1">
                  All profiles
                </ToggleGroupItem>
              </ToggleGroup>
              <CommandInput placeholder="Search brains…" autoFocus />
            </div>
            <CommandList className="max-h-80">
              {entries === null && !fetchError && (
                <div className="flex flex-col gap-1.5 p-1" aria-label="Loading brain catalogue">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                </div>
              )}
              {fetchError && (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">
                  Couldn't load the brain catalogue — try again in a moment.
                </p>
              )}
              {entries !== null && !fetchError && entries.length === 0 && (
                <div className="flex flex-col gap-1 px-2 py-4 text-center">
                  <p className="text-sm font-semibold">No brains reachable</p>
                  <p className="text-xs text-muted-foreground">
                    No API key or authenticated CLI is configured for any engine. Check Settings →
                    LLM Providers, or ask an operator to add credentials.
                  </p>
                </div>
              )}
              {entries !== null && !fetchError && entries.length > 0 && (
                <>
                  <CommandEmpty>No brains match your search.</CommandEmpty>
                  {groups.map((group) => (
                    <CommandGroup key={group.label} heading={group.label}>
                      {group.entries.map((entry) => (
                        <CommandItem
                          key={entry.id}
                          value={entry.id}
                          keywords={[entry.name, entry.vendor]}
                          className={cn("p-0 rounded-md")}
                        >
                          <BrainPickerRow
                            entry={entry}
                            isCurrent={activeEngine?.model === entry.id}
                            isExpanded={expandedId === entry.id}
                            onExpandChange={(exp) => setExpandedId(exp ? entry.id : null)}
                            onSelect={handleSelect}
                          />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {globalTarget && (
        <GlobalSwapModal
          target={globalTarget}
          profiles={globalSwapProfiles}
          open={globalTarget !== null}
          onOpenChange={(next) => {
            if (!next) setGlobalTarget(null);
          }}
        />
      )}
    </>
  );
}
