---
phase: 103-brain-swap-control-surface
reviewed: 2026-07-28T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - convex/activeEngine.ts
  - convex/runtimeIngest.ts
  - convex/schema.ts
  - src/lib/brainsApi.ts
  - src/hooks/useActiveEngine.ts
  - src/components/brains/BrainPicker.tsx
  - src/components/brains/BrainPickerRow.tsx
  - src/components/brains/BrainHeaderBadge.tsx
  - src/components/brains/GlobalSwapModal.tsx
  - src/components/brains/BrainFallbackNotice.tsx
  - src/components/brains/BrainsWsRegistrar.tsx
  - src/layouts/DashboardLayout.tsx
  - src/pages/Chat.tsx
  - src/pages/Settings.tsx
  - src/App.tsx
  - e2e/brain-swap.spec.ts
findings:
  critical: 3
  warning: 3
  info: 0
  total: 6
status: issues_found
---

# Phase 103: Code Review Report

**Reviewed:** 2026-07-28
**Depth:** standard
**Files Reviewed:** 16 (13 non-trivial + 3 read for wiring context)
**Status:** issues_found

## Summary

Reviewed the Phase 103 Brain-Swap Control Surface source against `103-CONTRACT.md`, `103-CONTEXT.md`,
`103-UI-SPEC.md`, and `103-VALIDATION.md`. Per instructions, the six defects already recorded in
`103-VALIDATION.md` (the four fixed aria-hidden/global-fallback/registrar/scope-blind-catalogue bugs,
plus the two open GlobalSwapModal axis-violation / no-`swap.get_state`-on-mount gaps) are **not**
repeated here.

Three new Critical-severity defects were found, none of which were surfaced by the live validation
session: (1) the per-profile active-engine write path is a public, unauthenticated Convex mutation
that any client can call directly to forge "server-confirmed" engine state, directly undermining the
D-14/BSC-01 honesty guarantee this whole axis exists to provide, and deviating from the very
`gatewayQuota.ts` precedent its own docstring cites; (2) the brain picker's cmdk `CommandItem`s never
wire an `onSelect` handler, so keyboard-only selection (search → arrow-navigate → Enter, the exact
flow the component's own `autoFocus` search input invites) is completely non-functional — only a
direct mouse click on the nested row button works; (3) `GlobalSwapModal`'s "Revert global swap" toast
action is dead on arrival for the single most common path to reach it (clicking "Done"), because the
parent unmounts the modal in the same call that creates the toast, so the revert's own result-reporting
UI can never render even though the real WS commands (including the live global `swap.set`) still fire
silently in the background.

Three Warning-severity findings round out the review: a missing staleness guard on the picker's
scope-driven catalogue fetch, a scope-blind "current row" highlight, and an invalid nested-interactive
DOM pattern in `BrainPickerRow` that produces a dead keyboard tab stop.

## Critical Issues

### CR-01: `recordRouting` is a public mutation, not `internalMutation` — the honesty-critical write path is client-callable

**File:** `convex/activeEngine.ts:69-81` (also `convex/runtimeIngest.ts:534`)
**Issue:** `recordRouting` is declared with the plain, public `mutation` builder:

```ts
import { mutation, query } from "./_generated/server";
...
export const recordRouting = mutation({
  args: { profileId: v.string(), model: v.string(), mode: v.string(), ... },
  handler: async (ctx, args) => {
    await ctx.db.insert("activeEngineSnapshots", { ...args });
  },
});
```

and is invoked from the ingest path via the **public** namespace: `runtimeIngest.ts:534`
`await ctx.runMutation(api.activeEngine.recordRouting, {...})`. The file's own docstring states this
is meant to be the honesty-critical guarantee the entire per-profile axis rests on: *"this mutation is
the ONLY write path for the active-engine axis... The UI must NEVER call this directly to assert an
engine — doing so would reintroduce exactly the client-asserted stale-read failure BSC-01 exists to
kill."* That guarantee is enforced only by convention inside this repo's own React code — nothing
stops any holder of the public `VITE_CONVEX_URL` (embedded in the shipped frontend bundle) from
calling `api.activeEngine.recordRouting` directly from browser devtools or any Convex client SDK to
insert an arbitrary, fabricated "server-confirmed" engine row for any `profileId`. `BrainHeaderBadge`
renders a `--primary` "confirmed-live" pulse dot keyed on exactly this data being genuinely
server-reported (`isConfirmedLive`, `BrainHeaderBadge.tsx:164`) — a forged row would render with that
same trust signal.

This is also a direct deviation from the precedent the code cites: `convex/activeEngine.ts`'s own
comment says it mirrors `gatewayQuota.ts`'s `latestByProvider` (D-05 precedent), but `gatewayQuota.ts`
writes its analogous telemetry snapshot through an **`internalMutation`**
(`convex/gatewayQuota.ts:1,103`: `import { internalAction, internalMutation, query }`; `export const
insertSnapshot = internalMutation({...})`), invoked exclusively via `internal.gatewayQuota.insertSnapshot`
(`convex/gatewayQuota.ts:86`, `convex/crons.ts:101`) — never through the public `api.` namespace.
`recordRouting` should follow the same pattern and does not.

**Confidence:** High — verified `_generated/server.js:29,49` exports plain `queryGeneric`/
`mutationGeneric` with no auth wrapper, so `mutation` truly has no server-side caller restriction.

**Fix:**
```ts
// convex/activeEngine.ts
import { internalMutation, query } from "./_generated/server";
...
export const recordRouting = internalMutation({
  args: { /* unchanged */ },
  handler: async (ctx, args) => {
    await ctx.db.insert("activeEngineSnapshots", { ...args });
  },
});
```
```ts
// convex/runtimeIngest.ts:534
await ctx.runMutation(internal.activeEngine.recordRouting, { ... });
```
(`internal` is already imported in `runtimeIngest.ts:2` — the fix is a one-line rename at the call site.)

---

### CR-02: `BrainPicker`'s cmdk rows never wire `onSelect` — keyboard-only selection is completely non-functional

**File:** `src/components/brains/BrainPicker.tsx:414-419`
**Issue:**
```tsx
<CommandItem
  key={entry.id}
  value={entry.id}
  keywords={[entry.name, entry.vendor]}
  className={cn("p-0 rounded-md")}
>
  <BrainPickerRow entry={entry} ... onSelect={handleSelect} />
</CommandItem>
```
No `onSelect` prop is passed to `CommandItem`. Every other cmdk usage in this codebase wires it
(`src/components/CommandPalette.tsx:64,76,87,98,110,120,124,...`: `<CommandItem onSelect={() =>
select(...)}>`). Verified directly in the installed `cmdk` package
(`node_modules/cmdk/dist/index.mjs`): on `Enter`, the root `Command` handler does
`let i=M(); if(i){let l=new Event(Z); i.dispatchEvent(l)}` — it finds the DOM node of the
currently-*selected* (arrow-key-highlighted) item and dispatches a custom `cmdk-item-select` event to
it; `Item`'s own listener for that event calls `(v=f.current).onSelect?.(b.current)` — a no-op when
`onSelect` is `undefined`. cmdk's keyboard navigation never moves real DOM focus off the search input
(`CommandInput`, which has `autoFocus` here per line 384) — arrow keys only change a `data-selected`
attribute. So the intended cmdk flow this component itself sets up — type to search, arrow-navigate,
press Enter — silently does nothing on Enter. The only way to actually trigger a swap is to `Tab` away
from the search box into an individual row's native `<button>` and activate it directly, which defeats
the entire fuzzy-search/arrow-nav UX `103-UI-SPEC.md` §3 specifies as "the picker's focal point."

Mouse clicks still work only because `BrainPickerRow`'s own `<button onClick={handleActivate}>` is a
real DOM element that fires its own click handler independent of cmdk's (no-op) `onSelect` wiring —
which is why this was not caught by `e2e/brain-swap.spec.ts` (it drives selection via
`.locator('button', {hasText: ...}).click()`, a direct mouse-click simulation, never a keyboard Enter).

**Confidence:** High — verified against the installed `cmdk` source and the codebase's own consistent
`onSelect` convention elsewhere.

**Fix:** Wire `CommandItem`'s `onSelect` to the same activation path the row button uses, e.g. expose
an imperative trigger from `BrainPickerRow` (or lift `handleActivate`'s expand/dispatch branching into
the parent) and call it from `onSelect`:
```tsx
<CommandItem
  key={entry.id}
  value={entry.id}
  keywords={[entry.name, entry.vendor]}
  onSelect={() => rowActivateRef.current?.()}
  className={cn("p-0 rounded-md")}
>
```
(Note: `onSelect` must trigger the row's *expand-to-confirm* branch for expensive/unknown-tier
entries, not call `handleSelect` directly — a naive `onSelect={() => handleSelect(entry)}` would skip
the D-11/UI-SPEC §3 inline confirm step for keyboard users.)

---

### CR-03: `GlobalSwapModal`'s "Revert global swap" toast action is dead on the normal dismiss path — real commands fire with zero visible feedback

**File:** `src/components/brains/GlobalSwapModal.tsx:191-248`, `src/components/brains/BrainPicker.tsx:437-446`
**Issue:** `BrainPicker` mounts `GlobalSwapModal` conditionally on its own state:
```tsx
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
```
`GlobalSwapModal.handleDismiss()` (the handler behind the result phase's "Done" button, the normal
way a user finishes a swap) does, in order: (1) build the success toast with a "Revert global swap"
action whose `onClick` closes over `runRevert`, then (2) call `onOpenChange(false)`. Step (2) causes
`BrainPicker` to `setGlobalTarget(null)`, which — on the very next render — **unmounts
`GlobalSwapModal` entirely** (the `{globalTarget && (...)}` guard). The toast itself survives (sonner
renders outside this subtree), so the user can still click "Revert global swap" — but by then the
component instance `runRevert` closes over is gone. When `runRevert()` runs:
- `setPhase("result")`, `setResults(pending)`, `setIsBusy(true)`, and the final `setResults`/
  `setLiveDisplay` calls are all no-ops on an unmounted fiber.
- `onOpenChange(true)` reaches `BrainPicker`'s handler, which does nothing for `next === true` (it
  only reacts to `false`), so `globalTarget` stays `null` and the modal is never remounted — the user
  sees no dialog reopen at all.
- The two real side effects — `dispatch({ type: "swap.set", target: "brain", restore: true })` (the
  **live**, shipped global-axis restore) and the `Promise.allSettled` fan-out of
  `brainsApi.dispatchSwap(buildRestoreCommand(entry))` for every snapshotted profile — are plain async
  calls unrelated to React's tree and **do execute for real**. `dispatch(...)` is called without a
  `successMsg`, so a successful restore produces no toast at all; a failed one produces only a bare
  `toast.error`. The per-profile fan-out produces no toast in either direction.

Net effect: clicking "Revert global swap" (the only entry point to D-10's revert feature on the
normal completion path) silently fires a real, state-mutating command against the live Ástríðr
process with no dialog, no result rows, and — on success — no confirmation of any kind that anything
happened. This directly violates D-10 ("offer `Revert global swap`... in the success toast") and
UI-SPEC §5 ("A revert itself produces a fresh (smaller) result — reuse the same Dialog result-state
row list"), and is a distinct defect from the two already-recorded open GlobalSwapModal gaps
(`103-VALIDATION.md` defects #5/#6, which concern *which* axis is dispatched/discarded, not whether
the revert UI renders at all).

**Confidence:** High — traced the full unmount/closure chain; confirmed `useCommandDispatch.dispatch`
(`src/hooks/useCommandDispatch.ts:15-30`) only toasts on error or when a `successMsg` is supplied, and
`runRevert`'s `dispatch(...)` call supplies neither a `successMsg` nor any post-success toast of its
own.

**Fix:** Don't tie the modal's mount state to `globalTarget`. Keep a separate `dialogOpen` boolean
(or keep the component mounted and drive visibility purely via the `Dialog`'s own `open` prop) so the
component instance — and the closure `runRevert` needs to actually re-render a result — survives past
"Done."

## Warnings

### WR-01: Picker's scope-driven catalogue fetch has no staleness guard — rapid scope toggling can show/dispatch against the wrong axis's data

**File:** `src/components/brains/BrainPicker.tsx:197-220, 361-373`
**Issue:** `fetchCatalogue(targetScope)` is an unguarded async function with no request-sequencing
(no `AbortController`, no request-id/generation check). Both call sites —
`handleOpenChange` (on popover open) and the `ToggleGroup`'s `onValueChange` (on scope toggle) — fire
it and let whichever promise resolves last win via `setEntries(...)`, regardless of whether `scope`
has since changed again. A user who toggles "This profile" → "All profiles" → "This profile" quickly
enough can end up with `entries` populated from the (slower-resolving) global `swap.catalogue` fetch
while the `ToggleGroup` reads "This profile," or vice versa. Since `handleSelect`'s dispatch branch
keys only on the current `scope` state — not on which fetch actually populated `entries` — clicking a
row in that mismatched state dispatches through the wrong branch (`brainsApi.dispatchSwap` vs.
`GlobalSwapModal`) using an id drawn from the other axis's catalogue.
**Confidence:** Medium-high — the race is directly visible in the code; it requires quick repeated
toggling to trigger, so likelihood in normal use is low but the code path has no protection at all.
**Fix:** Track a generation counter/ref, increment it on every `fetchCatalogue` call, and ignore a
resolution whose captured generation no longer matches the latest:
```ts
const fetchGenRef = useRef(0);
const fetchCatalogue = useCallback(async (targetScope: PickerScope) => {
  const gen = ++fetchGenRef.current;
  ...
  if (gen !== fetchGenRef.current) return; // stale response, scope changed since
  setEntries(...);
}, [sendCommand]);
```

### WR-02: Picker row "current" highlight ignores scope — misleading in "All profiles" view

**File:** `src/components/brains/BrainPicker.tsx:422`
**Issue:** `isCurrent={activeEngine?.model === entry.id}` is passed to every `BrainPickerRow`
regardless of `scope`. `activeEngine` is always the **per-profile** engine for `profileId`
(`activeEngines[profileId]`, line 183). When `scope === "global"`, the rows being rendered come from
the live `swap.catalogue` (fleet-wide), and there is no fleet-wide "current" concept this picker
tracks — yet a row happens to get the `bg-primary/10` selected-row highlight whenever its id matches
*this one profile's* current engine, which reads as "this is the active global engine" when it is
really just an incidental match against one profile.
**Confidence:** High — directly readable from the code; UI-SPEC's "Accent" table reserves the
selected-row highlight for a genuine current-selection signal, not a scope-mismatched one.
**Fix:** `isCurrent={scope === "profile" && activeEngine?.model === entry.id}`.

### WR-03: Health-dot tooltip trigger is a focusable element nested inside the row's own `<button>` — invalid content model, dead tab stop

**File:** `src/components/brains/BrainPickerRow.tsx:138-163`
**Issue:** The row's entire clickable surface is a single `<button type="button" onClick=
{handleActivate}>` (line 138). Nested inside it is:
```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <span tabIndex={0} aria-label={`Health: ${HEALTH_LABEL[healthStatus]}`} ... />
  </TooltipTrigger>
  <TooltipContent side="top"><p className="text-xs">{HEALTH_LABEL[healthStatus]}</p></TooltipContent>
</Tooltip>
```
A `<span tabIndex={0}>` is interactive/focusable content nested inside a `<button>`, which the HTML5
content model disallows (a button must not contain interactive descendants). In practice this
produces a genuine dead keyboard stop: the span is reachable via `Tab` (it has no sibling elsewhere in
the row that is independently tabbable), but it has no `onKeyDown`/`onClick` of its own, so pressing
Enter/Space on it does nothing — it exists purely to host hover/focus-triggered tooltip content, yet
announces itself to assistive tech and keyboard users as a focusable control. This pattern is new to
this phase — the codebase's existing health-dot precedent, `ProviderHealthPanel.tsx`, does not use
`tabIndex` or a `TooltipTrigger` on its dots at all.
**Confidence:** Medium — the HTML nesting and dead-tab-stop behavior are directly verifiable from the
code; severity is bounded because the tooltip's text is already exposed via the same span's
`aria-label`, so the information isn't lost, only the extra tab stop is confusing.
**Fix:** Drop `tabIndex={0}` from the health-dot span (its `aria-label` already carries the status to
assistive tech via the row's own accessible name path) or, if an independently focusable health
indicator is wanted, move it outside the row's `<button>` boundary entirely.

---

_Reviewed: 2026-07-28_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---

**What I dropped and why** (precision-over-volume, per project standard): (1) `request_id: ""`
hardcoded in `BrainPicker.handleProfileDispatch` / `GlobalSwapModal`'s dispatch calls — looked like a
correlation bug, but `AstridrWSContext.sendCommand` (`src/contexts/AstridrWSContext.tsx:406-407`)
always overwrites `request_id` with a fresh `crypto.randomUUID()` before sending, so no ack-matching
bug actually exists. (2) Stub/live catalogue used only for display-metadata (provider-color dot) in
`BrainHeaderBadge`/`Settings.tsx`/`Chat.tsx` occasionally can't resolve a vendor for a live model id —
each site's own comments document this as an intentional, harmless display-only fallback, not a
correctness issue. (3) `BrainHeaderBadge.isConfirmedLive` not covering the global-fallback branch —
plausibly a deliberate, conservative choice (never claim "confirmed" for the honest-workaround path)
rather than an oversight; dropped for insufficient confidence it's wrong. (4) Unused `by_profileId`
index on `activeEngineSnapshots` (`convex/schema.ts:1963`) — plausible forward-looking index for a
future per-profile history query, not a defect. (5) `GlobalSwapModal`'s dialog title staying
"Swap all profiles to {X}?" through the result phase — a copy nit at most; `103-UI-SPEC.md` §4 doesn't
mandate a title change on the confirm→result transition, so this wasn't reported as a finding.
