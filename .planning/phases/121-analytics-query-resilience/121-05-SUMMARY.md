---
phase: 121-analytics-query-resilience
plan: 05
subsystem: testing
tags: [react, typescript-compiler-api, structural-test, analytics]

# Dependency graph
requires:
  - phase: 121-04
    provides: "Analytics.tsx as a composition-only page: zero data-fetching hook calls in
      Analytics()'s own function body; every relocated query lives inside a
      SectionErrorBoundary-wrapped child; the Summary Row split into four independently
      boundary-wrapped cards"
provides:
  - "src/pages/Analytics.structuralGuard.test.ts: an AST-derived ratchet that fails if any
    query-shaped hook is hoisted into Analytics()'s own body, or any custom JSX element it
    renders lacks a SectionErrorBoundary ancestor — with no enumerated query names anywhere in
    the file, so it constrains the NEXT regression, not just today's fixes"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AST-walk-your-own-source test: ts.createSourceFile over a file's own text (no new
      dependency — typescript is already a devDependency), replacing the enumerated
      readFileSync+regex idiom (LlmAnalyticsPanel.test.tsx:120-127) for a case where the
      matching strategy itself must not enumerate."
    - "In-memory mutation testing: every mutation is a string transform on the real source held
      in a JS variable, never written to disk. ts.transpileModule(...).diagnostics proves each
      mutation still parses before its failure is trusted."
    - "Import-specifier tag resolution: JSX tag identity for the boundary check is resolved
      through the file's own import bindings (local name -> imported name -> module specifier),
      not the literal JSX tag string, so an aliased import cannot defeat the check."

key-files:
  created:
    - src/pages/Analytics.structuralGuard.test.ts
  modified: []

key-decisions:
  - "PRESENTATIONAL_ALLOWLIST seeded with exactly two tags — GlassPanel and SectionHeader — not
    the eight-name set RESEARCH.md speculated (MetricCard, Badge, AnomalyBadge, FlexBarChart,
    Link, Table*, InfoTooltip). None of those eight are imported by the post-121-04
    Analytics.tsx; RESEARCH.md's list described the pre-121-04 god-component shape. Re-derived
    the allowlist from the CURRENT file's own import block rather than carrying the plan's
    read_first list forward unexamined (121-CONTEXT.md's own precedent: fix the defect class,
    re-derive the population from the corpus, not from a stale document)."
  - "Case A/B/C from the plan's prose map to exactly 3 it() blocks, not 4: Case C (the
    ts.transpileModule validity precondition) is not a standalone test — it is the first
    assertion INSIDE both Case A's and Case B's test bodies, exactly as the plan specifies
    ('Make this assertion run first in each case'). The negative control is the third it()."
  - "Chose not to allowlist GlassPanel/SectionHeader by literal string alone — resolved their
    identity through the same import-binding resolution used for SectionErrorBoundary, for
    symmetry, even though the plan only explicitly required this robustness for the boundary
    name itself."

requirements-completed: [DEBT-08]

# Metrics
duration: ~35min
completed: 2026-08-18
---

# Phase 121 Plan 05: Analytics.tsx Structural Ratchet (D-04) Summary

**A pure `analyzeAnalyticsSource(src: string)` function, parsed once per call via
`ts.createSourceFile`, derives two properties of `Analytics.tsx` from its own AST — zero hoisted
query-shaped hooks, zero unwrapped custom elements — and is proven load-bearing by two
never-before-seen synthetic mutations plus an in-session stub that made both mutation cases go
red.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2/2 completed
- **Files modified:** 1 (created)

## Accomplishments

- Built `analyzeAnalyticsSource(src: string): { hoistedHooks: string[]; unwrappedElements: string[] }`
  as a pure function of source text: one `ts.createSourceFile` parse (`ts.ScriptKind.TSX`),
  locates the default-exported `function Analytics`, then runs two independent AST walks.
- **CHECK 1**: walks the function body's top-level statements only (explicitly skipping the
  `ReturnStatement`, i.e. the JSX subtree), collecting every `CallExpression` whose callee
  matches `/^use[A-Z]/` and is not in `REACT_SAFE_HOOKS` — a 17-entry closed set of React and
  react-router builtins only. No Convex hook name, and no query name this app has ever had,
  appears anywhere in the file.
- **CHECK 2**: walks the JSX `Analytics()` returns, flagging every capitalized element that (a)
  is not itself `SectionErrorBoundary`, (b) is not on the two-entry `PRESENTATIONAL_ALLOWLIST`,
  and (c) has no `SectionErrorBoundary` ancestor in the tree. Tag identity is resolved through
  the file's own import bindings (`collectImportBindings` + `resolveTagIdentity`), not the
  literal JSX tag string, so an aliased import (`import Foo as SectionErrorBoundary`) cannot
  defeat it.
- Verified both checks pass against the live, post-121-04 `Analytics.tsx`: `hoistedHooks` and
  `unwrappedElements` both empty — matching the plan's stated expected floor (0, down from a
  pre-121-04 population of 10 hoisted calls, recorded as a comment, not a name list).
- Mutation-tested with two synthetic identifiers that have never existed in this repository's
  history: `useTotallyNewThingNobodyHasWrittenYet` (Case A, inserted as the first statement in
  `Analytics()`'s body) and `SomeBrandNewPanelNobodyHasWrittenYet` (Case B, inserted as the
  first child of the outer grid `div`, the same unwrapped position class as the Summary Row this
  ratchet exists to catch). Both mutations are string transforms on the real source text held in
  memory — never written to disk (`grep -cE "writeFileSync|appendFileSync|fs\.write" ... ` = 0).
- Proved each mutation syntactically valid via `ts.transpileModule(mutated, { fileName:
  "Analytics.tsx", reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.Preserve } })`
  before trusting its failure — asserted `diagnostics` empty FIRST in both Case A and Case B,
  per the plan's explicit ordering requirement (a parse error would otherwise masquerade as the
  guard firing).
- Added a negative control (`analyzeAnalyticsSource(REAL_SOURCE)` returns both arrays empty in
  the same `describe` block as the mutation cases) so an analyzer that reported a violation
  unconditionally could not pass Cases A/B while proving nothing.
- Ran the required second-order mutation live: temporarily replaced `analyzeAnalyticsSource`'s
  body with an unconditional `return { hoistedHooks: [], unwrappedElements: [] }`, re-ran
  `npx vitest run src/pages/Analytics.structuralGuard.test.ts`, confirmed Case A and Case B both
  went RED (`expected [] to include 'useTotallyNewThingNobodyHasWrittenYet'` /
  `'SomeBrandNewPanelNobodyHasWrittenYet'`) while the two Task-1 assertions and the negative
  control stayed green (3 passed / 2 failed, exactly the expected split), then reverted the stub
  and re-ran to confirm 5/5 green again before committing. This proves the mutation cases are
  load-bearing, not passing for an incidental reason.

## Task Commits

1. **Task 1 + Task 2 (single file, both tasks land in one commit — the plan's own
   `files_modified` lists exactly one file for both tasks)**: `50891b04` (test)

## Files Created/Modified
- `src/pages/Analytics.structuralGuard.test.ts` — created. 300 lines: two pure AST-walk
  functions, the `REACT_SAFE_HOOKS`/`PRESENTATIONAL_ALLOWLIST` closed sets, import-binding
  resolution, and two `describe` blocks (the two Task 1 assertions, plus the three Task 2
  mutation-constraint cases).

## Decisions Made

- **`PRESENTATIONAL_ALLOWLIST` re-derived from the live file, not from the plan's `read_first`
  list.** The plan's Task 1 `read_first` names eight components to audit
  (`MetricCard`, `AnomalyBadge`, `FlexBarChart`, `GlassPanel`, `SectionHeader`, `InfoTooltip`,
  `ui/badge`, `ui/table`) — this list describes the pre-121-04 shape RESEARCH.md investigated,
  before 121-04 replaced the raw Summary Row JSX with four self-fetching card components. Read
  the current `Analytics.tsx` import block directly: of those eight, only `GlassPanel` and
  `SectionHeader` are actually imported and rendered today; the other six do not appear in the
  file at all. Per the plan's own acceptance criterion ("every entry actually appears in the
  current `src/pages/Analytics.tsx`") and 121-CONTEXT.md's carried-forward rule (re-derive the
  population from the corpus, not from a document), the allowlist contains exactly the two tags
  that are both present and unwrapped: `GlassPanel` (wraps the Summary Row's four
  already-boundary-wrapped cards, itself with no boundary of its own) and `SectionHeader`
  (rendered bare as a section divider, twice). Both grepped clean for
  `useQuery`/`usePaginatedQuery` on 2026-08-18 (0 matches each), recorded inline in the source
  with the grep date.
- **Case A/B/C mapped to 3 `it()` blocks, matching the plan's literal "three cases" phrasing.**
  The plan describes Case A (synthetic hook), Case B (synthetic element), and Case C (validity
  precondition, "asserted BEFORE the failure in each of A and B") — Case C is not a fourth
  standalone test; it is the shared `ts.transpileModule` assertion that opens both Case A's and
  Case B's bodies. The negative control (required separately, "assert the negative control in
  the same block") is the third `it()`. `grep -c "transpileModule"` returns 2 (one per mutation
  case), matching the acceptance criterion of "at least 2 (one validity check per mutation)".
- **Tag identity resolution applied uniformly, not just to the boundary name.** The plan's
  aliased-import robustness requirement is stated only for detecting `SectionErrorBoundary`
  itself; `resolveTagIdentity` is used for every capitalized tag, including allowlist membership
  checks, at negligible extra cost and for the same reason the plan gives — "the current import
  block is unaliased; the resolution is there so it stays true."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — corrected a stale plan input, not a bug] `PRESENTATIONAL_ALLOWLIST` scope**
- **Found during:** Task 1, reading `Analytics.tsx`'s current import block before writing the
  allowlist.
- **Issue:** The plan's `read_first` list for Task 1 named eight presentational components to
  verify (see Decisions above). This list is accurate for the file RESEARCH.md read on
  2026-08-18 during the SAME session but BEFORE 121-04 executed its rewire later that same day —
  it is not stale in the sense of being outdated advice, it simply describes an earlier commit's
  shape of a file this plan depends on (`121-04`, its own `depends_on`). Following it literally
  would have produced an allowlist containing six tag names that do not appear anywhere in the
  file, which the plan's own acceptance criterion explicitly forbids ("Do not carry forward a tag
  that no longer appears").
- **Fix:** Read `Analytics.tsx`'s import block directly (already required reading per
  `<files_to_read>`), confirmed which of the eight tags are still imported (2 of 8: `GlassPanel`,
  `SectionHeader`), and seeded the allowlist with only those two, each individually grepped for
  `useQuery`/`usePaginatedQuery` and recorded with the grep result and date per the plan's own
  requirement.
- **Files modified:** `src/pages/Analytics.structuralGuard.test.ts` (written correctly the first
  time; no rework needed — this is reported as a deviation from the plan's literal read_first
  list, not a bug fixed after the fact).
- **Verification:** `grep -cE "MetricCard|AnomalyBadge|FlexBarChart|InfoTooltip" src/pages/Analytics.structuralGuard.test.ts`
  → 0. Both allowlist entries verified present in `Analytics.tsx` and independently grepped clean
  in `GlassPanel.tsx` / `SectionHeader.tsx`.
- **Committed in:** `50891b04`.

---

**Total deviations:** 1 (plan-input correction, not a code bug — no incorrect code was ever
written or reverted).
**Impact on plan:** None on scope or behavior. The ratchet's two checks and their derivation
method are exactly as specified; only the allowlist's concrete membership differs from the
plan's `read_first` hint, and the plan's own acceptance criteria required exactly this
re-derivation.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None — no external service configuration required.

## Verification Performed

- `npx vitest run src/pages/Analytics.structuralGuard.test.ts` → 5/5 passed (2 in the first
  `describe`, 3 in the second).
- `npx tsc --noEmit` → clean, 0 errors.
- `grep -c "ts.createSourceFile" src/pages/Analytics.structuralGuard.test.ts` → 1 (≥1 required).
- `grep -cE "cacheStats|subscriptionUsage|billedOverTime|getActiveAnomalies|eventCountsByPeriod|advisorEvents" src/pages/Analytics.structuralGuard.test.ts`
  → 0 (0 required — no enumerated query name anywhere in the ratchet).
- `grep -c "transpileModule" src/pages/Analytics.structuralGuard.test.ts` → 2 (≥2 required).
- `grep -cE "writeFileSync|appendFileSync|fs\.write" src/pages/Analytics.structuralGuard.test.ts`
  → 0 (0 required — no mutated source ever written to disk).
- Novel-identifier grep, scoped to application code (`src/`, `convex/`, excluding this test
  file): `git grep -cF "useTotallyNewThingNobodyHasWrittenYet" -- src/ convex/
  ':!src/pages/Analytics.structuralGuard.test.ts'` → exit 1 (no matches; git grep exits 1 on zero
  hits). Whole-repo `git grep -cF "useTotallyNewThingNobodyHasWrittenYet"` → 1 hit, in this
  phase's own `121-05-PLAN.md` (the dispatch document that specifies the identifier) — reported
  honestly rather than silently narrowed; it is not application code and does not affect the
  case's novelty claim.
- Second-order mutation (proves the mutation cases are load-bearing): stubbed
  `analyzeAnalyticsSource` to unconditionally `return { hoistedHooks: [], unwrappedElements: [] }`,
  ran `npx vitest run src/pages/Analytics.structuralGuard.test.ts` → 3 passed / 2 failed (Case A
  and Case B both red with `expected [] to include '<synthetic name>'`; the two Task 1 assertions
  and the negative control stayed green). Reverted the stub via `Edit`, re-ran → 5/5 green again.
  No git operation was involved in this probe (the file was not yet committed at the time); the
  revert was verified by re-reading test output, not by diffing against a prior commit.
- Full suite: `npx vitest run` → **338 test files passed, 17 skipped (355); 4772 tests passed,
  197 todo (4969)**, 0 failed — versus the dispatch's stated baseline (337 passed/17 skipped test
  files, 4767 passed/197 todo tests): +1 test file, +5 tests, matching exactly this plan's one
  new file and five new `it()` blocks, no regressions.
- `npm run build` → exit 0 (clean production build; only the pre-existing "chunks larger than
  500 kB" advisory, unrelated to this plan).
- `git show --stat HEAD` after the commit: exactly one file
  (`src/pages/Analytics.structuralGuard.test.ts`, 300 insertions), no foreign files swept in from
  the concurrent phase-190 session. `git status --short` clean immediately after.

## Next Phase Readiness
- Plan 121-06 (LlmAnalyticsPanel payload/label wiring, D-07/D-10/D-11) is unaffected by this
  plan's file and can proceed independently — this plan touched only
  `src/pages/Analytics.structuralGuard.test.ts`.
- The ratchet's stated limitation (single-file coverage; silently stops constraining if a future
  phase extracts a layout/composition component out of `Analytics.tsx`'s body) is recorded as a
  header comment in the test file itself, not just here, so a future phase that does that
  extraction is more likely to notice.
- No blockers.

---
*Phase: 121-analytics-query-resilience*
*Completed: 2026-08-18*
