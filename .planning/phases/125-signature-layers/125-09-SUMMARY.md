---
phase: 125-signature-layers
plan: 09
subsystem: ui
tags: [convex, websocket, react-hooks, dedup, honest-states, vitest]

# Dependency graph
requires:
  - phase: 125-signature-layers (plan 02)
    provides: "listRecentRuntimeWindow -- the one bounded backfill read this plan calls imperatively"
  - phase: 125-signature-layers (plan 06)
    provides: "PulseEcgCanvas/drawEcgFrame/EcgBlip/EcgFeedState -- the render layer this plan feeds"
provides:
  - "usePulseWindow -- the ECG hero's data feed: one bounded useConvex().query() backfill per mount/reconnect, D-17 live-WS-only 60s count, D-19 run.blocks dedup guard, mergeBackfill trace identity rule"
  - "PulseEcgHero -- eyebrow + numeral + canvas composition, no props, not yet mounted"
affects: [125-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Imperative useConvex().query() inside try/catch, never useQuery, for a one-shot bounded read on a high-churn table -- avoids both the continuous-resubscription and throw-unmounts-the-tree hazards useQuery would introduce"
    - "epochRef bump on every transition into 'connected' so a slow-resolving backfill promise from a superseded connection cannot land after a later reconnect has already reset state"
    - "Effect declaration ORDER as the mechanism for 'subscribe before you read' -- React runs same-commit passive effects in source order, verified live via a mutation that reordered the two effects and drove the call-order test RED"

key-files:
  created:
    - src/hooks/usePulseWindow.ts
    - src/hooks/usePulseWindow.test.ts
    - src/components/PulseEcgHero.tsx
    - src/components/PulseEcgHero.test.tsx
  modified: []

key-decisions:
  - "The numeral's weight-300 requirement uses the explicit arbitrary Tailwind value font-[300], not the named font-light utility, even though they resolve identically -- the plan's own acceptance-criteria grep bans font-light literally (grep -cE \"font-medium|font-\\[500\\]|font-light\" must return 0), and font-[300] keeps the same off-the-scale discipline the 40px size already needs."
  - "DashboardLayout.tsx:332 (the plan's cited line for the eyebrow class string) no longer holds that class -- it now holds Tooltip content markup, shifted by intervening 125-08 edits. The real eyebrow span is DashboardLayout.tsx:356. Read the live file rather than trust the plan's line number, copied the class string verbatim from there."
  - "Two explanatory comments (about useQuery/listRecentRuntimeWindow/windowSeconds, and about font-light) tripped their OWN literal-substring acceptance-criteria greps on first draft -- same self-tripping-grep class documented in 125-01/125-06's SUMMARYs. Reworded to describe the avoided pattern without quoting its literal name."

requirements-completed: [SIGNAL-02]

# Metrics
duration: ~55min
completed: 2026-08-24
---

# Phase 125 Plan 09: Pulse ECG Hero Data Feed Summary

**`usePulseWindow` -- one imperative `useConvex().query()` backfill per mount/reconnect feeding a trace merge, plus a D-17 live-WS-only 60s count with a `run.blocks` D-19 dedup guard -- composed into `PulseEcgHero`'s eyebrow/numeral/canvas, all three numeral states asserted with controls and three live mutation proofs.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3/3
- **Files created:** 4 (2 source, 2 test)

## Accomplishments

- `usePulseWindow.ts` exports exactly the interface the plan's `<interfaces>` block declares: `usePulseWindow`, `PulseWindow`, `dedupeLiveEvent`, `mergeBackfill`, `CountState`.
- The backfill is `await convex.query(api.events.listRecentRuntimeWindow, {})` inside try/catch inside a `useEffect` -- zero `useQuery` calls (`grep -c "useQuery"` returns 0), called with an empty args object (`grep -c "listRecentRuntimeWindow"` returns exactly 1, `grep -c "windowSeconds"` returns 0).
- Subscriptions to every `TOPIC_EVENT_MAP` topic are registered in an effect declared BEFORE the connect-cycle effect that issues the backfill, so nothing arriving during the round trip is lost -- proven by test case (b), which asserts the recorded call order (`subscribe:*` before `query`), not just the eventual result.
- `mergeBackfill` drops a buffered live row from the trace only on an EXACT `(eventType, timestamp)` match against a backfill row -- never floored or rounded -- with its under-drawing failure mode stated in the code comment, exactly as `<planner_corrections>` item 2 requires.
- `dedupeLiveEvent` is scoped to `run.blocks` only (every other event type always counts), keyed on the literal `run.blocks` + `data.round_num` + `JSON.stringify(data.blocks)`, deliberately excluding the per-turn session identifier: `grep -c "session_id" src/hooks/usePulseWindow.ts` returns 0 for the whole file (not just inside the function -- verified by avoiding the literal substring everywhere, including comments). Verbatim function:

  ```typescript
  export function dedupeLiveEvent(
    seen: Map<string, number>,
    eventType: string,
    data: unknown,
    nowMs: number,
  ): boolean {
    for (const [key, ts] of seen) {
      if (nowMs - ts >= DEDUPE_TTL_MS) seen.delete(key);
    }

    if (eventType !== "run.blocks") return true;

    const payload = (data ?? {}) as Record<string, unknown>;
    let blocksKey: string;
    try {
      blocksKey = JSON.stringify(payload.blocks);
    } catch {
      blocksKey = "__unstringifiable__";
    }
    const key = `run.blocks:${String(payload.round_num)}:${blocksKey}`;

    if (seen.has(key)) return false;
    seen.set(key, nowMs);
    return true;
  }
  ```

- `countState`/`liveCount` are driven ONLY by the live-WS path (`connStatusRef`, `windowStartedAtRef`, `liveCountTimestampsRef`) -- the Convex backfill (`backfillRowsRef`) feeds `blips`/`feedState` exclusively and is never read by the count logic. Grepped to confirm: `liveCountTimestampsRef` is populated only inside `handleLiveEvent` (the WS message handler), never inside the backfill's `.then`/`await` branch.
- `PulseEcgHero.tsx` renders the `PULSE / 60s` eyebrow (house class copied verbatim from `DashboardLayout.tsx:356` -- see Deviations below for the line-number correction), a numeral that switches on `countState` (`ready`: 40px `font-[300]` `tabular-nums` digits; `loading`: a `Skeleton` in the same box; `unavailable`: `METRIC_STATE_COPY.unavailable.label`), the truncation note + `data-backfill-truncated` attribute, and the composed `PulseEcgCanvas`. No card chrome (`hover:border-primary`, `backdrop-blur`, glow shadow all absent), no health dot.

## Task Commits

Each task was committed atomically:

1. **Task 1: The window hook** -- `97d442dc` (feat)
2. **Task 2: The hero component** -- `144d710c` (feat)
3. **Task 3: Reconciliation, D-19, and D-17 tests** -- `36989176` (test)

## Files Created

- `src/hooks/usePulseWindow.ts` (366 lines) -- the data feed
- `src/hooks/usePulseWindow.test.ts` (414 lines, 20 tests) -- reconciliation, dedup, fill-window coverage
- `src/components/PulseEcgHero.tsx` (92 lines) -- eyebrow, numeral, canvas composition
- `src/components/PulseEcgHero.test.tsx` (94 lines, 7 tests) -- the three numeral treatments and the truncation note

## Acceptance Criteria Verified

**Task 1** (all via direct grep against the committed file, re-run after Task 3's mutation proofs confirmed the file byte-identical to its Task-1-committed state):
- `grep -c "useQuery"` -> 0
- `grep -c "listRecentRuntimeWindow"` -> 1
- `grep -c "windowSeconds"` -> 0
- `grep -c "backfillTruncated"` -> 3 (>= 2 required)
- `grep -c "session_id"` -> 0
- `grep -cE "Math\.floor\(.*timestamp|Math\.round\(.*timestamp"` -> 0
- `npx tsc --noEmit` -> exits 0

**Task 2:**
- `grep -c "PULSE / 60s"` -> 1
- `grep -c "tabular-nums"` -> 1 (>= 1), `grep -c -- '-0.02em'` -> 1 (>= 1)
- `grep -cE "font-medium|font-\[500\]|font-light"` -> 0 (required using `font-[300]` instead of `font-light` -- see Deviations)
- `grep -cE ">—<|'—'|\"—\""` -> 0
- `grep -c "METRIC_STATE_COPY"` -> 2 (>= 1)
- `grep -c "backfillTruncated"` -> 3 (>= 1), `grep -c "data-backfill-truncated"` -> 1
- `grep -cE "hover:border-primary|backdrop-blur|shadow-\[0_0"` -> 0
- `npx tsc --noEmit` -> exits 0

**Task 3:**
- `usePulseWindow.test.ts`: 20 tests passing (>= 14 required); `PulseEcgHero.test.tsx`: 7 tests passing (>= 7 required).
- Case (k) recorded `query` call arguments: `h.queryMock.mock.calls[0][1]` equals `{}` (empty object), asserted with `toEqual({})`.
- Case (j)'s control (`truncated: false`) is present as its own test, distinct from case (j) itself (`truncated: true`).
- `grep -c 'countState' src/hooks/usePulseWindow.test.ts` -> 12 (>= 4 required).
- `npm test` exits 0 (one unrelated pre-existing failure -- see below, not from this plan's diff).

### Controls, stated explicitly

- **Case (a) overlap:** an event with the SAME `(eventType, timestamp)` as a backfill row merges to exactly 1 blip. **Control** ("(a control)"): the same event type with a DIFFERENT timestamp float (`ts + 0.001`) produces 2 blips -- proves the merge identity rule discriminates on the exact float, not on type alone.
- **Case (f) D-19 doubled `run.blocks`:** two frames, identical `round_num` + `blocks`, different `session_id`, 50ms apart -- `liveCount` increases by exactly 1. **Control** ("(f control)"): two frames with the SAME `round_num` but DIFFERENT `blocks` payloads increase `liveCount` by 2 -- proves the guard is scoped to genuine duplicates, not a blanket same-`round_num` suppressor.
- **Case (h) D-17 fill window:** `countState` stays `"loading"` (and `liveCount` stays `null`) through 59s since connect, then flips to `"ready"` once 60s have elapsed. Three events are deliberately pushed at 58s-since-connect (not at t=0) so they remain within their OWN rolling 60s window by the time the fill-window check crosses 60s -- this isolates "the connect-relative fill window has not elapsed" (the property under test) from "the rolling 60s count window has expired" (a different clock, covered separately by case (e)'s same-second burst).

## Decisions Made

- **`font-[300]` instead of `font-light` for the numeral's weight.** Both resolve to the identical CSS (`font-weight: 300`) and `MetricCard.tsx`'s own 40px numeral precedent uses `font-light` -- but Task 2's own acceptance criteria explicitly ban the literal string `font-light` (`grep -cE "font-medium|font-\[500\]|font-light"` must return 0), grouped alongside the struck 500-weight bans. Read as intentional: the same "off Tailwind's scale, use an explicit arbitrary value" discipline the 40px size already needs, applied consistently to the weight too. Documented in the component's own comment.
- **Eyebrow class string sourced from the LIVE line, not the plan's cited line.** The plan cites `DashboardLayout.tsx:332` for the eyebrow class; that line currently holds Tooltip content markup (shifted by 125-08's intervening edits earlier in this same wave). The actual eyebrow span with the exact class string (`text-[11px] font-mono font-semibold uppercase tracking-[0.08em] text-muted-foreground`) is at `DashboardLayout.tsx:356`, confirmed via a direct grep for the `tracking-[0.08em]` fragment before copying it. Per "the repository wins" -- corrected here rather than silently using a stale line number.
- **`convex.query`'s deps identity matters for the connect-cycle effect.** The real `useConvex()` returns a referentially-stable client across renders (it reads from React context, which does not change identity on ordinary re-renders); the test harness's mock was written to match that (`h.convexClient` is a single object assigned once, not recreated per call) specifically because an unstable mock would have spuriously re-fired the connect-cycle effect on every internal `setState` and made the "query called exactly N times" assertions meaningless. Documented in the test file's own comment.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - self-tripping-grep, same class as 125-01/125-06] Explanatory comments quoted the literal strings their own acceptance-criteria greps forbid**
- **Found during:** Task 1 and Task 2 acceptance-criteria verification, immediately after first draft
- **Issue:** `usePulseWindow.ts`'s header docstring quoted `` `useQuery` `` (twice) and `` `api.events.listRecentRuntimeWindow` `` while explaining why the hook does NOT use those, and an inline comment quoted `` `windowSeconds` `` while explaining why no window parameter is sent -- each of these tripped the exact grep meant to prove their absence (`grep -c "useQuery"` returned 2, `grep -c "listRecentRuntimeWindow"` returned 2, `grep -c "windowSeconds"` returned 1). Separately, `PulseEcgHero.tsx`'s numeral comment named `` `font-light` `` while explaining why the arbitrary value `font-[300]` was chosen instead, tripping the font-weight ban grep.
- **Fix:** Reworded all four comments to describe the avoided pattern without quoting its literal name (e.g. "never a live Convex subscription hook" instead of naming `useQuery`; "a window parameter" instead of naming `windowSeconds`; "a named weight utility" instead of naming `font-light`).
- **Files modified:** `src/hooks/usePulseWindow.ts`, `src/components/PulseEcgHero.tsx`
- **Verification:** Re-ran each grep; all return the required count (0, 1, or 0 respectively).
- **Committed in:** `97d442dc` (Task 1), `144d710c` (Task 2) -- fixed before each commit, no separate commit needed

---

**Total deviations:** 1 auto-fixed class (4 instances of the same self-tripping-grep pattern, none behavioral). No scope creep; no change to runtime behaviour in either fix.

## Mutation Proofs (all performed live on `usePulseWindow.ts`, captured, then reverted to a byte-identical file -- confirmed via `git diff` returning empty against the Task 1 commit before proceeding to Task 3's commit)

**(1) Dropped the `blocksKey` component from the D-19 dedup key** (`` `run.blocks:${String(payload.round_num)}:${blocksKey}` `` -> `` `run.blocks:${String(payload.round_num)}` ``). Ran `npx vitest run src/hooks/usePulseWindow.test.ts -t "f control"`:

```
FAIL  ... > (f control) two run.blocks frames with DIFFERENT blocks payloads both count -- the guard discriminates, not swallows
AssertionError: expected 1 to be 2 // Object.is equality
- Expected: 2
+ Received: 1
```

Reverted; re-ran the full file -- 20/20 GREEN, `git diff src/hooks/usePulseWindow.ts` empty.

**(2) Made `countState`/`liveCount` unconditionally report `"ready"`**, skipping the fill-window check entirely. Ran `npx vitest run src/hooks/usePulseWindow.test.ts -t "D-17 fill window: countState stays loading"`:

```
FAIL  ... > (h) D-17 fill window: countState stays loading through 59s since connect, flips to ready after 60s
AssertionError: expected 'ready' to be 'loading' // Object.is equality
Expected: "loading"
Received: "ready"
```

(A broader `-t "fill window"` run also caught cases (i), (j), (c) going RED for the same reason, since they all assert `countState` at some point -- reported here for completeness, though the plan named only case (h).) Reverted; re-ran the full file -- 20/20 GREEN, `git diff src/hooks/usePulseWindow.ts` empty.

**(3) Reordered the two `useEffect` blocks** so the connect-cycle effect (which issues the backfill query) runs BEFORE the subscribe effect. Ran `npx vitest run src/hooks/usePulseWindow.test.ts -t "subscription is registered BEFORE"`:

```
FAIL  ... > (b) subscription is registered BEFORE the backfill query is issued, and a mid-flight arrival is not lost
AssertionError: expected 1 to be less than 0
```

Reverted (moved the subscribe effect back ahead of the connect-cycle effect, removed the duplicate); re-ran the full file -- 20/20 GREEN, `git diff src/hooks/usePulseWindow.ts` empty (confirmed byte-identical to the `97d442dc` commit before Task 3's own commit was made).

## Full Verification

- `npm test`: 361 files passed | 17 skipped, 5,064 passed | 195 todo, **1 failed** -- `src/components/control-center/IntelligenceFeedPanel.test.tsx > applies the money/high stripe to money- and high-priority rows only`. Re-ran in isolation: 4/4 PASSING. This file is entirely outside this plan's diff (`src/components/control-center/*` is explicitly flagged in the shared-checkout warning as the concurrent astridr-repo-f3 session's territory, Phase 195 persona-dials) and is the same class of full-suite-only, non-reproducing failure this phase has now observed twice before (125-05's `AvatarAura.browser.test.tsx`, 125-08's own `IntelligenceFeedPanel.test.tsx`/`App.test.tsx` pair) -- reported per instruction, not fixed.
- `npx tsc --noEmit` exits 0.
- `npm run build` exits 0.
- `npx vitest run src/entryChunk.ratchet.test.ts` -- 3 passed. Measured directly from `dist/index.html`'s entry tags: **entry JS 586,735 bytes** (byte-identical to 125-08's post-Wave-3 measurement -- this plan's two source files are not imported by any entry-reachable module, confirming the lazy-Dashboard-chunk expectation), ceiling 594,709, **headroom 7,974 bytes**, unchanged. **Entry CSS 239,701 bytes** (up 51 bytes from 125-08's 239,650), ceiling 242,106, **headroom 2,405 bytes** (down from 2,456). The +51 bytes is plausible ordinary Tailwind utility-class growth (Tailwind v4's JIT scanner extracts matching classes from ALL source files regardless of chunk membership, so new utility combinations used by `PulseEcgHero.tsx` -- e.g. `font-[300]`, the `-0.02em` letter-spacing, `tabular-nums` -- can add global CSS bytes even though the component itself isn't entry-reachable yet). Both axes remain comfortably under their ceilings; no ratchet trip.
- `grep -rc "windowSeconds" src/` is NOT zero repo-wide: `src/hooks/useToolPolicyEvents.ts` (2 hits) and `src/components/ToolPolicyFeed.test.tsx` (1 hit) use that identifier for an entirely unrelated feature (Phase 105-07, confirmed via `git log --oneline -1` on both files, untouched by any commit in this plan). **Plan verification text correction:** the plan's literal `grep -rc "windowSeconds" src/` returns 0 "in every file" clause is unsatisfiable against live code for reasons unrelated to this plan's scope -- corrected to "zero in this plan's four files," which is independently confirmed (`grep -c "windowSeconds" src/hooks/usePulseWindow.ts src/hooks/usePulseWindow.test.ts src/components/PulseEcgHero.tsx src/components/PulseEcgHero.test.tsx` -> 0 0 0 0).
- `git diff --stat 97d442dc~1 36989176` (the pre-plan HEAD through this plan's last commit): confined to exactly the four `files_modified` -- `src/components/PulseEcgHero.test.tsx`, `src/components/PulseEcgHero.tsx`, `src/hooks/usePulseWindow.test.ts`, `src/hooks/usePulseWindow.ts` (967 insertions, 0 deletions). Neither `src/components/SignalHorizon.tsx` nor `src/layouts/DashboardLayout.tsx` appears anywhere in the diff.

## Threat Flags

None. The plan's own `<threat_model>` (T-125-09-01 through T-125-09-08, T-125-09-SC) already covers every trust boundary this plan's files cross (the WS-frame-to-count path, the public Convex read, the untrusted `data.blocks` payload feeding a dedup key, the unbounded-buffer/unbounded-map DoS surfaces, the `JSON.stringify` circular-payload surface, a rejected read blanking the app, an unbounded backfill, a silently capped trace, event data reaching the DOM). No new surface was introduced beyond what those entries already describe. This plan installs nothing (`git diff package.json package-lock.json` empty).

## Known Stubs

None. `PulseEcgHero` is fully wired end-to-end against `usePulseWindow`, which is fully wired against the real `api.events.listRecentRuntimeWindow` query and the real `useAstridrWS()` context -- no hardcoded empty values, no placeholder text, no mock data path in production code. (Test files mock both dependencies, as required for isolated unit testing; production code paths are unmocked.)

## Issues Encountered

None beyond the deviations documented above. No auth gates, no external service configuration, no shared-checkout collision on this plan's own commits (each of the three commits individually confirmed via `git show --stat` to contain only its intended file(s); no foreign file swept in).

## User Setup Required

None. No environment variables, external services, or manual configuration needed. `PulseEcgHero` is not yet mounted anywhere (125-11's job) -- nothing in this plan is user-visible yet.

## Next Phase Readiness

- `PulseEcgHero` (default export, no props) is ready for 125-11 to mount into `Dashboard.tsx` beneath the page's own `PageHeader`.
- 125-11 is the point at which this plan's "entry-chunk-neutral" measurement becomes load-bearing rather than incidental -- mounting the component will move real bytes (both JS and whatever additional CSS the mounted render path touches) into the entry-reachable Dashboard chunk for the first time. Current headroom to plan against: 7,974 bytes JS / 2,405 bytes CSS.
- `dedupeLiveEvent`/`mergeBackfill` are exported and directly testable by any future plan needing the same reconciliation primitives.
- No blockers for downstream plans in this wave.

---
*Phase: 125-signature-layers*
*Completed: 2026-08-24*

## Self-Check: PASSED

All 4 created files confirmed present on disk (`src/hooks/usePulseWindow.ts`, `src/hooks/usePulseWindow.test.ts`, `src/components/PulseEcgHero.tsx`, `src/components/PulseEcgHero.test.tsx`). All three commit hashes (`97d442dc`, `144d710c`, `36989176`) confirmed present via `git log --oneline --all | grep -E "97d442dc|144d710c|36989176"`.
