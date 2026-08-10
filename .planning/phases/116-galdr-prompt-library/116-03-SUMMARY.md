---
phase: 116-galdr-prompt-library
plan: 03
subsystem: database
tags: [convex, galdr, prompt-library, versioning, slug, fuzzy-lookup]

# Dependency graph
requires:
  - phase: 116-01
    provides: "prompts / promptVersions Convex tables, D-13 retention exemption, validateGaldrAuth"
  - phase: 116-02
    provides: "convex/galdrVariables.ts (detectVariables/unresolvedVariables/substituteVariables/isFullyResolved), convex/galdrSlug.ts (slugify, MAX_SLUG_LENGTH)"
provides:
  - "convex/galdr.ts — the Galdr domain module: list/lookup/listVersions/listCategories queries, createPrompt/updatePrompt/restoreVersion/archivePrompt/toggleFavorite/recordUsage mutations, all as testable *Handler exports"
  - "Row-level test coverage for D-05, D-06, D-14, D-15, D-16 against a table-aware, orderable fake ctx.db"
affects: [116-04, 116-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Handler-extraction + fake-db unit test pattern (convex/reminders.ts / convex/reminders.test.ts precedent), now proven for a second domain module with a table-aware, orderable fake"
    - "Per-document count-cap prune (pruneVersions), a genuinely new pattern in this repo distinct from convex/retention.ts's table-wide age-based prune"

key-files:
  created:
    - convex/galdr.ts
    - convex/__tests__/galdr.test.ts
  modified: []

key-decisions:
  - "D-05 implemented literally: match is non-null only on exact slugify(searchTerm) === slug equality via the by_slug index; every other case (including a single fuzzy hit) returns candidates projected to {slug,title,category,usageCount} only"
  - "D-06 implemented as a transactional read-then-throw inside createPromptHandler: the by_slug lookup deliberately does NOT filter archived rows, so an archived prompt's slug still collides"
  - "D-14's pruneVersions is a private helper scoped to a single promptId via the by_promptId index — never touches convex/retention.ts's RETENTION_DAYS, confirmed unchanged by this plan (git diff --name-only)"
  - "D-15: appendVersion is called from create, from update only when body is supplied AND differs from stored body, and from restore (which patches then re-appends rather than rewinding)"
  - "D-16: archivePromptHandler is a single-field patch; no hard-delete/purge mutation exists anywhere in this module"

patterns-established:
  - "GaldrDb / GaldrQuery / GaldrIndexedQuery minimal ctx.db surface, typed for both real Convex ctx and the in-memory test fake, mirroring convex/reminders.ts's RemindersDb"

requirements-completed: []

# Metrics
duration: ~45min
completed: 2026-08-10
---

# Phase 116 Plan 03: Galdr Domain Module Summary

**`convex/galdr.ts` — slug-collision refusal (D-06), per-prompt newest-20 version cap (D-14), append-only version trail (D-15), archive-not-delete (D-16), and a fuzzy lookup that never auto-injects (D-05), all as unit-tested handler functions against a table-aware fake `ctx.db`.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3/3 completed
- **Files created:** 2 (`convex/galdr.ts`, `convex/__tests__/galdr.test.ts`)

## Accomplishments

- Read paths (`listHandler`, `lookupHandler`, `listVersionsHandler`, `listCategoriesHandler`) all filter through `isVisible` and return `toPromptView` shapes with a server-computed `variables[]` sourced from `detectVariables` (116-02) — never re-derived.
- Write paths enforce every locked decision in code, not just in a comment: `createPromptHandler` refuses on slug collision (checking archived rows too) and throws `EMPTY_SLUG` on an all-punctuation title; `updatePromptHandler` treats the slug as immutable and only appends a version when the body actually changed; `restoreVersionHandler` refuses a cross-prompt versionId and appends forward rather than rewinding; `archivePromptHandler` is the only soft-delete path in the module — there is no hard delete anywhere.
- `pruneVersions`/`appendVersion` implement D-14's per-prompt newest-N cap using the `by_promptId` index, architecturally incapable of becoming a table-wide sweep (verified: `convex/retention.ts` is untouched by this plan).
- 16 row-level tests pass against a table-aware, orderable in-memory fake `ctx.db` (new capability beyond `reminders.test.ts`'s single-Map fake — required so a `promptVersions` count assertion can never accidentally include `prompts` rows).
- Both plan-mandated mutation checks were performed live, not simulated: raising `PROMPT_VERSION_CAP` to 100 broke the D-14 test (expected 100 rows, got 26 — the real write count), and disabling the `SLUG_COLLISION` throw broke both D-06 collision tests. Both were reverted and the suite re-confirmed green before committing.
- `npx tsc --noEmit` and the full repo `npx vitest run` (289 files, 3817 tests) both pass with these two new files in place.

## Task Commits

1. **Task 1 + Task 2: Read paths + write paths (`convex/galdr.ts`)** - `294145f1` (feat) — combined into one commit; see Deviations.
2. **Task 3: Row-level tests (`convex/__tests__/galdr.test.ts`)** - `3d9456bc` (test)

## Files Created/Modified

- `convex/galdr.ts` — Galdr domain module: `PROMPT_VERSION_CAP`, `isVisible`, `toPromptView`, `listHandler`/`lookupHandler`/`listVersionsHandler`/`listCategoriesHandler` (+ `list`/`lookup`/`listVersions`/`listCategories` query registrations), `createPromptHandler`/`updatePromptHandler`/`restoreVersionHandler`/`archivePromptHandler`/`toggleFavoriteHandler`/`recordUsageHandler` (+ matching mutation registrations), private `appendVersion`/`pruneVersions` helpers.
- `convex/__tests__/galdr.test.ts` — table-aware, orderable `makeFakeDb()` plus 16 tests covering the harness-liveness control, D-06 (3 cases), D-14 (1 case with isolation control), D-15 (4 cases), D-16 (1 case), D-05 (4 cases), and `recordUsage` semantics (2 cases).

## Decisions Made

- **`lookupHandler`'s second parameter is named `searchTerm`, not `query`.** The plan's `<interfaces>` prose names it `query`, but that identifier is already imported at module scope from `./_generated/server` for the Convex query-builder (`export const lookup = query({...})`). Shadowing it inside the handler body works in TypeScript but is a needless foot-gun for a future editor reading this file; `searchTerm` carries the same meaning without the collision. Purely a naming choice — the function's behavior is unchanged. Not treated as a plan defect (Rule 1/2/3 did not apply; this is a same-behavior rename), so no separate correction note.
- **`lookupHandler` returns `candidates: []` (not omitted) whenever `match` is non-null.** The plan's D-05 prose only specifies candidate population for the `match === null` branch; returning an empty array (rather than making `candidates` optional) keeps the return shape uniform for every caller and is consistent with `GaldrLookupResult`'s type. No test asserts on this specific case since the plan's D-05 test list doesn't require it, but it's the most defensible reading of "otherwise `match` is null and `candidates` is a list."

## Deviations from Plan

### Rule 3 (efficiency, not a defect) — combined Task 1 + Task 2 into one commit

- **Found during:** committing after Task 2.
- **Reason:** Both tasks target the exact same file (`convex/galdr.ts`), and the write handlers in Task 2 depend directly on the read-path helpers (`isVisible`, `toPromptView`) and constant (`PROMPT_VERSION_CAP`) written in Task 1. Writing and verifying the whole file in one pass, then splitting the final artifact back into two synthetic partial-file commits, would have required reconstructing an intermediate state that never really existed as a working checkpoint (Task 1 alone has no write paths, so `npx tsc --noEmit` would pass but the module would be incomplete against its own frontmatter `exports` list).
- **What was done instead:** One `feat(116-03)` commit for the complete `convex/galdr.ts` (both read and write paths), immediately followed by the `test(116-03)` commit for Task 3's test file — two commits total, each independently verified (`git show --stat HEAD` matched the staged path exactly in both cases).
- **Impact:** None on correctness or scope. Task 1 and Task 2's separate acceptance criteria (the `{{` grep, the `db.delete` grep, the `throw new Error(` grep, the "no `20` outside the declaration" check, `git diff --name-only` excluding `convex/retention.ts`) were all run and passed against the final file before either commit.

### Rule 2 — added a `NOT_FOUND` guard to `toggleFavoriteHandler`

- **Found during:** Task 2, writing `toggleFavoriteHandler`.
- **Issue:** The plan's action text for `toggleFavoriteHandler` doesn't mention loading the prompt or guarding a missing id — but the negation logic (`!(existing.favorite ?? false)`) requires reading the current value first regardless, and every other write handler in this module (`updatePromptHandler`, `restoreVersionHandler`) throws `ConvexError({code:"NOT_FOUND"})` on a missing/invalid id rather than letting `ctx.db.patch` fail unchecked on a stale id.
- **Fix:** `toggleFavoriteHandler` loads the prompt via `ctx.db.get`, throws `NOT_FOUND` if absent, then patches the negated `favorite` and `updatedAt`.
- **Files modified:** `convex/galdr.ts` (this file's only version, no separate revision).
- **Verification:** `npx tsc --noEmit` passes; the plan's own test list doesn't exercise this specific guard, so no dedicated test was added for it, but it does not change the behavior any test asserts on (a `toggleFavoriteHandler` call in the suite is always against a live promptId).
- **Impact:** Small, purely defensive — no scope creep, consistent with the pattern already established by sibling handlers in the same file.

---

**Total deviations:** 1 auto-fixed (Rule 2), 1 commit-granularity note (not a code deviation), 2 naming/return-shape clarifications documented above for transparency.
**Impact on plan:** No behavioral divergence from the locked decisions (D-05, D-06, D-14, D-15, D-16). No scope creep.

## Issues Encountered

None. Both required mutation checks (raise `PROMPT_VERSION_CAP` to 100; disable the `SLUG_COLLISION` throw) were performed as temporary in-place edits, run against the suite, observed to fail the expected tests, and reverted before committing — see the transcript-quoted vitest output above for the exact failure text of each.

## Mutation Check Results (Task 3 acceptance criterion)

1. **`PROMPT_VERSION_CAP` raised 20 → 100:** `npx vitest run convex/__tests__/galdr.test.ts -t "D-14"` — 1 failed. `AssertionError: expected [ ... ] to have a length of 100 but got 26` (the real number of writes: 1 create + 25 updates). Reverted to 20; full suite re-ran green (16/16).
2. **`SLUG_COLLISION` throw disabled** (`if (existing) { throw ... }` → `if (existing && false /* MUTATION-CHECK-TEMP-DISABLE */) { throw ... }`): `npx vitest run convex/__tests__/galdr.test.ts -t "D-06"` — 2 failed (`expected null not to be null` on both collision-refusal assertions). Reverted; full suite re-ran green (16/16), `npx tsc --noEmit` clean.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `convex/galdr.ts` exports everything 116-04 (HTTP surface: `GET /galdr/prompt`, `POST` writes) and the UI (`src/hooks/useGaldrPrompts.ts`, `src/pages/Galdr.tsx`) need: `api.galdr.list`, `api.galdr.lookup`, `api.galdr.listVersions`, `api.galdr.listCategories`, `api.galdr.createPrompt`, `api.galdr.updatePrompt`, `api.galdr.restoreVersion`, `api.galdr.archivePrompt`, `api.galdr.toggleFavorite`, `api.galdr.recordUsage`.
- No blockers. `convex/retention.ts` was confirmed unchanged (`git diff --name-only` excludes it) and `convex/schema.ts`'s D-13 exemption comment is still the only place `prompts`'s retention-exemption rationale lives — nothing in this plan needed to touch either file.
- 116-04/116-05 should note: `recordUsageHandler` takes a `slug`, not a `promptId` — the HTTP layer's injection-bump call must resolve the slug it already has from the URL/args, not fetch a promptId first.

---
*Phase: 116-galdr-prompt-library*
*Completed: 2026-08-10*

## Self-Check: PASSED

- FOUND: convex/galdr.ts
- FOUND: convex/__tests__/galdr.test.ts
- FOUND: .planning/phases/116-galdr-prompt-library/116-03-SUMMARY.md
- FOUND commit: 294145f1 (feat: galdr.ts)
- FOUND commit: 3d9456bc (test: galdr.test.ts)
- FOUND commit: a74bdc81 (docs: this summary)
