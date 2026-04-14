---
phase: 03-interaction-layer
plan: 02
subsystem: generative-ui-blocks
tags:
  - block-renderer
  - generative-ui
  - approval-flow
  - tdd
dependency_graph:
  requires:
    - 03-01  # GenerativeBlock types from src/types/generative-blocks.ts
  provides:
    - BlockRenderer dispatcher (src/components/BlockRenderer.tsx)
    - MetricBlock, TableBlock, ChartBlock, CodeBlock, ApprovalBlock sub-components
  affects:
    - 03-03  # Agent Chat — will import BlockRenderer for message rendering
    - 03-04  # Insights Chat — will import BlockRenderer for block rendering
tech_stack:
  added: []
  patterns:
    - switch-on-discriminant dispatcher with cast-via-unknown for FallbackBlockData
    - TDD red-green with vitest + @testing-library/react
    - ApprovalBlock state machine: pending → approved | rejected
key_files:
  created:
    - src/components/BlockRenderer.tsx
    - src/components/blocks/MetricBlock.tsx
    - src/components/blocks/TableBlock.tsx
    - src/components/blocks/ChartBlock.tsx
    - src/components/blocks/CodeBlock.tsx
    - src/components/blocks/ApprovalBlock.tsx
  modified:
    - src/components/__tests__/BlockRenderer.test.tsx
    - src/components/__tests__/ApprovalBlock.test.tsx
decisions:
  - Cast via `unknown` in BlockRenderer switch cases to work around FallbackBlockData's `type: string` preventing TypeScript switch narrowing
  - CodeBlock test uses container.querySelector("pre") + textContent check rather than getByText — SyntaxHighlighter splits tokens into separate spans
  - ApprovalBlock is context-free (no AstridrWSContext) — callbacks passed as props from caller
metrics:
  duration: ~12 minutes
  completed_date: "2026-04-13"
  tasks_completed: 2
  files_created: 6
  files_modified: 2
  tests_added: 17
---

# Phase 03 Plan 02: Generative UI Block Rendering System Summary

BlockRenderer dispatcher + 5 block sub-components (metric, table, chart, code/diff, approval) with full TDD coverage — 17 tests pass, tsc clean for plan files.

## What Was Built

### Task 1: BlockRenderer dispatcher and all block sub-components

**`src/components/BlockRenderer.tsx`** — Switch dispatcher on `block.type` routing to 6 specialized renderers plus a `ReactMarkdown` fallback for `"markdown"` type and a JSON code-fence fallback for unknown types (D-06). Exports both named and default.

**`src/components/blocks/MetricBlock.tsx`** — Minimal wrapper around the existing `MetricCard` component. Accepts `{ block: MetricBlockData }`.

**`src/components/blocks/TableBlock.tsx`** — HTML table with `<thead>` / `<tbody>`. Clicking any column header toggles sort (ascending/descending) via local state. Header cells styled uppercase tracking-wide muted, matching Phase 1 SectionHeader pattern.

**`src/components/blocks/ChartBlock.tsx`** — Wraps `FlexBarChart`. Renders optional `block.title` as a 12px uppercase muted label above the chart.

**`src/components/blocks/CodeBlock.tsx`** — Uses `Prism as SyntaxHighlighter` + `oneDark` theme (same as ChatBubble). Code blocks: single panel. Diff blocks: two-panel grid (`Before` / `After` labeled) using the `diff` prop.

**`src/components/blocks/ApprovalBlock.tsx`** — Self-contained state machine (`pending → approved | rejected`). Risk-level left stripe (`border-l-4`) in `--status-error` / `--status-warn` / `--primary`. On approve: calls `onApprove(requestId)`, collapses to "Approved — sent to Ástríðr". On reject: shows inline textarea ("Optional: explain rejection..."), submit calls `onReject(requestId, reason)`, collapses to "Rejected". No WS context dependency — caller provides callbacks.

All 8 BlockRenderer tests pass.

### Task 2: ApprovalBlock tests

**`src/components/__tests__/ApprovalBlock.test.tsx`** — 9 tests replacing `test.todo` stubs:
- Renders action and agentName
- Approve button visible
- Reject button visible ("Reject Request")
- `border-l-4` class present for medium risk
- `border-l-4` class present for high risk
- `onApprove` called with `requestId`
- Collapses to "Approved — sent to Ástríðr" after approve
- Clicking reject shows textarea with correct placeholder
- `onReject` called with `requestId` + reason, collapses to "Rejected"

All 9 tests pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed SyntaxHighlighter token-split assertion in CodeBlock test**
- **Found during:** Task 1 GREEN run
- **Issue:** `getByText(/const x = 1/)` failed because SyntaxHighlighter renders each token (`const`, `x`, `=`, `1`) as separate `<span>` elements — the full string never appears as a single text node.
- **Fix:** Changed assertion to `container.querySelector("pre")` + `pre.textContent` checks for individual tokens. Accurately tests that the rendered `<pre>` contains the code content.
- **Files modified:** `src/components/__tests__/BlockRenderer.test.tsx`
- **Commit:** `21001b4`

**2. [Rule 1 - Bug] Fixed TypeScript switch-narrowing errors in BlockRenderer**
- **Found during:** Task 2 tsc verification
- **Issue:** `FallbackBlockData` has `type: string` (not a string literal), which prevents TypeScript's control-flow narrowing from excluding it in `case "metric"` etc., causing type errors on all block prop assignments.
- **Fix:** Added `const b = block as unknown` before the switch, then cast to the specific concrete type within each case. The switch guard ensures runtime correctness; the cast resolves the static type conflict.
- **Files modified:** `src/components/BlockRenderer.tsx`
- **Commit:** `d2d2f64`

## Security — Threat Model Verification

| Threat ID | Status | Notes |
|-----------|--------|-------|
| T-03-02 | Mitigated | ApprovalBlock receives `requestId` as prop — does not generate it. Caller controls when to render. |
| T-03-03 | Mitigated | Unknown block types use `ReactMarkdown` (JSX-sanitized) + `JSON.stringify` — never `dangerouslySetInnerHTML`. |
| T-03-04 | Accepted | Block content from trusted Ástríðr backend. No additional mitigations applied. |

## Known Stubs

None — all block components are fully wired. No placeholder text or empty data sources.

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns introduced. All components are pure rendering with props.

## Self-Check: PASSED

Files exist:
- src/components/BlockRenderer.tsx — FOUND
- src/components/blocks/MetricBlock.tsx — FOUND
- src/components/blocks/TableBlock.tsx — FOUND
- src/components/blocks/ChartBlock.tsx — FOUND
- src/components/blocks/CodeBlock.tsx — FOUND
- src/components/blocks/ApprovalBlock.tsx — FOUND
- src/components/__tests__/BlockRenderer.test.tsx — FOUND
- src/components/__tests__/ApprovalBlock.test.tsx — FOUND

Commits:
- 21001b4 — feat(03-02): create BlockRenderer dispatcher and all block sub-components
- d2d2f64 — test(03-02): implement ApprovalBlock tests and fix BlockRenderer type casts
