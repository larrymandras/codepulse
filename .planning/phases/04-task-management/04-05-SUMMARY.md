---
phase: 04-task-management
plan: 05
subsystem: automation-ui
tags:
  - cron
  - sheet
  - visual-builder
  - websocket
dependency_graph:
  requires:
    - 04-01
  provides:
    - CronBuilder component with visual frequency presets
    - CronSheet slide-out panel
    - Interactive CronJobList with play/toggle controls
  affects:
    - src/pages/Automation.tsx
    - src/components/CronJobList.tsx
tech_stack:
  added:
    - CronBuilder (new component)
    - CronSheet (new component)
  patterns:
    - TDD RED/GREEN for utility tests and component tests
    - Radix UI Sheet for slide-out panel
    - WS command dispatch pattern (cron.trigger, cron.toggle, cron.create)
key_files:
  created:
    - src/components/CronBuilder.tsx
    - src/components/CronSheet.tsx
  modified:
    - src/lib/__tests__/cronToHuman.test.ts
    - src/components/__tests__/CronBuilder.test.tsx
    - src/components/CronJobList.tsx
    - src/pages/Automation.tsx
decisions:
  - CronJob interface defined in CronJobList.tsx and exported for use in Automation.tsx
  - Static CRON_SCHEDULES converted to CronJob[] shape via schedulesToCronJobs() helper in Automation.tsx
  - Pre-existing Inbox.test.tsx failure and Tasks.tsx TS error out of scope (parallel wave)
metrics:
  duration: ~10 minutes
  completed: 2026-04-13
  tasks_completed: 2
  files_modified: 6
---

# Phase 04 Plan 05: Cron Builder and Interactive Controls Summary

**One-liner:** Visual cron expression builder in slide-out Sheet with live human-readable preview, inline Play/Switch controls in CronJobList, and WS command dispatch wired through Automation page.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement cronToHuman tests and CronBuilder component | bbcf23a | cronToHuman.test.ts, CronBuilder.tsx, CronBuilder.test.tsx |
| 2 | Create CronSheet, upgrade CronJobList, wire Automation page | 38954ba | CronSheet.tsx, CronJobList.tsx, Automation.tsx |

## What Was Built

**CronBuilder.tsx** — Visual cron expression builder with:
- `FrequencyPreset` selector: every_minute / every_hour / every_day / every_week / custom
- Conditional dropdowns (hour, minute, day-of-week) based on frequency selection
- Live derived `expression` using `FREQUENCY_TO_CRON[frequency](h, m, dow)`
- Live `humanReadable` preview via `cronToHuman(expression)`
- Custom mode with raw input and `border-(--destructive)` error styling when invalid
- Monospace expression display with `font-mono text-xs bg-(--muted)`
- Save button disabled when name is empty or expression is invalid (T-04-08 mitigated)
- Detects initial frequency/parts from `initialExpression` prop for edit mode

**CronSheet.tsx** — Slide-out right-side Sheet (w-[400px]) wrapping CronBuilder with dynamic title (Create/Edit), closes on save or cancel.

**CronJobList.tsx** — Upgraded from read-only to interactive:
- New `CronJob` interface (name, expression, enabled?) exported for consumers
- Inline Play button with `<Loader2 className="animate-spin">` spinner during trigger (T-04-09 mitigated via 3s cooldown + disabled state)
- `<Switch checked={job.enabled !== false}>` for enable/disable toggle
- `StatusBadge` showing ACTIVE/DISABLED
- `cronToHuman(job.expression)` human-readable preview per row
- Empty state: "No cron jobs configured" with add-job guidance

**Automation.tsx** — Wired:
- "Add Cron Job" button opening CronSheet with `editJob=null`
- Row click opens CronSheet in edit mode with job data
- `handleTrigger` → `dispatch({ type: "cron.trigger", job_name })` 
- `handleToggle` → `dispatch({ type: "cron.toggle", job_name, enabled })`
- `handleSave` → `dispatch({ type: "cron.create", job_name, expression })`

## Test Results

- `cronToHuman.test.ts`: 8 tests pass (was 8 test.todo stubs)
- `CronBuilder.test.tsx`: 6 tests pass (was 6 test.todo stubs)
- `npx tsc --noEmit`: No errors in plan files (pre-existing Tasks.tsx error in parallel wave, out of scope)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] CronJob type defined and exported**
- **Found during:** Task 2
- **Issue:** CronJobList needed a `CronJob` type but plan didn't specify where to define it
- **Fix:** Defined and exported `CronJob` interface from `CronJobList.tsx`, imported in `Automation.tsx`
- **Files modified:** src/components/CronJobList.tsx, src/pages/Automation.tsx

**2. [Rule 2 - Missing functionality] schedulesToCronJobs() adapter in Automation.tsx**
- **Found during:** Task 2
- **Issue:** Existing `CRON_SCHEDULES` are `CronSchedule[]` with `interval` as human string, not a cron expression; `CronJob` needs `expression` field
- **Fix:** Added `schedulesToCronJobs()` helper that maps static schedules to `CronJob` shape (expression uses interval label as placeholder until WS data is available)
- **Files modified:** src/pages/Automation.tsx

**3. [Rule 1 - Bug] CronBuilder test assertions used getByText causing multiple element matches**
- **Found during:** Task 1 GREEN phase
- **Issue:** "Every minute" text appeared in both SelectItem mock buttons and the preview element
- **Fix:** Changed assertions to use `getByTestId("cron-expression")` and `getByTestId("cron-preview")` with `toHaveTextContent()`
- **Files modified:** src/components/__tests__/CronBuilder.test.tsx

## Known Stubs

**CronJob.expression in schedulesToCronJobs():** The `expression` field in `CronJobList` jobs is populated from `CRON_SCHEDULES[].interval` (human string like "Every 5 min") rather than a real cron expression (e.g., `*/5 * * * *`). This is intentional — the static schedule list predates the WS-driven cron system. A future plan that wires live cron data from the WS/backend will replace this adapter with real expressions. The CronBuilder and CronSheet are fully functional for creating new jobs via WS.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. All WS commands dispatched through existing `useCommandDispatch` hook with existing `sendCommand` infrastructure.

## Self-Check: PASSED

- src/components/CronBuilder.tsx: FOUND
- src/components/CronSheet.tsx: FOUND
- src/components/CronJobList.tsx: FOUND (modified)
- src/pages/Automation.tsx: FOUND (modified)
- Commit bbcf23a: FOUND
- Commit 38954ba: FOUND
