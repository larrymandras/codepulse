---
phase: 99-skill-launch-dispatch
plan: 04
subsystem: ui
tags: [react, context, radix-dropdown-menu, convex, tdd]

# Dependency graph
requires:
  - phase: 99-skill-launch-dispatch (plan 01)
    provides: "src/lib/skillRun.ts (RunTarget/AutoSendHandoff/loadStoredRunTarget/storeRunTarget) + src/lib/profiles.ts (ProfileId) + ForgeLaunchModal.initialPrompt"
  - phase: 99-skill-launch-dispatch (plan 03)
    provides: "RunChatPopover.tsx / RunAstridrPopover.tsx — controlled onSubmit(text[, profile]) capture popovers"
provides:
  - "src/components/skills/SkillLaunchProvider.tsx — SkillLaunchContext (lastTarget/setLastTarget/launchForge) + the one page-level ForgeLaunchModal + Forge-path recordSkillLaunch (LAUNCH-02, D-10/D-11/D-12)"
  - "src/components/skills/RunTargetChooser.tsx — useRunLaunch(skill) hook, RunTargetItems presentational list, standalone RunTargetChooser dropdown (LAUNCH-04, D-01)"
affects: [99-05, 99-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Page-level context hosting exactly one instance of a heavy modal (mirrors PrivacyContext/AmbientContext) — every Run trigger on the page shares one ForgeLaunchModal instead of mounting its own"
    - "Radix DropdownMenuTrigger asChild + cloneElement(children, {ref}) to anchor a controlled Popover to the same DOM node as a dropdown trigger — Slot composes the cloned ref with its own"

key-files:
  created:
    - src/components/skills/SkillLaunchProvider.tsx
    - src/components/skills/SkillLaunchProvider.test.tsx
    - src/components/skills/RunTargetChooser.tsx
    - src/components/skills/RunTargetChooser.test.tsx
  modified: []

key-decisions:
  - "recordSkillLaunch fires from the modal's onLaunched callback, which ForgeLaunchModal invokes with its OPTIMISTIC pending row BEFORE awaiting enqueueLaunch (existing B2 pattern from Phase 80) — not after a server-confirmed success. This matches the plan's own Task 1 test spec verbatim (Test 3/4) and its D-12 disposition (record on the modal's onLaunched, never onLaunchFailed/onClose); a true error still surfaces honestly via the modal's own failed-row reconciliation, it just doesn't un-record the launch."
  - "DeckSkillLike (RunTargetChooser.tsx) and ForgeLaunchableSkill (SkillLaunchProvider.tsx) are two separately-named but structurally identical `SkillLike & { name: string; displayName: string }` aliases, kept distinct per-file rather than hoisted to a third shared type — each file already imports directly from the other where needed (RunTargetChooser -> useSkillLaunch), and the plan's own <interfaces> block names them as separate exports on separate files."
  - "The Check icon on the last-pick DropdownMenuItem is rendered ALONGSIDE the target's own icon (not replacing it) so the row keeps its distinguishing glyph (MessageSquare/Bot/Sparkles) while still adding the UI-SPEC's required checkmark + text-primary tint; both the Check and the target icon get an explicit text-primary class because dropdown-menu.tsx's own CSS forces text-muted-foreground on any child svg lacking a text- class, which would otherwise override the parent's text-primary color."

requirements-completed: [LAUNCH-02, LAUNCH-04]

# Metrics
duration: 35min
completed: 2026-07-23
---

# Phase 99 Plan 04: Launch Orchestration — SkillLaunchProvider + RunTargetChooser Summary

**A `SkillLaunchProvider` context hosting one page-level `ForgeLaunchModal` with Forge-path `recordSkillLaunch`, plus a `useRunLaunch`/`RunTargetItems`/`RunTargetChooser` dispatch layer that routes Chat/Ástríðr to an `AutoSendHandoff` navigation and Forge to the shared modal — no launch logic duplicated across the many Run entry points Plan 05 will render.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2 completed
- **Files modified:** 4 (all created, 0 modified)

## Accomplishments
- `SkillLaunchProvider.tsx` — `createContext`/`useSkillLaunch` (throws outside the provider, mirrors `PrivacyContext`'s house pattern), owning `lastTarget`/`setLastTarget` (backed by Plan 01's `loadStoredRunTarget`/`storeRunTarget`) and `launchForge(skill)`, which composes the Forge `initialPrompt` as `skillInvocation(skill) + " "` (D-10 verbatim invocation) and opens the ONE page-level `<ForgeLaunchModal>` the provider renders. `recordSkillLaunch({ name })` fires exclusively from the modal's `onLaunched` callback — never from `onLaunchFailed`/`onClose` (D-12). `convex/forge.ts`'s Clerk fail-closed `enqueueLaunch` gate is untouched (the provider only opens the existing modal — T-99-10). 5 tests green.
- `RunTargetChooser.tsx` — `useRunLaunch(skill)` dispatches `pick(target)` by branching: `"chat"`/`"astridr"` open their own controlled popover state (`chatOpen`/`astridrOpen`), `"forge"` calls the provider's `launchForge`. `submitChat(text)`/`submitAstridr(text, profile)` navigate to `/chat` with an `AutoSendHandoff` in router state — `profile` is present only on the Ástríðr path. `RunTargetItems({ lastTarget, onPick })` renders the 3 `DropdownMenuItem`s with the exact UI-SPEC labels ("Send to Chat" / "Launch as Forge Agent" / "Dispatch to Ástríðr", Lucide `MessageSquare`/`Bot`/`Sparkles` icons) and a `Check` icon + `text-primary` tint on whichever row matches `lastTarget` (no text suffix, D-01). `RunTargetChooser({ skill, children })` is the standalone dropdown for QuickDeck: `children` (the chip) is cloned with a shared `anchorRef` so the two follow-up popovers anchor to the same trigger node Radix's own `DropdownMenuTrigger asChild` already refs. `onCloseAutoFocus={(e) => e.preventDefault()}` preserved (Popover-from-menu-item focus gotcha). 5 tests green.

## Task Commits

Each task was committed atomically:

1. **Task 1: SkillLaunchProvider — context + page-level ForgeLaunchModal + Forge recording (D-10/D-11/D-12)** - `513cc87` (feat)
2. **Task 2: RunTargetChooser — useRunLaunch hook, RunTargetItems, standalone dropdown (D-01)** - `8c278a5` (feat)

_Both tasks were written test-first per the plan's `<behavior>` blocks — the components didn't exist yet, so each task's 5 behavior tests were authored alongside the implementation in a single commit (no pre-existing green baseline to regress from), matching Plan 03's precedent for genuinely-new files._

## Files Created/Modified
- `src/components/skills/SkillLaunchProvider.tsx` - `SkillLaunchContext`/`useSkillLaunch`, one page-level `ForgeLaunchModal`, Forge-path `recordSkillLaunch`
- `src/components/skills/SkillLaunchProvider.test.tsx` - 5 tests: throw-outside-provider, `initialPrompt` composition, record-on-`onLaunched`, no-record-on-failed/close, `setLastTarget` persistence
- `src/components/skills/RunTargetChooser.tsx` - `useRunLaunch`, `RunTargetItems`, standalone `RunTargetChooser` dropdown
- `src/components/skills/RunTargetChooser.test.tsx` - 5 tests: item labels, last-pick checkmark isolation, `pick()` dispatch per target, `submitChat`/`submitAstridr` handoff shape, standalone trigger→dropdown→popover flow

## Decisions Made

See frontmatter `key-decisions` above (optimistic-vs-confirmed `recordSkillLaunch` timing, `DeckSkillLike`/`ForgeLaunchableSkill` duplication, Check-icon-alongside-target-icon rendering).

## Deviations from Plan

None - plan executed exactly as written. All two tasks, their `<read_first>` guidance, `<action>` specs, and `<acceptance_criteria>` were followed verbatim; no Rule 1-4 auto-fixes were needed. Two test-authoring adjustments were made while writing the (plan-mandated) `<behavior>` tests themselves, not to the implementation files:
- `RunTargetItems` renders `DropdownMenuItem`s, which Radix requires to be inside a `Menu` ancestor — tests wrap it in `<DropdownMenu open><DropdownMenuContent forceMount>` rather than rendering it bare.
- Opening the standalone `RunTargetChooser`'s dropdown requires `fireEvent.pointerDown` (Radix's `DropdownMenuTrigger` opens on pointerdown, not click) — matched the existing convention already documented in `SkillLifecycleMenu.test.tsx`'s `openMenu()` helper.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `SkillLaunchProvider` must be mounted once near the app root (or wherever Plan 05/06 wires the Skills page) before any `RunTargetChooser`/`useRunLaunch` consumer renders — `useSkillLaunch()` throws otherwise. Plan 06's own scope per the phase's wave breakdown.
- `RunTargetItems`/`useRunLaunch` are ready for Plan 05 to embed inside `SkillLifecycleMenu`'s existing ⋯ `DropdownMenuContent` as a nested `DropdownMenuSub` (or a second top-level item group) — no further changes needed to either exported symbol.
- `RunTargetChooser` (the standalone variant) is ready for Plan 05/06 to wrap the QuickDeck chip directly.
- `npx tsc --noEmit` clean across the repo; `npx vitest run src/components/skills/` — 24 files, 215 tests, zero regressions.
- No blockers for downstream plans.

---
*Phase: 99-skill-launch-dispatch*
*Completed: 2026-07-23*

## Self-Check: PASSED

Verified all 4 created files exist on disk (`SkillLaunchProvider.tsx`, `SkillLaunchProvider.test.tsx`, `RunTargetChooser.tsx`, `RunTargetChooser.test.tsx`) plus this SUMMARY.md; verified both commits (`513cc87`, `8c278a5`) present in `git log --oneline`.
