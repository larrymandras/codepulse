---
phase: 96-ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa
plan: 02
subsystem: ui
tags: [react, convex, navigation, telemetry, dashboard-layout]

# Dependency graph
requires: []
provides:
  - Restructured navGroups (CONSOLE cluster dissolved into COMMAND/OBSERVE)
  - Honest header telemetry (real CPU + WS ping-RTT latency, hidden when absent)
  - iconComponents exported from DashboardLayout for CommandPalette icon resolution
affects: [96-05-command-palette-icon-resolution]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Header telemetry render-guard: `showX = value != null` per field, never `?? 0` / whole-object ternary / placeholder dash"
    - "WS ping-RTT lifted verbatim from ConnectionPopover.tsx (30s interval, only while status==='connected')"

key-files:
  created: []
  modified:
    - src/layouts/DashboardLayout.tsx
    - src/layouts/__tests__/DashboardLayout.test.tsx

key-decisions:
  - "CONSOLE group deleted entirely rather than renamed — Forge joins COMMAND (operator action surface), Executions/Build join OBSERVE (read-only monitoring), matching D-03's operational-vs-observational split"
  - "LAT measurement re-implemented in DashboardLayout (not imported from ConnectionPopover) since ConnectionPopover's ping logic is a private in-component effect, not an exported hook — duplicated the pattern per the plan's interface spec rather than extracting a shared hook (out of scope for this plan)"

patterns-established:
  - "Test file rendering DashboardLayout mocks every heavy child (CommandPalette, wake-word, audio, notifications, avatar upload) as a no-op stub plus convex/react + AstridrWSContext, scoping the test to the header telemetry contract only"

requirements-completed: [F1, D-03, F3, D-04, F2]

# Metrics
duration: 5min
completed: 2026-07-13
---

# Phase 96 Plan 02: IA Restructure + Honest Header Telemetry Summary

**Dissolved the duplicate CONSOLE nav cluster (Forge→COMMAND, Executions/Build→OBSERVE), replaced fabricated `SYS: 14%` / `LAT: 12ms` header literals with real Convex `systemResources.current` + WS ping-RTT data that hides per-field when absent, and exported `iconComponents` for CommandPalette.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-13T10:29:55-04:00
- **Completed:** 2026-07-13T10:34:15-04:00
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments
- CONSOLE nav cluster removed: Forge now lives in COMMAND, Executions/Build now live in OBSERVE, duplicate `/live-run` entry gone (verified `grep -c 'group: "CONSOLE"'` → 0, `grep -c '"/live-run"'` → 1)
- Header SYS/LAT readouts are now honest — real `api.systemResources.current` CPU value and a real WS round-trip latency (lifted from `ConnectionPopover.tsx`'s ping pattern), each hidden entirely (not "—", not "0") when its data is unavailable
- `iconComponents` exported alongside `navItems` so Plan 05 (CommandPalette icon resolution) has what it needs

## Task Commits

Each task was committed atomically:

1. **Task 1: Dissolve CONSOLE cluster + export iconComponents** - `bfbe43e` (feat)
2. **Task 2: Wire real header telemetry (SYS real/hidden, LAT via WS ping) + test** - `051ecd7` (feat)

**Plan metadata:** (this commit, per worktree mode — orchestrator merges STATE.md/ROADMAP.md updates)

## Files Created/Modified
- `src/layouts/DashboardLayout.tsx` - navGroups restructured (CONSOLE dissolved), `iconComponents` exported, header SYS/LAT now driven by `useQuery(api.systemResources.current)` + a lifted WS ping-RTT effect, each field-guarded and hidden when null
- `src/layouts/__tests__/DashboardLayout.test.tsx` - extended from `test.todo` stubs with 3 real tests covering the header telemetry contract (SYS hidden on null, SYS shows rounded cpu, LAT hidden when disconnected)

## Decisions Made
- CONSOLE group deleted rather than renamed/merged — its two live routes (`/executions`, `/build`) are observational, so they join OBSERVE; Forge is an operator action surface, so it joins COMMAND. Mission Control was left untouched in OBSERVE per the plan (Plan 04 owns its disposition).
- The WS ping-RTT measurement was reimplemented directly in `DashboardLayout.tsx` (not imported from `ConnectionPopover.tsx`) because the source pattern is a private in-component `useEffect`, not an exported hook. Extracting a shared `useWsLatency` hook was out of scope for this plan (interface spec only asked to "lift" the pattern); duplication is contained to two files and both mirror the same field-guard rule.
- The header telemetry `<div>` itself is now conditionally rendered (`showSys || showLat`) so an empty telemetry strip doesn't leave a bare border/separator when both fields are absent — a small addition beyond the literal spans but consistent with the "hide entirely" honesty rule (D-04).

## Deviations from Plan

None — plan executed as written. The only judgment calls made (documented above under Decisions Made) were within the plan's own interface guidance, not architectural changes.

## Issues Encountered

None. `npx tsc --noEmit` is clean; `npx vitest run src/layouts/__tests__/DashboardLayout.test.tsx` passes (3 new tests, 6 pre-existing `test.todo` stubs for the sidebar IA left untouched — those cover Plan 96-02's sibling concerns, not this plan's scope).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `iconComponents` export is live and ready for Plan 05 (CommandPalette icon resolution) to consume.
- `navItems` (the deduped flat list CommandPalette already consumes) now reflects the restructured groups automatically — no changes needed on the CommandPalette side for this plan.
- No blockers for dependent plans in this wave.

---
*Phase: 96-ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa*
*Completed: 2026-07-13*

## Self-Check: PASSED

- FOUND: src/layouts/DashboardLayout.tsx
- FOUND: src/layouts/__tests__/DashboardLayout.test.tsx
- FOUND: .planning/phases/96-ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa/96-02-SUMMARY.md
- FOUND: bfbe43e (Task 1 commit)
- FOUND: 051ecd7 (Task 2 commit)
