---
phase: 98-skill-lifecycle-mutations-archive-restore-move-delete
plan: 04
subsystem: ui
tags: [react, shadcn, radix-ui, convex, skills, lifecycle, dropdown-menu]

# Dependency graph
requires:
  - phase: 98-01-convex-lifecycle-substrate
    provides: enqueueLifecycle mutation, listLifecycleCommands query, lifecyclePayload schema shape
  - phase: 98-03-lifecycle-ui-hook-and-menu
    provides: dropdown-menu primitive, useLifecycle.ts hook, MoveToProjectDialog.tsx, DeleteSkillDialog.tsx
provides:
  - SkillLifecycleMenu.tsx — self-contained, scope-gated ⋯ menu (Archive/Restore/Move/Delete)
  - Always-visible lifecycle menu on every SkillRow (all views: AllSkillsOverview, SkillsInCategory, ColdStorageView)
  - ColdStorageView copy pointing to the row menu instead of a terminal command
affects: [99-skill-launch-dispatch, 100-control-surface-ux]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SkillLifecycleMenu is fully self-contained: owns its own DropdownMenu, Move/Delete dialog open state, resolves its own host (IntakeModal's D-08 online-newest convention via useForgeHostsRaw), and calls enqueueLifecycle directly — SkillRow/ColdStorageView only render <SkillLifecycleMenu skill={skill} .../>, no callback threading needed"
    - "Move/Delete dialogs are lazy-mounted (only rendered once their open state is true) to avoid every row subscribing to listWorkspaces/enqueueLifecycle before the user ever opens them"
    - "Radix DropdownMenuTrigger opens on pointerdown, not click — jsdom tests must fire pointerdown (not click) to open the menu before querying its items"

key-files:
  created:
    - src/components/skills/SkillLifecycleMenu.tsx
    - src/components/skills/SkillLifecycleMenu.test.tsx
    - src/components/skills/ColdStorageView.test.tsx
  modified:
    - src/components/skills/SkillRow.tsx
    - src/components/skills/ColdStorageView.tsx
    - src/components/skills/SkillRow.test.tsx
    - src/components/skills/AllSkillsOverview.test.tsx
    - src/components/skills/__tests__/SkillsInCategory.test.tsx
    - src/pages/__tests__/Skills.test.tsx

key-decisions:
  - "isDormant(skill) and isShadowing(skill) are mutually exclusive by construction against the real registry data model (convex/skillSync.ts's groupSkillRowsByName merges every origin for a name into ONE row, so a row can never have ALL origins === DORMANT_ORIGIN and ALSO a non-dormant origin at once) — the shadow-disabled-Restore branch is defensive code that satisfies the plan's literal acceptance criteria and D-09's client-side half of the two-layer check, but is not naturally reachable via today's grouped-row data; it stays correct and harmless, and the daemon's LAYER-2 re-check (98-02) is the real backstop for any registry-staleness edge case. Unit-tested by spying on isShadowing directly rather than constructing an impossible origins fixture."
  - "Restore only ever targets destination:\"global\" (no destination picker) — matches the UI-SPEC's simple single-item 'Restore' menu entry (D-07) and enqueueLifecycle's validateLifecyclePreflight, which only pre-checks shadow-collisions for a global destination; a project-scope restore destination exists in the schema but has no menu affordance in this phase (not specified by 98-UI-SPEC's Copywriting Contract)."
  - "Host resolved inside SkillLifecycleMenu itself via useForgeHostsRaw, mirroring IntakeModal's D-08 online-newest-then-newest-overall convention, with an optional hostId override prop for callers/tests that already have one — avoids threading a new required prop through SkillRow/AllSkillsOverview/SkillsInCategory/ColdStorageView call sites (Task 2's backward-compatibility requirement)."
  - "Move-to-Project and Delete Permanently dialogs are lazy-mounted (`{moveOpen && <MoveToProjectDialog .../>}`) rather than always-mounted-with-open=false — avoids every visible row firing a listWorkspaces query and an idle enqueueLifecycle mutation binding before the user ever opens a dialog."
  - "Multi-scope guard (nonDormantOrigins.length > 1) disables both Archive and Move with one shared 'Active in multiple scopes' reason, rather than guessing origins[0] for either action (Pitfall 1a/T-98-08)."

patterns-established:
  - "SkillLifecycleMenu.tsx's Radix DropdownMenu is opened in tests via fireEvent.pointerDown (not fireEvent.click) — the trigger's onPointerDown handler is what toggles Radix's open state; documented in the test file for future menu components in this repo."

requirements-completed: []  # See key-decisions and STATE.md: 98-01/02/03 established that LIFE-01..06 stay "Pending" until the phase's live manual UAT (real archive + real cross-volume move against a live daemon) passes — that UAT is still outstanding after this plan (per STATE.md Session Continuity, "do not skip it once 98-04 lands"). This plan completes the code-level wiring (Convex enqueue -> daemon executor -> UI), but end-to-end delivery is only genuinely proven once a human confirms it live.

# Metrics
duration: 30min
completed: 2026-07-21
---

# Phase 98 Plan 04: Lifecycle Menu Assembly Summary

**Self-contained `SkillLifecycleMenu` (⋯) wired into every `SkillRow` — scope-gated Archive/Restore/Move/Delete, client-side shadow and multi-scope guards, and Cold Storage's dead-end terminal instruction replaced with the live in-app affordance.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-07-21T21:30:00Z (approx, immediately following 98-03)
- **Completed:** 2026-07-21T21:37:00Z
- **Tasks:** 2
- **Files modified:** 9 (3 created, 6 modified)

## Accomplishments

- `SkillLifecycleMenu.tsx`: a self-contained `DropdownMenu` (icon-only `MoreVertical` trigger, `aria-label="Skill actions for {displayName}"`) that gates its items by scope — dormant rows get Restore + Delete Permanently; active single-scope rows get Archive + one Move item naming the destination scope; rows with more than one non-dormant origin get both Archive and Move disabled with an honest "Active in multiple scopes" reason instead of guessing which instance to act on.
- Shadow-blocked Restore: `isShadowing(skill)` disables the Restore item and wraps it in the existing `Tooltip` primitive (never a native `title`) with the exact Copywriting Contract string; the click handler also early-returns as defense in depth so no client-detectable shadow can reach `enqueueLifecycle`.
- Archive, Restore, and Move-to-Global enqueue `enqueueLifecycle` directly with no dialog (matching D-07's "no throwaway confirmation" for reversible actions); Move-to-Project opens the existing `MoveToProjectDialog`, Delete Permanently opens the existing `DeleteSkillDialog` — both lazy-mounted only once opened.
- An in-flight lifecycle command for the row's skill name renders the reused `RowStatusBadge` (via `useLifecycleCommands`/`latestLifecycleForSkill`) next to the trigger until the command resolves to `"done"`.
- `SkillRow.tsx` renders `<SkillLifecycleMenu skill={skill} hostId={hostId} />` always visible (outside the `opacity-0 group-hover:opacity-100` cluster) with a `min-w-8 min-h-8` touch target — the one deliberate divergence from the tight-padded Chat/Star/Pencil buttons; a new optional `hostId` prop keeps every existing `SkillRow` call site compiling untouched.
- `ColdStorageView.tsx`'s "Restore them with /manage-skills" dead-end copy is replaced with "Use the ⋯ menu on a row to restore or permanently delete it."

## Task Commits

Each task was committed atomically:

1. **Task 1: SkillLifecycleMenu — scope-gated menu with shadow + multi-scope guards** — `a8c24ef` (feat)
2. **Task 2: Wire always-visible ⋯ trigger into SkillRow + refresh ColdStorageView copy** — `eb91eda` (feat)

## Files Created/Modified

- `src/components/skills/SkillLifecycleMenu.tsx` — the ⋯ menu component (232 lines): scope-gating, shadow/multi-scope guards, direct-enqueue actions, lazy-mounted Move/Delete dialogs, `RowStatusBadge` overlay, exported `resolveHostId` helper.
- `src/components/skills/SkillLifecycleMenu.test.tsx` — 19 tests: trigger aria-label, dormant-vs-active item sets, shadow-disabled Restore (+ no-enqueue-on-click), non-shadowed Restore enqueue args, multi-scope disable, Archive/Move-to-Global enqueue args, Move-to-Project/Delete dialog-open assertions, in-flight badge rendering, and `resolveHostId`'s pure-function unit tests.
- `src/components/skills/SkillRow.tsx` — new optional `hostId` prop; renders `SkillLifecycleMenu` always-visible in the action cluster.
- `src/components/skills/ColdStorageView.tsx` — refreshed explainer copy.
- `src/components/skills/ColdStorageView.test.tsx` — 5 tests: refreshed copy present, `/manage-skills` gone, per-row menu renders, empty state, dormant count badge.
- `src/components/skills/SkillRow.test.tsx`, `src/components/skills/AllSkillsOverview.test.tsx`, `src/components/skills/__tests__/SkillsInCategory.test.tsx`, `src/pages/__tests__/Skills.test.tsx` — convex/react (and, for the Skills page suite, its generated-api) mocks extended so these pre-existing suites keep working now that every `SkillRow` unconditionally mounts a component that calls real Convex hooks (see Deviations).

## Decisions Made

See frontmatter `key-decisions` for the full list. Summary:
- `isDormant`/`isShadowing` are provably mutually exclusive against the real grouped-row registry data; the shadow-disabled-Restore code path is a correct, harmless defensive branch (client half of D-09's two-layer check) rather than something reachable via today's data model — tested by spying on `isShadowing` directly.
- Restore always targets `destination: "global"` — no destination picker, matching the UI-SPEC's single "Restore" menu item and `validateLifecyclePreflight`'s global-only shadow pre-check.
- Host resolution and Move/Delete dialog ownership both live inside `SkillLifecycleMenu` itself (self-contained per the plan's objective) rather than being threaded through `SkillRow`/page-level props.
- Move-to-Project/Delete dialogs are lazy-mounted, not always-mounted-with-`open={false}`, to avoid every row eagerly subscribing to `listWorkspaces`/binding an idle mutation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Pre-existing SkillRow-consuming test suites broke because SkillRow now unconditionally mounts real Convex hooks**
- **Found during:** Task 2, running the full repo test suite after wiring `SkillLifecycleMenu` into `SkillRow`
- **Issue:** `SkillLifecycleMenu` calls `useForgeHostsRaw`/`useLifecycleCommands`/`useMutation` (real `convex/react` hooks) unconditionally on every render. Four pre-existing suites render a `SkillRow` (directly or via `AllSkillsOverview`/`SkillsInCategory`/the `Skills` page) without a `ConvexProvider` or a `convex/react` mock: `SkillRow.test.tsx`, `AllSkillsOverview.test.tsx`, `SkillsInCategory.test.tsx` threw `"Could not find Convex client!"`; `Skills.test.tsx` (which already mocks the generated `api` module with only `skillCategories`/`registry` namespaces) threw `TypeError: Cannot read properties of undefined (reading 'listHosts')` since `api.forge` was `undefined` in its mock.
- **Fix:** Added the same `vi.mock("convex/react", () => ({ useQuery: vi.fn(() => []), useMutation: vi.fn(() => vi.fn()) }))` stub already used elsewhere in this repo (e.g. `MoveToProjectDialog.test.tsx`) to `SkillRow.test.tsx`, `AllSkillsOverview.test.tsx`, and `SkillsInCategory.test.tsx`; extended `Skills.test.tsx`'s existing generated-`api` mock with a `forge: { listHosts, listLifecycleCommands, listWorkspaces, enqueueLifecycle }` namespace (all unrecognized by its `mockUseQuery`/`mockUseMutation` implementations, which already return safe fallbacks for unknown refs — no new mock logic needed there).
- **Files modified:** `src/components/skills/SkillRow.test.tsx`, `src/components/skills/AllSkillsOverview.test.tsx`, `src/components/skills/__tests__/SkillsInCategory.test.tsx`, `src/pages/__tests__/Skills.test.tsx`
- **Verification:** `npx vitest run` (full repo suite) — 204 test files / 2305 tests passed, 0 failures, 193 pre-existing todo. `npx tsc --noEmit` clean throughout.
- **Committed in:** `eb91eda` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking test breakage directly caused by this plan's own change, fixed with the repo's existing convex/react-mocking convention; no scope creep).
**Impact on plan:** No behavior change to any of the four fixed test files beyond the mock addition — all assert exactly what they asserted before.

## Issues Encountered

- Radix's `DropdownMenuTrigger` opens on `onPointerDown`, not `onClick` — an initial `SkillLifecycleMenu.test.tsx` draft using `fireEvent.click` on the trigger left the menu permanently closed (12/19 tests failing with "Unable to find an accessible element with role menuitem"). Resolved by firing `fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })` instead, mirroring the exact condition Radix's trigger checks (verified by reading `node_modules/@radix-ui/react-dropdown-menu/dist/index.mjs`).
- Radix's `MenuContent`/`Tooltip` need a `ResizeObserver` polyfill in jsdom (no error without it in this repo's jsdom version, but added the same guard `KGViewsPopover.test.tsx` uses as a precaution since both primitives share the same Popper-based positioning layer).

## User Setup Required

None — no external service configuration required. All Convex functions this plan consumes (`enqueueLifecycle`, `listLifecycleCommands`, `listHosts`, `listWorkspaces`) were already deployed by Plans 98-01/98-03.

## Next Phase Readiness

- The full Phase 98 code path is now wired end-to-end: `SkillLifecycleMenu` (this plan) → `enqueueLifecycle` (98-01) → Forge daemon `executeLifecycle` (98-02) → `rescanAndSync` → Convex `skills` registry → the Skills page's live `useQuery` re-render.
- **Not yet done, and NOT claimed as done:** LIFE-01..06 traceability stays "Pending" in `REQUIREMENTS.md` — per STATE.md's Session Continuity note, a manual UAT (real archive + a real cross-volume move against a live Forge daemon) is still required before the phase can be verified. This is a phase-level gate, not a per-plan one, matching 98-01/02/03's own established precedent of deferring completion to full, human-verified end-to-end delivery.
- Phase 100 (Control-Surface UX) can build directly on `SkillLifecycleMenu` — the plan's own comments note this is intentionally the "simple" D-07 menu; Phase 100 upgrades it in place (drag lanes, optimistic lane-move) rather than relocating its actions.

---
*Phase: 98-skill-lifecycle-mutations-archive-restore-move-delete*
*Completed: 2026-07-21*

## Self-Check: PASSED

- FOUND: src/components/skills/SkillLifecycleMenu.tsx
- FOUND: src/components/skills/SkillLifecycleMenu.test.tsx
- FOUND: src/components/skills/ColdStorageView.test.tsx
- FOUND: src/components/skills/SkillRow.tsx
- FOUND: src/components/skills/ColdStorageView.tsx
- FOUND: .planning/phases/98-skill-lifecycle-mutations-archive-restore-move-delete/98-04-SUMMARY.md
- FOUND: a8c24ef (Task 1 commit)
- FOUND: eb91eda (Task 2 commit)
- FOUND: 6d4407e (Summary commit)
