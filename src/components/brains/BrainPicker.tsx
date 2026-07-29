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
 *
 * Keyboard activation (103-11, CR-02): `handleActivate` is the single branch decision both
 * `CommandItem.onSelect` (search → arrow → Enter) and `BrainPickerRow`'s own button (mouse click)
 * call — see its own doc comment below. `fetchCatalogue` (WR-01) is generation-guarded so a rapid
 * scope toggle can never leave the rendered catalogue on one axis while `scope` points at the
 * other.
 *
 * 103-12 (CR-03/WR-02): `globalDialogOpen` is a SEPARATE boolean from `globalTarget` — the modal's
 * VISIBILITY, not its MOUNT state. `globalTarget` is only ever replaced by a new selection, never
 * nulled on close, so the `GlobalSwapModal` instance (and the `runRevert` closure its "Revert
 * global swap" toast action depends on) survives past "Done." WR-02: the row highlight (`isCurrent`)
 * is scope-aware — `global` scope compares against `useGlobalBrainOverride()`, `profile` scope keeps
 * comparing against the per-profile `useActiveEngine()` reading.
 *
 * 103-16 (CR-01): `globalSelectionNonce` is incremented in `handleSelect`'s global branch on EVERY
 * activation, including a repeat activation of the same catalogue entry, and passed to
 * `GlobalSwapModal` as `selectionNonce`. That is what lets the modal tell "the user just picked a
 * brain again" apart from "this open transition is a revert reopening the same live instance" —
 * `GlobalSwapModal.runRevert`'s own `onOpenChange(true)` call never touches this component's state,
 * so it can never bump the nonce and can never trigger the modal's reset effect.
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
import { BrainPickerRow, needsCostConfirm } from "@/components/brains/BrainPickerRow";
import { GlobalSwapModal, type GlobalSwapProfile } from "@/components/brains/GlobalSwapModal";
import { useActiveEngine } from "@/hooks/useActiveEngine";
import { useGlobalBrainOverride } from "@/hooks/useResolvedBrain";
import { useProfileConfigs } from "@/hooks/useProfileConfigs";
import { useAstridrWS } from "@/contexts/AstridrWSContext";
import { brainsApi, BRAINS_STUB_ACTIVE, type CatalogueEntry } from "@/lib/brainsApi";
import { cn } from "@/lib/utils";

/** Raw entry shape `swap.catalogue` actually returns (`ws_commands.py::_handle_swap_catalogue`,
 * mirrored by `BrainControl.tsx`'s own `CatalogueEntry`) — id/name/vendor only, none of the
 * per-profile `CatalogueEntry`'s D-07 fields (group/billing/costTier/...), because the live global
 * axis has never carried that data. */
interface GlobalCatalogueEntry {
  id: string;
  name: string;
  vendor?: string;
}

/**
 * Adapts a live `swap.catalogue` entry into this picker's `CatalogueEntry` shape so it can render
 * through the SAME D-07 grouped rows the per-profile branch uses — no second render path. Every
 * global-axis entry is billed per-token through the gateway, so `group`/`billing: "api"` is an
 * accurate description, not an invented one.
 *
 * `costTier: "normal"` rather than `"unknown"` is a deliberate choice, not a guess dressed up as
 * data: the shared `needsCostConfirm` predicate (`BrainPickerRow.tsx`) that both this file's
 * `handleActivate` and the row itself consult is scope-blind — it fires the inline expand-to-confirm
 * step for ANY row regardless of "This profile" vs. "All profiles" scope. 103-UI-SPEC.md §3 is explicit that the two frictions must
 * never stack for the global branch ("the row still dispatches into the global-swap modal...
 * instead of a second confirmation surface") — `GlobalSwapModal` already owns cost-tier warning
 * copy of its own (`needsCostWarning`). Tagging every live entry `"unknown"` here would silently
 * re-introduce the double-confirm UI-SPEC forbids and change this task's explicitly out-of-scope
 * dispatch semantics as a side effect of a labeling choice. `quotaRemainingPct`/`health` stay
 * omitted (both optional) — `swap.catalogue` has never reported either.
 */
function normalizeGlobalCatalogueEntry(entry: GlobalCatalogueEntry): CatalogueEntry {
  return {
    id: entry.id,
    name: entry.name,
    vendor: entry.vendor ?? "",
    group: "api",
    billing: "api",
    costTier: "normal",
  };
}

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
  // 103-12/CR-03: VISIBILITY only. Decoupled from `globalTarget` (the MOUNT guard, below) so the
  // modal instance survives "Done" and a later "Revert global swap" toast click can genuinely
  // reopen it — see this file's own docstring.
  const [globalDialogOpen, setGlobalDialogOpen] = useState(false);
  // 103-16/CR-01: bumped on every global-scope activation (including a repeat of the same brain) —
  // see this file's own docstring and GlobalSwapModal's `selectionNonce` prop doc.
  const [globalSelectionNonce, setGlobalSelectionNonce] = useState(0);

  // Consumed at most once, ever, across this component's lifetime — the mixed-badge contextual
  // default (D-08) is not a preference that can re-arm itself.
  const consumedEntryScope = useRef(false);

  // WR-01: incremented at the top of every `fetchCatalogue` invocation. A response is only
  // applied if its captured generation is still the latest one when it resolves — a rapid scope
  // toggle ("This profile" -> "All profiles" -> "This profile") can otherwise let the SLOWER
  // (now-superseded) request's response win, leaving the rendered catalogue on one axis while
  // `scope` (and therefore the dispatch branch) points at the other.
  const fetchGenRef = useRef(0);

  const activeEngines = useActiveEngine();
  const activeEngine = activeEngines[profileId] ?? null;
  const allProfiles = useProfileConfigs();
  const { sendCommand } = useAstridrWS();
  // WR-02: the "All profiles" scope's row highlight must compare against the global axis, not the
  // per-profile engine — see `isCurrent` below.
  const { modelOverride: globalOverrideModel } = useGlobalBrainOverride();

  /**
   * Scope-aware catalogue source (fix for the scope-blind picker bug): "profile" keeps using
   * `brainsApi.getCatalogue()` exactly as before — that seam is still the stub-backed, deferred
   * per-profile axis (103-CONTRACT.md §1, Ástríðr Phase 184.1) and must never be told otherwise.
   * "global" instead reads the LIVE `swap.catalogue` command the same way `BrainControl.tsx:142`
   * already does — same request shape, same `ack.status === "ok" && Array.isArray(ack.entries)`
   * success check, same "anything else is an error, never a silent empty success" handling — so a
   * real backend failure surfaces the existing error state instead of quietly rendering as an
   * empty catalogue or falling back to stub data.
   */
  const fetchCatalogue = useCallback(
    async (targetScope: PickerScope) => {
      const gen = ++fetchGenRef.current;
      setFetchError(false);
      setEntries(null);
      try {
        if (targetScope === "global") {
          const ack = await sendCommand({ type: "swap.catalogue", target: "brain" });
          if (gen !== fetchGenRef.current) return; // stale response, scope changed since
          if (ack.status === "ok" && Array.isArray(ack.entries)) {
            setEntries(
              (ack.entries as GlobalCatalogueEntry[]).map(normalizeGlobalCatalogueEntry)
            );
          } else {
            setFetchError(true);
          }
          return;
        }
        const list = await brainsApi.getCatalogue();
        if (gen !== fetchGenRef.current) return; // stale response, scope changed since
        setEntries(list);
      } catch {
        if (gen !== fetchGenRef.current) return; // stale response, scope changed since
        setFetchError(true);
      }
    },
    [sendCommand]
  );

  const handleOpenChange = (next: boolean) => {
    if (!isOpenControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
    if (next) {
      let nextScope: PickerScope = "profile";
      if (entryScope === "global" && !consumedEntryScope.current) {
        nextScope = "global";
        consumedEntryScope.current = true;
      }
      setScope(nextScope);
      setExpandedId(null);
      void fetchCatalogue(nextScope);
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
        setGlobalDialogOpen(true);
        // 103-16/CR-01: every activation is a fresh selection, even a repeat of the same entry —
        // increment unconditionally so GlobalSwapModal's reset effect always sees a change.
        setGlobalSelectionNonce((n) => n + 1);
        handleOpenChange(false);
        return;
      }
      void handleProfileDispatch(entry);
    },
    [scope, handleProfileDispatch]
  );

  /**
   * handleActivate — the single activation entry point for BOTH input modes (103-11, CR-02):
   * `CommandItem`'s cmdk `onSelect` (keyboard Enter, driven by cmdk's own custom-event dispatch
   * to the currently arrow-highlighted item — never a bubbled click) and `BrainPickerRow`'s own
   * button (mouse click; the row stops propagation on every internal click so it never ALSO
   * reaches cmdk's bubbled click-select path, which would otherwise double-fire this function).
   * Because both input modes call this exact function, the expand-to-confirm branch (UI-SPEC §3)
   * and the D-15 global confirm gate (via `handleSelect`'s unchanged global-scope branch) can
   * never drift apart between mouse and keyboard.
   */
  const handleActivate = useCallback(
    (entry: CatalogueEntry) => {
      if (expandedId === entry.id) {
        // The inline confirm row is already open for this entry -- this activation IS the
        // confirmation (keyboard parity with click-row-then-click-Confirm: two deliberate
        // actions, never one).
        handleSelect(entry);
        setExpandedId(null);
        return;
      }
      if (needsCostConfirm(entry)) {
        setExpandedId(entry.id);
        return;
      }
      handleSelect(entry);
    },
    [expandedId, handleSelect]
  );

  const groups = useMemo(() => {
    if (!entries) return [];
    return GROUP_ORDER.map(({ group, label }) => ({
      label,
      entries: entries.filter((e) => e.group === group),
    })).filter((g) => g.entries.length > 0);
  }, [entries]);

  /**
   * 103-17 (gap closure, OBS 8): the live 2026-07-29 checkpoint found the global-swap confirm
   * modal reporting a pinned-default count of 0 against three real profiles that each carried a
   * configured `modelPreferences.primary` — because the pre-fix code derived BOTH `current` AND
   * `mode`/pinned-status from `activeEngines` (zero rows for the real profiles), conflating two
   * genuinely different questions: "what is this profile's LIVE engine" (telemetry,
   * `useActiveEngine`, D-14) and "does this profile have a CONFIGURED default that a global
   * override would shadow" (config, `profileConfigs.modelPreferences.primary`, already in hand via
   * `allProfiles`). `currentModel`/`currentModelDisplayName`/`mode` are UNCHANGED below — still
   * telemetry-only, per `useActiveEngine.ts`'s docstring on why config must never backfill the
   * live column (the "obvious fix" this plan's own PLAN.md calls out as wrong). Only
   * `hasConfiguredDefault`/`configuredDefault`/`configuredDefaultDisplayName` are new, and they are
   * the ONLY fields `GlobalSwapModal` now reads to compute `pinnedCount` and the shadowing warning.
   */
  const globalSwapProfiles = useMemo<GlobalSwapProfile[]>(() => {
    return allProfiles.map((p) => {
      const engine = activeEngines[p.profileId] ?? null;
      const currentModel = engine?.model ?? "auto";
      const currentEntry = entries?.find((e) => e.id === currentModel);
      const rawPrimary: unknown = (p as { modelPreferences?: { primary?: unknown } })
        .modelPreferences?.primary;
      const configuredDefault =
        typeof rawPrimary === "string" && rawPrimary.length > 0 ? rawPrimary : null;
      const configuredDefaultEntry = configuredDefault
        ? entries?.find((e) => e.id === configuredDefault)
        : undefined;
      return {
        profileId: p.profileId,
        currentModel,
        currentModelDisplayName: currentEntry?.name ?? (engine ? currentModel : "Auto"),
        mode: engine?.mode ?? "inherited",
        hasConfiguredDefault: configuredDefault !== null,
        configuredDefault,
        configuredDefaultDisplayName: configuredDefault
          ? (configuredDefaultEntry?.name ?? configuredDefault)
          : null,
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
                  if (!next) return;
                  const nextScope = next as PickerScope;
                  // The catalogue is scope-sourced now (profile -> brainsApi.getCatalogue(),
                  // global -> live swap.catalogue) -- switching scope mid-open must re-fetch, or
                  // this would keep rendering the OLD scope's list under the NEW scope's dispatch
                  // branch, recreating the scope-blind bug this fix closes.
                  setScope(nextScope);
                  void fetchCatalogue(nextScope);
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
                          onSelect={() => handleActivate(entry)}
                          className={cn("p-0 rounded-md")}
                        >
                          <BrainPickerRow
                            entry={entry}
                            isCurrent={
                              scope === "global"
                                ? globalOverrideModel === entry.id
                                : activeEngine?.model === entry.id
                            }
                            isExpanded={expandedId === entry.id}
                            onExpandChange={(exp) => setExpandedId(exp ? entry.id : null)}
                            onSelect={handleActivate}
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
          open={globalDialogOpen}
          onOpenChange={setGlobalDialogOpen}
          selectionNonce={globalSelectionNonce}
        />
      )}
    </>
  );
}
