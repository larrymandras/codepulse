---
phase: 107-aggregates-rollup-sharding
plan: 03
subsystem: backend
tags: [convex, occ, aggregates, sharding, write-path]

# Dependency graph
requires:
  - "107-01: write-path shard contract (analyticsRollup.test.ts shard block, events.test.ts) — turned GREEN by this plan"
  - "107-02: read-path multi-shard regression guards (analytics.test.ts, aggregates.test.ts) — proven to STAY green, unmodified"
provides:
  - "convex/lib/aggregateShard.ts: AGGREGATE_SHARD_COUNT=8, pickShard() — the single source of shard cardinality"
  - "Sharded write path: incrementEventBucket/incrementSankeyEdge/incrementSankeyBuckets/incrementBatch all shard-aware; events.ingest draws one shard per call"
  - "aggregates.shard: v.optional(v.float64()) — additive schema field, both indexes unchanged"
affects: [107-04, 107-05, 107-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Strict-equality shard match (r.shard === shard, never (r.shard ?? 0) === shard) — a legacy row with no shard field is retired, not patched, by any sharded write, per D-04"
    - "One pickShard() draw per logical write, shared explicitly across sibling helper calls — never drawn inside a shared helper (would make sibling calls independently random)"

key-files:
  created:
    - convex/lib/aggregateShard.ts
  modified:
    - convex/schema.ts
    - convex/analyticsRollup.ts
    - convex/events.ts

key-decisions:
  - "Found and fixed a 4th write call site the plan's own text flagged as 'unnamed in no planning document': convex/analyticsRollup.ts's incrementBatch internalMutation. It now draws one pickShard() per event in its loop and shares that draw across that event's two helper calls — mirrors events.ingest's one-draw-per-event rule exactly, per the plan's own Task 2 action item 5."
  - "Reworded three doc comments after they tripped their own acceptance-criteria greps (comment text literally contained 'r.shard === shard', 'r.shard ?? 0', and 'pickShard' where the grep expected an exact count) — same comment-trips-own-grep class this repo's Phase 105 plans hit independently five separate times (see STATE.md). Reworded to describe the behavior without repeating the literal code pattern; re-verified all five grep counts after the fix."

requirements-completed: []

# Metrics
duration: ~18min
completed: 2026-08-05
---

# Phase 107 Plan 03: Aggregates Rollup Sharding — Sharded Write Path Summary

**The sharded write path ships: `convex/lib/aggregateShard.ts` (new), an additive optional `shard` field on `aggregates`, and all four production write call sites (including one the plan itself flagged as undocumented) now draw and forward an explicit shard with strict-equality matching — turning all 8 wave-1 RED tests GREEN while the 7 wave-1 read-path guards stay green untouched.**

## Note on the mid-execution API interruption

This plan's execution was interrupted once by a transient API 529 partway through Task 1 (schema.ts edit + aggregateShard.ts creation had already landed on disk, uncommitted). The coordinator relayed a resume message with independently-verified ground truth of the uncommitted state. Per that message's instruction, Task 1 was re-verified against its own acceptance criteria (not redone from scratch) before committing, then execution continued through Tasks 2 and 3 normally. No work was lost or duplicated.

## Performance

- **Duration:** ~18 min (across the resume)
- **Completed:** 2026-08-05
- **Tasks:** 3 completed
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- **Task 1** — `convex/lib/aggregateShard.ts` created, matching the header-comment voice of `convex/lib/providers.ts`/`convex/lib/sankeyClassify.ts`: exports exactly `AGGREGATE_SHARD_COUNT` (=8) and `pickShard(): number`, with a comment explaining why the draw must happen once per logical write and never inside a shared helper. `convex/schema.ts`'s `aggregates` table gained `shard: v.optional(v.float64())` as the last field before the two existing `.index(...)` calls — both indexes verified byte-identical via `git diff -U0 | grep index(` returning 0 matches.
- **Task 2** — `convex/analyticsRollup.ts`: `incrementEventBucket` and `incrementSankeyEdge` both gained a required `shard: number` parameter, added to the existing JS-side `.find()` predicate with **strict equality** (`r.shard === shard`), and to the insert payload. `incrementSankeyBuckets` gained a `shard` parameter forwarded unchanged to both `incrementSankeyEdge` calls — it draws no shard of its own. `incrementBatch` (the 4th call site) now draws `pickShard()` once per event inside its loop and shares that single draw across the event's `incrementEventBucket` + `incrementSankeyBuckets` calls. `insertBucketsBatch`, `backfillHistorical`, `clearHistoricalBucketsPage`, `accumulateEvent`, `accumulateLlmTokens`, and the whole `tokens`-family backfill were left untouched — confirmed by `sed -n '259,290p' | grep shard` returning 0 and the file's NUL-byte accumulator-key separators (used at lines ~179/192/218 for collision-proof map keys) verified unchanged (3 bytes before and after, byte-identical count).
- **Task 3** — `convex/events.ts`'s `ingest` mutation now draws `pickShard()` exactly once, positioned after the idempotency early-return and the `ctx.db.insert("events", ...)` call, before the two increment calls — both `incrementEventBucket` and `incrementSankeyBuckets` receive the same `shard` identifier as their final argument. The dedup block (`idempotencyKey` check) is byte-unchanged (`git diff -U0 | grep idempotencyKey` returns 0 lines).

## Defect-Class Sweep (write call sites)

Pattern: any call site of `incrementEventBucket` / `incrementSankeyBuckets` / `incrementSankeyEdge` in the whole repo needed a shard threaded through, not just the ones the plan's interface section named. Full-repo grep (`convex/`, `src/`) for all three function names, before declaring Task 2 complete:

- `incrementEventBucket(` — production call sites: `convex/analyticsRollup.ts:162` (`incrementBatch`, updated), `convex/events.ts:45`→now line 52 (`ingest`, updated in Task 3). Test call sites (`convex/analyticsRollup.test.ts`, 9 lines) were pre-updated by plan 107-01 and correctly left untouched per this plan's own instruction.
- `incrementSankeyBuckets(` — production call sites: `convex/analyticsRollup.ts:163` (`incrementBatch`, updated), `convex/events.ts:46`→now line 53 (`ingest`, updated in Task 3). Test call sites (`convex/analyticsRollup.test.ts`, 3 lines) pre-updated by 107-01, untouched.
- `incrementSankeyEdge(` — only ever called internally from `incrementSankeyBuckets` (`convex/analyticsRollup.ts:87-88`, both updated) plus its own declaration; it is a private (non-exported) function, so no external call sites exist by construction.

Result: exactly the 4 production call sites named in the plan's own "FOUR call sites" interface note were found, and all 4 are now shard-aware. No 5th call site exists in `src/` (Convex functions are backend-only; the frontend never calls these).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create convex/lib/aggregateShard.ts and add the optional schema field** — `8369a650` (feat)
2. **Task 2: Thread shard through the analyticsRollup write path** — `b0938716` (feat)
3. **Task 3: Draw the shard once per events.ingest call** — `7c14a18e` (feat)

_Commits `bd9fc71e`, `bd2e1694`, `c5745559` also appear in `git log` between/around these three — those are from the other actively-committing session in this shared checkout (Phase 106 plan work), confirmed by `git show --stat` on each of my own three commits showing only the intended file(s)._

## Files Created/Modified

- `convex/lib/aggregateShard.ts` (new) — `AGGREGATE_SHARD_COUNT = 8`, `pickShard(): number`
- `convex/schema.ts` — `aggregates.shard: v.optional(v.float64())` added, additive only, both `.index(...)` lines unchanged
- `convex/analyticsRollup.ts` — `incrementEventBucket`/`incrementSankeyEdge`/`incrementSankeyBuckets`/`incrementBatch` all shard-aware; `insertBucketsBatch`/backfill paths untouched; NUL-byte accumulator keys preserved (byte count unchanged)
- `convex/events.ts` — `ingest` draws one shard, forwards it explicitly to both increment calls; dedup block untouched

## Decisions Made

- Followed the plan's `<action>` steps verbatim for the three named tasks, including its explicit call-out of `incrementBatch` as a "fourth caller no planning document named" — implemented exactly as directed (one `pickShard()` per event inside the batch loop).
- Fixed 3 comment-trips-own-grep collisions before committing Task 2 (see Deviations below) — same defect class this repo's Phase 105 plans (105-01 through 105-05) each independently hit and fixed; applying the established fix pattern (reword the comment to describe behavior without repeating the exact literal string a later grep checks for) rather than loosening any acceptance criterion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, comment-trips-own-grep] Task 2 doc comments collided with their own acceptance-criteria greps**
- **Found during:** Task 2, immediately after writing `incrementEventBucket`'s header comment and `incrementSankeyBuckets`'s header comment
- **Issue:** The `incrementEventBucket` header comment literally contained the strings `r.shard === shard` and `r.shard ?? 0` (to explain the strict-vs-defaulted distinction in prose), inflating `grep -ac 'r.shard === shard'` from the required 2 to 3, and `grep -ac 'r.shard ?? 0'` from the required 0 to 1. Separately, `incrementSankeyBuckets`'s header comment said "this function does NOT call pickShard() itself," which itself contains the literal substring `pickShard`, inflating `grep -ac 'pickShard'` from the required 2 to 3.
- **Fix:** Reworded both comments to describe the same behavior without reproducing the exact code-pattern literal: the strict-match explanation now says "a stored shard of undefined does NOT match a caller-supplied shard, unlike a nullish-coalescing default would" (no literal `r.shard ?? 0`); the no-own-draw note now says "this function draws no shard of its own" (no literal `pickShard`).
- **Files modified:** `convex/analyticsRollup.ts` (comments only, no logic change)
- **Commit:** `b0938716` (folded into Task 2's commit, verified before committing — not a separate commit since Task 2 was not yet committed when this was caught)

No other deviations — the plan's task boundaries, file scope, and interface contracts were followed exactly as written.

## Issues Encountered

- **Mid-execution API interruption (transient 529, not a defect):** see the dedicated note above. Recovered per the coordinator's relayed ground truth; no rework, no duplication.
- No test failures, no debugging required for correctness — all 8 wave-1 RED tests went GREEN on the first run after Task 3 landed, and all 7 wave-1 read-path guards stayed green throughout (unmodified files).

## Live Evidence Disclaimer (D-05 / T-107-02, inherited from 107-01/107-02)

**This plan ships code only. Nothing was deployed.** No `npx convex deploy`, no `convex import`, no bulk patch/delete was run — verified by `git status` showing no `.convex/` deployment artifacts changed and by never invoking any deploy command during this session. The live self-hosted instance still runs pre-107-03 code. Green tests here prove the sharded write/read contract is correct in isolation; they are **not** evidence that OCC contention will drop in production.

**Plan 107-04's pre-deploy baseline capture must run BEFORE plan 107-05 deploys this code.** Per `107-VALIDATION.md`'s corrected method, the live before/after OCC-retry rate comparison requires a baseline window captured while the OLD (unsharded) code is still live — that evidence is unrecoverable once this code deploys and the log window moves past the pre-deploy state. `.planning/phases/107-aggregates-rollup-sharding/107-OCC-BASELINE.md` correctly does not exist yet.

## Verification (all directly executed, not assumed)

- `npx tsc --noEmit` — exits 0 (final state, after all 3 tasks).
- `npx vitest run convex/analyticsRollup.test.ts convex/events.test.ts convex/analytics.test.ts convex/aggregates.test.ts` — 88/88 passing, including all 6 wave-1 shard tests in `analyticsRollup.test.ts`, both wave-1 shard tests in `events.test.ts`, and all 7 wave-1 read-path guards in `analytics.test.ts`/`aggregates.test.ts`.
- `npm test` (full suite) — 276 test files passed, 17 skipped; 3446 tests passed, 193 todo; 0 failures.
- `git diff` across this plan's 3 commits (`8369a650~1..7c14a18e`, scoped to `convex/`) touches exactly 4 paths: `convex/lib/aggregateShard.ts`, `convex/schema.ts`, `convex/analyticsRollup.ts`, `convex/events.ts` — no read-path file appears.
- `grep -rac 'sumAcrossShards' convex/` — 0 matches anywhere; the struck no-op helper was not built.
- `git diff -U0 convex/schema.ts | grep -E '^[-+]' | grep -c 'index('` — 0; both indexes on `aggregates` byte-identical.
- NUL-byte count in `convex/analyticsRollup.ts` (the file's intentional collision-proof accumulator-key separators) — 3 before this plan's changes, 3 after; none lost or altered.
- Every commit individually confirmed via `git show --stat HEAD` to touch only its own intended file(s), with `git branch --show-current` == `master` asserted immediately before each `git add`/commit.

## Requirement Status (OCC-01 NOT marked complete)

`OCC-01` (`.planning/REQUIREMENTS.md:40`) is this plan's frontmatter requirement, but its own text
requires verification "by a live before/after OCC-retry count from `docker logs convex-backend`" —
exactly the D-05 live evidence this plan explicitly does not produce (see Live Evidence Disclaimer
above). Marking OCC-01 complete now would be a false claim of the requirement's own success
criterion, matching this project's established "green suite != live-verified" convention (see e.g.
Phase 105's OBS-01/OBS-02 handling in STATE.md). `requirements.mark-complete` was deliberately
**not** run for this plan. OCC-01 should be marked complete only after plan 107-06's post-deploy
rate comparison confirms the drop, per `107-VALIDATION.md`'s live-01/live-02 verification rows.

## Next Phase Readiness

- The sharded write path is code-complete and fully test-covered. Plan 107-04 is unblocked to capture the pre-deploy OCC baseline (must run before any deploy, per the Live Evidence Disclaimer above).
- Plan 107-05 (deploy) must not run until 107-04's baseline exists.
- No blockers.

## Self-Check: PASSED

- FOUND: convex/lib/aggregateShard.ts
- FOUND: convex/schema.ts (modified, shard field present)
- FOUND: convex/analyticsRollup.ts (modified, shard-aware)
- FOUND: convex/events.ts (modified, one draw per ingest)
- FOUND: 8369a650
- FOUND: b0938716
- FOUND: 7c14a18e
- FOUND: .planning/phases/107-aggregates-rollup-sharding/107-03-SUMMARY.md

---
*Phase: 107-aggregates-rollup-sharding*
*Completed: 2026-08-05*
