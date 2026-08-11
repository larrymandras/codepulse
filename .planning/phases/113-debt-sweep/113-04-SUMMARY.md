---
phase: 113-debt-sweep
plan: 04
subsystem: database
tags: [convex, migrations, skills, data-integrity]

# Dependency graph
requires:
  - phase: 113-01
    provides: producer-side origin split (`claude-code` vs `claude-code:plugin`) in the skill scan hook
  - phase: 113-02
    provides: server-side prune guard protecting undeclared origins during a partial scan
  - phase: 113-03
    provides: prior adversarial-verification-closed work in the same debt-sweep sequence
provides:
  - "One-shot re-origin migration (`reoriginPluginSkills`) moving pre-existing plugin-sourced `skills` rows off the shared `claude-code` origin onto `claude-code:plugin`"
  - "Live-database proof (before/after census) that the migration ran correctly with zero collateral damage"
  - "DEBT-05 fully closed — all four component plans (113-01/02/03/04) complete"
affects: [113-05, 113-07, future skill-catalog work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dry-run-by-default internalMutation with explicit apply:true gate, mirroring backfillAstridrProviderTag"
    - "Pure exported predicate function unit-tested in isolation from Convex ctx (no-ctx-import pattern from skillSync.test.ts)"
    - "Post-migration verification re-derives the observable from a read-only query, never trusts the mutation's own return value"

key-files:
  created:
    - convex/__tests__/migrations.test.ts
  modified:
    - convex/migrations.ts

key-decisions:
  - "Task 3 required no code changes — Task 1 already shipped reoriginPluginSkills; Task 3 is purely a live-data operation plus verification"
  - "Treated two identical 'fetch failed' errors (on the apply call AND a subsequent read-only listSkillOrigins call) as evidence the container was mid-restart and neither request reached the backend, not as an ambiguous partial-apply — confirmed by re-probing /version and docker ps before re-attempting"

requirements-completed: [DEBT-05]

# Metrics
duration: ~1h48m (includes Task 2 checkpoint wait time for Larry's review/approval)
completed: 2026-08-11
---

# Phase 113 Plan 04: Reorigin Pre-existing Plugin Skills Summary

**Applied a one-shot, dry-run-gated Convex migration that moved 57 pre-existing plugin-sourced `skills` rows from the shared `claude-code` origin to `claude-code:plugin`, verified via a live before/after table census (not the mutation's return value) that zero rows were created or destroyed and astridr's `native`/`bridge` rows were untouched — closing DEBT-05.**

## Performance

- **Duration:** ~1h48m wall-clock across the full plan (Task 1 commit to this summary), including the human-verify checkpoint wait
- **Started:** 2026-08-11T20:08:34Z (Task 1 commit)
- **Completed:** 2026-08-11T21:56:12Z
- **Tasks:** 3 (1 auto, 1 checkpoint, 1 auto)
- **Files modified:** 2 (both in Task 1; Task 3 modified no files, only live data)

## Accomplishments

- `reoriginPluginSkills` (Task 1, commit `2b831bc1`) shipped, unit-tested, deployed, and reviewed dry-run (Task 2, approved by Larry)
- Migration applied live with `apply: true` exactly once — `matched: 57, patched: 57`
- Outcome re-derived from the table via `listSkillOrigins`, not trusted from the mutation's return value
- Confirmatory dry-run reports `matched: 0` — population fully migrated, nothing left to re-origin
- DEBT-05 requirement closed: all four component plans (113-01, 113-02, 113-03, 113-04) now have SUMMARY.md on disk

## Task Commits

1. **Task 1: reoriginPluginSkills migration and its pure path predicate (D-04)** - `2b831bc1` (feat) — committed in the prior agent session, prior to this continuation
2. **Task 2: Deploy gate and dry-run review before touching live data (D-04)** - checkpoint (no commit; deploy + dry-run review, approved by Larry)
3. **Task 3: Apply the migration and prove the outcome from the table** - no code commit (live-data operation only; see census below)

**Plan metadata:** committed alongside this SUMMARY.md (docs: complete plan)

## Task 2 Checkpoint — Verified Facts (relayed from orchestrator, not re-run)

- `git status --porcelain convex/` was empty; three concurrent-session commits (659016a7, 97727743, 2cf0adc1 — `189-10` gagLedger/personaDials) were riding along in the deploy and Larry explicitly authorized deploying with them included.
- Pre-deploy `listSkillOrigins`: bridge 207, native 205, claude-code 188, claude-code:available 80, claude-code:project:* 21, total ~701. `claude-code:plugin` did not exist yet.
- `npx convex deploy --yes` succeeded, no indexes deleted.
- Dry-run: `matched: 57, patched: 0, dryRun: true`, all 5 samples were `.claude\plugins\` paths.
- Larry approved with "approved", authorizing exactly one `apply: true` invocation.

## Task 3 — Live Census: Before and After

A container restart occurred between the checkpoint and Task 3 (see Issues Encountered), so the
census immediately preceding the apply call differs slightly from Task 2's checkpoint numbers —
this is documented drift, not a discrepancy. Both censuses below were read directly from
`listSkillOrigins`, not derived from any mutation's own return value.

**Pre-apply (this session, immediately before the `apply: true` call):**

| origin | count |
|---|---|
| bridge | 207 |
| native | 205 |
| claude-code | 188 |
| claude-code:available | 80 |
| claude-code:project:1fa1797dd9db | 19 |
| claude-code:project:789c222cb6b9 | 1 |
| claude-code:project:a3dd52ddc6ab | 1 |
| claude-code:project:5b1caabbdf8f | 1 |
| claude-code:project:35dcd75e840a | 1 |
| **total** | **703** |

**Migration return value** (recorded for reference — NOT used as the outcome proof):
`{ dryRun: false, matched: 57, patched: 57, fromOrigin: "claude-code", toOrigin: "claude-code:plugin" }`

**Post-apply (re-derived from `listSkillOrigins`, the actual observable):**

| origin | count |
|---|---|
| bridge | 207 |
| native | 205 |
| claude-code | 131 |
| claude-code:available | 80 |
| claude-code:plugin | 57 |
| claude-code:project:1fa1797dd9db | 19 |
| claude-code:project:789c222cb6b9 | 1 |
| claude-code:project:a3dd52ddc6ab | 1 |
| claude-code:project:5b1caabbdf8f | 1 |
| claude-code:project:35dcd75e840a | 1 |
| **total** | **703** |

**Assertions, with real numbers:**

- **Total unchanged:** pre 703 → post 703. A re-origin moves rows between origins and creates/destroys none — confirmed.
- **`claude-code:plugin` equals `patched`:** post-apply `claude-code:plugin` = 57 = the `patched` value returned by the apply call. Confirmed.
- **`claude-code` dropped by exactly the patched count:** pre 188 → post 131 = 188 − 57. Confirmed.
- **`native`/`bridge` untouched (load-bearing safety assertion):** native stayed 205, bridge stayed 207 in both censuses — the control proving the origin filter kept astridr's 54 plugin-cache-shaped `native` rows out of scope, since the path predicate alone cannot distinguish them.
- **`claude-code:available` and every `claude-code:project:*` unchanged:** 80 and 19/1/1/1/1 (=23) identical pre and post.
- **Confirmatory dry-run:** a single follow-up `reoriginPluginSkills` (no args) returned `matched: 0, patched: 0, dryRun: true` — proving the population is fully migrated. Run exactly once, per the plan's explicit instruction not to re-run the migration itself a second time.

## Files Created/Modified

- `convex/migrations.ts` — (Task 1, already committed) `isPluginSourcePath` predicate + `reoriginPluginSkills` migration
- `convex/__tests__/migrations.test.ts` — (Task 1, already committed) 9 unit tests covering the predicate including the astridr-container false-positive case
- No files modified in Task 3 — it is a live-data operation with no code change

## Decisions Made

- No code changes were needed for Task 3; it is purely the live application + verification step, so this SUMMARY and the ROADMAP/REQUIREMENTS updates are the only artifacts this task produces.
- Treated the two identical `fetch failed` errors (on `reoriginPluginSkills apply:true` and, separately, on a subsequent `listSkillOrigins` read-only probe) as strong evidence neither request reached the backend at all — both failed identically, and a partial-apply-then-crash would not produce that symmetric failure on the read-only follow-up. Confirmed by checking `docker ps` (`convex-backend ... Up 32 seconds (unhealthy)`, i.e. mid-restart) and polling `/version` until it responded, before re-attempting the apply exactly once with `apply: true`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `convex-backend` container was mid-restart when the apply call was first attempted**
- **Found during:** Task 3, first invocation of `reoriginPluginSkills` with `apply: true`
- **Issue:** Both the apply call and a subsequent read-only `listSkillOrigins` call failed with an identical `TypeError: fetch failed`. `docker ps` showed `convex-backend Up 32 seconds (unhealthy)` — the container had recently restarted (consistent with the documented `ConvexNightlyRestart` behavior in `CLAUDE.md`) and was not yet accepting connections.
- **Fix:** Polled `http://127.0.0.1:3210/version` until it returned 200 (took under a minute), then re-ran the pre-apply `listSkillOrigins` census (703 total, matching Task 2's ~701 baseline plus 2 rows of expected drift), confirmed no apply had landed (still 188 rows on `claude-code`, `claude-code:plugin` did not yet exist), and only then re-invoked `apply: true` exactly once.
- **Files modified:** None — no code change, purely an operational wait-and-reverify.
- **Verification:** Post-apply census (below) proves the apply happened exactly once with the expected 57-row transfer and zero collateral change.
- **Committed in:** N/A (no code artifact; documented here per Rule 3)

---

**Total deviations:** 1 auto-fixed (1 blocking — transient backend unavailability, resolved by waiting and re-verifying rather than retrying blindly)
**Impact on plan:** No scope creep. The migration was applied exactly once as required; the transient failure was caught and handled with the exact re-verification discipline the plan mandated (re-derive from the table, never trust one command's success/failure alone).

## Issues Encountered

- `convex-backend` was unhealthy/restarting at the moment `apply: true` was first sent, causing an unrelated network-layer failure rather than a migration-logic failure. Resolved by confirming backend health via `/version` and a fresh pre-apply census before proceeding. No live row was touched during the outage window — proven because the pre-apply census taken immediately after backend recovery still showed 188 `claude-code` rows and no `claude-code:plugin` origin.
- One transient "Permission for this action was denied by the Claude Code auto mode classifier" block on a `listSkillOrigins` call (immediately after a successful `apply: true` invocation) — an auto-mode classifier hiccup, not a Convex or migration issue. Resolved by re-issuing the identical read-only command, which succeeded and returned the expected post-apply census.

## DEBT-05 Closure

All four plans in the DEBT-05 sequence are now complete with SUMMARY.md on disk:
- `.planning/phases/113-debt-sweep/113-01-SUMMARY.md` (producer-side origin split)
- `.planning/phases/113-debt-sweep/113-02-SUMMARY.md` (server-side prune guard)
- `.planning/phases/113-debt-sweep/113-03-SUMMARY.md` (prior work in this sequence, adversarial-verification closed)
- `.planning/phases/113-debt-sweep/113-04-SUMMARY.md` (this document — pre-existing row migration)

DEBT-05 in `.planning/REQUIREMENTS.md` (line 63, currently `- [ ]`, status `Pending` at line 99) is
marked complete via `gsd-sdk query requirements.mark-complete DEBT-05` in state_updates below.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- DEBT-05 fully resolved: the skill catalog's `claude-code` origin now cleanly separates personal
  skills (131 rows) from plugin-cache skills (57 rows on `claude-code:plugin`), and the producer
  (113-01) + prune guard (113-02) ensure new rows land correctly going forward — no self-heal
  path is depended on for the historical backlog.
- `.planning/STATE.md` was deliberately NOT touched by this session — it is dirty with a
  concurrent session's work (per the sequential-execution instructions in this dispatch). State
  updates for this plan should be reconciled by whichever session next owns STATE.md, using this
  SUMMARY.md as the source of truth for what plan 113-04 completed.

---
*Phase: 113-debt-sweep*
*Completed: 2026-08-11*

## Self-Check: PASSED

- FOUND: `.planning/phases/113-debt-sweep/113-04-SUMMARY.md`
- FOUND: commit `2b831bc1` (Task 1) in git log
