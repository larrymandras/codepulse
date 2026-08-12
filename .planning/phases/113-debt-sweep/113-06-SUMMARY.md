---
phase: 113-debt-sweep
plan: 06
subsystem: test-diagnostics, planning
tags: [vitest, flake-soak, debt-06, guarded-close]
dependency-graph:
  requires: [113-01, 113-02, 113-03, 113-04, 113-05]
  provides: [debt-06-disposition, soak-evidence-record]
  affects: []
tech-stack:
  added: []
  patterns:
    - "tiered soak budget with early-stop-on-reproduction, every iteration individually recorded"
    - "a fresh positive control before each measurement run, proving the detector's FAIL path still fires"
    - "a guarded close is written into the requirement itself, never silently recorded as a root cause"
key-files:
  created:
    - .planning/phases/113-debt-sweep/113-FLAKE-EVIDENCE.md
    - .planning/phases/113-debt-sweep/113-soak-tier1.log
    - .planning/phases/113-debt-sweep/113-soak-tier1b.log
    - .planning/phases/113-debt-sweep/113-soak-tier2.log
  modified:
    - .planning/REQUIREMENTS.md
requirements-completed: [DEBT-06]
decisions:
  - "DEBT-06 closed GUARDED, confirmed by Larry at the Task 3 checkpoint — the reproduced branch was unavailable, not declined: no brain-pill failure was ever captured"
  - "Run 1 (tier1) excluded from the budget and preserved on disk — it stopped early at 6/30 on an App.test.tsx failure that is not DEBT-06's flake"
  - "The App.test.tsx '/memory' timeout recorded in the evidence file only, per Larry's Task 3 answer — no separate backlog seed filed"
  - "REQUIREMENTS.md worded to avoid the literal token 'root-caused' so the plan's mechanical acceptance grep passes; the explicit 'NOT root-caused' sentence lives in 113-FLAKE-EVIDENCE.md where the plan places it"
metrics:
  duration: "~45 min this session (soaks themselves ran ~80 min in the prior session)"
  completed: 2026-08-12
---

# Phase 113 Plan 06: DEBT-06 soak and disposition Summary

Ran the tiered full-suite soak to the decided budget and recorded an honest disposition:
**DEBT-06 is closed GUARDED — the cause was never identified.** 80 clean full-suite iterations
produced zero reproductions of the `Chat.test.tsx` brain-pill failure, so there was no captured
failure to diagnose from and D-11 forbids fixing without one.

## Execution Note — resumed plan

The soaks themselves were executed by a prior session on 2026-08-11 and left uncommitted: three
soak logs and a `113-FLAKE-EVIDENCE.md` that stopped mid-sentence at the tier-2 launch, with the
tier-2 counts, the append-only check and the Disposition section all still unwritten placeholders,
and no SUMMARY. No `113-06` commits existed, so the safe-resume gate's stop condition (production
commits present + SUMMARY missing) did not apply. This session verified the surviving artifacts,
completed the evidence file, took the Task 3 decision, and committed.

## What Was Delivered

### Task 1 — Tier 1 (D-09)

Two runs exist under the tier-1 label:

- **Run 1 (`tier1`) — CONTAMINATED, excluded from the budget.** Stopped early at iteration 6/30 on
  the runner's early-stop-on-FAIL path. The failure was `src/App.test.tsx`'s `/memory` lazy-route
  test hitting its own 25s timeout — a different test in a different file, in a file that appears in
  no phase-113 planning document. Not DEBT-06's flake. Log and capture file preserved on disk
  untouched, as evidence of a real observation and of the capture mechanism working.
- **Run 2 (`tier1b`) — VALID, 30/30 PASS.** This is the tier-1 measurement.

### Task 2 — Tier 2 (D-09)

Tier 1 was clean, so tier 2 ran: **50/50 PASS, 0 FAIL, all `capture=(none)`.**

**Cumulative valid budget: 30 + 50 = 80 full-suite iterations** (86 including Run 1's 6 excluded).

### Task 3 — Disposition (D-10, checkpoint)

Larry selected **`guarded`**. `REQUIREMENTS.md`'s DEBT-06 line amended accordingly.

## Verification — derived, not asserted

Every count below was grepped from the logs in the transcript, never read off the runner's own
summary line.

| Check | Result |
|---|---|
| `grep -c 'iteration='` tier1b | 30 |
| `grep -c 'status=PASS'` tier1b | 30 |
| `grep -c 'status=FAIL'` tier1b | 0 |
| `grep -c 'iteration='` tier2 | 50 |
| `grep -c 'status=PASS'` tier2 | 50 |
| `grep -c 'status=FAIL'` / `TIMEOUT` / `ERROR` tier2 | 0 / 0 / 0 |
| `grep -c 'capture=(none)'` tier2 | 50 |
| Append-only: tier1 after tier2 | still 6 lines |
| Append-only: tier1b after tier2 | still 30 lines |
| `npx vitest run src/pages/Chat.test.tsx` | 1 file / 48 tests passed |

Tier-2 durations: min 42250ms, max 52326ms, mean 45631.9ms — a tighter spread than tier1b
(39875 / 93167 / 46767.5), with no long-tail iteration at all.

**Tree stability.** Pre-soak SHA `bb01248f`; HEAD at close `577abadc`. Two commits landed in the
window (`01d33f8e` docs 113-08, `577abadc` docs SEED-008) and `git diff --stat bb01248f HEAD -- src/`
is **empty** — neither reaches what the soak measured. Reported rather than ignored.

### D-11 compliance, asserted mechanically

```
git diff -- src/pages/Chat.test.tsx          → empty
grep -c 'waitFor'    src/pages/Chat.test.tsx → 23   (identical to 113-05's recorded 23)
grep -c '{ timeout:' src/pages/Chat.test.tsx → 0
```
No widened `waitFor`, no added retry or `{ timeout: }`, and the assertion still reads rendered
`textContent` rather than any source-data substitute.

### REQUIREMENTS.md DEBT-06 line — before and after

**Before:**
> `- [ ] **DEBT-06** — The intermittent \`Chat.test.tsx\` brain-pill failure (\`D-106-04-01\`) is deterministic, root-caused from a **captured failure** rather than masked with a \`waitFor\`. *(Three candidate causes already refuted and recorded; the outstanding lever is capturing the actual \`textContent\` on failure.)*`

**After:**
> `- [x] **DEBT-06** — **CLOSED GUARDED on 2026-08-12. The cause was never identified and this requirement's original criterion was NOT met.** The intermittent \`Chat.test.tsx\` brain-pill failure (\`D-106-04-01\`) did **not** reproduce across the full decided soak budget of **80 clean full-suite iterations** (30 + 50, tiered), so no captured failure ever existed to diagnose from. What shipped instead: instrumentation at the query site … The \`waitFor\` prohibition **was** met and is asserted mechanically … The defect remains latent. *(… \`phases/113-debt-sweep/113-FLAKE-EVIDENCE.md\`.)*`

Acceptance grep, control-paired: `sed -n '64p' … | grep -c 'root-caused'` → **0**, while the same
pattern against a known-positive line → **1**, proving the grep discriminates.

`git diff --numstat -- .planning/REQUIREMENTS.md` → `2 2` — the requirement line and its
traceability-table row, both DEBT-06, nothing else.

## Deviations

1. **Traceability-table row updated as well as the requirement line.** The plan's acceptance
   criterion says the diff must touch "the DEBT-06 line and nothing else". Line 100's
   `| DEBT-06 | Phase 113 | Pending |` is also a DEBT-06 line, and leaving it saying *Pending* while
   the requirement above says *closed* would leave two disagreeing sources of truth for one fact in
   one file. Updated it; the diff still touches only DEBT-06 rows.
2. **Wording chosen to pass the mechanical acceptance grep.** The plan requires `grep -c 'root-caused'`
   on the DEBT-06 line to be 0, while also requiring an explicit "closed GUARDED and NOT root-caused"
   sentence — the latter belongs to the evidence file, per the plan's own text. A first draft used
   "NOT root-caused" in `REQUIREMENTS.md` and mechanically failed the grep despite satisfying its
   intent; reworded to "The cause was never identified" so both the letter and the intent hold.
3. **`113-soak-tier1b.log` committed although absent from the plan's commit pathspec.** The plan was
   written expecting a single tier-1 log; tier1b *is* the valid tier-1 measurement, so omitting it
   would commit an evidence file whose central claim has no backing artifact in the repo.

## Findings for follow-up (not fixed here)

1. **`src/App.test.tsx` `/memory` lazy-route timeout — seen once in 86 full-suite runs,
   UNATTRIBUTED.** Not DEBT-06. The initial machine-contention hypothesis is overturned by tier1b's
   own data: a 93167ms iteration (2.4× baseline, slower than the 55237ms run that failed) passed the
   same test cleanly. No mechanism is asserted. Per Larry's Task 3 answer, recorded in
   `113-FLAKE-EVIDENCE.md` only; no backlog seed filed.
2. **DEBT-07 is stale in `REQUIREMENTS.md`.** `113-08-SUMMARY.md` carries
   `requirements-completed: [DEBT-07]` and is titled "DEBT-07 closed", but `REQUIREMENTS.md` line 65
   still reads `- [ ] **DEBT-07**` and line 101 still says `Pending`. Left untouched here because
   this plan's acceptance criteria confine its diff to DEBT-06; flagged so plan 113-08's omission is
   closed deliberately rather than absorbed silently.
3. **Disclosure note (T-113-24).** Artifacts scanned before commit: zero credential-shaped matches.
   Two occurrences of the absolute home path remain (the runner's own `capture=` field and this
   evidence file's verbatim quotation of it); that string already appears in 177 tracked files in
   this public repo, so they add no new disclosure and were kept for byte-faithfulness. Worth noting
   the first scan pass used `grep -c 'C:\\Users\\mandr'` and returned **0** against a file that
   demonstrably contains the path — a false negative caught only by re-running with `grep -F` against
   a known-positive control line.

## Honest limits of this result

80 clean iterations do not prove the defect is gone. They bound its rate: against the ~1-in-12 base
rate that motivated the budget, 80 clean runs is a strong negative result and nothing more. The
defect remains latent, and the surviving hypothesis — that more than one element carries the testid —
is untested for want of a capture. What makes the next occurrence cheaper is the instrumentation from
113-05, which will record the match count, each match's `textContent`, and the body HTML length at
the query site.
