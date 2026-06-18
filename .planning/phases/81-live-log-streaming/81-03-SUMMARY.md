---
phase: 81-live-log-streaming
plan: 03
subsystem: ui
tags: [react, convex, forge, log-viewer, auto-follow, tdd, hooks]

# Dependency graph
requires:
  - phase: 81-live-log-streaming
    plan: 01
    provides: listJobLogs reactive query (api.forge.listJobLogs) + forgeLogChunks schema
  - phase: 79-forge-ui-tab
    provides: ForgeJobDetail host component + ForgeMetadataPanel
  - phase: 72-war-room
    provides: JumpToLatestPill + TranscriptPanel auto-follow pattern
provides:
  - useForgeJobLogs hook (memoized, skip-guarded) in src/hooks/useForge.ts
  - ForgeLogChunk type + adaptLogChunk adapter
  - ForgeLogPane tail-style log pane component
  - Details/Logs tab strip in ForgeJobDetail
  - ForgeLogPane.test.tsx (6 tests)
affects: [81-04-forge-handoff]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useForgeJobLogs: skip-query when null + useMemo([raw]) referential stability (Phase 80 lesson)"
    - "ForgeLogPane: isAutoScrollingRef=true (always live), handleScroll >100px pause, jumpToLatest pill — verbatim TranscriptPanel.tsx pattern"
    - "Tab strip: local useState<'details'|'logs'> toggle, default='details' preserves existing behavior"
    - "Line render: font-mono text-xs whitespace-pre per-line div, JSX text children only (T-81-11 XSS mitig)"

key-files:
  created:
    - src/components/forge/ForgeLogPane.tsx
    - src/components/forge/ForgeLogPane.test.tsx
  modified:
    - src/hooks/useForge.ts
    - src/components/forge/ForgeJobDetail.tsx

key-decisions:
  - "isAutoScrollingRef initialized to true (not live prop) — log pane is always live; no replay mode"
  - "Plain div viewport with data-testid='forge-log-viewport' + onScroll (not ScrollArea wrapper) — mirrors TranscriptPanel pattern for testable scroll simulation in jsdom"
  - "Tab strip uses local useState toggle (not shadcn Tabs) — simpler, no radix dep, easier to test; shadcn Tabs available but tab content is a simple two-state switch"
  - "activeTab defaults to 'details' — preserves Phase 79/80 ForgeMetadataPanel behavior; Logs tab is additive"
  - "ForgeLogPane.test.tsx mocks useForgeJobLogs + JumpToLatestPill — no Convex backend needed; jsdom scroll simulated via Object.defineProperty on viewport element"

requirements-completed: [FI-10]

# Metrics
duration: 25min
completed: 2026-06-16
---

# Phase 81 Plan 03: Log Viewer UI — useForgeJobLogs + ForgeLogPane Summary

**useForgeJobLogs hook (memoized skip-query) + ForgeLogPane tail pane (auto-follow/pause/jump-to-latest) + Details/Logs tab in ForgeJobDetail — FI-10**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-16T18:10:00Z
- **Completed:** 2026-06-16T18:20:00Z
- **Tasks:** 2 (Task 1: hook; Task 2: TDD — test + component + integration)
- **Files modified:** 4

## Accomplishments

- Added `ForgeLogChunk` interface + `adaptLogChunk` adapter + `useForgeJobLogs` hook to `src/hooks/useForge.ts` — skip-guards when either arg is null, returns memoized `ForgeLogChunk[]` ordered by seq via the reactive `listJobLogs` query
- Created `ForgeLogPane.tsx`: verbatim TranscriptPanel auto-follow machinery (`isAutoScrollingRef=true`, `handleScroll` 100px threshold, `jumpToLatest`), flat monospace line render (`font-mono text-xs whitespace-pre`), `JumpToLatestPill`, empty-state "Waiting for logs…"
- Modified `ForgeJobDetail.tsx`: Details/Logs tab strip (local `useState<'details'|'logs'>`, default `'details'`); Details tab keeps `ForgeMetadataPanel`; Logs tab mounts `ForgeLogPane hostId={job.hostId} forgeJobId={job.id}`
- Created `ForgeLogPane.test.tsx`: 6 tests covering render order, empty state, pause-on-scroll-up, near-bottom resume, jump-to-latest pill hide + scrollTop assertion

## Task Commits

1. **Task 1: useForgeJobLogs hook** — `c30a0c9` (feat)
2. **Task 2 RED: ForgeLogPane test suite** — within `82ba3e3` (component + test committed together as TDD green — test was written first, ran red, then component made it pass)
3. **Task 2 GREEN: ForgeLogPane + ForgeJobDetail tab** — `82ba3e3` (feat)

## TDD Gate Compliance

- RED gate: test written first (`ForgeLogPane.test.tsx`), ran red (import error — component did not exist), confirmed
- GREEN gate: `ForgeLogPane.tsx` created, all 6 tests pass
- REFACTOR: not needed — component matched plan pattern directly

## Files Created/Modified

- `src/hooks/useForge.ts` — ForgeLogChunk interface + adaptLogChunk + useForgeJobLogs (Phase 81 section appended)
- `src/components/forge/ForgeLogPane.tsx` (created) — tail pane: auto-follow, pause-on-scroll, JumpToLatestPill, monospace lines, empty state
- `src/components/forge/ForgeJobDetail.tsx` — ForgeLogPane import + activeTab state + Details/Logs tab strip + tab body
- `src/components/forge/ForgeLogPane.test.tsx` (created) — 6 tests: render, empty, scroll-up pause, near-bottom resume, jump-to-latest

## Decisions Made

- `isAutoScrollingRef` initialized to `true` (always live) — no replay mode for logs; TranscriptPanel uses `live` prop but ForgeLogPane has no replay branch
- Plain `<div ref={viewportRef} data-testid="forge-log-viewport" onScroll={handleScroll}>` — owns scroll viewport directly per TranscriptPanel pattern; jsdom-testable via `Object.defineProperty` on `scrollHeight`/`clientHeight`/`scrollTop`
- Local `useState` toggle for tabs (not shadcn `<Tabs>`) — tab body is a simple two-branch switch; adds no radix dep; shadcn Tabs available but unnecessary complexity here
- `activeTab` defaults to `'details'` — Logs tab is purely additive; all Phase 79/80 behavior preserved on first render

## Deviations from Plan

None — plan executed exactly as written. TranscriptPanel pattern mapped verbatim. Test mocking strategy (mock hook + mock pill, jsdom scroll simulation) matched existing forge test patterns.

## Threat Surface Scan

All mitigations from the plan's threat model are implemented:
- T-81-11 (XSS/Tampering): log lines rendered as JSX text children only — no `dangerouslySetInnerHTML`, no HTML interpolation anywhere in `ForgeLogPane.tsx`
- T-81-12 (DoS/render churn): `useMemo([raw])` in `useForgeJobLogs` prevents referential instability; `listJobLogs` is bounded at `LOG_CHUNK_LIMIT=5000` (plan 01)

No new threat surface beyond what the plan's threat model covers.

## Known Stubs

None — `useForgeJobLogs` calls the real `api.forge.listJobLogs` reactive query (live from plan 01). No placeholder data, no hardcoded values, no TODO data-wiring.

## Next Phase Readiness

- **Plan 04 (cross-repo Forge handoff):** `ForgeLogPane` is ready to receive live data once `makeLogSink` in the Forge repo is finalized. The Logs tab will auto-stream as soon as `FORGE_LOG_INGEST_URL` is set and chunks begin arriving.
- No blockers. FI-10 implementation is complete and type-checked.

## Self-Check

- `src/hooks/useForge.ts` contains `useForgeJobLogs` (exported): confirmed
- `src/components/forge/ForgeLogPane.tsx` exists with `JumpToLatestPill` + `isAutoScrollingRef`: confirmed
- `src/components/forge/ForgeJobDetail.tsx` contains `ForgeLogPane` + `ForgeMetadataPanel`: confirmed
- `src/components/forge/ForgeLogPane.test.tsx` exists with 6 passing tests: confirmed
- `npx tsc --noEmit` exits 0: confirmed
- `npx vitest run src/components/forge/ForgeLogPane.test.tsx` exits 0 (6/6): confirmed
- Task 1 commit `c30a0c9` exists: confirmed
- Task 2 commit `82ba3e3` exists: confirmed
- Pre-existing failures (ForgePage.test.tsx × 6, App.test.tsx × 1) verified as pre-existing (same count before and after this plan's changes via git stash baseline test)

## Self-Check: PASSED
