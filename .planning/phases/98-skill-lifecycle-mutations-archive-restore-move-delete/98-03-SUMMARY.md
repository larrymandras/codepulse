---
phase: 98-skill-lifecycle-mutations-archive-restore-move-delete
plan: 03
subsystem: ui
tags: [react, shadcn, radix-ui, convex, skills, lifecycle]

# Dependency graph
requires:
  - phase: 98-01-convex-lifecycle-substrate
    provides: enqueueLifecycle mutation, listLifecycleCommands query, lifecyclePayload schema shape
provides:
  - dropdown-menu shadcn primitive (radix-ui meta-package, first install in this repo)
  - useLifecycle.ts hook — LifecycleCommandRow keyed by (skillName, action), reusing IntakeRowStatus/mapIntakeStatus
  - MoveToProjectDialog.tsx — workspace-picker move dialog (LIFE-03)
  - DeleteSkillDialog.tsx — type-to-confirm permanent-delete AlertDialog (LIFE-04/D-06)
affects: [98-04-lifecycle-menu-assembly]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "mapLifecycleStatus/adaptLifecycleCommand are thin lifecycle-domain wrappers around useIntake's mapIntakeStatus (imported, not redefined) and its useMemo-wrapped-query discipline — same anti-infinite-loop guarantee, same EMPTY_* stable-identity constant convention"
    - "latestLifecycleForSkill resolves 'newest' by createdAt comparison, not list order, so callers never depend on the query's own ordering guarantee"
    - "MoveToProjectDialog and DeleteSkillDialog are both controlled (open/onOpenChange props), self-contained, single-purpose dialogs — no cross-wiring to SkillRow/ColdStorageView yet (that's Plan 98-04's job)"

key-files:
  created:
    - src/components/ui/dropdown-menu.tsx
    - src/hooks/useLifecycle.ts
    - src/hooks/useLifecycle.test.ts
    - src/components/skills/MoveToProjectDialog.tsx
    - src/components/skills/MoveToProjectDialog.test.tsx
    - src/components/skills/DeleteSkillDialog.tsx
    - src/components/skills/DeleteSkillDialog.test.tsx
  modified: []

key-decisions:
  - "dropdown-menu installed via `npx shadcn add dropdown-menu` (official registry) — generated file imports from the already-installed `radix-ui` v1.4.3 meta-package, confirmed by reading the generated file; package.json/package-lock.json are byte-unchanged (git status showed only the new .tsx file), so no new npm dependency landed"
  - "mapLifecycleStatus is a distinct export that delegates to mapIntakeStatus (not a re-export) — call sites read as lifecycle-domain code, not a leaked intake import, while guaranteeing byte-identical behavior including the 'unknown -> queued' defensive fallback"
  - "LifecycleCommandRow carries sourceOrigin and workspaceId in addition to the plan's stated field list (commandId/status/skillName/action/destination/error/createdAt/expiresAt) — both are already present on the Convex doc's lifecyclePayload (Plan 98-01 schema) and Plan 98-04's dialogs need sourceOrigin to construct their own enqueueLifecycle calls from a skill row context; adding them now avoids a second adapter pass"
  - "MoveToProjectDialog/DeleteSkillDialog each own their own enqueueLifecycle call and commandId generation (not routed through useLifecycle) — the hook is read-only (list + lookup); mutation call sites belong in the components consistent with IntakeModal's own enqueueIntake ownership"
  - "AlertDialogAction's onClick calls onOpenChange(false) explicitly in DeleteSkillDialog's finally block, even though Radix's built-in Action-click behavior already closes a controlled AlertDialog — kept for defense-in-depth symmetry with MoveToProjectDialog's plain Dialog (which has no such built-in auto-close)"

patterns-established:
  - "Lifecycle UI building blocks (hook + primitive + 2 dialogs) built and unit-tested in isolation before any menu assembly, matching this plan's stated purpose of keeping each piece within peak-quality context budget for Plan 98-04's wiring pass"

requirements-completed: []  # LIFE-03/LIFE-04/LIFE-06 NOT marked complete — these building blocks are not yet wired into SkillRow/ColdStorageView (Plan 98-04); matches 98-01/98-02's own precedent of deferring completion to full end-to-end delivery

# Metrics
duration: 20min
completed: 2026-07-21
---

# Phase 98 Plan 03: Lifecycle UI Building Blocks Summary

**One new shadcn `dropdown-menu` primitive, a `useLifecycle` hook mirroring `useIntake`'s status model keyed by `(skillName, action)`, and two self-contained dialogs — `MoveToProjectDialog` (workspace picker) and `DeleteSkillDialog` (type-to-confirm permanent delete) — all unit-tested in isolation, none yet wired into `SkillRow`/`ColdStorageView`.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-21T21:10:00Z (approx, file-read start)
- **Completed:** 2026-07-21T21:30:00Z
- **Tasks:** 3
- **Files modified:** 7 (all new — no existing files touched)

## Accomplishments

- `src/components/ui/dropdown-menu.tsx` installed via `npx shadcn add dropdown-menu` from the official registry — verified it imports `DropdownMenu as DropdownMenuPrimitive` from the `radix-ui` meta-package (not a new per-primitive `@radix-ui/react-dropdown-menu` install); `git status` after the install showed only the new `.tsx` file, confirming zero `package.json`/lockfile changes.
- `src/hooks/useLifecycle.ts`: a sibling of `useIntake.ts` — imports `IntakeRowStatus` (type-only) and delegates to `mapIntakeStatus` under a lifecycle-named wrapper (`mapLifecycleStatus`), defines `LifecycleCommandRow` (carrying mandatory `skillName`/`action` plus `sourceOrigin`/`destination`/`workspaceId`/`error`/`createdAt`/`expiresAt`), `adaptLifecycleCommand` (reads `doc.lifecyclePayload`, never throws on a null/malformed payload), `useLifecycleCommandsRaw`/`useLifecycleCommands` (useMemo-wrapped `useQuery(api.forge.listLifecycleCommands, {})`, `EMPTY_LIFECYCLE_ROWS` stable-identity constant), and `latestLifecycleForSkill` (newest-by-`createdAt` lookup for a given skill name).
- `src/components/skills/MoveToProjectDialog.tsx`: a small controlled `Dialog` reusing `IntakeModal`'s workspace `Select` block verbatim (`useQuery(api.forge.listWorkspaces, hostId ? { hostId } : "skip")`, no `class`-based filter, verbatim empty-state copy). On confirm, calls `useMutation(api.forge.enqueueLifecycle)` with `action: "move"`, `destination: "project"`, the selected `workspaceId`, and the skill's `sourceOrigin`; confirm stays disabled until a workspace is picked.
- `src/components/skills/DeleteSkillDialog.tsx`: copies `ForgeStopConfirmDialog`'s `AlertDialog` structure and adds the D-06 type-to-confirm gate (`confirmText.trim() === skillName`, case-sensitive, no pre-fill, no autofocus-select-all). On confirm, calls `enqueueLifecycle` with `action: "delete"`, `destination: "cold"`, `workspaceId: null`. `AlertDialogCancel` keeps the default "Cancel" label per `ForgeStopConfirmDialog`'s house precedent.
- All four new source files carry the verbatim Copywriting Contract strings from `98-UI-SPEC.md` (dialog titles, bodies, button labels, empty-state, placeholder).

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dropdown-menu primitive + useLifecycle hook** — `3ff1bde` (feat)
2. **Task 2: MoveToProjectDialog — workspace picker (LIFE-03)** — `fe08fba` (feat)
3. **Task 3: DeleteSkillDialog — type-to-confirm permanent delete (LIFE-04/D-06)** — `4f1feed` (feat)

## Files Created/Modified

- `src/components/ui/dropdown-menu.tsx` — shadcn-generated DropdownMenu primitive (radix-ui meta-package), 15 sub-components exported, zero hand-edits.
- `src/hooks/useLifecycle.ts` — lifecycle command-row hook + adapter (130 lines).
- `src/hooks/useLifecycle.test.ts` — 13 tests: `mapLifecycleStatus` (6), `adaptLifecycleCommand` (3), `latestLifecycleForSkill` (4).
- `src/components/skills/MoveToProjectDialog.tsx` — workspace-picker move dialog (164 lines).
- `src/components/skills/MoveToProjectDialog.test.tsx` — 7 tests: verbatim copy, no-class-filter picker render, empty-state + disabled confirm, disabled-until-selected, enqueue args, close-on-confirm, cancel no-op.
- `src/components/skills/DeleteSkillDialog.tsx` — type-to-confirm AlertDialog (120 lines).
- `src/components/skills/DeleteSkillDialog.test.tsx` — 12 tests: verbatim copy, no-prefill, disabled on empty/partial/case-mismatch, enabled on exact/trimmed match, enqueue args, disabled-click no-op, cancel no-op, reset-on-reopen.

## Decisions Made

See frontmatter `key-decisions` for the full list. Summary:
- `mapLifecycleStatus` delegates to (rather than duplicates) `mapIntakeStatus` — byte-identical behavior, lifecycle-domain-named call sites.
- `LifecycleCommandRow` carries two fields beyond the plan's literal list (`sourceOrigin`, `workspaceId`) because both already exist on the Convex doc and Plan 98-04's menu wiring will need them.
- Each dialog owns its own `enqueueLifecycle` mutation call and `crypto.randomUUID()` commandId generation, mirroring `IntakeModal`'s pattern of owning its own mutation rather than routing writes through the read-only hook.

## Deviations from Plan

None — plan executed exactly as written. The `dropdown-menu` CLI install path was taken (not the hand-authored fallback), and it succeeded cleanly on the first attempt.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. `npx shadcn add dropdown-menu` ran against the already-configured `components.json` registry; no new environment variables or manual steps.

## Next Phase Readiness

- Plan 98-04 (menu assembly) can now import `useLifecycleCommands`/`latestLifecycleForSkill` from `useLifecycle.ts`, render `RowStatusBadge` (existing, unmodified) keyed by the hook's lookup, mount `MoveToProjectDialog`/`DeleteSkillDialog` from a `DropdownMenu` on `SkillRow`/`ColdStorageView`, and wire the Archive/Restore/"Move to Global" actions (which enqueue `enqueueLifecycle` directly, no dialog needed per the UI-SPEC).
- **Not yet done, and NOT claimed as done:** no `⋯` menu exists yet on any row (Plan 98-04), so a user still cannot trigger any of these four building blocks from the live UI. LIFE-03/LIFE-04/LIFE-06 traceability is deliberately left "Pending" in REQUIREMENTS.md (see Decisions / requirements-completed above) — matches 98-01/98-02's own precedent.
- Full repo-wide test suite verified green before this plan's tasks were committed: `npx vitest run` — 202 test files passed / 17 skipped, 2281 tests passed / 193 todo, 0 regressions. `npx tsc --noEmit` clean throughout.

---
*Phase: 98-skill-lifecycle-mutations-archive-restore-move-delete*
*Completed: 2026-07-21*

## Self-Check: PASSED

- FOUND: src/components/ui/dropdown-menu.tsx
- FOUND: src/hooks/useLifecycle.ts
- FOUND: src/hooks/useLifecycle.test.ts
- FOUND: src/components/skills/MoveToProjectDialog.tsx
- FOUND: src/components/skills/MoveToProjectDialog.test.tsx
- FOUND: src/components/skills/DeleteSkillDialog.tsx
- FOUND: src/components/skills/DeleteSkillDialog.test.tsx
- FOUND: 3ff1bde (Task 1 commit)
- FOUND: fe08fba (Task 2 commit)
- FOUND: 4f1feed (Task 3 commit)
