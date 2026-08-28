---
phase: 129
slug: dashboard-unbounded-read-ratchet-coverage
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-28
---

# Phase 129 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `129-RESEARCH.md` §"Validation Architecture" (lines 620-675).
> Task-level rows are filled in by the planner/executor once PLAN.md task IDs exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 — `unit` project (jsdom), `browser` project (headless Chromium, not exercised by this phase) |
| **Config file** | `vitest.config.ts` — `unit` project globs `src/**/*.test.{ts,tsx}`, `convex/**/*.test.ts`, `hooks/**/*.test.mjs` |
| **Quick run command** | `npx vitest run --project unit convex/boundedReads.ratchet.test.ts convex/metricsDashboardBounded.test.ts convex/insightsChat.test.ts` |
| **Full suite command** | `npm test` — runs `--project unit` then `--project browser` **sequentially** |
| **Estimated runtime** | ~10s scoped / full suite per repo norm |

**Load-bearing constraint:** `npm test` must run the two vitest projects sequentially, never
concurrently — concurrent runs destabilise the jsdom workers. CI's second step is
`--project unit`, **not** a bare `vitest run` (which would re-run `browser` a second time AND
concurrently). Confirmed by CLAUDE.md §"Convex & Frontend Lessons" and `vitest.config.ts`'s own
comment at `:29-53`.

---

## Sampling Rate

- **After every task commit:** `npx vitest run --project unit` scoped to the touched files
- **After every plan wave:** `npm test` (full sequential unit + browser)
- **Before `/gsd:verify-work`:** `npm test` green **AND** `npx tsc --noEmit` green — the second
  is not optional here, because D-04's type guard is only *proven* by the compiler; a written
  `FunctionReturnType` annotation that nothing type-checks is not a guard.
- **Max feedback latency:** ~30 seconds for the scoped run

---

## Per-Requirement Verification Map

Task IDs are assigned at planning time; this table is the requirement-level contract the
planner must satisfy when it writes `<acceptance_criteria>`.

| Requirement | Behavior | Test Type | Automated Command | File Exists |
|-------------|----------|-----------|-------------------|-------------|
| FIX-01 | `metrics.ts:19` reads `events` via a `by_timestamp2` range + `.take()`; the **recorded query** carries a non-null limit | unit (recorded-query) | `npx vitest run --project unit convex/metricsDashboardBounded.test.ts -t events` | ❌ W0 — new file |
| FIX-01 | `metrics.ts:24` reads `discoveredTools` via the shared `TOOLS_COUNT_CAP` `.take()`; recorded limit non-null | unit (recorded-query) | `npx vitest run --project unit convex/metricsDashboardBounded.test.ts -t discoveredTools` | ❌ W0 — new file |
| FIX-01 (D-07) | `truncated` / `rowsRead` correct on **both sides** of the cap boundary | unit (boundary) | same file; pattern from `alertsCountBounded.test.ts:127-141` | ❌ W0 |
| FIX-01 (D-03/F-2) | `cost_summary` returns non-placeholder `totalCost` / `totalTokens` against a fixture with known cost | unit (value) | `npx vitest run --project unit convex/insightsChat.test.ts` | ❌ W0 — new file; needs `executeTool` exported first |
| FIX-01 (D-04) | A rename/removal on `dashboardSummary`'s return shape is a **compile error** at the `insightsChat.ts` call site | static (compiler) | `npx tsc --noEmit` | ✅ command exists; the `FunctionReturnType` usage is new code |
| FIX-02 (D-08/D-09) | A bare `ctx.db.query(<high-volume table>).collect()` — no `withIndex`/`take`/`first`/`unique`/`paginate` — fails the ratchet | unit (AST static analysis) | `npx vitest run --project unit convex/boundedReads.ratchet.test.ts` | ⚠ file exists; new `describe` block per D-12 |
| FIX-02 (D-08) | **Negative control:** a known config-shaped bare collect (e.g. the `skills` read at `migrations.ts:182`) is NOT flagged | unit | same file | ⚠ same file, new assertion |
| FIX-02 (crit. 3) | Reverting `metrics.ts:19`/`:24` to the unbounded form makes the ratchet **fail** | unit (mutation control) | same file — see Guard Proof below | ❌ W0 |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Guard Proof (Success Criterion 3 — MANDATORY)

CONTEXT.md leaves the method to the planner but makes *one of them* mandatory: a guard that
cannot be shown to fire is indistinguishable from one never violated.

**Selected approach — same-file mutation control** (research recommendation, RESEARCH.md:655-668):

Extract the AST scan so it is independently callable (not embedded in the top-level `scan()`),
then add an `it()` block that constructs a synthetic source string reproducing the OLD unbounded
shape — `ctx.db.query("events").collect()` with no `withIndex` — and asserts the scanner returns
a violation for it.

Rationale over the `--self-test` flag pattern from `scripts/check-dead-surface.mjs`: that
script is a standalone invokable `.mjs`; `boundedReads.ratchet.test.ts` is not structured as
one, and the mutation control mirrors this file's own **existing** control at `:107-113`
("its regex actually matches the defect shape (control)") which already does exactly this for
signature 1. Building signature 2's control in the same style keeps one file internally
consistent.

**Construction rule inherited from `check-dead-surface.mjs:152-166`:** build the synthetic
violation **at runtime**, not as a literal source string sitting in the file — a literal is
itself scannable and self-inflicts a violation. That script documents this exact bug.

---

## Wave 0 Requirements

- [ ] `convex/testHelpers/makeRecordingDb.ts` — the D-14 shared helper. **Must use the
      `rowsByTable` shape** (only 2 of the 7 existing copies do); the flat single-array shape
      used by the other 5 cannot express two independently-bounded reads (`events` +
      `discoveredTools`) in one test, which this phase's new test requires.
- [ ] `convex/metricsDashboardBounded.test.ts` — FIX-01 recorded-query + D-07 boundary assertions
- [ ] `convex/insightsChat.test.ts` — FIX-01 D-04 value test (requires exporting `executeTool`,
      or extracting a `costSummaryTool` helper; confirmed this does **not** trip the
      dead-surface ratchet, which tracks only `query`/`mutation`/`action` declarations)
- [ ] Mutation control inside `boundedReads.ratchet.test.ts`'s new `describe` block
- Framework install: **none** — `vitest`, `typescript`, `convex@1.42.1` all already present

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end `cost_summary` answer quality against the live self-hosted backend | FIX-01 | `convex run --inline-query` is sandboxed **read-only**, and proving a live path means deploying throwaway code. `npx convex deploy` is forbidden here — a shared checkout ships another session's uncommitted tree. | Out of scope for this phase's gate. The unit value test is the contract; do not claim end-to-end proof. |

---

## Validation Sign-Off

- [ ] All tasks have an `<automated>` verify command or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify
- [ ] Wave 0 covers all ❌ MISSING references above
- [ ] No watch-mode flags in any command
- [ ] Feedback latency < 30s for the scoped run
- [ ] Every acceptance criterion asserts on a **construct** (write form, call site, or a test
      that fails when the behaviour is removed) — never a `grep -c` string count, which is
      satisfiable by rewording a comment
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
