---
phase: 103-brain-swap-control-surface
plan: 05
subsystem: ui
tags: [react, cmdk, popover, toggle-group, brain-swap, dual-dispatch, honesty]

# Dependency graph
requires:
  - phase: 103-01
    provides: "src/lib/brainsApi.ts (BrainsAdapter/CatalogueEntry/GatewayModelSetCommand contract, brainsApi seam, BRAINS_STUB_ACTIVE), src/lib/brainsFixtures.ts (STUB_CATALOGUE)"
  - phase: 103-03
    provides: "src/hooks/useActiveEngine.ts (never-undefined per-profile engine map), src/components/brains/BrainPickerRow.tsx (the row primitive)"
  - phase: 103-04
    provides: "src/components/brains/GlobalSwapModal.tsx (the global-swap ritual — confirm/dispatch/result/revert)"
provides:
  - "src/components/brains/BrainPicker.tsx — the phase's single interactive surface: Popover + cmdk Command, grouped Subscription/API/Local, This-profile/All-profiles scope selector, dual-branch dispatch"
affects: [103-06, 103-07, 103-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "cmdk CommandItem used purely as a value-keyed/searchable wrapper (value=entry.id, keywords=[entry.name, entry.vendor]) with NO onSelect prop, so a reused row component's own interactive button stays the single dispatch entry point — avoids the double-dispatch bug that setting onSelect on both the Item and a nested button would cause"
    - "Trigger's base label rendered from a hook-derived value only (useActiveEngine()[profileId]?.model), completely decoupled from the in-flight pending target, so 'never optimistic' (D-15) falls out of the data flow rather than needing an explicit guard"

key-files:
  created:
    - src/components/brains/BrainPicker.tsx
    - src/components/brains/BrainPicker.test.tsx
  modified: []

key-decisions:
  - "cmdk CommandItem carries value={entry.id} + keywords=[entry.name, entry.vendor] but no onSelect handler — BrainPickerRow's own internal button remains the sole click/dispatch entry point. Setting onSelect on both would double-fire (cmdk's click-bubbles-to-Item behavior plus the row's own onClick), which would have failed the 'dispatches exactly one gateway.model.set' test."
  - "Row-click dispatch mode is hardcoded to mode: \"session\" (temporary override), never mode: \"default\" (pinned) — the picker has no UI element for choosing pin-vs-session at click time (D-02's pin affordance is Settings row's job, 103-07). This is Claude's discretion per the plan; documented here so a future plan doesn't rediscover the gap."
  - "profiles: GlobalSwapProfile[] for GlobalSwapModal is computed INTERNALLY from useProfileConfigs() + useActiveEngine() + the already-fetched catalogue (for display-name resolution), not accepted as a prop — keeps BrainPickerProps to just { profileId, entryScope }, matching the self-contained-component precedent BrainControl.tsx sets."
  - "entryScope=\"global\" one-time contextual default (D-08's mixed-badge exception) is tracked via a useRef consumed-flag, not component state — guarantees it can fire at most once across the component's whole mounted lifetime regardless of how many times the prop is re-supplied by a parent that doesn't unmount the picker between opens."
  - "Known, accepted UX nuance (not a functional bug, not test-covered): UI-SPEC §3's 'frictions do not stack' rule says an expensive/unknown-tier row selected in All-profiles scope should skip the inline per-row confirm and go straight into GlobalSwapModal (which adds its own cost-tier warning line). BrainPickerRow's needsConfirm gate is scope-unaware (fixed behavior from 103-03, reused verbatim per plan's explicit non-negotiable constraint), so an expensive-tier target under All-profiles scope gets the inline confirm AND the modal — double friction, not double dispatch. Fixing this would require adding a scope-aware bypass prop to BrainPickerRow.tsx, which is outside this plan's `files_modified` scope (BrainPicker.tsx/.test.tsx only). Flagged for whichever future plan touches BrainPickerRow.tsx next."
  - "BSC-02/BSC-03(partial)/BSC-04(partial) intentionally NOT marked complete in REQUIREMENTS.md — this plan ships the picker in isolation; nothing in the running app renders/opens it yet (103-06's header badge / composer pill and 103-07's Settings row are the callers). Matches this project's established per-plan-vs-full-delivery precedent (every prior 103-0x plan's own deferral)."

patterns-established:
  - "Value-keyed-but-unhandled CommandItem wrapping a self-contained interactive row component — the pattern any future cmdk list that reuses an existing clickable row component (rather than a plain label) should follow to avoid double dispatch."

requirements-completed: []  # BSC-02/BSC-03/BSC-04 intentionally NOT marked complete — see Decisions Made below

# Metrics
duration: ~25min
completed: 2026-07-28
---

# Phase 103 Plan 05: BrainPicker Summary

**Assembled the phase's single interactive surface — a Popover-hosted cmdk picker grouped Subscription/API/Local with an explicit This-profile/All-profiles scope selector whose two branches dispatch to two genuinely different places: the D-16 stub-backed `gateway.model.set` seam for per-profile swaps, and the live, shipped `GlobalSwapModal` (never stubbed) for global swaps.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-28 (session continuation from Plan 04)
- **Completed:** 2026-07-28
- **Tasks:** 2/2 completed
- **Files modified:** 2 created, 0 modified

## Accomplishments

- `src/components/brains/BrainPicker.tsx` — a `Popover` + cmdk `Command` picker following `BrainControl.tsx`'s three checkpoint-round lessons (wide popover, non-truncating wrapping rows, provider/group section headers, catalogue re-fetched on every open) while adding the two capabilities `BrainControl` doesn't have: an explicit `This profile` / `All profiles` scope selector (D-08, `toggle-group.tsx`) that resets on every open except a one-time `entryScope` contextual exception, and a genuinely dual-branch dispatch — `brainsApi.dispatchSwap` for the per-profile axis, `GlobalSwapModal` for the global axis, never conflated.
- Reused `BrainPickerRow` (103-03) verbatim inside each `CommandGroup`, and `GlobalSwapModal` (103-04) verbatim as the "All profiles" branch's confirm/dispatch/result/revert surface — no re-implementation of either.
- Pending treatment (D-15): the trigger's base label is derived purely from `useActiveEngine()`, structurally decoupled from the in-flight dispatch state, so it cannot drift optimistically; a `switching to X…` suffix layers on top and disappears cleanly on error with no error styling on the trigger itself.
- Solved a real cmdk integration hazard while composing a reused interactive row inside a `CommandItem`: giving both the `CommandItem` and the row's own button an `onSelect`/`onClick` would double-fire a single click. Resolved by keying `CommandItem` on `value`/`keywords` only (search + duplicate-guard) and leaving all click dispatch to the row's own button.
- 14/14 new tests, `tsc --noEmit` clean, full suite 2745/2745 passing (baseline 2731 + 14 new, 0 failures, 0 regressions).

## Task Commits

Each task was committed atomically:

1. **Task 1: BrainPicker — popover, groups, scope selector, dual-branch dispatch** - `e86cbc46` (feat)
2. **Task 2: BrainPicker behavior tests** - `b029d58d` (test — also adds `data-testid` attributes to Task 1's trigger label/suffix/chip spans, needed to assert D-15's pending-state and D-16's stub-indicator behavior against exact nodes rather than loose text matches)

_No plan-metadata commit issued separately — this SUMMARY + STATE/ROADMAP updates are committed together per the final_commit step below._

## Files Created/Modified

- `src/components/brains/BrainPicker.tsx` — `BrainPicker`, `BrainPickerProps`, `PickerEntryScope`
- `src/components/brains/BrainPicker.test.tsx` — 14 tests: 2 catalogue-fetch (re-fetch-on-open, error state), 2 scope-reset (D-08 including the entryScope exception), 2 dispatch-branch-separation, 2 pending-never-lies (D-15, in-flight + error-ack), 1 cmdk duplicate-value guard, 1 group-order (D-07), 3 stub-indicator (D-16, banner+chip on/off + global-branch-never-stub-tagged), 1 never-truncates regression guard

## Decisions Made

- **cmdk `CommandItem` carries `value={entry.id}` + `keywords={[entry.name, entry.vendor]}` but no `onSelect` handler** — `BrainPickerRow`'s own internal button stays the sole dispatch entry point. Setting `onSelect` on both the `Item` and the nested button would double-fire (a click bubbles from the row's button to the `Item`'s own click handling), which would have broken the "dispatches exactly one `gateway.model.set`" requirement. Verified via `cmdk`'s own source (`data-value` attribute confirmed present on rendered items) rather than assumed.
- **Row-click dispatch always uses `mode: "session"`**, never `mode: "default"` — the picker itself has no UI affordance for choosing pin-vs-session at click time (D-02's "pin as default" control is Settings row's job, 103-07, per UI-SPEC §9). Documented explicitly so a future plan doesn't rediscover this as a gap.
- **`GlobalSwapProfile[]` is computed internally** (`useProfileConfigs()` × `useActiveEngine()` × the already-fetched catalogue for display-name resolution), not accepted as a prop — keeps `BrainPickerProps` to just `{ profileId, entryScope }`, matching the self-contained-component precedent `BrainControl.tsx` already sets in this codebase.
- **`entryScope="global"`'s one-time contextual default is tracked via a `useRef` consumed-flag**, not component state — guarantees the exception fires at most once across the component's whole mounted lifetime, satisfying D-08's "never a persisted preference" rule even if a parent keeps the prop supplied across multiple opens without unmounting.
- **Known, accepted UX nuance, not fixed in this plan:** UI-SPEC §3's "frictions do not stack" rule says an expensive/unknown-tier row selected in `All profiles` scope should skip `BrainPickerRow`'s own inline confirm step and go straight into `GlobalSwapModal` (which already adds its own cost-tier warning line). `BrainPickerRow`'s `needsConfirm` gate is scope-unaware by design (103-03, reused verbatim per this plan's explicit "do not re-implement its markup" constraint), so today an expensive-tier target picked under `All profiles` scope gets the inline confirm step AND the modal — double friction, never double dispatch (functionally correct, just one extra click). Fixing this cleanly requires a scope-aware bypass prop on `BrainPickerRow.tsx`, which sits outside this plan's `files_modified` scope. Flagged here for whichever future plan next touches `BrainPickerRow.tsx`.
- **BSC-02 / the scope and pending halves of BSC-03 and BSC-04 intentionally NOT marked complete in REQUIREMENTS.md** — this plan ships the picker in isolation; nothing in the running app renders or opens it yet (103-06's header badge / composer pill and 103-07's Settings row are the callers). Matches every prior Phase-103 plan's own per-plan-vs-full-delivery deferral precedent.
- **`STATE.md`/`ROADMAP.md` updated by hand, not via `gsd-sdk state.*`/`roadmap.update-plan-progress`** — per this project's established anti-clobber workaround, consistent with every prior Phase-103 plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `screen.getAllByText(/^(Subscription|API|Local)$/)` matched more than the group headers**
- **Found during:** Task 2, first test run of the group-order test
- **Issue:** `STUB_CATALOGUE` renders multiple rows with an "API" billing chip (via `BrainPickerRow`'s `Badge`), so a plain text-content regex match on `/^(Subscription|API|Local)$/` collected those chips alongside the three real cmdk group headings, producing `["Subscription", "API", "API", "API", "API", "Local"]` instead of the expected three-element array.
- **Fix:** Re-scoped the query to `document.querySelectorAll("[cmdk-group-heading]")` — the exact DOM attribute cmdk's own `Group` component renders the heading text into (confirmed by reading `cmdk`'s bundled source directly rather than assuming), which cannot collide with an unrelated row-level badge.
- **Files modified:** `src/components/brains/BrainPicker.test.tsx`
- **Verification:** Test passes; full 14/14 suite green; `tsc --noEmit` clean.
- **Committed in:** `b029d58d` (Task 2's commit — caught and fixed before committing).

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Test-only fix; no production code path affected. No scope creep.

## Issues Encountered

None beyond the deviation above. Both tasks' automated verification (`tsc --noEmit`, `npx vitest run`) passed after the one fix; no auth gates, no checkpoints in this plan.

**Shared-checkout note:** per the session's explicit warning, another Claude session was concurrently active on unrelated Phase-187 KnowledgeGraph work in this same checkout at the start of this plan. Verified before and after every commit (`git branch --show-current` = `master`, `git diff --cached --name-only` and `git show --stat HEAD` both confirmed to contain only this plan's own two files each time) — no cross-contamination occurred, and `src/pages/KnowledgeGraph.tsx`/`.test.tsx` were never touched. The full-suite run at the end of this plan shows 0 failures (2745/2745), confirming the KnowledgeGraph test failures flagged as pre-existing/unrelated in the 103-03-SUMMARY have since been resolved by that other session's own commit (`24b9c1ad`, already landed before this plan started).

## Deferred / Out of Scope (unchanged from plan)

- Wiring `BrainPicker` into an actual page/surface (composer pill on `Chat.tsx`, header badge in `DashboardLayout.tsx`, Settings → Agents row) — 103-06 and 103-07's job.
- The "frictions do not stack" UX nuance for expensive/unknown-tier targets under `All profiles` scope (documented above) — needs a scope-aware `BrainPickerRow.tsx` change, outside this plan's file scope.
- Live per-profile BSC-05 verification — still gated on Ástríðr Phase 184.1, tracked in `astridr-repo`, not this phase.
- Live global-axis BSC-05 verification against the running stack — deferred to 103-08 (Wave 5, blocking checkpoint), per `103-CONTEXT.md`'s `<blocker_reframing>`.

## Next Steps

Wave 4 (103-06, 103-07) mounts `<BrainPicker profileId={...} />` (and the mixed-badge `entryScope="global"` entry point) into the composer pill, the header badge, and the Settings → Agents row, replacing `Settings.tsx:663`'s stale `p.model` read in place (D-06). Wave 5 (103-08) closes the live global-axis BSC-05 gate and adds the Playwright stub round trip.

## Self-Check: PASSED

- FOUND: `src/components/brains/BrainPicker.tsx`
- FOUND: `src/components/brains/BrainPicker.test.tsx`
- FOUND commit `e86cbc46` in `git log --oneline --all`
- FOUND commit `b029d58d` in `git log --oneline --all`
- Full suite: 231 test files passed / 17 skipped (248), 2745 tests passed / 193 todo (2938), 0 failures — exact match to the 2731 baseline + this plan's 14 new tests
