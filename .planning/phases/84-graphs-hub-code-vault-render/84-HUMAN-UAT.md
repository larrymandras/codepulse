---
status: partial
phase: 84-graphs-hub-code-vault-render
source: [84-VERIFICATION.md]
started: 2026-06-22T00:00:00Z
updated: 2026-06-22T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Route loads
expected: Navigating to `/graphs` (npm run dev + live Convex backend) renders the three summary tiles + CodeVaultGraph hero with no console errors.
result: [pending]

### 2. CommandPalette registration
expected: "Graphs Hub" appears in the CommandPalette after the placeholder removal — selecting it navigates to `/graphs`.
result: [pending]

### 3. Tile click-through
expected: Clicking each MetricCard tile navigates to its target route (KG Explorer / Tool Galaxy / MCP Inventory).
result: [pending]

### 4. Canvas palette
expected: Force graph renders code nodes in emerald (#10b981) and vault nodes in violet (#8b5cf6).
result: [pending]

### 5. Stale badge
expected: Amber "stale" badge appears when the snapshot's generatedAt is older than 36 hours.
result: [pending]

### 6. Node detail panel
expected: Clicking a node opens the detail panel (id/label/type/source/community/neighbors); the X button and background click both close it.
result: [pending]

### 7. Fullscreen ESC
expected: Expanding to fullscreen then pressing Escape collapses the overlay.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
