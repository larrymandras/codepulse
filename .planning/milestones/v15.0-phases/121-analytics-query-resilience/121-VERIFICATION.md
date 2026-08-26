---
phase: 121-analytics-query-resilience
verified: 2026-08-18T19:45:00Z
status: passed
score: 3/3 success criteria verified; 6/6 must-haves verified across all 7 plans
overrides_applied: 0
---

# Phase 121: Analytics Query Resilience Verification Report

**Phase Goal:** `/analytics` cannot be blanked by a single failing query, and its LLM cost/latency
queries read from the durable `aggregates` rollups instead of scanning raw `llmMetrics` — the
prerequisite that makes an honest six-state tile possible on that route.
**Verified:** 2026-08-18
**Status:** passed
**Re-verification:** No — initial verification

This verification independently re-derived every claim in the orchestrator's dispatch rather than
trusting it: re-ran the relevant test files, re-read the live code (not just the SUMMARYs), probed
the live self-hosted backend directly, and diffed all eight relocated components against the
pre-move `Analytics.tsx` (the fidelity check the orchestrator flagged as incomplete).

## Goal Achievement

### Observable Truths (Success Criteria, as amended 2026-08-18)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Forcing a throw in any ONE query `/analytics` reads leaves every other panel rendering (superset scope: all ~10 previously-hoisted queries, not just the 3 originally named) | ✓ VERIFIED | `src/pages/Analytics.tsx` contains 0 `useQuery`/`useRecentEvents`/`useLlmMetrics`/`usePaginatedQuery` calls in its own body (re-derived via grep, not taken from the SUMMARY). 31 `SectionErrorBoundary` call sites (up from 27 pre-phase), one per relocated query owner including all 4 new Summary Row cards. `src/pages/Analytics.test.tsx` — re-ran independently: **5 test files / 139 passed, 3 todo, 0 failed** (includes this file's 9 fault-injection cases: 8 per-component + 1 all-healthy control). `src/pages/Analytics.structuralGuard.test.ts` — re-ran independently: 5/5 passed, including two mutation cases proving the AST-derived ratchet fails on a synthetic hook (`useTotallyNewThingNobodyHasWrittenYet`) and a synthetic unwrapped element (`SomeBrandNewPanelNobodyHasWrittenYet`), each proven to parse first via `ts.transpileModule` diagnostics. **Live, non-injected proof** in `121-DEPLOY-EVIDENCE.md`: three real backend query timeouts (`activityHeatmap`, `toolFlowSankey`, `tokenSunburst`) each isolated to their own boundary while every other panel on `/analytics` rendered real content — stronger evidence than the injected tests because nothing was staged. |
| 2 | `costByModel`/`providerBreakdown` read `aggregates` rollups; `latencyOverTime`/`costByProvider` are DELETED (not migrated), satisfying this criterion by design (D-06) | ✓ VERIFIED | Read `convex/llm.ts` directly: both handlers use `.withIndex("by_type_period_bucket", ...).order("desc").take(ROLLUP_READ_CAP)` against the `aggregates` table — zero `.collect()` in either, zero read of `llmMetrics`. `costByProvider`/`latencyOverTime`/`useLatencyOverTime` — `git grep -nF` across `src/` and `convex/` returns 0 hits (exit 1) for all three; control `git grep -clF "useCapabilityGrowth"` returns 5 files, proving the grep discriminates. **Live probe run independently against the running self-hosted backend** (`POST http://127.0.0.1:3210/api/query`): `llm:providerBreakdown` returns the new rollup shape with real data (`rows`: 10 providers, `presentBuckets: 499`, `rowsRead: 889`) exactly matching the numbers recorded in `121-DEPLOY-EVIDENCE.md`; `llm:latencyOverTime` returns `Could not find public function`, byte-identical to a known-bogus control function name (`llm:notARealFn9x7q2Verify`) — confirming deletion landed on the live backend, not just in the repo. |
| 3 | Each surviving query independently reports its own failure without masking a sibling's | ✓ VERIFIED | `src/pages/Analytics.test.tsx`'s 8 isolation cases each assert exactly one `/failed to load/i` match on the whole page (re-run, all pass) — a cascade or a swallowed failure would fail this assertion. `grep -cE "hasError|no exception|not\.toThrow"` returns 0 in that file (no proxy assertions). **Live confirmation**: the 3 real simultaneous backend timeouts each produced their own independent `"{name} failed to load"` boundary fallback with zero collateral damage to any other panel (`121-DEPLOY-EVIDENCE.md` Task 4, console-log-confirmed per-boundary `SectionErrorBoundary [name] caught:` messages). |

**Score:** 3/3 success criteria verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `convex/aggregates.ts` | `calls` rollup metric, own idempotency guard, de-latched cursor | ✓ VERIFIED | `callsByDim` accumulator + `insertMissing("calls", callsByDim)` at line 122 (separate from `tokens_prompt`/`tokens_completion`); `backfillTokenSplit`'s cursor resolution uses `Number.isFinite` guard at lines 679/826, no `cursorRow?.value === "done"` early return anywhere (0 hits). |
| `convex/lib/fakeCtx.ts` | shared fake-ctx harness, `queriedTables` tracking | ✓ VERIFIED (file exists, imported by both `convex/aggregates.test.ts` and `convex/llm.test.ts`; both test files pass) |
| `convex/llm.ts` | rollup-backed `costByModel`/`providerBreakdown`; `costByProvider`/`latencyOverTime` deleted; STOPGAP note gone | ✓ VERIFIED | Read in full; matches every claim in 121-02-SUMMARY. `grep -c "STOPGAP"` → 0. |
| `convex/evalScores.ts` | `getJudgeDigestInternal`'s `llmMetrics` read capped at 200 | ✓ VERIFIED | `JUDGE_DIGEST_LLM_READ_CAP = 200`, `.order("desc").take(JUDGE_DIGEST_LLM_READ_CAP)` at line 168. |
| `src/hooks/useAnalytics.ts` | `useLatencyOverTime` removed | ✓ VERIFIED (0 hits repo-wide in `src/`/`convex/`) |
| 8 `src/components/analytics/*.tsx` | self-fetching, no error handling, byte-faithful markup relocation | ✓ VERIFIED — all 8 diffed personally against `git show 0837b1c3~1:src/pages/Analytics.tsx` (the pre-move file). Every one renders identical JSX/derivations to the original block, including the case the orchestrator flagged as needing a redo (`CanLoadMore`/`llmStatus` gate in `RecentLlmCallsPanel.tsx:102`, confirmed present and correctly cased). |
| `src/pages/Analytics.tsx` | composition-only, zero fetching | ✓ VERIFIED |
| `src/pages/Analytics.test.tsx` | 9 fault-injection cases | ✓ VERIFIED, re-run independently, 0 failures |
| `src/pages/Analytics.structuralGuard.test.ts` | AST-derived ratchet, no enumerated query names | ✓ VERIFIED — `grep -cE "cacheStats|subscriptionUsage|billedOverTime|getActiveAnomalies|eventCountsByPeriod|advisorEvents"` returns 0; re-run independently, 5/5 pass. |
| `src/components/LlmAnalyticsPanel.tsx` | rollup payload consumption + `as of HH:MM` label | ✓ VERIFIED (re-derived: `providerResult?.rows`/`modelResult?.rows` present, `asOf * 1000` conversion present, `costDerived.costBreakdown` untouched as money source) |
| `.planning/phases/121-analytics-query-resilience/121-DEPLOY-EVIDENCE.md` | verbatim deploy/backfill/measurement/smoke record | ✓ VERIFIED — cross-checked its recorded live numbers against a fresh, independent live probe run during this verification; identical. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `convex/aggregates.ts computeHourly`/`backfillTokenSplit` | `insertTokenSplitBuckets` | shared helper, `calls` accumulator | WIRED | Confirmed by reading the function; both call sites route through the same helper. |
| `convex/llm.ts costByModel`/`providerBreakdown` | `aggregates` `by_type_period_bucket` | bounded indexed read | WIRED | Confirmed live against the running backend, not just statically. |
| `src/pages/Analytics.tsx` | `src/components/analytics/*` | each rendered inside its own `SectionErrorBoundary` | WIRED | Confirmed by reading the full rewired file; 31 boundary sites, byte-identical pre-existing names preserved. |
| `src/pages/Analytics.structuralGuard.test.ts` | `src/pages/Analytics.tsx` | reads the live file via `readFileSync` + `ts.createSourceFile` | WIRED | Confirmed; test passes against the current file, not a frozen fixture. |
| `src/components/LlmAnalyticsPanel.tsx` | `api.llm.providerBreakdown`/`costByModel` | `useQuery` returning the new object shape | WIRED | Confirmed by reading the component; `.rows` access present, old `Object.entries(record)` gone. |

### Data-Flow Trace (Level 4)

`LlmAnalyticsPanel`'s Model Breakdown/Provider Comparison were HOLLOW at deploy time (`rows: []`,
`presentBuckets: 0` — the `calls` rollup existed in schema but had never been materialized) until
the 121-07 backfill ran. Verified FLOWING as of this verification: the live probe run during this
check returned 10 populated provider rows with `presentBuckets: 499`, matching the numbers in
`121-DEPLOY-EVIDENCE.md` exactly — the data-flow gap this phase opened (calls rollup type added
before any backfill) was closed within the same phase, not left open.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|------------|--------------|--------|----------|
| DEBT-08 | All 7 plans | `/analytics` survives a failing query; LLM cost/latency queries read `aggregates` rollups | **Complete** | Every clause of the requirement text (`.planning/REQUIREMENTS.md:74`) is satisfied: no single throw blanks the page (criterion 1), `costByModel`/`providerBreakdown` read rollups and `latencyOverTime` is resolved by deletion per the amended criterion 2, and independent failure reporting holds (criterion 3). No partial delivery — all three amended success criteria are fully met, not partially. |

**Traceability note (informational, not a gap):** `.planning/REQUIREMENTS.md:74` still shows `- [ ]`
and `.planning/ROADMAP.md:114` still shows `DEBT-08 | Phase 121 | Pending`, unchanged from before
this phase ran. Per the orchestrator's explicit instruction, this verifier does not edit
`STATE.md`/`ROADMAP.md`/`REQUIREMENTS.md` — the orchestrator owns updating these to reflect the
`Complete` verdict above.

**No ORPHANED requirements found:** `.planning/ROADMAP.md` maps only DEBT-08 to Phase 121, and all
7 plans declare `requirements: [DEBT-08]` — full coverage, nothing claimed that isn't mapped and
nothing mapped that isn't claimed.

### Anti-Patterns Found

None. Swept every file this phase modified or created (`convex/llm.ts`, `convex/aggregates.ts`,
`convex/evalScores.ts`, `convex/lib/fakeCtx.ts`, `src/pages/Analytics.tsx`,
`src/pages/Analytics.test.tsx`, `src/pages/Analytics.structuralGuard.test.ts`,
`src/components/LlmAnalyticsPanel.tsx`, `src/hooks/useAnalytics.ts`, all 8
`src/components/analytics/*.tsx`) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` — zero hits.

### Behavioral Spot-Checks / Probe Execution

No `scripts/*/tests/probe-*.sh` convention applies to this phase. In its place, this verifier ran
the equivalent live checks directly against the running self-hosted Convex backend
(`http://127.0.0.1:3210`), independently of the orchestrator's recorded evidence:

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `providerBreakdown` reads live rollup data | `POST /api/query {"path":"llm:providerBreakdown"}` | `{"status":"success", rows: 10 providers, presentBuckets: 499, rowsRead: 889, truncated: false}` — matches `121-DEPLOY-EVIDENCE.md` exactly | ✓ PASS |
| `latencyOverTime` is deleted | `POST /api/query {"path":"llm:latencyOverTime"}` | `Could not find public function` | ✓ PASS |
| Deletion control discriminates | `POST /api/query {"path":"llm:notARealFn9x7q2Verify"}` | identical error text to the above | ✓ PASS (control) |
| Full test-file re-run | `npx vitest run src/pages/Analytics.test.tsx src/pages/Analytics.structuralGuard.test.ts convex/aggregates.test.ts convex/llm.test.ts src/components/LlmAnalyticsPanel.test.tsx` | 5 files passed, 139 passed / 3 todo, 0 failed | ✓ PASS |
| Type gate | `npx tsc --noEmit` | 0 errors | ✓ PASS |

## Process Findings (not gaps — recorded per the dispatch's explicit request)

**Plan-text quality.** Confirmed the dispatch's characterization: at least 4 of 7 plans shipped
acceptance criteria that were literally unsatisfiable or wrong given the plan's own mandated
implementation shape (a `metric_type: "calls"` literal-string grep that can never match the DRY
`insertMissing` pattern the same plan's action text requires; a `costDerived.costBreakdown` grep
count whose stated baseline was already wrong before the plan touched the file; a `1970`-text
freshness assertion that passes vacuously because the label format never renders a year; a
`for`-loop test structure that satisfied the *intent* of a literal-count acceptance criterion
without satisfying the letter). In every case the executor caught the mismatch, did not weaken the
underlying assertion, and recorded the correction transparently in the SUMMARY with before/after
evidence. This verifier independently confirmed the *delivered* behavior in each case is correct —
the plan-text defects did not propagate into shipped gaps.

**Relocation fidelity.** Independently diffed all 8 relocated components against
`git show 0837b1c3~1:src/pages/Analytics.tsx` (not merely re-checked the orchestrator's one
sampled case). All 8 are byte-faithful relocations — markup, derivations, class names, and the
`CanLoadMore`/`llmStatus` Load More gate are unchanged from the pre-move page.

### Human Verification Required

None. The items that would normally require human verification for a deploy/backfill/smoke-check
phase (external-consumer confirmation, live deploy execution, `/analytics` browser smoke check)
were already performed as blocking `checkpoint:human-verify` gates within plan 121-07, with the
operator's `approved` replies recorded verbatim in `121-DEPLOY-EVIDENCE.md`, and this verifier
independently re-probed the live backend to confirm those recorded results still hold.

### Gaps Summary

No gaps. All three amended success criteria are verified against live code and a live backend
probe (not merely against the SUMMARYs' claims), all 7 plans' must-haves are satisfied, DEBT-08 is
fully (not partially) delivered, and no anti-patterns or debt markers were found in any file this
phase touched.

---

_Verified: 2026-08-18_
_Verifier: Claude (gsd-verifier)_
