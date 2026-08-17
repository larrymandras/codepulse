---
phase: 116-galdr-prompt-library
plan: 02
subsystem: api
tags: [convex, pure-functions, regex, unicode-normalization, tdd-style-tests]

# Dependency graph
requires:
  - phase: 116-01
    provides: prompts/promptVersions schema tables, D-13 retention exemption, validateGaldrAuth
provides:
  - "convex/galdrVariables.ts — the single {{variable}} detection/resolution/substitution contract (D-09..D-12)"
  - "convex/galdrSlug.ts — the single ASCII kebab slug derivation (D-06)"
affects: [116-03, 116-04, 116-06, 116-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "convex/<name>Filters.ts-style import-free pure module shared across the convex/src boundary (established by activeEngineFilters.ts, controlVerbSwapsFilters.ts)"
    - "Pattern SOURCE string exported, never a shared RegExp instance, to avoid /g lastIndex state bugs"
    - "Single-pass String.replace(regex, callback) as a security property against recursive placeholder expansion"

key-files:
  created:
    - convex/galdrVariables.ts
    - convex/galdrVariables.test.ts
    - convex/galdrSlug.ts
    - convex/galdrSlug.test.ts
  modified: []

key-decisions:
  - "Both modules are zero-import pure string functions, verified by reading the first non-comment line and by tsc succeeding on them standalone"
  - "slugify's transliteration map runs BEFORE NFKD normalization because eth/thorn/slashed-o/ae/sharp-s do not decompose under NFKD"
  - "unresolvedVariables treats undefined and whitespace-only identically to empty — one predicate for D-10 (skill refusal) and D-11 (UI Copy gating)"

patterns-established:
  - "Pattern 1: shared regex source string, never a shared RegExp instance — every consumer builds its own RegExp from VARIABLE_PATTERN_SOURCE"
  - "Pattern 2: single-pass substitution via String.prototype.replace's callback form is the enforced defense against recursive/injected placeholder expansion"

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-08-10
---

# Phase 116 Plan 02: Galdr Variable & Slug Contract Summary

**Shared `convex/galdrVariables.ts` (detectVariables/unresolvedVariables/substituteVariables/isFullyResolved) and `convex/galdrSlug.ts` (ASCII kebab slugify with a pre-NFKD Nordic-character transliteration map), each import-free and colocated with a vitest suite proving the single-pass substitution and full ASCII guarantees on real output.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-08-10T11:20:14-04:00 (immediately following 116-01's last commit)
- **Completed:** 2026-08-10T11:24:27-04:00
- **Tasks:** 2/2
- **Files modified:** 4 (all new)

## Accomplishments
- One implementation of `{{variable}}` detection, "unresolved" (D-10/D-11's shared definition), and single-pass substitution now exists in `convex/galdrVariables.ts` — proven by a leaked-value control test (`substituteVariables("{{a}}", { a: "{{b}}", b: "LEAKED" })` returns `"{{b}}"`, never `"LEAKED"`).
- One implementation of ASCII kebab slug derivation now exists in `convex/galdrSlug.ts` — proven against the project's own Nordic vocabulary (`"Ástríðr's Daily Brief"` -> `"astridrs-daily-brief"`, `"Bifröst  --  Link   Hub"` -> `"bifrost-link-hub"`).
- Both modules verified genuinely import-free (zero `import` statements — the first non-comment line in each is an `export`) so either can be pulled into the browser bundle by a future plan (116-06's UI drawer) without dragging in Convex server runtime.

## Task Commits

Each task was committed atomically:

1. **Task 1: The shared {{variable}} contract** - `da31e9f` (feat) — `convex/galdrVariables.ts`, `convex/galdrVariables.test.ts`
2. **Task 2: ASCII kebab slugify** - `ac323fc` (feat) — `convex/galdrSlug.ts`, `convex/galdrSlug.test.ts`

**Plan metadata:** committed in this same message set (this SUMMARY + its own commit, see below).

## Files Created/Modified
- `convex/galdrVariables.ts` - `detectVariables`/`unresolvedVariables`/`substituteVariables`/`isFullyResolved`/`VARIABLE_PATTERN_SOURCE`, zero imports
- `convex/galdrVariables.test.ts` - 16 tests: no-placeholder vacuous case, dedup + first-occurrence order, whitespace trimming, single-brace control, whitespace-only vs falsy-`"0"` unresolved distinction, single-pass leak control, `lastIndex`-independence control
- `convex/galdrSlug.ts` - `slugify`/`MAX_SLUG_LENGTH`, zero imports
- `convex/galdrSlug.test.ts` - 6 tests: plain title, eth+apostrophe transliteration, separator-run collapsing, punctuation-only empty result, truncation-without-trailing-hyphen, whole-fixture-set ASCII-guarantee assertion

## Decisions Made
- **Category-model / usage-count / nav-placement / seeding decisions (CONTEXT.md "Claude's Discretion")** are out of scope for this plan — they belong to 116-03 (schema/handler) and later UI plans, not the pure-function contract plan.
- **`slugify`'s transliteration map is applied before NFKD normalization**, per the plan's explicit ordering requirement, because eth/thorn/slashed-o/ae-ligature/sharp-s do not decompose under Unicode NFKD (verified: `"ð".normalize("NFKD")` returns `"ð"` unchanged, a single codepoint with no combining-mark decomposition).
- **`ø`/`Ø` (slashed o) were included in the transliteration map** even though the plan's worked example only exercises `ö` (which NFKD handles as o + diaeresis). The plan's algorithm step 1 explicitly lists "slashed o to `o`" as a required map entry — `ø` genuinely does not decompose under NFKD (verified), so this is a correct reading of the plan's own spec, not scope creep.

## Deviations from Plan

None — plan executed as written. One clarification worth naming: the plan's task 2 `<read_first>` list cites `docs/proposals/2026-08-07-seidr-suite-design.md §2` for the "ASCII slugs" locked decision; that file wasn't re-read in full during this plan since 116-CONTEXT.md D-06 and the task's own algorithm spec were sufficiently detailed and self-contained to implement against directly.

## Issues Encountered

**Unrelated dirty file in the shared checkout.** `src/hooks/useAstridrVoice.test.ts` was already modified (54 uncommitted insertions) before this plan started, and `npx tsc --noEmit` reports 3 pre-existing type errors in it (`Property '__astridrForceRecognizerReset' does not exist on type 'Window & typeof globalThis'`, lines 2927/2936/2938). This file is not in 116-02's `files_modified` list and was not touched — left as-is per the scope boundary and logged to `.planning/phases/116-galdr-prompt-library/deferred-items.md`. Confirmed the 3 errors are entirely confined to that file (none reference `galdrVariables.ts`/`galdrSlug.ts`) by reading the full `tsc --noEmit` output.

A second untracked file, `src/contexts/AstridrWSContext.test.tsx`, also appeared in `git status` during this plan mid-execution (concurrent-session activity per the shared-checkout warning in this dispatch) — not staged, not touched.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `convex/galdrVariables.ts` and `convex/galdrSlug.ts` are ready to be imported by 116-03's `convex/galdr.ts` handlers (`createPromptHandler` calls `slugify`, prompt read/write paths call `detectVariables`) and by 116-06's UI editor drawer / fill-in dialog (live preview via `substituteVariables`, Copy-button gating via `isFullyResolved`).
- No blockers. The two modules' zero-import property is what makes them safely reusable from `src/` in a later plan without a bundler warning.

---
*Phase: 116-galdr-prompt-library*
*Completed: 2026-08-10*

## Self-Check: PASSED

All 6 created files verified present on disk; all 3 commit hashes (`da31e9f`, `ac323fc`, `73f5d61`) verified present in `git log --oneline --all`.
