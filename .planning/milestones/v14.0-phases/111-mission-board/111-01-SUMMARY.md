---
phase: 111-mission-board
plan: 01
subsystem: ui
tags: [react, typescript, vitest, tailwind, jobspanel, mission-history]

# Dependency graph
requires: []
provides:
  - "JobsPanel.tsx rewritten as a truthful post-hoc mission history board (D-08/D-09/D-10)"
  - "JobsPanel.test.tsx regression coverage (8 tests: header/badge/empty-state/4 age tiers merged into 3 explicit tier tests/epoch guard/unmapped-status fallback)"
  - "LiveRun.tsx mount-site comment corrected to match the rewritten surface (Stale Docs rule)"
affects: ["111-mission-board plan 02 (ActiveAgentsPanel deletion)", "111-mission-board plan 03 (checkpoint, overflow visual review)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-meaning 'finished X ago' timestamp formatter with s/m/h/d tiers, mirroring MissionTimelinePanel's relativeTime/normalizeMs precedent"
    - "Unmapped-status honesty: no map entry for 'unknown' or any non-terminal status; falls through to muted Clock icon + StatusBadge idle style"

key-files:
  created:
    - src/components/JobsPanel.test.tsx
  modified:
    - src/components/JobsPanel.tsx
    - src/pages/LiveRun.tsx

key-decisions:
  - "Preserved the ref < 1e12 ? ref * 1000 : ref epoch-seconds guard verbatim per UI-SPEC; both mutation controls proved it and the day-tier divisor are load-bearing"
  - "Docstring and formatElapsed comment rewritten in place (Stale Docs rule) rather than left describing the now-removed live-streaming behavior"

patterns-established:
  - "Pattern: mission-history-style timestamp formatter (s/m/h/d, uncapped day count, single meaning) — reusable for any other post-hoc (not live) subagentJobs-shaped surface"

requirements-completed: [MISSION-01, MISSION-03]

# Metrics
duration: 34min
completed: 2026-08-11
---

# Phase 111 Plan 01: Mission History Board Summary

**Rewrote JobsPanel from a live-looking (but permanently empty-of-live-states) background-jobs board into an honest post-hoc mission history surface: pruned the queued/running icon-map entries the emitter never writes, replaced the dual-meaning elapsed formatter with an explicit `finished X ago` string including a new day tier, and removed the pulsing-dot/"BACKGROUND JOBS" live chrome.**

## Performance

- **Duration:** 34 min
- **Started:** 2026-08-11T08:24:00-04:00 (approx, first file read)
- **Completed:** 2026-08-11T08:32:57-04:00
- **Tasks:** 3 completed
- **Files modified:** 2 modified, 1 created

## Accomplishments
- `JobsPanel.tsx` renders `MISSION HISTORY`, `{n} missions`, no `animate-pulse` element, three terminal-state icons (completed/failed/cancelled), and a token-based `text-(--status-error)` failed-icon tint (was hardcoded `text-[#ef4444]`)
- `formatElapsed` now returns exactly one of four `finished …` strings (`finished moments ago` / `finished {m}m ago` / `finished {h}h ago` / `finished {d}d ago`, uncapped), with the seconds-epoch normalization guard preserved verbatim and mutation-proven
- New `src/components/JobsPanel.test.tsx` (144 lines, 8 tests, all passing) covers the header/badge/empty-state copy, all tiers, the epoch guard, and the unmapped-status (`"unknown"`, `"running"`) fallback to the muted `Clock` icon + `UNKNOWN`/`bg-muted` badge
- `LiveRun.tsx`'s mount-site comment corrected from a live-streaming claim to an accurate description of the history board, per the Stale Docs rule — mount itself byte-identical (`<JobsPanel />` unchanged, diff is comment lines only)
- Full repo test suite re-run after all three tasks: 297 test files pass, 3936 tests pass, 0 regressions; `npx tsc --noEmit` exits 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite JobsPanel as a mission history surface (D-08, D-09, D-10)** - `476155f0` (feat)
2. **Task 2: Add JobsPanel.test.tsx covering copy, tiers, epoch guard, unmapped-status fallback** - `39ef99ea` (test)
3. **Task 3: Correct the mount-site comment in LiveRun.tsx (Stale Docs rule)** - `14658112` (docs)

_No plan-metadata commit yet — this SUMMARY + STATE.md/ROADMAP.md update is committed separately per the final_commit step._

## Files Created/Modified
- `src/components/JobsPanel.tsx` - Rewritten header/icon-map/formatElapsed/docstring; now a truthful post-hoc mission history board
- `src/components/JobsPanel.test.tsx` - New: 8 tests covering copy, all four age tiers, the epoch guard, and the unmapped-status fallback
- `src/pages/LiveRun.tsx` - Comment-only fix above the `<JobsPanel />` mount; mount itself unchanged

## Decisions Made
- Kept the `ref < 1e12 ? ref * 1000 : ref` epoch-seconds guard and the underlying tier-computation shape exactly as prescribed (matching `MissionTimelinePanel.tsx`'s `normalizeMs`/`relativeTime` precedent) rather than refactoring into a shared utility — out of scope for this subtraction-only plan.
- Rewrote both the file docstring and the `formatElapsed` comment block per the plan's Stale Docs requirement, since both still made claims (`live-query-driven`, `no ms conversion needed`) the rewrite falsifies. Verified via the plan's prescribed removal/replacement grep gates (all passed, see below).

## Deviations from Plan

None — plan executed exactly as written. One clarification, not a deviation: the plan's `<verify>npx tsc --noEmit</verify>` gate transiently failed during Task 1 due to unrelated concurrent work in this shared checkout (a Phase 119 "Loom Curated Pipelines" session had `convex/loomHttp.ts`, `convex/loom.ts`, `convex/schema.ts`, `convex/http.ts`, `convex/ingestAuth.ts` staged/modified with a type error in `convex/loomHttp.ts` referencing a `loom` API surface unrelated to this phase). Per the scope-boundary rule, this was out of scope to fix — it was not touched, not staged, and not committed by this plan. By Task 3 the concurrent session had resolved its own state and `npx tsc --noEmit` exited 0 cleanly for the whole repo.

## Mutation Control Evidence (Task 2, mandatory)

Both controls were executed against the live file, observed RED, and reverted before the Task 2 commit. `JobsPanel.tsx` was restored from a byte-for-byte backup after each mutation and reconfirmed against `git diff --stat` (empty) before the next step.

**Control 1 — day-tier divisor mutated `24` → `240`** (`return \`finished ${Math.floor(h / 240)}d ago\`;`):

```
 ❯ src/components/JobsPanel.test.tsx:84:19
     82|     const { container } = render(<JobsPanel />);
     83|
     84|     expect(screen.getByText("finished 34d ago")).toBeInTheDocument();
       |                   ^
     85|     expect(container.textContent).not.toMatch(/finished \d{3,}h ago/);
     86|   });
 ...
 Test Files  1 failed (1)
      Tests  1 failed | 7 passed (8)
```
Rendered output under the mutation: `finished 3d ago` (34-day-old row now reads as 3d, since the divisor scaled hours by 10x too far) — confirms the day-tier test genuinely asserts the tier boundary, not merely "some text renders."

**Control 2 — epoch-seconds guard deleted** (`const refMs = ref < 1e12 ? ref * 1000 : ref;` → `const refMs = ref;`):

```
 ❯ src/components/JobsPanel.test.tsx:105:19
    103|     render(<JobsPanel />);
    104|
    105|     expect(screen.getByText("finished moments ago")).toBeInTheDocument…
       |                   ^
    106|   });
 ...
 Test Files  1 failed (1)
      Tests  3 failed | 5 passed (8)
```
Rendered output under the mutation: `finished 20655d ago` for what should have been a 34-day-old row (seconds value treated as ms, producing a ~56-year age) — 3 of 8 tests failed (day tier, minute tier, sub-minute tier), confirming the guard is load-bearing across every tier, not just the day tier.

Both reverts confirmed clean: `git diff --stat src/components/JobsPanel.tsx` was empty after each restore, and the full 8-test suite passed green again before proceeding.

## Issues Encountered
None beyond the concurrent-session `tsc` noise documented above, which self-resolved by Task 3.

## Visual Overflow Risk — Flagged for 111-03 Checkpoint

Per the plan's `<output>` instruction, recording (not resolving) a risk in the trailing timestamp cluster for the 111-03 checkpoint to evaluate live:

- **Old strings** were 2-3 characters: `5s`, `34s`, `12m`, `3h`.
- **New strings** are 15-21 characters: `finished moments ago` (21 chars), `finished 34d ago` (17 chars), `finished 45m ago` (16 chars).
- `EntityRow.tsx:34`'s trailing wrapper is `shrink-0` with no width cap — it does not truncate or wrap the timestamp; instead the sibling `flex-1 min-w-0` primary/secondary column absorbs the compression (its `primary` text already truncates/line-clamps). On a narrow `JobsPanel` mount (it sits inside `LiveRun.tsx`'s `px-4 py-3` header strip, not a full-width page), a `StatusBadge` (`CANCELLED` is the longest label) plus the new ~20-char timestamp string in one `gap-1.5` row could push the trailing cluster's natural width to roughly 3-4x its old size, further squeezing the task-snippet column on smaller viewports.
- This was evaluated from code/CSS analysis only — no live browser render was captured this plan (out of scope for an `auto` task with no checkpoint). Flagging for 111-03's live checkpoint to screenshot at both a normal and a narrow viewport width and confirm the row doesn't visually break.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `JobsPanel.tsx`/`JobsPanel.test.tsx`/`LiveRun.tsx` are done; no blockers for Plan 02 (`ActiveAgentsPanel` deletion) or Plan 03 (checkpoint).
- Plan 03's checkpoint should specifically eyeball the trailing timestamp cluster per the flag above.
- `git diff --name-only` for this plan's own changes is exactly `src/components/JobsPanel.tsx`, `src/pages/LiveRun.tsx` (plus new `src/components/JobsPanel.test.tsx`) — no file under `convex/`, `src/hooks/`, or `src/components/StatusBadge.tsx` was touched, matching the plan's threat-model disposition (subtraction-only, no new trust boundary).

---
*Phase: 111-mission-board*
*Completed: 2026-08-11*

## Self-Check: PASSED

- FOUND: src/components/JobsPanel.tsx
- FOUND: src/components/JobsPanel.test.tsx
- FOUND: src/pages/LiveRun.tsx
- FOUND: .planning/phases/111-mission-board/111-01-SUMMARY.md
- FOUND commit: 476155f0 (Task 1)
- FOUND commit: 39ef99ea (Task 2)
- FOUND commit: 14658112 (Task 3)
- FOUND commit: f311d04a (SUMMARY.md commit)
