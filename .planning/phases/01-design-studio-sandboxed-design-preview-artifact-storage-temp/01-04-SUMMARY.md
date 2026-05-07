---
phase: 01-design-studio
plan: "04"
subsystem: design-studio
tags: [react, sse, srcdoc, iframe, security, export, streaming]
dependency_graph:
  requires:
    - 01-01  # openDesignApi.ts, openDesignTypes.ts
    - 01-02  # IframeEmbed.tsx (sibling concern)
    - 01-03  # NativeWorkflow shell, SkillPicker, DesignSystemPicker, DiscoveryForm
  provides:
    - DirectionPicker component (step 4)
    - StreamingPreview component with SSE + srcdoc iframe (step 5)
    - ExportPanel component with 5-format download (step 6)
    - NativeWorkflow fully wired — all 6 steps functional
  affects:
    - src/pages/DesignStudio.tsx (renders NativeWorkflow)
tech_stack:
  added: []
  patterns:
    - SSE run consumption via fetch + ReadableStream (no EventSource)
    - srcdoc iframe with sandbox="allow-scripts" (no allow-same-origin)
    - extractArtifact() regex for progressive artifact extraction from SSE token stream
    - JSON-first + markdown fallback direction parsing
    - AbortController cleanup on component unmount for orphaned stream prevention
key_files:
  created:
    - src/components/design-studio/DirectionPicker.tsx
    - src/components/design-studio/StreamingPreview.tsx
    - src/components/design-studio/StreamingPreview.test.tsx
    - src/components/design-studio/ExportPanel.tsx
    - src/components/design-studio/ExportPanel.test.tsx
  modified:
    - src/components/design-studio/NativeWorkflow.tsx
decisions:
  - "extractArtifact() exported from StreamingPreview.tsx for direct unit testability"
  - "scrollIntoView stubbed in test environment (jsdom does not implement it)"
  - "parseDirections() uses JSON-first approach with markdown header fallback and generic 3-direction fallback"
  - "sandbox='allow-scripts' without allow-same-origin enforces T-01-11 srcdoc isolation"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-07"
  tasks_completed: 2
  tasks_total: 2
  files_created: 5
  files_modified: 1
  tests_added: 15
---

# Phase 01 Plan 04: NativeWorkflow Steps 4-6 (DirectionPicker, StreamingPreview, ExportPanel) Summary

DirectionPicker, StreamingPreview (SSE + sandboxed srcdoc iframe), and ExportPanel wired into all 6 NativeWorkflow steps with daemon-driven direction generation per D-03.

## What Was Built

### Task 1: Three New Components + Converted Tests

**DirectionPicker.tsx** — 3-card horizontal grid with loading skeletons. Cards use `role="radio"` with aria-checked, keyword badges via shadcn Badge, and primary/border accent on selection. Loading state shows 3 skeleton cards with animate-pulse.

**StreamingPreview.tsx** — Split-panel layout: left is a streaming log (ScrollArea + mono text), right is a sandboxed srcdoc iframe. SSE stream consumed via `streamRunEvents()` with AbortController cleanup on unmount. `extractArtifact()` regex parses `<artifact>` tag content from accumulated token text and progressively updates the iframe srcDoc. Progress bar approximates completion (capped at 95% during streaming, jumps to 100% on `onDone`).

**ExportPanel.tsx** — 5-format toggle buttons (html/pdf/pptx/zip/md) with blob download via `exportProject()`. Download disabled until projectId available. Error message shown on failure.

**Tests converted from stubs to concrete (15 tests):**
- `StreamingPreview.test.tsx`: extractArtifact behavior (4 tests), sandbox security gate (1 test), SSE consumption (3 tests)
- `ExportPanel.test.tsx`: format selection (3 tests), download behavior (4 tests)

### Task 2: NativeWorkflow Fully Wired

`NativeWorkflow.tsx` updated to replace all 3 placeholder divs with real components. Key additions:

- `generateDirections()`: creates project via `createProject()`, fetches agents, triggers a daemon SSE run with a direction-generation prompt, consumes stream, parses output via `parseDirections()`, sets directions state.
- `parseDirections()`: JSON array extraction first (agent-structured output), markdown header fallback, generic 3-direction fallback if both fail. Directions are display-only (not injected as HTML — T-01-15 mitigated).
- `handleNext()` updated: step 2→3 triggers `generateDirections()` (D-03 compliant), step 3→4 starts design generation run with selected direction context.
- `handleRegenerate()`: re-triggers a new run with the same direction context.
- `canAdvance()` gates: step 3 requires direction selection, step 4 requires `generationComplete`.
- Abandon dialog with `showAbandonDialog` + `pendingTabSwitch` state.

## Verification

- `npx vitest run` — 15/15 tests pass (StreamingPreview + ExportPanel)
- `npx tsc --noEmit` — clean compile, no errors
- `sandbox="allow-scripts"` verified by test — does NOT contain `allow-same-origin` (T-01-11)
- NativeWorkflow imports and renders all three new components
- `createRun` called for direction generation — no hardcoded directions (D-03)
- All 5 export formats present: html, pdf, pptx, zip, md (D-11)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `scrollIntoView` not implemented in jsdom test environment**
- **Found during:** Task 1, running StreamingPreview tests
- **Issue:** The auto-scroll effect in StreamingPreview calls `logEndRef.current?.scrollIntoView({ behavior: "smooth" })`. jsdom does not implement `scrollIntoView`, causing 4 test failures.
- **Fix:** Added `Element.prototype.scrollIntoView = vi.fn()` at top of `StreamingPreview.test.tsx`. Standard jsdom workaround — does not affect production behavior.
- **Files modified:** `src/components/design-studio/StreamingPreview.test.tsx`
- **Commit:** `11564d5`

## Known Stubs

None — all components fully wired with real API calls. Export endpoint path is documented as assumed in `openDesignApi.ts` (per RESEARCH.md A2) — this is a runtime concern, not a stub in the UI code.

## Threat Flags

No new security surface beyond what was planned. T-01-11 mitigation (`sandbox="allow-scripts"` without `allow-same-origin`) confirmed implemented and verified by test.

## Self-Check: PASSED

Files exist:
- src/components/design-studio/DirectionPicker.tsx — FOUND
- src/components/design-studio/StreamingPreview.tsx — FOUND
- src/components/design-studio/ExportPanel.tsx — FOUND
- src/components/design-studio/StreamingPreview.test.tsx — FOUND
- src/components/design-studio/ExportPanel.test.tsx — FOUND
- src/components/design-studio/NativeWorkflow.tsx — FOUND (modified)

Commits exist:
- 11564d5 — Task 1 (DirectionPicker, StreamingPreview, ExportPanel + tests) — FOUND
- 9e1d279 — Task 2 (NativeWorkflow wiring) — FOUND
