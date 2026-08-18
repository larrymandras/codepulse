---
phase: 121
slug: analytics-query-resilience
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-18
updated: 2026-08-18
---

# Phase 121 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `121-RESEARCH.md` § "Validation Architecture" (:481-525).
> Task IDs / Plan / Wave filled in by the planner on 2026-08-18.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.9 (jsdom, `globals: true`) |
| **Config file** | `vitest.config.ts` (setupFiles: `src/test/setup.ts`) |
| **Quick run command** | `npx vitest run <changed test file>` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | full suite ~existing baseline; single file < 10s |

**No framework install required.** Vitest, `typescript` (^6.0.3, `package.json:86` — verified
by the orchestrator, not taken from the researcher's claim) and `@testing-library/react` are all
already present. The D-04 ratchet's AST walk uses the already-installed TypeScript compiler API,
so this phase adds **zero new dependencies** — which is also what D-02 requires (`convex-helpers`
is deliberately NOT to be installed). Because there are no package-manager install tasks anywhere
in this phase, the Package Legitimacy Gate does not apply and RESEARCH.md's missing
`## Package Legitimacy Audit` is not a blocker.

---

## Sampling Rate

- **After every task commit:** `npx vitest run <the specific new/changed test file>`
- **After every plan wave:** `npx vitest run` (full suite) **plus** `npx tsc --noEmit` — the
  ratchet imports `typescript` types, so a type error there must fail the type gate, not just the
  test.
- **Before `/gsd:verify-work`:** full suite green, plus the live-render smoke check in `121-07`
  Task 4. The fault-injection unit tests prove the *mechanism*; they do not prove the real page
  still compiles and mounts after D-02's relocation refactor.
- **Max feedback latency:** < 60s per task.

**Expected transient red.** Plan `121-02` deliberately breaks the payload shape that
`src/components/LlmAnalyticsPanel.test.tsx` asserts on. That file is the ONLY permitted failure
between plans `121-02` and `121-06`, and any executor reporting it must name the failing tests
explicitly rather than describing the suite as green. Plan `121-06` closes it; from that plan
onward a full-suite failure is a real defect.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 121-04 T1 | 121-04 | 2 | DEBT-08 crit. 1 | T-121-15, T-121-16 | No query is called in `Analytics()`'s own body; the Summary Row gains four boundaries; the dead `subscriptionUsage` read is removed | source assertion + type gate | `npx tsc --noEmit` | ✅ modified | ⬜ pending |
| 121-04 T2 | 121-04 | 2 | DEBT-08 crit. 1 | T-121-15 | A single failing query cannot unmount the route; siblings assert on real CONTENT | unit (render + mocked `useQuery` **and** `usePaginatedQuery`) | `npx vitest run src/pages/Analytics.test.tsx` | ❌ created by this task | ⬜ pending |
| 121-04 T2 | 121-04 | 2 | DEBT-08 crit. 3 | T-121-17 | Exactly ONE `/failed to load/i` match per fault case — no cascade, no masking | unit, same harness | `npx vitest run src/pages/Analytics.test.tsx` | ❌ created by this task | ⬜ pending |
| 121-05 T1 | 121-05 | 3 | DEBT-08 crit. 1 (ratchet) | T-121-19, T-121-21 | No query-shaped hook sits unprotected in `Analytics.tsx`, derived from the AST with no enumerated query names | unit (AST walk of own source) | `npx vitest run src/pages/Analytics.structuralGuard.test.ts` | ❌ created by this task | ⬜ pending |
| 121-05 T2 | 121-05 | 3 | DEBT-08 crit. 1 (ratchet mutation) | T-121-20 | Ratchet fails on a **synthetic** hook name and a **synthetic** unwrapped element, each proven to parse via `ts.transpileModule` diagnostics first | unit | same file | ❌ created by this task | ⬜ pending |
| 121-02 T3 | 121-02 | 2 | DEBT-08 crit. 2 | T-121-07, T-121-08 | `costByModel`/`providerBreakdown` read `aggregates`; **no** `llmMetrics` read survives, with an `llmMetrics` fixture that would yield a different answer as the control | unit (`makeAggregatesCtx`, assert on `queriedTables`) | `npx vitest run convex/llm.test.ts` | ✅ modified | ⬜ pending |
| 121-02 T1 | 121-02 | 2 | DEBT-08 crit. 2 (deletion) | T-121-06 | `latencyOverTime` + `costByProvider` + `useLatencyOverTime` are gone from the public surface — the terminal state that SATISFIES criterion 2 for those two queries, not a gap | static (`git grep -F` with a known-present control) + type gate | `npx tsc --noEmit && npx vitest run convex/` | ✅ modified | ⬜ pending |
| 121-01 T1 | 121-01 | 1 | DEBT-08 crit. 2 (harness) | T-121-07 | The fake `ctx.db` records every `.query(table)` call, so criterion 2's negative assertion can mean something | unit | `npx vitest run convex/aggregates.test.ts` | ❌ `convex/lib/fakeCtx.ts` created by this task | ⬜ pending |
| 121-01 T2 | 121-01 | 1 | D-05 | T-121-01 | `calls` buckets are insert-only and per-dimension-key idempotent; a re-run cannot double-count | unit (fake `ctx.db`, run the accumulator **twice**, assert row count unchanged) | `npx vitest run convex/aggregates.test.ts` | ✅ exists (confirmed 2026-08-18) | ⬜ pending |
| 121-01 T3 | 121-01 | 1 | D-08 | T-121-02 | A previously-latched `"done"` cursor no longer blocks a fresh backfill pass | unit | `npx vitest run convex/aggregates.test.ts` | ✅ exists | ⬜ pending |
| 121-03 T1/T2 | 121-03 | 1 | DEBT-08 crit. 1 (enabling) | T-121-12 | Every relocated query is owned by a component a boundary can be an ancestor of; none handles its own errors | type gate + source assertion | `npx tsc --noEmit` | ❌ created by these tasks | ⬜ pending |
| 121-06 T1 | 121-06 | 3 | D-07 / D-11 | T-121-25 | The panel consumes the rollup payload; the money column still comes from `costDerived` | type gate | `npx tsc --noEmit` | ✅ modified | ⬜ pending |
| 121-06 T2 | 121-06 | 3 | D-10 / D-11 | T-121-23, T-121-24 | The `as of HH:MM` label shows the OLDER of two `asOf` values, renders `no data yet` on null, nothing while loading, and never a 1970 date | unit | `npx vitest run src/components/LlmAnalyticsPanel.test.tsx` | ✅ modified | ⬜ pending |
| 121-07 T2 | 121-07 | 4 | DEBT-08 crit. 2 (live) | T-121-27..30 | The deploy targets the self-hosted backend and the deletion landed, proven by a positive read AND a `Could not find public function` control | CLI output, recorded verbatim | `npx convex run llm:providerBreakdown '{}' --env-file <selfhosted>` | n/a | ⬜ pending |
| 121-07 T3 | 121-07 | 4 | D-08 / D-10 (live) | T-121-31, T-121-32 | 30 days of `calls` buckets exist; `rowsRead`/`truncated` measured; every truncated hour named | CLI output, recorded verbatim | `npx convex run llm:costByModel --env-file <selfhosted>` | n/a | ⬜ pending |
| 121-07 T4 | 121-07 | 4 | DEBT-08 crit. 1 (live) | T-121-33 | `/analytics` mounts and renders end to end after the relocation refactor | manual smoke (see Manual-Only below) | — | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Assertion Discipline (binding — from `121-CONTEXT.md` `<specifics>`)

These are not style notes; a test that violates one does not count as evidence.

1. **Criterion 1 asserts the observable outcome** — that sibling panels still render *content*.
   A proxy (`hasError` flipped, "no exception escaped", the boundary's fallback appeared) is
   explicitly rejected. Enforced in `121-04` T2 by an acceptance criterion asserting
   `grep -cE "hasError|no exception|not\.toThrow"` returns 0.
2. **Criterion 2 needs a control that could show the raw path if it were still live.** Absence of
   an `llmMetrics` read in one test is not evidence; the fake `ctx.db` must record every
   `.query(table)` call and the assertion must name `llmMetrics` explicitly as never-called.
   Enforced in `121-02` T3, which additionally seeds an `llmMetrics` fixture that would produce a
   DIFFERENT answer, and adds a positive control proving `queriedTables` records that table when it
   IS queried.
3. **The ratchet must be derived, not enumerated**, and its mutation test must add a **synthetic
   new** hoisted query — not revert a known fix. The mutation must be **syntactically valid**, or
   a collection error masquerades as a passing guard. Enforced in `121-05` T2 by a
   `ts.transpileModule(...).diagnostics` emptiness assertion that runs BEFORE each failure
   assertion, plus a second-order mutation that stubs the analyzer to prove the cases are
   load-bearing.
4. **The idempotency test must run the accumulator twice against the same fake db** — a
   single-pass test cannot distinguish a working guard from an absent one. Enforced in `121-01` T2,
   which also mutation-tests the guard by pointing `calls` at the `tokens_prompt` key set and
   confirming the twice-run test fails.

---

## Wave 0 Requirements

All resolved. No test file is referenced by a task before the task that creates it.

- [x] `src/pages/Analytics.test.tsx` — created by `121-04` T2 (wave 2), which is the same plan that
      makes the property testable. Covers criteria 1 and 3, one case per relocated query owner plus
      an all-healthy control.
- [x] `src/pages/Analytics.structuralGuard.test.ts` — created by `121-05` T1 (wave 3), after the
      rewire the ratchet asserts against.
- [x] A handler-level test proving the migrated queries' data source changed — `121-02` T3, in
      `convex/llm.test.ts` (which exists). `LlmAnalyticsPanel.test.tsx` mocks these at the React-hook
      boundary and never exercises the real Convex handler, so it cannot prove criterion 2.
- [x] `convex/aggregates.test.ts` **exists** — confirmed 2026-08-18 (`makeAggregatesCtx` at :46,
      44 references). It has **no** query-table tracking: `grep -c queriedTables` returns 0, against a
      control of 44 for `makeAggregatesCtx`, so the zero is a real finding rather than a broken grep.
      That extension is `121-01` T1, a task with its own acceptance criteria, not a side effect.
- [x] Local `console.error` suppression for the fault-injection tests — `121-04` T2 writes it
      directly (`vi.spyOn(console, "error")` in `beforeEach`, restored in `afterEach`). No in-repo
      precedent exists to copy, because no existing test forces a boundary catch.

---

## Manual-Only Verifications

| Behavior | Requirement | Owning Task | Why Manual | Test Instructions |
|----------|-------------|-------------|------------|-------------------|
| `/analytics` mounts and renders end-to-end after the D-02 relocation | DEBT-08 crit. 1 | `121-07` T4 | jsdom unit tests prove the mechanism, not that the real page compiles and mounts against the live backend | Start `npm run dev`, load `/analytics`, confirm every section renders, the console is clean, the `as of HH:MM` label reads a plausible recent time, and Load more grows the table |
| No external consumer of the deleted endpoints | D-06 | `121-07` T1 (blocking checkpoint) | Nothing outside this repo can be checked from here; only the owner of every possible caller can settle it | Confirm nothing in Ástríðr, `~/scripts`, or a saved dashboard query calls `llm:costByProvider` or `llm:latencyOverTime` |
| The D-08 backfill actually populates 30 days of `calls` buckets | DEBT-08 crit. 2 | `121-07` T3 | Requires the live self-hosted backend; cannot run in CI | Deploy per `CLAUDE.md`, run the chain to `done: true` under a 200-iteration guard, record every `truncatedHours` entry |
| `backfillTokenSplit`'s cursor state | D-08 | `121-07` T2 (record only) | Live DB state | Read and record the cursor before the run. **No longer a blocking prerequisite** — `121-01` T3 removes the `"done"` latch, so the value is recorded as a fact rather than gating the plan |
| Live rollup row magnitude / read-cap sizing | D-07 | `121-07` T3 | Requires the live backend | Read `rowsRead` and `truncated` from both migrated queries; raise `ROLLUP_READ_CAP` and redeploy if truncated or above 50% of the cap; record the decision either way |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are explicitly manual-only with an owning task
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags (`npx vitest run`, never bare `npm test`, which watches)
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned 2026-08-18 — statuses stay ⬜ pending until execution.
