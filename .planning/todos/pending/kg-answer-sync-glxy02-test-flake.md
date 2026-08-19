---
id: TODO-kg-answer-sync-glxy02-test-flake
status: pending
planted: 2026-08-19
planted_during: Phase 122 (Tokens, Primitives & Contrast Measurement) — surfaced during the wave-6 test gate after plan 122-15
trigger_when: Next Phase 190 / KnowledgeGraph work, or the next time CI reports an unexplained single-test failure in src/pages/KnowledgeGraph.test.tsx. Owned by the phase-190 workstream, not by 122.
scope: Small (one test's async synchronisation)
source: Measured 2026-08-19 on codepulse master; 6 isolated runs of the unmodified tree
resolves_phase: null
last_reviewed: 2026-08-19
---

# `GLXY-02: the all-on-screen branch logs requested/resolved counts` is flaky (~17%)

## Measured behaviour

`src/pages/KnowledgeGraph.test.tsx` →
`KnowledgeGraph — answer sync reaction (Phase 187 Plan 05, GLXY-01) > GLXY-02: the all-on-screen
branch logs requested/resolved counts, not the ego-lens-fallback line`

Six isolated runs against an unmodified working tree at HEAD:

```
run 1: 48 passed
run 2: 1 failed | 47 passed
run 3: 48 passed
run 4: 48 passed
run 5: 48 passed
run 6: 48 passed
```

Failure mode: `expected "info" to be called with arguments: [StringContaining{…}, …(1)]`, i.e. the
`console.info` spy never saw the `[kg-answer-sync] all-on-screen` call.

## What it is NOT

**Not a missing log line.** `src/pages/KnowledgeGraph.tsx:824-825` emits exactly what the test
asserts — the message and `{ turnId, requested, resolved }` — so the branch is intact and the
failure is that it is not reached before the assertion runs.

**Not caused by Phase 122.** Two independent reasons:

1. The only Phase 122 change to `KnowledgeGraph.tsx` is commit `7f517ec3` (sweep slice E), which is
   two purely cosmetic class substitutions — `bg-[#09090b]` → `bg-background` and
   `border-slate-400/50` → `border-muted-foreground/50`. Neither can affect async timing.
2. Plan 122-15 was briefly suspected because the failure first appeared in the gate immediately
   after it. That was a CONFOUND: reverting 122-15's 24 source files made the test pass, but the
   fully-restored tree then also passed, and the repeat-run table above shows the same tree both
   passing and failing. A revert experiment against an intermittent failure proves nothing.

## Likely cause

The test is async-timing shaped: it uses `waitFor` plus a manually-advanced `requestAnimationFrame`
queue (`rafCbs`, flushed via `flushRaf()`), and the assertion races the answer-sync effect. The
suite's own comments already note a related hazard — a leaked `console` spy silencing a later suite
(dated 2026-07-30) — so the spy lifecycle in this describe block is worth re-reading alongside the
rAF flush ordering.

## Ownership

The test file's most recent commit is `db9dced6 feat(190-08)` — phase-190 work by a concurrent
session. Deliberately NOT fixed here: editing another workstream's live test file mid-flight risks
colliding with uncommitted work, and a 17% flake is not a Phase 122 gate failure. Phase 122's own
full-suite gates were re-run and are green.
