---
phase: 69-sdk-spend-guard-multi-provider-ux
plan: 03
subsystem: ui
tags: [react, convex, dnd-kit, provider-controls, settings, gateway]

# Dependency graph
requires:
  - phase: 69-01
    provides: convex/providerConfig.ts, convex/seedGateway.ts, src/lib/providers.ts
provides:
  - ProviderControls component with drag-to-reorder and enable/disable toggles
  - useProviderConfig hook wrapping Convex providerConfig CRUD
  - Settings page Gateway Providers section

affects: [future-gateway-plans, settings-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "@dnd-kit/sortable useSortable pattern for provider priority reordering"
    - "Persist to Convex before gateway command for restart recovery (D-07)"
    - "Gateway offline toast warning when isConnected is false"

key-files:
  created:
    - src/hooks/useProviderConfig.ts
    - src/components/ProviderControls.tsx
  modified:
    - src/components/ProviderControls.test.tsx
    - src/pages/Settings.tsx

key-decisions:
  - "Persist setEnabled to Convex before dispatching gateway command — Convex is source of truth for restart recovery (D-07)"
  - "Show Gateway offline toast when isConnected=false rather than blocking toggle — operator can still persist config"
  - "orderedProviders initialized from GATEWAY_PROVIDERS and synced from Convex configs via useEffect"

patterns-established:
  - "useProviderConfig: thin Convex hook pattern — configs/setEnabled/setPriority"
  - "SortableProvider: self-contained sortable row with useSortable, toggle, billing badge, color dot"

requirements-completed: [GW-13]

# Metrics
duration: 25min
completed: 2026-05-23
---

# Phase 69 Plan 03: Provider Controls UI Summary

**ProviderControls panel with @dnd-kit drag-to-reorder, per-provider enable/disable sending gateway.provider.set_enabled, Convex persistence for restart recovery, and Seed Gateway Defaults button — integrated into Settings page**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-23T14:10:00Z
- **Completed:** 2026-05-23T14:35:09Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- useProviderConfig hook wraps Convex providerConfig.list/setEnabled/setPriority queries and mutations
- ProviderControls component: SortableProvider rows with GripVertical drag handles, billing badge, color dot, enable/disable toggle, and loading spinner per provider
- Enable/disable flow: persists to Convex first (D-07), then sends gateway.provider.set_enabled command (D-04), warns operator if gateway is offline
- Seed Gateway Defaults button shown when providerConfig is empty — triggers runSeed mutation
- Settings page: Gateway Providers section inserted before Notification Channels inside SectionErrorBoundary
- All 3 Vitest tests passing; TypeScript type check clean

## Task Commits

1. **Task 1: Create useProviderConfig hook and ProviderControls component** - `b63f240` (feat)
2. **Task 2: Wire ProviderControls into Settings page** - `d47f623` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/hooks/useProviderConfig.ts` - Convex hook for providerConfig list/setEnabled/setPriority
- `src/components/ProviderControls.tsx` - Provider management panel with drag-to-reorder, toggles, seed button
- `src/components/ProviderControls.test.tsx` - Tests: heading, seed button, drag handles per provider
- `src/pages/Settings.tsx` - Added Gateway Providers section with ProviderControls

## Decisions Made

- Persist setEnabled to Convex before dispatching gateway command (D-07 first, then D-04) — ensures config survives gateway restart
- Show "Gateway offline -- setting saved, will apply on reconnect" toast when isConnected=false rather than blocking the toggle
- orderedProviders local state initialized from GATEWAY_PROVIDERS, synced via useEffect when Convex configs load

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed require() in test to vi.mocked() for ESM compatibility**
- **Found during:** Task 1 (test verification)
- **Issue:** Plan provided test code using `require("../hooks/useProviderConfig")` but Vitest runs in ESM mode — `require()` fails with MODULE_NOT_FOUND on ES modules
- **Fix:** Changed to `import { useProviderConfig }` at top of test file and used `vi.mocked(useProviderConfig).mockReturnValue(...)` in the third test case
- **Files modified:** src/components/ProviderControls.test.tsx
- **Verification:** All 3 tests pass (`npx vitest run src/components/ProviderControls.test.tsx`)
- **Committed in:** b63f240 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in plan-provided test code)
**Impact on plan:** Required for tests to pass in ESM environment. No scope change.

## Issues Encountered

None beyond the ESM/require() test fix documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ProviderControls panel is fully functional on the Settings page
- Operator can enable/disable providers, reorder priority, and seed gateway defaults
- Changes persist to Convex and send real gateway commands when connected
- Ready for Plan 04 if applicable, or Phase 69 verification

## Self-Check

- `src/hooks/useProviderConfig.ts` — exists, exports `useProviderConfig`
- `src/components/ProviderControls.tsx` — exists, exports default ProviderControls
- `src/components/ProviderControls.test.tsx` — 3 tests pass
- `src/pages/Settings.tsx` — contains ProviderControls import and section
- Commits b63f240, d47f623 — verified in git log

## Self-Check: PASSED

---
*Phase: 69-sdk-spend-guard-multi-provider-ux*
*Completed: 2026-05-23*
