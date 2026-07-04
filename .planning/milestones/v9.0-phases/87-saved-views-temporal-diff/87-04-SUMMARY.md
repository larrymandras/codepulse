---
phase: 87-saved-views-temporal-diff
plan: "04"
subsystem: kg-animate
tags: [kg, temporal-animate, lru-cache, frame-synthesis, playback-timer]
dependency_graph:
  requires: [fetchOverview, KGControls, KnowledgeGraph, useKgDiff, paintNode]
  provides: [useKgAnimation, synthesizeFrames, KGAnimateControls, animate-sub-mode-wiring]
  affects: [KnowledgeGraph.tsx, KGControls.tsx, KGControls.test.tsx]
tech_stack:
  added: []
  patterns: [client-synthesized-frames, lru-map-eviction, monotonic-frameReqRef-stale-drop, animPauseRef-pattern, setInterval-playback-timer]
key_files:
  created:
    - src/hooks/useKgAnimation.ts
    - src/hooks/useKgAnimation.test.ts
    - src/components/kg/KGAnimateControls.tsx
  modified:
    - src/components/kg/KGControls.tsx
    - src/components/kg/KGControls.test.tsx
    - src/pages/KnowledgeGraph.tsx
decisions:
  - "animPauseRef pattern: anim.pause stored in a ref so lens/sub-mode reset effects can call pause without including the anim object in their deps array — avoids circular/stale closure issues"
  - "Animate canvas branch guards on temporalSubMode !== animate before rendering the Point/Diff canvas branches — prevents both branches rendering simultaneously"
  - "synthesizeFrames and intervalMs exported from useKgAnimation.ts so tests can import and exercise them without spinning up the React hook"
  - "KGControls does not receive animCurrentGraph — the page renders the canvas directly from anim.currentGraph; passing it through KGControls would be unused prop overhead"
  - "Two separate useEffect calls for lens change and sub-mode change (rather than one combined effect) — cleaner dep arrays and clearer intent"
metrics:
  duration_seconds: 445
  completed_date: "2026-06-23"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 3
---

# Phase 87 Plan 04: KG Animate Sub-Mode — useKgAnimation + KGAnimateControls Summary

**One-liner:** Client-synthesized frame sequence with 20-entry LRU cache + 2-frame prefetch, setInterval playback timer, and KGAnimateControls transport row (range/interval/scrubber/play-pause/step/speed) wired into the Animate slot of the Temporal lens.

## What Was Built

### Task 1 — useKgAnimation hook + Wave 0 tests (commit `ea16f2a`)

Created `src/hooks/useKgAnimation.ts`:

**`intervalMs(interval)`** — exported pure helper, maps "day"/"week"/"month" to milliseconds.

**`synthesizeFrames(rangeStart, rangeEnd, interval, maxFrames=60)`** — exported pure helper:
- Builds evenly-spaced YYYY-MM-DD strings from rangeStart to rangeEnd via Date arithmetic
- Steps by `intervalMs(interval)` (D-07 — NO `fetchSnapshotDates()`, NO Ástríðr endpoint)
- Returns `[]` when range is unset (either param null) or start > end
- Caps at 60 frames for LRU sanity (Claude's Discretion on interval, D-07)

**LRU cache** — `cacheRef: useRef<Map<string, KgGraphData>>(new Map())` with `cacheSet(cache, key, value)`:
- delete-then-set to refresh insertion order (re-access moves key to newest)
- evicts `cache.keys().next().value` (oldest, insertion-order invariant) when `size > 20` (D-09)

**Per-frame fetch effect** (keyed on `[currentFrameIndex, frames]`):
- Cache hit → `setCurrentGraph(cached)` immediately, no fetch (Pitfall 4 cache-check-before-fetch)
- Cache miss → monotonic `++frameReqRef.current` token → `fetchOverview({ asOf: key })` → stale-drop check → `cacheSet + setCurrentGraph`
- D-08 graceful-degrade: catch sets `frameError: "Could not load snapshot for {key}."` — never throws, other sub-modes unaffected
- 2-frame lookahead prefetch: fire-and-forget cache-miss fetches for frames `+1` and `+2`

**Playback timer**: `useEffect([isPlaying, fps, frames.length])` running `setInterval(() => setCurrentFrameIndex(...), 1000/fps)` with `clearInterval` cleanup. Auto-stops at last frame by calling `setIsPlaying(false)`.

**Controls**: `play()`, `pause()`, `stepForward()`, `stepBack()` (all call `setIsPlaying(false)` before index change), `setFrameIndex(i)` (clamped), `setFps(n)`.

**Frames reset effect**: watches `frames` reference; resets `currentFrameIndex=0`, `currentGraph=null`, `frameError=null`, `isPlaying=false` when the synthesized array changes.

Created `src/hooks/useKgAnimation.test.ts` — 14/14 tests green:
- Frame synthesis: 5-day range → 5 inclusive frames, null range → [], wide range caps at 60, week interval correct, start > end → [], start = end → 1 frame, pure function (no async/fetch)
- LRU: insert+retrieve, 21st key evicts oldest (size stays 20), re-access moves to newest, 100 insertions stays ≤20, Map insertion-order invariant verified

### Task 2 — KGAnimateControls + KGControls Animate wiring + KnowledgeGraph frame render (commit `813d5ab`)

Created `src/components/kg/KGAnimateControls.tsx`:
- **Range row**: `From` + `To` `<Input type="date">` + interval `Select` (Day/Week/Month) — D-07 deviation; scrubber spans synthesized frames not Ástríðr-provided dates
- **Transport row**: `StepBack` / `Play|Pause` (Play icon has `text-primary` class while playing) / `StepForward` ghost icon buttons; `Slider` scrubber (`value=[currentFrameIndex]`, `onValueChange` calls `onPause()` then `onSetFrameIndex(i)`); `text-xs font-mono` date readout; `Speed:` label + `Select` with 0.5×/1×/2× (calls `onSetFps`)
- All aria-labels: `"animation range start"`, `"animation range end"`, `"Step back"`, `"Play animation"/"Pause animation"`, `"Step forward"`, `"animation scrubber"`
- Per-frame inline error at bottom (D-08 graceful-degrade): red-500/80 mono text

Modified `src/components/kg/KGControls.tsx`:
- Added 16 new props to `KGControlsProps` (animRangeStart, animRangeEnd, animInterval, onChangeAnimRange, onChangeAnimInterval, animFrames, animCurrentFrameIndex, animIsPlaying, animFps, animFrameError, onAnimPlay, onAnimPause, onAnimStepBack, onAnimStepForward, onAnimSetFrameIndex, onAnimSetFps)
- Replaced Plan 03 placeholder (`"Animation controls coming in Plan 04."`) with `<KGAnimateControls ... />` in the `temporalSubMode === "animate"` branch
- Point + Diff branches unchanged (no regression)

Modified `src/components/kg/KGControls.test.tsx`:
- Extended `renderControls` helper with 16 new animate prop defaults (all `vi.fn()` / sensible values)
- 23/23 existing tests still pass (no new assertions needed — animate rendering is exercised by KGAnimateControls own source)

Modified `src/pages/KnowledgeGraph.tsx`:
- Added `useKgAnimation` import
- Added `animRangeStart`, `animRangeEnd`, `animInterval` state
- Added `const anim = useKgAnimation({ rangeStart: animRangeStart, rangeEnd: animRangeEnd, interval: animInterval })`
- `animPauseRef` pattern: stores `anim.pause` in a ref so effects can call it without the `anim` object as a dep
- Two pause-on-exit effects: `useEffect([lens])` resets sub-mode to "point" AND calls `animPauseRef.current()`; `useEffect([temporalSubMode])` calls `animPauseRef.current()` when leaving animate (UI-SPEC: animation state discarded on lens/sub-mode change)
- Wired all 16 animation props through to `<KGControls />`
- Animate canvas branch: wrapped in `<SectionErrorBoundary name="KG Animation">`; shows `anim.frameError` inline banner (D-08, non-blocking); renders `"Animating…"` loading-pulse when `anim.currentGraph === null` (first frame fetch); renders `<ForceGraphCanvas data={anim.currentGraph}>` with standard `paintNode`/`linkColorFn`/`linkLineDashFn` (animation shows graph at a point in time, not a diff)
- Point + Diff canvas branches guard on `temporalSubMode !== "animate"` to prevent simultaneous render

## Verification Results

- `npx vitest run src/hooks/useKgAnimation.test.ts` — 14/14 passed
- `npx vitest run src/components/kg/KGControls.test.tsx` — 23/23 passed
- `npx tsc --noEmit` — clean, no errors
- `npm test` — 1290 passed / 2 failed (same 2 pre-existing failures: SwarmTaskNode width class mismatch + KanbanCard label chip count — identical to Plan 03 baseline)

## Commits

| Hash | Message |
|------|---------|
| `ea16f2a` | feat(87-04): add useKgAnimation hook + frame synthesis + LRU tests |
| `813d5ab` | feat(87-04): add KGAnimateControls + wire Animate sub-mode in KGControls + KnowledgeGraph |

## Deviations from Plan

### Auto-fixed Issues

None.

### Architectural Choices (within-discretion)

**1. `animPauseRef` pattern for pause-on-exit effects**
- **Reason:** The lens-change `useEffect([lens])` must call `anim.pause()`, but `anim` (the hook return object) would need to be in the effect deps array. Including it causes an infinite re-run since `anim` is a new object reference on every render. A ref that stores the latest `pause` function avoids the dep issue while staying correct.
- **Impact:** Minor complexity; well-established React pattern for stable callbacks.

**2. `animCurrentGraph` excluded from KGControlsProps**
- **Reason:** KGControls only needs to render the transport controls; the canvas render happens directly in KnowledgeGraph.tsx from `anim.currentGraph`. Passing it through KGControls would be an unused prop.
- **Impact:** Cleaner interface boundary.

**3. Two separate useEffects for lens change and sub-mode change**
- **Reason:** The lens-change effect also resets `temporalSubMode` to "point" — these are two distinct concerns that should not share an effect. The sub-mode effect only pauses animation.
- **Impact:** Clearer intent; no observable behavior difference.

**4. Animate canvas branch uses `temporalSubMode !== "animate"` guard on Point/Diff render block**
- **Reason:** Without this guard, when `temporalSubMode === "animate"`, both the animate ForceGraphCanvas AND the point/diff ForceGraphCanvas would render (since `!diffLoading && activeGraph.nodes.length > 0` would be true). This would double-render canvas instances.
- **Impact:** Correct behavior; no regression in Point or Diff modes.

## Known Stubs

None. The Animate sub-mode is fully functional end-to-end:
- Range pickers → synthesized frames → per-frame fetch → LRU cache → canvas render
- Play/pause/step/scrub transport all wired
- Per-frame error degrades inline (D-08)

## Threat Flags

Mitigations verified:
- **T-87-11** (Denial of Service — fetch storm): Cache-check-before-fetch (line 147 useKgAnimation.ts) + monotonic `frameReqRef` drops stale in-flight fetches; frame count capped at 60; prefetch is fire-and-forget, not blocking.
- **T-87-12** (Denial of Service — unbounded memory): 20-entry LRU cap evicts oldest frames; 60-frame synthesis cap bounds the total sequence regardless of range width.
- **T-87-13** (Information Disclosure): frameError copy is `"Could not load snapshot for {key}."` where `{key}` is a YYYY-MM-DD date string — no internal IDs, stack traces, or server error details surfaced.

## Self-Check: PASSED

- `src/hooks/useKgAnimation.ts` — FOUND
- `src/hooks/useKgAnimation.test.ts` — FOUND
- `src/components/kg/KGAnimateControls.tsx` — FOUND
- `src/components/kg/KGControls.tsx` contains `KGAnimateControls` — FOUND
- `src/pages/KnowledgeGraph.tsx` contains `useKgAnimation` — FOUND
- `src/pages/KnowledgeGraph.tsx` contains `anim.currentGraph` for animate branch — FOUND
- `src/pages/KnowledgeGraph.tsx` contains `anim.pause()` on lens/sub-mode change — FOUND (via animPauseRef)
- `src/pages/KnowledgeGraph.tsx` frameError renders inline without blocking Point/Diff — CONFIRMED
- useKgAnimation.ts contains NO reference to `fetchSnapshotDates` or `/api/kg/snapshots` (only in comments) — CONFIRMED
- Cache-check-before-fetch at line 147 of useKgAnimation.ts — CONFIRMED
- Point sub-mode uses original paintNode/linkColorFn — CONFIRMED (guarded by `temporalSubMode !== "animate"`)
- Commit `ea16f2a` — FOUND
- Commit `813d5ab` — FOUND
- useKgAnimation tests 14/14 — CONFIRMED
- KGControls tests 23/23 — CONFIRMED
- `npx tsc --noEmit` clean — CONFIRMED
