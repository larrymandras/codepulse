---
phase: 103-brain-swap-control-surface
plan: 18
subsystem: ui
tags: [react, context, brain-swap, ownership-hoist, gap-closure, code-review]

# Dependency graph
requires:
  - phase: 103-brain-swap-control-surface
    provides: "103-12 (GlobalSwapModal's honest ack/readback reporting + revert-survives-Done mount lifecycle, CR-03), 103-14 (revert restores the prior override), 103-16 (reset keyed to a per-selection nonce, CR-01), 103-17 (config-derived hasConfiguredDefault/configuredDefault signal)"
provides:
  - "GlobalSwapContext.tsx: GlobalSwapProvider/useGlobalSwap — app-level ownership of the single GlobalSwapModal instance, mounted once in DashboardLayout above the router outlet"
  - "BrainPicker.tsx requests a global swap through useGlobalSwap().openGlobalSwap() instead of mounting/owning its own GlobalSwapModal — both hosts (BrainHeaderBadge, the Chat composer pill) drive the same surviving instance"
  - "Regression coverage proving CR-03/103-16/103-14 all survive the hoist, plus new coverage for WR-01 itself (mutation-checked live) and 'exactly one modal app-wide with two real hosts mounted'"
affects: [103-verification, 103-final-live-reverification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "App-level context hoist for a route-surviving singleton UI surface: GlobalSwapProvider mounted once in DashboardLayout (above <Outlet/>, alongside BrainHeaderBadge in the header cluster) instead of at src/main.tsx's true root — it only needs to outlive route changes, not the whole app lifetime, mirroring PrivacyProvider/AmbientProvider's shape one level higher"
    - "Caller-supplied snapshot through a request function: openGlobalSwap(target, profiles) takes the requesting BrainPicker's own globalSwapProfiles snapshot as an argument rather than the context deriving it independently, because the global axis' profile rows depend on that specific picker's fetched catalogue and telemetry/config reads — there is no shared, caller-independent source for them"

key-files:
  created:
    - src/contexts/GlobalSwapContext.tsx
    - src/contexts/GlobalSwapContext.test.tsx
  modified:
    - src/components/brains/BrainPicker.tsx
    - src/components/brains/BrainPicker.test.tsx
    - src/layouts/DashboardLayout.tsx
    - src/pages/__tests__/Chat.test.tsx

key-decisions:
  - "Task split follows the actual code seam, not a literal per-task file diff (same precedent as 103-12/103-14/103-16): Task 1's own acceptance criteria required BOTH the mount-survives-unmount test AND the two-real-hosts-one-modal test to exist and pass (plus a live mutation check against the former), so GlobalSwapContext.test.tsx (Task 1's own provider-level suite) and one new BrainPicker.test.tsx describe block (two real hosts, one modal) landed in Task 1's commit. Task 2's commit added the WR-01 reproduction itself and the 103-14-through-hoisting regression test."
  - "src/components/brains/BrainPicker.test.tsx and src/pages/__tests__/Chat.test.tsx both needed a mechanical GlobalSwapProvider wrapper added to every render call (Rule 3, blocking) — both render the REAL BrainPicker, which now throws outside a GlobalSwapProvider ancestor. Neither file is in the plan's frontmatter files_modified list; both are pre-existing tests whose continued green status is a hard requirement of this plan's own acceptance criteria ('full suite passes with no reduction from the post-103-17 baseline'). This mechanical fix landed in Task 1's commit."
  - "CR-03 and 103-16/CR-01 are NOT re-tested with new assertions — the pre-existing 'BrainPicker + real GlobalSwapModal' describe blocks (from 103-16/103-17) continued to pass, UNCHANGED, once BrainPicker.test.tsx's renders were wrapped in a real GlobalSwapProvider. Their continued green status under the new hoisted architecture IS the regression proof; duplicating them would only prove the same thing twice."
  - "The WR-01 test's Harness component toggles GlobalSwapProvider's presence around the BrainPicker it wraps (rerender to remove only the picker, keeping the provider mounted) to simulate a route change — this is the same technique React Router itself uses (a parent layout element is reconciled in place across a child-route navigation, never remounted), not a synthetic test-only shortcut."
  - "The mutation checks for the two 'survives unmount' tests (GlobalSwapContext.test.tsx's own test, and BrainPicker.test.tsx's WR-01 test) were performed by temporarily nesting GlobalSwapProvider INSIDE the toggled/unmounted subtree instead of outside it. This reproduces the exact pre-fix architecture (the modal owned by the page-scoped host, unmounting with it) without needing a larger, harder-to-cleanly-revert mutation of BrainPicker.tsx itself — both mutations were confirmed to fail the target test, then restored via `cp` from a scratchpad backup (never `git checkout --`, per the shared-checkout protocol)."

requirements-completed: [BSC-04, BSC-05]

# Metrics
duration: ~55min
completed: 2026-07-29
---

# Phase 103 Plan 18: Hoist GlobalSwapModal Above the Router Outlet Summary

**A new `GlobalSwapContext` (`GlobalSwapProvider`/`useGlobalSwap`) owns the single, app-wide `GlobalSwapModal` instance — mounted once in `DashboardLayout` above `<Outlet/>` — so navigating away from the page-scoped Chat composer pill before clicking "Revert global swap" no longer fires a real `swap.set` into an unmounted component with zero UI feedback (WR-01).**

## Performance

- **Duration:** ~55 min
- **Tasks:** 2
- **Files modified:** 6 (2 new, 4 modified — 2 of the 4 modified files, `BrainPicker.test.tsx` and `Chat.test.tsx`, are mechanical compile/compat fixes outside the plan's own `files_modified` list; see Deviations)

## Accomplishments

- Closed WR-01 (2026-07-29 code review, confirmed by `103-VERIFICATION.md`): starting a global swap from the Chat composer pill, clicking Done, navigating away from `/chat`, then clicking "Revert global swap" in the still-visible sonner toast now finds a live, visible `GlobalSwapModal` instance to reopen into — never a real, process-wide `swap.set` fired into a dead component with no UI feedback.
- The fix is ownership, not another guard: `GlobalSwapModal`'s mount lifetime (target, profiles snapshot, visibility, and 103-16's per-selection nonce) is now owned by a `GlobalSwapProvider` mounted once in `DashboardLayout` above `<Outlet/>`, instead of by whichever `BrainPicker` host happened to open it. Both hosts — `BrainHeaderBadge` (always mounted, survives navigation) and the Chat composer pill (page-scoped, unmounts on route change) — call the same `openGlobalSwap(target, profiles)` function through `useGlobalSwap()`.
- `BrainPicker.tsx` no longer renders a `GlobalSwapModal` at all — its global-scope `handleSelect` branch is now a single call into the hoisted context. `globalTarget`/`globalDialogOpen`/`globalSelectionNonce` state is deleted from the component entirely; those three concerns now live once, at the provider level.
- Verified all three prior invariants stay closed under the new architecture: 103-12/CR-03 (mount survives Done — trivially true a fortiori, since the instance now outlives every consumer), 103-16/CR-01 (reset keyed to `selectionNonce`, which `openGlobalSwap` bumps unconditionally — a revert's own `onOpenChange(true)` never calls `openGlobalSwap`, so it can never bump it), and 103-14 (revert restores the prior override — untouched, lives entirely inside `GlobalSwapModal.tsx`, which this plan does not modify).
- 103-CONTRACT.md §8 holds structurally: exactly one `<GlobalSwapModal>` JSX element exists in the whole codebase (inside `GlobalSwapProvider`), so "exactly one live command per swap, no second dispatch path" cannot be violated by construction — proven directly with two real `BrainPicker` hosts mounted under one provider.

## Task Commits

Each task was committed atomically:

1. **Task 1: Hoist global-swap ownership above the router outlet (103-18-T1)** — `7b67be6d` (fix)
2. **Task 2: Regression-test the navigate-away revert and the three preserved invariants (103-18-T2)** — `dc84c022` (test)

_Note: Task 1's commit necessarily includes GlobalSwapContext.test.tsx (its own provider-level test suite) and one new BrainPicker.test.tsx describe block (two real hosts, one modal) — see Decisions above for why the plan's literal Task 1 (`<files>`: source only) vs. Task 2 (`<files>`: both test files) split doesn't match the actual dependency between "the acceptance criteria a task must satisfy" and "the test file that satisfies them."_

## Files Created/Modified

- `src/contexts/GlobalSwapContext.tsx` — New. `GlobalSwapProvider` (target/profiles/open/selectionNonce state, renders one `GlobalSwapModal`) and `useGlobalSwap()` (throws outside the provider).
- `src/contexts/GlobalSwapContext.test.tsx` — New. Exactly-one-instance-with-two-consumers, mount survives a consumer unmounting (mutation-checked live), selectionNonce bumps per request, outside-provider throw guard.
- `src/components/brains/BrainPicker.tsx` — `globalTarget`/`globalDialogOpen`/`globalSelectionNonce` state deleted; `handleSelect`'s global branch calls `useGlobalSwap().openGlobalSwap(entry, globalSwapProfiles)`; no longer imports or renders `GlobalSwapModal`; top-of-file docstring updated to point at the new ownership module.
- `src/components/brains/BrainPicker.test.tsx` — Every render call wrapped in a real `GlobalSwapProvider` (mechanical, Rule 3); new describe blocks: "exactly one modal with two real hosts" (Task 1), "WR-01: revert survives the requesting picker unmounting" and "103-14 stays closed through the hoisted architecture" (Task 2).
- `src/layouts/DashboardLayout.tsx` — Wraps the entire returned tree (including `<Outlet/>` and `BrainHeaderBadge`) in `<GlobalSwapProvider>` — the single app-level mount point.
- `src/pages/__tests__/Chat.test.tsx` — `renderChat()` wrapped in `<GlobalSwapProvider>` (mechanical, Rule 3) — this suite renders the real `Chat` page, which renders the real `BrainPicker` via `BrainComposerPill`.

## Decisions Made

See `key-decisions` in frontmatter above for full rationale on each. Summary:
- Task split follows the actual dependency between acceptance criteria and test coverage, not a literal per-task file diff (established precedent from 103-12/103-14/103-16).
- Two pre-existing test files outside the plan's `files_modified` list (`BrainPicker.test.tsx`'s render calls, `Chat.test.tsx`'s `renderChat()`) needed a mechanical `GlobalSwapProvider` wrap — both render the real, now-context-dependent `BrainPicker` — to keep the full suite green, which is itself one of this plan's explicit acceptance criteria.
- CR-03 and 103-16/CR-01 rely on pre-existing tests continuing to pass unchanged, rather than new duplicate assertions, since that continued-green status is the direct regression proof.
- Both "survives unmount" mutation checks used the same technique: temporarily nest `GlobalSwapProvider` inside the component being unmounted (reproducing the exact pre-fix per-host-ownership shape) rather than a larger, harder-to-revert mutation of `BrainPicker.tsx`'s own source.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Mechanical `GlobalSwapProvider` wrap added to two pre-existing test files outside the plan's `files_modified` list**
- **Found during:** Task 1, immediately after wrapping `BrainPicker.tsx`'s global-scope dispatch behind `useGlobalSwap()`
- **Issue:** `BrainPicker` now throws `"useGlobalSwap must be used within a GlobalSwapProvider"` when rendered outside a `GlobalSwapProvider` ancestor. Two pre-existing test files render the REAL `BrainPicker` without mocking it: `src/components/brains/BrainPicker.test.tsx` (the file under test) and `src/pages/__tests__/Chat.test.tsx` (renders the real `Chat` page, which renders `BrainPicker` via `BrainComposerPill`). Both suites failed to compile/render without this fix — 7 tests in `Chat.test.tsx` failed with the exact provider-boundary error before the fix.
- **Fix:** Wrapped every `<BrainPicker>`/`<Chat>` render call in each file with `<GlobalSwapProvider>` (unmocked — it's a real, load-bearing ancestor, not a test double). No assertions changed in either file.
- **Files modified:** `src/components/brains/BrainPicker.test.tsx`, `src/pages/__tests__/Chat.test.tsx`
- **Verification:** Full suite re-run after the fix: 2815/2815 passing (excluding `useAstridrVoice.test.ts`), 0 failures — the exact 7-test regression in `Chat.test.tsx` is gone.
- **Committed in:** `7b67be6d` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3, blocking — mechanical provider-wrap, no behavior or assertion change)
**Impact on plan:** Necessary consequence of hoisting `useGlobalSwap()` into `BrainPicker`'s unconditional render path. No scope creep — both files are pre-existing tests of the real component this plan modifies, and keeping them green is this plan's own explicit `<verification>` requirement.

## Issues Encountered

None beyond the documented deviation above.

## Mutation Checks (both required, both performed live)

1. **`GlobalSwapContext.test.tsx`'s "mount survives a consumer unmounting" test:** Temporarily nested `<GlobalSwapProvider>` INSIDE the toggled/unmounted subtree in the test itself (reproducing the pre-fix "modal owned by the page-scoped host" shape — the provider, and therefore the modal, unmounts along with the requesting component). Re-ran `GlobalSwapContext.test.tsx` — the target test failed as expected (`Unable to find an element by: [data-testid="global-swap-modal-marker"]`, 1 failed / 3 passed), confirming the test is load-bearing. Restored from a scratchpad backup (`cp`, not `git checkout --`), re-verified `git diff` empty and 4/4 passing.
2. **`BrainPicker.test.tsx`'s WR-01 test:** Same technique applied to the WR-01 test's own `Harness` component — nested `<GlobalSwapProvider>` inside the `showPicker` conditional instead of wrapping it. Re-ran `BrainPicker.test.tsx` filtered to `-t "WR-01"` — the target test failed as expected (`Unable to find the text: "Global override cleared..."`, 1 failed / 2 passed in that filtered run), confirming the test would catch a regression back to per-picker ownership. Restored from a scratchpad backup, re-verified the restored file is byte-identical to the pre-mutation, fully-tested version (`diff` against a saved copy — identical) and the full file re-ran 41/41 passing.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `npx tsc --noEmit` clean. `npm run build` clean (pre-existing >500kB chunk-size warning only, unrelated). Full suite (excluding `src/hooks/useAstridrVoice.test.ts`, the concurrent phase-188 session's intentional RED tests): **2815/2815 passing** (7 new tests over the 2808 baseline: 4 in `GlobalSwapContext.test.tsx` + 3 in `BrainPicker.test.tsx`), 0 failures, 193 todo (unrelated, pre-existing).
- Both required mutation checks performed live and restored — see above.
- Per this plan's own `<verification>` section: live re-verification of the WR-01 fix against the running Ástríðr stack is the orchestrator's job after this plan lands, not claimed here. A green unit suite is evidence the fix is architecturally sound, not itself a live-checkpoint pass.
- `BSC-04`/`BSC-05` not re-marked in `REQUIREMENTS.md` this plan — same established gap-closure-cycle pattern as every prior plan in this cycle (09 through 17): the overall requirement re-mark happens after a live re-verification of the full cycle, not per-plan.
- No blockers for subsequent plans in this phase.

---
*Phase: 103-brain-swap-control-surface*
*Completed: 2026-07-29*

## Self-Check: PASSED

- FOUND: src/contexts/GlobalSwapContext.tsx
- FOUND: src/contexts/GlobalSwapContext.test.tsx
- FOUND: src/components/brains/BrainPicker.tsx
- FOUND: src/components/brains/BrainPicker.test.tsx
- FOUND: src/layouts/DashboardLayout.tsx
- FOUND: src/pages/__tests__/Chat.test.tsx
- FOUND: .planning/phases/103-brain-swap-control-surface/103-18-SUMMARY.md
- FOUND commit: 7b67be6d (Task 1)
- FOUND commit: dc84c022 (Task 2)
