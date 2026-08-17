---
phase: 113-debt-sweep
verified: 2026-08-12
verifier: main session (inline — gsd-verifier subagent declined by Larry at the closure gate)
status: passed-with-amended-criterion
requirements: [DEBT-05, DEBT-06, DEBT-07]
---

# Phase 113 (Debt Sweep) — Verification

Goal-backward check of the three ROADMAP success criteria against live state and git ground truth,
not against the phase's own SUMMARY claims. Every assertion below carries the command that produced
it.

## Criterion 1 — DEBT-05: `computeSkillPrunes` no longer drops live plugin skills — **MET**

The fix is a fail-closed guard, not a widened tolerance: pruning is skipped entirely unless the
producer positively asserts a complete scan.

```
convex/skillSync.ts:142
  if (scannedOriginsComplete !== true || scannedOrigins === undefined) return [];
```

A transient or partial catalog scan therefore yields zero prunes rather than deleting the rows it
failed to see — which is the 185 → 131 → 185 oscillation the requirement names.

```
npx vitest run convex/__tests__/skillSync.test.ts → 1 file / 34 tests passed
```

Note the guard also hardens against untrusted input: `scannedOriginsComplete` must be exactly `true`
(`skillSync.ts:45` — a truthy non-`true` value degrades to `false`), so a malformed snapshot cannot
engage pruning by accident.

## Criterion 2 — DEBT-06: the `Chat.test.tsx` brain-pill flake — **CLOSED GUARDED, original bar NOT met**

**This criterion was amended rather than satisfied, and that is recorded deliberately.** As
originally written it required the failure to be "fixed from a captured root cause". No capture was
ever obtained, so the original bar is unmet and the ROADMAP criterion was reworded on 2026-08-12 to
describe what was actually delivered.

Evidence:
- **80 clean full-suite iterations** across the tiered budget Larry set (30 `tier1b` + 50 `tier2`),
  zero reproductions. Counts grepped from the logs, never read off the runner's summary line.
- The only `status=FAIL` in the record is Run 1 iteration 6 — `src/App.test.tsx`'s `/memory`
  lazy-route timeout, a different test in a different file. Not DEBT-06's flake.
- Each measurement run was preceded by a **fresh positive control** proving the detector's FAIL path
  still fired in that environment (three controls, all early-stopped on a deliberate mismatch).
- Tree stability: pre-soak `bb01248f` → `577abadc`, and `git diff --stat bb01248f HEAD -- src/` is
  empty, so nothing that landed in the window reaches what the soak measured.

The `waitFor` half of the criterion **was** met, asserted mechanically rather than promised:
```
git diff -- src/pages/Chat.test.tsx          → empty
grep -c 'waitFor'    src/pages/Chat.test.tsx → 23   (identical to 113-05's recorded 23)
grep -c '{ timeout:' src/pages/Chat.test.tsx → 0
```

**The defect remains latent.** 80 clean runs bound its rate against the ~1-in-12 base rate that
motivated the budget; they do not prove absence. Full record: `113-FLAKE-EVIDENCE.md`.

## Criterion 3 — DEBT-07: `convex-selfhost/` under version control — **MET**

Verified against the live directory, not against `113-08-SUMMARY.md`'s claim:

```
C:\Users\mandr\convex-selfhost is a git work tree — HEAD 880befa, 2 commits
git show HEAD:docker-compose.yml → contains the logging: block
    driver: "json-file"; options: max-size "10m", max-file "3"
git ls-files → docker-compose.yml, docker-compose.standby.yml, restart-convex.ps1,
    run-restart-hidden.vbs, preflight.ps1, backup-convex.ps1, soak-watch.ps1,
    restrict-convex-lan.ps1, retention-health-check.ps1, + 5 more
git status --porcelain → clean
```

Both halves the requirement names — the compose `logging:` block and the restart scripts — are in
the committed tree, not living only on disk.

## Regression gate

```
npx vitest run
Test Files  305 passed | 17 skipped (322)
     Tests  4047 passed | 193 todo (4240)
  Duration  39.39s
```
0 failures, matching the soak's own baseline exactly. No cross-phase regressions.

## Code review gate

No source review was performed because this phase's final plan changed **no source files**:
```
git show --name-only --format="" HEAD | grep -v '^\.planning/' → (none)
control: same filter on 2b831bc1 → convex/__tests__/migrations.test.ts, convex/migrations.ts
```
The control proves the filter discriminates rather than returning empty for a bad pattern. Earlier
plans' source changes were reviewed within their own plans (113-03 and 113-05 each record an
adversarial-verification round closing 3 defects apiece).

## Verdict

**PASSED, with criterion 2 amended and labelled.** DEBT-05 and DEBT-07 are delivered and verified
against live state. DEBT-06 is closed **GUARDED**: the cause was never identified, the requirement's
original wording was corrected rather than quietly counted as satisfied, and the latent defect plus
its shipped instrumentation are recorded in both `REQUIREMENTS.md` and the ROADMAP.

## Carried forward

1. **`src/App.test.tsx` `/memory` lazy-route timeout — UNATTRIBUTED.** Seen once in 86 full-suite
   runs. Distinct from DEBT-06. **Owned by `.planning/seeds/SEED-009-app-lazy-route-timeout.md`**
   (planted 2026-08-12), which carries the capture, the refutations, and an explicit
   trigger-on-second-occurrence. Two hypotheses are dead, not open: machine contention is overturned
   by `tier1b`'s own 93167ms iteration (slower than the 55237ms run that failed) passing the same
   test, and leaked fake timers are impossible under vitest's default per-file isolation with
   `useIntakeFeed.test.tsx:47-49` restoring anyway. Isolation measurement puts the case at **433ms
   against a 25,000ms budget (58× margin)**, so this is a hang rather than a slow test drifting over
   its bound. No mechanism is asserted; no fix attempted, because the only fixes available without a
   cause would mask it — the move D-11 forbids.
2. **The surviving DEBT-06 hypothesis is untested** — that more than one element carries the
   `chat-brain-pill-label` testid — for want of a capture. The 113-05 instrumentation records the
   match count, so the next occurrence answers it directly.
