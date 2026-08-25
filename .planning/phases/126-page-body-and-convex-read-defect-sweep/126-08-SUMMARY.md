---
phase: 126-page-body-and-convex-read-defect-sweep
plan: 08
subsystem: database
tags: [convex, graph-snapshot, chunked-blob, dos-mitigation, vitest, verification]

# Dependency graph
requires: ["126-02", "126-05"]
provides:
  - "convex/graphSnapshots.test.ts -- round-trip fidelity, READ COST, seq ORDERING and completeness (seq-gap/over-cap) assertions for getProjectGraph's chunked read, each with a control proven to fail; a recording-ctx assertion proving the read is issued through by_snapshot_version_seq specifically (not just correctly rejoined); getGraphEntityPage's page-size clamp; backfillGraphBlob's argument reconstruction"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Recording fake ctx for a query handler (table/index/bounds/order/limit), convex/alertsCountBounded.test.ts's idiom, extended here to getProjectGraph so a wrong-index misselection is caught even when the rejoin is coincidentally correct"
    - "getFunctionName(fnRef) identity dispatch for a hand-built runQuery/runMutation action ctx -- internal.* is a Proxy returning a NEW object per access, so a strict === comparison silently never matches (verified against node_modules/convex/dist/cjs/server/api.js)"

key-files:
  created: []
  modified:
    - convex/graphSnapshots.test.ts

key-decisions:
  - "Sized the read-cost/round-trip fixture to D-05's EXACT live measurement (4,001 nodes / 2,590 links) rather than a rounder number, so the read-cost test's contrast against the 6,591-row pre-change figure is apples-to-apples, not an arbitrary large fixture."
  - "Corrupted-chunk control removes the blob's own trailing '}' (a structural delimiter) rather than a character from inside a string value, per the plan's review-fix correction -- a string-interior deletion leaves syntactically valid JSON and would not reliably reproduce the failure the control asserts."
  - "Added a permanent index-selection assertion (recording the table/index/bounds/order/limit actually issued) alongside the existing round-trip/ordering value assertions, then ran it as the subject of a temporary mutation proof (index renamed to by_snapshot_version) to demonstrate the value assertions alone cannot catch a wrong-index misselection."

requirements-completed: [SWEEP-02]

# Metrics
duration: ~40min
completed: 2026-08-25
---

# Phase 126 Plan 08: Chunked-Blob Read Verification Summary

**Extended `convex/graphSnapshots.test.ts` with the three properties D-06-REVISED requires of the chunked graph read -- round-trip fidelity, READ COST, and seq ORDERING -- each proven against a realistically sized (4,001-node/2,590-link) fixture with a control shown to fail, plus a recording-ctx assertion that the read is issued through `by_snapshot_version_seq` specifically (proven to catch a wrong-index misselection the rejoin-only tests cannot).**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-08-25 (commit `4c4aaec6`)
- **Tasks:** 2/2
- **Files modified:** 1 (`convex/graphSnapshots.test.ts`)

## Shared-checkout disclosure (read this before the rest)

`convex/graphSnapshots.ts` and `convex/graphSnapshots.test.ts` already carried substantial
**uncommitted** changes from a concurrent session when I started (`git status` showed both
modified before I made any edit). Content: a review-correction converting
`upsertGraphSnapshot`'s TOCTOU/`expectedVersion` guard from `throw new ConvexError(...)` to a
returned `{status: "versionAdvanced", ...}` object (a real bug: the throw would have propagated as
an uncaught exception through `backfillGraphBlob`'s `ctx.runMutation` call, defeating that
action's own "every path returns a named status" contract), plus two new `describe` blocks in the
test file proving `backfillGraphBlob` surfaces that race correctly via a `getFunctionName`-identity
`runQuery`/`runMutation` fake ctx.

This was **not part of my 126-08 task list** and I did not touch, revert, or build on top of the
production-code half of it beyond reading it for context. I disclosed the collision to the team
lead before doing any work (message sent at session start). The concurrent session committed its
work partway through my session (`606e07fa` "fix(126-05): TOCTOU guard returns a named status
instead of throwing", followed by `e2901cb0` documenting it in the 126-05 SUMMARY) — by the time I
ran my final verification, `convex/graphSnapshots.ts` was clean against `HEAD` again, and my own
commit (`4c4aaec6`) touches only `convex/graphSnapshots.test.ts`, confirmed by `git show --stat`.
Because of this, my plan's stated verification ("git diff convex/graphSnapshots.ts empty at the
end") holds in the literal, strongest sense: the file is byte-identical to `HEAD`, not merely to
some earlier snapshot I had to reconstruct.

**Practical effect on my six mutation proofs:** each one used the working-tree content present at
the moment I started it (backed up to a scratch copy first, per the "never `git checkout --` on a
file with other uncommitted work" rule) and restored to that exact content afterward — verified via
`diff` against the backup after every single proof, shown below. None of the reverts depended on
`git checkout`.

## Accomplishments

### Task 1 — round-trip fidelity and READ COST, each with a control (SWEEP-02)

- **Fixture:** 4,001 nodes / 2,590 links — the EXACT counts D-05 measured live
  (`graphSnapshots:listSnapshots`, 2026-08-24: `nodeCount: 4001`, `linkCount: 2590`, 6,591 rows
  against the 4,096-read ceiling). Serialized blob length: **918,697 characters**. Chunk count at
  `GRAPH_BLOB_CHUNK_CHARS = 128,000`: **8 chunks**. Against D-06-REVISED's ~1.03 MB / ~9-chunk
  measurement this is the same order of magnitude, not a 3-row toy that would pass against almost
  any reader.
- **Round-trip:** asserts `getProjectGraph._handler(...).nodes`/`.links` deep-equal the exact
  parsed fixture blob — on the VALUE, not the absence of a throw.
- **Round-trip control 1 (corrupted chunk):** removes the blob's own trailing character. Verified
  fixture sanity inline: the removed character IS `"}"`, at the blob's own final offset
  (`fixture.blob.length - 1` = 918,696), which the last chunk also ends with. Per the plan's review
  fix, this is a STRUCTURAL delimiter, not a string-value character — removing a character from
  inside a string value (e.g. `"node123"` -> `"node13"`) would leave syntactically valid JSON and
  the control would not reliably fail. Asserts `caught instanceof ConvexError` and
  `.data` matches `/failed to parse rejoined blob/` — on `.data`, not a message-string match, since
  a plain `Error` here would redact to "Server Error" client-side.
  **Stated limit, honestly:** `JSON.parse` succeeding proves only that the rejoined bytes are
  well-formed JSON, not that they are the exact bytes the writer produced. Detecting a
  valid-but-altered blob (a swapped character inside a string value) would need a stored checksum,
  which this phase does not add — this control catches STRUCTURAL corruption only, not silent
  content corruption. Not filed as a todo; flagged here per the plan's instruction to state the
  limit rather than imply parse success is an integrity check.
- **Round-trip control 2 (truncated set):** drops the last chunk row while leaving
  `meta.blobChunkCount` at the original count (8). Asserts the `ConvexError`'s `.data` names BOTH
  numbers (`expected 8 chunk rows but found 7`).
- **Total chunk loss (bonus, not explicitly required but a real distinct guard branch):**
  `blobChunkCount > 0` with zero rows returned asserts `.data` matches `/total chunk loss/`,
  distinguishing it from the graceful-skip-null path.
- **Read cost:** asserts `readCount()` equals EXACTLY `chunkRows.length + 1` (= 9: 1 meta read + 8
  chunk rows), quoted against the two reference figures in the same test's comment: D-05's
  6,591-row pre-change measurement and the 4,096-read ceiling. `readCount()` is over 700x smaller
  than the figure it replaces.
- **Read cost control:** proven via mutation proof 2 below (harness's `.collect()` throw fires for
  the chunk table too, not only the entity tables it was originally written for).
- **Return contract:** `Object.keys(result).sort()` asserted against the exact 9-key pre-change set.
- **Graceful skip:** a meta doc with no `blobChunkCount` field and zero rows returns `null`; a
  missing meta doc also returns `null` (bonus case).

### Task 2 — ORDERING, the seq gap, over-cap, backfill paging, and argument reconstruction (SWEEP-02)

- **Ordering:** a 5-chunk fixture with insertion order **3,1,4,0,2** against seq order **0,1,2,3,4**
  (deliberately different, per the plan's explicit worked example) — served through the harness in
  that non-seq insertion order, and the reassembled graph matches the original exactly. Fixture
  sanity asserted inline (`insertionOrderRows.map(r => r.seq)` equals `[3,1,4,0,2]`, NOT
  `[0,1,2,3,4]`).
- **Ordering control, both halves:**
  - Half 1 (rows served out-of-seq still pass): the test above IS this half.
  - Half 2 (removing the reader's sort fails): mutation proof 1 below.
- **Index-selection assertion (review fix):** a new permanent test asserts, on the RECORDED read
  (not the rejoined value), that `getProjectGraph` issues exactly one `take()` against
  `graphSnapshotBlobChunks` via index `by_snapshot_version_seq`, bounds `eq(snapshotId)` +
  `eq(version)`, order `asc`, limit `GRAPH_BLOB_MAX_CHUNKS + 1`. Its control is the mutation proof
  described below (not a second permanent test): renaming the index string to
  `by_snapshot_version` made ONLY this test go RED while every round-trip/ordering test — which
  only check the rejoined value — stayed GREEN, proving those tests structurally cannot catch a
  wrong-index misselection on their own.
- **Seq gap:** chunks `seq 0,1,3` (missing 2) with `blobChunkCount = 3` (row COUNT matches, so the
  missing-chunk-count guard does not fire first) asserts `.data` matches `/missing chunk seq 2/`.
- **Over-cap:** `GRAPH_BLOB_MAX_CHUNKS + 1` (17) rows asserts `.data` matches
  `/GRAPH_BLOB_MAX_CHUNKS \(16\)/`.
- **Backfill paging (`getGraphEntityPage`):** a fake `ctx.db` recording the `numItems` actually
  passed to `.paginate()`. `numItems: 999_999` records exactly `1000` (`BACKFILL_PAGE_SIZE`) and the
  returned page is `<= 1000` rows. Control: `numItems: 250` (below the cap) records `250` unclamped
  — proving the assertion above measures a CLAMP, not a hardcoded constant.
- **Backfill argument reconstruction:** drove `backfillGraphBlob._handler` with a hand-built
  action ctx (`runQuery`/`runMutation` stubs dispatched by `getFunctionName` identity — the SAME
  seam the pre-existing concurrent-session tests in this file already use for this exact action,
  reused rather than reinvented, as the plan allows). Asserts the reconstructed
  `upsertGraphSnapshot` argument maps `nodeId -> id`, carries `sources`/`nodeCount`/`linkCount`/
  `generatedAt` from the meta doc VERBATIM (not recomputed), `receivedAt` bounded between two
  `Date.now()/1000` samples taken immediately around the call (epoch seconds), and
  `expectedVersion` equal to the version it paged against.
- **Nyquist note added below**, as the plan's action step requires.

## Nyquist

Every task in Phase 126 that touches `convex/graphSnapshots.ts` (production code or its test
file), for `126-VALIDATION.md`'s Per-Task Verification Map:

| Task | What it touches | Automated command |
|---|---|---|
| 126-02 | `convex/schema.ts` + `convex/graphSnapshots.ts` (writer: chunk table, `splitGraphBlob`/`joinGraphBlobChunks`, `upsertGraphSnapshot` rewrite) + its own test additions | `npx vitest run convex/graphSnapshots.test.ts` |
| 126-05 | `convex/graphSnapshots.ts` (reader: `getProjectGraph` rewrite, `backfillGraphBlob` + `getGraphMetaForBackfill`/`getGraphEntityPage`) | `npx vitest run convex/graphSnapshots.test.ts` |
| 126-08 (this plan) | `convex/graphSnapshots.test.ts` only — verification: round-trip, read-cost, index-selection, ordering, seq-gap, over-cap, backfill-paging, backfill-argument-reconstruction, each with a failing control | `npx vitest run convex/graphSnapshots.test.ts` |
| 126-09 | Does NOT modify `graphSnapshots.ts`; deploys it (`npx convex deploy --env-file ...`) and runs the live one-shot backfill | `npx convex run graphSnapshots:backfillGraphBlob '{}' --env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile` (human-gated, not automatable) |
| (out-of-band) | Concurrent-session commits `606e07fa`/`e2901cb0`, landed under the `126-05` prefix during my session — TOCTOU guard throw->return correction, not a numbered task in this phase's plan set | `npx vitest run convex/graphSnapshots.test.ts` (covered by the pre-existing `expectedVersion TOCTOU guard` describe block, which they updated) |

01/03/06/07 reference `convex/graphSnapshots.ts` only as a cited PATTERN/precedent in their own
`<context>` sections (e.g. the `take(CAP+1)` truncation idiom) — they do not modify the file, so
they are not listed above.

## Mutation Proofs — verbatim RED, then confirmed GREEN + byte-identical revert

Each proof: backed up `convex/graphSnapshots.ts` to a scratch copy BEFORE any mutation (never used
`git checkout --`, since the file already carried other uncommitted work at the time); mutated;
ran `npx vitest run convex/graphSnapshots.test.ts`; reverted by restoring the exact prior text;
re-ran to confirm 90 passed and `diff` against the scratch backup to confirm byte-identical revert.

**Task 1, proof 1 — missing-chunk-count comparison removed:**
```
 ❯ |unit| convex/graphSnapshots.test.ts (95 tests | 1 failed | 5 todo) 111ms
     × CONTROL: a truncated chunk SET (last row missing, blobChunkCount unchanged) raises ConvexError naming both counts, not a shorter graph 9ms
AssertionError: expected 'getProjectGraph: snapshotId "test-gra…' to match /expected 8 chunk rows but found 7/
+ Received:
"getProjectGraph: snapshotId \"test-graph-126-08-read\" version 1 — failed to parse rejoined blob from 7 chunk(s): Expected ',' or ']' after array element in JSON at position 896000 (line 1 column 896001)"
Tests  1 failed | 89 passed | 5 todo (95)
```
Reverted; re-ran: `90 passed | 5 todo (95)`; `diff` against backup: identical.

**Task 1, proof 2 — `.take(GRAPH_BLOB_MAX_CHUNKS + 1)` replaced with `.collect()`:**
```
 Tests  11 failed | 79 passed | 5 todo (95)
```
All 11 failures were `Error: REGRESSION: unbounded .collect() on graphSnapshotBlobChunks` — the
harness's collect-throw guard, proven live for the chunk table (not just the entity tables it was
originally written for). Reverted; re-ran: `90 passed | 5 todo (95)`; `diff`: identical.

**Task 2, proof 1 — `joinGraphBlobChunks`'s `seq` sort removed:**
```
 Tests  2 failed | 88 passed | 5 todo (95)
```
Both my new ordering test AND the pre-existing 126-02 shuffle test (`joinGraphBlobChunks sorts by
seq — shuffled row order still returns the identical string`) failed — the ordering test's own
error was a `ConvexError` from the JSON.parse guard (`Unexpected token ','...`). Reverted; re-ran:
`90 passed | 5 todo (95)`; `diff`: identical.

**Task 2, proof 2 — reader's dense-`seq` check removed:**
```
 Tests  1 failed | 89 passed | 5 todo (95)
AssertionError: expected undefined to be an instance of ConvexError
```
**Notable, and worth stating precisely (the plan asked which shape the failure takes):** with this
guard removed, the seq-gap fixture (`seq 0,1,3`, chunks `'{"nodes":['`, `'],"links":[]}'`, `''`)
did NOT even produce a `JSON.parse` throw — joined in seq order it happens to read as the
syntactically valid `{"nodes":[],"links":[]}"`, a PLAUSIBLE EMPTY GRAPH, worse than a parse error.
`caught` was `undefined`; the test failed on `expect(caught).toBeInstanceOf(ConvexError)`. This is
exactly the "plausible truncated graph at worst" case 126-CONTEXT.md's PRECEDENT QUALIFIED note
warns about, demonstrated directly rather than only asserted. Reverted; re-ran: `90 passed | 5 todo
(95)`; `diff`: identical.

**Task 2, proof 3 — internal clamp in `getGraphEntityPage` removed:**
```
 Tests  1 failed | 89 passed | 5 todo (95)
AssertionError: expected 999999 to be 1000
```
Reverted; re-ran: `90 passed | 5 todo (95)`; `diff`: identical.

**Index-selection control (review fix) — reader's index renamed `by_snapshot_version_seq` ->
`by_snapshot_version`:**
```
 Tests  1 failed | 89 passed | 5 todo (95)
AssertionError: expected 'by_snapshot_version' to be 'by_snapshot_version_seq'
```
Exactly ONE failure — the index-selection test itself. Every round-trip and ordering test (which
assert only on the rejoined VALUE) stayed GREEN, proving they structurally could not have caught
this misselection on their own. Reverted; re-ran: `90 passed | 5 todo (95)`; `diff`: identical;
`npx tsc --noEmit` exit 0.

## Verbatim Test Output

**Before this plan's edits (working tree at session start, includes the then-uncommitted
concurrent session's work, later committed as `606e07fa`):**
```
 Test Files  1 passed (1)
      Tests  73 passed | 5 todo (78)
```

**After both tasks:**
```
 Test Files  1 passed (1)
      Tests  90 passed | 5 todo (95)
```
17 new tests.

**`npx tsc --noEmit`:** exit 0, no output.

**`npm test` (full suite, final state):**
```
 Test Files  364 passed | 17 skipped (381)
      Tests  5122 passed | 4 skipped | 195 todo (5321)
```
0 failed.

## Task Commits

1. **Tasks 1 + 2 combined: round-trip/read-cost/index-selection/ordering/gap/over-cap/paging/
   argument-reconstruction tests** — `4c4aaec6` (test) — `convex/graphSnapshots.test.ts` only
   (1 file, 542 insertions, 0 deletions). Combined into one commit rather than two: both tasks
   extend the SAME `describe`-block region of the SAME file with no natural per-task file boundary,
   and both were verified together (`npx vitest run` + `npx tsc --noEmit`) before the first commit
   opportunity — mirrors 126-01's and 126-05's same documented choice for the same reason.

`git show --stat 4c4aaec6`:
```
 convex/graphSnapshots.test.ts | 542 ++++++++++++++++++++++++++++++++++++++++++
 1 file changed, 542 insertions(+)
```

## Files Created/Modified

- `convex/graphSnapshots.test.ts` — 17 new tests across 9 new `describe` blocks: round-trip
  fidelity + 2 controls + total-chunk-loss, read cost, index-selection, return contract, graceful
  skip (+1 bonus), ordering + fixture-sanity, seq-gap, over-cap, backfill paging + clamp control,
  backfill argument reconstruction. New helpers: `buildReadMeta`, `buildReadFixture`,
  `makeGraphReadCtx` (the reader's recording fake ctx, sibling to `makeGraphSweepCtx`/
  `makeGraphWriteCtx` already in this file — not a new harness idiom).

## Decisions Made

- **Fixture sized to D-05's exact live counts** (4,001 nodes / 2,590 links), not a rounder number,
  so the read-cost test's contrast against the 6,591-row pre-change figure is a direct comparison
  against the SAME graph shape, not an unrelated large fixture.
- **Corrupted-chunk control targets the blob's own closing `}`**, per the plan's review-fix
  correction, and the test asserts inline (not just claims in prose) that the removed character IS
  `"}"` at the blob's own final offset — making the control's validity self-checking rather than
  asserted only in the SUMMARY.
- **Added a permanent index-selection assertion** distinct from the value-based round-trip/ordering
  assertions, specifically because the review flagged that a wrong-index misselection would
  otherwise hide behind a correct-looking rejoin (the JS-side `seq` sort repairs the input
  regardless of which index served it).
- **Reused the pre-existing `getFunctionName`-identity `runQuery`/`runMutation` dispatch seam**
  (already present in this file from the concurrent session's work, for the same
  `backfillGraphBlob` action) for the argument-reconstruction test, rather than inventing a second
  action-testing idiom.
- **Did not add a permanent test for the `.collect()` chunk-table control** — it is exercised as
  mutation proof 2 (task 1), matching the plan's own instruction to prove the guard fires rather
  than requiring a standing test for behavior the production code never exercises on a correct
  path.

## Deviations from Plan

### Disclosed, not a defect in this plan

**Shared-checkout collision, pre-existing at session start** — see the dedicated section above.
Resolved cleanly: the concurrent session committed its work (`606e07fa`, `e2901cb0`) partway
through my session, so my final commit (`4c4aaec6`) touches only `convex/graphSnapshots.test.ts`
and `convex/graphSnapshots.ts` is byte-identical to `HEAD`.

### Auto-fixed Issues

None. No Rule 1/2/3 fixes were needed — this plan is test-only and the production code it exercises
(126-02's writer, 126-05's reader, plus the concurrent session's TOCTOU-guard correction) was
already correct against every property this plan tests.

**Total deviations:** 0 code-behavior deviations; 1 disclosed shared-checkout collision (not caused
by this plan, resolved before commit).
**Impact on plan:** None on scope or correctness. Both tasks' `<done>` criteria are met exactly as
specified.

## User Setup Required

None. No deploy was performed and no `npx convex run` command was executed — plan 126-09 owns the
single operator deploy and the live backfill run for all of Phase 126's Convex work.

## Next Phase Readiness

- SWEEP-02's verification half is complete: round-trip fidelity, read cost, and seq ordering are
  each proven with a failing control, plus completeness (seq-gap, over-cap, total-chunk-loss) and
  the backfill's paging/argument-reconstruction correctness.
- `126-VALIDATION.md`'s Per-Task Verification Map can be filled in directly from the Nyquist table
  above.
- Plan 126-09 can proceed to deploy and run the live backfill; nothing here blocks it.

---
*Phase: 126-page-body-and-convex-read-defect-sweep*
*Completed: 2026-08-25*

## Self-Check: PASSED

`convex/graphSnapshots.test.ts` confirmed present on disk with all 17 new tests (grep-counted
`describe(` blocks added, and `npx vitest run convex/graphSnapshots.test.ts` re-run one final time:
`90 passed | 5 todo (95)`). Commit `4c4aaec6` confirmed via
`git log --oneline --all | grep 4c4aaec6` and `git show --stat 4c4aaec6` (single-file,
542-insertion diff, matching the quoted output above). `convex/graphSnapshots.ts` confirmed
byte-identical to `HEAD` via `git diff HEAD -- convex/graphSnapshots.ts` (empty output).
