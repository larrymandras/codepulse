---
id: TODO-test-isolation-full-suite-only-failures
status: pending
planted: 2026-08-24
planted_during: Phase 125 (Signature Layers) — plan 125-05, after a Codex adversarial review challenged the summary's "transient, out of scope" label
trigger_when: Either failure recurs, OR a phase is scoped to test-infrastructure/isolation work. NOT a fit for a quick pickup — there is nothing to debug until a reproduction rate exists, and establishing one costs repeated ~50s full-suite runs
scope: Small-to-medium — two observed failures, each unreproduced, in TWO DIFFERENT vitest projects with two different mechanisms. Diagnosis is measurement-first, not fix-first
source: Measured 2026-08-24. codepulse failure observed once by plan 125-05's executor; astridr-repo analog logged by that repo's phase 195-03. Orchestrator re-ran the full codepulse suite independently — did not reproduce
resolves_phase: 136
last_reviewed: 2026-08-24
---

# Two full-suite-only test failures, deferred with operator approval

## Decision this backlog item implements

Larry chose "log it, diagnose later" on 2026-08-24 when asked directly, after the alternative
(repeated full-suite runs to establish a reproduction rate) was priced. This satisfies
`CLAUDE.md`'s rule that an error may only be deferred with explicit approval — it is recorded
here rather than dismissed in a summary.

## What was actually observed, and what was NOT

**codepulse — `src/components/voice/AvatarAura.browser.test.tsx`**
- ONE observed failure during plan 125-05's full `npm test`: `358 passed, 1 failed`.
  Error was `Failed to fetch dynamically imported module` from the vitest browser dev server.
- Re-ran in isolation: 3/3 passed.
- Orchestrator then re-ran the WHOLE suite independently: **359 files passed | 17 skipped,
  5,015 passed | 195 todo, 0 failed, exit 0** (51.45s). Did not reproduce.
- A later full run during plan 125-06 also did not reproduce it (5,026 passed / 0 failed).

**What that does and does not establish.** "The suite is red" is refuted — three clean full runs
say otherwise. But one observed failure against clean reruns is a SAMPLE, not a diagnosis, and an
isolated rerun is structurally incapable of discriminating "transient" from "order-dependent under
full-suite load": it changes the exact conditions under suspicion. The summary originally called
it "a transient browser-mode dev-server race... out of scope"; that label was withdrawn in commit
`4c2f7488` because the evidence never supported it. Current honest status: **one observed
unreproduced failure, mechanism undiagnosed.**

## The two failures are NOT the same defect — do not merge them

The astridr-repo session proposed that this and its own phase 195-03 deferral might be one shared
test-isolation defect. Checked, and they are not:

| | codepulse (this) | astridr-repo 195-03 |
|---|---|---|
| File | `AvatarAura.browser.test.tsx` | `src/pages/KnowledgeGraph.test.tsx` |
| vitest project | `browser` — real headless Chromium, `@vitest/browser-playwright` (`vitest.config.ts:82-87`) | `unit` — jsdom |
| Failure | `Failed to fetch dynamically imported module` from the dev server | console-spy assertion received an unrelated `[kg-answer-sync] not-3d renderMode=2d` call |
| Class | module/server lifecycle under concurrent load | cross-test state leakage |

Same SHAPE — full-suite-only, passes alone, filed rather than fixed — different MECHANISM.
Whoever picks this up should not go hunting for shared fixture state in the jsdom project to
explain the browser-project failure; that would be searching the wrong runner.

The shared HABIT is still worth noting: two independent sessions each hit a full-suite-only
failure and each deferred it. That pattern, not the mechanism, is the argument for one deliberate
test-isolation pass.

## How to actually diagnose it (measurement first)

1. Establish a reproduction rate before debugging anything. Run the full suite N times capturing
   pass/fail per run. A defect that appears at a low rate is not yet a guard even once found —
   see the standing lesson that a stress test catching something 0.4% of the time is not a guard.
2. Vary the suspected variable, not a neighbouring one. The `browser` project shares a machine
   with the jsdom project under concurrency; test whether running `--project browser` alone,
   repeatedly, ever reproduces. If it never does alone but does under combined load, the cause is
   resource/lifecycle contention, not the spec.
3. Only once it reproduces deterministically is there something to fix. Make the regression
   deterministic and pair it with a control proving the guard still fires.

## Related

- `.planning/phases/125-signature-layers/125-05-SUMMARY.md` (as corrected, commit `4c2f7488`)
- `astridr-repo/.planning/phases/195-persona-dial-dashboard/deferred-items.md`
- `vitest.config.ts:29-88` — the two-project layout, and the load-bearing comment explaining why
  the root `test` block must not declare `include`
