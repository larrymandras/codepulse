---
phase: 99-skill-launch-dispatch
plan: 06
subsystem: ui
tags: [react, context, honest-metrics, tdd-adjacent]

# Dependency graph
requires:
  - phase: 99-skill-launch-dispatch (plan 04)
    provides: "src/components/skills/SkillLaunchProvider.tsx (useSkillLaunch/SkillLaunchProvider) + RunTargetChooser.tsx (useRunLaunch/RunTargetItems)"
  - phase: 99-skill-launch-dispatch (plan 05)
    provides: "SkillLifecycleMenu.tsx Run submenu + QuickDeck.tsx primary-click chooser (both already required SkillLaunchProvider to render)"
provides:
  - "src/pages/Skills.tsx mounts <SkillLaunchProvider> around QuickDeck + all row-bearing views + SkillCommandPalette — every Run trigger on the Skills page now resolves useSkillLaunch() at runtime"
  - "SkillRow/SkillCommandPalette/ColdStorageView/AllSkillsOverview/SkillsInCategory: onRecordUse + onOpenInChat fully retired — copy never records a launch anywhere (D-13), and the confirmed-no-op /chat?skill= open-in-chat affordance is gone everywhere (Pitfall 1/2)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Page-scoped SkillLaunchProvider mounted once around the whole interactive skills subtree (not at main.tsx) — matches Plan 04's own design intent (a page-level context, not an app-level one) since Run is Skills-page-only for v1"

key-files:
  created: []
  modified:
    - src/pages/Skills.tsx
    - src/pages/__tests__/Skills.test.tsx
    - src/components/skills/SkillRow.tsx
    - src/components/skills/SkillRow.test.tsx
    - src/components/skills/SkillCommandPalette.tsx
    - src/components/skills/SkillCommandPalette.test.tsx
    - src/components/skills/ColdStorageView.tsx
    - src/components/skills/ColdStorageView.test.tsx
    - src/components/skills/AllSkillsOverview.tsx
    - src/components/skills/AllSkillsOverview.test.tsx
    - src/components/skills/SkillsInCategory.tsx
    - src/components/skills/__tests__/SkillsInCategory.test.tsx

key-decisions:
  - "SkillLaunchProvider wraps the vaultView/QuickDeck/row-views/SkillCommandPalette subtree as ONE instance inside Skills.tsx's return (not at main.tsx app-root) — every Run trigger on the page shares one lastTarget + one ForgeLaunchModal, matching D-11's 'one page-level modal' intent without over-scoping the context beyond the Skills page that actually uses it."
  - "SkillCommandPalette.test.tsx / SkillRow.test.tsx / ColdStorageView.test.tsx / AllSkillsOverview.test.tsx / __tests__/SkillsInCategory.test.tsx all needed SkillLaunchProvider + MemoryRouter wrapping (not just prop removal) — SkillRow unconditionally renders SkillLifecycleMenu (Phase 98), which since Plan 05 unconditionally calls useRunLaunch()->useSkillLaunch() for its always-on Run submenu. Every render site of SkillRow (directly or via a container) now needs the provider regardless of whether a given test exercises Run — mirrors SkillLifecycleMenu.test.tsx's own established convention (Plan 05) and ForgeLaunchModal is stubbed the same way to avoid pulling in its own forge queries."
  - "src/pages/__tests__/Skills.test.tsx was NOT in this plan's files_modified list but broke as a direct, in-scope consequence of Task 3 (it asserted the retired handleOpenInChat/handleRecordUse wiring) — fixed under Rule 1/3 (blocking issue caused by this plan's own change) rather than deferred, since the plan's own verification requires the full suite green."

requirements-completed: [LAUNCH-04]

# Metrics
duration: 45min
completed: 2026-07-23
---

# Phase 99 Plan 06: Final Integration — SkillLaunchProvider Mount + Honest-Recording Cleanup Summary

**Mounted `SkillLaunchProvider` around the Skills page's interactive subtree so every Run entry point (SkillLifecycleMenu's ⋯ submenu, QuickDeck's primary click) actually works in production, and retired the two dead paths — clipboard-copy launch recording and the passive `/chat?skill=` open-in-chat no-op — across SkillRow, SkillCommandPalette, ColdStorageView, AllSkillsOverview, and SkillsInCategory. `useCount` now reflects real runs only.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3 completed
- **Files modified:** 14 (0 created)

## Accomplishments

- **SkillRow.tsx / SkillCommandPalette.tsx** — Both components' `onRecordUse`/`onOpenInChat` props, the copy-triggered `recordSkillLaunch` calls, and the broken open-in-chat affordances (SkillRow's inline `MessageSquare` button; the palette's Ctrl+Enter key binding + footer hint) are gone. SkillRow's copy button still copies and shows Copied/Failed/Dormant feedback with zero recording — Run is reachable exclusively via the already-rendered `SkillLifecycleMenu`. The palette keeps its Enter-to-copy path verbatim (D-02) and gains no Run item.
- **ColdStorageView.tsx / AllSkillsOverview.tsx / SkillsInCategory.tsx** — All three were pure forwarders of `onRecordUse`/`onOpenInChat` to `SkillRow`; removed from each interface, signature, and JSX prop pass with zero other behavior change.
- **Skills.tsx** — Deleted `handleOpenInChat`/`handleRecordUse` and the now-dangling `recordLaunch`/`useMutation(api.registry.recordSkillLaunch)` binding and the now-unused `useNavigate` import (grep-verified no remaining references before removing either). Removed every `onUse=`/`onRecordUse=`/`onOpenInChat=` prop pass to `QuickDeck`, `ColdStorageView`, `AllSkillsOverview`, `SkillsInCategory`, and `SkillCommandPalette`. Wrapped the `vaultView`-conditional block through `SkillCommandPalette` in one `<SkillLaunchProvider>` so every Run trigger on the page (the ⋯ menu's Run submenu and QuickDeck's primary-click chooser) resolves `useSkillLaunch()` at runtime and shares one `lastTarget` + one page-level `ForgeLaunchModal`. This resolved the one `tsc` error Plan 05 predicted and deferred (Skills.tsx still passing `onUse`/`onOpenInChat` to `QuickDeck`).

## Task Commits

Each task was committed atomically:

1. **Task 1: SkillRow + SkillCommandPalette — remove copy-recording + retire open-in-chat** - `ec397b8` (feat)
2. **Task 2: Container pass-throughs — drop onRecordUse/onOpenInChat** - `5b2bf37` (feat)
3. **Task 3: Skills.tsx — mount SkillLaunchProvider + retire dead handlers/prop passes** - `e71feaf` (feat)

## Files Created/Modified

- `src/components/skills/SkillRow.tsx` - dropped `onRecordUse`/`onOpenInChat` props, copy-recording call, inline chat button + unused `MessageSquare` import
- `src/components/skills/SkillRow.test.tsx` - renders wrapped in `SkillLaunchProvider` + `MemoryRouter` (SkillLifecycleMenu's Run submenu needs the context even when unexercised); `ForgeLaunchModal` stubbed; assertions updated (copy still copies, no chat button, no `onRecordUse`/`onOpenInChat` props exist to call)
- `src/components/skills/SkillCommandPalette.tsx` - dropped `onRecordUse`/`onOpenInChat` props, copy-recording call, `handleOpenChat`/Ctrl+Enter key binding, updated footer hint/description copy
- `src/components/skills/SkillCommandPalette.test.tsx` - dropped removed mock props; new test asserting Ctrl+Enter no longer opens chat and no Run item exists; existing tests updated to drop `onRecordUse`/`onOpenInChat` assertions
- `src/components/skills/ColdStorageView.tsx` / `AllSkillsOverview.tsx` / `SkillsInCategory.tsx` - dropped the pure-forwarder `onRecordUse`/`onOpenInChat` props and their `SkillRow` prop passes
- `src/components/skills/ColdStorageView.test.tsx` / `AllSkillsOverview.test.tsx` / `__tests__/SkillsInCategory.test.tsx` - renders wrapped in `SkillLaunchProvider` + `MemoryRouter`, `ForgeLaunchModal` stubbed, removed-prop mocks/assertions dropped
- `src/pages/Skills.tsx` - deleted `handleOpenInChat`/`handleRecordUse`/`recordLaunch`/`useNavigate`; mounted `<SkillLaunchProvider>` around the interactive subtree; removed all retired prop passes
- `src/pages/__tests__/Skills.test.tsx` - stubbed `ForgeLaunchModal`; replaced the retired "navigates to chat via Open in Chat" test with a negative assertion (no inline chat button; ⋯ menu present); updated the copy-is-primary test to assert no launch is recorded

## Decisions Made

See frontmatter `key-decisions` above (page-scoped provider placement, the provider/router wrapping needed across every SkillRow-rendering test suite, and fixing the out-of-scope-but-directly-broken `Skills.test.tsx`).

## Deviations from Plan

**1. [Rule 1/3 - Blocking, directly caused by this plan] Fixed `src/pages/__tests__/Skills.test.tsx`, not listed in `files_modified`**
- **Found during:** Task 3 (`npx vitest run` after mounting `SkillLaunchProvider` and removing the retired handlers)
- **Issue:** This pre-existing suite asserted the exact behavior this plan retires — a "navigates to chat via the row's Open in Chat action" test expecting `mockNavigate`/`mockRecordLaunch` calls from the now-deleted `handleOpenInChat`, and a "copy is the primary action" test expecting `mockRecordLaunch` to fire on copy (D-13 explicitly retires this).
- **Fix:** Added a `ForgeLaunchModal` stub (mirrors `SkillLifecycleMenu.test.tsx`'s convention) so `SkillLaunchProvider` mounts cleanly; replaced the retired-behavior test with a negative assertion (no inline chat button on the row; the ⋯ menu is the only actions surface); updated the copy test to assert `mockRecordLaunch` is NOT called.
- **Files modified:** `src/pages/__tests__/Skills.test.tsx`
- **Verification:** `npx vitest run src/pages/__tests__/Skills.test.tsx` — 21/21 green; full suite re-run after — 211 files, 2438 tests, zero regressions.
- **Committed in:** `e71feaf` (Task 3 commit, same commit as the Skills.tsx source change that caused it)

---

**Total deviations:** 1 auto-fixed (1 blocking, directly in-scope of Task 3's own change)
**Impact on plan:** Necessary to satisfy the plan's own verification gate (`npx vitest run` full suite green). No scope creep — the fix only touches assertions of behavior this plan explicitly retires.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 99 (Skill Launch / Dispatch) is now complete end-to-end for codepulse v1: Chat auto-send (LAUNCH-01), Forge agent-run mapping (LAUNCH-02), Ástríðr persona dispatch scoped to existing channel support (LAUNCH-03), and the Run surface/target picker with honest usage recording (LAUNCH-04) all ship together.
- Manual/live UAT is still deferred per this plan's own `<verification>` block: from the live Skills page, confirm Run via the ⋯ menu and via a QuickDeck tile each open the chooser, Chat/Ástríðr stream a real turn, Forge opens the prefilled modal, and copying a chip does not bump `useCount`. No blocking code path prevents this — it is a manual confirmation step, not a code gap.
- `npx tsc --noEmit` clean repo-wide; `npx vitest run` — 211 files, 2438 tests, 193 todo (pre-existing, unrelated to this phase), zero regressions.
- No blockers for subsequent phases. No new astridr endpoint work was pulled in (D-09 held: Phase 99 shipped codepulse-only).

---
*Phase: 99-skill-launch-dispatch*
*Completed: 2026-07-23*

## Self-Check: PASSED

Verified `99-06-SUMMARY.md`, `src/pages/Skills.tsx`, `src/components/skills/SkillRow.tsx`, and `src/components/skills/SkillCommandPalette.tsx` exist on disk. Verified all three task commits (`ec397b8`, `5b2bf37`, `e71feaf`) present in `git log --oneline --all`.
