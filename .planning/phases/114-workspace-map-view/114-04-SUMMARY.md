---
phase: 114-workspace-map-view
plan: 04
subsystem: ui
tags: [react, workspace-map, empty-state, lucide, shadcn, tailwind, vitest]

# Dependency graph
requires: []
provides:
  - "AstridrLensEmptyState component: presentational, prop-driven empty state for the Astridr lens (D-10/D-11)"
  - "Three armsPresent branches (undefined/false/true) proving the live probe drives the copy, not a hardcoded string"
affects: [114-05, 114-06, 114-07, 114-08, 114-09, 114-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Prop-driven presentational component consuming a probe result as a boolean|undefined, keeping it testable without a Convex mock"
    - "Two-branch loading/empty precedent from CodeVaultGraph.tsx (h-[600px] container, rounded-[var(--radius)], Lucide icon at h-8 w-8 text-primary/40) reused for a third armsPresent=true branch"

key-files:
  created:
    - src/components/workspace/AstridrLensEmptyState.tsx
    - src/components/workspace/AstridrLensEmptyState.test.tsx
  modified: []

key-decisions:
  - "armsPresent=true renders a neutral 'ARMS inventory is now reporting, renderer not built yet' placeholder rather than the empty-state heading, per the plan's Task 1 action spec — this is what makes the armsPresent=true test load-bearing for D-11"
  - "Used fireEvent (not @testing-library/user-event, which is not a project dependency) for the click test, matching the repo's existing convention across src/components/brains/*.test.tsx"
  - "Used the installed Button primitive (variant='outline') for the 'View Larry's Workspace' action rather than a bare <a>/<button>, per CLAUDE.md's 'compose shadcn primitives, don't hand-roll' rule"

patterns-established:
  - "Convex-probe-result-as-boolean-prop: page-level hooks resolve the Convex query, presentational components take the resolved tri-state as a prop — keeps unit tests free of Convex mocks"

requirements-completed: []  # design-doc-driven phase — traced to D-10/D-11, not REQ-IDs

# Metrics
duration: 12min
completed: 2026-08-14
---

# Phase 114 Plan 04: Astridr Lens Empty State Summary

**Prop-driven `AstridrLensEmptyState` component with three probe-state branches (undefined/false/true), each proven distinct by test — D-11's "live, not hardcoded" property measured rather than assumed.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-14T09:03:00-04:00 (approx, context-read start)
- **Completed:** 2026-08-14T09:05:34-04:00
- **Tasks:** 2/2 completed
- **Files modified:** 2 (both new)

## Accomplishments
- Built `AstridrLensEmptyState` as a pure presentational component (no `useArmsProbe` call inside it), matching D-11's design intent that the data dependency stay visible at the page level.
- Three distinct `armsPresent` branches: `undefined` → skeleton only (no premature "nothing is mapped" claim), `false` → the honest empty state with verbatim UI-SPEC copy, `true` → a neutral "reporting, renderer not built" placeholder that proves the probe result — not a hardcoded string — drives what renders.
- Test suite (4 tests) asserting on user-visible text only; the `armsPresent={true}` test is explicitly the load-bearing assertion since it's the only one that can distinguish a live probe from a component that ignores its prop.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build AstridrLensEmptyState** - `39a595e3` (feat)
2. **Task 2: Prove the probe actually drives the copy** - `f01b6a5e` (test)

**Plan metadata:** (this commit) `docs(114-04): complete Astridr lens empty state plan`

## Files Created/Modified
- `src/components/workspace/AstridrLensEmptyState.tsx` - Prop-driven empty state; exports `AstridrLensEmptyState` and `AstridrLensEmptyStateProps`
- `src/components/workspace/AstridrLensEmptyState.test.tsx` - 4-test suite proving the three probe states render differently and the click handler fires once

## Decisions Made
- Icon choice for the `false` (honest empty state) branch: `Compass` from `lucide-react` — the plan left icon choice to discretion ("any Lucide icon that fits; UI-SPEC mandates no specific one here"). `Radar` was reserved for the `true` branch to differ visually from the empty state and to echo the nav icon UI-SPEC assigns to the whole `/workspace-map` page.
- No hex literals; every color class is a semantic Tailwind utility (`text-primary/40`, `text-muted-foreground`, `border-primary/20`, `bg-card/50`) — verified via `grep -cE '#[0-9a-fA-F]{3,8}\b'` returning 0.

## Deviations from Plan

None - plan executed exactly as written. The plan's `<read_first>` precedent (`CodeVaultGraph.tsx:883-913`) was followed for container sizing, radius token, and icon styling; the plan's Task 2 test conventions were adapted from the repo's actual convention (`fireEvent`, found in `src/components/brains/*.test.tsx`) rather than the plan's own suggestion of `@testing-library/react`'s `render`/`screen` alone, since `@testing-library/user-event` is not an installed dependency — `fireEvent.click` is the correct, already-used substitute and produces an equivalent single-invocation assertion.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `AstridrLensEmptyState` is ready to be composed into the `/workspace-map` page (a later plan in this phase, per the UI-SPEC's Component Inventory) alongside `useArmsProbe` resolving the real `armsPresent` value from `listSnapshots`.
- No blockers. This component has no dependency on `WorkspaceMapCanvas`, `WorkspaceCoverageStrip`, or the D-13 backend change (`listSnapshots` gaining `sources`) — it consumes only a boolean prop, so it can be wired up independently once the page-level `useArmsProbe` hook exists.

---
*Phase: 114-workspace-map-view*
*Completed: 2026-08-14*
