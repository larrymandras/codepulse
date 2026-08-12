---
id: SEED-009
status: dormant
planted: 2026-08-12
planted_during: v14.0 / Phase 113 (DEBT-06 soak), closed out same day
trigger_when: a SECOND occurrence is captured, OR the full unit suite's wall clock becomes a constraint worth engineering against
scope: Small
origin: "Phase 113's DEBT-06 soak, 2026-08-11: 1 failure in 86 full-suite iterations. src/App.test.tsx > 'resolves /memory past its lazy boundary and renders the page' hit its own 25000ms outer bound (LAZY_ROUTE_WAIT_MS 20000 + 5000 margin) at 25688ms, inside a 54.08s full-suite run. Capture: .planning/phases/113-debt-sweep/113-soak-tier1.log.tier1-2026-08-11T22-00-58-953Z.iteration-6.txt. Isolation measurement 2026-08-12 (npx vitest run src/App.test.tsx --reporter=verbose): the same case takes 433ms — a 58x margin against its budget, and NOT the slowest case in the file (/ is, at 922ms)."
evidence: .planning/phases/113-debt-sweep/113-FLAKE-EVIDENCE.md
---

# SEED-009: `App.test.tsx` `/memory` lazy-route timeout — one occurrence, cause unidentified

Seen exactly once in 86 full-suite iterations during Phase 113's DEBT-06 soak. **It is not
DEBT-06** — different test, different file, and `src/App.test.tsx` appears in no phase-113
planning document. It is recorded here so it stops living only inside another requirement's
evidence file.

## What is actually known

**It is a hang, not slowness.** This is the one thing the isolation measurement settles:

```
npx vitest run src/App.test.tsx --reporter=verbose   (2026-08-12)
  ✓ resolves '/memory' … 433ms          ← against a 25,000ms budget = 58x margin
  ✓ resolves '/'       … 922ms          ← the slowest case in the file, still 27x under
```

A test with 58x headroom does not fail by drifting over its bound. Going 433ms → >25,000ms is a
58x blowup, which means something stopped the case progressing — not that it was near the edge and
tipped.

## What has been ruled out

- **Machine contention / "the suite was slow that run."** Refuted by the soak's own data, not by
  argument: tier1b contains a **93167ms** iteration — 2.4x the ~39s baseline and substantially
  slower than the **55237ms** run that failed — and that iteration **passed** this exact test.
  A slower full-suite run passed; a faster one failed.
- **Leaked fake timers starving `findByRole`'s polling** (the shared-fixture hypothesis, which the
  project's own rule says to check first). Refuted two ways: the one file with asymmetric counts,
  `src/hooks/useIntakeFeed.test.tsx`, restores via a file-level `afterEach(() => vi.useRealTimers())`
  at `:47-49`, so both inline `useFakeTimers()` calls are cleaned up; and `vitest.config.ts` sets no
  `isolate` override, so vitest's default per-file environment teardown makes cross-file timer
  leakage impossible in the first place.

## What is NOT known — do not manufacture a cause

No mechanism is asserted. One occurrence in 86 iterations is not enough to characterize one, and
every hypothesis raised so far has been killed by evidence rather than confirmed by it. The residual
suspicion — worker starvation under parallel full-suite load blocking the poll loop — is a **guess**,
explicitly not a finding, and the 93s counter-example above is the reason it cannot simply be
assumed.

## Why this was not fixed at plant time

The only available "fixes" without a cause would be to widen the already-58x-oversized timeout or to
retry the case — both of which mask rather than remove, which is exactly the move Phase 113's D-11
forbade for the sibling flake. A one-occurrence unattributed hang does not justify reshaping a test
that is otherwise correct and fast.

## What would move this forward

1. **A second capture.** The suite is already instrumented enough that a repeat produces the same
   `.iteration-N.txt` artifact; two occurrences allow asking whether it is always `/memory`.
2. **Cheap structural note if it recurs:** the file renders a full `<App />` **15 times** via
   `it.each`, each with its own 25s budget, so a systemic stall here is expensive in wall clock even
   when it passes. If it recurs, measure whether the blowup is specific to `/memory` or lands on
   whichever case happens to run at the wrong moment — that single question separates an
   application-level defect in the Memory page's lazy boundary from an environment-level stall, and
   it cannot be answered from one sample.
