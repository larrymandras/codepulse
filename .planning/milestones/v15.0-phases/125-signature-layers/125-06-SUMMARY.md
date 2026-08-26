---
phase: 125-signature-layers
plan: 06
subsystem: ui
tags: [canvas, rAF, colour-tokens, oklch, reduced-motion, honest-states, vitest]

# Dependency graph
requires:
  - phase: 125-01
    provides: "eventHue.ts's HUE_TOKEN (astridr/machine/error -> var(--x)), the aurora/voice CSS tokens' getComputedStyle convention"
provides:
  - "src/components/PulseEcgCanvas.tsx: drawEcgFrame() (pure), PulseEcgCanvas (mount-ready component), EcgBlip/EcgFeedState/EcgPalette types"
  - "The D-11 gated-rAF-loop pattern (mount + matchMedia-change + MutationObserver re-evaluation) as a second worked example alongside AvatarAura.tsx"
  - "The D-06 sentinel round-trip pattern for detecting an unparsed CSS custom property"
affects: [125-09, 125-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "fillStyle round-trip sentinel: set to a known-bad probe, then the resolved token, and compare the readback -- detects a CSS custom property that failed to parse without needing to throw (fillStyle silently no-ops on unparseable input)."
    - "Holder object instead of a reassignable `let` for a value captured and mutated inside a vi.fn() closure and read outside it -- avoids a TS2349 'never' narrowing false positive that AvatarAura.test.tsx's own `let rafCb` pattern happens not to trigger in its own file, but does here."

key-files:
  created:
    - src/components/PulseEcgCanvas.tsx
    - src/components/PulseEcgCanvas.test.tsx

key-decisions:
  - "Tasks 1 and 2 committed together (not two commits) -- drawEcgFrame's unavailable/idle/live branches and the component's single JSX return are interleaved enough that a hunk-level split would produce a non-compiling intermediate commit, which is worse than the atomicity the two-commit convention protects."
  - "Breathing baseline uses a 4000ms sine period, matching this plan's own <interfaces> section (stated twice), not the reference sketch's actual ~12,566ms period (`sin(now/2000)`) -- the interfaces contract is what 125-09/125-11 compose against, so it is authoritative over the sketch's literal code."
  - "drawEcgFrame's locked signature has no windowMs parameter, so the 60s window is a module constant (WINDOW_MS) inside PulseEcgCanvas.tsx, not threaded through opts. The component's own windowMs prop (default 60_000) is used only for the canvas aria-label text."

patterns-established:
  - "HUE_TOKEN's var(--x) literal sliced to its bare custom-property name (cssVarName()) rather than hardcoding the CSS variable names a second time -- keeps this file consuming eventHue.ts's vocabulary instead of re-deriving it, per the plan's own interfaces note."

requirements-completed: [SIGNAL-02]

duration: ~20min
completed: 2026-08-24
---

# Phase 125 Plan 06: Pulse ECG Canvas Render Layer Summary

**Built the Pulse ECG's native-canvas render layer -- a gated rAF trace with a 4s breathing baseline, three-hue blip spikes, and D-08's two honest empty states -- proven with 11 behavioural tests and 3 live mutation proofs, at zero cost to the 3,075-byte entry-CSS headroom left after 125-05.**

## Performance

- **Duration:** ~20 min (first Read call ~10:53, second commit 11:13:38)
- **Started:** 2026-08-24T10:53:00-04:00 (approx, first Read call)
- **Completed:** 2026-08-24T11:13:38-04:00
- **Tasks:** 3/3 (Tasks 1+2 committed together, Task 3 separately)
- **Files created:** 2

## Accomplishments

- `PulseEcgCanvas.tsx` exports exactly the interface the plan's `<interfaces>` block declares: `PulseEcgCanvas`, `drawEcgFrame`, `EcgBlip`, `EcgFeedState`, `EcgPalette`.
- DPR-aware canvas sizing copied from `AvatarAura.tsx:260-283`'s `ResizeObserver`/1.25-DPR-clamp/`window.resize`-fallback pattern.
- A 4s-sine breathing baseline (opacity 0.5<->0.8), four-point blip spikes lifted from the reference sketch (`index.html:601-616`) with the sign flipped for `error` (down) vs `machine`/`astridr` (up), and a `WINDOW_MS=60_000` module constant handling both the age->x mapping and the "drop blips older than the window" rule.
- Colour resolved via `getComputedStyle` straight into `fillStyle`/`strokeStyle` -- zero `match(`/`.exec(`/`replace(` hits over the colour-resolution code, zero `recharts`, exactly one 6-hex literal (`#ff00ff`, the `SENTINEL_COLOR` round-trip probe).
- A one-time `fillStyle` sentinel: set to the probe, then to the resolved token; if the readback still equals the probe, the token never parsed (`fillStyle` no-ops rather than throwing) -- logs a `console.error` naming the property and falls back to `currentColor`.
- D-11's gate: `computeAnimate()` checked on mount and re-checked via a `MutationObserver` on `data-theme`/`class` (kept from `AvatarAura.tsx` -- the OTHER idea per the plan's `planner_corrections`, never its `getComputedStyle(...).color.match(/\d+/g)` colour probe, which this file never touches). When false: `drawEcgFrame` is called once with `animate:false`, `requestAnimationFrame` is never called. When true: the loop reschedules every frame but skips the `drawEcgFrame` call while `document.hidden` is true.
- D-08's two empty states: `unavailable` draws a dashed baseline (`setLineDash([4,4])`, reset via `setLineDash([])`) plus a DOM copy sourced from `METRIC_STATE_COPY.empty.label` (the literal string `"no signal yet"` never appears in the component source); `idle` draws only the breathing baseline, no text.
- 11 tests across `drawEcgFrame` (colour pass-through, spike direction, window bound) and `PulseEcgCanvas` (rAF gates, hidden-tab, empty states, sentinel), using a purpose-built RECORDING fake 2D context (setter-log for `fillStyle`/`strokeStyle`, call-log for path methods) rather than `AvatarAura.test.tsx`'s plain `vi.fn()` object, because the colour claim needs the exact assigned string, not just call presence.
- Three live mutation proofs performed, captured RED, and reverted (verbatim below).

## Task Commits

1. **Tasks 1+2 (Canvas/DPR/loop + the two empty-window states)** — `3977fdd9` (feat). Committed together: `drawEcgFrame`'s `unavailable`/idle/live branches share one function body and the component has one JSX `return`, so a hunk-level split between the two tasks would have required staging an intermediate commit that does not compile -- worse than the atomicity the per-task convention protects.
2. **Task 3 (Prove the gates, the colour path and the state split)** — `ebff0321` (test)

## Files Created

- `src/components/PulseEcgCanvas.tsx` (388 lines) — the render layer
- `src/components/PulseEcgCanvas.test.tsx` (308 lines, 11 tests) — gate, colour, window and empty-state coverage

## Acceptance Criteria Verified

**Task 1:**
- `npx tsc --noEmit` exits 0. Verified after every edit, final state clean.
- `grep -cE "match\(|\.exec\(|replace\(/" src/components/PulseEcgCanvas.tsx` -> **0**. The colour-resolution block is `resolveToken`/`resolvePalette`/`cssVarName` (lines ~85-120) plus the `strokeStyle`/`fillStyle` assignments inside `drawEcgFrame` (lines ~150-200) -- none of it touches `match(`, `.exec(`, or `replace(`.
- `grep -c "recharts" ...` -> **0**.
- `grep -cE "#[0-9a-fA-F]{6}" ...` -> **1**, and it is the magenta `SENTINEL_COLOR = "#ff00ff"` constant used only as the fillStyle round-trip probe.
- `grep -c "document.hidden" ...` -> **2** (the frame-loop early return, the visibilitychange repaint check).
- `grep -c "prefers-reduced-motion" ...` -> **4** (the `matchMedia` query string, used in `prefersReducedMotion()` and again as the `mq` subscription in the draw effect).
- `grep -c 'dataset.theme' ...` -> **1** (`computeAnimate()`'s explicit `readable` check).

**Task 2:**
- `grep -c "METRIC_STATE_COPY" ...` -> **2** (import + `.empty.label` read).
- `grep -c '"no signal yet"' ...` -> **0** (had to be reworded once -- see Deviations).
- `grep -c "data-ecg-state" ...` -> **1**.
- `grep -c "setLineDash(\[\])" ...` -> **1** (the dash reset in the `unavailable` branch).
- `npx tsc --noEmit` exits 0.

**Task 3:**
- `npx vitest run src/components/PulseEcgCanvas.test.tsx` -> **11 tests passed** (>= 10 required).
- Test (d) has both halves: "(d) draws one static frame and calls requestAnimationFrame ZERO times under reduced motion" is the gated case; "(d control) calls requestAnimationFrame when motion is not reduced" is the control.
- Test (f) has both halves: "(f) the readable theme stops the loop" is the gated case; "(f control) a non-readable theme keeps the loop running" is the control.
- `npm test` exits 0 (full run, see below).

## Colour Path — Recorded `strokeStyle` Log (Test A)

Given the palette `{ astridr: "oklch(0.6 0.2 300)", machine: "oklch(0.7 0.15 200)", error: "oklch(0.65 0.18 27)" }` and one blip of each hue, the recording context's `strokeStyleLog` contained all three verbatim:

```
strokeStyleLog.includes("oklch(0.7 0.15 200)")  // machine  -> true
strokeStyleLog.includes("oklch(0.6 0.2 300)")   // astridr  -> true
strokeStyleLog.includes("oklch(0.65 0.18 27)")  // error    -> true
strokeStyleLog.some(s => /^rgb/.test(s))        // -> false (control)
strokeStyleLog.some(s => /^#/.test(s))          // -> false (control)
```

## Mutation Proofs (all performed live, captured, reverted)

**(1) Removed the `document.hidden` early return** from the frame loop (`// MUTATION-1-REMOVED: if (typeof document !== "undefined" && document.hidden) return;`). Ran `npx vitest run src/components/PulseEcgCanvas.test.tsx -t "hidden"`:

```
FAIL  ... > (e) stops drawing while document.hidden is true, but keeps scheduling requestAnimationFrame
AssertionError: expected 10 to be +0 // Object.is equality
- Expected: 0
+ Received: 10
```

Reverted; re-ran the full file — 11/11 GREEN.

**(2) Removed the `readable` clause from `computeAnimate`** (`!prefersReducedMotion() && document.documentElement.dataset.theme !== "readable"` -> `!prefersReducedMotion()`). Ran `-t "readable"`:

```
FAIL  ... > (f) the readable theme stops the loop — requestAnimationFrame is called ZERO times
AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times
```

Reverted; re-ran the full file — 11/11 GREEN.

**(3) Routed a blip colour through a regex-scrape reconstruction** (`ctx.strokeStyle = color;` -> `const mutatedNums = String(color).match(/[\d.]+/g) || []; ctx.strokeStyle = \`rgb(${mutatedNums.slice(0,3).join(",")})\`;`). Ran `-t "hands the palette"`:

```
FAIL  ... > (a) hands the palette's oklch strings straight to strokeStyle — never converted, never substituted
AssertionError: expected [ 'oklch(0.556 0 0)', …(3) ] to include 'oklch(0.7 0.15 200)'
```

Reverted; re-ran the full file — 11/11 GREEN. (The reconstructed value was itself an `rgb(...)`-prefixed string, so the test's dedicated `/^rgb/` control would independently have failed too — the containment assertion simply failed first.)

## Full Test Suite

`npm test`: **5,026 passed / 0 failed / 195 todo** (360 files passed, 17 skipped). Not made red. `AvatarAura.browser.test.tsx` (the known undiagnosed intermittent flagged in 125-05-SUMMARY.md) did **not** recur in this run.

`npx tsc --noEmit` exits 0. One pre-existing type error was found and fixed in my own first draft (not a mutation artifact): a reassignable `let frameCb: FrameRequestCallback | null` captured and reassigned inside a `vi.fn()` closure narrowed to `never` at its later `?.()` call sites (`TS2349: This expression is not callable. Type 'never' has no call signatures.`). Fixed by replacing it with a `{ cb: FrameRequestCallback | null }` holder object, which sidesteps the narrowing entirely. Confirmed fix: `npx tsc --noEmit` exits 0 afterward, test still passes.

## Build and Entry-Chunk Ratchet

`npm run build` exits 0. `npx vitest run src/entryChunk.ratchet.test.ts` — **3 passed**. Measured directly from `dist/index.html`'s entry tags:

- **Entry JS: 583,141 bytes** (vs. 125-01's 583,049-byte baseline, +92 bytes — unrelated build/dependency variance; neither of this plan's two files is imported by any entry-reachable module).
- **Entry CSS: 239,031 bytes** — **byte-identical** to the pre-plan (125-05) measurement. **Zero bytes added.** `PulseEcgCanvas.tsx` belongs to the lazy Dashboard chunk per F-3's inversion (125-11's job to mount it), and this plan does not import it from anywhere yet, so it is not currently reachable from the entry graph at all.
- **Remaining headroom: 3,075 bytes** under the 242,106-byte D-18 ceiling — fully preserved for 125-07 onward.

## Decisions Made

- Tasks 1 and 2 committed together rather than as two separate commits. `drawEcgFrame`'s `unavailable`/idle/live branches share one function body, and the component has one JSX `return` covering both the canvas and the conditional empty-state copy — genuinely interleaved code, not two independently extractable slices. A hunk-level split would have required an intermediate commit that either omits the `unavailable` branch (leaving `drawEcgFrame` incomplete against its own interface, but still compiling) or omits the JSX empty-copy rendering while keeping the branch dead code — both are worse for correctness/reviewability than one coherent, compiling commit. Documented per the CLAUDE.md house rule that plan-authored task structure is a draft, not a spec, when it conflicts with keeping every commit in a working state.
- Breathing baseline uses a 4000ms sine period. The plan's own `<interfaces>` section states "breathing baseline opacity 0.5<->0.8 on a 4s sine" twice (once in the fixed-figures list, once in Task 2's idle description). The reference sketch's actual `draw()` function (`.planning/sketches/001-dashboard-quiet-control-room/index.html:592`) computes `breathe = 0.5 + 0.3 * (0.5 + 0.5 * Math.sin(now / 2000))`, which has a period of `2000 * 2*PI` ≈ 12,566ms, not 4000ms. Since 125-09 composes against this plan's own written `<interfaces>` contract (not against the sketch file directly), and the contract states 4s explicitly and twice, 4s is what shipped. Flagged here rather than silently resolved either way, per the "planning documents are claims, live code is evidence" rule — though in this specific case the plan's contract text, not the sketch's literal code, is the thing 125-09 will actually read.
- `drawEcgFrame`'s exported signature (per the plan's `<interfaces>` block) has no `windowMs` parameter, so the 60s window bound lives as a `WINDOW_MS` module constant used for both the age->x mapping and the "drop stale blips" rule inside `drawEcgFrame` itself. The component's own `windowMs` prop (default `60_000`, matching the interface) is threaded only into the canvas `aria-label` text ("Pulse trace, last 60s, ...") — it does not affect trace rendering. This keeps `drawEcgFrame`'s public contract exactly as 125-09 expects to compose against it.
- Consumed `HUE_TOKEN` from `eventHue.ts` (125-01) via a small `cssVarName()` helper that slices `"var(--x)"` down to `"--x"`, rather than hardcoding the three CSS variable names a second time. This is a fixed-offset slice on a static, hardcoded literal from this repo's own source (`HUE_TOKEN`'s values never change at runtime) — not a regex/scrape on a browser-computed colour string, so it does not fall under D-06's no-regex-on-colour rule, which is specifically about the latter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A doc comment tripped its own acceptance-criteria grep**
- **Found during:** Task 1/2 acceptance-criteria verification
- **Issue:** My first-draft comment above the `unavailable` branch read `The italic "no signal yet" copy is rendered as a DOM element...`, which the acceptance criterion `grep -c '"no signal yet"' src/components/PulseEcgCanvas.tsx` (expected 0, proving the string is read from `METRIC_STATE_COPY` rather than retyped) then flagged as a false positive on itself — same class of self-tripping-grep defect documented in 125-01-SUMMARY.md.
- **Fix:** Reworded the comment to reference `METRIC_STATE_COPY`'s `empty` entry by name instead of quoting the literal string.
- **Files modified:** `src/components/PulseEcgCanvas.tsx`
- **Verification:** Re-ran the grep; returns 0.
- **Committed in:** `3977fdd9` (the comment was fixed before the first commit, so no separate commit was needed)

**2. [Rule 3 - Blocking issue] TS2349 "never" narrowing in my own first test draft**
- **Found during:** Task 3, the tsc verification step before committing
- **Issue:** `let frameCb: FrameRequestCallback | null = null;` inside the (e) hidden-tab test, reassigned only inside a `vi.fn((cb) => { frameCb = cb; ... })` closure and read later via `frameCb?.(1000)`, narrowed to `never` at those read sites under this repo's tsconfig — `TS2349: This expression is not callable. Type 'never' has no call signatures.` This blocked `npx tsc --noEmit` from exiting 0.
- **Fix:** Replaced the reassignable `let` with a `{ cb: FrameRequestCallback | null }` holder object (`captured.cb = cb`, `captured.cb?.(1000)`), which is not subject to the same flow-narrowing behaviour.
- **Files modified:** `src/components/PulseEcgCanvas.test.tsx`
- **Verification:** `npx tsc --noEmit` exits 0; `npx vitest run src/components/PulseEcgCanvas.test.tsx` still 11/11 passing.
- **Committed in:** `ebff0321` (fixed before the commit was made, included in the single Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule-1 self-tripping-grep comment, 1 Rule-3 blocking TS narrowing issue in the test file). Neither affected the component's runtime behaviour; both were caught and fixed before their respective commits.

## Issues Encountered

None beyond the two deviations above. No auth gates, no external service configuration, no shared-checkout collision — `git show --stat` after each commit confirmed only the intended file was present in both cases.

## User Setup Required

None. No environment variables, external services, or manual configuration needed.

## Next Phase Readiness

- `PulseEcgCanvas`, `drawEcgFrame`, `EcgBlip`, `EcgFeedState`, `EcgPalette` are ready for 125-09 (backfill + live data merge) to compose against exactly as declared.
- 125-11 (Dashboard mount) is the point at which this plan's "entry-chunk-neutral" measurement becomes load-bearing — mounting the component under the entry-reachable Dashboard chunk will move real bytes into the entry graph for the first time and should be checked against the same 3,075-byte headroom.
- No blockers for downstream plans in this wave.

---
*Phase: 125-signature-layers*
*Completed: 2026-08-24*

## Self-Check: PASSED

All 3 created files confirmed present on disk (`src/components/PulseEcgCanvas.tsx`,
`src/components/PulseEcgCanvas.test.tsx`, this SUMMARY). Both commit hashes
(`3977fdd9`, `ebff0321`) confirmed present via `git log --oneline --all`.
