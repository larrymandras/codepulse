---
created: 2026-08-17
source: Phase 120 close-out (observed, not caused, by this phase)
severity: low
status: resolved
---

# RESOLVED 2026-08-18 — it was a real production bug, not a flaky test

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


---

# RESOLUTION (2026-08-18)

**Root cause: `fs.Stats.ino` is a JS double, and Windows NTFS FileIds exceed it.**

`walkRoot`'s D-06 cycle guard keyed directory identity on `` `${st.dev}:${st.ino}` `` from a plain
`statSync`. `ino` is a double, and the NTFS 64-bit FileId routinely exceeds
`Number.MAX_SAFE_INTEGER` — **measured: 11,692 of 11,700 sampled directories, 99.9%**. The
low-order bits round away, so directories created milliseconds apart collapse to the SAME number.
The guard then reads a real subtree as "we have been here", prunes it, and counts it as a cycle.

Every observed collision was between **adjacent** directories (`c==b`, `e==d`, `j==i`) — the
signature of sequential FileId allocation losing its low bits.

## The measurements

| probe | result |
|---|---|
| Sequential, single process, 480 dirs | 0 collisions — **this is why it looked fine in isolation** |
| 8-way parallel, 1,600 rounds | 85 duplicate `dev:ino` pairs among dirs that all existed simultaneously |
| 8-way parallel stress of the real walker, 480 walks | **2 truncated walks**, `cyclesSkipped=1`, deep row missing |
| Paired control, 11,700 dirs | `number`: **215 collisions** · `{ bigint: true }`: **0** |
| Same stress after the fix, 480 then 1,600 walks | 0 failures, 0 cycles |

## Why this mattered beyond the test

`hooks/workspaceScan.mjs` backs the daily `CodePulse-WorkspaceScan` task that ingests ~4,900
directories into Convex. A false cycle hit **silently drops an entire subtree from the workspace
map** — and the module's own header promises the opposite: *"a silent truncation by depth number
would present as a mysteriously incomplete map with no signal that anything was cut."* A FALSE
cycle is indistinguishable from a real one in the warning count, so the existing signal could not
reveal it. Bursty tree creation (checkout, clone, unzip, build output) is exactly the condition
that triggers it.

## The fix

`walkRoot` now reads identity through a `dirIdentity()` helper using `statSync(p, { bigint: true })`,
which preserves the full 64-bit FileId. **Only identity stats use bigint** — file stats stay
numeric because `size`/`mtime` feed arithmetic and the epoch-SECONDS convention. Suite 7's
`statSync` wrapper now forwards its options argument so it cannot silently downgrade precision.

## The guard

Suite 4 could only catch this **~0.4% of the time under load**, so it was never a guard. Suite 4b
is deterministic: an injected `statSync` returns inos that collide when the options argument is
ignored and are distinct when honoured, plus a **CONTROL** asserting a genuine repeated identity
IS still pruned — without which the test would pass against a walker with no cycle guard at all.

Mutation-proven: reverting `dirIdentity` to a numeric stat turns exactly the regression test RED
(1 failed / 50 passed) while the control stays green.

## Class sweep

`git grep` for inode-identity usage across `hooks/ src/ convex/ scripts/` returns exactly one
site — the one fixed. No sibling instances.
