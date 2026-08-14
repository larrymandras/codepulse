---
phase: 118-studio-media-gallery
plan: 03
subsystem: database
tags: [convex, schema, self-hosted, retention, storage]

requires:
  - phase: 118-01
    provides: "D-01 resolved BRANCH: convex-storage — media.thumbStorageId is the populated field"
provides:
  - "media, mediaStyles, mediaModels tables live on the self-hosted Convex backend"
  - "D-03 retention exemption documented and mutation-test-proven"
  - "D-05 contentHash identity + by_contentHash index"
  - "both D-01 transport fields declared (thumbStorageId populated, thumbRelPath reserved)"
affects: [118-04, 118-05, 118-06, 118-07, media.ts (future plans building queries/mutations on these tables)]

tech-stack:
  added: []
  patterns:
    - "curated-table retention exemption comment, third application after Phase 116 D-13 (prompts/promptVersions)"
    - "control-paired live-table-listing probe (bare `npx convex data`) as the discriminating deploy-landed check, after the per-table `npx convex data <table>` form proved non-discriminating"

key-files:
  created:
    - .planning/phases/118-studio-media-gallery/118-03-SUMMARY.md
  modified:
    - convex/schema.ts
    - convex/retention.ts
    - convex/retention.test.ts

key-decisions:
  - "media.contentHash is a REQUIRED (non-optional) v.string() — D-05's row identity, not optional"
  - "Both D-01 transport fields declared on media (thumbStorageId populated per 118-01's convex-storage branch; thumbRelPath reserved, always absent)"
  - "D-03 exemption comment placed inside the RETENTION_DAYS object literal immediately after the Phase 116 D-13 block, matching its indentation and voice, per CONTEXT.md's explicit 'follows the D-13 comment block verbatim in style' discretion note"
  - "Corrected a plan defect: the plan's suggested per-table `npx convex data <table>` read is NOT discriminating on this CLI (1.42.1) — it returns 'There are no documents in this table.' at exit 0 for BOTH a real empty table and a nonexistent bogus table name. The actual discriminating check used instead is the bare `npx convex data` full table listing, where media/mediaModels/mediaStyles are present and a bogus name is absent — verified with a known-positive/known-negative control pair."

patterns-established:
  - "When a CLI's per-item existence probe returns the same 'empty' result for both a real-but-empty item and a nonexistent one, fall back to the item's presence in a full enumeration instead — the per-item probe is not a valid control on its own."

requirements-completed: [D-03, D-05, D-13]

duration: ~15min
completed: 2026-08-14
---

# Phase 118 Plan 03: Studio Schema Foundation Summary

**Added `media`/`mediaStyles`/`mediaModels` to `convex/schema.ts` (D-05 contentHash identity, both D-01 transport fields, 4+1+1 indexes), documented and mutation-test-proved D-03's `RETENTION_DAYS` exemption, and deployed the schema to the live self-hosted backend with a corrected, genuinely discriminating landed-check.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-08-14
- **Tasks:** 3/3 completed
- **Files modified:** 3 (`convex/schema.ts`, `convex/retention.ts`, `convex/retention.test.ts`)

## Accomplishments

- Added `media`, `mediaModels`, `mediaStyles` table definitions to `convex/schema.ts`, following the
  `pipelineRuns`/`workspaceSnapshots` comment-density and index-per-access-pattern conventions.
  `defineTable` count went from 143 to 146 (+3, exact). `contentHash` is required (non-optional); both
  `thumbStorageId` and `thumbRelPath` are declared per D-01, with `thumbStorageId` the populated field
  under the `convex-storage` branch 118-01 resolved live. No `v.any()`, no migration/seed/backfill code
  (D-13). `npx tsc --noEmit` exits clean.
- Documented D-03's retention exemption in `convex/retention.ts` immediately after the Phase 116 D-13
  block, same voice and indentation, and guarded it with a control-paired test in
  `convex/retention.test.ts` (presence-in-schema + absence-from-`RETENTION_DAYS` for the three tables,
  a dynamically-read `runtime_events` control, and a marker-string check on the comment). Test count
  went from 15 to 16 passed.
- **Mutation-tested the D-03 test as required:** temporarily added `media: 90,` to `RETENTION_DAYS`,
  re-ran the suite, and it FAILED with:
  `AssertionError: media must NOT be a RETENTION_DAYS key: expected [ 'media', 'runtime_events', …(20) ] to not include 'media'`
  Reverted from a file backup (never `git checkout --`, per this repo's own lesson about that
  destroying uncommitted work); `git diff convex/retention.ts` after the revert showed only the
  intended D-03 comment addition, zero `^[+-]\s+\w+:\s*\d+,` lines.
- Deployed the schema to the live self-hosted backend and proved it landed with a genuinely
  discriminating live probe (details below).

## Task Commits

Each task was committed atomically:

1. **Task 1: Define media, mediaStyles and mediaModels in convex/schema.ts** — `62dbfbcd` (feat)
2. **Task 2: Record D-03's retention exemption and guard it with a control-paired test** — `e8e8e4de` (feat)
3. **Task 3: Deploy the schema to the live self-hosted backend and prove it landed** — no code commit
   (deploy is a runtime action against `convex/schema.ts` already committed in Task 1; nothing further
   to commit for this task beyond this SUMMARY)

Both task commits verified post-commit with `git show --stat HEAD`: each touched only its own intended
file(s), no accidental sweeps from the concurrent session.

## Files Created/Modified

- `convex/schema.ts` — `media` (contentHash identity, both D-01 transport fields, 4 indexes),
  `mediaModels` (D-12 recipe cards), `mediaStyles`, appended after `workspaceDirs`
- `convex/retention.ts` — D-03 exemption comment block, no `RETENTION_DAYS` key added or changed
- `convex/retention.test.ts` — control-paired D-03 test (16th test in the suite)

## Decisions Made

- **`contentHash` required, not optional** — a `media` row without a content identity is not a valid
  row (D-05). Matches the plan's explicit acceptance criterion.
- **D-03 comment placed inside the `RETENTION_DAYS` object literal**, immediately after the existing
  Phase 116 D-13 block and at the same 2-space indentation — read literally from CONTEXT.md's
  discretion note ("follows the D-13 comment block verbatim in style") and from the task's own
  instruction to add it "immediately AFTER the existing Phase 116 D-13 block... at the same
  indentation." The D-13 block itself lives inside the object as a comment-only entry (no key), so
  D-03's block joins it in the same place.
- **Deploy command run with forward slashes, not backslashes**: the mandated command is
  `npx convex deploy --env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile`; I ran
  `npx convex deploy --env-file C:/Users/mandr/convex-selfhost/selfhosted.envfile -y` instead, per this
  repo's own Windows-paths lesson that hand-escaped backslashes in the Bash tool get mangled before the
  shell receives them. Verified functionally identical: the file exists at that path
  (confirmed via `ls` before deploying) and the deploy output shows it resolved to
  `http://127.0.0.1:3210` — the live self-hosted instance, not the retired cloud deployment
  `tidy-whale-981`. `-y` was added alongside `--env-file`, never instead of it (none was actually
  needed; the deploy did not prompt).
- **Corrected the plan's Task 3 verification mechanism.** The plan suggested
  `npx convex data <table> --env-file ...` (or "the equivalent available in the installed CLI
  version") as the control-paired landed-check. `--env-file` does not exist as a flag on `data` or
  `run` in the installed CLI (1.42.1; confirmed via `--help` before use, per the task's own
  instruction not to trial-and-error it). More importantly, **the per-table form itself is not
  discriminating on this CLI**: `npx convex data media` and
  `npx convex data mediaDefinitelyNotATable9x7q2` both returned the identical
  `There are no documents in this table.` at exit 0 — a real empty table and a nonexistent table are
  indistinguishable through that command. This is exactly the vacuous-absence-proof shape this repo's
  own lessons warn about. The genuinely discriminating check is the bare `npx convex data` (no table
  argument), which lists every real table on the deployment: `media`, `mediaModels`, `mediaStyles` are
  present in that list (166 total tables, more than schema.ts's 146 `defineTable` count — the excess is
  system/historical tables not currently in schema.ts, flagged for visibility, out of this plan's
  scope, not investigated further); `mediaDefinitelyNotATable9x7q2` has zero matches in the same list.
  This is the control pair actually used and quoted below.
  - **Credential handling for this probe:** `--env-file`/`--url` don't exist on `data`/`run`, so
    reaching the self-hosted instance (rather than accidentally resolving to a cloud deployment)
    required the same `CONVEX_SELF_HOSTED_URL`/`CONVEX_SELF_HOSTED_ADMIN_KEY` env vars the mandated
    deploy command loads via `--env-file`. A throwaway Node script
    (`$TEMP/.../scratchpad/data-probe.mjs`, never committed, scratchpad-only) read those two vars plus
    `INSTANCE_SECRET` out of the envfile into a child process's environment and printed only the
    variable **names** (never values) before spawning `npx convex data ...` — no credential value
    entered the transcript, satisfying this plan's secrets discipline.

## Task 3 Evidence (as required by the plan's Output spec)

**Pre-deploy `git status --porcelain` (run and read BEFORE deploying):**
```
(empty — nothing dirty, safe to deploy)
```

**Deploy command actually run** (forward-slash form, see "Decisions Made" above for why):
```
npx convex deploy --env-file C:/Users/mandr/convex-selfhost/selfhosted.envfile -y
```

**Deploy output** (no `Deleted table indexes:` line — instead `Added table indexes:` for exactly the
6 indexes this plan's schema declares):
```
▌ Deploying code to deployment:
▌ └─ http://127.0.0.1:3210
- Deploying to http://127.0.0.1:3210...

✔ No indexes are deleted by this push
Uploading functions to Convex...
Generating TypeScript bindings...
Running TypeScript...
Pushing code to your Convex deployment...
Schema validation complete.
Finalizing push...
✔ Added table indexes:
  [+] media.by_contentHash   contentHash, _creationTime
  [+] media.by_createdAt   createdAt, _creationTime
  [+] media.by_deletedAt   deletedAt, _creationTime
  [+] media.by_kind   kind, _creationTime
  [+] mediaModels.by_slug   slug, _creationTime
  [+] mediaStyles.by_slug   slug, _creationTime
✔ Deployed Convex functions to http://127.0.0.1:3210
```

**Task 3 control pair (live, against the self-hosted backend at 127.0.0.1:3210):**

| Probe | Command shape | Result |
|---|---|---|
| Non-discriminating (rejected) — experimental | `npx convex data media` | `There are no documents in this table.` exit 0 |
| Non-discriminating (rejected) — control | `npx convex data mediaDefinitelyNotATable9x7q2` | `There are no documents in this table.` exit 0 — **identical to the experimental result, so this form carries zero information and was not used as the gate** |
| Discriminating (used) — experimental | `npx convex data` (full table list) | `media`, `mediaModels`, `mediaStyles` all present (of 166 total tables listed) |
| Discriminating (used) — control | same full table list | `mediaDefinitelyNotATable9x7q2` — 0 matches |

**Retention-test mutation-failure message** (Task 2, quoted verbatim):
```
AssertionError: media must NOT be a RETENTION_DAYS key: expected [ 'media', 'runtime_events', …(20) ] to not include 'media'
 ❯ convex/retention.test.ts:248:13
```

**`npm test` before/after (full suite):**
- Before (pre-plan baseline, per `118-01-SUMMARY.md`'s "Next Phase Readiness"): **4397 passed | 0 failed**
  (323 test files passed, 17 skipped; 197 todo)
- After (this plan, post-deploy): **4407 passed | 0 failed** (324 test files passed, 17 skipped; 197
  todo) — the +10 tests / +1 file are this plan's own `retention.test.ts` addition (+1) plus other
  test-file additions landed by the concurrent session's `118-02` work in the interval; nothing this
  plan touched broke.

`npx tsc --noEmit` was mutation-tested (Task 1's and Task 3's shared `<automated>` check): injecting
`v.stringgggg()` in place of `v.string()` on `contentHash` produced
`error TS2339: Property 'stringgggg' does not exist on type '{ id: ... }'` (RED), reverted from a
file backup, confirmed clean again (`npx tsc --noEmit` exits with no output) and confirmed via
`git diff --stat convex/schema.ts` (empty) that the revert left no trace.

## Deviations from Plan

### Auto-fixed / corrected

**1. [Rule 1 — plan defect, not a code bug] The plan's Task 3 landed-check was non-discriminating**
- **Found during:** Task 3
- **Issue:** `npx convex data <table>` returns the identical "no documents" result at exit 0 for a
  real empty table and a nonexistent table name, so it cannot serve as the control pair the task
  requires.
- **Fix:** Used the bare `npx convex data` (full table listing) as the discriminating check instead;
  documented both forms and the reasoning above.
- **Files modified:** none (verification-only; no code change)
- **Verification:** control pair quoted above — genuinely discriminates present vs. absent.

---

**Total deviations:** 1 corrected (plan-defect class, per this plan's own "treat the plan's prose as a
DRAFT" instruction). No scope creep — Task 3's deliverable (proof the schema landed live) is intact,
just proven by a different, actually-valid mechanism.

## Issues Encountered

None blocking. The `npx convex data` full-table-list count (166) exceeds `schema.ts`'s current
`defineTable` count (146) by 20 — almost certainly system tables (`_storage`, etc.) and/or tables from
an earlier schema revision whose data Convex retains even after the table is dropped from `schema.ts`.
Flagged for visibility; not investigated further, as it is unrelated to this plan's three new tables
(all three of which are confirmed present) and touching it would be an unrelated, unscoped
mass-inspection of an already-large (7.1 GB) live database.

## User Setup Required

None — no external service configuration required. Deploy used the repo's own mandated env-file path;
no new environment variables were introduced by this plan.

## Next Phase Readiness

- The three Studio tables exist on the LIVE self-hosted backend, not just in the working tree,
  control-pair-verified.
- D-05's `contentHash` identity + `by_contentHash` index are ready for the ingest/dedup plan (118-07)
  to build against.
- D-01's `thumbStorageId` is the field to populate; `thumbRelPath` stays reserved-but-unused.
- D-03's exemption is both documented in place and enforced by a mutation-proven test — a future
  attempt to "fix" it by adding a `RETENTION_DAYS` key will fail CI immediately.
- `npm test` and `npx tsc --noEmit` are both clean at or above the pre-plan baseline; no regression
  introduced.
- No modifications were made to `.planning/STATE.md` or `.planning/ROADMAP.md` — the orchestrator
  should update those.

---
*Phase: 118-studio-media-gallery*
*Completed: 2026-08-14*
