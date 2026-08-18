---
created: 2026-08-17
source: Phase 120 close-out (observed, not caused, by this phase)
severity: low
status: pending
---

# Intermittent failure: workspaceScan deep-tree test, full-suite only

`hooks/__tests__/workspaceScan.test.mjs` →
`Suite 4 — D-06: excludeDirs pruning and no numeric depth cap` →
`prunes node_modules entirely while still descending 11 levels deep under a non-excluded tree`

Failed **once** during a full `npx vitest run` at the Phase 120 close-out. Not root-caused.

## What is established

- **Not caused by Phase 120.** `git log 87ffe54f..HEAD -- hooks/` is EMPTY — the phase touched
  nothing in `hooks/`. The file was last modified 2026-08-13 by `f6ceafcd` (Phase 115-09).
- **Passes in isolation, repeatedly.** `npx vitest run hooks/__tests__/workspaceScan.test.mjs`
  returned 49/49 on three consecutive runs.
- **The next full run was green** — 336 files / 4692 tests, 0 failed. So it is non-deterministic,
  not a persistent break.
- **Fixtures are isolated.** The test uses `mkdtempSync(join(tmpdir(), …))` and cleans up in a
  `finally`; it never touches the repo, so unrelated repo churn (e.g. a `graphify update` run
  immediately beforehand) cannot reach it.

## What is NOT established

The mechanism. The plausible-but-unproven candidate is a Windows filesystem visibility/timing
effect: the case does an 11-level `mkdirSync(..., {recursive:true})` and then immediately walks it
with `readdirSync`, inside a 353-file parallel suite under heavy I/O. That is a hypothesis, not a
diagnosis — it has not been instrumented or reproduced deliberately.

## Why this is filed rather than dismissed

Project rule: an intermittently-failing test is shared-fixture corruption until proven otherwise,
and must not be filed as "flakiness" without investigation. The investigation above bounds it
(not this phase, isolated fixtures, self-recovering) but does not explain it. Filed so the next
observation has a prior rather than starting from zero.

## If it recurs

Capture the assertion detail (which of the three `expect`s failed), and check whether it is the
`node_modules` pruning assertion or the deep-row `fileCount`. Those point at different mechanisms:
the former at exclusion logic, the latter at the mkdir/readdir visibility race.
