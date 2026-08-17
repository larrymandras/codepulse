---
phase: 114-workspace-map-view
plan: 01
subsystem: ui
tags: [react-force-graph, tailwind-tokens, theming, useThemeColors, ForceGraphCanvas]

# Dependency graph
requires:
  - phase: 115-workspace-scanner
    provides: the live `getWorkspaceMap` producer and department vocabulary this phase's later plans consume (not used directly by 114-01 itself)
provides:
  - "ForceGraphCanvas optional cooldownTicks prop (default 120), enabling a physics-off (0-tick) deterministic layout for D-08"
  - "Three department color tokens (--dept-personal / --dept-consulting / --dept-work) declared in :root and all four switcher themes (amber deliberately excluded)"
  - "ThemeColors.mutedForeground / deptPersonal / deptConsulting / deptWork — the department fill channel later Workspace Map plans consume via useThemeColors()"
affects: [114-02, 114-03, 114-workspace-map-view later plans that build WorkspaceMapCanvas/WorkspaceMapPanel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive-only prop extension on a shared canvas component: new optional prop with a default matching prior hardcoded behavior, proven non-breaking via a toBe() control test on the default plus a toBe(0) test on the override"
    - "Token declaration convention: new CSS custom properties placed next to a block's existing --muted-foreground line to read as part of the same semantic group; theme blocks with no --muted-foreground anchor (emerald) get the trio placed at the end of the block instead"

key-files:
  created: []
  modified:
    - src/components/graph/ForceGraphCanvas.tsx
    - src/components/graph/ForceGraphCanvas.test.tsx
    - src/index.css
    - src/hooks/useThemeColors.ts
    - src/hooks/useThemeColors.test.ts

key-decisions:
  - "Emerald's three new tokens were placed at the end of its theme block (next to --vault-node-color) rather than next to --muted-foreground, because emerald has no --muted-foreground declaration at all (a documented pre-existing gap, UI-SPEC § Open items — left untouched per the plan's explicit instruction not to fix it here)."

patterns-established:
  - "cooldownTicks passthrough on ForceGraphCanvas: default 120 for every existing consumer (CodeVaultGraph, KG Explorer), explicit 0 for physics-off deterministic layouts (D-08)."

requirements-completed: []  # design-doc-driven phase, traced to D-06/D-08, not REQ-IDs (Phase 116 precedent)

# Metrics
duration: 13min
completed: 2026-08-14
---

# Phase 114 Plan 01: Shared Substrate (cooldownTicks + department tokens) Summary

**Additive `cooldownTicks` prop on `ForceGraphCanvas` (default 120, explicit 0 pass-through for D-08) plus three department color tokens (`--dept-personal/-consulting/-work`) wired through `:root` and four switcher themes into four new `ThemeColors` fields.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-08-14T12:35:00Z (approx.)
- **Completed:** 2026-08-14T12:47:00Z
- **Tasks:** 3/3
- **Files modified:** 5

## Accomplishments
- `ForceGraphCanvas` accepts an optional `cooldownTicks` prop, backward-compatible (defaults to 120 for `CodeVaultGraph`/KG Explorer), and passes an explicit `0` straight through with a `toBe(0)` test discriminating it from a falsy-default bug.
- `--dept-personal` / `--dept-consulting` / `--dept-work` declared exactly 5 times each in `src/index.css` (`:root`, cyan, emerald, readable, aubergine); `amber` intentionally untouched; no `--dept-unclassified` token added (Unclassified reuses `--muted-foreground` by design).
- `ThemeColors` extended from 12 to 16 fields (`mutedForeground`, `deptPersonal`, `deptConsulting`, `deptWork`), all resolved through the existing `get()` helper inside `resolveThemeColors()` with zero new `getComputedStyle` calls, and proven to re-resolve on a live `data-theme` switch (not just first render).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add an additive cooldownTicks prop to ForceGraphCanvas** - `1429c528` (feat)
2. **Task 2: Declare the three department color tokens across :root and the four switcher themes** - `10647005` (feat)
3. **Task 3: Extend ThemeColors with mutedForeground and the three department fields** - `08135341` (feat)

_No plan-metadata commit yet — this final commit (SUMMARY.md + STATE.md + ROADMAP.md) is created after this document._

## Files Created/Modified
- `src/components/graph/ForceGraphCanvas.tsx` - added optional `cooldownTicks?: number` prop (interface, destructure default 120, JSX pass-through replacing the hardcoded `120` literal)
- `src/components/graph/ForceGraphCanvas.test.tsx` - two new tests: default-120 backward-compatibility control, explicit-0 `toBe(0)` override
- `src/index.css` - three new tokens declared in `:root` + `cyan`/`emerald`/`readable`/`aubergine` theme blocks (15 lines added, zero deletions)
- `src/hooks/useThemeColors.ts` - `ThemeColors` interface + `resolveThemeColors()` gain `mutedForeground`, `deptPersonal`, `deptConsulting`, `deptWork`
- `src/hooks/useThemeColors.test.ts` - cyan/readable token stubs extended with the four new tokens; new test asserts exact string equality on first render (cyan) and after a `data-theme` mutation (readable); "returns all ThemeColors fields" test extended to cover the four new fields

## Decisions Made
- Emerald's trio placed next to `--vault-node-color` (end of block) rather than `--muted-foreground`, since emerald has no `--muted-foreground` declaration to anchor next to — a pre-existing, documented gap (UI-SPEC § "Open items for the planner") that this plan was explicitly instructed not to fix.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Task 3's acceptance criterion grep pattern does not match its own stated intent**
- **Found during:** Task 3 verification
- **Issue:** The plan's acceptance criterion states `grep -c 'getComputedStyle' src/hooks/useThemeColors.ts returns 1 — no second call was added`. Running that grep returns **4**, both before and after this plan's edit — three of the four hits are pre-existing doc-comment prose (lines 8, 35, 41 of the original file) that mention the word `getComputedStyle`, not function calls. This mismatch predates this plan; it was not introduced by Task 3's edit.
- **Fix:** No code fix needed — the actual invariant the criterion is checking for ("no second real call was added") holds. Verified by `grep -n 'getComputedStyle' src/hooks/useThemeColors.ts`: exactly one call site exists, at the line assigning `const style = getComputedStyle(document.documentElement);` (line 46 post-edit, was line 42 pre-edit) — the other three hits are comment text, unchanged by this plan.
- **Files modified:** None (verification-only finding).
- **Verification:** `grep -n` line-by-line read confirms one call site; `resolveThemeColors()`'s body is otherwise unchanged from the pre-existing single-call pattern.
- **Committed in:** N/A — no code change was needed; documented here per the "plan is a draft" instruction so the stale acceptance criterion doesn't get silently re-transcribed as passing when it structurally cannot with a bare `grep -c`.

---

**Total deviations:** 1 documented (0 code changes; a plan acceptance-criterion correction only)
**Impact on plan:** None on functionality — Task 3's actual goal (exactly one `getComputedStyle` call site, all four new fields resolved via the existing `get()` helper) is met and independently verified. The plan's literal `grep -c` acceptance criterion is imprecise (counts comment prose) and should not be reused verbatim in a future phase's acceptance criteria for this file.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `cooldownTicks` is available for the next plan's `WorkspaceMapCanvas` to pass `cooldownTicks={0}` per D-08.
- `useThemeColors().deptPersonal/deptConsulting/deptWork/mutedForeground` are available for the next plan's department `colorFn`; `--dept-unclassified` deliberately does not exist — Unclassified nodes should use `mutedForeground`.
- No blockers. Zero existing consumer's behavior changed — `CodeVaultGraph.test.tsx` (15/15) and the full `ForceGraphCanvas`/`useThemeColors` suites (41/41 combined) pass unchanged; `npm run build` succeeds; `npx tsc --noEmit` is clean.

---
*Phase: 114-workspace-map-view*
*Completed: 2026-08-14*

## Self-Check: PASSED
All 5 modified source files and the SUMMARY.md itself found on disk; all 4 commits (1429c528, 10647005, 08135341, 127d007f) found in git log.
