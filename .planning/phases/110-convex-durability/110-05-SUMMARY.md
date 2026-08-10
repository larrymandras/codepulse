---
phase: 110-convex-durability
plan: 05
subsystem: database
tags: [convex, retention, powershell, ops-script, self-hosted, health-check]

# Dependency graph
requires:
  - phase: 110-04
    provides: "listRetentionPolicy live and reachable as internalQuery via `npx convex run --env-file <path> retention:listRetentionPolicy`, deployed policy readback (19 keys) as the source-of-truth cross-check target"
provides:
  - "retention-health-check.ps1 reads the deployed retention policy live via retention:listRetentionPolicy instead of a hand-copied 14-entry hashtable (D-07)"
  - "a hard non-zero-exit failure path on a failed/non-JSON/empty policy read, proven to fire by an attended deliberate-break test, with no fallback table list"
  - "DUR-02 leg 2: a full health-check run covering all 19 deployed tables, three-way count cross-check, five previously-invisible tables confirmed visible by name"
  - "an open item (events TIMEOUT) explicitly deferred to a clean re-run alongside plan 110-06, not silently closed"
affects: [110-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "unversioned ops script edited with hash-verified backup + bounded diff as the sole rollback path, since the file isn't under git until Phase 113"
    - "hard-fail-no-fallback health check: a coverage-critical read that can silently degrade to a stale subset is treated as a security-relevant defect, not a convenience feature"
    - "deliberate-break test as the only way to prove a failure path fires, distinct from describing it"

key-files:
  created:
    - .planning/phases/110-convex-durability/110-05-SUMMARY.md
  modified:
    - C:/Users/mandr/convex-selfhost/retention-health-check.ps1 (unversioned; backed up at .pre-110.bak)
    - .planning/phases/110-convex-durability/110-DUR-EVIDENCE.md

key-decisions:
  - "Operator decision: leg 2 closes on coverage now (fully proven — three-way count cross-check equal at 19, five previously-invisible tables confirmed by name); the events TIMEOUT is recorded as an explicit open item, not resolved by this plan, with a clean zero-TIMEOUT run deferred to tomorrow morning post-02:00-restart, in the same session as plan 110-06."
  - "Operator decision: the deliberate-break test was run by the orchestrator in the attended session (operator chose 'I run it, you review the output'), not by the executor."
  - "The break test's rollback target was a fresh snapshot of the EDITED script, NOT .pre-110.bak — that backup holds the pre-edit original, so restoring from it would have silently undone the entire plan under test. Restore proven byte-identical by hash."
  - "A false claim was written into 110-DUR-EVIDENCE.md by the orchestrator and corrected in commit c214fcdb: the 172.8h aggregates overhang does NOT clear after the first prune. The deployed health check measures the oldest doc in a table, not the oldest the pruner would delete, so the permanently-protected oldest daily row keeps the ALERT lit and growing. This is a defect Phase 110 introduced."

requirements-completed: [DUR-02]

# Metrics
duration: ~50min (across two working windows: Tasks 1-2, then the Task 3 checkpoint closure)
completed: 2026-08-10
---

# Plan 110-05 Summary — Health check reads the live retention policy

**Plan:** `110-05-PLAN.md` (wave 4, `autonomous: false`, requirements DUR-02)
**Status:** Complete — 3/3 tasks
**Date:** 2026-08-10

## What shipped

`C:/Users/mandr/convex-selfhost/retention-health-check.ps1` no longer carries a hand-copied policy
table. Its 14-entry `$RetentionDays` hashtable and the "Keep in sync if that map changes" comment
were deleted outright (D-07 requires the copy to go, not to be updated) and replaced by a live read
of the deployed `retention:listRetentionPolicy`. The probe loop's body is byte-identical; only its
`foreach` header changed, from `$RetentionDays.Keys` to `$Policy.PSObject.Properties.Name`. The
verdict log line gained `tables=<count>` so a run covering the wrong number of tables is legible in
`retention-health.log` after the fact rather than only at the terminal.

**Why this mattered.** The copy held 14 entries against the deployed policy's 19.
`gatewayQuotaSnapshots`, `toolPolicyEvents`, `activeEngineSnapshots` and `controlVerbSwaps` had
been invisible to every health check that ever ran — this morning's `verdict=OK ... all tables
caught up` was a claim about 14 tables, not all of them — and `aggregates` would have become the
fifth silent omission the moment plan 110-03 shipped.

## Commits

| Commit | What |
|---|---|
| `1e8ddccc` | Script edit + DUR-02 leg 2 capture in `110-DUR-EVIDENCE.md` |
| (this summary) | Task 3 closure: operator decisions, break-test transcript, summary |

The `.ps1` itself is **outside the repo and unversioned** until Phase 113, so it does not appear in
any commit. Its backup is the only rollback path that exists.

## Key results

- **Three-way count cross-check, all equal at 19:** tables probed by the run = `Object.keys(RETENTION_DAYS).length` from source = deployed `listRetentionPolicy` key count.
- **The five formerly-invisible tables report by name:** `gatewayQuotaSnapshots`, `toolPolicyEvents`, `activeEngineSnapshots`, `controlVerbSwaps` all ok/0h overhang; `aggregates` ok with a 172.8h overhang.
- **Backup:** `.pre-110.bak`, pre-edit hash `F0A156BEA17EF7EC9E6B9CB08B9194E98A0EDD914713832478190FFCC3906817`, verified byte-identical to the original before editing. Post-edit hash `3F579801768BADD75E5E6AF4D1DD13E220E46BC3F984730C92CD1DBB1D073492`.
- **Parse check:** `PARSE_OK`, zero parser errors, error array explicitly inspected rather than exit code alone. A script that fails to parse would make the 05:30 scheduled task silently do nothing.
- **Hard-failure path proven, not described** — see deviations.

## Deviations from the plan

**1. The zero-`TIMEOUT` acceptance criterion was NOT met, and is not claimed to be.**
`events` returned `SystemTimeoutError` during the attended run. Per the plan and the dispatch, it
was recorded verbatim and **not** re-run — a timeout on this instance is itself a signal about
instance health, and repeating the read is the exact pressure CLAUDE.md's operational rules warn
against.

The orchestrator then checked whether the 14→19 change caused it. It did not: `retention-health.log`
records index-head timeouts on `2026-08-04` (41.7 GiB) and `2026-08-05` (45.95 GiB), both before
any Phase 110 code existed, with clean runs 08-06 → 08-10 at lower memory. Timeouts on this
instance track memory pressure, not table count.

Operator response, verbatim: **"Record it, re-run clean tomorrow"**. Leg 2 therefore closes on
**coverage only**. A clean zero-TIMEOUT run is deferred to tomorrow morning, after the 02:00
restart clears memory, in the same session as plan `110-06`.

**2. Leg 2's claim is bounded to coverage, deliberately.**
`empty-or-caught-up` is ambiguous between pruned, empty, and nothing-aged-out. This leg proves
every table in the policy is now *visible* to the check. It does **not** prove a prune executed —
that claim belongs to leg 1, in plan `110-06`, and is not asserted here.

**3. Task 3's break test was run by the orchestrator, not the operator.**
The plan asks the operator to perform it. Operator chose "I run it, you review the output", so it
was run in the attended main session with the transcript presented for review.

**4. Plan defect, corrected during execution.** The plan's Task 1 says to restore from
`.pre-110.bak` if anything goes wrong. For the break test that would have been actively harmful:
`.pre-110.bak` holds the *pre-edit original*, so restoring from it would have silently undone the
entire plan. A separate snapshot of the *edited* script was taken as the break test's rollback
target, and the restore was proven byte-identical by hash.

## The break test

Injected a nonexistent function name into the policy read and ran the script:

- Emitted the distinct verdict `policy read failed -- CLI exit 1: ... Could not find function`
- **Exit code 1** (non-zero)
- Probed **zero** tables
- Explicitly logged `no fallback table list used`

Then restored: hash matches the pre-test edited script exactly, 1 occurrence of the real function
name, 0 of the bogus one. `.pre-110.bak` intact. `ConvexRetentionHealthCheck` still `Ready`, next
run `8/11/2026 5:30:00 AM`, unmodified.

This is what makes the hard-failure path a fact rather than a design intention. A health check that
degrades to a stale subset while still printing a verdict is the defect D-07 exists to remove.

## Open item carried forward

- **`events` index-head TIMEOUT** — needs a clean run tomorrow post-02:00-restart to close DUR-02 leg 2's zero-TIMEOUT criterion. Pre-existing and memory-correlated; not introduced by this plan.
- Backend memory went 16.02 GiB (05:30) → 23.57 (16:44) → 32.51 (18:00, flat at 18:05). The day's organic rate explains ~1.3 of the ~8.9 GiB jump; the wave-3 deploy and this run's 19 probes both sit in that window. Recorded as **correlation, not causation** — no experiment isolated it.

## Self-Check: PASSED

Coverage objective fully met and proven three ways. Hard-failure path proven to fire. Backup and
scheduled task intact. One acceptance criterion (zero TIMEOUT) explicitly not met, recorded as an
open item with operator sign-off on that disposition rather than waved through.
