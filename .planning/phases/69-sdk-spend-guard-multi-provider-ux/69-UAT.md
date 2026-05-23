---
status: diagnosed
phase: 69-sdk-spend-guard-multi-provider-ux
source: [69-01-SUMMARY.md, 69-02-SUMMARY.md, 69-03-SUMMARY.md, 69-04-SUMMARY.md]
started: 2026-05-23T15:15:00Z
updated: 2026-05-23T15:50:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running dev server. Start fresh with `npm run dev`. The app boots without errors in the terminal. Navigate to the Analytics page — it loads without console errors or white screens.
result: pass

### 2. SDK Spend Guard Widget on Analytics
expected: The Analytics page shows an "SDK DAILY CAP" section with a progress gauge bar showing today's spend vs. the $5.00 daily cap (e.g., "$1.23 of $5.00 today"), and an SVG sparkline showing hourly spend buckets for the last 24 hours.
result: pass

### 3. SDK Spend Guard Loading State
expected: On initial page load (or hard refresh of Analytics), a loading skeleton (pulsing gray bars) appears briefly in the SDK Daily Cap area before the real data renders. It should NOT flash "$0.00 of $5.00" before data arrives.
result: pass
note: Diagnosed as NOT A BUG. CR-01 fix correctly applied. Skeleton invisible because CostTrendChart.tsx subscribes to identical Convex query on same page — query dedup makes data available instantly.

### 4. Day-End Spend Projection
expected: If there are 2+ hours of spend data today, a projection row appears below the gauge showing the estimated day-end spend (e.g., "Projected: $3.45 by end of day"). If projected spend exceeds the cap, an inline overshoot warning is visible. If fewer than 2 hours of data exist, no projection row is shown.
result: skipped
reason: Not enough spend data to verify projection

### 5. Gateway Providers on Settings Page
expected: Navigate to Settings. A "Gateway Providers" section is visible showing provider cards (claude-sdk, openai, gemini, deepseek) with drag handles, colored dots, billing type badges, and enable/disable toggles.
result: pass

### 6. Provider Drag-to-Reorder
expected: In the Gateway Providers section, drag a provider card by its grip handle to a new position. The card moves to the new position, and the new order persists on page refresh.
result: issue
reported: "no"
severity: major

### 7. Provider Enable/Disable Toggle
expected: Toggle a provider off in Settings. The toggle visually shows disabled state and a toast confirms the change. Toggle it back on — it re-enables. If the gateway is offline, a toast warns "Gateway offline — setting saved, will apply on reconnect."
result: issue
reported: "no"
severity: major

### 8. Seed Gateway Defaults
expected: If no provider configs exist yet, a "Seed Gateway Defaults" button appears in the Gateway Providers section. Clicking it creates default profiles for all 4 providers. After seeding, the button disappears and the provider cards appear.
result: issue
reported: "after hitting the button, i see the message but it does not go away"
severity: major

### 9. Provider Badges on Session Timeline
expected: Open a session detail page. Each tool call event in the timeline shows a colored provider badge (e.g., "claude-sdk" in blue) matching the PROVIDER_COLORS scheme. Non-tool events (like user messages) do NOT show a provider badge.
result: issue
reported: "no provider badges visible on timeline tool call events"
severity: major

### 10. Provider Badge on Active Sessions
expected: On the main dashboard or sessions list, each session card shows an inline provider badge (e.g., "claude-sdk") next to the session identifier, when the session has a provider field set.
result: issue
reported: "unknown entries showing for sessions without model — user wants muted 'untagged' label instead"
severity: cosmetic

### 11. Routing Decisions Table Upgrades
expected: On the page showing routing decisions, there are "All" and "Fallback only" filter pill buttons. Clicking "Fallback only" filters to only fallback decisions. A "Score" column is visible showing 3-decimal scores (e.g., "0.847"). The table has 6 columns total.
result: skipped
reason: No routing decision data available to verify table columns and Score column; filter pills are present and working

### 12. Budget Cap Save Error Feedback
expected: On the Settings page Intelligence/Budget section, if saving budget settings fails (e.g., network error), a toast error notification appears saying "Failed to save budget cap. Please try again." — not a silent failure.
result: pass

## Summary

total: 12
passed: 5
issues: 5
pending: 0
skipped: 2
blocked: 0

## Gaps

- truth: "Drag provider card to new position, order persists on refresh"
  status: failed
  reason: "User reported: no"
  severity: major
  test: 6
  root_cause: "seedGateway.runSeed never inserts providerConfig rows — UI gates all rendering on configs.length > 0, so provider cards/drag handles never appear"
  artifacts:
    - path: "convex/seedGateway.ts"
      issue: "runSeed schedules seedSDKSpendAlert and seedGatewayProfiles but never seeds providerConfig table"
    - path: "src/components/ProviderControls.tsx"
      issue: "Line 231 gates rendering on configs.length > 0 — correct logic but starved of data"
  missing:
    - "Add seedProviderConfigs internalMutation to seedGateway.ts"
    - "Schedule seedProviderConfigs from runSeed alongside existing seeds"
  debug_session: .planning/debug/provider-controls-cluster.md

- truth: "Toggle provider off/on with visual feedback and toast confirmation"
  status: failed
  reason: "User reported: no"
  severity: major
  test: 7
  root_cause: "Same as gap 6 — providerConfig rows never seeded, so toggle UI never renders"
  artifacts:
    - path: "convex/seedGateway.ts"
      issue: "No providerConfig seed mutation"
  missing:
    - "Same fix as gap 6 — seedProviderConfigs will unblock toggles"
  debug_session: .planning/debug/provider-controls-cluster.md

- truth: "Seed button disappears and provider cards appear after seeding"
  status: failed
  reason: "User reported: after hitting the button, i see the message but it does not go away"
  severity: major
  test: 8
  root_cause: "Same as gap 6 — runSeed succeeds for alerts+profiles but never creates providerConfig rows, so configs.length stays 0 and seed prompt persists"
  artifacts:
    - path: "convex/seedGateway.ts"
      issue: "runSeed never inserts providerConfig rows"
  missing:
    - "Same fix as gap 6 — seedProviderConfigs will populate configs and dismiss seed prompt"
  debug_session: .planning/debug/provider-controls-cluster.md

- truth: "Tool call events show colored provider badges on session timeline"
  status: failed
  reason: "User reported: no provider badges visible on timeline tool call events"
  severity: major
  test: 9
  root_cause: "Ingest pipeline (convex/ingest.ts) never writes provider to toolExecution records — PostToolUse handler omits provider arg, hook payload doesn't include it, so toolExecProviderMap is always empty"
  artifacts:
    - path: "convex/ingest.ts"
      issue: "Lines 138-147: toolExecutions.insert omits provider for PostToolUse events"
    - path: "hooks/codepulse-hook.mjs"
      issue: "Lines 88-96: ingest body built without provider field"
  missing:
    - "Default provider to 'claude-cli' in ingest.ts PostToolUse handler (hook-ingested events are always from Claude Code)"
    - "Pass provider in session upsert for session-level fallback"
  debug_session: .planning/debug/timeline-provider-badges.md

- truth: "Sessions without model show muted 'untagged' label instead of 'unknown'"
  status: failed
  reason: "User reported: unknown entries showing — wants muted 'untagged' label"
  severity: cosmetic
  test: 10
  root_cause: "SessionComparison.tsx line 56 uses session.model ?? 'unknown' with no muted styling. Inconsistent fallbacks across components: ActiveSessions uses 'N/A', SessionHeader uses '—'"
  artifacts:
    - path: "src/components/SessionComparison.tsx"
      issue: "Line 56: session.model ?? 'unknown' — plain text, no muted style"
    - path: "src/components/ActiveSessions.tsx"
      issue: "Line 56: uses 'N/A' fallback, unstyled"
    - path: "src/components/SessionHeader.tsx"
      issue: "Line 36: uses '—' fallback, unstyled"
  missing:
    - "Replace all fallbacks with 'untagged' in muted italic styling (text-muted-foreground italic text-xs)"
    - "Harmonize across SessionComparison, ActiveSessions, SessionHeader"
  debug_session: .planning/debug/unknown-label.md
