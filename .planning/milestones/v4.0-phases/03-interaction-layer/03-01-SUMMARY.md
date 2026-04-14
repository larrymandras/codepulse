---
phase: 03-interaction-layer
plan: 01
subsystem: ui
tags: [typescript, shadcn, cmdk, dagre, vitest, generative-blocks, command-palette]

# Dependency graph
requires: []
provides:
  - GenerativeBlock discriminated union type (metric, table, chart, code, diff, approval, markdown, fallback)
  - RunBlockEvent WebSocket event envelope type
  - Extended ChatMessage type with optional blocks array
  - shadcn Command component primitives (CommandDialog, CommandInput, CommandList, etc.)
  - dagre DAG layout library for Flow tab
  - Wave 0 test stubs for all 6 Phase 3 requirements (IL-01 through IL-06)
affects: [03-02, 03-03, 03-04, 03-05, 03-06, BlockRenderer, CommandPalette, ApprovalBlock, RunTimeline, Inbox, insightsChat]

# Tech tracking
tech-stack:
  added: [cmdk, dagre, @types/dagre, shadcn Command component]
  patterns: [GenerativeBlock discriminated union for Generative UI wire protocol, test.todo Wave 0 stubs for deferred implementation]

key-files:
  created:
    - src/types/generative-blocks.ts
    - src/components/ui/command.tsx
    - src/components/ui/dialog.tsx
    - src/components/__tests__/CommandPalette.test.tsx
    - src/components/__tests__/BlockRenderer.test.tsx
    - src/components/__tests__/ApprovalBlock.test.tsx
    - src/components/__tests__/RunTimeline.test.tsx
    - src/pages/__tests__/Inbox.test.tsx
    - convex/__tests__/insightsChat.test.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Used FallbackBlockData (open index type) so unknown block types render as markdown without crashing per D-06"
  - "ChatMessage content made optional to support blocks-only messages from Generative UI"
  - "shadcn add command auto-installed dialog.tsx as a transitive shadcn dependency — kept both"

patterns-established:
  - "GenerativeBlock: discriminated union with type literal — all consumers switch on .type for exhaustive matching"
  - "Wave 0 stubs: test.todo exclusively, one describe block per component, stubs map 1:1 to IL-XX requirements"

requirements-completed: [IL-01, IL-02, IL-03, IL-04, IL-05, IL-06]

# Metrics
duration: 8min
completed: 2026-04-13
---

# Phase 03 Plan 01: Interaction Layer Foundation Summary

**GenerativeBlock wire protocol types, shadcn Command component, dagre installed, and 46 Wave 0 test stubs covering all 6 Phase 3 requirements**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-13T17:10:00Z
- **Completed:** 2026-04-13T17:12:30Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Defined GenerativeBlock discriminated union (7 concrete types + FallbackBlockData) as the shared wire protocol between Ástríðr WebSocket events and the BlockRenderer
- Installed shadcn Command component (cmdk) and dagre for use in subsequent plans
- Created 46 test.todo stubs across 6 test files, one per Phase 3 requirement (IL-01 through IL-06)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and create GenerativeBlock type definitions** - `df41617` (feat)
2. **Task 2: Create Wave 0 test stubs for all Phase 3 requirements** - `a84e7d5` (test)

## Files Created/Modified

- `src/types/generative-blocks.ts` - GenerativeBlock union, RunBlockEvent envelope, extended ChatMessage
- `src/components/ui/command.tsx` - shadcn Command component primitives (CommandDialog, CommandInput, CommandList, etc.)
- `src/components/ui/dialog.tsx` - shadcn Dialog (transitive shadcn dependency)
- `src/components/__tests__/CommandPalette.test.tsx` - 8 Wave 0 stubs for IL-01
- `src/components/__tests__/BlockRenderer.test.tsx` - 8 Wave 0 stubs for IL-03
- `src/components/__tests__/ApprovalBlock.test.tsx` - 9 Wave 0 stubs for IL-04
- `src/components/__tests__/RunTimeline.test.tsx` - 8 Wave 0 stubs for IL-05
- `src/pages/__tests__/Inbox.test.tsx` - 8 Wave 0 stubs for IL-02
- `convex/__tests__/insightsChat.test.ts` - 5 Wave 0 stubs for IL-06
- `package.json` - Added cmdk (transitive), dagre, @types/dagre
- `package-lock.json` - Updated lockfile

## Decisions Made

- Used `FallbackBlockData` with `type: string` and index signature so any unknown block type is accepted by the union — downstream renderers check for known types and fall back to markdown for everything else (D-06).
- `ChatMessage.content` changed from required `string` to optional `string` so messages can carry blocks without a text body.
- `shadcn add command` automatically generated `dialog.tsx` as a dependency — kept both since Dialog will be needed by subsequent plans.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in `src/hooks/useNavCounts.ts` and `src/pages/Ideation.tsx` were present before this plan and are out of scope. The new `generative-blocks.ts` type file introduced zero TypeScript errors.

## Known Stubs

All 6 test files contain only `test.todo` stubs by design (Wave 0 pattern). These stubs are intentional scaffolding — implementations arrive in Plans 02–06 when the corresponding components are built.

## Threat Flags

None — Wave 0 plan contains no runtime code, only type definitions, dependencies, and test stubs.

## Next Phase Readiness

- Plans 02–06 can now import `GenerativeBlock` from `@/types/generative-blocks`
- Command component available for CommandPalette implementation (Plan 02)
- dagre available for Flow tab implementation
- All test stubs exist and ready to be filled in as components are built

---
*Phase: 03-interaction-layer*
*Completed: 2026-04-13*
