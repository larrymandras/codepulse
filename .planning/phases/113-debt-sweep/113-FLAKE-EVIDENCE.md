# 113-06 — Flake Soak Evidence (DEBT-06)

**Date:** 2026-08-11
**Requirement:** DEBT-06 — the intermittent `Chat.test.tsx` brain-pill failure, root-caused from a
captured failure rather than masked with a `waitFor`.
**Budget (D-09, decided by Larry):** tiered — 30 full-suite iterations, then 50 more ONLY if tier 1
is clean. Stop early and immediately on any reproduction.

## Baseline (pre-soak)

`113-06-PLAN.md` Task 1 cites a research baseline of 298 files / 3958 tests / 0 failures / 37.98s.
That baseline is STALE — this phase (113-01, 113-02, 113-03, 113-04, 113-05) added tests since it
was measured. Corrected, actually-measured baseline, taken immediately before this soak started:

```
npx vitest run
Test Files  305 passed | 17 skipped (322)
     Tests  4047 passed | 193 todo (4240)
  Duration  37.68s
```

0 failures. This is the number the soak is measured against, not the stale 298/3958 figure.

Pre-soak state:
- `git rev-parse HEAD` = `bb01248f90543967fc774b36fe0efc01993c5a35`
- `git status --porcelain -- src/` = empty (clean; only `.planning/STATE.md`, which belongs to a
  concurrent session and is never touched by this plan, was dirty)
- `git status --porcelain -- src/pages/Chat.test.tsx` = empty

## Positive control #1 (before Run 1)

Per this phase's adversarial-gate lesson, a "0 failures" result is only meaningful if the detector
provably could report one. Before trusting any soak result, the runner's FAIL path was proven live
in this environment:

Created a throwaway `src/lib/__soak-control-113-06-throwaway.test.ts` (`expect(1).toBe(2)`), ran:

```
node scripts/soak-vitest.mjs --iterations 2 --label control113-06 \
  --log <scratchpad>/113-06-control.log \
  --command "npx vitest run src/lib/__soak-control-113-06-throwaway.test.ts"
```

Result:
```
2026-08-11T22:00:45.030Z label=control113-06 iteration=1/2 status=FAIL exit=1 duration_ms=1719 capture=...
iterations_run=1 passed=0 failed=1 timed_out=0 harness_errors=0 (stopped early)
```
Capture file confirmed non-empty, contained the real `AssertionError: expected 1 to be 2`. Runner
stopped after iteration 1/2 (no `iteration=2/2` line) — the early-stop-on-FAIL path fires.
Throwaway test file and both control log artifacts deleted immediately after;
`git status --porcelain -- src/lib/` returned nothing, confirmed clean.

## Run 1 (label `tier1`) — CONTAMINATED, not a valid tier-1 result

Launched in the background:
```
node scripts/soak-vitest.mjs --iterations 30 --label tier1 \
  --log .planning/phases/113-debt-sweep/113-soak-tier1.log
```

**Derived counts (grepped from the log in the transcript, not taken from the runner's own summary
line):**

```
grep -c 'iteration=' .planning/phases/113-debt-sweep/113-soak-tier1.log   → 6
grep -c 'status=PASS' .planning/phases/113-debt-sweep/113-soak-tier1.log  → 5
grep -c 'status=FAIL' .planning/phases/113-debt-sweep/113-soak-tier1.log  → 1
grep -c 'status=TIMEOUT' ...                                              → 0
grep -c 'status=ERROR' ...                                                → 0
```

Full log (verbatim, all 6 lines):
```
# 2026-08-11T22:00:58.953Z soak-start label=tier1 iterations=30 timeout_ms=300000 command="npx vitest run"
2026-08-11T22:01:37.721Z label=tier1 iteration=1/30 status=PASS exit=0 duration_ms=38767 capture=(none)
2026-08-11T22:02:16.839Z label=tier1 iteration=2/30 status=PASS exit=0 duration_ms=39117 capture=(none)
2026-08-11T22:02:55.881Z label=tier1 iteration=3/30 status=PASS exit=0 duration_ms=39042 capture=(none)
2026-08-11T22:03:35.148Z label=tier1 iteration=4/30 status=PASS exit=0 duration_ms=39266 capture=(none)
2026-08-11T22:04:15.663Z label=tier1 iteration=5/30 status=PASS exit=0 duration_ms=40515 capture=(none)
2026-08-11T22:05:10.901Z label=tier1 iteration=6/30 status=FAIL exit=1 duration_ms=55237 capture=C:\Users\mandr\codepulse\.planning\phases\113-debt-sweep\113-soak-tier1.log.tier1-2026-08-11T22-00-58-953Z.iteration-6.txt
```

**This run stopped early at iteration 6/30 on the runner's early-stop-on-FAIL behavior. It did NOT
reach the 30-iteration tier-1 budget, and its `FAIL` is NOT a DEBT-06 reproduction.**

### What actually failed — `src/App.test.tsx`, not `Chat.test.tsx`

Captured output
(`113-soak-tier1.log.tier1-2026-08-11T22-00-58-953Z.iteration-6.txt`), verbatim excerpt:

```
 ❯ src/App.test.tsx (19 tests | 1 failed) 37575ms
     × resolves '/memory' past its lazy boundary and renders the page 25688ms

 Test Files  1 failed | 304 passed | 17 skipped (322)
      Tests  1 failed | 4046 passed | 193 todo (4240)
   Duration  54.08s

 FAIL  src/App.test.tsx > App lazy routes (Phase 106 Plan 04, DEBT-03) > resolves '/memory' past its lazy boundary and renders the page
Error: Test timed out in 25000ms.
If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".
 ❯ src/App.test.tsx:159:28
```

DEBT-06 is about `src/pages/Chat.test.tsx`'s brain-pill `textContent` assertion
(`chat-brain-pill-label`). This capture is a different test, in a different file
(`src/App.test.tsx`), and `App.test.tsx` appears in no phase-113 planning document. **This is not
DEBT-06's flake.** It is recorded here rather than discarded, because it is a genuine captured
failure and this plan's honesty requirement applies to it too — see "Newly-discovered finding"
below.

### Why Run 1 is excluded from the tier-1 budget (contention was the initial hypothesis — NOT
confirmed by later evidence; see the correction below)

The following observations were the INITIAL basis for suspecting environmental contention as the
cause of Run 1's `App.test.tsx` timeout. They are presented as originally observed, followed
immediately by the correction that Run 2 (tier1b) supplies.

- `src/App.test.tsx:156,168,174` sets `LAZY_ROUTE_WAIT_MS = 20_000`; the per-test timeout bound is
  `LAZY_ROUTE_WAIT_MS + 5_000` = 25_000ms. The failure hit at `25688ms` — past the outer test
  timeout, not an inner assertion failure. The test ran out of wall clock; it never got to a
  `findByRole` assertion mismatch.
- Iteration 6's full-suite duration was `54.08s` (`duration_ms=55237`) against a mean of
  `39341ms` (~39.3s) across the five preceding PASS iterations — roughly 40% slower.
- A concurrent session was demonstrably active on this machine during the run: it force-recreated
  the `convex-backend` container earlier in the phase and committed `113-07` shortly before this
  iteration ran. A live process count taken during the soak window (by the orchestrating session)
  showed 46 node processes versus 14 shortly after Run 1 ended.
- The working tree was clean at failure time — `git status --porcelain -- src/pages/Chat.test.tsx`
  matched `HEAD` throughout; only `.planning/STATE.md` (a concurrent session's file, never touched
  by this plan) plus this run's own untracked soak-log artifacts were dirty. This is explicitly
  **not** a concurrent-edit confound — the tree content was stable.

**CORRECTION, from Run 2's own data: the contention hypothesis is NOT established.** Run 2
(tier1b, below) contains an iteration at `duration_ms=93167` — 2.4x the ~39s baseline, and
substantially SLOWER than the `55237ms` iteration that failed in Run 1 — and that 93-second
iteration PASSED, including its own `App.test.tsx` '/memory' test. A slower full-suite run passed;
a faster one failed. This is a direct counter-example to "the suite was too slow this run, so a
25s-bounded test ran out of time." **Do not read the bullets above as an established cause.** The
one caveat that keeps the hypothesis from being outright refuted (not a rescue of it): suite-wide
wall-clock duration and a single test's own CPU/scheduling time are not the same measure —
vitest's workers run test files in parallel, so contention could in principle land unevenly and
hit the `/memory` test specifically in Run 1 while sparing it in the slow-but-passing Run 2
iteration. That is a caveat about what a suite-duration proxy can and cannot rule out, not
evidence for contention. **Correct framing: the `App.test.tsx` '/memory' lazy-route timeout is
UNATTRIBUTED.** It was seen once in 36 full-suite iterations run across this plan (Run 1's 6 +
Run 2's 30), under conditions that do not cleanly separate a machine-load explanation from an
application-level flake. No mechanism is asserted.

**Disposition of Run 1: excluded from the tier-1 budget regardless of cause** — it stopped early
at iteration 6/30 on a failure that is not DEBT-06's flake, so it cannot serve as a valid
30-iteration clean tier-1 measurement either way. DEBT-06 stays OPEN pending a clean run measuring
only the brain-pill assertion. Run 1's log and capture file are preserved on disk, untouched, as
evidence of a real observation and of the runner's early-stop/capture mechanism working correctly
— they are not deleted or overwritten.

### Newly-discovered finding — `src/App.test.tsx` '/memory' lazy-route timeout (NOT DEBT-06,
cause UNKNOWN)

Recorded here as a distinct, separately-tracked observation, not folded into DEBT-06's disposition:

- **Test:** `src/App.test.tsx > App lazy routes (Phase 106 Plan 04, DEBT-03) > resolves '/memory'
  past its lazy boundary and renders the page`
- **Symptom:** hit the test's own 25000ms outer timeout (`LAZY_ROUTE_WAIT_MS` + 5000ms margin) at
  25688ms elapsed, inside a 54.08s full-suite run.
- **Attribution: UNKNOWN.** Not machine contention (Run 2's 93-second iteration passed the same
  test cleanly), not confirmed as an application defect either — one occurrence in 36 full-suite
  iterations is not enough to characterize a mechanism, and no further investigation was performed
  here. Do not manufacture a cause. It is fair to say only: seen once, unattributed, and distinct
  from DEBT-06 (a different test, in a different file that appears in no phase-113 document).
- **Not a candidate for DEBT-06's disposition.** Flagged for separate future triage (a candidate
  follow-up phase item), not fixed or investigated further here.

## Machine quietness check (before Run 2)

Re-measured immediately before launching the re-run, per Larry's instruction to wait rather than
start a run already known to be compromised:

```
ps aux | grep -i node | grep -v grep    → 2 lines (git-bash's own process-tree view; git-bash
                                            `ps` only shows bash-spawned descendants, not the
                                            full system process table)
tasklist | grep -i node.exe             → 12 node.exe processes system-wide
```

Command lines for all 12 (via `Get-CimInstance Win32_Process -Filter "Name='node.exe'"`):
`npm run dev` (Vite :5173 supervisor), `vite.js` (:5173), Forge tray, Forge daemon, 4×
`context7-mcp` (2 npx wrappers + 2 resolved workers), `npm run dev:noauth` (Vite :5181), a second
`vite.js --port 5181`, and 2 `convex logs --env-file ... --history 3000` processes (npx wrapper +
resolved). **Zero of the 12 are `npx vitest`, a vitest worker, or `soak-vitest.mjs`.** The PID
from Run 1's launch (357173) is no longer present — that process has exited.

`git log --since="10 minutes ago" --oneline` → empty (no commits in the last 10 minutes).
`git status --porcelain` at check time → only `.planning/STATE.md` (concurrent session, untouched
by this plan) plus this plan's own soak-log artifacts.

Machine judged quiet enough to proceed with Run 2.

## Positive control #2 (before Run 2, fresh)


Re-proved the detector's FAIL path live in this environment, immediately before launching `tier1b`
(a stale control from before Run 1 is not evidence the detector still works now):

Created a throwaway `src/lib/__soak-control-113-06b-throwaway.test.ts` (`expect(1).toBe(2)`), ran:
```
node scripts/soak-vitest.mjs --iterations 2 --label control113-06b \
  --log <scratchpad>/113-06-control-b.log \
  --command "npx vitest run src/lib/__soak-control-113-06b-throwaway.test.ts"
```
Result:
```
2026-08-11T22:11:49.433Z label=control113-06b iteration=1/2 status=FAIL exit=1 duration_ms=3373 capture=...
iterations_run=1 passed=0 failed=1 timed_out=0 harness_errors=0 (stopped early)
```
Capture confirmed non-empty, contained the real `AssertionError` for the deliberate mismatch. No
`iteration=2/2` line (early-stop fired). Throwaway file and both control artifacts deleted
immediately after; `git status --porcelain --untracked-files=all -- src/lib/` returned nothing —
confirmed no residue.

## Run 2 (label `tier1b`) — CLEAN, valid tier-1 measurement

Launched immediately after the machine-quietness check and positive control #2, against a fresh
log path so it can never collide with Run 1's:
```
node scripts/soak-vitest.mjs --iterations 30 --label tier1b \
  --log .planning/phases/113-debt-sweep/113-soak-tier1b.log
```

**Derived counts (grepped from the log in the transcript):**
```
grep -c 'iteration=' .planning/phases/113-debt-sweep/113-soak-tier1b.log   → 30
grep -c 'status=PASS' .planning/phases/113-debt-sweep/113-soak-tier1b.log  → 30
grep -c 'status=FAIL' .planning/phases/113-debt-sweep/113-soak-tier1b.log  → 0
grep -c 'status=TIMEOUT' ...                                               → 0
grep -c 'status=ERROR' ...                                                 → 0
grep -c 'capture=(none)' .planning/phases/113-debt-sweep/113-soak-tier1b.log → 30
```

Header line (verbatim):
```
# 2026-08-11T22:12:01.864Z soak-start label=tier1b iterations=30 timeout_ms=300000 command="npx vitest run"
```

Last line (verbatim):
```
2026-08-11T22:35:24.918Z label=tier1b iteration=30/30 status=PASS exit=0 duration_ms=44469 capture=(none)
```

Duration stats across all 30 iterations, derived from `duration_ms=` values in the log:
- min: `39875`ms
- max: `93167`ms
- mean: `46767.5`ms (~46.8s)

Full sorted duration list: 39875, 39939, 40440, 40580, 41521, 41667, 42104, 42270, 42704, 42969,
42982, 43184, 43258, 43278, 43330, 43412, 43608, 43647, 43992, 44290, 44321, 44469, 44818, 45319,
45879, 45972, 49340, 67420, 73271, 93167.

**All 30 iterations passed, including the 93167ms (~93s) iteration — 2.4x the ~39s baseline —
which ran and passed `src/App.test.tsx`'s '/memory' lazy-route test cleanly.** This is the direct
counter-example that overturns the contention hypothesis raised after Run 1 (see the correction in
Run 1's section above).

**Tree stability check:** one commit landed during the tier1b window —
`01d33f8e docs(113-08): DEBT-07 closed - convex-selfhost under version control`. Verified
`git diff --stat bb01248f 01d33f8e -- src/` is EMPTY — the commit touches no file under `src/`, so
it cannot have altered what the soak measured. Not treated as contamination.

**30/30 clean. This is a valid tier-1 result for D-09's budget: zero reproductions of the
`Chat.test.tsx` brain-pill flake across 30 full-suite iterations.**

## Tier 2

Tier 1 (Run 2 / `tier1b`) was clean — 30/30 PASS, zero brain-pill reproductions — so per D-09's
tiered budget, tier 2 (50 more iterations) is run.

### Machine quietness check (before tier 2)

`git log --since="10 minutes ago" --oneline` at check time → only the same `01d33f8e` docs commit
already accounted for above (no `src/` changes). `wmic process where "name='node.exe'" get
ProcessId,CommandLine | grep -i vitest` → no matches (exit 1) — zero live vitest processes.

### Positive control #3 (before tier 2, fresh)

Same procedure as controls #1/#2: throwaway `src/lib/__soak-control-113-06c-throwaway.test.ts`
(`expect(1).toBe(2)`), ran via `soak-vitest.mjs --iterations 2 --label control113-06c`. Result:
```
2026-08-11T22:39:14.393Z label=control113-06c iteration=1/2 status=FAIL exit=1 duration_ms=2135 capture=...
iterations_run=1 passed=0 failed=1 timed_out=0 harness_errors=0 (stopped early)
```
No `iteration=2/2` line — early-stop fired. Throwaway and both control artifacts deleted;
`git status --porcelain --untracked-files=all -- src/lib/` returned nothing.

### Tier 2 launch

```
node scripts/soak-vitest.mjs --iterations 50 --label tier2 \
  --log .planning/phases/113-debt-sweep/113-soak-tier2.log
```

### Tier-2 result — CLEAN, 50/50

**Derived counts (grepped from the log in the transcript, not taken from the runner's own summary
line):**
```
grep -c 'iteration='      .planning/phases/113-debt-sweep/113-soak-tier2.log → 50
grep -c 'status=PASS'     .planning/phases/113-debt-sweep/113-soak-tier2.log → 50
grep -c 'status=FAIL'     .planning/phases/113-debt-sweep/113-soak-tier2.log → 0
grep -c 'status=TIMEOUT'  ...                                                → 0
grep -c 'status=ERROR'    ...                                                → 0
grep -c 'capture=(none)'  .planning/phases/113-debt-sweep/113-soak-tier2.log → 50
```

Header line (verbatim):
```
# 2026-08-11T22:39:25.621Z soak-start label=tier2 iterations=50 timeout_ms=300000 command="npx vitest run"
```

Last line (verbatim):
```
2026-08-11T23:17:27.261Z label=tier2 iteration=50/50 status=PASS exit=0 duration_ms=44992 capture=(none)
```

Duration stats across all 50 iterations, derived from the `duration_ms=` values in the log:
- min: `42250`ms
- max: `52326`ms
- mean: `45631.9`ms (~45.6s)

Notably tighter than tier1b's spread (min 39875 / max 93167 / mean 46767.5): tier 2 has no
long-tail iteration at all, its slowest run being 52.3s against tier1b's 93.2s. Zero FAILs in
either. **50/50 clean.**

**Cumulative iteration total across the valid tiers: 30 (tier1b) + 50 (tier2) = 80 full-suite
iterations.** Counting Run 1's 6 excluded iterations, 86 full-suite runs were executed in total for
this plan; the D-09 budget itself was satisfied by the 80 valid ones.

### Tier-1 append-only check (post-tier-2)

Both earlier logs re-counted AFTER tier 2 finished, confirming tier 2 wrote only to its own path and
disturbed neither predecessor:
```
grep -c 'iteration=' .planning/phases/113-debt-sweep/113-soak-tier1.log  → 6    (Run 1, unchanged)
grep -c 'iteration=' .planning/phases/113-debt-sweep/113-soak-tier1b.log → 30   (Run 2, unchanged)
```
Append-only behaviour across runs is therefore demonstrated, not assumed.

### Tree stability across the whole soak window

Pre-soak SHA was `bb01248f`. At the close of this plan `git rev-parse HEAD` = `577abadc`, so two
commits landed during/after the soak window:
```
577abadc docs(SEED-008): resolved - the tailnet is the declared auth boundary
01d33f8e docs(113-08): DEBT-07 closed - convex-selfhost under version control
```
`git diff --stat bb01248f HEAD -- src/` is **EMPTY** — neither commit touches any file under
`src/`, so neither can have altered what the soak measured. Reported explicitly rather than
ignored: the tree moved, but not in a way that reaches the measurement.

## Disposition — CLOSED GUARDED (not root-caused)

**Branch taken: `guarded`.** Confirmed by Larry at the Task 3 checkpoint on 2026-08-12.

**Cumulative iterations run: 80** (30 tier1b + 50 tier2), plus 6 excluded contaminated iterations
in Run 1.

**DEBT-06 is closed GUARDED and is NOT root-caused.** No reproduction of the `Chat.test.tsx`
brain-pill failure was captured across the entire decided budget. The `reproduced` branch was not
merely declined — it was unavailable: the single `status=FAIL` anywhere in this plan's records is
Run 1 iteration 6, which is `src/App.test.tsx`'s `/memory` lazy-route timeout, a different test in a
different file (see "Newly-discovered finding" above). There is no captured brain-pill failure to
root-cause, and D-11 forbids fixing without one.

What this plan therefore delivers instead of a deterministic fix:
1. **Instrumentation at the query site** (shipped by plan 113-05) — the next occurrence records the
   match count, each match's `textContent`, and `document.body.innerHTML` length, so it is
   self-diagnosing rather than requiring another soak to characterise.
2. **A recorded refutation set** — research already refuted shared-fixture contamination of the
   brain mocks, the async catalogue changing the label mid-assertion, and `useGlobalModelNames`
   (`D-106-04-01`). The surviving hypothesis, that more than one element carries the testid, is
   untested for want of a capture.
3. **A measured non-reproduction bound.** 80 clean full-suite iterations do not prove absence, but
   they do bound the rate: against the ~1-in-12 base rate that motivated the budget, 80 clean runs
   is a strong negative result. It is not proof the defect is gone.

**D-11 compliance, asserted mechanically rather than promised:**
```
git diff -- src/pages/Chat.test.tsx              → empty (file untouched by this plan)
grep -c 'waitFor'    src/pages/Chat.test.tsx     → 23  (identical to 113-05's recorded 23)
grep -c '{ timeout:' src/pages/Chat.test.tsx     → 0
npx vitest run src/pages/Chat.test.tsx           → 1 file / 48 tests passed
```
No `waitFor` was widened, no retry or `{ timeout: }` was added, and the assertion still reads
rendered `textContent` rather than any source-data substitute.

**Consequence recorded honestly:** the defect remains latent. `.planning/REQUIREMENTS.md`'s DEBT-06
line is amended by this plan so that it no longer claims the defect was root-caused, and points
here. That amendment is a deliberate, visible admission — the whole point of this disposition is
that a guarded close must never be recorded as a root cause.

**Disclosure review (T-113-24), performed before committing:** the artifacts committed by this plan
were scanned for tokens and credential-shaped strings — zero matches for `sk-`, `pk_`, `Bearer `,
`API_KEY`, `SECRET`, `TOKEN`, `PASSWORD`, `CONVEX_`, `VITE_`, `ASTRIDR_`. Two occurrences of the
absolute home path `C:\Users\mandr\codepulse\...` remain (this file's quotation of Run 1's log line,
and that log line itself, both being the runner's own `capture=` field). That string is already
present in **177 tracked files** repo-wide in this public repo, so these two add no new disclosure;
they are retained rather than redacted so the log stays byte-faithful to what the runner wrote. Note
for the record: the first scan pass used `grep -c 'C:\\Users\\mandr'`, which matched **0** in a file
that demonstrably contains the path — a false negative caught only by re-running with `grep -F`
against a known-positive control line. The counts above are the `-F` results.
