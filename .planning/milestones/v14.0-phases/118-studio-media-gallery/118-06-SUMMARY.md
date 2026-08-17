---
phase: 118-studio-media-gallery
plan: 06
subsystem: api
tags: [convex, internal-mutation, cron, batch-delete, trash-janitor]

# Dependency graph
requires:
  - phase: 118-studio-media-gallery (plan 05)
    provides: convex/media.ts's schema-aligned MediaCtx type, the by_deletedAt index, and the ingest/star/softDelete/restore surface this janitor's blob-before-row ordering complements
provides:
  - pruneTrashBatch — D-08's 30-day permanent-delete internalMutation (batch-capped, cursor-seeked, self-rescheduling)
  - studio-trash-prune nightly cron registration (07:00 UTC)
  - the host-side orphan-reconciliation contract comment plan 118-08's watcher must implement
affects: [118-08 (watcher — host-side trash\ orphan-file reconciliation), 118-15 (first real rows to exercise the janitor live)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "cursor-seeked withIndex range read + ctx.scheduler.runAfter self-rescheduling (convex/retention.ts's pruneBatchV3 shape), never .collect()"
    - "blob-before-row delete ordering, wrapped in try/catch so a missing blob cannot wedge the sweep (forge.ts's proven ordering, without forge.ts's unbounded collect anti-pattern)"
    - "entry-guard cap check (skip all work once a chain has used its ceiling) mirroring retention.ts's pruneBatchV3 entry check"

key-files:
  created: []
  modified:
    - convex/media.ts
    - convex/media.test.ts
    - convex/crons.ts

key-decisions:
  - "Reworded two explanatory comments to avoid the literal substring '.collect()' (used 'unbounded whole-table collect/read' instead) — the plan's own Task 1 action text instructed writing that exact literal into a comment ('no `.collect()`...'), while its own acceptance criterion required a source grep for that literal to return 0. Both cannot hold simultaneously; kept the explanatory intent, changed the literal so the check measures real code, not documentation."
  - "Registered the cron at 07:00 UTC, not 02:00 as first drafted — 02:00 is claimed by the DISABLED (commented-out) archive-stale-events entry; picking it anyway would silently collide the moment that entry is ever re-enabled. 07:00 has zero references, active or commented, anywhere in crons.ts."
  - "Corrected the grace-period test's own 'new' row age from 1 day to 5 days after the first mutation-proof attempt failed to discriminate: at exactly 1 day old, a mutated 1-day TRASH_GRACE_MS puts the row's deletedAt exactly ON the cutoff boundary (`.lt` excludes it either way), so the test passed identically under both the correct and the broken constant. 5 days old survives the real 30-day grace but is swept by a wrongly-shortened 1-day grace — verified this actually flips (RED) before trusting the proof."
  - "No cron-listing CLI subcommand exists in the installed convex CLI (2.28-ish) — enumerated via `npx convex --help`; none of dev/deploy/run/import/dashboard/docs/logs/export/env/data/deployment/project/codegen/update/logout/function-spec/insights/mcp/ai-files lists scheduled cron jobs. `npx convex data _cron_jobs` was tried and found UNINFORMATIVE: it returns the identical 'There are no documents in this table.' at exit 0 for `_cron_jobs` AND for a deliberately bogus table name (`definitely_not_a_real_table_9x7q2`) — proven with a live control probe, matching the exact known defect class the plan's critical_plan_caveat warned about (118-03 Task 3's identical trap). `npx convex insights` is cloud-only ('This command is only available for Convex cloud deployments'). Per the plan's own sanctioned fallback ('if no cron-listing subcommand exists, say so ... verify by reading the deployed convex/crons.ts source through the deployment instead'), verification instead rests on: (a) `git status --porcelain` was empty immediately before deploy, so the deployed working tree is byte-identical to the committed crons.ts containing both `studio-trash-prune` and the pre-existing `retention-prune` control in the same file; (b) the deploy's own build step ('Uploading functions to Convex...', 'Running TypeScript...', 'Schema validation complete') validates cron registrations and function references at deploy time — Convex's `cronJobs()` API throws on a duplicate cron name during module evaluation, and TypeScript would fail to compile a reference to a non-existent `internal.media.pruneTrashBatch` — so the SAME successful deploy that shipped the pre-existing `retention-prune` cron also validated the new one, in the same file, in the same pass."

requirements-completed: [D-08]

# Metrics
duration: ~65min
completed: 2026-08-14
---

# Phase 118 Plan 06: Studio 30-Day Trash Janitor Summary

**`pruneTrashBatch` — a batch-capped, cursor-seeked, self-rescheduling `internalMutation` that deletes each trashed media row's thumbnail blob before the row, registered on a collision-free nightly cron, deployed live, with both mandated mutation proofs run and reverted clean.**

## Performance

- **Duration:** ~65 min
- **Tasks:** 3 (all executed)
- **Files modified:** 3 (`convex/media.ts`, `convex/media.test.ts`, `convex/crons.ts`) — no new files

## Accomplishments

- `pruneTrashBatch` (`convex/media.ts`) sweeps `media` rows soft-deleted more than 30 days ago (`TRASH_GRACE_MS`, shared with `listTrashHandler`'s `daysUntilPurge` — one source of truth for the grace period), via a cursor-seeked `by_deletedAt` range read (`.gte(cursorMs).lt(cutoffMs)`), `.take(TRASH_PRUNE_BATCH_SIZE)` at 200, never `.collect()`.
- Read-budget arithmetic against the CORRECT ~4,096-read ceiling (not the 16,000-write ceiling this repo's own older comments and the Convex docs page name) is spelled out in a comment: 200 (the `.take()`) + up to 200 more (each `ctx.db.delete()` counts as a read) = ~400 reads/invocation, >10x headroom.
- Blob deleted before row (`convex/media.ts:692` then `:700`), wrapped in try/catch so a blob that's already gone cannot wedge the janitor — the row still gets deleted, and the exception is logged, not swallowed.
- Self-reschedules via `ctx.scheduler.runAfter(TRASH_PRUNE_RESCHEDULE_MS, internal.media.pruneTrashBatch, { cursorMs, batchesDone })`, bounded by `TRASH_PRUNE_MAX_BATCHES` (100) per invocation chain via an entry guard that skips ALL work once the ceiling is already reached.
- `internalMutation` only — no UI control anywhere in this phase exposes permanent delete.
- Nightly cron registered at 07:00 UTC in `convex/crons.ts`, a genuinely unused hour (checked against every active AND commented-out entry).
- 9 new tests added to `convex/media.test.ts` (24 → 33), both mandated mutation proofs run live and reverted clean.
- Deployed to the live self-hosted backend (`http://127.0.0.1:3210`) — `git status --porcelain` empty before deploy, "No indexes are deleted by this push" positive confirmation, `npx tsc --noEmit` clean, full `npm test`: **4478 passed | 197 todo** (327 files, 17 skipped) — up from the 118-05 baseline of **4469 passed** (326 files, 198 todo).

## Task Commits

1. **Task 1: `pruneTrashBatch` — batch-capped, cursor-seeked, blob before row** — `59506f41` (feat)
2. **Task 2: Cron registration and janitor tests** — `94cd76b9` (feat)
3. **Task 3: Deploy the janitor and verify it is scheduled but has nothing to do** — no code commit (deploy + live verification only; matches 118-05 Task 3's precedent — nothing in `files_modified` changed on disk beyond what Tasks 1–2 already committed)

**Plan metadata:** (this commit, immediately following)

## Files Created/Modified

- `convex/media.ts` — adds `JanitorCtx` type, `TRASH_PRUNE_BATCH_SIZE` (200), `TRASH_PRUNE_MAX_BATCHES` (100), `TRASH_PRUNE_RESCHEDULE_MS` (3000, unexported), `pruneTrashBatchHandler`, `pruneTrashBatch` (internalMutation). Reuses the pre-existing `TRASH_GRACE_MS` constant (already declared for `listTrashHandler`'s `daysUntilPurge`) rather than redeclaring it. Updates the top-of-file docstring, which previously said the janitor "lands in plan 118-06" (now here) and was stale the moment this plan started.
- `convex/media.test.ts` — adds `pruneTrashBatchHandler`/`TRASH_PRUNE_BATCH_SIZE`/`TRASH_PRUNE_MAX_BATCHES` imports and a `makeJanitorMockCtx` helper that ACTUALLY APPLIES the `q.gte`/`q.lt` bounds the handler passes into `withIndex`, filtering a supplied row array the same way the real index would — deliberately more faithful than a mock that just hands back a fixed array, because the grace-period mutation proof can only turn RED if the mock genuinely threads `TRASH_GRACE_MS` through to a real filter. 6 new `describe` blocks, 9 new tests total.
- `convex/crons.ts` — registers `crons.daily("studio-trash-prune", { hourUTC: 7, minuteUTC: 0 }, internal.media.pruneTrashBatch, {})` with a comment naming D-08, the 30-day grace, the batch cap, and D-03's retention exemption.

## Cron Hours (collision check)

All `crons.daily` entries in `convex/crons.ts`, active and commented-out, checked before choosing 07:00:

| Hour:Minute UTC | Cron | Status |
|---|---|---|
| 01:00 | aggregate-daily | active |
| 02:00 | archive-stale-events | **disabled/commented** |
| 03:00 | evaluate-memory-quality | active |
| 03:30 | sweep-forge-log-chunks | active |
| 04:00 | sweep-forge-file-records | active |
| 04:30 | sweep-graph-snapshot-versions | **disabled/commented** |
| 05:00 | judge-sampled-sessions | active |
| 06:00 | generate-daily-digest | active |
| 06:05 | send-email-digest | active |
| **07:00** | **studio-trash-prune (this plan)** | **new** |
| 09:00 | retention-prune | active |

07:00 collides with nothing, active or disabled — the first drafted choice (02:00) was rejected specifically because it collides with a currently-disabled entry that could be re-enabled later.

## Mutation Proofs

**Proof 1 — blob/row delete order swapped (`convex/media.ts`, temporarily reordered `ctx.db.delete` before `ctx.storage.delete`):**
```
AssertionError: expected 1 to be less than 0
 ❯ convex/media.test.ts:587:24
    585|     expect(storageIdx).toBeGreaterThanOrEqual(0);
    586|     expect(dbIdx).toBeGreaterThanOrEqual(0);
    587|     expect(storageIdx).toBeLessThan(dbIdx);
```
Reverted; `git diff convex/media.ts` empty (byte-identical to HEAD); re-ran → 33/33 passed.

**Proof 2 — `TRASH_GRACE_MS` shortened from 30 to 1 day.** First attempt with the grace-period test's original "new" row at 1 day old did NOT go red — that age sits exactly on a 1-day cutoff's boundary (`deletedAt === cutoffMs`, excluded by `.lt` under both the correct and the broken constant), so the test was not actually exercising the mutation. Corrected the test to use a 5-day-old "new" row (survives the real 30-day grace; gets swept by a wrongly-shortened 1-day grace) and re-ran the mutation:
```
AssertionError: expected 2 to be 1 // Object.is equality
 ❯ convex/media.test.ts:608:33
    606|     const result = await pruneTrashBatchHandler(ctx, {}, nowMs);
    607|
    608|     expect(result.deletedCount).toBe(1);
```
Reverted; `git diff convex/media.ts` empty (byte-identical to HEAD); re-ran → 33/33 passed. The corrected test (5-day age, with the reasoning documented inline) is what's committed — the 1-day version that failed to discriminate never reached a commit.

## Cron-Listing Verification (control-paired, with an honest gap)

No CLI subcommand for listing scheduled cron jobs exists in the installed `convex` CLI — enumerated the full command list via `npx convex --help` (dev/deploy/run/import/dashboard/docs/logs/export/env/data/deployment/project/codegen/update/logout/function-spec/insights/mcp/ai-files); none lists crons.

Tried `npx convex data _cron_jobs` as a candidate system-table read. Result: `There are no documents in this table.` at exit 0. Ran the mandated control — the identical command against a deliberately bogus table name:
```
$ npx convex data definitely_not_a_real_table_9x7q2 --limit 5
There are no documents in this table.
```
Byte-identical output. This is the exact known defect class the plan's `critical_plan_caveat` named (118-03 Task 3's `npx convex data <table>` false-positive-at-exit-0 trap) — the probe carries zero information and is not used as evidence.

`npx convex insights` was checked and is cloud-only ("This command is only available for Convex cloud deployments when logged in as a user") — not usable against this self-hosted backend.

Per the plan's own sanctioned fallback, verification rests on two facts instead of a live listing:
1. `git status --porcelain` was empty immediately before the deploy (see Task 3 below) — the deployed working tree is byte-identical to the committed `convex/crons.ts`, which contains both `studio-trash-prune` and the pre-existing `retention-prune` control cron.
2. The deploy's build step ("Uploading functions to Convex...", "Running TypeScript...", "Schema validation complete") succeeded end-to-end. Convex's `cronJobs()` API throws at module-evaluation time on a duplicate cron name, and TypeScript would fail to compile a reference to a non-existent `internal.media.pruneTrashBatch` — both crons live in the same `crons.ts` module and were validated by the same successful pass that also re-validated `retention-prune`.

**Honest limit:** this does not show a live "N cron jobs scheduled, next run at X" listing the way the plan's ideal control-pair would. It is deploy-time validation evidence, not runtime-scheduling evidence. The first genuine runtime confirmation (a log line or a `cronExecutions`-table row for `studio-trash-prune`) will not exist until 07:00 UTC tonight or later — outside this plan's scope to wait for.

## Deploy

```
npx convex deploy --env-file C:/Users/mandr/convex-selfhost/selfhosted.envfile -y
```
Pre-deploy `git status --porcelain`: **empty** (nothing dirty, in or out of this plan's files — both prior tasks were already committed).
Output: `✔ No indexes are deleted by this push` (positive confirmation), then `✔ Deployed Convex functions to http://127.0.0.1:3210`. No `Deleted table indexes:` line anywhere in the output.
No manual invocation of `pruneTrashBatch` occurred against the live instance — `media` holds zero rows at this wave (greenfield, D-13), so a live run would prove nothing and every mass-mutation risk it carries was avoided for zero evidence gained. The behavioural proof is the 33-test unit suite above; the first live proof arrives naturally in plan `118-15` once real rows exist.
`npx tsc --noEmit` exits 0. Full `npm test`: **4478 passed | 197 todo** (327 files, 17 skipped) — up from the 118-05 baseline of **4469 passed** (326 files, 198 todo).

## Decisions Made

- Reworded two comments to avoid the literal `.collect()` substring (see key-decisions above) — a genuine plan-text contradiction between "write this literal into a comment" and "grep for this literal must be zero," resolved in favor of a real, meaningful check.
- Registered the cron at 07:00 UTC rather than the first-drafted 02:00, after checking commented-out (disabled) entries as well as active ones.
- Corrected the grace-period mutation-proof test's fixture age (1 day → 5 days) after the first attempt failed to discriminate the mutation — documented in the test itself so a future editor doesn't "simplify" it back to 1 day.
- Declared `_cron_jobs`/`npx convex insights` non-viable verification methods (with live evidence) rather than reporting a false positive from an uninformative probe.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Task 1's own acceptance criterion contradicted its own action text**
- **Found during:** Task 1, writing the anti-pattern comments the action explicitly mandated.
- **Issue:** The action text required writing `.collect()` literally into an explanatory "must NOT do" comment; the acceptance criterion required `grep -c "\.collect()" convex/media.ts` to return 0. Both cannot hold at once — my first draft correctly followed the action text and then failed its own acceptance grep (returned 2, both from comments, zero from code).
- **Fix:** Reworded both comments to convey the identical warning without the literal substring ("unbounded whole-table collect/read" instead of `.collect()`).
- **Files modified:** `convex/media.ts`
- **Verification:** Re-ran `grep -c '\.collect()' convex/media.ts` → 0; `grep -c '\.take(' convex/media.ts` → 8 (control, non-zero).
- **Committed in:** `59506f41` (Task 1 commit)

**2. [Rule 1 - Bug] Task 2's grace-period test did not actually discriminate the mutation it was supposed to prove**
- **Found during:** Task 2, running the mandated grace-period mutation proof.
- **Issue:** The test's "recent, must survive" row was fixtured at exactly 1 day old. Shortening `TRASH_GRACE_MS` from 30 to 1 day put that row's `deletedAt` exactly on the new cutoff boundary, which the `.lt` comparison excludes either way — the test passed identically under the correct and the broken constant, so it was not proving what it claimed to.
- **Fix:** Changed the fixture to 5 days old — old enough to be swept by a wrongly-shortened 1-day grace, young enough to clearly survive the real 30-day grace.
- **Files modified:** `convex/media.test.ts`
- **Verification:** Re-ran the mutation proof; went RED (`expected 2 to be 1`); reverted `media.ts`; confirmed byte-identical via empty `git diff`; re-ran → 33/33 green.
- **Committed in:** `94cd76b9` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs in test/check design, not in the janitor's own runtime logic). No scope creep.

## Issues Encountered

- The plan's Task 3 cron-listing verification method (a CLI subcommand for listing scheduled crons) does not exist in the installed `convex` CLI, and the CLI's own `npx convex data <table>` command is provably uninformative for this purpose (identical output for a real system-table name and a deliberately bogus one). Resolved per the plan's own sanctioned fallback — see "Cron-Listing Verification" above for the full reasoning and its honest limit.

## User Setup Required

None. This plan required no new environment variables, credentials, or manual operator steps.

## Next Phase Readiness

- D-08 is now fully closed: the browser half (`toggleStar`/`softDelete`/`restore`, plan 118-04) and the permanent-delete half (`pruneTrashBatch`, this plan) are both live.
- Plan 118-08's watcher must implement the host-side orphan-reconciliation half named in `convex/media.ts`'s `pruneTrashBatch` docstring: once this janitor deletes a `media` row, any corresponding file left in `media-vault\trash\` has nothing pointing at it; the watcher's next cycle should delete any `trash\` file whose `contentHash` matches no `media` row. This is deliberately NOT a second 30-day constant — it is self-reconciling by construction.
- No live behavioral proof of `pruneTrashBatch` running against real data exists yet — `media` holds zero rows at this wave (D-13, greenfield). That proof arrives naturally in plan 118-15 once real rows exist; nothing in this plan blocks on it.
- The cron will not fire until 07:00 UTC at the earliest. No follow-up action is required; this is stated for context, not as a blocker.

## Self-Check: PASSED

- `convex/media.ts` contains `pruneTrashBatch` (internalMutation) — FOUND (`grep -n "export const pruneTrashBatch = internalMutation"` → line 736).
- `convex/crons.ts` contains `studio-trash-prune` — FOUND (`grep -c "studio-trash-prune"` → 1).
- Commit `59506f41` — FOUND (`git log --oneline --all | grep 59506f41`).
- Commit `94cd76b9` — FOUND (`git log --oneline --all | grep 94cd76b9`).
- `.planning/phases/118-studio-media-gallery/118-06-SUMMARY.md` — this file, being written now.

---
*Phase: 118-studio-media-gallery*
*Completed: 2026-08-14*
