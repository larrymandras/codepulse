---
phase: 111-mission-board
plan: 02
subsystem: ui
tags: [react, vitest, chat, mission-board]

# Dependency graph
requires:
  - phase: 111-mission-board (plan 01)
    provides: JobsPanel rewritten as the truthful mission history board (subagentJobs consumer)
provides:
  - ActiveAgentsPanel component and test deleted (component, mount, SectionErrorBoundary wrapper)
  - Chat.tsx cc-left-rail reduced to its single true child, IntelligenceFeedPanel
  - Chat.test.tsx's command-center panel-count assertions repaired from seven to six, mutation-proven
affects: [111-mission-board (plan 03, if any), any future Chat.tsx command-center panel work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Delete-not-re-source for an unfalsifiable UI claim: no feed exists that can honestly back per-agent liveness, so the panel is removed outright rather than pointed at a different query (D-07 resolution, UI-SPEC)."

key-files:
  created: []
  modified:
    - src/pages/Chat.tsx
    - src/pages/Chat.test.tsx

key-decisions:
  - "Corrected the plan's Task 1 file scope: the cc-left-rail explanatory comment at Chat.tsx:1028-1033 references the deleted panel by name in prose (\"(b) Active Agents\", \"Active Agents rendered 13000px+ below the fold\"). The plan's Task 1 action list didn't call this out, but the plan's own acceptance criteria (whole-file `grep -n \"Active Agents\" src/pages/Chat.tsx` returns no matches) requires it, and it is squarely inside D-07's objective (\"repair every downstream reference the deletion exposes\"). Updated the prose only — the CSS classes and load-bearing height caps the comment documents were left byte-identical."

patterns-established: []

requirements-completed: [MISSION-03]

# Metrics
duration: ~5min (active work; two other sessions' commits landed in the same window on this shared checkout)
completed: 2026-08-11
---

# Phase 111 Plan 02: Delete ActiveAgentsPanel Summary

**Deleted the permanently-false "No agents running." panel outright (component + test + mount + boundary) and repaired the six downstream test claims its removal broke, with a mutation-proven RED before the fix.**

## Performance

- **Duration:** ~5 min active work (executed 2026-08-11 ~08:42–08:46 ET; interleaved on `master` with two concurrent sessions — Phase 110-06 and Phase 119/Loom — whose unrelated commits landed between Task 1 and Task 2)
- **Started:** 2026-08-11T08:42:38-04:00 (approx, first read after prior plan's commit)
- **Completed:** 2026-08-11T08:46:29-04:00
- **Tasks:** 2/2
- **Files modified:** 2 modified (`Chat.tsx`, `Chat.test.tsx`), 2 deleted (`ActiveAgentsPanel.tsx`, `ActiveAgentsPanel.test.tsx`)

## Accomplishments
- `ActiveAgentsPanel` — which filtered `subagentJobs` on `status === "running"`, a state the table structurally never receives (`convex/runtimeIngest.ts:594-596` routes terminal-state events only) — is gone: component file, test file, import, mount, and its `SectionErrorBoundary` wrapper all removed in one commit.
- `cc-left-rail` now renders exactly one child, `IntelligenceFeedPanel`, with its own `SectionErrorBoundary`; no empty boundary, placeholder, or coming-soon tile left in its place; the load-bearing height-cap CSS classes on the rail were left untouched.
- `Chat.test.tsx`'s panel-count assertions were repaired end-to-end: the doc comment, the label constant (renamed `SEVEN_PANEL_LABELS` → `COMMAND_CENTER_PANEL_LABELS`, count-free per D-13-adjacent naming discipline), all three usage sites, and all three test titles now say "six" and contain no "ACTIVE AGENTS" / "seven".
- The label array was proven genuinely load-bearing, not decorative: re-adding `"ACTIVE AGENTS"` to it produced a real, captured test failure before being reverted.

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete ActiveAgentsPanel, its test, its import, and its mount plus wrapper (D-07)** - `87dafe30` (feat)
2. **Task 2: Repair Chat.test.tsx's seven-panel claims left behind by the deletion** - `b574e14f` (test)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/components/control-center/ActiveAgentsPanel.tsx` - deleted (73 lines, the unfalsifiable "No agents running." panel)
- `src/components/control-center/ActiveAgentsPanel.test.tsx` - deleted (72 lines, its test)
- `src/pages/Chat.tsx` - removed the `ActiveAgentsPanel` import, its mount + `SectionErrorBoundary` wrapper, and updated the cc-left-rail comment's stale prose reference
- `src/pages/Chat.test.tsx` - doc comment "seven"→"six" + dropped `ActiveAgentsPanel` from the list; `SEVEN_PANEL_LABELS` renamed to `COMMAND_CENTER_PANEL_LABELS` with `"ACTIVE AGENTS"` removed; three usage sites repointed; three test titles "seven"→"six"

## Decisions Made
- Renamed the label constant to a count-free name (`COMMAND_CENTER_PANEL_LABELS`) per the plan's own instruction, so it does not need renaming again the next time a panel count changes.
- Updated the `cc-left-rail` comment's stale "Active Agents" prose references (see Deviations below) rather than leaving them as residue, since the plan's own whole-file grep acceptance criterion for "Active Agents" requires it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking, plan-scope correction] Updated the cc-left-rail comment's stale "Active Agents" prose references**
- **Found during:** Task 1 (deleting the panel and its mount)
- **Issue:** The plan's Task 1 `<action>` block did not list the explanatory comment block at `Chat.tsx:1028-1033` as a file to edit, but that comment names the deleted panel twice in prose ("LEFT RAIL — (a) Intelligence Feed, (b) Active Agents", "without this, Active Agents rendered 13000px+ below the fold"). The plan's own Task 1 acceptance criterion (`grep -n "Active Agents" src/pages/Chat.tsx` returns no matches) cannot pass without touching it, and leaving stale prose naming a deleted component is exactly the kind of downstream residue this plan's objective says to repair.
- **Fix:** Reworded the two prose references to drop "Active Agents" (now "(a) Intelligence Feed." and "the rail's content rendered 13000px+ below the fold"), leaving the rest of the comment — the CSS-class rationale, the `188-14` finding-#2 explanation, all height-cap justifications — byte-identical, and made zero changes to the classes/JSX structure it documents.
- **Files modified:** `src/pages/Chat.tsx` (comment only, no code/class change)
- **Verification:** `grep -n "Active Agents" src/pages/Chat.tsx` returns no matches (whole file); `git diff src/pages/Chat.tsx` shows the `cc-left-rail` `className` line and `data-testid` line unchanged
- **Committed in:** `87dafe30` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking/plan-scope correction)
**Impact on plan:** Necessary to satisfy the plan's own stated acceptance criteria; no scope creep — comment prose only, no CSS/layout change.

## Verification Evidence

**BEFORE/AFTER `SectionErrorBoundary` count in `Chat.tsx`** (Task 1 acceptance criterion — captured before editing):
- Before: `grep -c "SectionErrorBoundary" src/pages/Chat.tsx` → **17**
- After: `grep -c "SectionErrorBoundary" src/pages/Chat.tsx` → **15**
- Delta: exactly 2 fewer (the opening + closing tag pair wrapping the deleted `ActiveAgentsPanel`), matching the acceptance criterion.

**Whole-tree `grep -rn "ActiveAgentsPanel" src/` result (quoted verbatim, run after Task 2):**
```
$ grep -rn "ActiveAgentsPanel" src/
(no output, exit 1)
```

**Whole-tree `grep -rn "ACTIVE AGENTS" src/` result (quoted verbatim):**
```
$ grep -rn "ACTIVE AGENTS" src/
(no output, exit 1)
```

**Task 2 mutation control — run, captured, reverted:**

Re-added `"ACTIVE AGENTS"` to `COMMAND_CENTER_PANEL_LABELS` and ran `npx vitest run src/pages/Chat.test.tsx`. Captured failure output (verbatim, canvas-warning noise stripped):

```
❯ src/pages/Chat.test.tsx (43 tests | 1 failed) 1576ms
   × with the mode ON, the 5-track xl grid (calm sizing intact) + footer band + all six panels render 79ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
FAIL  src/pages/Chat.test.tsx > Chat — command-center layout (188-13, D-18) > with the mode ON, the 5-track xl grid (calm sizing intact) + footer band + all six panels render
TestingLibraryElementError: Unable to find an element with the text: ACTIVE AGENTS. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.
 Test Files  1 failed (1)
      Tests  1 failed | 42 passed (43)
```

This is the mode-ON test the plan named (originally at line ~857, `it("with the mode ON, the 5-track xl grid...")`). The label array is genuinely asserted, not decorative. Reverted the mutation; re-ran and confirmed green (43/43 passed, 0 failed) before proceeding.

**Full verification run (after revert, both tasks complete):**
- `npx tsc --noEmit` → exit 0
- `npx vitest run src/pages/Chat.test.tsx` → 43 passed, 0 failed
- `npx vitest run` (full suite) → 297 test files passed | 17 skipped (314 total), 3943 tests passed | 193 todo (4136 total), 0 failed
- `git status --porcelain` after each commit showed no file under `convex/`, none in `package.json`, and nothing outside this plan's declared scope (`Chat.tsx`, `Chat.test.tsx`, the two deletions) — two files unrelated to this plan (`.planning/STATE.md`, and untracked Loom/Phase-119 files) were present in the working tree throughout from a concurrent session and were never staged or touched by either of this plan's commits.

## Issues Encountered
None beyond the plan-scope correction documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `ActiveAgentsPanel` is fully gone from `src/` (component, test, import, mount, boundary) with no replacement affordance.
- `Chat.test.tsx` asserts six command-center panels under a count-free constant name; the full suite and type check are both green.
- `MissionTimelinePanel`'s mount and `SectionErrorBoundary name="Mission Timeline"` at `Chat.tsx:1124`-ish are untouched (D-13) — confirmed via `grep -c 'SectionErrorBoundary name="Mission Timeline"' src/pages/Chat.tsx` → 1.
- No blockers for the remainder of Phase 111.

---
*Phase: 111-mission-board*
*Completed: 2026-08-11*
