---
phase: 125-signature-layers
plan: 04
subsystem: ui
tags: [css, oklch, websocket, state-machine, fail-closed, vitest, react, aurora]

# Dependency graph
requires:
  - phase: 125-signature-layers
    provides: "125-01: --aurora-a/b/c CSS tokens (derived from --primary/--astridr/--status-ok), --duration-slow/--ease-house motion tokens"
provides:
  - "src/index.css: .signal-horizon base + data-horizon-state attribute-selector overrides (critical/warn/dawn/unknown/offline), the D-04 motion freeze"
  - "src/components/SignalHorizon.tsx: resolveHorizonState() pure resolver + SignalHorizon component, exactly matching the <interfaces> contract plan 125-08 mounts against"
  - "src/components/SignalHorizon.test.tsx: 19 tests proving all 6 states incl. the 4 fail-closed Unknown-entry conditions, plus 3 live mutation proofs"
affects: [125-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "data-horizon-state attribute selectors (not class toggling) so the rendered DOM records WHICH condition was entered, readable by both CSS and tests"
    - "vi.hoisted + vi.mock of the CONSUMED context module (ForceGraphCanvas.test.tsx's props/callback-capture idiom), not a real-provider render, for testing a WS consumer component in isolation under fake timers"
    - "connect-scoped (not rolling) freshness timeout, re-armed on every transition into a specific status value via a single useEffect keyed on that value"

key-files:
  created:
    - src/components/SignalHorizon.tsx
    - src/components/SignalHorizon.test.tsx
  modified:
    - src/index.css

key-decisions:
  - "Removed the plan's literal `: JSX.Element` return-type annotation on the default export — this repo's tsconfig (react-jsx, no global JSX namespace augmentation) rejects it (`Cannot find namespace 'JSX'`), and no other .tsx file in the repo uses that annotation. Omitted the annotation and let TypeScript infer the identical effective type; the exported call signature plan 125-08 consumes is unchanged."
  - "aria-label for the critical state distinguishes an armed E-Stop from an alertLevel-driven critical (both resolve to the same HorizonState value) by reading the internal armed flag, rather than using one fixed string for both causes — more accurate than the plan's four example labels, which named only the armed case."

patterns-established:
  - "Ordered if-chain state resolvers should be pure, take every input as an explicit argument (including `now`), and be exported separately from the component that calls them — enables direct unit-testing of priority order independent of any timer/WS mocking."

requirements-completed: [SIGNAL-01]

# Metrics
duration: 21min
completed: 2026-08-24
---

# Phase 125 Plan 04: Signal Horizon — CSS, Fail-Closed State Machine, and Proof Summary

**Landed the Signal Horizon's aurora/state CSS (`.signal-horizon` + `data-horizon-state` attribute selectors), a pure fail-closed `resolveHorizonState()` resolver plus the `SignalHorizon` component consuming it over `useAstridrWS().subscribeEvent("estop_state", ...)`, and 19 tests (10 component + 9 direct resolver) proving all six states — including the four Unknown-entry conditions no operator can trigger by hand — with three live mutation proofs.**

## Performance

- **Duration:** ~21 min (first file read ~10:14, last commit 10:33:38 -0400)
- **Started:** 2026-08-24T14:14:00Z (approx)
- **Completed:** 2026-08-24T14:33:38Z
- **Tasks:** 3/3
- **Files modified:** 3 (1 modified, 2 created)

## Accomplishments

- `.signal-horizon` in `src/index.css`: base carries the resting aurora (`--aurora-a/b/c`, 300% background-size, 90s linear drift); `[data-horizon-state="critical"]` (3px crimson), `="warn"` (amber color-mix), `="dawn"` (amber with a 2600ms `background-color` ease), and `="unknown"`/`="offline"` (same dashed-neutral treatment, kept as two separately-named selector values per UI-SPEC:169) override it. `@media (prefers-reduced-motion: reduce)` and `[data-theme="readable"]` both freeze the drift (`animation: none` + `background-size: 100% 100%`) while every state colour stays live.
- `src/components/SignalHorizon.tsx` exports `resolveHorizonState()` — a pure, ordered 6-rule if-chain (disconnected→offline; null snapshot→unknown; armed→critical; alert overlay; dawn ease; otherwise resting) — and the default `SignalHorizon` component, matching the plan's `<interfaces>` contract exactly (props, exports, state values).
- The component subscribes to `estop_state` via `useAstridrWS().subscribeEvent`, parses defensively in try/catch (never rethrows into `AstridrWSContext`'s synchronous `ws.onmessage` fan-out), clears its snapshot on every departure from `"connected"`, and re-arms a 15s connect-scoped freshness timeout on every transition into `"connected"` (implemented as a single `useEffect` keyed on `status`, which also covers "on mount" for free since an effect with a dependency runs on the initial render).
- A genuine `armed:true → armed:false` transition arms a 2600ms dawn ease (`DAWN_MS`); a disarm arriving when the machine was never armed goes straight to resting. Zero `useQuery` calls; zero new Convex subscriptions.
- A DEV-only `window.__signalHorizonStub` routes through the exact same `handleFrame` parse path as the wire handler — a malformed stub payload lands in Unknown exactly like a malformed wire payload. Confirmed absent from the production bundle after `npm run build` (`grep -l "__signalHorizonStub" dist/assets/*.js` — no match, empty result, exit 1).
- `src/components/SignalHorizon.test.tsx`: 10 component-level cases (mount, delayed snapshot at 14s, missing snapshot past 15s + 5min, 4 malformed shapes with a no-throw assertion, armed, reconnect, dawn at 2599ms/2600ms, no-spurious-dawn, alert overlay, armed-outranks-alerts) plus 9 direct `resolveHorizonState` unit tests covering the full priority order. 19/19 passing.
- Three mutation proofs run live against the committed source and reverted (verbatim output below): (1) rule 2 (`null snapshot`) changed to return `"resting"` — 7 tests went RED: cases (a), (b), (c), (d), (f) plus both direct rule-2 unit tests; (2) the `status !== "connected"` snapshot-clear branch emptied — exactly case (f) went RED; (3) the malformed branch changed to `return` without clearing — exactly case (d) went RED. All three reverted; `git diff src/components/SignalHorizon.tsx` empty after each revert, confirmed before moving to the next mutation.
- Full `npm test` after all three tasks: **5008 passed, 0 failed, 195 todo** (358 files passed, 17 skipped) — not made red by this plan. `npx tsc --noEmit` exits 0. `npm run build` succeeds; `npx vitest run src/entryChunk.ratchet.test.ts` still passes (measured: entry CSS 239,031 bytes vs. the 237,359-byte D-18 baseline, +0.7%, well under the +2%/242,106-byte ceiling; entry JS 583,105 bytes, +56 bytes, unrelated build variance).

## Task Commits

Each task was committed atomically:

1. **Task 1: Land the horizon CSS — aurora, state overrides, and the motion freeze** - `31966778` (feat)
2. **Task 2: Build the fail-closed state machine with a DEV-only simulation hook** - `a27e151c` (feat)
3. **Task 3: Prove every state — including the ones no operator can trigger by hand** - `24ad5871` (test)

_No TDD tasks in this plan — all three are `type="auto"` with `tdd` unset._

## Files Created/Modified

- `src/index.css` — added the Signal Horizon CSS block (81 insertions) at end of file: `.signal-horizon` base + `@keyframes aurora-drift` + 4 state-modifier attribute-selector rule groups + the reduced-motion/readable motion gate.
- `src/components/SignalHorizon.tsx` (created, 306 lines) — `HorizonState`/`AlertLevel`/`HorizonInput` types, `resolveHorizonState()`, `parseEstopPayload()`, `horizonAriaLabel()`, and the default `SignalHorizon` component.
- `src/components/SignalHorizon.test.tsx` (created, 273 lines) — component + resolver test suites.

## Decisions Made

- Removed the plan's literal `: JSX.Element` return-type annotation on the default export (see `key-decisions` above for the compile error and rationale) — no behavioral change, TypeScript infers the same type, and the exported call signature `<SignalHorizon alertLevel={x} />` plan 125-08 consumes is unaffected.
- Gave the aria-label function access to the internal `armed` boolean rather than deriving text purely from the `HorizonState` value, since `"critical"` covers two distinct causes (armed E-Stop vs. an alert-severity overlay) that the type alone cannot distinguish — the plan's four example labels named only the armed case ("Emergency stop armed"); this implementation adds a distinct "Critical alert" string for the alert-driven case rather than falsely claiming E-Stop is armed when it isn't, plus labels for `warn`/`dawn` (not given examples in the plan) — "System attention required" / "Emergency stop disarmed, returning to nominal".
- Connect-scoped timeout implemented as a single `useEffect` keyed on `status` (arms on `"connected"`, clears snapshot + disarms timer on any other value) rather than a separate "on mount" special case — a dependency-keyed effect already runs on the initial render, so "armed on mount and on each transition into connected" (the plan's phrasing) falls out of the same code path with no duplication.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, plan-text correction, no behavior change] Two acceptance-criteria greps in this plan's own text were self-contradicting, same class of issue documented in 125-01-SUMMARY.md**
- **Found during:** Task 1 and Task 2
- **Issue:** My first-draft doc comment in `src/index.css` described the token names being AVOIDED using their literal substrings (`--dur-3`, `--ease-out`), which the acceptance criterion `grep -cE "--dur-1|--dur-2|--dur-3|--ease-out" src/index.css` (expected 0) then flagged on itself. Separately, my first-draft header comment in `SignalHorizon.tsx` quoted the literal call `useQuery(api.alerts.countBySeverity)` while explaining D-05's prop-hoisting rationale, which the acceptance criterion `grep -c "useQuery" src/components/SignalHorizon.tsx` (expected 0) then counted as 2 hits.
- **Fix:** Reworded both comments to describe the same thing without the literal trigger substrings ("the sketch's shorter-numbered duration token or its 'ease-out' easing name" instead of the literal names; "an already-existing `api.alerts.countBySeverity` subscription" / "zero data-fetching hook calls" instead of the literal `useQuery(...)` call).
- **Files modified:** `src/index.css`, `src/components/SignalHorizon.tsx`
- **Verification:** Re-ran both greps after each edit; both return the exact counts the plan specifies (0).
- **Committed in:** `31966778` (Task 1), `a27e151c` (Task 2)

**2. [Rule 1 - Bug, live-code correction] The plan's literal `<interfaces>` signature does not compile under this repo's tsconfig**
- **Found during:** Task 2
- **Issue:** `export default function SignalHorizon(props: {...}): JSX.Element` — the plan's own `<interfaces>` block — fails `npx tsc --noEmit` with `TS2503: Cannot find namespace 'JSX'`. Repo-wide grep for `): JSX.Element` in `.tsx` files returns zero other hits; this project's `tsconfig.app.json` (`"jsx": "react-jsx"`) does not expose a global `JSX` namespace the way older `@types/react` configurations did.
- **Fix:** Removed the explicit return-type annotation; TypeScript infers the identical effective return type from the JSX the function returns. No change to the function's parameters, exports, or call signature.
- **Files modified:** `src/components/SignalHorizon.tsx`
- **Verification:** `npx tsc --noEmit` exits 0 after the change.
- **Committed in:** `a27e151c` (Task 2)

---

**Total deviations:** 2 auto-fixed (both Rule-1, both caught during acceptance-criteria/type-check verification before committing; neither changed the shipped state-machine behavior)
**Impact on plan:** No scope creep. Both fixes were required for the plan's own stated acceptance criteria (grep counts, `tsc --noEmit` exit code) to actually hold against the live toolchain.

## Mutation Proofs (verbatim)

### Mutation 1 — rule 2 changed from `return "unknown"` to `return "resting"`

Command: `npx vitest run src/components/SignalHorizon.test.tsx`

```
 ❯ |unit| src/components/SignalHorizon.test.tsx (19 tests | 7 failed) 58ms
     × (a) MOUNT: before any frame, state is unknown — named explicitly, not inferred from an absence of resting 21ms
     × (b) DELAYED SNAPSHOT: connected with no frame for 14s stays unknown; a valid disarmed frame at 14s reaches resting — proves the timeout did not fire early 3ms
     × (c) MISSING SNAPSHOT: connected, no frame ever, past 15s stays unknown, and a further 5 minutes stays unknown — never resting 4ms
     × (d) MALFORMED SNAPSHOT: after a valid disarmed frame reaches resting, each of four malformed shapes lands in unknown, and none of the pushes throw 5ms
     × (f) RECONNECT: from critical, disconnecting drives offline, and reconnecting lands on unknown IMMEDIATELY (not critical resumed from memory), staying unknown until a fresh frame arrives 5ms
     × rule 2: a null snapshot yields unknown even while connected
     × rule 2: reconnecting with a null snapshot also yields unknown, not offline

 Test Files  1 failed (1)
      Tests  7 failed | 12 passed (19)
```

Each failure: `AssertionError: expected 'resting' to be 'unknown' // Object.is equality`. Reverted; `git diff src/components/SignalHorizon.tsx` returned empty (confirmed via `echo $?` = 0 with no output).

**GREEN after revert:**
```
 Test Files  1 passed (1)
      Tests  19 passed (19)
```

### Mutation 2 — the `status !== "connected"` snapshot-clear branch emptied

Command: `npx vitest run src/components/SignalHorizon.test.tsx`

```
 ❯ |unit| src/components/SignalHorizon.test.tsx (19 tests | 1 failed) 43ms
     × (f) RECONNECT: from critical, disconnecting drives offline, and reconnecting lands on unknown IMMEDIATELY (not critical resumed from memory), staying unknown until a fresh frame arrives 6ms

AssertionError: expected 'critical' to be 'unknown' // Object.is equality

Expected: "unknown"
Received: "critical"

 Test Files  1 failed (1)
      Tests  1 failed | 18 passed (19)
```

Exactly case (f) failed — the stale armed snapshot survived the reconnect back into "connected". Reverted; `git diff` empty.

**GREEN after revert:**
```
 Test Files  1 passed (1)
      Tests  19 passed (19)
```

### Mutation 3 — the malformed branch changed to `return` without clearing

Command: `npx vitest run src/components/SignalHorizon.test.tsx`

```
 ❯ |unit| src/components/SignalHorizon.test.tsx (19 tests | 1 failed) 43ms
     × (d) MALFORMED SNAPSHOT: after a valid disarmed frame reaches resting, each of four malformed shapes lands in unknown, and none of the pushes throw 7ms

AssertionError: expected 'resting' to be 'unknown' // Object.is equality

Expected: "unknown"
Received: "resting"

 Test Files  1 failed (1)
      Tests  1 failed | 18 passed (19)
```

Exactly case (d) failed — a malformed payload left the previous `resting` snapshot in place instead of clearing to Unknown. Reverted; `git diff` empty.

**GREEN after revert:**
```
 Test Files  1 passed (1)
      Tests  19 passed (19)
```

## Issues Encountered

None beyond the two Rule-1 deviations documented above. `npm test` (full suite, run twice — once mid-plan after Task 2/3, once again after the mutation-testing round) shows unrelated pre-existing `jsdom` canvas warnings ("Not implemented: HTMLCanvasElement's getContext()") from other test files; these are not new and do not affect pass/fail counts.

## User Setup Required

None — no external service configuration required. This plan installs nothing (per the threat model's `T-125-04-SC` disposition) and deploys nothing (no `convex deploy` anywhere in this plan's diff — confirmed by inspection of all three commits' `git show --stat` output).

## Next Phase Readiness

- `SignalHorizon.tsx`'s default export and `resolveHorizonState`/`HorizonState` exports are ready for plan 125-08 to mount, exactly matching this plan's `<interfaces>` contract (with the one non-behavioral return-type-annotation correction documented above).
- `src/index.css`'s `.signal-horizon` class and its `data-horizon-state` attribute selectors are ready for 125-08 to attach beneath the shell header; `.packet`/`@keyframes travel` remain unbuilt, as scoped.
- The component is verified against a fully simulated `estop_state` wire shape and requires no astridr-repo rebuild to exercise any of its states — satisfies this plan's stated goal of decoupling the state-layer proof from the operator-gated Docker rebuild (D-01's cross-repo half, still pending in 125-03/125-12).
- No blockers for 125-08.

## Acceptance Criteria Verified

- **Task 1:** `npm run build` exits 0; `grep -c "aurora-drift" src/index.css` = 2; `grep -c 'data-horizon-state="unknown"' src/index.css` = 1, `="offline"` = 1; `grep -cE "--dur-1|--dur-2|--dur-3|--ease-out" src/index.css` = 0; hex-colour count in the added block = 0; `grep -c "aurora-drift" dist/assets/*.css` ≥ 1 (found in `index-*.css`); `npx vitest run src/entryChunk.ratchet.test.ts` passes (3/3).
- **Task 2:** `npx tsc --noEmit` exits 0; `grep -c "useQuery" SignalHorizon.tsx` = 0; `grep -c 'subscribeEvent("estop_state"' SignalHorizon.tsx` = 1; `grep -c "import.meta.env.DEV"` = 2 (≥1); post-build `grep -l "__signalHorizonStub" dist/assets/*.js` finds no file (empty result, exit 1) — note this is consistent with, but does not independently distinguish, DEV-elimination from simple tree-shaking of an as-yet-unimported module; 125-08's mount is the point at which this proof becomes load-bearing; hex-colour count = 0.
- **Task 3:** `npx vitest run SignalHorizon.test.tsx` exits 0 with 19 passing tests (≥12 required); `grep -c '"unknown"'` = 10 (≥5 required); `grep -cE "not\.toBe\(\"resting\"\)"` = 0 (no bare absence-only assertions used — every Unknown case asserts the positive `toBe("unknown")` directly); all three mutation runs captured verbatim above with GREEN restored after each revert; `npm test` exits 0 (5008 passed, 0 failed).

**Fail-closed entry paths, each independently proven entered (not merely inferred from an absence of resting):**
1. **Mount** — test (a): before any frame, `data-horizon-state="unknown"` asserted directly.
2. **Reconnect** — test (f): status flips `connected → disconnected → connected`; state is `unknown` immediately upon reconnecting, asserted directly, before any new frame.
3. **Connect-scoped freshness timeout** — tests (b)/(c): no frame for 14s (still unknown, proving no early fire), no frame ever past 15s and past 15s+5min (still unknown, proving no fallback to resting).
4. **Malformed payload** — test (d): four distinct malformed shapes (`{}`, `{data:null}`, `{data:{armed:"true"}}`, `{data:{}}`), each individually asserted to land in `unknown` after starting from `resting`, with a paired no-throw assertion (T-125-04-04's mitigation).

**Zero new Convex subscriptions:** `grep -c "useQuery" src/components/SignalHorizon.tsx` = 0 (verified above); the file imports nothing from `convex/react` or `convex/_generated/api`.

---
*Phase: 125-signature-layers*
*Completed: 2026-08-24*

## Self-Check: PASSED

All 3 created/modified files confirmed present on disk (`src/index.css`,
`src/components/SignalHorizon.tsx`, `src/components/SignalHorizon.test.tsx`),
plus this SUMMARY. All 3 task-commit hashes (`31966778`, `a27e151c`,
`24ad5871`) confirmed present via `git log --oneline --all`.
