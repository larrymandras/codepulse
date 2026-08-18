---
phase: 121
slug: analytics-query-resilience
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-18
---

# Phase 121 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `121-RESEARCH.md` § "Validation Architecture" (:481-525).

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
is deliberately NOT to be installed).

---

## Sampling Rate

- **After every task commit:** `npx vitest run <the specific new/changed test file>`
- **After every plan wave:** `npx vitest run` (full suite) **plus** `npx tsc --noEmit` — the
  ratchet imports `typescript` types, so a type error there must fail the type gate, not just the
  test.
- **Before `/gsd:verify-work`:** full suite green, plus a live-render smoke check that
  `/analytics` actually mounts against the dev backend. The fault-injection unit tests prove the
  *mechanism*; they do not prove the real page still compiles and mounts after D-02's relocation
  refactor.
- **Max feedback latency:** < 60s per task.

---

## Per-Task Verification Map

Task IDs are assigned by the planner. The rows below are the requirement-level contract every
task must map onto; the planner fills `Task ID` / `Plan` / `Wave` when plans are written.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | DEBT-08 crit. 1 | — | A single failing query cannot unmount the route | unit (render + mocked `convex/react`) | `npx vitest run src/pages/Analytics.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | DEBT-08 crit. 1 (ratchet) | — | No query-shaped hook sits unprotected in `Analytics.tsx` | unit (AST walk of own source) | `npx vitest run src/pages/Analytics.structuralGuard.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | DEBT-08 crit. 1 (ratchet mutation) | — | Ratchet fails on a **synthetic new** hoisted query, where a by-name test would still pass | unit | same file | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | DEBT-08 crit. 2 | T-121-01 | `costByModel`/`providerBreakdown` read `aggregates`; **no** `llmMetrics` read survives | unit (fake `ctx.db`, assert `.query("aggregates")` called AND `.query("llmMetrics")` never called) | `npx vitest run convex/llm.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | DEBT-08 crit. 2 (deletion) | T-121-01 | `latencyOverTime` + `costByProvider` + `useLatencyOverTime` are gone from the public surface | unit/static | `npx vitest run` + `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | DEBT-08 crit. 3 | — | The one broken panel renders its OWN error affordance while siblings render real content | unit (same harness as crit. 1) | `npx vitest run src/pages/Analytics.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-05 / D-08 | — | `calls` buckets are insert-only and per-dimension-key idempotent; a re-run cannot double-count | unit (fake `ctx.db`, run the accumulator twice, assert row count unchanged) | `npx vitest run convex/aggregates.test.ts` | ⚠️ check | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Assertion Discipline (binding — from `121-CONTEXT.md` `<specifics>`)

These are not style notes; a test that violates one does not count as evidence.

1. **Criterion 1 asserts the observable outcome** — that sibling panels still render *content*.
   A proxy (`hasError` flipped, "no exception escaped", the boundary's fallback appeared) is
   explicitly rejected.
2. **Criterion 2 needs a control that could show the raw path if it were still live.** Absence of
   an `llmMetrics` read in one test is not evidence; the fake `ctx.db` must record every
   `.query(table)` call and the assertion must name `llmMetrics` explicitly as never-called.
3. **The ratchet must be derived, not enumerated**, and its mutation test must add a **synthetic
   new** hoisted query — not revert a known fix. The mutation must be **syntactically valid**, or
   a collection error masquerades as a passing guard.
4. **The idempotency test must run the accumulator twice against the same fake db** — a
   single-pass test cannot distinguish a working guard from an absent one.

---

## Wave 0 Requirements

- [ ] `src/pages/Analytics.test.tsx` — new. Criterion 1 + 3 fault injection, one case per
      relocated query, including the Summary Row.
- [ ] `src/pages/Analytics.structuralGuard.test.ts` — new. The D-04 derived ratchet + its
      synthetic-query mutation test.
- [ ] A handler-level test for the migrated `costByModel`/`providerBreakdown` proving the data
      source changed. `LlmAnalyticsPanel.test.tsx` mocks these at the React-hook boundary and
      never exercises the real Convex handler, so it cannot prove criterion 2.
- [ ] Confirm whether `convex/aggregates.test.ts` already exists before creating it (the
      researcher did not check this directly — flagged as unverified in `121-RESEARCH.md`).
- [ ] Local `console.error` suppression helper for the fault-injection tests — no such helper
      exists in the repo today.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `/analytics` mounts and renders end-to-end after the D-02 relocation | DEBT-08 crit. 1 | jsdom unit tests prove the mechanism, not that the real page compiles and mounts against the live backend | Start `npm run dev`, load `/analytics`, confirm every panel renders and the console is clean |
| The D-08 backfill actually populates 30 days of `calls` buckets | DEBT-08 crit. 2 | Requires the live self-hosted backend; cannot run in CI | Deploy per `CLAUDE.md` (`npx convex deploy --env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile`), run the backfill to completion, then re-derive the Calls column against a bounded raw count |
| `backfillTokenSplit`'s cursor is not already latched at `"done"` | D-08 | Live DB state; no reset path was found in the read-only pass | Query the cursor/checkpoint row before relying on the shared backfill for `calls` history |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (`npx vitest run`, never bare `npm test`, which watches)
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
