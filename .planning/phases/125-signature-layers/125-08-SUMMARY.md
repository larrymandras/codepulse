---
phase: 125-signature-layers
plan: 08
subsystem: ui
tags: [css, websocket, react, dashboard-layout, error-boundary, vitest, aurora, signal-horizon]

# Dependency graph
requires:
  - phase: 125-signature-layers
    provides: "125-04: .signal-horizon CSS + resolveHorizonState() fail-closed state machine + SignalHorizon.tsx's <interfaces> contract"
provides:
  - "src/index.css: .signal-horizon .packet + @keyframes travel, hidden under reduced-motion/readable"
  - "src/components/SignalHorizon.tsx: the event-packet spawner (WeakSet identity dedup, D-07 1s coalescing gate, TOPIC_EVENT_MAP subscription, estop_state exclusion)"
  - "src/layouts/DashboardLayout.tsx: SignalHorizon mounted on every route, one hoisted api.alerts.countBySeverity call feeding both SystemChip and the horizon's alertLevel, header border-b removed"
affects: [125-09, 125-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "WeakSet identity dedup for a WS message object fanned out to multiple topic subscribers (AstridrWSContext.tsx's unknown-event-type branch delivers the SAME object reference to every topic Set)"
    - "try/catch around a hoisted useQuery call, converting a genuine query throw to a distinguishable sentinel value, re-thrown from within the ORIGINAL consumer's own SectionErrorBoundary-wrapped subtree -- restores per-widget fault isolation after hoisting a shared subscription out of its sole prior caller"
    - "ratio-based (not absolute-count) useQuery call-count spy in a test suite whose minimal api mock makes an unrelated pre-existing component throw and get error-boundary-recovered, doubling every hook call in the render pass"

key-files:
  created: []
  modified:
    - src/index.css
    - src/components/SignalHorizon.tsx
    - src/components/SignalHorizon.test.tsx
    - src/layouts/DashboardLayout.tsx
    - src/layouts/__tests__/DashboardLayout.test.tsx

key-decisions:
  - "Wrapped the hoisted `useQuery(api.alerts.countBySeverity)` call in DashboardLayout's body in try/catch, converting a genuine query throw to an \"error\" sentinel that SystemChip re-throws from within its OWN SectionErrorBoundary -- without this, hoisting the call out of SystemChip's subtree would have let a query failure blank the WHOLE layout instead of one header chip, the exact failure D-13 exists to prevent, at a far larger blast radius. Mutation-proofed live."
  - "Case (c)'s plain 'unknown-type fan-out' packet test does NOT discriminate the WeakSet mechanism -- all five topic deliveries share one synchronous tick and therefore one Date.now() reading, so the 1s drop-gate alone already collapses them to one packet with or without identity dedup. Added a SEPARATE mechanism-isolated test that spreads redeliveries of the SAME message object past the drop-gate and spies on host.appendChild (not final DOM state, since every packet also auto-removes after 700ms) -- this is the one that actually goes red when the WeakSet check is removed."
  - "SystemChip's prop type became `AlertSeverityCounts | \"error\"` rather than adding a fourth loading-vs-error UI state -- the sentinel exists purely to route a genuine throw back through re-throw-and-catch, not to change what SystemChip renders for any resolved value."

patterns-established:
  - "When hoisting a useQuery call out of its sole prior caller into a shared parent, the ORIGINAL caller's SectionErrorBoundary becomes unreachable for that call's own throws unless the parent explicitly catches and re-signals into the original subtree."

requirements-completed: [SIGNAL-01]

# Metrics
duration: ~75min
completed: 2026-08-24
---

# Phase 125 Plan 08: Signal Horizon Event Packets and Shell Mount Summary

**Event packets crossing the Signal Horizon at 48px/620ms, coalesced to 1/second and identity-deduped against multi-topic fan-out, mounted on every route via one hoisted `api.alerts.countBySeverity` call that now also feeds `SystemChip` — with a discovered-and-fixed error-isolation regression from the hoist itself.**

## Performance

- **Duration:** ~75 min
- **Tasks:** 3/3
- **Files modified:** 5 (0 created, 5 modified)

## Accomplishments

- `src/index.css`: `.signal-horizon .packet` + `@keyframes travel` (48px, 620ms, `--ease-house`), hidden under both `prefers-reduced-motion` and `readable` as a belt-and-braces CSS backstop alongside the JS gate.
- `src/components/SignalHorizon.tsx`: subscribes to every `TOPIC_EVENT_MAP` topic only when motion is allowed (zero subscriptions otherwise — the D-04 gate registers nothing rather than subscribing-and-discarding), dedups by WS message object identity via `WeakSet`, applies the D-07 1s drop-gate (`useLiveFlash.ts:22-24`'s exact shape), colours via `eventTypeToHue`/`HUE_TOKEN`, and explicitly excludes `estop_state` (a state transition the machine above already visualises, not traffic).
- `src/layouts/DashboardLayout.tsx`: `SignalHorizon` mounted statically between `<header>` and `<main>`, wrapped in its own `SectionErrorBoundary` whose fallback is a plain hairline making no state claim. `api.alerts.countBySeverity` hoisted out of `SystemChip` into the layout's own body, `alertLevel` derived and passed to `SignalHorizon`, `counts` passed to `SystemChip` as a prop (rendered output unchanged). Header's `border-b border-border` removed — the horizon is now the separator.
- **Discovered-and-fixed regression:** the hoist moved `useQuery(api.alerts.countBySeverity)` to an UNPROTECTED top-level scope. A genuine query throw there would have blanked the entire `DashboardLayout` tree instead of just the header chip — exactly the fault-isolation failure Phase 124's D-13 exists to prevent, at a much larger blast radius. Caught with try/catch, converted to a distinguishable `"error"` sentinel, re-thrown from within `SystemChip`'s own `SectionErrorBoundary`-wrapped subtree. Mutation-proofed live: removing the try/catch turns the pre-existing D-13 "Alerts-query throw" test RED with the raw error escaping to the render root.
- `src/components/SignalHorizon.test.tsx` (19 → 28 tests): coalescing with a removed-packet control, hue via inline `--pk` style, unknown-type fan-out, a **mechanism-isolated** identity-dedup proof (see Deviations), motion suppression under reduced-motion and `readable` with a control, `estop_state` exclusion delivered through both mocked subscription paths, and unmount timer cleanup via `vi.getTimerCount()`.
- `src/layouts/__tests__/DashboardLayout.test.tsx`: fixed the `AstridrWSContext` mock (module-level factory + all nine per-test overrides) to export the real `TOPIC_EVENT_MAP` and a working `subscribe()` — without this the packet effect threw `Cannot convert undefined or null to object` on every render, silently swallowed by `SignalHorizon`'s own `SectionErrorBoundary`, masking the horizon behind its hairline fallback in every one of the 34 pre-existing tests (confirmed live via a throwaway probe before fixing). Added horizon DOM-position (`compareDocumentPosition`), a ratio-based `useQuery` call-count spy, and a header `border-b` absence check.
- Three mutation proofs performed live and reverted (verbatim below).
- Manual smoke on a Clerk-free `npm run dev` (`VITE_CLERK_PUBLISHABLE_KEY=` on port 5199, per the established recipe): the horizon renders on `/`, `/alerts`, and `/settings` (all `data-horizon-state="resting"`), and `window.__signalHorizonStub({ armed: true })` flips it to `data-horizon-state="critical"` — screenshot confirms a solid crimson line replacing the header's separator.

## Task Commits

1. **Task 1: Packet CSS and the coalescing spawner** — `76a97e77` (feat)
2. **Task 2: Mount the horizon in the shell on one hoisted alert-count call** — `156ac758` (feat)
3. **Task 3: Prove coalescing, motion suppression, single-subscription and mount position** — `17ec73b4` (test)

## Files Created/Modified

- `src/index.css` — `.signal-horizon .packet` + `@keyframes travel`, hidden under reduced-motion and `readable`.
- `src/components/SignalHorizon.tsx` — packet spawner (subscribe/dedup/coalesce/colour/exclude), `horizonRef` wired into the rendered element.
- `src/components/SignalHorizon.test.tsx` — 9 new tests: coalescing, hue, unknown-type, mechanism-isolated identity dedup, motion suppression (x2), readable theme, `estop_state` exclusion, unmount cleanup.
- `src/layouts/DashboardLayout.tsx` — hoisted `alertCounts`/`alertLevel`, `SystemChip` takes `counts` prop and re-throws on the `"error"` sentinel, `SignalHorizon` mounted, header `border-b` removed.
- `src/layouts/__tests__/DashboardLayout.test.tsx` — `AstridrWSContext` mock fix (`TOPIC_EVENT_MAP` + working `subscribe`), 3 new tests (position, call-count ratio, `border-b` absence).

## Decisions Made

See `key-decisions` in frontmatter: the try/catch fault-isolation fix, the mechanism-isolated dedup test, and the `"error"`-sentinel prop type.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — missing critical functionality] Hoisting `useQuery` out of `SystemChip` removed its fault isolation**
- **Found during:** Task 2, running the pre-existing `DashboardLayout.test.tsx` suite.
- **Issue:** The plan's action text says only "Move `useQuery(api.alerts.countBySeverity)` OUT of `SystemChip` and up into `DashboardLayout`'s own body." Doing exactly that put the call in an UNPROTECTED top-level scope. `codepulse/CLAUDE.md`'s own documented lesson: "A Convex query that throws is unhandled at the `useQuery` boundary... it unmounts the React tree and blanks EVERY page using that hook." Before the hoist, a `countBySeverity` throw hit `SystemChip`'s own direct call and was caught by `SystemChip`'s own "System status" `SectionErrorBoundary` (D-13). Confirmed live: the pre-existing "contains an Alerts-query throw" test failed with the raw `Error: simulated countBySeverity failure` escaping all the way to `DashboardLayout`'s own render, not to any boundary.
- **Fix:** Wrapped the hoisted call in try/catch, converting a throw to a distinguishable `"error"` sentinel (never confused with the real `undefined`/loading state), and had `SystemChip` re-throw that sentinel from WITHIN its own boundary-wrapped subtree — restoring the original per-widget fault isolation without re-subscribing.
- **Files modified:** `src/layouts/DashboardLayout.tsx`
- **Verification:** Mutation-proofed — removing the try/catch (replacing with a bare assignment) turned the D-13 throw test RED again (`Error: simulated countBySeverity failure` at `DashboardLayout.tsx:698`), confirmed, then reverted and re-verified GREEN (34/34, then 37/37 after Task 3's additions).
- **Committed in:** `156ac758` (Task 2)

**2. [Rule 1 — plan-text correction, grep-count acceptance criterion] "exactly 1" `api.alerts.countBySeverity` call site is unsatisfiable against live code**
- **Found during:** Task 2, running the plan's own acceptance-criteria greps.
- **Issue:** The plan's acceptance criterion says `grep -c "api.alerts.countBySeverity" src/layouts/DashboardLayout.tsx` must return exactly 1. Live code (confirmed via `Read`, not inferred) already had TWO call sites before this plan: `AlertsCountBadge` (Phase 124, sidebar, line ~168) and `SystemChip` (line ~221, the one this plan's action text targets). The plan's own `<interfaces>`/`read_first` sections only pointed at `SystemChip`'s call and never mentioned `AlertsCountBadge`'s separate one. D-05's actual requirement — quoted in the plan's own `must_haves` — is "the shell gains ZERO new Convex subscriptions... feeds both consumers [SystemChip and the horizon] from one call site," which is about not DUPLICATING the call this plan touches, not about eliminating an unrelated, already-Convex-deduped, out-of-scope ("no nav") sidebar query.
- **Fix:** Implemented the hoist exactly as directed (one call site feeding `SystemChip` + `SignalHorizon`). Left `AlertsCountBadge`'s separate call untouched (explicitly out of scope per the task's own "Change nothing else... no nav" instruction). Reworded my own doc comments to avoid the literal grep-trigger substring (same self-referential-grep class as `125-04-SUMMARY.md`'s Rule 1 fix), bringing the measured count down to the true code-level baseline of 2 (not the inflated 4 my first-draft comments produced).
- **Files modified:** `src/layouts/DashboardLayout.tsx`
- **Verification:** `grep -c "api.alerts.countBySeverity" src/layouts/DashboardLayout.tsx` = 2, both attributable to genuine, distinct call sites (`AlertsCountBadge`'s pre-existing sidebar call, this plan's hoisted shell call) — reported honestly below rather than transcribed as 1.
- **Committed in:** `156ac758` (Task 2)

**3. [Rule 1 — plan-text correction, test acceptance criterion] `useQuery` call-count spy: "exactly ONCE" is also unsatisfiable, and the raw count is further inflated by an unrelated pre-existing defect**
- **Found during:** Task 3, writing test case (h).
- **Issue:** Same root cause as deviation 2 — `AlertsCountBadge` is mounted TWICE per render (desktop `<aside>` + mobile drawer `<aside>`, an already-established fact from this suite's own pre-existing tests), so the true per-render-pass baseline is THREE calls (1 hoisted + 2 sidebar instances), not one. On top of that, this test file's minimal `api` mock makes an unrelated, pre-existing component (`BrainHeaderBadge`, via `useActiveEngine`) throw (`Cannot read properties of undefined (reading 'latestByProfile')`), caught by its own `SectionErrorBoundary`; React's error-recovery mechanism then re-renders the whole tree an extra time, DOUBLING every hook call in the pass. Measured raw count: 6, not 1, not 3.
- **Fix:** Wrote the assertion as a RATIO against `systemResources:current` (called exactly once per render pass, no sidebar duplication) rather than an absolute count — this self-normalizes against the unrelated doubling defect while still catching the intended regression class (a future third/fourth call site).
- **Files modified:** `src/layouts/__tests__/DashboardLayout.test.tsx`
- **Verification:** Mutation-proofed — reintroducing `SystemChip`'s own `useQuery` call moved the ratio from 3 to 4, turning the test RED (`expected 4 to be 3`); reverted and re-verified GREEN.
- **Committed in:** `17ec73b4` (Task 3)

**4. [Rule 1 — bug, test infrastructure] `AstridrWSContext` mock in `DashboardLayout.test.tsx` silently broke the mounted horizon in every test**
- **Found during:** Task 3, before writing new tests, via a throwaway probe rendering `DashboardLayout` under the test file's own mocks.
- **Issue:** `DashboardLayout.test.tsx`'s pre-existing `vi.mock("@/contexts/AstridrWSContext", ...)` fully replaced the module without exporting `TOPIC_EVENT_MAP` (a plain named export SignalHorizon.tsx now imports for `Object.keys(TOPIC_EVENT_MAP)`) and gave `subscribe` a bare `vi.fn()` (returns `undefined`, not an unsubscribe function). Confirmed live: `SectionErrorBoundary [Signal horizon] caught: TypeError: Cannot convert undefined or null to object`, silently rendering the hairline fallback instead of the real `.signal-horizon` element in ALL 34 pre-existing tests (none of which assert on the horizon, so this went unnoticed).
- **Fix:** Changed the module-level `vi.mock` factory to `async (importOriginal)`, re-exporting the REAL `TOPIC_EVENT_MAP`; changed every `subscribe: vi.fn()` occurrence (9 total, module-level + 8 per-test overrides) to `subscribe: vi.fn(() => () => {})`.
- **Files modified:** `src/layouts/__tests__/DashboardLayout.test.tsx`
- **Verification:** Re-ran the throwaway probe — `.signal-horizon` now renders genuinely (confirmed via `outerHTML`), no `SectionErrorBoundary [Signal horizon]` console error. Full suite still 34/34 (later 37/37) passing, now exercising the REAL mounted component instead of its fallback.
- **Committed in:** `17ec73b4` (Task 3)

---

**Total deviations:** 4 (1 Rule-2 missing-functionality fix, 3 Rule-1 plan-text corrections/bug fixes)
**Impact on plan:** No scope creep — every fix was required either for correctness (deviation 1: a genuine fault-isolation regression) or for the plan's own stated acceptance criteria to hold against live, honestly-measured code (deviations 2–4). Deviation 1 is the only one that changed shipped behavior; 2–4 are test/documentation corrections.

## Mutation Proofs (verbatim)

### Mutation 1 — the 1s drop-gate replaced with `if (false) return;`

Command: `npx vitest run src/components/SignalHorizon.test.tsx -t "COALESCING"`

```
 ❯ |unit| src/components/SignalHorizon.test.tsx (27 tests | 1 failed | 26 skipped) 28ms
     × (a) COALESCING: 5 events within 900ms produce exactly ONE packet...

AssertionError: expected 5 to be 1 // Object.is equality
- Expected: 1
+ Received: 5
```

Reverted; `git diff src/components/SignalHorizon.tsx` confirmed empty before continuing. GREEN after revert: 27/27 (28 once case (c, mechanism-isolated) was added).

### Mutation 2 — the WeakSet identity-dedup check removed

Command: `npx vitest run src/components/SignalHorizon.test.tsx -t "UNKNOWN TYPE"` (case (c) as originally scoped by the plan)

```
 Test Files  1 passed (1)
      Tests  1 passed | 27 skipped (28)
```

**Case (c) alone stayed GREEN** — this is the confound documented in Deviations-adjacent decision above: all five topic deliveries land in the same synchronous tick, so the 1s drop-gate alone (unrelated to the WeakSet) already collapses them to one packet.

Command: `npx vitest run src/components/SignalHorizon.test.tsx -t "mechanism-isolated"` (the new, properly isolated test — same mutation still active)

```
 ❯ |unit| src/components/SignalHorizon.test.tsx (28 tests | 1 failed | 27 skipped) 28ms
     × (c, mechanism-isolated) IDENTITY DEDUP: ...

AssertionError: expected 5 to be 1 // Object.is equality
- Expected: 1
+ Received: 5
```

This is the test that actually discriminates the mechanism. Reverted; `git diff` confirmed empty. GREEN after revert: 28/28.

### Mutation 3 — `SystemChip` reintroduces its own `useQuery(api.alerts.countBySeverity)` call

Command: `npx vitest run src/layouts/__tests__/DashboardLayout.test.tsx -t "alerts:countBySeverity exactly"`

```
 ❯ |unit| src/layouts/__tests__/DashboardLayout.test.tsx (41 tests | 1 failed | 40 skipped) 233ms
     × (h) useQuery is called with alerts:countBySeverity exactly 3x as often as systemResources:current...

AssertionError: expected 4 to be 3 // Object.is equality
- Expected: 3
+ Received: 4
```

Reverted; `git diff --stat src/layouts/DashboardLayout.tsx` confirmed empty. GREEN after revert: 37/37 (`src/layouts/__tests__/DashboardLayout.test.tsx`), and `npx tsc --noEmit` exits 0.

## Issues Encountered

- **`npm test` (full suite) shows one unrelated failure per run, non-reproducing.** Run 1: `src/App.test.tsx > App lazy routes... resolves '/memory' past its lazy boundary` timed out at 25000ms; isolated rerun passed cleanly in 3.01s. Run 2 (immediately after): a DIFFERENT test failed — `src/components/control-center/IntelligenceFeedPanel.test.tsx`, a class-name assertion mismatch. Neither failing file was touched by this plan's diff; `IntelligenceFeedPanel.test.tsx` is inside `src/components/control-center/`, the directory this plan's own `<shared_checkout_warning>` names as the concurrent astridr-repo-f3 session's (Phase 195 persona-dials) territory — its failure is very likely a working-tree snapshot race with that session's concurrent edits, not a defect in this plan's code. This matches the SAME class already documented at `.planning/todos/pending/test-isolation-full-suite-only-failures.md` ("full-suite-only, unreproduced, different mechanism each observation") — not creating a new todo entry since that one already exists and covers the pattern; recording here per the Verification Discipline rule rather than silently omitting it. `AvatarAura.browser.test.tsx` (the one pre-approved deferral this plan's dispatch explicitly named) did NOT recur in either run.
- Task-scoped test command (`npx vitest run src/components/SignalHorizon.test.tsx src/layouts/__tests__/DashboardLayout.test.tsx`) is green: 65/65 passing (69 with 4 pre-existing `test.todo` placeholders), both runs.

## User Setup Required

None — no external service configuration required. This plan installs and deploys nothing.

## Next Phase Readiness

- The horizon is live on every route with real event packets; plan 125-12 (the astridr-repo `estop_state` emitter) is the remaining half of the state machine's live-wire proof — this plan's dev-only `window.__signalHorizonStub` stub confirms the render path independent of that rebuild.
- `SignalHorizon.tsx`'s exported contract is unchanged from 125-04's — no interface changes for downstream plans to react to.
- No blockers for 125-09 (ECG backfill+live merge) or 125-12.

## Acceptance Criteria Verified

- **Task 1:** `grep -c "@keyframes travel" src/index.css` = 1; `grep -cE "--dur-1|--dur-2|--dur-3|--ease-out" src/index.css` = 0; `grep -c "1000" SignalHorizon.tsx` = 2 (≥1, the drop-gate line quoted above); `grep -c "WeakSet"` = 2 (≥1); `grep -c "useQuery"` = 0; `npm run build` exits 0, `grep -c "keyframes travel" dist/assets/*.css` = 1 (in `index-*.css`).
- **Task 2:** `grep -c "api.alerts.countBySeverity" src/layouts/DashboardLayout.tsx` = 2, NOT the plan's literal "exactly 1" — see Deviation 2; both call sites verified genuine and distinct (not comment noise). `grep -c "SignalHorizon"` = 2 (import + mount). `grep -c "border-b border-border"` on the header line = 0; new header className verbatim: `"min-h-14 flex-shrink-0 flex-wrap gap-y-1 bg-background/80 backdrop-blur-md flex items-center justify-between px-6 z-10 shadow-[0_4px_20px_rgba(0,0,0,0.3)]"`. `grep -c 'lazy(() => import("../components/SignalHorizon"))'` = 0 (static import, as required). `npx tsc --noEmit` exits 0. `npm run build` exits 0; measured entry JS 586,735 bytes (ceiling 594,709, headroom 7,974); entry CSS 239,650 bytes (ceiling 242,106, headroom 2,456, unmoved from Task 1 since Task 2 added no CSS).
- **Task 3:** Both suites exit 0; `SignalHorizon.test.tsx` has 28 passing tests (≥18 required — 19 from 125-04 + 9 new). Cases (a), (d), (h) each state their control explicitly (verbatim in test names/comments above and in the source). All three mutation runs' verbatim RED output captured above (including the corrected mutation-2 finding: case (c) alone does NOT go red, and why) plus GREEN after each revert. `npm test`: see Issues Encountered — 5037/5038 and 5037/5038 on two full runs, one different unrelated failure each time, neither in this plan's diff. `npx vitest run src/entryChunk.ratchet.test.ts` passes against a fresh `npm run build` — same 586,735/239,650 byte measurements as Task 2 (test files don't affect the build).

**useQuery call-site count in `DashboardLayout.tsx`, before and after this plan (proving zero NEW subscriptions):**
- Before: 2 (`AlertsCountBadge` at the sidebar, `SystemChip` calling it directly).
- After: 2 (`AlertsCountBadge` unchanged; `SystemChip`'s own call replaced by the ONE hoisted call in `DashboardLayout`'s body, now also feeding `SignalHorizon`'s `alertLevel`).
- Net new subscriptions: 0. The call-site COUNT is unchanged; what changed is WHO calls it (`SystemChip` no longer does, `DashboardLayout` now does, feeding two consumers).

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: fault-isolation-regression-fixed | `src/layouts/DashboardLayout.tsx` | Hoisting `useQuery(api.alerts.countBySeverity)` to an unprotected top-level scope would have let a genuine query throw blank the WHOLE layout instead of one header chip (analogous to, but not literally, T-125-08-03's disposition, which only names the packet handler). Mitigated with try/catch + a re-thrown sentinel restoring `SystemChip`'s own `SectionErrorBoundary` coverage; mutation-proofed. Not present in the plan's own threat register — recorded here since it is new surface this plan's own hoist introduced and then closed. |

---
*Phase: 125-signature-layers*
*Completed: 2026-08-24*

## Self-Check: PASSED

All 5 modified files confirmed present on disk (`src/index.css`, `src/components/SignalHorizon.tsx`,
`src/components/SignalHorizon.test.tsx`, `src/layouts/DashboardLayout.tsx`,
`src/layouts/__tests__/DashboardLayout.test.tsx`), plus this SUMMARY. All 3 task-commit hashes
(`76a97e77`, `156ac758`, `17ec73b4`) confirmed present via `git log --oneline --all`.
