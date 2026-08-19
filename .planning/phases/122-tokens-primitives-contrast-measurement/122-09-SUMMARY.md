# Phase 122 Plan 09: Shared State Vocabulary Summary

Builds the shared six-state vocabulary the rest of the honesty sweep (122-13 `MetricCard`,
122-14/15/16) consumes: one module (`src/lib/metricState.ts`) defining `loading` / `ready` /
`empty` / `stale` / `unavailable` / `error` with token-only tone, Lucide icon and honest default
copy per state; a derivation hook (`src/hooks/useMetricState.ts`) covering the common Convex case
from a raw `useQuery` value; and `EmptyState.tsx`, the panel/page-scale renderer of the same
vocabulary. All three tasks executed as specified, autonomous, no checkpoint in this plan.

## What Was Built

**Task 1 -- `src/lib/metricState.ts`.** `MetricState` is exactly the six-member union. Each entry
in `METRIC_STATE_COPY` carries `label`/`icon`/`tone`. `tone` is always a `var(--token)` reference
(`--muted-foreground` for `loading`/`ready`/`empty`/`unavailable`, `--status-warn` for `stale`,
`--status-error` for `error`) -- `loading` and `unavailable` are explicitly neutral per D-19's
justification (a metric that has not loaded has no health to report; a metric with no emitter
behind it is an absence, not a failure), and `empty` follows the same reasoning for the same
reason. `empty.label` is exactly `"no signal yet"` (D-20). `ready` gets a real table entry rather
than being left undefined, per the plan's explicit instruction, even though the tile renders the
actual value instead of this copy. `DEFAULT_STALE_AFTER_MS` is 5 minutes, with a comment
justifying the number against this dashboard's near-real-time Convex subscriptions.

**Task 2 -- `src/hooks/useMetricState.ts`.** Signature is `useMetricState(value, updatedAt,
{ staleAfter, unavailable })`, matching the plan's explicit action text (122-09-PLAN.md's own
"exact export shape is Claude's discretion; the semantics are not" resolves to this 3-arg shape,
since RESEARCH.md's suggested shape and the plan's action both specify it). Precedence, highest
first: `unavailable` (caller-declared, always wins, including over `value === undefined`) >
`loading` (`value === undefined`) > `empty` (empty array / `null` / keyless object -- `0` is
explicitly excluded) > `stale` (age vs. `staleAfter`, which beats `DEFAULT_STALE_AFTER_MS`) >
`ready`. `updatedAt === undefined` can never produce `stale`. An implausible epoch (before 2001 in
ms terms) throws loudly rather than silently reading as "extremely stale" -- this repo has been
bitten before by an epoch-seconds figure reading as 1970, so a caller passing seconds instead of
milliseconds fails fast instead of producing a plausible-looking false positive. The hook is
structurally incapable of returning `"error"` -- no branch produces it, proven by a full
input-combination matrix test.

**Task 3 -- `src/components/EmptyState.tsx`.** Composes `GlassPanel`-shaped chrome (no state logic
of its own) with Task 1's table. Defines no copy string of its own for any state -- everything
comes from `METRIC_STATE_COPY`, with an optional `label` prop for a per-site override (D-20). A
`label`/`action`/`className`/`loadingShape` prop surface. `loading` routes to a content-shaped
skeleton (`loadingShape` defaults to `"panel"`: a label-width block plus a numeral-width block,
mirroring `MetricCard`'s own content shape per `122-13-PLAN.md`'s interfaces block) and never
renders the word "Loading". `error` renders the shared module's `error` copy plus its icon,
without throwing, and without automatically rendering `SectionErrorBoundary`'s always-present
"Retry" button -- the `action` slot only appears when a caller explicitly supplies one, which is
what keeps this from duplicating the boundary's fallback chrome (`SectionErrorBoundary.tsx:51-56`
was read to confirm the exact chrome being avoided).

## Contract Checked Against 122-13's Actual Needs

Read `122-13-PLAN.md` in full before designing the module (not just this plan's own text), per the
orchestrator's instruction. Cross-checked:
- `must_haves.artifacts` exports for all three files (`MetricState`/`METRIC_STATE_COPY`/
  `DEFAULT_STALE_AFTER_MS`; `useMetricState`; `EmptyState`) match exactly.
- `key_links` import patterns (`from "@/lib/metricState"`) match exactly.
- 122-13's loading-skeleton description ("a label-width block and a numeral-width block") matches
  `EmptyState`'s default `loadingShape="panel"` shape verbatim -- both primitives now share one
  skeleton vocabulary at their respective scales, not two independently-invented ones.
- `MetricCard` is documented as pure presentation that never calls `useMetricState` itself (its
  caller does); my hook's signature is therefore consumed by later sweep plans (122-14/15/16), not
  by 122-13 directly, and 122-13's own tasks do not exercise it -- no conflict found.
- `src/index.css` was read (read-only, per this plan's `shared_artifact_ownership` boundary) to
  confirm `--status-warn` and `--status-error` exist in every theme before using them as tone
  values; neither was invented.

## Deviations from Plan

None. All three tasks executed as specified. No architectural decisions required (Rule 4 never
triggered) and no bugs/missing functionality/blockers required Rules 1-3.

## Out-of-Scope Discovery (disclosed, not fixed)

`npx vitest run` (full suite) reports **1 failure unrelated to this plan**:
`src/lib/__tests__/eventIcons.test.ts > getEventColor > returns fallback color for unknown event
types`, asserting the literal `'text-gray-400'` against `getEventColor('unknown_event')`, which
now returns `'text-muted-foreground'`. Traced via `git log`/`git show`: commit `d29605ca`
("feat(122): sweep the two palette sites no plan owned", authored by a concurrent session,
timestamp 10:49:06 -- before this plan's Task 1 commit at 10:53:31) changed
`src/lib/eventIcons.ts:95` from `"text-gray-400"` to `"text-muted-foreground"` as part of a
cross-cutting palette sweep, and did not update its own test. `eventIcons.ts` and its test are not
in this plan's `files_modified`, were never touched by any of my three tasks, and the defect
predates my first commit -- out of scope per the deviation-rules SCOPE BOUNDARY ("only auto-fix
issues DIRECTLY caused by the current task's changes"). Not fixed. Flagged to the team lead via
SendMessage so the owning session (or the orchestrator) can land the one-line test fix.

## Verification

- `npx vitest run src/lib/metricState.test.ts` -- 10/10 passed
- `npx vitest run src/hooks/useMetricState.test.ts` -- 12/12 passed
- `npx vitest run src/components/EmptyState.test.tsx` -- 10/10 passed
- `npx tsc --noEmit` -- exit 0 (run after every task, including after each mutation/revert cycle)
- `npm run build` -- exit 0 (only a pre-existing chunk-size-warning, no errors)
- `npx vitest run` (full suite) -- **340 files (17 skipped) / 4803 passed / 1 failed / 197 todo**.
  The 1 failure is the pre-existing, out-of-scope `eventIcons.test.ts` case documented above --
  zero failures were introduced by this plan's three files.
- `git show --stat HEAD` inspected immediately after each of the three commits: each commit
  contains only its own two files (module + test), nothing swept in from a concurrent session.
- `.planning/STATE.md` / `.planning/ROADMAP.md` / `src/index.css`: `git status --short` clean for
  all three at the end of this run; none touched by this executor.

### Mutation Proofs (all four required, all run, all syntactically valid)

| # | File | Mutation | RED confirmed | Reverted GREEN |
|---|---|---|---|---|
| 1 | `metricState.ts` | `stale.tone` changed to hex literal `"#eab308"` | Yes -- 2 of 10 tests failed (`no hex literal` / `var(--token) only`), other 8 still ran (not a collection error) | Yes -- 10/10 |
| 2a | `useMetricState.ts` | Inverted precedence: `value === undefined` checked before `unavailable` | Yes -- 1 of 12 failed (`unavailable wins...`), other 11 still ran | Yes -- 12/12 |
| 2b | `useMetricState.ts` | `isEmptyValue` mutated so `value === 0` returns `true` | Yes -- 1 of 12 failed (`0 is NOT empty...`), other 11 still ran | Yes -- 12/12 |
| 3 | `EmptyState.tsx` | Inlined `"no signal yet"` as a literal fallback for `state === "empty"`, bypassing the module | Yes -- 1 of 10 failed (centralisation test), other 9 still ran | Yes -- 10/10 |

Every mutation left its file syntactically valid (confirmed by the other tests in the same file
continuing to execute and pass alongside the expected failure -- a parse/collection error would
have failed the whole file, not one named test).

## Self-Check

- `src/lib/metricState.ts` -- FOUND
- `src/lib/metricState.test.ts` -- FOUND
- `src/hooks/useMetricState.ts` -- FOUND
- `src/hooks/useMetricState.test.ts` -- FOUND
- `src/components/EmptyState.tsx` -- FOUND
- `src/components/EmptyState.test.tsx` -- FOUND
- Commit `42d6dc12` (Task 1) -- FOUND in `git log --oneline`
- Commit `d27a0c65` (Task 2) -- FOUND in `git log --oneline`
- Commit `454f8584` (Task 3) -- FOUND in `git log --oneline`

## Self-Check: PASSED

## Key Files

- `src/lib/metricState.ts` -- new, 122 lines. `MetricState`, `METRIC_STATE_COPY`,
  `DEFAULT_STALE_AFTER_MS`.
- `src/lib/metricState.test.ts` -- new, 79 lines.
- `src/hooks/useMetricState.ts` -- new, 137 lines. `useMetricState`.
- `src/hooks/useMetricState.test.ts` -- new, 97 lines.
- `src/components/EmptyState.tsx` -- new, 105 lines. `EmptyState`.
- `src/components/EmptyState.test.tsx` -- new, 91 lines.

## Metrics

- Duration: this session
- Tasks: 3/3 auto tasks completed, no checkpoints
- Commits: 3 (`42d6dc12`, `d27a0c65`, `454f8584`)
- Files touched: 6, all new (three module/test pairs)
- Tests added: 32 (10 + 12 + 10)
