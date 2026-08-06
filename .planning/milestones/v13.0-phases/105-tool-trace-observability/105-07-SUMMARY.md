---
phase: 105-tool-trace-observability
plan: 07
subsystem: ui
tags: [react, convex-hooks, toolPolicyEvents, OBS-02, honest-empty-state]

# Dependency graph
requires:
  - phase: 105-03
    provides: "toolPolicyEvents table + recent/lastReceivedAt/countsByKind queries this plan's hooks read"
  - phase: 105-04
    provides: "convex/toolPolicyAlertEval.ts's ALERTING_POLICY_KINDS constant, imported directly so the badge and the evaluator can never disagree about which kinds alert"
provides:
  - "src/hooks/useToolPolicyEvents.ts — useToolPolicyEvents/useToolPolicyCounts (useQuery ?? DEFAULT), useToolPolicyLastReceived (deliberately undefaulted, D-07), policyKindPresentation (the locked four-kind label/token/alerts map), POLICY_KIND_ORDER"
  - "src/components/ToolPolicyFeed.tsx — the OBS-02 policy/leak feed: four-kind badges, Bell alert markers, D-07 last-received line in both states, D-08 expandable detail, D-12 truncation banner — not yet mounted on any page"
affects: [105-08, 105-09]

tech-stack:
  added: []
  patterns:
    - "alerts flag derived from convex/toolPolicyAlertEval.ts's own ALERTING_POLICY_KINDS constant (imported directly into a frontend hook), not re-typed — proven by a set-equality test so the badge and the evaluator can never drift apart"
    - "D-07 loading/never/timestamp three-state hook (useToolPolicyLastReceived) deliberately NOT defaulted, matching useCostBudget's precedent — the empty-state body independently mirrors the same three states rather than assuming loading==empty like the feed hook does"

key-files:
  created:
    - src/hooks/useToolPolicyEvents.ts
    - src/components/ToolPolicyFeed.tsx
    - src/components/ToolPolicyFeed.test.tsx

key-decisions:
  - "Empty-state body honesty fix (Rule 1, caught by the plan's own required loading-state test before commit): the first draft rendered the UI-SPEC's literal 'has never received' copy in the empty state unconditionally whenever feed.rows was empty — including while useToolPolicyLastReceived was still loading (undefined), which is a false claim (the feed might not be empty at all once the query resolves). Replaced with emptyStateBody(), a three-state function matching lastReceivedLine()'s own three states: loading says 'Checking...', a genuine null says 'never received', and a real timestamp with zero currently-filtered rows says 'no policy events match the current filter' rather than falsely claiming the feed has never received anything."
  - "Two comment-trips-own-grep fixes, same class every prior Phase 105 plan (105-01 through 105-06) independently hit: useToolPolicyEvents.ts's doc comment used the literal text '?? DEFAULT' in prose, tripping its own acceptance grep (3 instead of the required 2); ToolPolicyFeed.tsx's doc comment named 'SectionErrorBoundary' to explain why one is absent, tripping the zero-count grep. Both reworded to the same meaning without the literal substring."
  - "The second mutation-check regression test (execution_denied vs malformed_policy_boot) was itself vacuous against the required mutation (execution_denied's token regressed to --status-warn): boot stays --status-error either way, so a boot-vs-denied comparison still passes under that mutation. Replaced with a denied-vs-leaked-as-text comparison — the actual colliding pair, since both are the two view-only (non-alerting) kinds and tool_call_leaked_as_text already uses --status-warn. Re-verified this second test also fails under the mutation before restoring."

requirements-completed: []  # OBS-02 NOT marked complete — this is plan 7/9 (Wave 4, read path + component only). The component is not yet mounted on any page (105-08's scope, finding F5) and nothing has been deployed to the live self-hosted Convex instance, so per this project's established "green suite/single-plan != live-verified end-to-end" convention, full requirement satisfaction awaits 105-09's live confirmation against real induced policy events.

duration: ~16min (commit-to-commit; prior plan's metadata commit 20:58:51 to this plan's first task commit 21:14:09)
completed: 2026-08-03
---

# Phase 105 Plan 07: ToolPolicyFeed — OBS-02 Policy/Leak Feed Summary

**Self-contained `ToolPolicyFeed` component reading the `toolPolicyEvents` table 105-03 opened: the four-kind badge/label/alert mapping derived from the evaluator's own `ALERTING_POLICY_KINDS` constant (never re-typed), a D-07 last-received line honest across three states in both the populated and empty views, and a D-08 expandable detail block that never collapses `toolWasOffered`/`toolsOfferedCount`'s three real states down to two — not yet mounted on any page (105-08's scope).**

## Performance

- **Duration:** ~16 min (commit-to-commit, see frontmatter)
- **Tasks:** 3 (Tasks 1 and 3 `tdd="true"`)
- **Files modified:** 3 (all created)

## Accomplishments

- `src/hooks/useToolPolicyEvents.ts`: `useToolPolicyEvents`/`useToolPolicyCounts` follow the `useQuery(...) ?? DEFAULT` convention (`useCostDerived.ts`'s precedent); `useToolPolicyLastReceived` deliberately returns the raw query result, undefaulted — matching `useCostBudget`'s precedent so "still loading" (`undefined`) never collapses into "never received" (`{ timestamp: null }`)
- `policyKindPresentation(kind)` implements the UI-SPEC's locked four-kind label/token map (`malformed_policy_boot` → `--status-error`, `malformed_policy_reload_rejected` → `--status-warn`, `tool_call_leaked_as_text` → `--status-warn`, `execution_denied` → `--status-info`, neutral by design per D-06) and derives its `alerts` flag from `ALERTING_POLICY_KINDS`, imported directly from `convex/toolPolicyAlertEval.ts` rather than re-typed — proven by a set-equality test so the badge can never disagree with the evaluator about which kinds fire an alert. An unrecognised kind renders its raw string verbatim with a neutral token and `alerts: false`, never hidden and never guessed into one of the four known kinds.
- `src/components/ToolPolicyFeed.tsx`: self-contained, no required props. Kind-filter pills (`All kinds` + one per `POLICY_KIND_ORDER` entry, each showing its `countsByKind` count; a zero-count kind renders disabled with its zero still visible, never hidden); D-12 truncation banner; row list (`ScrollArea`, click-to-expand) showing the kind `Badge` (color/label from `policyKindPresentation`, token-driven via inline `style`, never hex), the offending tool name in `font-mono` when present, a Lucide `Bell` + `InfoTooltip` on the two alerting kinds only, and the relative timestamp; D-08 expandable detail rendering only the fields a row actually carries (leak rows: `Tool was offered` Yes/No/Unknown, `Tools offered` count/`No tool filter active`/`0`, `Round`, `Agent`, `Task category`, `Session`; `execution_denied`: `Tool`, `Session`; the two malformed kinds: `Field`, `Error` in a `whitespace-pre-wrap break-all` block); the UI-SPEC page-level disclaimer verbatim
- D-07 last-received line rendered in BOTH the populated and empty states, three distinct on-screen states (loading → "Checking…", never received → the honest sentence, a real timestamp → a relative-time sentence) — `timestamp` asserted as UNIX seconds via a dedicated test (the `1a136dc8` seconds-as-ms defect class), not assumed
- 18 new tests across `ToolPolicyFeed.test.tsx` covering every `<behavior>` bullet plus the pure-map/set-equality assertions from Task 1; full suite 3383/3383 passing (up from 3365); `tsc --noEmit` and `npm run build` both clean throughout

## Task Commits

Each task was committed atomically:

1. **Task 1: Hooks + the exported pure kind-presentation map** — `f525fca1` (feat)
2. **Task 2: ToolPolicyFeed component** — `b70b001b` (feat)
3. **Task 3: ToolPolicyFeed tests — honesty of emptiness and of the three-state fields** — `7a535988` (test)

## Files Created/Modified

- `src/hooks/useToolPolicyEvents.ts` — NEW. `useToolPolicyEvents`, `useToolPolicyCounts`, `useToolPolicyLastReceived` (undefaulted), `policyKindPresentation`, `POLICY_KIND_ORDER`, `DEFAULT_FEED`/`DEFAULT_COUNTS` exported for tests
- `src/components/ToolPolicyFeed.tsx` — NEW. Default-export self-contained panel; local `PillButton` copy (per plan instruction, not a refactor of `ToolExecutionPanel.tsx`); `lastReceivedLine`/`emptyStateBody`/`relativeTimeMagnitude`/`RowDetail`/`DetailRow` module-local helpers
- `src/components/ToolPolicyFeed.test.tsx` — NEW. 18 tests: empty-is-not-healthy control, loading-vs-never-vs-timestamp, the seconds-unit guard, colour-distinction (+ a dedicated regression guard on the actually-colliding pair), Bell-count-exactly-2, `toolWasOffered`/`toolsOfferedCount` three-state, malformed-row Field/Error-no-Tool, unknown-kind-verbatim, disclaimer, truncation banner (present/absent), plus 4 `policyKindPresentation` pure-map tests including the `ALERTING_POLICY_KINDS` set-equality assertion

## Decisions Made

See the `key-decisions` list in the frontmatter for full text (the empty-state honesty fix caught by the plan's own required loading-state test, two comment-trips-own-grep fixes matching every prior Phase 105 plan's independently-hit class, and the mutation-regression-test correction after the first version of that test proved vacuous against the actual required mutation).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Empty-state body unconditionally claimed "never received" even while `lastReceivedAt` was still loading**
- **Found during:** Task 3, running the required behavior test "With lastReceivedAt returning undefined (loading), the never-received sentence does NOT render and the loading placeholder does" — TDD RED before any fix, not a shipped defect.
- **Issue:** The Task 2 draft rendered the UI-SPEC's literal empty-state copy ("CodePulse has never received a tool-policy event...") unconditionally whenever `feed.rows.length === 0` — including during the initial render, before `useToolPolicyLastReceived()`'s query had resolved. Since `useToolPolicyEvents` collapses its own loading state to an empty `rows: []` (by design, Task 1's own instruction — "a shape every consumer can render unconditionally"), the empty state would fire immediately on mount and falsely claim "never received" even if the feed turned out to have events a moment later.
- **Fix:** Replaced the fixed body string with `emptyStateBody(result)`, a three-state function mirroring `lastReceivedLine()`'s own states: `undefined` → a neutral "Checking whether CodePulse has received any tool-policy events…" placeholder; `{ timestamp: null }` → the UI-SPEC's literal "never received" sentence; a real timestamp with a currently-empty (e.g. kind-filtered) row list → "No policy events match the current filter. Last policy event received {relative} ago." — a different, still-honest claim, since a real timestamp existing elsewhere in the table does not mean the current view has never received anything.
- **Files modified:** `src/components/ToolPolicyFeed.tsx`
- **Verification:** The failing test passed after the fix; re-ran the full 18-test file green.
- **Committed in:** `b70b001b`/`7a535988` (the component fix landed in the Task 2 commit before Task 3's test commit, since the test caught it during Task 3's own TDD RED-then-GREEN cycle before either was committed)

**2. [Rule 1 - Bug] Two comments independently tripped their own acceptance-criteria greps**
- **Found during:** Tasks 1 and 2, running the acceptance-criteria greps before each commit
- **Issue:** `useToolPolicyEvents.ts`'s file-header doc comment used the literal substring `?? DEFAULT` in prose, making `grep -c "?? DEFAULT"` return 3 instead of the required 2 (the two real hook return-statement usages). `ToolPolicyFeed.tsx`'s doc comment named `SectionErrorBoundary` to explain why the component deliberately doesn't wrap in one (finding F6), tripping the zero-count grep. Same class of fix every prior plan in this phase (105-01 through 105-06) independently hit.
- **Fix:** Reworded both comments to the same meaning without repeating the literal substring ("useQuery-with-a-fallback-default wrapper convention"; "owns the page-level error-boundary wrap").
- **Files modified:** `src/hooks/useToolPolicyEvents.ts`, `src/components/ToolPolicyFeed.tsx`
- **Verification:** Both greps re-run, correct counts confirmed before commit.
- **Committed in:** `f525fca1`, `b70b001b`

**3. [Rule 1 - Bug] The second mutation-regression test was vacuous against the actual required mutation**
- **Found during:** Task 3, performing the required mutation proof (regressing `execution_denied`'s token to `--status-warn`)
- **Issue:** A secondary "regression guard" test compared `malformed_policy_boot`'s badge colour against `execution_denied`'s. Under the required mutation, `execution_denied` becomes `--status-warn` while `malformed_policy_boot` stays `--status-error` — the two remain different from each other, so this test would have stayed green under the exact mutation it was meant to catch, silently proving nothing.
- **Fix:** Replaced the comparison pair with `tool_call_leaked_as_text` vs `execution_denied` — the pair that genuinely collides under this mutation, since both are the two view-only (non-alerting) kinds and `tool_call_leaked_as_text` already uses `--status-warn`. Re-ran the mutation and confirmed this corrected test now fails as required, before restoring.
- **Files modified:** `src/components/ToolPolicyFeed.test.tsx`
- **Verification:** Under the live mutation, both the primary exact-token test and the corrected regression-guard test failed; restored, both pass.
- **Committed in:** `7a535988`

---

**Total deviations:** 3 auto-fixed, all Rule 1 — one a genuine D-07 honesty bug caught by the plan's own required TDD test before any commit (not a shipped defect), two the now-familiar comment-trips-own-grep collision class, and one a test-quality fix discovered while performing the plan's own mandated mutation-verification step. No production-behavior deviations from the plan's specified approach otherwise.

## Mutation Verification (required proof)

Both required mutation proofs were performed — production code temporarily broken, confirmed the corresponding test(s) FAIL, then restored via a scratchpad byte-identical diff (confirmed via `diff`, no output) before re-running:

| Mutation | Target | Result |
|---|---|---|
| **Required proof 1:** `RowDetail`'s `Tool was offered` value collapsed from the three-state `row.toolWasOffered === undefined ? "Unknown" : row.toolWasOffered ? "Yes" : "No"` to the two-state `row.toolWasOffered ? "Yes" : "No"` (`src/components/ToolPolicyFeed.tsx`) | "expanding a leak row with toolWasOffered undefined renders 'Unknown', never 'No'" | FAILED as required — `getByText("Unknown")` found no element (both the primary test and its dedicated mutation-check companion) |
| **Required proof 2:** `execution_denied`'s token in `KIND_LABEL_AND_TOKEN` regressed from `var(--status-info)` to `var(--status-warn)` (`src/hooks/useToolPolicyEvents.ts`) | "execution_denied and malformed_policy_boot badges render with different colour tokens" | FAILED as required — `expected 'var(--status-warn)' to be 'var(--status-info)'`. The FIRST version of the dedicated regression-guard test (boot vs denied) did NOT fail under this mutation (see Deviation #3) — corrected to compare denied vs `tool_call_leaked_as_text`, which DID fail as required (`expected 'var(--status-warn)' not to be 'var(--status-warn)'`) |

Both restores confirmed byte-identical via `diff` against a scratchpad backup before re-running the full targeted test file (18/18 green) and the full suite.

## Issues Encountered

None beyond the three documented deviations above (one a real D-07 honesty bug caught by the plan's own mandated TDD/mutation discipline before it ever reached a commit, two the now-familiar comment/grep collision class, one a test-quality correction).

## Timestamp Unit (verification-discipline requirement)

`toolPolicyEvents.timestamp` is UNIX SECONDS (confirmed against `convex/toolPolicyEvents.ts`'s `record` validator: `timestamp: v.float64()`, populated from `runtimeIngest.ts`'s second-based clock, matching every other table in this codebase's convention). `relativeTimeMagnitude` in `ToolPolicyFeed.tsx` divides `Date.now() / 1000 - tsSeconds` — never `Date.now() - ts` — and this is asserted, not assumed, by a dedicated test: a fixture timestamp exactly 2 hours in the past (in seconds) renders `"Last policy event received 2h ago."`, with a companion negative assertion (`queryByText(/\d{4,}d ago/)`) proving it does NOT render as the `1a136dc8`-class tens-of-thousands-of-days defect a seconds-as-milliseconds bug would produce.

## User Setup Required

None — no external service configuration required. This plan touched no Convex schema, query, or mutation (`convex/toolPolicyEvents.ts` and `convex/toolPolicyAlertEval.ts` were both read-only dependencies, unmodified), so no `npx convex codegen` or `npx convex deploy` was needed or run. **Nothing deployed** — this is a frontend-only plan; the component is not yet mounted on any page or route.

## Verification (raw output)

`npx tsc --noEmit` — clean, zero output, exit 0 (checked after every task).

`npx vitest run src/components/ToolPolicyFeed.test.tsx`:
```
 Test Files  1 passed (1)
      Tests  18 passed (18)
```

`npx vitest run` (full suite):
```
Test Files  270 passed | 17 skipped (287)
     Tests  3383 passed | 193 todo (3576)
```
(up from 3365 pre-plan; the "Not implemented: HTMLCanvasElement's getContext()" lines are pre-existing jsdom/canvas noise from unrelated WebGL-mocked test files — 0 failed tests.)

`npm run build` — succeeded (`✓ built in 1.25s`); pre-existing >500kB chunk-size warning, unrelated to this plan.

Targeted acceptance-criteria greps (all passed, final state):
- `grep -c "ALERTING_POLICY_KINDS" src/hooks/useToolPolicyEvents.ts` → `3` (≥ 1 required)
- `grep -c "?? DEFAULT" src/hooks/useToolPolicyEvents.ts` → `2` (exactly, not 3)
- `grep -Ei '#[0-9a-f]{3,8}' src/hooks/useToolPolicyEvents.ts` → zero matches
- `grep -Ei '#[0-9a-f]{3,8}' src/components/ToolPolicyFeed.tsx | grep -v '^\s*//'` → zero matches
- `grep -c "dangerouslySetInnerHTML" src/components/ToolPolicyFeed.tsx` → `0`
- `grep -c "SectionErrorBoundary" src/components/ToolPolicyFeed.tsx` → `0`
- `grep -c "never disables a tool, changes policy, or blocks a call" src/components/ToolPolicyFeed.tsx` → `1`
- `grep -c "has never received a tool-policy event" src/components/ToolPolicyFeed.tsx` → `2` (≥ 1 required)
- `grep -c "No tool filter active" src/components/ToolPolicyFeed.tsx` → `1`
- `grep -c "Unknown" src/components/ToolPolicyFeed.tsx` → `1` (≥ 1 required)
- `git diff --stat package.json package-lock.json` → empty (T-105-SC: zero packages installed)
- `git status --short` before commits → exactly the 3 declared files, all untracked/new; no `src/pages/`, `src/App.tsx`, or `src/lib/navRegistry.ts` (finding F5)

## Known Stubs

None. `ToolPolicyFeed` is fully wired to live Convex queries via `useToolPolicyEvents.ts` — no hardcoded/mock data anywhere. It is simply not yet reachable from any route (105-08's scope, by design — finding F5).

## Threat Flags

None beyond what the plan's own `<threat_model>` already registers (T-105-31 through T-105-35, T-105-SC) — this plan introduced no new trust boundary, endpoint, or schema change beyond the three read-only queries the threat model already names. T-105-31 (XSS via `tool`/`error`/`field`/`agentId`) verified: plain JSX interpolation only, `dangerouslySetInnerHTML` grep-asserted to zero, `error` rendered in a `whitespace-pre-wrap break-all` block. T-105-35 (badge falsely claiming an alert) verified: the `alerts` flag derives from `ALERTING_POLICY_KINDS` imported directly, asserted by a set-equality test.

## Not Verified Here (deferred to plan 105-09)

Per this plan's own `<verification>` section: a REAL induced policy event of each kind landing and rendering against the live self-hosted Convex instance is explicitly deferred to plan 105-09 (`105-VALIDATION.md` § Manual-Only, row 1). This plan's 18 green component tests prove rendering correctness against mocked query results, not live delivery through the deployed ingest pipe. `toolPolicyEvents` and `toolPolicyAlertEval` (both dependencies of this plan) remain undeployed to the live instance as of this plan's completion, per 105-03/105-04's own SUMMARY.md "Nothing deployed" notes.

## Next Phase Readiness

- Plan 105-08 can mount `ToolPolicyFeed` on the new Tools page (alongside `ToolUsagePanel` from 105-06) and wrap it in a page-level error boundary (D-16) — the component takes no required props and is self-contained.
- Plan 105-09 owns deployment and live verification: the last-received honesty (D-07), the four-kind colour mapping against real induced events, the Bell/alert-routing round-trip, and the D-08 detail fields against genuine leak-payload data (including a genuinely pre-105-02 row, if one exists, to exercise the `toolWasOffered: undefined` path against real data rather than a fixture) are all explicitly deferred there.
- No blockers for 105-08.

---
*Phase: 105-tool-trace-observability*
*Completed: 2026-08-03*

## Self-Check: PASSED

All 3 key files confirmed present on disk (`src/hooks/useToolPolicyEvents.ts`,
`src/components/ToolPolicyFeed.tsx`, `src/components/ToolPolicyFeed.test.tsx`);
all 3 task commit hashes (`f525fca1`, `b70b001b`, `7a535988`) confirmed present
in `git log`.
