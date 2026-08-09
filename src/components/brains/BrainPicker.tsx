/**
 * BrainPicker.tsx — 103-05-T1, seam retired under Phase 109 Plan 03 (D-01/D-02). The phase's single
 * interactive surface: a Popover-hosted cmdk picker, grouped Subscription / API / Local (D-07), with
 * an explicit This profile / All profiles scope selector (D-08) whose two branches dispatch to two
 * genuinely different places:
 *
 *  - "This profile" — dispatches the real, server-registered `swap.set` with `profile_id` through
 *    the same bounded `useCommandDispatch()` sender the global axis already uses (D-01). The
 *    previous per-profile command type (retired in full by this plan — see 109-CONTEXT.md D-01 for
 *    its exact name) was never implemented by Ástríðr's dispatcher registry — an unknown `type`
 *    failed Pydantic union validation on every send.
 *  - "All profiles" — opens `GlobalSwapModal` (103-04), which owns the live, shipped `swap.set`
 *    dispatch itself.
 *
 * Both branches now read from the SAME single catalogue (`useBrainCatalogue`, D-02) — the catalogue
 * was never scope-dependent; only the dispatch target is.
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
 * Pending treatment (D-15): the trigger keeps rendering the actually-active engine (Phase 109
 * D-06: the full resolved precedence chain, `resolveActiveBrain`, not raw `useActiveEngine()`
 * telemetry alone) and layers a purely additive "switching to X…" suffix on top — the base
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
 * call — see its own doc comment below. The former WR-01 scope-toggle staleness race no longer
 * exists: since Phase 109 D-02 the catalogue is scope-independent, so toggling scope never
 * re-fetches and there is nothing left to race.
 *
 * 103-12 (CR-03/WR-02, superseded by 103-18): this component used to own `GlobalSwapModal`'s mount
 * lifecycle directly (a `globalTarget` mount guard decoupled from a `globalDialogOpen` visibility
 * flag). 103-18 hoists BOTH above the router outlet into `GlobalSwapContext` — see that module's
 * docstring for why (WR-01: the modal's mount lifetime was still bounded by whichever `BrainPicker`
 * host requested it, and the Chat composer pill's host is page-scoped, unlike `BrainHeaderBadge`).
 * This file now only calls `useGlobalSwap().openGlobalSwap(entry, globalSwapProfiles)` from
 * `handleSelect`'s global branch — it renders no `GlobalSwapModal` of its own. WR-02 is unaffected:
 * the row highlight (`isCurrent`) is still scope-aware, comparing against `useGlobalBrainOverride()`
 * for `global` scope and the per-profile resolved chain (Phase 109 D-06: `resolveActiveBrain`,
 * not raw telemetry alone) for `profile` scope.
 *
 * 103-16 (CR-01, hoisted by 103-18): the per-selection nonce that lets the modal tell "the user just
 * picked a brain again" apart from "this open transition is a revert reopening the same live
 * instance" now lives in `GlobalSwapContext`, bumped once per `openGlobalSwap` call — including a
 * repeat activation of the same catalogue entry — instead of in this component's own state. A
 * revert's own `onOpenChange(true)` call (inside `GlobalSwapModal`) never calls `openGlobalSwap`, so
 * it can never bump the nonce and can never trigger the modal's reset effect.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BrainPickerRow, needsCostConfirm } from "@/components/brains/BrainPickerRow";
import { type GlobalSwapProfile } from "@/components/brains/GlobalSwapModal";
import { useActiveEngine } from "@/hooks/useActiveEngine";
import { useGlobalBrainOverride, useProfileBrainOverrides, resolveActiveBrain } from "@/hooks/useResolvedBrain";
import { useProfileConfigs } from "@/hooks/useProfileConfigs";
import { useBrainCatalogue, type BrainCatalogueEntry } from "@/hooks/useBrainCatalogue";
import { useCommandDispatch } from "@/hooks/useCommandDispatch";
import { useGlobalSwap } from "@/contexts/GlobalSwapContext";
import {
  buildModelNameMap,
  resolveModelDisplayName,
  type CatalogueEntry,
} from "@/lib/brainsApi";
import { cn } from "@/lib/utils";

/**
 * Adapts a live `swap.catalogue` entry (`useBrainCatalogue`'s `BrainCatalogueEntry` —
 * id/name/vendor only) into this picker's `CatalogueEntry` shape so it can render through the D-07
 * grouped rows regardless of which scope dispatches it — one catalogue, one render path (D-02).
 * Every catalogue entry is billed per-token through the gateway, so `group`/`billing: "api"` is an
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
 * omitted (both optional) — `swap.catalogue` has never reported either. (D-09's real group/billing
 * mapping, replacing this flattening, is plan 109-07's job — out of this plan's scope.)
 */
function normalizeCatalogueEntry(entry: BrainCatalogueEntry): CatalogueEntry {
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
   * the default trigger (base label + pending suffix), which every existing consumer
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

/**
 * Bound on the per-profile "This profile" dispatch, mirroring `GlobalSwapModal`'s
 * `GLOBAL_SWAP_DISPATCH_TIMEOUT_MS` (T-109-08). `AstridrWSContext.sendCommand` can queue a command
 * with no timeout of its own when the socket is not OPEN, so `await dispatch(...)` could otherwise
 * hang forever — leaving the picker's pending-swap suffix stuck indefinitely. Exported for direct
 * test control (fake timers).
 */
export const PROFILE_SWAP_DISPATCH_TIMEOUT_MS = 15000;

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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingTarget, setPendingTarget] = useState<CatalogueEntry | null>(null);

  // Consumed at most once, ever, across this component's lifetime — the mixed-badge contextual
  // default (D-08) is not a preference that can re-arm itself.
  const consumedEntryScope = useRef(false);

  const activeEngines = useActiveEngine();
  const activeEngine = activeEngines[profileId] ?? null;
  const allProfiles = useProfileConfigs();
  // D-02: the ONE swap.catalogue fetcher, serving BOTH scopes — no second, scope-conditional
  // catalogue source. The hook's own generation guard supersedes a stale in-flight response on
  // `refetch()`; this component no longer needs its own.
  const { entries: rawEntries, error: catalogueError, refetch: refetchCatalogue } = useBrainCatalogue();
  const entries = useMemo<CatalogueEntry[] | null>(
    () => (rawEntries ? rawEntries.map(normalizeCatalogueEntry) : null),
    [rawEntries]
  );
  // WR-02: the "All profiles" scope's row highlight must compare against the global axis, not the
  // per-profile engine — see `isCurrent` below.
  const { modelOverride: globalOverrideModel } = useGlobalBrainOverride();
  // Phase 109 D-06: the live per-profile override map (`swap.state`'s `profile_overrides`), read
  // directly (mirroring `globalOverrideModel` above, not the composed `useResolvedBrain` hook) so
  // it can feed BOTH the single trigger's resolved reading below AND `globalSwapProfiles`'
  // per-row derivation without calling a hook inside `.map()` (Rules of Hooks).
  const profileOverrides = useProfileBrainOverrides();
  // ENGINE-03 SC1: the trigger's base label and the "This profile" scope's row highlight must
  // answer through the FULL resolved precedence chain (override -> global -> telemetry -> none),
  // not raw `activeEngine?.model` alone — this is the literal fix for a pinned profile rendering
  // its pre-pin engine. `profileId` is always defined here (a required prop), and this branch
  // never falls back to `lastTurnModel` (D-07), so the pure call omits it entirely.
  const resolvedTrigger = useMemo(
    () => resolveActiveBrain({ globalOverride: globalOverrideModel, activeEngines, profileId, profileOverrides }),
    [globalOverrideModel, activeEngines, profileId, profileOverrides]
  );
  // 103-18 (WR-01): requests a global swap through the hoisted, route-surviving instance owned by
  // `GlobalSwapContext` instead of mounting/owning a `GlobalSwapModal` of its own — see this file's
  // and that module's docstrings.
  const { openGlobalSwap } = useGlobalSwap();
  const { dispatch } = useCommandDispatch();

  /**
   * D-01's dispatch seam for the "This profile" branch (T-109-08): the same bounded
   * `Promise.race` + timeout + `finally`-clearTimeout wrapper `GlobalSwapModal.tsx`'s own
   * `dispatchBounded` already ships for the global axis, so a hang or rejection settles into an
   * honest error instead of leaving the picker's pending state stuck forever.
   */
  async function dispatchBounded(
    cmd: Record<string, unknown>
  ): Promise<{ status: "ok" | "error"; error?: string }> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        dispatch(cmd).then((ack) => ({ status: ack.status, error: ack.error })),
        new Promise<{ status: "error"; error: string }>((resolve) => {
          timer = setTimeout(
            () =>
              resolve({
                status: "error",
                error: "no response from Ástríðr — the command was never delivered",
              }),
            PROFILE_SWAP_DISPATCH_TIMEOUT_MS
          );
        }),
      ]);
    } catch (err) {
      return {
        status: "error",
        error: err instanceof Error ? err.message : "the command could not be delivered",
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

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
      // D-02: re-fetch every open (never caches client-side) — toggling scope AFTER open does NOT
      // re-fetch, since the catalogue no longer depends on scope.
      refetchCatalogue();
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
      // D-01: the real, server-registered swap.set with profile_id — plan 109-06 replaces this
      // whole ad-hoc pending-state block with the 5-state useProfileSwap machine and must not find
      // a second, competing implementation; this is the interim consumer.
      const ack = await dispatchBounded({
        type: "swap.set",
        target: "brain",
        value: entry.id,
        restore: false,
        profile_id: profileId,
      });
      if (ack.status === "error") {
        setPendingTarget(null);
        const stillOn = activeEngine?.model ?? "its current brain";
        toast.error(
          `Couldn't switch to ${entry.name} — ${ack.error ?? "unknown error"}. ${profileId} is still on ${stillOn}.`
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profileId, activeEngine, dispatch]
  );

  /**
   * 103-17 (gap closure, OBS 8): the live 2026-07-29 checkpoint found the global-swap confirm
   * modal reporting a pinned-default count of 0 against three real profiles that each carried a
   * configured `modelPreferences.primary` — because the pre-fix code derived BOTH `current` AND
   * `mode`/pinned-status from `activeEngines` (zero rows for the real profiles), conflating two
   * genuinely different questions: "what is this profile's LIVE engine" (telemetry,
   * `useActiveEngine`, D-14) and "does this profile have a CONFIGURED default that a global
   * override would shadow" (config, `profileConfigs.modelPreferences.primary`, already in hand via
   * `allProfiles`). `mode` is UNCHANGED below — still telemetry-only, per `useActiveEngine.ts`'s
   * docstring on why config must never backfill the live column (the "obvious fix" 103-17-PLAN.md
   * calls out as wrong). `hasConfiguredDefault`/`configuredDefault`/`configuredDefaultDisplayName`
   * are the ONLY fields `GlobalSwapModal` reads to compute `pinnedCount` and the shadowing warning
   * — kept separate on purpose (109-UI-SPEC.md §G's last paragraph): a saved config preference and
   * a live runtime pin are two different questions, and this memo must not conflate them.
   *
   * Phase 109 D-06 (109-UI-SPEC.md §G): `currentModel`/`currentModelDisplayName` now derive from
   * the FULL resolved precedence chain (`resolveActiveBrain`, per profile) rather than raw
   * `activeEngines` telemetry alone — a profile pinned moments ago now shows the pinned model in
   * this column immediately, instead of its stale pre-pin telemetry reading until the next
   * resolution. Called as the pure function per profile (not the `useResolvedBrain` hook), since
   * this memo iterates over ALL profiles — calling a hook inside `.map()` violates the Rules of
   * Hooks. The absent case renders §A's canonical honest-absent string, never a fabricated one.
   *
   * Defined ABOVE `handleSelect` (moved here by 103-18) because `handleSelect` now passes this
   * snapshot straight through to `openGlobalSwap` — `GlobalSwapContext` has no independent source
   * for it (see that module's docstring).
   */
  const globalSwapProfiles = useMemo<GlobalSwapProfile[]>(() => {
    return allProfiles.map((p) => {
      const engine = activeEngines[p.profileId] ?? null;
      const resolvedRow = resolveActiveBrain({
        globalOverride: globalOverrideModel,
        activeEngines,
        profileId: p.profileId,
        profileOverrides,
      });
      const currentModel = resolvedRow.model ?? "auto";
      const rawPrimary: unknown = (p as { modelPreferences?: { primary?: unknown } })
        .modelPreferences?.primary;
      const configuredDefault =
        typeof rawPrimary === "string" && rawPrimary.length > 0 ? rawPrimary : null;
      return {
        profileId: p.profileId,
        currentModel,
        currentModelDisplayName: resolvedRow.model
          ? resolveModelDisplayName(currentModel, entries)
          : "Not reported",
        mode: engine?.mode ?? "inherited",
        hasConfiguredDefault: configuredDefault !== null,
        configuredDefault,
        // UAT cosmetic fix: config ids are vendor-prefixed ("anthropic/claude-sonnet-5") while live
        // catalogue ids are not, so the previous exact-id lookup ALWAYS missed here and the
        // shadowing warning named a raw id. resolveModelDisplayName tolerates that mismatch.
        configuredDefaultDisplayName: configuredDefault
          ? resolveModelDisplayName(configuredDefault, entries)
          : null,
      };
    });
  }, [allProfiles, activeEngines, entries, globalOverrideModel, profileOverrides]);

  const handleSelect = useCallback(
    (entry: CatalogueEntry) => {
      if (scope === "global") {
        // 103-18 (WR-01): request the swap through the hoisted, route-surviving instance instead
        // of mounting/owning a GlobalSwapModal here. `openGlobalSwap` bumps the shared selection
        // nonce unconditionally (103-16/CR-01), including a repeat activation of the same entry.
        openGlobalSwap(entry, globalSwapProfiles, buildModelNameMap(entries));
        handleOpenChange(false);
        return;
      }
      void handleProfileDispatch(entry);
    },
    [scope, handleProfileDispatch, openGlobalSwap, globalSwapProfiles]
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

  // ENGINE-03 SC1/D-06: reads the full resolved chain, not raw telemetry — see `resolvedTrigger`.
  const baseLabel = resolvedTrigger.model ?? "Not reported";

  return (
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
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96 p-2">
        {/* Own TooltipProvider (UAT 2026-07-29 blocker): `BrainPickerRow` wraps each row's button
            in a Radix `<Tooltip>` (103-11's WR-03 fix), and Radix context follows the REACT tree,
            not the DOM — so this portaled content inherits its HOST's providers. `BrainHeaderBadge`
            happens to sit inside `DashboardLayout`'s TooltipProvider (DashboardLayout.tsx:588-603),
            but the Chat composer pill and Settings' `AgentProfileRows` render inside the routed
            `<Outlet/>`, which neither of DashboardLayout's providers wraps — the boundary already
            documented at SkillLifecycleMenu.tsx:186-190. Live UAT: those two entry points destroyed
            the popover the moment rows rendered ("`Tooltip` must be used within `TooltipProvider`").
            Owning the provider here makes the picker safe from ANY host, present or future, instead
            of requiring every host to remember — mirrors CodeVaultGraph.tsx's documented pattern. */}
        <TooltipProvider delayDuration={200}>
        <Command>
          <div className="flex flex-col gap-2">
            <ToggleGroup
              type="single"
              value={scope}
              onValueChange={(next) => {
                if (!next) return;
                // D-02: the catalogue is scope-INDEPENDENT now — toggling scope only changes the
                // dispatch branch and the row highlight source, never re-fetches.
                setScope(next as PickerScope);
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
            {entries === null && !catalogueError && (
              <div className="flex flex-col gap-1.5 p-1" aria-label="Loading brain catalogue">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            )}
            {catalogueError && (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">
                Couldn't load the brain catalogue — try again in a moment.
              </p>
            )}
            {entries !== null && !catalogueError && entries.length === 0 && (
              <div className="flex flex-col gap-1 px-2 py-4 text-center">
                <p className="text-sm font-semibold">No brains reachable</p>
                <p className="text-xs text-muted-foreground">
                  No API key or authenticated CLI is configured for any engine. Check Settings →
                  LLM Providers, or ask an operator to add credentials.
                </p>
              </div>
            )}
            {entries !== null && !catalogueError && entries.length > 0 && (
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
                              : resolvedTrigger.model === entry.id
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
        </TooltipProvider>
      </PopoverContent>
    </Popover>
  );
}
