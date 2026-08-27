---
id: TODO-vitest-suite-nondeterministic-one-random-failure-per-run
status: pending
planted: 2026-08-20
planted_during: astridr-repo Phase 192's post-merge gate (cross-repo phase) — filed by the Phase 192 orchestrator at Larry's direction; not owned by 192, this is codepulse's own defect surfacing in phase-111 / phase-187 test files
trigger_when: unknown — not recorded at filing time
scope: unknown — not recorded at filing time
source: src/components/JobsPanel.test.tsx:173; src/pages/KnowledgeGraph.test.tsx (GLXY-02)
resolves_phase: 136
last_reviewed: 2026-08-27
---

# Vitest suite is non-deterministic — ~1 random test fails per full run

**Found:** 2026-08-20, during astridr-repo Phase 192's post-merge gate (cross-repo phase).
**Filed by:** the Phase 192 orchestrator, at Larry's direction. Not owned by 192 — this is
codepulse's own defect, in phase-111 / phase-187 test files.

## Symptom

A full `npx vitest run` fails roughly one test per run, and **a different test each time**.

| Run | Result |
|---|---|
| 1 (full, both projects) | `1 failed \| 4880 passed` — `src/components/JobsPanel.test.tsx > … no animate-pulse` |
| 2 (`--project unit`) | `1 failed \| 4878 passed` — `src/pages/KnowledgeGraph.test.tsx > … GLXY-02` |
| 3 (`--project unit`) | `4879 passed`, exit 0 — clean |

Two further full runs later the same evening were both clean. **That does not mean it is
gone** — it means the rate is roughly one-in-N, not one-in-one.

## Why this is flakiness and not a regression

- **A different test fails each run.** A real regression fails the same test every time.
- **`JobsPanel.test.tsx` passes in isolation**: `npx vitest run --project unit
  src/components/JobsPanel.test.tsx` → `12 passed`, exit 0. Passing alone and failing in the
  full run is the order-dependence / shared-state signature.
- **A clean run reproduced `4879 passed` exactly**, matching the pre-change baseline recorded
  independently earlier that day.

## The two observed failures

Both are **timing- and ordering-sensitive assertions**, and both sit in components that render
canvases under jsdom (the run is flooded with `Not implemented:
HTMLCanvasElement.getContext()`):

1. `JobsPanel.test.tsx:173` — `container.querySelectorAll('svg.lucide-clock').length` expected
   `1`, got `0`. A rendered-icon count.
2. `KnowledgeGraph.test.tsx` (GLXY-02) — a `console.info` spy assertion:
   `expected "info" to be called with arguments: [StringContaining{…}, …]`.

## What was ruled out

`src/test/setup.ts` was modified the same day by Phase 192 (wrapping a prototype read in
`try/catch` so a real browser's instance-only `audioWorklet` getter cannot abort the setup
file). **Exonerated by reading:** under jsdom `proto.audioWorklet` is `undefined`, so the
guarded `if` was false before the change and is false after. Behaviour under jsdom is
identical.

**Not** ruled out: whether Phase 192's `test.projects` split (adding an explicit `unit` project
alongside a new `browser` project) changed the *rate* of pre-existing flakiness by altering file
ordering or concurrency. Testing that needs a run against the pre-`4e764abb` tree, which was not
possible without disturbing a checkout another session was live in. Recorded as unproven rather
than assumed either way.

Independent corroboration that it predates the observation: Phase 192's wave-2 executor
recorded rejecting one of its own probe results because "its exit came from two unrelated flaky
timeouts" — it hit the same non-determinism before any of the runs tabled above.

## Why it matters

Phase 192 added two CI steps to `.github/workflows/ci.yml`:

```yaml
- run: npx vitest run --project browser   # deterministic — 4/4 clean runs
- run: npx vitest run                     # THIS one will go red intermittently
```

An intermittently-red pipeline is how a real guard gets switched off. The `--project browser`
step is the one guarding LIP-01's cadence regression and is unaffected — it is deterministic
across every run measured. The full-suite step is the exposure.

## Suggested first moves

1. Run the suite N times capturing the failing node-id each time — establish the actual rate
   and whether the failures cluster in a few files or spread.
2. Bisect ordering rather than code: `--sequence.shuffle` / `--no-file-parallelism` to see
   whether the failures are order-dependent (expected) or timing-dependent.
3. Look for a shared fixture mutated without restore — the classic cause of "passes alone,
   fails in the suite". Both observed failures assert on rendered output, so a leaked DOM or a
   leaked spy between files is the first place to look.
4. Do **not** fix by adding retries. A retry hides exactly the shared-state bug that is worth
   finding, and leaves the guard just as untrustworthy.

## Not to be confused with

The `ResizeObserver loop completed with undelivered notifications` storm (~725 per 6s browser
run) is a **separate, deterministic** issue also found by Phase 192, tracked with the
lipsync work. It does not fail any test.

## Re-derivation (Phase 128, 2026-08-27)

Re-checked against `HEAD` in this worktree, per D-04/D-06/D-07. `.planning/REQUIREMENTS.md:99`
states the flake family is "Four separate filings that are ONE family" — of the three filed in
this repo, this one and `kg-answer-sync-glxy02-test-flake.md` both name the SAME underlying
`KnowledgeGraph.test.tsx` GLXY-02 failure (this filing also separately names `JobsPanel.test.tsx`,
which neither of the other two filings mentions). "A different test fails each run" is a claim
about run-to-run statistical behaviour, which by definition cannot be settled by reading any
single point-in-time state of the source — this todo's own suggested first move is "run the suite
N times." Context only: `src/test/setup.ts`'s `audioWorklet` guard, which this todo's own
investigation already exonerated by reading (`proto.audioWorklet` is `undefined` under jsdom both
before and after the cited change), is unchanged this session — re-confirms the exoneration,
proves nothing about whether the flake itself still fires.

This todo's frontmatter was also normalized this session to carry the same keys as its siblings
(`planted`, `planted_during`, `trigger_when`, `scope`, `source`, `last_reviewed`), each sourced
from the body text where the file states it, and `unknown — not recorded at filing time` where it
does not (per D-04/D-06 — no value was invented).

**REQUIRES LIVE MEASUREMENT — deferred to Phase 136.** Full ledger entry:
`.planning/phases/128-planning-reconciliation/128-TODO-OPEN-EVIDENCE.md`, Verdict 13.
`resolves_phase: 136` confirmed against `.planning/REQUIREMENTS.md:259`
(`FLAKE-01 | Phase 136 | Pending`).
