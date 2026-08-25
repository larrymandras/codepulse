# Deferred Items — Phase 127

## The intermittent full-suite failure — IDENTIFIED 2026-08-25

This entry was wrong twice before being settled by measurement. All three versions are kept,
because the way each was wrong is the reusable part.

### Version 1 (plans 127-04, 127-05) — WRONG

Both plans logged `src/components/voice/AvatarAura.browser.test.tsx` as a pre-existing repo
defect attributed to commit `828a5b08` (Phase 193), via `git log --oneline -1 -- <path>`.

- A negative result is a claim about the probe: both observations came from inside git
  worktrees while multiple executors ran concurrently.
- `git log -1 -- <path>` answers "who last touched this file", never "why does it fail". Two
  executors reached the same wrong attribution independently; their agreement read as
  corroboration and was not.

### Version 2 (orchestrator) — ALSO WRONG, and it named the wrong suspect

Version 2 measured the browser test passing on main and concluded "nothing is broken". Then,
after a failure did appear on main, version 2b named `AvatarAura.browser.test.tsx` as "the most
plausible candidate" on the grounds that it is the only browser-mode test — while explicitly
flagging that circumstantial fit is not identification.

**The hedge was correct and the suspect was still wrong.** Being right about the epistemics did
not make the guess right.

### Version 3 — IDENTIFIED by capture

**The capture mechanism already existed and had simply never been pointed at this.**
`scripts/soak-vitest.mjs` (Phase 113, D-09, adversarially hardened) repeats a command N times,
writes one durable append-only line per iteration, and stops and captures full output on the
first non-PASS, distinguishing FAIL / TIMEOUT / harness ERROR. An earlier version of this entry
called for "building the capture mechanism" — that was deferred work proposed against a tool the
repo already had.

Run: `node scripts/soak-vitest.mjs --iterations 12 --log <path> --command "npx vitest run"`.
**Reproduced on iteration 1** and captured.

**The failing test is NOT the browser test. It is:**

```
FAIL  |unit| src/App.test.tsx > App lazy routes (Phase 106 Plan 04, DEBT-03)
      > resolves '/memory' past its lazy boundary and renders the page
TestingLibraryElementError: Unable to find role="heading" and name "Memory"
```

The shell (`DashboardLayout`) rendered; the lazily-imported page never mounted within the wait.

### Measurements

| Condition | `/memory` test duration |
|---|---|
| `src/App.test.tsx` alone | **499 ms** |
| full suite under load, passing run 1 | **2,516 ms** |
| full suite under load, passing run 2 | **1,916 ms** |
| full suite, the FAILING run | **23,610 ms** (wait window is 20,000 ms) |

The suite run that failed took 81.7 s against a ~50 s baseline.

**This is a hard stall, not a marginally tight window.** A typical loaded run is ~2 s and the
failure is >20 s — roughly 10×, not a gradual creep. That matters for the fix: the wait was
ALREADY widened from testing-library's 1 s default to 20 s (`src/App.test.tsx:168`,
`LAZY_ROUTE_WAIT_MS`), with a comment naming loaded full-suite runs as the reason. Widening it a
third time would be the third pass at the same non-fix and would not obviously help against an
unbounded stall.

### Open lead, explicitly NOT established

`src/App.test.tsx` mocks five heavy render libraries (`react-globe.gl`, `@react-three/fiber`,
`@react-three/drei`, `recharts`, `@xyflow/react`) but does NOT mock `react-force-graph-2d`,
which `/memory` reaches via `Memory.tsx` → `ObsidianGraph` → `ForceGraphCanvas`
(`src/components/graph/ForceGraphCanvas.tsx:9`), 1.7 MB on disk plus `d3-force-3d`. That is a
real inconsistency with the file's own convention and with this repo's documented per-file
mocking pattern.

**It is NOT demonstrated to be the cause.** In isolation the whole `/memory` case resolves in
499 ms including that import, so the import is not intrinsically expensive. Adding the mock is a
plausible mitigation, not a diagnosed fix, and must not be shipped as though it were one.

A second, also-unestablished hypothesis: a single `npm test` invocation runs BOTH the jsdom
`unit` project and a `browser` project that launches a real chromium instance
(`vitest.config.ts`). That launch is a bursty resource event and could plausibly starve jsdom
workers — which would tie together both observed symptoms (the browser test's own import failure
inside worktrees, and this stall on main). Untested.

### Status

**OPEN.** Identified, not fixed, and deliberately not patched by timeout-widening. Out of Phase
127's scope — it touches `src/App.test.tsx`, which no Phase 127 plan owns, and no `convex/**`
test has ever been implicated. Every `convex/**` test was deterministic and green across all 8+
full-suite runs plus every targeted run.

Reproduction is now cheap and repeatable, so the next session can start from a capture rather
than a guess.
