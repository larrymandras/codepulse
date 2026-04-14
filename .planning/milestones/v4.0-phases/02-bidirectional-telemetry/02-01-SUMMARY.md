---
phase: 02-bidirectional-telemetry
plan: 01
subsystem: test-infrastructure
tags:
  - wave-0
  - test-stubs
  - css-animation
  - shadcn
dependency_graph:
  requires: []
  provides:
    - useLiveState test stubs (RT-03, RT-04, RT-08)
    - useLiveFlash test stubs (D-03)
    - ConnectionPopover test stubs (RT-02, D-07, D-10, D-11)
    - live-update-pulse CSS animation keyframe
    - shadcn Popover component
  affects:
    - 02-02-PLAN.md (implements hooks covered by these stubs)
    - 02-03-PLAN.md (consumes live-update-pulse via useLiveFlash)
    - 02-04-PLAN.md (consumes ConnectionPopover)
tech_stack:
  added:
    - "@radix-ui/react-popover (via shadcn popover install)"
  patterns:
    - "Wave 0 test.todo stubs — no implementation required for suite to be green"
    - "vi.mock('@/contexts/AstridrWSContext') pattern for WS-dependent hooks"
key_files:
  created:
    - src/hooks/useLiveState.test.ts
    - src/hooks/useLiveFlash.test.ts
    - src/components/ConnectionPopover.test.tsx
    - src/components/ui/popover.tsx
  modified:
    - src/index.css
decisions:
  - "Use oklch(0.205 0 0 / 0.08) hardcoded instead of CSS relative color syntax for live-update-pulse — limited browser support for relative color syntax; hardcoded value matches --primary in dark mode which is sufficient for single-operator dashboard"
metrics:
  duration: ~5 minutes
  completed: 2026-04-13
  tasks_completed: 2
  files_created: 4
  files_modified: 1
---

# Phase 02 Plan 01: Wave 0 Test Stubs + CSS Animation + Popover Summary

Wave 0 Nyquist-compliant test stubs for useLiveState (8 todos), useLiveFlash (5 todos), and ConnectionPopover (6 todos) created with `vi.mock("@/contexts/AstridrWSContext")` pattern; `@keyframes live-update-pulse` and `.live-update-flash` added to index.css; shadcn Popover component installed from registry.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wave 0 test stubs and CSS animation | eea7f3d | src/hooks/useLiveState.test.ts, src/hooks/useLiveFlash.test.ts, src/components/ConnectionPopover.test.tsx, src/index.css |
| 2 | Install shadcn Popover component | 8d6c428 | src/components/ui/popover.tsx |

## Decisions Made

- **Hardcoded oklch value for live-update-pulse:** Used `oklch(0.205 0 0 / 0.08)` instead of the CSS relative color syntax `oklch(from var(--primary) l c h / 0.08)`. Relative color syntax has limited browser support. The hardcoded value matches `--primary` in dark mode, which is sufficient for this single-operator dashboard.

## Deviations from Plan

**1. [Rule 1 - Pre-existing issue] TypeScript errors not introduced by this plan**
- **Found during:** Task 2 verification (`npx tsc --noEmit`)
- **Issue:** Pre-existing errors in `src/hooks/useNavCounts.ts` (wrong arg count) and `src/pages/Ideation.tsx` (type overlap). Confirmed pre-existing by checking against base commit.
- **Fix:** None applied — out of scope (pre-existing, not introduced by this plan)
- **Deferred to:** deferred-items.md

## Known Stubs

All test stubs are intentional Wave 0 infrastructure — `test.todo` is the expected pattern. No unintentional stubs exist. The todo stubs will be implemented in Plans 02-03.

## Threat Flags

No new network endpoints, auth paths, or trust boundary crossings introduced. Test stubs and CSS are read-only additions. shadcn Popover is a UI primitive with no network surface.

## Self-Check: PASSED

- src/hooks/useLiveState.test.ts — FOUND
- src/hooks/useLiveFlash.test.ts — FOUND
- src/components/ConnectionPopover.test.tsx — FOUND
- src/components/ui/popover.tsx — FOUND
- src/index.css contains `@keyframes live-update-pulse` — FOUND
- Commit eea7f3d — FOUND
- Commit 8d6c428 — FOUND
- 19 test todos reported, 0 failures
