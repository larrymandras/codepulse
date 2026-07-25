---
phase: 99-skill-launch-dispatch
plan: 05
subsystem: ui
tags: [react, dropdown-menu, radix, tdd]

# Dependency graph
requires:
  - phase: 99-skill-launch-dispatch (plan 04)
    provides: "src/components/skills/RunTargetChooser.tsx (useRunLaunch, RunTargetItems, RunTargetChooser) + SkillLaunchProvider.tsx"
provides:
  - "src/components/skills/SkillLifecycleMenu.tsx — always-available Run submenu (⋯ menu, D-02)"
  - "src/components/skills/QuickDeck.tsx — primary click Run via chooser, copy demoted + non-recording (D-03/D-13)"
affects: [99-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hosting the two controlled Run popovers (RunChatPopover/RunAstridrPopover) as siblings of a DropdownMenu, anchored to the menu's own trigger ref — reused verbatim from RunTargetChooser's own anchorRef pattern so the follow-up popover survives the menu closing."

key-files:
  created: []
  modified:
    - src/components/skills/SkillLifecycleMenu.tsx
    - src/components/skills/SkillLifecycleMenu.test.tsx
    - src/components/skills/QuickDeck.tsx
    - src/components/skills/QuickDeck.test.tsx

key-decisions:
  - "SkillLifecycleMenu's Run popovers (RunChatPopover/RunAstridrPopover) are anchored to the ⋯ trigger button via a new local triggerRef, not left un-anchored — this wasn't spelled out verbatim in the plan's <action> text, but it mirrors RunTargetChooser.tsx's own established anchorRef convention (Plan 04) and avoids the popover positioning at a fallback ref with no DOM node (0,0 / default browser positioning), which would be a visible regression versus the standalone chooser's own anchoring."
  - "QuickDeck's primary chip keeps its existing 'copied'/'copy failed' transient state rendering in its trailing span even though the copy TRIGGER moved to the secondary hover icon — the honest-state feedback (D-05 house rule) is preserved without inventing a second feedback surface; clicking the secondary Copy icon still updates the same isCopied/isFailed state that the primary chip's span reads."
  - "QuickDeck's primary chip's title/aria-label were changed from 'copy'-oriented copy ('{invocation} — click to copy' / 'Copy invocation {invocation}') to Run-oriented copy ('Run {invocation}' / 'Run {skill.name}') since the click action itself changed (D-03) — the UI-SPEC only prescribed the secondary icon's tooltip text verbatim, leaving the primary chip's tooltip to the implementer; this keeps assistive-tech copy honest about what the click actually does."

requirements-completed: [LAUNCH-04]

# Metrics
duration: 25min
completed: 2026-07-23
---

# Phase 99 Plan 05: Run Entry Points — SkillLifecycleMenu Submenu + QuickDeck Primary Click Summary

**Wired the two D-02 Run entry points against the Plan 04 chooser/hook with zero duplicated launch logic: the `SkillLifecycleMenu` (⋯) gains an always-available `Run` submenu above its scope-gated archive/restore/move/delete branch, and `QuickDeck`'s primary tile click now opens the same target chooser while clipboard-copy is demoted to a secondary hover icon that no longer records a launch (D-13).**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 completed
- **Files modified:** 4 (0 created)

## Accomplishments

- **`SkillLifecycleMenu.tsx`** — Added `const run = useRunLaunch(skill)` and a `DropdownMenuSub` (Lucide `Play` + "Run") as the unconditional first item in `DropdownMenuContent`, followed by a `DropdownMenuSeparator`, then the pre-existing dormant/multiScope/active branch byte-unchanged. `DropdownMenuSubContent` hosts `<RunTargetItems lastTarget={run.lastTarget} onPick={run.pick} />` — the exact same presentational list Plan 04 built for the standalone chooser, no reimplementation. The two controlled follow-up popovers (`RunChatPopover`/`RunAstridrPopover`) render as siblings of the `DropdownMenu`, anchored to a new `triggerRef` on the ⋯ button so they position correctly once the menu closes (mirrors `RunTargetChooser`'s own anchorRef convention). Run renders identically across dormant/active/multi-scope/cold-lane fixtures because it sits above the scope-gated branch entirely — it is structurally impossible for it to be gated.
- **`QuickDeck.tsx`** — `QuickDeckProps` no longer declares `onUse` or `onOpenInChat`. The primary chip is now wrapped in `<RunTargetChooser skill={skill}>`, so its click opens the 3-target dropdown (Chat/Forge/Ástríðr) instead of copying — Run is the default gesture (D-03). `handleCopy` no longer calls `onUse` (D-13): it still writes the clipboard and drives the same transient `copied`/`copy failed` state, but that state is now triggered from a new secondary Lucide `Copy` icon in the hover-reveal group, which replaced the retired `MessageSquare` open-in-chat button (superseded by the Chat target inside the chooser). The `Star` favorite toggle is unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Run submenu to SkillLifecycleMenu (D-02)** - `694d59c` (feat)
2. **Task 2: QuickDeck — primary click → Run, copy secondary, stop recording (D-03/D-13)** - `281c107` (feat)

## Files Created/Modified

- `src/components/skills/SkillLifecycleMenu.tsx` - Run `DropdownMenuSub` (always-first item + separator) hosting `RunTargetItems`; two controlled popovers anchored to the ⋯ trigger
- `src/components/skills/SkillLifecycleMenu.test.tsx` - all render sites wrapped in `SkillLaunchProvider` + `MemoryRouter` (new `useRunLaunch` dependency); `ForgeLaunchModal`/`react-router-dom` mocked per Plan 04's convention; new suite asserting Run renders un-disabled across dormant/active/multi-scope fixtures and expands to the three target labels
- `src/components/skills/QuickDeck.tsx` - primary chip wrapped in `RunTargetChooser`; `Copy` icon replaces `MessageSquare` in the hover group; `handleCopy` no longer calls `onUse`
- `src/components/skills/QuickDeck.test.tsx` - rewritten: renders wrapped in `SkillLaunchProvider` + `MemoryRouter`; asserts chip click opens the chooser, secondary Copy writes the clipboard and records nothing, favorite toggle still fires, empty-deck case checked via the "Command deck" section's absence (not `container.firstChild`, since the provider's `ForgeLaunchModal` stub is now always a sibling in the tree)

## Decisions Made

See frontmatter `key-decisions` above (popover anchor-ref addition, retaining the "copied" state display on the primary chip, primary-chip tooltip copy change).

## Deviations from Plan

None (Rule 1-4) — plan executed exactly as written. Two implementation choices were made within the plan's stated discretion (anchoring the hosted popovers to the ⋯ trigger; primary-chip tooltip wording) — both are documented as key-decisions above rather than deviations, since the plan's `<action>` text left both unspecified and the UI-SPEC didn't prescribe them.

## Issues Encountered

- `npx tsc --noEmit` surfaces exactly one error, in `src/pages/Skills.tsx` (still passing the now-removed `onUse`/`onOpenInChat` props to `QuickDeck`). This is the exact and only expected error called out by this plan's own `<verification>` block — `Skills.tsx`'s prop wiring is Plan 06's scope (Wave 5, same milestone), not a regression introduced here.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 06 must update `src/pages/Skills.tsx` to stop passing `onUse`/`onOpenInChat` to `<QuickDeck>` (the one remaining `tsc` error) and mount `<SkillLaunchProvider>` once near the Skills page root so `SkillLifecycleMenu`'s Run submenu and `QuickDeck`'s primary-click chooser can render in production (both already throw a clear `useSkillLaunch must be used within SkillLaunchProvider` error if mounted without it — same fail-fast pattern as `PrivacyContext`/`AmbientContext`).
- `npx vitest run src/components/skills/SkillLifecycleMenu.test.tsx src/components/skills/QuickDeck.test.tsx` — 2 files, 36 tests, all green.
- No blockers for Plan 06.

---
*Phase: 99-skill-launch-dispatch*
*Completed: 2026-07-23*

## Self-Check: PASSED

Verified both modified source files and both modified test files exist on disk with the expected content (`SkillLifecycleMenu.tsx`'s `DropdownMenuSub`/`Play`/`RunChatPopover`/`RunAstridrPopover` imports, `QuickDeck.tsx`'s `RunTargetChooser`/`Copy` imports and absence of `onUse`/`onOpenInChat`/`MessageSquare`), plus this SUMMARY.md. Verified both commits (`694d59c`, `281c107`) present in `git log --oneline`. Re-ran both target test files together: 2 files, 36 tests, all passed.
