---
phase: 103-brain-swap-control-surface
reviewed: 2026-07-29T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - convex/activeEngine.ts
  - convex/activeEngine.test.ts
  - convex/runtimeIngest.ts
  - e2e/brain-swap.spec.ts
  - src/components/brains/BrainHeaderBadge.tsx
  - src/components/brains/BrainHeaderBadge.test.tsx
  - src/components/brains/BrainPicker.tsx
  - src/components/brains/BrainPicker.test.tsx
  - src/components/brains/BrainPickerRow.tsx
  - src/components/brains/BrainPickerRow.test.tsx
  - src/components/brains/GlobalSwapModal.tsx
  - src/components/brains/GlobalSwapModal.test.tsx
  - src/components/control-center/BrainControl.test.tsx
  - src/hooks/useResolvedBrain.ts
  - src/hooks/useResolvedBrain.test.tsx
  - src/pages/Chat.tsx
  - src/pages/Chat.test.tsx
findings:
  critical: 1
  warning: 1
  info: 0
  total: 2
status: issues_found
---

# Phase 103: Code Review Report (Gap-Closure Cycle, Plans 103-09..103-15)

**Reviewed:** 2026-07-29
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

This review covers the diff between `0b354131` (post-first-review-cycle) and `HEAD` — plans
103-09 through 103-15, the gap-closure cycle that fixed the prior review's CR-01/CR-02/CR-03 and
WR-01/WR-02/WR-03 findings, plus the two open `103-VALIDATION.md` defects (#5 axis violation, #6
no-snapshot-on-mount) and the live-discovered revert-to-clear-instead-of-restore regression
(Plan 103-14).

Verification against the prior review's own record: `convex/activeEngine.ts:78` now declares
`recordRouting` as `internalMutation` (CR-01 fixed, with a source-level regression guard in
`convex/activeEngine.test.ts:93-116`); `convex/runtimeIngest.ts:534` calls it through
`internal.activeEngine.recordRouting`. `BrainPicker.tsx`'s `CommandItem`s now wire
`onSelect={() => handleActivate(entry)}` (`BrainPicker.tsx:480`, CR-02 fixed). `GlobalSwapModal`'s
mount is decoupled from its own visibility via `globalDialogOpen` vs. `globalTarget`
(`BrainPicker.tsx:190-194, 504-511`, CR-03 fixed). WR-01 (fetch staleness), WR-02 (scope-blind
row highlight), and WR-03 (nested-focusable health dot) are all fixed and directly verifiable in
the current source. None of these six are repeated here.

One new Critical-severity defect was found: fixing CR-03 (decoupling the modal's mount from its
visibility so a revert toast has a live instance to render into) introduced a new failure mode —
the modal's internal reset guard keys off `target.id` string equality, not "was this a fresh user
selection," so reselecting the *same* brain after a completed (or failed) swap reopens the modal
showing the stale, no-longer-current result screen instead of a fresh confirm prompt. This is
untested (the mount-lifecycle test suite in `BrainPicker.test.tsx` fully mocks `GlobalSwapModal`,
so the real reset-guard logic is never exercised against this scenario) and, for the
failed-dispatch case, silently removes the retry path.

One Warning-severity finding: the same CR-03 fix only keeps the modal instance alive for the
lifetime of its *hosting* `BrainPicker` — for the Chat composer pill's picker instance (page-scoped
to `/chat`), navigating away before clicking the "Revert global swap" toast action reproduces a
narrower version of the exact defect CR-03 was written to close: the live `swap.set` command still
fires for real, with zero UI feedback, because the component instance the toast's closure depends
on has since unmounted.

No hardcoded secrets, dangerous functions (`eval`, `innerHTML`), or empty catch blocks were found
in the diff. The known, deliberately-unfixed OBS-8 defect (`BrainPicker.tsx:362-374` deriving
`currentModelDisplayName`/pin status from `activeEngineSnapshots` instead of
`profileConfigs.modelPreferences`) is unchanged by this cycle's diff and is not re-reported here,
per instructions — it was not made worse.

## Critical Issues

### CR-01: `GlobalSwapModal` reuses stale `phase`/`outcome` state when the same brain is selected twice — a completed-or-failed result screen reopens instead of a fresh confirm prompt

**File:** `src/components/brains/GlobalSwapModal.tsx:197-209` (reset guard), interacting with
`src/components/brains/BrainPicker.tsx:190-194,312-323,504-511` (the CR-03 mount-lifecycle fix)

**Issue:** Before this cycle, `BrainPicker` unmounted `GlobalSwapModal` on every close
(`open={globalTarget !== null}`, `onOpenChange={(next) => { if (!next) setGlobalTarget(null) }}`)
— a full unmount/remount reset every internal `useState` for free on the *next* selection,
whatever its id. The 103-12 CR-03 fix deliberately stopped doing that (so a "Revert global swap"
toast click after "Done" has a live instance to reopen):

```tsx
// src/components/brains/BrainPicker.tsx:190-194
const [globalTarget, setGlobalTarget] = useState<CatalogueEntry | null>(null);
// 103-12/CR-03: VISIBILITY only. Decoupled from `globalTarget` (the MOUNT guard, below) so the
// modal instance survives "Done" and a later "Revert global swap" toast click can genuinely
// reopen it — see this file's own docstring.
const [globalDialogOpen, setGlobalDialogOpen] = useState(false);
```

```tsx
// src/components/brains/BrainPicker.tsx:504-511
{globalTarget && (
  <GlobalSwapModal
    target={globalTarget}
    profiles={globalSwapProfiles}
    open={globalDialogOpen}
    onOpenChange={setGlobalDialogOpen}
  />
)}
```

`globalTarget` is now only ever *replaced*, never nulled, by `handleSelect`:

```tsx
// src/components/brains/BrainPicker.tsx:312-323
const handleSelect = useCallback(
  (entry: CatalogueEntry) => {
    if (scope === "global") {
      setGlobalTarget(entry);
      setGlobalDialogOpen(true);
      handleOpenChange(false);
      return;
    }
    void handleProfileDispatch(entry);
  },
  [scope, handleProfileDispatch]
);
```

So the `GlobalSwapModal` component instance now genuinely persists across a full swap
confirm→dispatch→result→"Done" cycle, and beyond. Its own internal reset effect, however, keys
purely off `target.id` string equality — not "is this a new user action":

```tsx
// src/components/brains/GlobalSwapModal.tsx:193-209
// 103-12-T2/CR-03: reset only when a genuinely NEW target arrives — never on every `open`
// transition (see prevTargetIdRef comment above)...
useEffect(() => {
  if (target.id === prevTargetIdRef.current) return;
  prevTargetIdRef.current = target.id;
  setPhase("confirm");
  setOutcome({ status: "pending" });
  setIsBusy(false);
  setLastAction("swap");
  setSnapshot([]);
  setRevertRestoredName(null);
  priorOverrideRef.current = null;
  priorOverrideDisplayNameRef.current = null;
  clearConfirmTimeout();
}, [target.id]);
```

Reproduction: (1) open the picker in "All profiles" scope, select brain X — `globalTarget` is set,
modal mounts with `phase="confirm"`. (2) Click "Swap all profiles to X" — `runSwap()` sets
`phase="result"`, dispatches, and (assuming the readback matches) `outcome` resolves to
`{status:"confirmed"}`. (3) Click "Done" — `handleDismiss()` fires the summary toast and calls
`onOpenChange(false)` (`GlobalSwapModal.tsx:299-320`); the instance stays mounted per the CR-03
fix, only `globalDialogOpen` flips false. (4) Later, reopen the picker and select brain **X again**
(the same catalogue entry id — a completely ordinary action, e.g. re-confirming the swap is still
in effect, or simply clicking the currently-highlighted row again). `handleSelect` calls
`setGlobalTarget(entry)` with a new object that has the *same* `.id` as before, and
`setGlobalDialogOpen(true)`. The reset effect's guard (`target.id === prevTargetIdRef.current`)
is true, so it returns early — `phase` is still `"result"` and `outcome` is still
`{status:"confirmed"}` **from the previous, unrelated swap**. The dialog reopens directly into the
result screen showing `"Switched to X."` (`describeOutcome`, `GlobalSwapModal.tsx:124-130`) with
the *old* snapshot rows — no fresh confirm prompt, and **no new command was actually dispatched**
this time, so the claim being displayed is not backed by anything that happened in this
interaction. If the live global override has changed in the interim (another tab, another
operator, or a manual "Restore usual brain" click via `BrainControl`), this is a stale-state-
presented-as-current-state display — the exact category of failure BSC-01/D-14 exist to eliminate
for this whole phase.

The consequence is worse for a **failed** swap: if `runSwap()`'s dispatch errors
(`outcome = {status:"error", reason}`), the result phase shows only a "Done" button — there is no
retry affordance in that phase. Reselecting the same brain to retry hits the same `target.id`
guard and reopens showing the *identical stale error message*, with no way to re-trigger the
dispatch short of selecting a *different* brain first (which resets `prevTargetIdRef`) and then
reselecting the original one. The normal retry-a-failed-swap path is silently broken for the most
obvious retry action (pick the same brain again).

This exact scenario is untested: `GlobalSwapModal` is fully mocked in `BrainPicker.test.tsx`
(`vi.mock("@/components/brains/GlobalSwapModal", ...)`, confirmed at that file's own top-of-file
comment), so its `BrainPicker — GlobalSwapModal mount lifecycle (103-12, CR-03)` describe block
(`BrainPicker.test.tsx:820-872`) only asserts that `BrainPicker` passes the same `target.id`
through on reselection — it cannot and does not exercise the real reset-guard effect inside
`GlobalSwapModal.tsx`. `GlobalSwapModal.test.tsx` (which does render the real component) has no
test that rerenders with an unchanged `target.id` after a completed swap/revert.

**Confidence:** High — the reset-guard code and the CR-03 mount-persistence change are both
directly quoted above; the interaction between them is a straightforward trace, not a speculative
concern, and the specific untested gap is independently confirmed via the mock setup in
`BrainPicker.test.tsx`.

**Fix:** Key the reset guard off "was this dialog just (re)opened for a fresh selection," not
target-id equality alone — e.g. reset whenever `open` transitions from `false` to `true` *and*
`phase !== "confirm"` (so an in-flight "result" from an unrelated already-open dialog isn't
clobbered), or simplest: always reset to `"confirm"` on the `false -> true` edge of `open`,
independent of whether `target.id` changed:

```tsx
const prevOpenRef = useRef(false);
useEffect(() => {
  const justOpened = open && !prevOpenRef.current;
  prevOpenRef.current = open;
  if (!justOpened) return;
  // ...only reset here if this open is a fresh selection, not a revert-triggered reopen.
  // A revert reopen calls onOpenChange(true) itself (GlobalSwapModal.tsx:283) while phase is
  // already "result" — that path must be distinguished from a brand-new BrainPicker selection,
  // e.g. by having runRevert set a ref flag before calling onOpenChange(true).
}, [open, target.id]);
```
(Note the fix must not regress the revert flow, which also calls `onOpenChange(true)`
programmatically from `runRevert` — `GlobalSwapModal.tsx:283` — while deliberately wanting to
*keep* the in-flight revert state. A `justSelectedRef` set by `BrainPicker.handleSelect` right
before `setGlobalDialogOpen(true)`, and cleared by the modal after consuming it, is one way to
distinguish "fresh selection reopen" from "revert reopen" without reintroducing the CR-03 bug.)

## Warnings

### WR-01: The CR-03 fix only survives for the lifetime of the *hosting* `BrainPicker` instance — the page-scoped Chat composer pill can still lose the revert toast's live command with zero UI feedback

**File:** `src/components/brains/GlobalSwapModal.tsx:270-297` (`runRevert`), `src/pages/Chat.tsx:154-221` (`BrainComposerPill`, its own independent `<BrainPicker>` instance)

**Issue:** CR-03's fix keeps a `GlobalSwapModal` instance mounted past "Done" so a later "Revert
global swap" toast click has a live component to update. That guarantee only holds for as long as
the *hosting* `BrainPicker` instance itself stays mounted. `BrainHeaderBadge`'s `BrainPicker` is
mounted once in `DashboardLayout` and never unmounts across route changes, so for that entry point
the fix is complete. `BrainComposerPill`, however, mounts its own separate `BrainPicker` instance
(with its own independent `globalTarget`/`globalDialogOpen` state and therefore its own
`GlobalSwapModal` instance) scoped entirely to the `/chat` route:

```tsx
// src/pages/Chat.tsx:154-159
return (
  <BrainPicker
    profileId={profileId}
    onPendingChange={setPendingLabel}
    trigger={ /* ... */ }
```

If a user completes an "All profiles" swap from *this* picker, clicks "Done" (which both creates
the "Revert global swap" toast and, per the current code, leaves the modal mounted only within the
still-live Chat page), and then navigates away from `/chat` before clicking the toast's action —
React Router unmounts `Chat`, and with it `BrainComposerPill`'s `BrainPicker` and its
`GlobalSwapModal` instance. Clicking "Revert global swap" in the (still-visible, since sonner
renders outside the route tree) toast invokes `runRevert`'s closure on an unmounted component:

```tsx
// src/components/brains/GlobalSwapModal.tsx:270-297 (runRevert)
async function runRevert() {
  const prior = priorOverrideRef.current;
  setOutcome({ status: "pending" });
  // ...
  onOpenChange(true); // reaches a setState on the now-unmounted BrainPicker's globalDialogOpen
  setIsBusy(true);
  const ack = prior
    ? await dispatch({ type: "swap.set", target: "brain", value: prior, restore: false })
    : await dispatch({ type: "swap.set", target: "brain", restore: true });
  // ...the real swap.set dispatch above still executes — it is a plain async call, not
  // tied to the React tree — but every setOutcome/setPhase call after it is a no-op.
}
```

The `dispatch(...)` call is a real WS round trip unrelated to the component tree, so the live
global override genuinely does get reverted — but no dialog reopens (its host is gone) and no
follow-up toast reports success or failure, since `handleDismiss` (the only place that toasts a
revert's own outcome) never runs. This is a narrower recurrence of the exact symptom the prior
review's CR-03 targeted ("a real, state-mutating command fires with no visible surface"), now
gated on route navigation timing instead of firing on every single "Done" click.

**Confidence:** Medium — the unmount mechanics and the real-dispatch-with-no-feedback consequence
are directly traceable from the code quoted above; likelihood in practice is bounded by how long
the sonner toast stays actionable and how likely a user is to navigate away in that window, and
the primary/most-visible entry point (`BrainHeaderBadge`, dashboard-wide) is unaffected since its
`BrainPicker` never unmounts.

**Fix:** Either (a) lift the `GlobalSwapModal` mount out of `BrainPicker` entirely into an
app-level singleton (mirroring `BrainHeaderBadge`'s always-mounted lifetime) so every entry point
shares one instance that survives route changes, or (b) have the toast's revert action dispatch
through a route-independent store/effect (not a component closure) so the live command's outcome
can still be reported even if the picker that initiated it has since unmounted.

---

## What I dropped and why

(1) A candidate finding that `BrainHeaderBadge`'s/`BrainComposerPill`'s vendor-color dot lookup
(`catalogue?.find((e) => e.id === modelId)`) uses the stub/per-profile D-16 catalogue seam even
when `resolved.source === "global"`, so a live global-axis model id almost never resolves a vendor
color and falls back to neutral gray — dropped because this is display-metadata only (explicitly
documented as such at each call site), was already surfaced and dropped in the prior review cycle
for the same reason, and nothing in this cycle's diff changed that mechanism. (2) Multiple
independent `useGlobalBrainOverride()` instances on `/chat` (one via `Chat.tsx`'s own call, one
inside `BrainComposerPill`, one inside its child `BrainPicker`) each issuing their own
`swap.get_state` on every reconnect — confirmed intentional and explicitly documented/tested this
way (`Chat.test.tsx`'s updated "re-pulls swap.get_state (once per shared-resolver consumer...)"
test); this is a redundant-network-call concern, which is a performance question explicitly out of
v1 review scope, not a correctness defect. (3) The already-known, deliberately-unfixed OBS-8 defect
(`BrainPicker.tsx:362-374` reading `currentModelDisplayName`/pin status from
`activeEngineSnapshots` instead of `profileConfigs.modelPreferences`) — per the task's own
instruction, not re-reported since this cycle's diff does not touch those lines and does not make
it worse. (4) The broad `try { useAstridrWS() } catch { ... }` pattern in
`useResolvedBrain.ts:76-82` swallowing every error, not just the documented "outside provider"
case — dropped because it is the same pattern the prior review's own precedent
(`BrainHeaderBadge.tsx`'s pre-103-09 `useGlobalEngineFallback`) already used and documented as
deliberate, and no evidence in this diff suggests it is masking a real runtime error path.

---

_Reviewed: 2026-07-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
