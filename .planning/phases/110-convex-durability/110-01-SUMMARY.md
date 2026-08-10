# Phase 110 Plan 01: Prune-Chain Helper Extraction Summary

Three pure, dependency-free helpers (`partitionBatchForPrune`, `resolveRotationStart`,
`planRotationWrite`) added to `convex/retentionCursor.ts` with unit tests, extracting the
D-02/D-05/D-06 decisions before either is wired into the live `pruneBatchV3` mutation.

## What Was Built

### Task 1 — `convex/retentionCursor.ts`

- **`partitionBatchForPrune<T>(batch, predicate?)`** — splits a batch into `{ toDelete, lastCreationTime }`.
  `lastCreationTime` is sourced from every doc iterated (deleted or skipped), never from `toDelete`
  alone. This is the Pitfall-1 fix: once a predicate can skip a doc without deleting it, a fully-skipped
  batch would otherwise report `lastCreationTime: null`, which `planNextPruneStep`'s
  `Math.max(lastCreationTime ?? cursorMs, cursorMs)` clamp resolves to an unchanged cursor — the same
  head-rescan self-defeat class this module was extracted to fix in the first place.
- **`resolveRotationStart(rawValue, tableCount)`** — returns `rawValue` only when it is a finite integer
  in `[0, tableCount)`; every other input (`undefined`, `null`, `NaN`, a string, a non-integer, negative,
  or `>= tableCount`) resolves to `0` without throwing.
- **`planRotationWrite(action, tableIndex)`** — returns `tableIndex` for `"cap-reached"`, `0` for `"done"`,
  and `null` for the two interior actions (`"continue-table"`, `"next-table"`), so no per-batch
  `agentConfigs` write can ever be introduced.

`planNextPruneStep` and its interfaces are byte-identical to HEAD — only additions, verified via
`git diff HEAD`. The file remains import-free (`grep -c "^import "` returns `0`).

### Task 2 — `convex/retentionCursor.test.ts`

Added three `describe` blocks (27 tests total, up from 10 pre-existing; zero pre-existing tests
edited except the import line). Covers:
- The Pitfall-1 all-skipped-batch regression, asserted end-to-end through a *real*
  `planNextPruneStep` call fed the real `partitionBatchForPrune` output (not a hand-built object) —
  `cursorMs` strictly advances despite zero deletions.
- The negative control, in its own `it(...)`, proving the regression test is not vacuous: feeding
  `lastCreationTime: null` (the pre-fix behavior) into the identical `planNextPruneStep` call leaves
  the cursor unchanged.
- No-predicate, mixed-predicate (including "final doc is the one skipped"), and empty-batch cases.
- All seven `resolveRotationStart` rejection inputs via `it.each`.
- All three `planRotationWrite` action outcomes.

## Mutation Check (required, verbatim)

Mutated `partitionBatchForPrune` to source `lastCreationTime` from inside the `if` branch (i.e. from
`toDelete` only) instead of unconditionally per doc:

```ts
// MUTATED (temporary):
for (const doc of batch) {
  if (!predicate || predicate(doc)) {
    toDelete.push(doc);
    lastCreationTime = doc._creationTime; // now only set on push
  }
}
```

**RED — `npx vitest run convex/retentionCursor.test.ts` under the mutation:**

```
 RUN  v4.1.9 C:/Users/mandr/codepulse

 ❯ convex/retentionCursor.test.ts (27 tests | 3 failed) 40ms
     × Pitfall-1 regression: a full batch where the predicate rejects every doc still reports a non-null lastCreationTime 6ms
     × Pitfall-1 regression, end-to-end: an all-skipped batch's real result still advances planNextPruneStep's cursor despite zero deletions 1ms
     × splits a mixed batch correctly and still reports the final doc's timestamp even when the final doc is skipped 3ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  convex/retentionCursor.test.ts > partitionBatchForPrune — Phase 110 D-02 predicate-aware batch split > Pitfall-1 regression: a full batch where the predicate rejects every doc still reports a non-null lastCreationTime
AssertionError: expected null to be 200000 // Object.is equality
    ❯ convex/retentionCursor.test.ts:163:30

 FAIL  convex/retentionCursor.test.ts > partitionBatchForPrune — Phase 110 D-02 predicate-aware batch split > Pitfall-1 regression, end-to-end: an all-skipped batch's real result still advances planNextPruneStep's cursor despite zero deletions
AssertionError: expected 1000 to be greater than 1000
    ❯ convex/retentionCursor.test.ts:181:27

 FAIL  convex/retentionCursor.test.ts > partitionBatchForPrune — Phase 110 D-02 predicate-aware batch split > splits a mixed batch correctly and still reports the final doc's timestamp even when the final doc is skipped
AssertionError: expected 3000 to be 4000 // Object.is equality
    ❯ convex/retentionCursor.test.ts:210:30

 Test Files  1 failed (1)
      Tests  3 failed | 24 passed (27)
```

Mutation reverted (restored the unconditional `lastCreationTime = doc._creationTime;` outside the
`if`).

**GREEN — `npx vitest run convex/retentionCursor.test.ts` after revert:**

```
 RUN  v4.1.9 C:/Users/mandr/codepulse

 Test Files  1 passed (1)
      Tests  27 passed (27)
   Duration  2.86s
```

The end-to-end regression test (the one whose assertion is on `planNextPruneStep`'s real return, not
a hand-built object) is among the 3 that fail under the mutation — it genuinely guards the wiring
between the two functions, not just `partitionBatchForPrune` in isolation.

## Deviations from Plan

None — plan executed exactly as written. One drafting note: the plan's interface citation
(`convex/retentionCursor.ts:33-35`) for "this repo has no `convex-test` harness" was verified against
the live file at execution time and is accurate as written.

## Verification

- `npx tsc --noEmit` — exits 0 (run twice: after Task 1, and again after Task 2's additions).
- `npx vitest run convex/retentionCursor.test.ts` — 27/27 pass.
- `npx vitest run convex/retentionCursor.test.ts -t "resolveRotationStart"` — 8/8 pass (1 explicit +
  7 `it.each` cases), 19 skipped (filtered out), matching all seven rejection inputs from `<behavior>`.
- `npx vitest run convex/retentionCursor.test.ts convex/retention.test.ts` (blast-radius control) —
  34/34 pass; `retention.test.ts` unaffected.
- `git diff HEAD -- package.json package-lock.json` — empty. No packages installed this plan.
- `git diff HEAD -- convex/retentionCursor.ts` — additions only (`planNextPruneStep` untouched).
- `git diff HEAD -- convex/retentionCursor.test.ts` — the only deleted line is the import statement
  being extended to include the three new named imports.

## Concurrent-Session Isolation

A different session is actively editing `src/App.tsx`, `src/lib/navRegistry.ts`,
`src/hooks/useGaldrPrompts.ts`, and `src/pages/Galdr.tsx` (Phase 116 galdr UI work) in this same
checkout throughout this plan's execution. Both commits below staged only their own explicit file
paths (`git add convex/retentionCursor.ts` and `git add convex/retentionCursor.test.ts`), never `-A`
or `.`, and `git show --stat HEAD` was read after each commit to confirm no foreign file was swept
in. Neither commit touched any `src/` file, `.planning/STATE.md`, or `.planning/ROADMAP.md`.

## Commits

| Task | Commit | Files |
|------|--------|-------|
| 1 | `adf96090` | `convex/retentionCursor.ts` (76 insertions, 0 deletions) |
| 2 | `40e8a2db` | `convex/retentionCursor.test.ts` (121 insertions, 1 deletion — the extended import line) |

## Self-Check

- `convex/retentionCursor.ts` exists and exports the three new functions: FOUND (grep count = 3).
- `convex/retentionCursor.test.ts` exists and imports them: FOUND (`import { ... partitionBatchForPrune ... }`).
- Commit `adf96090` exists: FOUND (`git log --oneline --all | grep adf96090`).
- Commit `40e8a2db` exists: FOUND (`git log --oneline --all | grep 40e8a2db`).

## Self-Check: PASSED
