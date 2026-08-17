---
phase: 116-galdr-prompt-library
plan: 01
subsystem: database
tags: [convex, schema, auth, retention, galdr]

# Dependency graph
requires: []
provides:
  - "prompts + promptVersions Convex tables (convex/schema.ts)"
  - "validateGaldrAuth fail-closed bearer validator (convex/ingestAuth.ts)"
  - "D-13 retention exemption for prompts/promptVersions, documented and test-guarded (convex/retention.ts)"
affects: ["116-02 (galdr.ts mutations/queries)", "116-03 (HTTP routes)", "116-05 (deployment)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fail-closed bearer validator (third instance) — validateGaldrAuth mirrors validateIngestAuth/validateForgeIngestAuth exactly: missing key denies unless an explicit ALLOW_ANON=true opt-in is set, plain === comparison"
    - "RETENTION_DAYS exemption-by-comment — a table can be deliberately absent from the retention policy, with the reasoning recorded inline at the site a future auditor reads, and a test that fails if the comment disappears"

key-files:
  created: []
  modified:
    - "convex/schema.ts — prompts + promptVersions tables"
    - "convex/retention.ts — D-13 exemption comment inside RETENTION_DAYS"
    - "convex/retention.test.ts — exemption regression test"
    - "convex/ingestAuth.ts — validateGaldrAuth"
    - "convex/__tests__/ingestAuth.test.ts — five-case validateGaldrAuth suite"

key-decisions:
  - "D-01/D-02 honored verbatim: dedicated GALDR_API_KEY, one key for both read and write, no scoping split"
  - "D-13 honored: prompts exempt from RETENTION_DAYS with reasoning documented in place; promptVersions bounded by a different mechanism (newest-N-per-prompt, not yet implemented — that's plan 116-03)"
  - "Category modeled as a plain v.string() field, not a categories table with overrides (per 116-CONTEXT.md Claude's Discretion + 116-UI-SPEC.md resolution)"
  - "usageCount comment carries the exact resolved-body-delivery definition from 116-UI-SPEC.md, not a paraphrase"

patterns-established:
  - "A RETENTION_DAYS exemption is proven with three assertion classes: absence (with a known-present control), schema-presence (proving the exemption targets a real table, not a typo), and source-content (the comment is actually there)"

requirements-completed: []

# Metrics
duration: ~20min
completed: 2026-08-10
---

# Phase 116 Plan 01: Galdr Backend Foundation Summary

**`prompts`/`promptVersions` Convex tables, a third fail-closed bearer validator (`validateGaldrAuth`), and a documented+test-guarded D-13 retention exemption — the three prerequisites every later Galdr plan depends on.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-10
- **Tasks:** 3/3
- **Files modified:** 5 (exactly the plan's declared `files_modified`)

## Accomplishments

- `prompts` (title/slug/body/category/tags/favorite/usageCount/lastUsedAt/archived/createdAt/updatedAt, indexed by_slug/by_category/by_updatedAt) and `promptVersions` (promptId/body/savedAt, indexed by_promptId) declared in `convex/schema.ts`, with the verbatim D-discretion `usageCount` comment and rationale comments for the category model, the `slug` uniqueness caveat, and the `promptSubmissions` naming collision.
- `validateGaldrAuth` added to `convex/ingestAuth.ts` — structurally identical to `validateIngestAuth`/`validateForgeIngestAuth` (fail-closed on missing `GALDR_API_KEY`, exact-string `GALDR_ALLOW_ANON=true` opt-in, plain `===` bearer compare) with a doc comment recording D-01's blast-radius rationale and D-02's no-split rule. Five new tests cover all five specified cases, including the exact-string negative control (`"1"`, `"TRUE"` both rejected).
- D-13 exemption documented inside `RETENTION_DAYS` in `convex/retention.ts` (why `prompts` is exempt, why `promptVersions` is bounded differently, an explicit do-not-"fix" warning) with a new regression test in `convex/retention.test.ts` that asserts the absence (with `controlVerbSwaps` as a known-present control), asserts both tables are real schema tables, and asserts the source contains `D-13` + both table names. Mutation-tested live: deleting the comment block made the test fail, then it was restored and reverified.

## Task Commits

Each task was committed atomically:

1. **Task 1: Declare the prompts and promptVersions tables** — `c7664a20` (feat)
2. **Task 2: Document the D-13 retention exemption and lock it with a test** — `9a7d519c` (docs)
3. **Task 3: Add validateGaldrAuth and its five-case test suite** — `629e3403` (feat)

_No plan-metadata commit was made — per the shared-checkout-safety constraint on this dispatch, STATE.md/ROADMAP.md are owned by the orchestrator, not this executor. This SUMMARY.md is committed separately by the orchestrator's own step._

## Files Created/Modified

- `convex/schema.ts` — `prompts` + `promptVersions` table declarations
- `convex/retention.ts` — D-13 exemption comment block inside `RETENTION_DAYS`
- `convex/retention.test.ts` — new `it()` asserting the D-13 exemption
- `convex/ingestAuth.ts` — `validateGaldrAuth` export
- `convex/__tests__/ingestAuth.test.ts` — five new `validateGaldrAuth` tests

## Decisions Made

- Followed the plan's inline field/index/comment specification as written — cross-checked against `116-UI-SPEC.md`'s "Claude's Discretion — resolved" section (verbatim `usageCount` comment, category-as-plain-string rationale) and `docs/proposals/2026-08-07-seidr-suite-design.md` §4.1 (field list), both of which matched the plan text exactly. No deviation from the plan's proposed schema shape was needed.
- Placed the D-13 comment block inside the `RETENTION_DAYS` object literal immediately after `controlVerbSwaps: 30,`, matching the plan's instruction that a future editor adding a new table will read it there, rather than as a header comment.

## Deviations from Plan

None — plan executed exactly as written. All inline code proposals in the plan were verified against the live files (`convex/ingestAuth.ts`, `convex/retention.ts`, `convex/retention.test.ts`, `convex/schema.ts`) before transcribing, per the "plan is a draft" instruction; no defects were found in this plan's text (unlike 116-05, which is referenced as having had two).

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. `GALDR_API_KEY` / `GALDR_ALLOW_ANON` env vars are consumed by `validateGaldrAuth` but not yet set anywhere (no route calls it yet — that's plan 116-03); setting the real key is deployment-time work explicitly deferred to plan 116-05's blocking checkpoint.

## Next Phase Readiness

- The three files every later 116-* plan depends on (`convex/schema.ts`, `convex/ingestAuth.ts`, `convex/retention.ts`) now have the tables, the validator, and the exemption in place — plan 116-02 (galdr.ts mutations/queries, including the `by_slug` check-then-insert and `promptVersions` newest-20 pruning that this plan's comments reference but do not implement) can proceed.
- No deployment happened this plan (local unit tests only, per this dispatch's environment rules) — `GALDR_API_KEY` does not yet exist on the live Convex instance. `validateGaldrAuth` is dead code until an HTTP route in `convex/http.ts` calls it (116-03).
- `git diff --stat` across all three commits touches exactly the 5 files declared in the plan's `files_modified` frontmatter — verified via `git diff --stat HEAD~3 HEAD`.

---
*Phase: 116-galdr-prompt-library*
*Completed: 2026-08-10*
