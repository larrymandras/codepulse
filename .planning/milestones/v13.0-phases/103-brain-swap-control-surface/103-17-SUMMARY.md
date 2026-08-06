---
phase: 103-brain-swap-control-surface
plan: 17
subsystem: ui
tags: [react, convex, brain-swap, global-override, config-derived-state, d-14]

# Dependency graph
requires:
  - phase: 103-brain-swap-control-surface
    provides: "103-12 (single-axis GlobalSwapModal dispatch), 103-16 (selectionNonce reset wiring)"
provides:
  - "GlobalSwapModal's pinned-default count/warning derived from profileConfigs.modelPreferences.primary instead of telemetry mode"
  - "A named GlobalSwapProfile.hasConfiguredDefault/configuredDefault/configuredDefaultDisplayName config signal, decoupled from the telemetry-only mode field"
  - "A regression-tested D-14 boundary proving the current-engine column can never be back-filled from config"
affects: [103-verification, 103-final-live-reverification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Config-derived UI signal kept as a separate typed field alongside an existing telemetry-derived field, rather than overloading or recomputing the telemetry field, to preserve an existing honesty boundary (D-14)"

key-files:
  created: []
  modified:
    - src/components/brains/BrainPicker.tsx
    - src/components/brains/BrainPicker.test.tsx
    - src/components/brains/GlobalSwapModal.tsx
    - src/components/brains/GlobalSwapModal.test.tsx

key-decisions:
  - "Chose option (a): `mode` (GlobalSwapProfileMode) stays exactly telemetry-shaped and unchanged; a wholly separate `hasConfiguredDefault: boolean` (+ `configuredDefault`/`configuredDefaultDisplayName`) drives pinnedCount and the shadowing warning, because `mode` is a pre-existing field with an established telemetry meaning elsewhere and silently redefining it would be a hidden breaking change to that meaning"
  - "The shadowing warning now names the de-duplicated set of configured defaults being shadowed (e.g. '(Sonnet 5)') rather than just a count, satisfying the 'operator can see WHAT is being overridden' requirement without stacking a second confirmation surface"
  - "Pin icon in both the confirm-state row list and the result-phase snapshot list switched from `mode === \"pinned\"` to `hasConfiguredDefault`, since the icon's documented UI-SPEC meaning ('this profile's current value is a pinned default') is a config question, not a telemetry one"

requirements-completed: [BSC-01, BSC-04, BSC-05]

# Metrics
duration: 15min
completed: 2026-07-29
---

# Phase 103 Plan 17: Global-Swap Pinned-Default Count From Config, Not Telemetry Summary

**Closed OBS 8 by splitting `GlobalSwapProfile`'s telemetry-shaped `mode` from a new config-derived `hasConfiguredDefault` signal, so the pre-swap confirm modal's pinned-default count and warning read `profileConfigs.modelPreferences.primary` instead of the (frequently empty, live) `activeEngineSnapshots` telemetry.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-29T19:07:15Z
- **Tasks:** 2/2
- **Files modified:** 4

## Accomplishments
- The "Swap all profiles to X?" confirm modal now reports an accurate pinned-default count and names the configured default(s) a global override would shadow, using each profile's `profileConfigs.modelPreferences.primary` — matching the live 2026-07-29 checkpoint data (3 profiles, each configured, pinnedCount was 0 before this fix).
- The current-engine column stays exactly what it was — telemetry-only, "Auto" when unreported — preserving the D-14 boundary `useActiveEngine.ts`'s docstring documents; a dedicated regression test now guards this boundary and was proven to fail under a real mutation (config back-filling the current column) before being restored.
- `GlobalSwapProfile.mode` is unchanged in meaning; the new `hasConfiguredDefault`/`configuredDefault`/`configuredDefaultDisplayName` fields are additive and independently derived.

## Task Commits

Each task was committed atomically:

1. **Task 1: Derive the pinned default from config, keep the live column live (103-17-T1)** - `24322729` (fix) — `BrainPicker.tsx`, `GlobalSwapModal.tsx`, `GlobalSwapModal.test.tsx`
2. **Task 2: Pin the D-14 boundary with a regression test (103-17-T2)** - `a0570010` (test) — `BrainPicker.test.tsx`

**Plan metadata:** (this commit, made after this SUMMARY)

## Files Created/Modified
- `src/components/brains/BrainPicker.tsx` — `globalSwapProfiles` memo now also derives `hasConfiguredDefault`/`configuredDefault`/`configuredDefaultDisplayName` from `allProfiles[i].modelPreferences?.primary`, alongside the unchanged telemetry-only `currentModel`/`currentModelDisplayName`/`mode`
- `src/components/brains/GlobalSwapModal.tsx` — `pinnedCount`, the shadowing warning (now names the shadowed default(s)), and both `Pin` icon conditions (confirm-state rows, result-phase snapshot rows) switched from `mode === "pinned"` to `hasConfiguredDefault`; `GlobalSwapProfile`/`SnapshotEntry` types extended
- `src/components/brains/GlobalSwapModal.test.tsx` — existing pinned-count fixtures updated to set `hasConfiguredDefault` independently of `mode`; new describe block proves the count/warning are config-derived against the live OBS 8 shape and includes a mutation-check regression guard
- `src/components/brains/BrainPicker.test.tsx` — `useActiveEngine`/`useProfileConfigs` mocks converted to per-test-reassignable `let`s; new describe block against the real `GlobalSwapModal` proves the pinned count, the unconfigured-profile exclusion, and the D-14 boundary (current column and trigger base label both stay "Auto")

## Decisions Made
- **Option (a) chosen** for how `mode` should be computed going forward: `mode` stays exactly telemetry-shaped (unchanged), and a separate `hasConfiguredDefault` boolean drives `pinnedCount`. Rationale: `mode` already has an established meaning elsewhere (it mirrors `ActiveEngine.mode` verbatim per `useActiveEngine.ts`), so redefining it in place would be a silent, hard-to-audit breaking change to that meaning. A new, additively-typed field makes the two concerns (live reading vs. configured default) explicit and independently testable — matching the plan's explicit lower-risk guidance.
- The shadowing warning text changed from `"{n} profile(s) have a pinned default that will be shadowed..."` to `"{n} profile(s) have a pinned default ({names}) that will be shadowed..."`, naming the de-duplicated set of configured default display names being shadowed. This satisfies the plan's "operator can see WHAT is being overridden, not just how many" requirement without introducing a second confirmation surface or per-row name spam.
- Both `Pin` icon usages (confirm-state row list, result-phase snapshot list) were switched to `hasConfiguredDefault` rather than left on `mode`. This wasn't explicitly required by the plan's acceptance criteria, but the icon's own UI-SPEC-documented meaning ("this profile's current value is a pinned default") is unambiguously the config question the modal was getting wrong — leaving the icon on the old telemetry-driven `mode` would have left a second, un-fixed instance of the exact defect OBS 8 reports, immediately adjacent to the fixed warning.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' acceptance criteria are met without needing Rule 1-4 auto-fixes; the two mutation checks required by the plan (Task 1: revert `pinnedCount` to `mode === "pinned"`; Task 2: back-fill the current-engine column from `modelPreferences.primary`) were both performed for real against the live working tree and confirmed to fail the newly added tests, then restored via `cp` from a pre-mutation backup (not `git checkout --`, to avoid touching any other uncommitted state in the shared checkout).

## Issues Encountered

None. `npx tsc --noEmit` was clean throughout (only the two test files under active edit ever showed type errors, and only for the `hasConfiguredDefault` field being temporarily missing from fixtures mid-edit — resolved by the fixture updates themselves).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- This plan closes OBS 8 at the unit-test level. Per this plan's own `<verification>` section and the orchestrator's process, **live re-verification against the running Ástríðr stack is NOT performed by this plan** — a green suite here is evidence the fix is correct against the exact live data shape recorded in `103-VALIDATION.md` (3 profiles, each `modelPreferences.primary = "anthropic/claude-sonnet-5"`, zero `activeEngineSnapshots` rows), but is not itself a live-checkpoint pass. The orchestrator should schedule a live re-check of the "Swap all profiles to X?" modal against the real running instance before marking BSC-01/BSC-04/BSC-05 fully satisfied.
- No blockers for subsequent plans in this phase.

---
*Phase: 103-brain-swap-control-surface*
*Completed: 2026-07-29*

## Self-Check: PASSED

- FOUND: src/components/brains/BrainPicker.tsx
- FOUND: src/components/brains/BrainPicker.test.tsx
- FOUND: src/components/brains/GlobalSwapModal.tsx
- FOUND: src/components/brains/GlobalSwapModal.test.tsx
- FOUND: .planning/phases/103-brain-swap-control-surface/103-17-SUMMARY.md
- FOUND commit: 24322729 (Task 1)
- FOUND commit: a0570010 (Task 2)
