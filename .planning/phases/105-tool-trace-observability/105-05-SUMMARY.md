---
phase: 105-tool-trace-observability
plan: 05
subsystem: ui
tags: [react, convex, trace-waterfall, collapsible, cache-ratio, tool-nesting]

# Dependency graph
requires:
  - phase: 105-01
    provides: "bounded { rows, truncated, cap } reads on llm.sessionCalls / toolExecutions.listBySession, plus the existing D-12 truncation banner this plan extends"
  - phase: 105-03
    provides: "traceId/round join columns on both llmMetrics and toolExecutions, end to end from ingest through storage"
provides:
  - "groupCacheRatio(rows) — the per-turn cache-ratio helper, provably identical to computeSummary's session-wide formula (D-11)"
  - "groupRoundsForTrace(group, toolRows) — partitions a trace group's LLM rows + session tool rows into per-round buckets, honoring D-10's reported-not-inferred attribution"
  - "toolBarMetrics(row) — seconds-domain bar geometry for tool executions, honest hasDuration:false when durationMs is unreported"
  - "Second Collapsible level (round) nested inside each trace group's turn Collapsible, with tool bars rendered after that round's LLM call bars"
  - "TraceToolRow — the tool-execution bar/tooltip component"
  - "Combined dual-feeder truncation banner naming which side(s) capped"
affects: [105-06, 105-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Second nesting level attaches to the ROUND, not the individual LLM call — a round can hold >1 llm_call row (retry/advisor pass), and attaching tool rows to one specific call inside a multi-call round would be an inference D-10 forbids"
    - "useQuery(...) ?? [] default for a supplementary feeder — an undefined tool-executions result never blocks the LLM lane from rendering (T-105-22/23)"
    - "Mock-dispatch-by-query-identifier for multi-query component tests (mockUseQueryDispatch), replacing a single mockReturnValue that cannot express two independently-loading/truncated feeds"

key-files:
  created: []
  modified:
    - src/components/TraceWaterfall.tsx
    - src/components/TraceWaterfall.test.tsx

key-decisions:
  - "F1 (round vs. call): the second Collapsible level is the ROUND, not an individual LLM call, per the plan's own finding — D-09's literal wording (\"LLM call → tool executions\") is satisfied in the overwhelmingly common single-call-per-round case, but the reported join key is (traceId, round) and a round can legitimately hold more than one llm_call row. Attaching tool rows to ONE specific call inside a multi-call round would be exactly the inference D-10 forbids (\"a wrong parent renders exactly as confidently as a right one with nothing on screen to signal doubt\"). Documented in a code comment on groupRoundsForTrace citing D-09/D-10/F1 so a later reader does not \"fix\" this back into a per-call attachment."
  - "F2 (three structurally distinct cases, none fabricated): rows carrying round -> grouped into round sub-sections; LLM rows in a group with no round -> rendered flat, no synthetic \"Round 1\"; tool rows with no traceId, a traceId matching no group, or a traceId-but-no-round -> each an explicitly labelled block, never silently dropped and never attached to a guess. All three implemented and each has a dedicated test."
  - "groupRoundsForTrace scopes unattributedToolRows to the CALLING group only: a tool row whose traceId does not match the group at all is silently skipped by this function (continue), not added to unattributedToolRows. It is some other group's concern, or the component-level \"Untraced tool calls\" bucket's — including it here would double-count or mis-scope it. Verified by a dedicated unit test."
  - "A round with zero LLM rows (only tool rows, e.g. traceId/round matched but no llm_call reported that round) gets an honest header — \"Round {n} · {k} tool call(s)\" — rather than crashing on round.llmRows[0]. Not explicitly required by the plan's behavior bullets, but a direct consequence of D-10's own honesty rule applied to an edge case the plan didn't spell out; documented here as a Rule-2 completeness addition (a real reported shape, not fabricated)."
  - "Rule 1 fix: a doc comment on ToolExecRow originally repeated the literal string \"toolExecutions.listBySession\", tripping this task's own acceptance-criteria grep (same class of defect 105-01/02/03 each independently hit). Reworded to prose without the literal substring; re-grepped to confirm count 1."
  - "The plan's own acceptance grep for the nested-Collapsible criterion (`grep -c \"<Collapsible\"` expected to return 2) is unsatisfiable as literally written: CollapsibleTrigger and CollapsibleContent both begin with the substring \"<Collapsible\", so 2 real `<Collapsible ...>` root tags plus their paired Trigger/Content children produce 6 matching lines, not 2. Verified the INTENT instead with a precise negative-lookahead grep (`grep -oP \"<Collapsible(?!Trigger|Content)\"`), which returns exactly 2 — confirmed by direct inspection at the two literal `<Collapsible` opening tags (outer trace group, nested round). Not a code defect; a plan-drafted grep pattern collision, same category as the comment-trips-own-grep class."

requirements-completed: []  # OBS-03 NOT marked complete here — Wave 3 of 5 for this requirement's own phase-wide "green suite != live-verified" convention (matching 105-01/03/04's precedent). The plan's own <output> section explicitly defers the real-trace-size legibility check and the truncation-notice-on-a-genuinely-capped-session check to plan 105-09.

# Metrics
duration: 15min
completed: 2026-08-03
---

# Phase 105 Plan 05: Trace Waterfall — Round Nesting, Per-Turn Cache Ratio, Tool Bars Summary

**`TraceWaterfall` now renders tool executions nested one level under the LLM round that ran them (never guessed onto a call when Ástríðr didn't report the round), a per-turn cache-ratio suffix on each turn header proven identical to the session-wide formula, and one combined truncation banner naming whichever of the two feeder queries hit its read cap.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-03T20:19:00Z (approx, first file read)
- **Completed:** 2026-08-03T20:31:15Z
- **Tasks:** 3 (Tasks 1 and 3 `tdd="true"`, Task 2 `type="auto"`)
- **Files modified:** 2 (both modified, no new files)

## Accomplishments

- Three new exported pure helpers in `TraceWaterfall.tsx`: `groupCacheRatio` (D-11, mutation-verified identical to `computeSummary`'s denominator), `groupRoundsForTrace` (D-09/D-10, round-scoped nesting with explicit `typeof === "number"` guards so round 0 survives), and `toolBarMetrics` (seconds-domain bar geometry mirroring `barMetrics`, honest `hasDuration:false` for unmeasured tool calls)
- A second `useQuery(api.toolExecutions.listBySession, ...)` feeder that never blocks the LLM lane while loading (T-105-22/23)
- A second, nested `Collapsible` level per round inside each trace group: single-call rounds show `Round {n} · {model} · {cost}`, multi-call rounds honestly show `Round {n} · {k} calls · {cost}` rather than picking one call to attach to (finding F1)
- Three honestly-labelled edge cases, none silently dropped: legacy LLM rows with no `round` render flat (no synthetic round header); tool rows whose `traceId` matched but `round` didn't render under "Tool calls with no reported round · {n}"; tool rows matching no rendered trace group at all render under "Untraced tool calls · {n}" at the bottom of the component
- New `TraceToolRow` bar component: `var(--chart-2)` for success, `var(--status-error)` for failure, `"duration n/a"` (never a fabricated `"0ms"`) when `durationMs` is unreported
- Turn header now ends with `· {n}% cached` via `groupCacheRatio(group.rows)` (D-11)
- The existing D-12 truncation banner now covers both feeders in one element, naming which side(s) capped — never a fabricated total
- Test mock scaffold upgraded from a single `mockReturnValue` to a dispatcher keyed by query identifier (finding F5), migrating all 35 pre-existing assertions with zero test cases removed, plus 10 new rendering tests including a scoped (`within()`) attribution-honesty negative assertion
- Every new/changed test mutation-verified: dropping `cacheCreationSum` from `groupCacheRatio`'s denominator fails 2 of 3 parity tests; making `groupRoundsForTrace` fall back to the group's highest round for an unrounded tool row (the exact D-10-forbidden inference) fails the attribution-honesty control test

## Task Commits

Each task was committed atomically:

1. **Task 1: Pure helpers — groupCacheRatio, round grouping, and tool bar geometry** - `e9cb561f` (feat)
2. **Task 2: Render the second Collapsible level, tool bars, cache ratio and the combined truncation notice** - `3442fe88` (feat)
3. **Task 3: Component tests — nesting, attribution honesty, and dual truncation** - `df1f4427` (test)

## Files Created/Modified

- `src/components/TraceWaterfall.tsx` — `ToolExecRow`/`TraceRound` types; `groupCacheRatio`/`groupRoundsForTrace`/`toolBarMetrics` exported pure helpers; second `toolExecutions.listBySession` query; nested per-round `Collapsible`; `TraceRoundSection` and `TraceToolRow` components; combined truncation banner; `LlmCallRow` gained `round?: number` (105-03 schema field not yet reflected on this frontend type)
- `src/components/TraceWaterfall.test.tsx` — `makeToolRow`/`makeGroup` fixtures; `mockUseQueryDispatch` dispatcher (all 35 pre-existing tests migrated); 13 new pure-helper tests (Task 1); 10 new rendering tests (Task 3) — 45 total, up from 22

## Decisions Made

See the `key-decisions` list in the frontmatter for the full text of each decision (F1 round-vs-call, F2 three-case honesty, the unattributedToolRows scoping rule, the zero-LLM-row round edge case, and the two Rule-1/grep-collision fixes).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Doc comment tripped its own acceptance-criteria grep**
- **Found during:** Task 2, running the acceptance-criteria greps before commit
- **Issue:** `ToolExecRow`'s doc comment repeated the literal string `toolExecutions.listBySession` in prose, making `grep -c "toolExecutions.listBySession" src/components/TraceWaterfall.tsx` return 2 instead of the required 1 (the doc comment plus the real `useQuery` call site).
- **Fix:** Reworded to "the tool-executions list-by-session query" — same meaning, no literal substring collision.
- **Files modified:** src/components/TraceWaterfall.tsx
- **Verification:** Re-ran the grep, returns 1.
- **Committed in:** `3442fe88`

**2. [Rule 2 - Missing Critical] Honest header for a round with zero LLM rows**
- **Found during:** Task 2, while designing `TraceRoundSection`'s header label
- **Issue:** The plan's action text only specified the single-call and multi-call LLM header cases (`round.llmRows[0]` / `round.llmRows.length`). A round created purely from a tool row's reported `(traceId, round)` with no matching `llm_call` row in that trace (a real, reportable shape — e.g. a round where the LLM call landed in a different trace bucket) would crash on `round.llmRows[0].model` being undefined.
- **Fix:** Added an explicit `llmCount === 0` branch rendering `"Round {n} · {k} tool call(s)"` instead.
- **Files modified:** src/components/TraceWaterfall.tsx
- **Verification:** `npx tsc --noEmit` clean (no `possibly undefined` on `round.llmRows[0]`); code path exercised implicitly by every existing round-rendering test (none currently construct this specific zero-LLM-row shape, since it did not arise in the plan's own test fixtures — flagged here for future coverage, not fabricated).
- **Committed in:** `3442fe88`

---

**Total deviations:** 2 auto-fixed (1 Rule 1 — comment/grep collision, same class 105-01/02/03 each independently hit; 1 Rule 2 — a genuine edge-case crash guard for a real reportable data shape the plan's action text didn't spell out).
**Impact on plan:** Both fixes were necessary for correctness. Neither changes the plan's approach or introduces new scope.

## Issues Encountered

- The plan's own acceptance criterion `grep -c "<Collapsible" src/components/TraceWaterfall.tsx` returns 2 (outer group + nested round)` cannot be literally satisfied: `CollapsibleTrigger`/`CollapsibleContent` both begin with the substring `<Collapsible`, so with 2 real `<Collapsible ...>` root tags the naive grep matches 6 lines (2 roots + 2×2 Trigger/Content pairs), not 2. This is a plan-authored grep-pattern defect, not a code defect — verified the actual intent with `grep -oP "<Collapsible(?!Trigger|Content)"`, which correctly returns 2, and confirmed by direct line inspection (lines 473 and 583 at time of writing). No code change made; documented here per the "plan is a draft" instruction rather than silently treating the literal grep as authoritative.

## User Setup Required

None — no external service configuration required. This plan touches only two frontend files (a React component and its test file); no new environment variables, no deploy needed for the unit-test verification performed here.

## Verification (raw output)

`npx tsc --noEmit` — clean, zero output, exit 0.

`npx vitest run src/components/TraceWaterfall.test.tsx`:
```
Test Files  1 passed (1)
     Tests  45 passed (45)
```

`npx vitest run` (full suite):
```
Test Files  267 passed | 17 skipped (284)
     Tests  3328 passed | 193 todo (3521)
```
(up from 3305 passing pre-105-05, per 105-04-SUMMARY.md; the "Not implemented: HTMLCanvasElement's getContext()" lines are pre-existing jsdom/canvas noise from unrelated WebGL-mocked test files, not a failure.)

`npm run build` — succeeded (`✓ built in 1.24s`); pre-existing >500kB chunk-size warning, unrelated to this plan.

Targeted acceptance-criteria greps (all passed, final state):
- `grep -c "^export function groupCacheRatio" src/components/TraceWaterfall.tsx` → `1`
- `grep -c "^export function groupRoundsForTrace" src/components/TraceWaterfall.tsx` → `1`
- `grep -c 'typeof .* === "number"' src/components/TraceWaterfall.tsx` → `9` (≥2 required)
- `grep -c "toolExecutions.listBySession" src/components/TraceWaterfall.tsx` → `1`
- `grep -c "groupCacheRatio(group.rows)" src/components/TraceWaterfall.tsx` → `1`
- `grep -oP "<Collapsible(?!Trigger|Content)"` → 2 matches (see Issues Encountered re: the literal-grep collision)
- `grep -Ei '#[0-9a-f]{3,8}' src/components/TraceWaterfall.tsx | grep -v '^\s*//'` → zero matches (no hardcoded hex)
- `grep -c "no reported round" src/components/TraceWaterfall.tsx` → `1`
- `grep -c "dangerouslySetInnerHTML" src/components/TraceWaterfall.tsx` → `0`
- `git diff --stat src/pages/SessionDetail.tsx` → no output (untouched, finding F7)
- `git diff --stat` (whole plan, e9cb561f~1..HEAD) → exactly `src/components/TraceWaterfall.tsx` and `src/components/TraceWaterfall.test.tsx`
- `git diff src/components/TraceWaterfall.test.tsx | grep -c "^-.*it("` → `0` (zero pre-existing tests removed)

## Mutation Verification (per the plan's own mandate)

Every new/changed test was mutation-verified — production code temporarily broken, confirmed the corresponding test FAILS, then restored and re-confirmed byte-identical via `git diff --stat`:

1. **Task 1's required proof:** `groupCacheRatio`'s denominator mutated to drop `cacheCreationSum` (`cacheReadSum + promptTokenSum` instead of `cacheReadSum + cacheCreationSum + promptTokenSum`) → 2 of the 3 "DENOMINATOR PARITY" tests FAILED as expected (`expected 0.75 to be close to 0.3`, `expected 0.0714... to be close to 0.0689...`); the third fixture's `cacheCreationInputTokens: 0` made it insensitive to this specific mutation by construction, which is itself expected, not a gap. Restored via `git checkout -- src/components/TraceWaterfall.tsx`; re-ran full test file, 35/35 green.
2. **Task 3's required proof (attribution-honesty control):** `groupRoundsForTrace`'s tool-row loop mutated to fall back to `Math.max(...roundsMap.keys(), 0)` (the group's highest round so far) whenever a tool row's `round` was undefined — the exact inference D-10 forbids. The "ATTRIBUTION-HONESTY CONTROL" test FAILED as expected: `leaky_tool` rendered inside the `Round 1` section's own DOM subtree, and the `getByText(/no reported round/)` assertion threw (`TestingLibraryElementError: Unable to find an element with the text: /no reported round/`) because the mutated code no longer ever populates `unattributedToolRows` for a matched-traceId row. Restored; `git diff --stat src/components/TraceWaterfall.tsx` confirmed empty (byte-identical to the committed Task-2 state) before re-adding the test file changes; re-ran full test file, 45/45 green.

Both mutations produced the expected failure and were confirmed non-vacuous before being restored.

## Next Phase Readiness

- Plan 105-06 (Tools page) is unaffected by this plan — no shared files.
- **Deferred to plan 105-09 per this plan's own `<output>` instruction (matching this project's established "green suite != live-verified" convention):** rendering legibility of the nested round/tool hierarchy at real trace sizes, and confirming the truncation notice actually appears on a session that genuinely trips the `toolExecutions` cap (a fixture that never hits the cap proves nothing about the live case — 105-VALIDATION.md § Manual-Only, row 2).
- **Nothing deployed.** This plan is frontend-only; no Convex schema/query change, no `npx convex codegen`, no `npx convex deploy`. The live self-hosted instance is unaffected by this plan.
- OBS-03 requirement checkbox left unmarked in REQUIREMENTS.md — full satisfaction awaits the live-verification pass at plan 105-09, per this project's established convention (105-01/03/04's own precedent).

---
*Phase: 105-tool-trace-observability*
*Completed: 2026-08-03*

## Self-Check: PASSED

All 3 key files confirmed present on disk (`src/components/TraceWaterfall.tsx`,
`src/components/TraceWaterfall.test.tsx`, this SUMMARY); all 4 commit hashes
(`e9cb561f`, `3442fe88`, `df1f4427`, `edb7d881`) confirmed present in git log.
