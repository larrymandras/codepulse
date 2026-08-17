---
phase: 110-convex-durability
plan: 03
subsystem: database
tags: [convex, retention, aggregates, self-hosted, prune]

# Dependency graph
requires:
  - phase: 110-01
    provides: "partitionBatchForPrune, resolveRotationStart, planRotationWrite (pure, dependency-free helpers in convex/retentionCursor.ts)"
provides:
  - "aggregates as a 90-day RETENTION_DAYS entry with a period-aware predicate (period:hourly prunable, period:daily kept forever)"
  - "PRUNE_PREDICATES export — the D-03 positive guard target"
  - "nightly prune chain resumes at a persisted, bounds-checked rotation index instead of always restarting at 0"
  - "listRetentionPolicy internalQuery — a live read of RETENTION_DAYS for plan 110-04/110-05 to consume"
  - "self-describing terminal log lines stating start index and coverage"
affects: [110-04, 110-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "predicate-gated delete loop via partitionBatchForPrune, applied AFTER the cursor-seeked query, never folded into it"
    - "get-existing-or-patch single-row agentConfigs cursor (copied from webhookDelivery.ts's setChannel), not the insert-only backfill-cursor idiom"
    - "rotation-cursor write happens once, at chain-terminal actions only, computed via planRotationWrite"

key-files:
  created: []
  modified:
    - convex/retention.ts
    - convex/retention.test.ts
    - convex/aggregates.ts
    - convex/dataRetention.ts

key-decisions:
  - "listRetentionPolicy shipped as internalQuery (the secure default); the plan's own CLI-reachability probe was deferred to plan 110-04 because nothing from this plan is deployed yet — see Deviations"
  - "Rotation-cursor write is done once, immediately after next is computed, before either terminal branch, rather than duplicated per branch — matches D-06's no-per-batch-write requirement structurally, not just by convention"

patterns-established:
  - "Mutation-tested guard: a guard asserting against a callable predicate (not a comment) is verified by breaking the predicate, capturing the test failure, then reverting — applied to both the daily-row guard and the new predicate-key silent-no-op guard"

requirements-completed: [DUR-01, DUR-02]

# Metrics
duration: ~20min (execution only)
completed: 2026-08-10
---

# Phase 110 Plan 03: Aggregates Pruning + Rotation Cursor Summary

**`aggregates` joins the nightly Convex prune chain at 90 days with a period-aware predicate that permanently exempts `period:"daily"` rows, the chain now resumes from a persisted rotation index instead of always restarting at table 0, and `listRetentionPolicy` gives the health-check script a live read of the policy instead of a hand-copied hashtable.**

## Performance

- **Duration:** ~20 min (execution only, per commit timestamps 17:21:54–17:27:05 plus verification)
- **Tasks:** 3
- **Files modified:** 4 (`convex/retention.ts`, `convex/retention.test.ts`, `convex/aggregates.ts`, `convex/dataRetention.ts`)

## Accomplishments

- `RETENTION_DAYS.aggregates = 90` with an in-file rationale comment (D-04), and `PRUNE_PREDICATES.aggregates` (`doc.period !== "daily"`) protecting daily rows — the delete loop now routes through the tested `partitionBatchForPrune` helper so a predicate-skipped doc still advances the cursor (Pitfall 1: an all-skipped batch must not leave `lastCreationTime: null`, which would stall the chain re-reading the same batch forever).
- The nightly chain resumes at a bounds-checked rotation index persisted in a single `agentConfigs` row (`retention.rotationCursor`), patched — never inserted-per-run — at only the two chain-terminal actions (`cap-reached`, `done`).
- Both terminal log lines (`cap-reached`, `done`/"all tables pruned") now state the run's start index, and the "all tables pruned" line additionally states coverage (`covered N of M tables`), so a partial rotation-resumed run is distinguishable from a full pass in the log alone.
- `listRetentionPolicy` (`internalQuery`) returns `RETENTION_DAYS` verbatim — a live read, not a copy — for `retention-health-check.ps1` to eventually consume instead of its own hand-maintained `$RetentionDays` hashtable (already 4 keys stale as of this plan).
- `retention.test.ts`'s keep-forever guard narrowed from `["aggregates", "llmMetrics", "sessions", "alerts"]` to `["llmMetrics", "sessions", "alerts"]`; a new positive guard asserts `PRUNE_PREDICATES.aggregates` directly (mutation-tested); a new silent-no-op guard asserts every `PRUNE_PREDICATES` key is both a real schema table and a `RETENTION_DAYS` key (mutation-tested).
- Repo-wide comment sweep: every "aggregates is kept forever / immutable" claim corrected to describe the period-aware split.

## Task Commits

1. **Task 1: Add the aggregates entry, the predicate map, and predicate-aware batch bookkeeping** — `fd896605` (feat)
2. **Task 2: Add the nightly rotation cursor, the listRetentionPolicy read, and a self-describing terminal log line** — `ae6fe7b7` (feat)
3. **Task 3: Narrow the keep-forever guard, add the positive predicate guard, and sweep the stale aggregates comments** — `4dde5dd9` (test)

Each commit staged only its own explicit file paths (never `-A`/`.`); `git show --stat HEAD` was read after every commit and confirmed no foreign file was swept in (see Concurrent-Session Isolation below).

## Files Created/Modified

- `convex/retention.ts` — `aggregates: 90` + rationale, `PRUNE_PREDICATES` export, predicate-gated delete loop, rotation cursor read/write, `startIndex` threaded through the chain, self-describing terminal log lines, `listRetentionPolicy`.
- `convex/retention.test.ts` — narrowed D-03 guard, new positive `PRUNE_PREDICATES.aggregates` guard, new silent-no-op guard over predicate keys, comment sweep at the Phase-108 gap-closure paragraph.
- `convex/aggregates.ts` — corrected `backfillTokenSplit`'s doc-comment parenthetical about which tables `retention.ts` physically deletes.
- `convex/dataRetention.ts` — corrected `purgeOldTelemetryEvents`'s header comment; the "never read/patched/deleted HERE" prohibition on `aggregates` stays verbatim, only the "immutable historical buckets" claim was scoped to daily rows.

## Decisions Made

- **`listRetentionPolicy` ships as `internalQuery`, and its CLI-reachability check is deferred to plan 110-04.** The plan's Task 2E literally instructed running `npx convex run retention:listRetentionPolicy` against the deployed backend to decide between `internalQuery` and public `query`. Nothing from this plan (or phase, at this wave) is deployed — deploy is plan 110-04, gated on separate operator authorization — so that invocation could only ever fail with "function not found," which is not evidence about whether `npx convex run` can reach an `internalQuery`. Following the instruction literally would have downgraded a new callable surface to public with no security justification, contradicting the threat register's own T-110-03-04 disposition ("`internalQuery` by default … a downgrade to public `query` is permitted only if the CLI provably cannot reach the internal form"). `110-04-PLAN.md` Task 1 probe 5 independently confirms this: it calls the same function pre-deploy and explicitly expects that call to FAIL as the known-absent control proving a post-deploy success means the deploy landed — i.e., this exact "unrunnable at this wave" failure mode is already designed into the next plan. This was directed by the orchestrator's dispatch message and is recorded here per its instruction, not decided independently by this executor.
- **The rotation-cursor write is a single call site**, placed immediately after `next` (the `planNextPruneStep` result) is computed and before either terminal branch checks it — not duplicated inside `cap-reached` and again inside the "done" path. `planRotationWrite` already returns `null` for the two interior actions, so this single call site naturally never fires mid-run.

## Deviations from Plan

### Auto-fixed / Directed Issues

**1. [Orchestrator-directed plan defect] Task 2E's CLI-reachability check deferred to plan 110-04**
- **Found during:** Task 2 (listRetentionPolicy)
- **Issue:** The plan instructed running `npx convex run retention:listRetentionPolicy` to empirically decide `internalQuery` vs. public `query`. This plan's code is not deployed; the invocation cannot produce a meaningful answer at this wave and could only misleadingly suggest "internal functions are refused" when the real cause is "function does not exist yet."
- **Resolution:** Directed explicitly by the orchestrator's dispatch message (see `<PLAN_DEFECT_the_orchestrator_already_resolved__READ_FIRST>`). Shipped `listRetentionPolicy` as `internalQuery` (the secure default named in the threat register), performed no deploy and no `npx convex run` of any kind, and left the empirical check to plan 110-04 Task 3, which already requires recording the exact function form against the deployed backend.
- **Files modified:** `convex/retention.ts`
- **Verification:** `grep -c "handler: async () => RETENTION_DAYS" convex/retention.ts` → `1`; no `npx convex run`/`deploy`/`import`/`env` command was executed at any point in this session (confirmed by reviewing this transcript — every verification command used was `npx vitest`, `npx tsc --noEmit`, or `grep`/`git`).
- **Committed in:** `ae6fe7b7` (Task 2 commit)

**2. [Documentation accuracy] Task 2's `<verify>` block includes `retention.test.ts`, which fails between Task 1 and Task 3**
- **Found during:** Task 2 verification
- **Issue:** The plan's Task 1 adds `aggregates` to `RETENTION_DAYS`. `retention.test.ts`'s pre-existing keep-forever guard (narrowed only in Task 3) asserts `aggregates` is absent from `RETENTION_DAYS`, so it fails from the moment Task 1 lands until Task 3 narrows it — including during Task 2's window. Task 2's own `<acceptance_criteria>` correctly scopes its required check to `retentionCursor.test.ts` + `tsc` only (not `retention.test.ts`), so this is a `<verify>`-block/`<acceptance_criteria>`-block inconsistency in the plan, not a defect in the implementation.
- **Resolution:** Ran the acceptance-criteria-scoped command (`retentionCursor.test.ts` + `tsc`) for Task 2's gate, confirmed the `retention.test.ts` failure was exactly the expected pre-existing guard (`still keeps the cost/trend tables forever`, `aggregates` no longer excluded), and confirmed it turned green after Task 3's narrowing. No production code was changed to work around this — it is purely a sequencing artifact between two tasks that both touch the same test file.
- **Files modified:** none (documentation-only observation)
- **Verification:** `npx vitest run convex/retentionCursor.test.ts convex/retention.test.ts` after Task 2 showed exactly 1 failure (the known pre-existing guard, 33/34 passing); the same command after Task 3 showed 36/36 passing.
- **Committed in:** n/a (no code change; noted here for traceability)

---

**Total deviations:** 2 (1 orchestrator-directed plan-defect resolution, 1 documentation-only sequencing note)
**Impact on plan:** No scope creep. The listRetentionPolicy form (internalQuery) matches the threat register's stated default; nothing was downgraded to public. The Task 2/retention.test.ts sequencing note required no code change.

## Mutation Checks (Task 3, required — verbatim)

### Check 1 — `PRUNE_PREDICATES.aggregates` mutated to delete daily rows

Mutated `convex/retention.ts`:
```ts
// MUTATED (temporary):
export const PRUNE_PREDICATES: Partial<Record<string, (doc: any) => boolean>> = {
  aggregates: () => true, // MUTATION TEST — will revert immediately
};
```

**RED — `npx vitest run convex/retention.test.ts` under the mutation:**
```
 RUN  v4.1.9 C:/Users/mandr/codepulse

 ❯ convex/retention.test.ts (9 tests | 1 failed) 8ms
     × the aggregates predicate can never delete a period:daily row (D-01/D-03/D-04) 3ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  convex/retention.test.ts > RETENTION_DAYS > the aggregates predicate can never delete a period:daily row (D-01/D-03/D-04)
AssertionError: expected true to be false // Object.is equality

- Expected
+ Received

- false
+ true

 ❯ convex/retention.test.ts:115:63
    113|     expect(RETENTION_DAYS.aggregates).toBe(90);
    114|     expect(PRUNE_PREDICATES.aggregates).toBeDefined();
    115|     expect(PRUNE_PREDICATES.aggregates!({ period: "daily" })).toBe(false);
       |                                                               ^
    116|     expect(PRUNE_PREDICATES.aggregates!({ period: "hourly" })).toBe(true);

 Test Files  1 failed (1)
      Tests  1 failed | 8 passed (9)
```

Reverted to `aggregates: (doc) => doc.period !== "daily"`.

**GREEN — `npx vitest run convex/retention.test.ts` after revert:**
```
 RUN  v4.1.9 C:/Users/mandr/codepulse

 Test Files  1 passed (1)
      Tests  9 passed (9)
```
`git diff HEAD -- convex/retention.ts` after the revert was empty — confirmed no residue of the mutation remained.

### Check 2 — bogus key added to `PRUNE_PREDICATES`

Mutated `convex/retention.ts`:
```ts
// MUTATED (temporary):
export const PRUNE_PREDICATES: Partial<Record<string, (doc: any) => boolean>> = {
  aggregates: (doc) => doc.period !== "daily",
  notATable: () => true, // MUTATION TEST — will revert immediately
};
```

**RED — `npx vitest run convex/retention.test.ts` under the mutation:**
```
 RUN  v4.1.9 C:/Users/mandr/codepulse

 ❯ convex/retention.test.ts (9 tests | 1 failed) 8ms
     × every PRUNE_PREDICATES key is a real, pruned table (silent-no-op guard) 3ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  convex/retention.test.ts > RETENTION_DAYS > every PRUNE_PREDICATES key is a real, pruned table (silent-no-op guard)
AssertionError: notATable must be a real schema table: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ convex/retention.test.ts:131:75
    129|     // table-existence guard above was written to catch.
    130|     for (const key of Object.keys(PRUNE_PREDICATES)) {
    131|       expect(schemaTables.has(key), `${key} must be a real schema table`).toBe(true);

 Test Files  1 failed (1)
      Tests  1 failed | 8 passed (9)
```

Reverted to the two-line map (aggregates only).

**GREEN — `npx vitest run convex/retention.test.ts` after revert:**
```
 RUN  v4.1.9 C:/Users/mandr/codepulse

 Test Files  1 passed (1)
      Tests  9 passed (9)
```
`git diff HEAD -- convex/retention.ts` after the revert was empty.

## Post-Edit Comment Sweep (verbatim, Task 3)

`grep -rn "kept forever\|keep-forever\|keepForever\|immutable historical" convex/ src/ --include=*.ts --include=*.tsx`:

```
convex/aggregates.ts:744: * comment marks "kept forever" (it is not in that module's PRUNED_TABLES — only
convex/costBudgetEval.test.ts:815:    // `alerts` is excluded from retention.ts's RETENTION_DAYS ("kept forever"),
convex/costBudgetEval.ts:281:      // `alerts` is in retention.ts's "kept forever" set, so an unbounded
convex/dataRetention.ts:7:// The durable "aggregates" daily rollups are immutable historical buckets kept
convex/retention.test.ts:59:  // window is positive, gatewayQuotaSnapshots specifically, a narrowed keep-forever list —
convex/retention.test.ts:102:    for (const keepForever of ["llmMetrics", "sessions", "alerts"]) {
convex/retention.test.ts:105:        `${keepForever} must NOT be pruned`
convex/retention.test.ts:106:      ).not.toContain(keepForever);
convex/retention.ts:20:// rows are kept forever, protected by PRUNE_PREDICATES (below) rather than
convex/retention.ts:22:// and config/audit tables are kept forever outright — trend dashboards keep
```

Every remaining hit is accurate: `costBudgetEval.ts`/`.test.ts` are about `alerts` (unmodified, still kept forever, per plan instruction to leave unmodified). `retention.test.ts` and `retention.ts`'s own hits are the narrowed guard/loop variable and the corrected header comment, both scoped to `llmMetrics`/`sessions`/`alerts`/`aggregates`-daily-rows specifically, never to `aggregates` as a whole. `aggregates.ts:744` is the (correct, unmodified) `llmMetrics` claim; its corrected parenthetical about `aggregates` sits on the following lines (745–748), outside this grep's single-line match window. `dataRetention.ts:7` is the corrected version, now scoped to daily rollups only, with hourly's new 90-day prune stated on the next line. No hit asserts `aggregates` is kept forever or immutable as a whole.

## Concurrent-Session Isolation

Per the orchestrator's warning, every `git add` in this plan named explicit file paths only (`convex/retention.ts`; then `convex/aggregates.ts convex/dataRetention.ts convex/retention.test.ts`) — never `-A`, `.`, or `-a`. `git show --stat HEAD` was read after each of the 3 commits and confirmed exactly the intended files, nothing foreign swept in. No `git stash`, `checkout -- <file>`, `reset --hard`, or `commit --amend` was used at any point. `git diff HEAD -- convex/costBudgetEval.ts` was confirmed empty after the final commit.

## Verification

- `npx tsc --noEmit` — exits 0 (run after each task's edits).
- `npx vitest run convex/retentionCursor.test.ts` — 27/27 pass throughout (Task 1, Task 2, Task 3).
- `npx vitest run convex/retention.test.ts convex/retentionCursor.test.ts` (final) — 36/36 pass.
- `npx vitest run` (full suite) — 293 files passed, 17 skipped; 3894 tests passed, 193 todo. (jsdom "HTMLCanvasElement getContext not implemented" console warnings are pre-existing test-setup noise, not failures.)
- `git diff HEAD -- package.json package-lock.json` — empty. No packages installed.
- `git diff HEAD -- convex/crons.ts` — empty. Cron entry and schedule unchanged.
- `git diff HEAD -- convex/analyticsRollup.ts` — empty. Second `aggregates` writer documented, not modified.
- `git diff HEAD -- convex/costBudgetEval.ts convex/costBudgetEval.test.ts` — empty.
- `grep -c "BATCH_SIZE = 200\|RESCHEDULE_DELAY_MS = 3000\|MAX_BATCHES_PER_NIGHT = 600" convex/retention.ts` → `3`. Batch-capping constants untouched.
- No `npx convex run`/`deploy`/`import`/`env` command was executed at any point in this session — confirmed by review of every Bash call made.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None — no external service configuration required. This plan is code-only; nothing was deployed.

## Next Phase Readiness

- Plan 110-04 can proceed: `listRetentionPolicy` exists as `internalQuery` in the committed source, ready for its Task 1/Task 3 pre-deploy/post-deploy probes and the internalQuery-vs-query recording this plan deferred.
- Plan 110-05's DUR-01 live before/after daily-row count check has real code to verify against: `PRUNE_PREDICATES.aggregates` is mutation-tested in the unit suite, but the live proof that a nightly run actually preserves daily rows on the production instance still needs the deploy (110-04) plus a real prune cycle (110-05).
- No blockers identified for the next wave.

## Self-Check

- `convex/retention.ts` exists: FOUND
- `convex/retention.test.ts` exists: FOUND
- `convex/aggregates.ts` exists: FOUND
- `convex/dataRetention.ts` exists: FOUND
- `.planning/phases/110-convex-durability/110-03-SUMMARY.md` exists: FOUND
- Commit `fd896605` (Task 1) exists: FOUND
- Commit `ae6fe7b7` (Task 2) exists: FOUND
- Commit `4dde5dd9` (Task 3) exists: FOUND
- `git diff HEAD -- .planning/STATE.md .planning/ROADMAP.md` empty: CONFIRMED (neither file touched by this plan)

## Self-Check: PASSED

---
*Phase: 110-convex-durability*
*Completed: 2026-08-10*
