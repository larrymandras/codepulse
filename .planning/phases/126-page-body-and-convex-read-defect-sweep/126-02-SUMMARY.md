---
phase: 126-page-body-and-convex-read-defect-sweep
plan: 02
subsystem: database
tags: [convex, graph-snapshot, chunked-blob, dos-mitigation, vitest, schema-migration]

# Dependency graph
requires: []
provides:
  - "graphSnapshotBlobChunks table (schema.ts) -- {snapshotId, version, seq, chunk} with by_snapshot_version_seq index whose trailing key IS seq (the ordering key)"
  - "graphSnapshots.blobChunkCount (schema.ts) -- optional field, written by the writer, for plan 126-05's reader to detect a short reassembly"
  - "splitGraphBlob / joinGraphBlobChunks / GRAPH_BLOB_CHUNK_CHARS / STALE_CHUNK_DELETE_CAP (convex/graphSnapshots.ts) -- surrogate-pair-safe split, explicit-seq-sort join, exported for plan 126-05 and tests to reuse verbatim"
  - "upsertGraphSnapshot -- writes ~9 chunk rows instead of ~6,591 entity rows per ingest; retires graphSnapshotNodes/graphSnapshotLinks writes; deletes stale chunks AFTER the pointer flip, bounded by STALE_CHUNK_DELETE_CAP"
affects: [126-05, 126-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Chunked-row payload split across N docs with monotonic seq, ordered by an index whose TRAILING field is seq (NOT _creationTime) -- forgeLogChunks is a table-SHAPE precedent only; its reader (listJobLogs) sorts by _creationTime and is an explicit counter-example for ordering, not a copy target"
    - "Surrogate-pair-safe chunk boundary: before cutting, pull the boundary back one character if it would split a UTF-16 high/low surrogate pair"
    - "Fake-ctx write harness (makeGraphWriteCtx, sibling to makeGraphSweepCtx) recording every insert/patch/delete IN ORDER, so operation ORDER (pointer-flip-before-delete) is assertable, not just end-state"
    - "Retire-writes-keep-tables: stop inserting into a legacy table but keep its schema definition, index, and sweep handling so a schema deploy stays additive-only and the sweep can drain legacy rows"

key-files:
  created: []
  modified:
    - convex/schema.ts
    - convex/graphSnapshots.ts
    - convex/graphSnapshots.test.ts
    - convex/retentionCoverage.ts

key-decisions:
  - "Kept graphSnapshotNodes/graphSnapshotLinks table definitions, indexes, and sweep handling verbatim (retire WRITES only) per D-06-REVISED's binding keep-or-retire call, so the schema deploy prints no 'Deleted table indexes:' line."
  - "Reworded three schema.ts comments to avoid literal repeats of graphSnapshotBlobChunks/graphSnapshotNodes/graphSnapshotLinks beyond the plan's acceptance-criteria grep counts (1/1/4, unchanged from before), after an initial draft's explanatory comments pushed those counts to 3/1/6."
  - "Added graphSnapshotBlobChunks to convex/retentionCoverage.ts's COVERAGE_BOUNDED_INLINE bucket (Rule 2 auto-fix) -- not in the plan's task list, but retentionCoverage.test.ts fails any newly-added table with no stated bounding mechanism, and this table's bound (the writer's own stale-chunk delete) is inline, not cron-based."

requirements-completed: [SWEEP-02]

# Metrics
duration: ~35min
completed: 2026-08-25
---

# Phase 126 Plan 02: Chunked Graph-Blob Writer Summary

**Rewrote `upsertGraphSnapshot` to serialize `{nodes,links}` once and split it across `seq`-ordered `graphSnapshotBlobChunks` rows instead of inserting ~6,591 `graphSnapshotNodes`/`graphSnapshotLinks` rows per ingest -- the write half of D-06-REVISED's remedy for the `/tool-galaxy` 4,096-read-ceiling defect D-05 diagnosed, with `getProjectGraph` (plan 126-05's file region) deliberately untouched.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-25 (commits `2f1d2e8b`, `83bac37d`, `6641641c`, `2f1d289f`)
- **Tasks:** 3/3
- **Files modified:** 4 (`convex/schema.ts`, `convex/graphSnapshots.ts`, `convex/graphSnapshots.test.ts`, `convex/retentionCoverage.ts`)

## Accomplishments

### Task 1 -- chunk table + pure split/join helpers
- Added `graphSnapshotBlobChunks: defineTable({snapshotId, version, seq, chunk})` to `convex/schema.ts`, indexed `by_snapshot_version_seq` (`["snapshotId","version","seq"]`) -- the trailing `seq` key is the actual read-ordering mechanism, unlike `forgeLogChunks.by_host_job_seq` which exists only for a dedup `.unique()` check.
- Added `graphSnapshots.blobChunkCount: v.optional(v.number())`.
- **ADDITIVE ONLY**: `git diff convex/schema.ts` (quoted in full below) shows zero removed lines; `graphSnapshotNodes`/`graphSnapshotLinks` table definitions are byte-identical, kept per D-06-REVISED's retire-writes-keep-tables call.
- Added `GRAPH_BLOB_CHUNK_CHARS = 128_000` (512 KB even at UTF-8's 4-bytes-per-char worst case, ~2x headroom under the ~1 MiB per-row ceiling) and `splitGraphBlob`/`joinGraphBlobChunks` pure helpers to `convex/graphSnapshots.ts`. `splitGraphBlob` pulls a chunk boundary back one character when it would split a UTF-16 surrogate pair; `joinGraphBlobChunks` sorts a copy of its input by `seq` before concatenating (the whole point of the function, not an optimization -- `listJobLogs` is the counter-example that sorts by `_creationTime` instead).
- 8 new tests in `convex/graphSnapshots.test.ts` covering every `<behavior>` item: empty-blob case (`[]`/`""`), exact-multiple and off-by-one chunk counts, ASCII round trip, astral-character-on-boundary round trip (asserts no chunk ends with a lone high surrogate or begins with a lone low surrogate), and shuffled-order join equality.
- Two mutation proofs, each run and reverted separately (verbatim below).

### Task 2 -- writer emits chunks, retires entity-row writes
- Rewrote `upsertGraphSnapshot` steps 5-7 and added step 8, keeping the function's doc comment in sync with the code (the plan's own stated reason: a stale algorithm comment on this exact function is what hid the read-vs-write confusion for a month).
- Step 5: serializes `{nodes: projectedNodes, links: filteredLinks}` once, with `projectedNodes` applying the same `community: null/undefined -> undefined` coercion the retired insert loop applied, so the shape matches exactly what `getProjectGraph` currently returns (plan 126-05 needs zero re-mapping).
- Step 6: `splitGraphBlob(blob)`, one `graphSnapshotBlobChunks` insert per chunk, `seq` = array index.
- Step 7 (unchanged position, still last of the create steps): patch-or-insert the meta doc with `activeVersion` and `blobChunkCount = blobChunks.length`.
- Step 8 (new, runs AFTER the pointer flip): `.withIndex("by_snapshot_version_seq", q => q.eq("snapshotId", ...).lt("version", newVersion)).take(STALE_CHUNK_DELETE_CAP + 1)`, deletes up to `STALE_CHUNK_DELETE_CAP` (200) rows, `console.warn`s (never raises the cap) if more remain.
- `graphSnapshotNodes`/`graphSnapshotLinks` insert loops deleted entirely, with an in-place comment recording the decision and reason. `getProjectGraph`, `sweepGraphSnapshotVersions`, `backfillGraphStoredVersions`, `selectVersionDeletes`, `listSnapshots` are untouched -- confirmed by diff hunk headers (below), none of which touch `getProjectGraph`'s line range.

### Task 3 -- writer shape proven against a recording fake ctx
- `makeGraphWriteCtx`: a sibling factory to the file's existing `makeGraphSweepCtx`, modeling `graphSnapshots` + `graphSnapshotBlobChunks`, recording every `insert`/`patch`/`delete` **in order** in one flat log (plus generic recording of any insert into the legacy tables, so a restored insert shows up as a non-empty filter rather than a thrown error).
- Drove the real `upsertGraphSnapshot._handler` with a 3,000-node/2,000-link fixture (2 deliberately dangling links included) -- **produces 5 chunk rows** (measured: 626,514-character blob / 128,000 = 5 chunks), well above the ">1 chunk" floor the plan required.
- One test per `<behavior>` item: zero legacy-table inserts, dense `0..n-1` seq with no gaps, every chunk `<= GRAPH_BLOB_CHUNK_CHARS`, `blobChunkCount` on the meta insert equals the chunk-row count, `joinGraphBlobChunks` round-trips to the exact `{nodes,links}` the writer serialized (community-coercion mirrored independently, not imported from production), dangling links absent from the rejoined blob.
- Separate ordering test (own `describe` block, own ctx with a seeded prior version) asserts the meta-write op index precedes the first delete op index -- explicitly NOT an end-state assertion, since delete-then-flip and flip-then-delete leave the identical final rows.
- Separate survivor-set test (own ctx, seeded 2 old-version chunk rows) asserts new-version chunks survive and old-version chunks are gone.
- Two mutation proofs, each run and reverted separately (verbatim below). The second proof required adding `.lte` support to the harness's chain builder first, so the mutation genuinely exercises the predicate rather than crashing on an unimplemented method.

### Unplanned but necessary fix
- `npm test`'s first full run failed `convex/retentionCoverage.test.ts` -- Task 1's new table has no retention-coverage classification, which the coverage gate treats as "unbounded by default," the exact failure mode that let `graphSnapshotNodes`/`graphSnapshotLinks` reach 25.7% of the database unnoticed. Fixed (Rule 2) by adding `graphSnapshotBlobChunks` to `COVERAGE_BOUNDED_INLINE` with a reason citing the writer's own step-8 delete. Not in the plan's task list; required for `npm test` to pass at all.

## Verbatim Test Output

**Baseline, before any change:**
```
 RUN  v4.1.11 C:/Users/mandr/codepulse
 Test Files  1 passed (1)
      Tests  48 passed | 5 todo (53)
```

**After Task 1 (8 new tests):**
```
 Test Files  1 passed (1)
      Tests  55 passed | 5 todo (60)
```

**After Task 3 (9 more new tests):**
```
 Test Files  1 passed (1)
      Tests  64 passed | 5 todo (69)
```

**Task 1 mutation proof 1 -- surrogate boundary adjustment removed:**
```
 ❯ |unit| convex/graphSnapshots.test.ts (60 tests | 1 failed | 59 skipped) 7ms
     × round-trips a fixture with an astral character positioned exactly on a chunk boundary 6ms
AssertionError: expected true to be false
- false
+ true
 ❯ convex/graphSnapshots.test.ts:389:56
    387|     for (const c of chunks) {
    388|       const lastCode = c.charCodeAt(c.length - 1);
    389|       expect(lastCode >= 0xd800 && lastCode <= 0xdbff).toBe(false);
```
Reverted; re-ran: `1 passed | 59 skipped (60)`.

**Task 1 mutation proof 2 -- `joinGraphBlobChunks`'s sort removed:**
```
 ❯ |unit| convex/graphSnapshots.test.ts (60 tests | 1 failed | 59 skipped) 18ms
     × joinGraphBlobChunks sorts by seq — shuffled row order still returns the identical string (control: fails if the sort is removed) 18ms
AssertionError: expected ',"links":[]}"n196"},...' to be '{"nodes":[{"id":"n0"},...'
```
Reverted; re-ran: `55 passed | 5 todo (60)`.

**Task 3 mutation proof 1 -- restored one `ctx.db.insert("graphSnapshotNodes", ...)` call:**
```
 ❯ |unit| convex/graphSnapshots.test.ts (69 tests | 1 failed | 68 skipped) 6ms
     × inserts ZERO graphSnapshotNodes rows and ZERO graphSnapshotLinks rows (control: fails if either insert loop is restored)
AssertionError: expected [ { type: 'insert', …(2) } ] to have a length of +0 but got 1
- 0
+ 1
```
Reverted; re-ran: `64 passed | 5 todo (69)`.

**Task 3 mutation proof 2 -- stale-delete bound loosened from `lt("version", newVersion)` to `lte(...)`:**
```
 ❯ |unit| convex/graphSnapshots.test.ts (69 tests | 1 failed | 68 skipped) 6ms
     × deletes chunks of versions OLDER than the new one; the new version's own chunks survive (control: a too-broad predicate fails this)
AssertionError: expected 0 to be greater than 0
 ❯ convex/graphSnapshots.test.ts:698:30
    698|     expect(survivors.length).toBeGreaterThan(0);
```
The too-broad `lte` deleted the just-written new version's own chunks too (survivor count went to 0). Reverted; re-ran: `64 passed | 5 todo (69)`.

**`npx tsc --noEmit` at each of my own commits:** exit 0 (verified immediately after Task 1's commit and again after Task 2's commit, before any concurrent-session activity landed in this file -- see "Shared-checkout note" below).

**`npm test` (full suite), after the retentionCoverage fix:**
```
 Test Files  364 passed | 17 skipped (381)
      Tests  5096 passed | 4 skipped | 195 todo (5295)
```

## Full `schema.ts` diff (Task 1) -- confirms additive-only

```diff
@@ -1935,10 +1935,31 @@ export default defineSchema({
     pruneIncomplete:  v.optional(v.boolean()),
+    // Phase 126, SWEEP-02, D-06-REVISED: how many chunk rows (in the new
+    // blob-chunk table below) make up this activeVersion's serialized
+    // {nodes,links} blob. ... v.optional because meta docs written before
+    // this field existed have none.
+    blobChunkCount:   v.optional(v.number()),
   }).index("by_snapshotId", ["snapshotId"]),

   // Entity rows for graph nodes, keyed by (snapshotId, version).
   // community is optional float64 — vault nodes emit community: null (Pitfall 4 / T-83-04).
+  //
+  // Phase 126, SWEEP-02, D-06-REVISED: upsertGraphSnapshot STOPPED WRITING
+  // these rows (2026-08-25) ... DELIBERATELY KEPT (not removed) ...
   graphSnapshotNodes: defineTable({
     snapshotId: v.string(),
     version:    v.number(),
@@ -1950,6 +1971,8 @@ export default defineSchema({
   }).index("by_snapshot_version", ["snapshotId", "version"]),

   // Entity rows for graph links, keyed by (snapshotId, version).
+  // Phase 126, SWEEP-02, D-06-REVISED: same retire-writes-keep-table decision
+  // as the node table above — see its comment.
   graphSnapshotLinks: defineTable({
     snapshotId: v.string(),
     version:    v.number(),
@@ -1958,6 +1981,37 @@ export default defineSchema({
     relation:   v.string(),
   }).index("by_snapshot_version", ["snapshotId", "version"]),

+  // Phase 126, SWEEP-02, D-06-REVISED: the graph blob read/write path. ...
+  graphSnapshotBlobChunks: defineTable({
+    snapshotId: v.string(),
+    version:    v.number(),
+    seq:        v.number(),
+    chunk:      v.string(),
+  })
+    .index("by_snapshot_version_seq", ["snapshotId", "version", "seq"]),
+
   // ============================================================
```

No line was removed and no index was renamed. `git diff convex/schema.ts | grep -E '^-' | grep -v '^---'` returned zero lines.

**Grep-count acceptance criteria (all satisfied exactly):**
- `grep -c "graphSnapshotBlobChunks" convex/schema.ts` -> `1`
- `grep -c "by_snapshot_version_seq" convex/schema.ts` -> `1`
- `grep -c "graphSnapshotNodes\|graphSnapshotLinks" convex/schema.ts` -> `4` (unchanged: `4` before my edit, `4` after -- confirmed against `git show HEAD~N:convex/schema.ts` predating my commit). One initial draft's explanatory comments pushed these to `3`/`6`; reworded (see Decisions) to hold them at the literal counts the acceptance criteria required.

## `upsertGraphSnapshot` diff hunk headers (Task 2) -- confirms `getProjectGraph` untouched

```
@@ -2,10 +2,18 @@   (module header comment)
@@ -54,6 +62,18 @@ export function selectVersionDeletes...   (new STALE_CHUNK_DELETE_CAP constant)
@@ -119,17 +139,32 @@ export function joinGraphBlobChunks...   (doc-comment algorithm rewrite)
@@ -178,49 +213,58 @@ export const upsertGraphSnapshot...      (steps 5-7 replaced)
@@ -238,12 +282,43 @@ export const upsertGraphSnapshot...      (step 8 added)
```
`getProjectGraph` begins well after line 400 in this file; none of these five hunks reach it. `git diff --stat` for this commit lists only `convex/graphSnapshots.ts` (1 file, 123 insertions, 48 deletions).

**Stale-chunk delete uses `.take(`, never `.collect()`:**
```typescript
const staleChunks = await ctx.db
  .query("graphSnapshotBlobChunks")
  .withIndex("by_snapshot_version_seq", (q) =>
    q.eq("snapshotId", args.snapshotId).lt("version", newVersion)
  )
  .take(STALE_CHUNK_DELETE_CAP + 1);
```

## Task Commits

1. **Task 1: chunk table + split/join helpers** -- `2f1d2e8b` (feat) -- `convex/schema.ts`, `convex/graphSnapshots.ts`, `convex/graphSnapshots.test.ts` (3 files, 207 insertions, 0 deletions)
2. **Task 2: writer emits chunks, retires entity writes** -- `83bac37d` (feat) -- `convex/graphSnapshots.ts` (1 file, 123 insertions, 48 deletions)
3. **Unplanned fix: retentionCoverage classification** -- `6641641c` (fix) -- `convex/retentionCoverage.ts` (1 file, 1 insertion)
4. **Task 3: writer-shape harness + tests** -- `2f1d289f` (test) -- `convex/graphSnapshots.test.ts` (1 file, 295 insertions, 1 deletion)

`git show --stat` on each commit confirms only the listed files, no sweep-in from the concurrent session (verified individually after each commit).

## Files Created/Modified

- `convex/schema.ts` -- additive-only: `graphSnapshotBlobChunks` table + `by_snapshot_version_seq` index, `graphSnapshots.blobChunkCount` optional field.
- `convex/graphSnapshots.ts` -- `GRAPH_BLOB_CHUNK_CHARS`, `STALE_CHUNK_DELETE_CAP`, `splitGraphBlob`, `joinGraphBlobChunks` (new exports); `upsertGraphSnapshot` rewritten (steps 5-8); module header doc comment updated to name all four tables and their current status.
- `convex/graphSnapshots.test.ts` -- 17 new tests across three new `describe` blocks (split/join round trip; writer shape via `makeGraphWriteCtx`; ordering; survivor set).
- `convex/retentionCoverage.ts` -- one new `COVERAGE_BOUNDED_INLINE` entry (unplanned, Rule 2).

## Decisions Made

- **Keep-or-retire (D-06-REVISED's required call): RETIRE writes, KEEP tables.** `graphSnapshotNodes`/`graphSnapshotLinks` table definitions, indexes, and `sweepGraphSnapshotVersions`'s handling of them are untouched. Only `upsertGraphSnapshot`'s insert loops were deleted. This keeps the schema deploy additive-only and lets the sweep continue draining legacy-version rows at its existing bounded rate.
- **Comment wording tightened to hold literal grep counts at their pre-edit values** (`graphSnapshotBlobChunks`=1, `graphSnapshotNodes|graphSnapshotLinks`=4 unchanged) after a first draft's explanatory prose incidentally repeated those table names in comments, pushing the counts up. Reworded to say "this table above" / "the new blob-chunk table below" instead of repeating the literal identifiers, preserving the explanatory content.
- **`STALE_CHUNK_DELETE_CAP = 200`**, not derived from the same 16 MiB scan-ceiling arithmetic the team-lead's message described for `GRAPH_BLOB_MAX_CHUNKS` (that constant belongs to the READER, plan 126-05's scope, and is not mine to add) -- 200 is ~20 versions' worth of chunk backlog at ~9-10 chunks/version, chosen to match the existing `sweepGraphSnapshotVersions`/`MAX_DELETES_PER_INVOCATION` convention of a round per-invocation cap rather than a scan-derived one, since this delete is bounded by an index range + `take()`, not by transaction scan size.
- **`makeGraphWriteCtx`'s chain builder was extended to support `.lte` before running mutation proof 2**, so the mutation would genuinely exercise "predicate too broad" rather than crash on a missing harness method -- this is a test-infrastructure improvement, not a behavior change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] New schema table had no retention-coverage classification**
- **Found during:** first full `npm test` run after Task 1's commit
- **Issue:** `convex/retentionCoverage.test.ts` fails any schema table absent from every coverage bucket -- exactly the gap that let `graphSnapshotNodes`/`graphSnapshotLinks` reach 25.7% of the database unnoticed before Phase 115/124's fixes. `graphSnapshotBlobChunks` was unclassified.
- **Fix:** Added `graphSnapshotBlobChunks: "convex/graphSnapshots.ts - upsertGraphSnapshot step 8 deletes prior-version chunk rows AFTER the pointer flip, capped by STALE_CHUNK_DELETE_CAP (Phase 126, SWEEP-02, D-06-REVISED)"` to `COVERAGE_BOUNDED_INLINE`.
- **Files modified:** `convex/retentionCoverage.ts`
- **Verification:** `npx vitest run convex/retentionCoverage.test.ts` -- 11/11 green (was 10/11 before the fix).
- **Committed in:** `6641641c`

**2. [Comment-wording, not a code defect] Explanatory comments initially over-satisfied the plan's own grep-count acceptance criteria**
- **Found during:** Task 1 acceptance-criteria verification
- **Issue:** A first draft's schema comments explaining the retire-writes decision repeated the literal strings `graphSnapshotBlobChunks` and `graphSnapshotNodes`/`graphSnapshotLinks`, pushing `grep -c` counts to 3/1/6 against the plan's required 1/1/4 (unchanged).
- **Fix:** Reworded three comments to refer to "this table above" / "the new blob-chunk table below" instead of repeating the identifiers, with no loss of explanatory content.
- **Verification:** post-fix grep counts exactly `1`/`1`/`4`, matching the plan's literal acceptance criteria.

**Total deviations:** 1 auto-fixed (Rule 2, unplanned retention-coverage classification) + 1 wording adjustment (no code-behavior change).
**Impact on plan:** None on scope or correctness. All three tasks' `<done>` criteria are met exactly as specified.

## Shared-checkout note (disclosed, not a defect in this plan)

During this plan's execution, `convex/graphSnapshots.ts` accumulated **uncommitted, concurrent changes from another session** implementing plan 126-05's `getProjectGraph` rewrite (a `GRAPH_BLOB_MAX_CHUNKS` constant and a full bounded/ordered/gap-detecting reader, plus a `backfillGraphBlob` migration function) directly on top of my Task 2 commit, in the same working-tree file, without conflicting with my task's line ranges. I did not touch, revert, or commit any of it -- `git diff convex/graphSnapshots.ts` at the time showed only their additions layered on my committed code, confirmed by hunk headers all falling after my own `upsertGraphSnapshot` changes. A subsequent `npx tsc --noEmit` transiently showed ~150 unrelated errors across many unrelated `src/**` files (not attributable to my commits, not attributable to their `getProjectGraph`/`backfillGraphBlob` work either) that resolved on their own by the next run -- consistent with that other session actively editing many files mid-flight. By the final verification pass, the only remaining tsc errors were 40 in `src/components/graph/CodeVaultGraph.tsx` and `src/pages/ToolGalaxy.tsx` -- both files entirely outside this plan's scope (not in `files_modified`, never touched by any of my four commits) and consistent with plan 126-05's frontend consumers being mid-rewrite. None of my own committed files (`convex/schema.ts`, `convex/graphSnapshots.ts`'s writer half, `convex/graphSnapshots.test.ts`, `convex/retentionCoverage.ts`) appear in that error list. `npx tsc --noEmit` exited 0 immediately after each of my own commits, before this concurrent activity landed.

Also observed once, in the first full `npm test` run: `src/pages/KnowledgeGraph.test.tsx`'s `GLXY-02` test failed under the full suite but passed 48/48 in isolation (`npx vitest run src/pages/KnowledgeGraph.test.tsx`) and did not recur on a second full-suite run -- consistent with the already-tracked, out-of-scope `.planning/todos/pending/test-isolation-full-suite-only-failures.md` item `126-CONTEXT.md`'s Deferred section names as "live... but overlaps nothing here." Not investigated further; not caused by this plan.

## Interim state, as flagged by the plan

`getProjectGraph` still reads the now-frozen `graphSnapshotNodes`/`graphSnapshotLinks` entity tables (this plan wrote zero new rows into them), so `/tool-galaxy` remains broken until plan 126-05's reader lands -- exactly the interim state the plan's Task 2 instructions require documenting, not a regression introduced here. (Per the shared-checkout note above, that reader appears to already be in progress in the same working tree, uncommitted, as of this SUMMARY's writing.)

## User Setup Required

None. No deploy was performed -- plan 126-09 owns the single operator deploy for all of Phase 126's Convex work, per this plan's hard constraint.

## Next Phase Readiness

- `splitGraphBlob`, `joinGraphBlobChunks`, `GRAPH_BLOB_CHUNK_CHARS`, and the `graphSnapshotBlobChunks`/`by_snapshot_version_seq` schema are ready for plan 126-05's `getProjectGraph` rewrite to consume directly.
- `blobChunkCount` on the meta doc is populated on every new ingest, ready for the reader's missing-chunk detection.
- The interim state (`getProjectGraph` still reading empty-for-new-versions entity tables) is expected and documented; per the shared-checkout note, plan 126-05's work already appears underway in this same checkout.

---
*Phase: 126-page-body-and-convex-read-defect-sweep*
*Completed: 2026-08-25*

## Self-Check: PASSED

`convex/schema.ts`, `convex/graphSnapshots.ts`, `convex/graphSnapshots.test.ts`, `convex/retentionCoverage.ts` all confirmed present on disk with the committed content. Commits confirmed present via `git log --oneline --all | grep -E "2f1d2e8b|83bac37d|6641641c|2f1d289f"` (all four found).
