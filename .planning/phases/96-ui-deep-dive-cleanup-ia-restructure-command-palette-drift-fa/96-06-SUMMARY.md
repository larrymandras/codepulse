---
phase: 96-ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa
plan: 06
subsystem: ui
tags: [react, honesty-first-telemetry, PageHeader, convex]

# Dependency graph
requires:
  - phase: 96 (wave 1, plan 01)
    provides: src/components/PageHeader.tsx (shared header primitive)
provides:
  - Security.tsx with no fabricated "Chain integrity: Valid" badge, honest "N events loaded" audit label, Provider Allowlist placeholder removed (Network Access Log preserved)
  - Automation.tsx "Configured Schedules" metric computed from CRON_SCHEDULES.length (no `?? 12` fallback), no fake `enabled: true` live cron indicator
  - CronJobList.tsx generalized to hide the live ACTIVE/DISABLED Switch+Badge when `enabled` is not explicitly known (undefined)
  - Infrastructure.tsx with the empty Network Policy placeholder and two unused vars removed
  - All three pages (Security, Automation, Infrastructure) standardized on <PageHeader>
affects: [96-07, 96-08, any future plan touching Security/Automation/Infrastructure/CronJobList]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Honesty-first telemetry: a component/data point that cannot be backed by real state renders NOTHING (undefined prop, hidden UI) rather than a hardcoded 'looks live' value"
    - "CronJobList `enabled?: boolean` now three-state: true/false render the live Switch+Badge, undefined hides both — callers without real per-item state simply omit the prop"

key-files:
  created:
    - src/pages/__tests__/Security.test.tsx
    - src/pages/__tests__/Automation.test.tsx
  modified:
    - src/pages/Security.tsx
    - src/pages/Automation.tsx
    - src/pages/Infrastructure.tsx
    - src/components/CronJobList.tsx

key-decisions:
  - "CronJobList.tsx modified (not in original files_modified list) to actually suppress the fake ACTIVE/DISABLED badge for the static cron catalog — dropping only the `enabled: true` literal from Automation.tsx would have left the child component's `!== false` default still rendering a fabricated ACTIVE badge, which fails the UI-SPEC requirement ('Drop enabled: true badges')."
  - "Test mock relative paths to convex/_generated/api use one extra '..' than the page files' own imports (verified via node path.resolve) — required so vi.mock's per-ref switch (rlsStats vs hitlStats vs recentEvents, etc.) actually intercepts the real resolved module instead of silently no-op'ing."
  - "Radix TabsTrigger requires fireEvent.mouseDown + mouseUp before fireEvent.click in jsdom to flip aria-selected — a bare click alone does not switch tabs (confirmed via isolated debug test before writing the Network Policy tab assertion)."

requirements-completed: [F4, D-05, D-06, D-07, F7, F9, D-10]

# Metrics
duration: ~20min
completed: 2026-07-13
---

# Phase 96 Plan 06: Security/Automation/Infrastructure Honesty + Header Cleanup Summary

**Removed three fabricated trust signals (Security's hardcoded "Valid" audit badge, Automation's `?? 12` cron-count fallback and fake `enabled: true` live badges, Infrastructure's empty Network Policy placeholder) and standardized all three pages on `<PageHeader>`.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 (RED test task, GREEN implementation task)
- **Files modified:** 6 (4 source files touched, 2 test files created)

## Accomplishments
- Security.tsx no longer claims a hardcoded "Valid" audit-chain integrity status; the entry count is now honestly labeled "{n} events loaded" instead of masquerading as an integrity proxy
- Security.tsx's empty "Provider Allowlist" placeholder removed from the Network Policy tab; the live, Convex-backed Network Access Log sub-block is untouched
- Automation.tsx's "Cron Jobs" metric (`summary?.totalJobs ?? 12`) replaced with an honest "Configured Schedules" metric computed directly from `CRON_SCHEDULES.length`
- Automation.tsx's static cron catalog no longer hardcodes `enabled: true`; `CronJobList.tsx` was generalized to hide the Switch + ACTIVE/DISABLED badge entirely when the enabled state is genuinely unknown, rather than defaulting to a fabricated "ACTIVE" claim
- Infrastructure.tsx's empty "Network Policy" placeholder section removed, along with the two dead `_lastDockerStatus`/`_lastMcpStatus` state variables (WS handlers now only trigger the live-flash indicator)
- Security, Automation, and Infrastructure all migrated from bespoke `<h1 className="text-2xl font-bold">` headers to the shared `<PageHeader>` component

## Task Commits

1. **Task 1: RED regression tests for F4 honesty (Security + Automation)** - `4867fe2` (test)
2. **Task 2: Apply F4 honesty fixes + headers (GREEN)** - `0e8de8b` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/pages/__tests__/Security.test.tsx` - RED-then-GREEN regression tests for the audit-chain honesty and Network Policy tab behaviors
- `src/pages/__tests__/Automation.test.tsx` - RED-then-GREEN regression tests for the Configured Schedules metric and no-fake-enabled-badge behavior
- `src/pages/Security.tsx` - removed "Valid" badge + relabeled entry count; removed Provider Allowlist placeholder; migrated header to PageHeader
- `src/pages/Automation.tsx` - replaced `?? 12` fallback with `CRON_SCHEDULES.length`; dropped hardcoded `enabled: true`; migrated header to PageHeader
- `src/pages/Infrastructure.tsx` - removed Network Policy placeholder section; removed unused `_lastDockerStatus`/`_lastMcpStatus`; migrated header to PageHeader
- `src/components/CronJobList.tsx` - Switch + StatusBadge only render when `job.enabled !== undefined`

## Decisions Made
- Modified `src/components/CronJobList.tsx` even though it wasn't in the plan's `files_modified` list — necessary to actually suppress the fake live badge (see key-decisions above for full rationale). Scoped to a single conditional branch; no other behavior changed.
- Test mocks for `convex/_generated/api` use `"../../../convex/_generated/api"` (one extra `..` vs. the 2-dot path used inside the page files themselves) since the test files live one directory deeper (`src/pages/__tests__/`) — verified this resolves to the identical absolute module via `node path.resolve` before relying on it, following the existing `Skills.test.tsx` precedent (`Inbox.test.tsx`'s 2-dot mock only worked incidentally because it never branched on the ref).
- Radix `TabsTrigger` needs `fireEvent.mouseDown` + `fireEvent.mouseUp` before `fireEvent.click` to flip `aria-selected` in jsdom — confirmed via an isolated debug test before finalizing the Network Policy tab assertion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CronJobList.tsx modified to actually hide the fake live indicator**
- **Found during:** Task 2 (Apply F4 honesty fixes)
- **Issue:** The plan's file list covered only the three page files. Dropping the `enabled: true` literal from `Automation.tsx`'s `schedulesToCronJobs()` alone left `CronJobList.tsx`'s `job.enabled !== false` default still rendering an ACTIVE Switch+Badge for every entry (since `undefined !== false` is `true`) — the exact fabricated trust signal D-06/UI-SPEC required removed.
- **Fix:** Changed `CronJobList.tsx` to only render the Switch + StatusBadge when `job.enabled !== undefined`; static-catalog callers that omit `enabled` now correctly show no live indicator at all (Play trigger button remains functional).
- **Files modified:** `src/components/CronJobList.tsx`
- **Verification:** `Automation.test.tsx`'s "no fake enabled live badge" test (ACTIVE/DISABLED absent, zero `role="switch"` elements) — RED before this change, GREEN after; full `npx vitest run` (1717 passed) and `npx tsc --noEmit` clean afterward.
- **Committed in:** `0e8de8b` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix, mitigating the exact trust-signal threat T-96-06-01 the plan targeted)
**Impact on plan:** Necessary to satisfy the plan's own UI-SPEC requirement ("Drop `enabled: true` badges") and the threat model's `mitigate` disposition on T-96-06-01. No scope creep beyond that single conditional.

## Issues Encountered
- Radix `TabsTrigger` did not respond to a bare `fireEvent.click` in jsdom (verified via an isolated debug test: `aria-selected` stayed `"false"` after click). Resolved by firing `mouseDown` + `mouseUp` immediately before `click`, which correctly flips the active tab. Documented as a project-level testing pattern in the Security test file's own comment for future test authors touching Radix Tabs.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Security, Automation, and Infrastructure are now free of every fabricated/hardcoded trust signal identified in FINDINGS.md for this plan, and standardized on `<PageHeader>`.
- `CronJobList`'s `enabled?: boolean` three-state contract (true/false/undefined) is now the pattern any future page adding a similar static-catalog list should follow instead of re-introducing a hardcoded `true`.
- No blockers for subsequent 96-xx plans.

---
*Phase: 96-ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa*
*Completed: 2026-07-13*

## Self-Check: PASSED

All created/modified files verified present on disk; both task commits (`4867fe2` test, `0e8de8b` feat) verified present in git log.
