---
phase: 105
slug: tool-trace-observability
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-03
---

# Phase 105 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `105-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 (jsdom) + `@testing-library/react` 16.3.2; Playwright 1.61.1 for E2E |
| **Config file** | `vitest.config.ts` (repo root) — `include: ['src/**/*.test.{ts,tsx}', 'convex/**/*.test.ts', 'hooks/**/*.test.mjs']`, `setupFiles: ['./src/test/setup.ts']` |
| **Quick run command** | `npx vitest run <changed test file>` |
| **Full suite command** | `npx vitest run` (plus `npx tsc --noEmit`) |
| **Estimated runtime** | ~60 seconds full suite |

**Convention constraint:** `convex-test` is NOT installed. Ingest-boundary logic is validated by
**pure-function extraction** (the established pattern — `resolveGatewayTaskCompleted`,
`processTaskQualityEvent`, `isUnresolvedRouting` are exported pure functions unit-tested directly,
with `runMutation`/`ctx.db` calls left thin). Any new parsing logic in the `tool_policy_event` case
MUST follow this convention or it cannot be automatically verified.

**Cross-repo:** astridr-repo (`C:\Users\mandr\astridr-repo`) uses pytest. The exact test path for
`loop.py`'s emit sites was NOT enumerated during research — Wave 0 must confirm it before any
astridr-side task is marked verifiable.

---

## Sampling Rate

- **After every task commit:** `npx vitest run <changed test file>`
- **After every plan wave:** `npx vitest run` + `npx tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite green **AND** the D-07 live-induction step recorded below
- **Max feedback latency:** 60 seconds

**Project rule (CLAUDE.md / LESSONS):** a green suite is not proof of a live fix. The ingest path
(D-07) is proven only by inducing real events against the running stack and observing the row land —
not by a passing unit test on the parser.

---

## Per-Task Verification Map

> Task IDs are assigned by `gsd-planner`. This table is seeded per-requirement; the executor fills
> `Task ID` / `Plan` / `Wave` / `Status` columns as plans are written and executed.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | OBS-01 | — | `tool_executed` case writes a `toolExecutions` row tagged `provider: "astridr"` alongside the existing `callGraphEdges` upsert | unit (pure-fn extraction) | `npx vitest run convex/runtimeIngest.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | OBS-01 | — | Hourly aggregate buckets for tool call/failure/duration, keyed by tool + provider; reads are bounded (`.take(CAP)`), never unfiltered `.collect()` | unit | `npx vitest run convex/aggregates.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | TBD | OBS-01 | — | Tools page usage panel renders per-tool frequency + success/fail from live query; query failure is contained by `SectionErrorBoundary` (a throwing Convex query unmounts the tree) | component | `npx vitest run src/pages/Tools.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | OBS-02 | T-105-01 | `tool_policy_event` case parses all 4 kinds and inserts into `toolPolicyEvents`; unknown kind is rejected, not silently dropped | unit | `npx vitest run convex/toolPolicyEvents.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | OBS-02 | T-105-01 | Alert fires ONLY for `malformed_policy_boot` / `malformed_policy_reload_rejected`; the other two kinds never alert (isolation control, mirroring `costBudgetEval.test.ts`) | unit | `npx vitest run convex/toolPolicyAlertEval.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | OBS-03 | — | `TraceWaterfall` nests tool rows under the correct LLM-call parent when `round` is present | unit | `npx vitest run src/components/TraceWaterfall.test.tsx` | ✅ | ⬜ pending |
| TBD | TBD | TBD | OBS-03 | — | `groupCacheRatio` denominator matches `shapeCacheAcc` exactly (D-11 "one formula" regression) | unit | `npx vitest run src/components/TraceWaterfall.test.tsx` | ✅ | ⬜ pending |
| TBD | TBD | TBD | OBS-03 | — | Both feeder queries are capped AND the UI states truncation when the cap is hit | unit + component | `npx vitest run convex/llm.test.ts` / `src/components/TraceWaterfall.test.tsx` | ⚠ verify in W0 | ⬜ pending |
| TBD | TBD | TBD | OBS-01 (D-15 corrected) | — | `ToolExecutionPanel` + `PermissionDecisionsChart` still show Claude-Code-only rankings after Ástríðr rows exist in `toolExecutions` — control: seed both providers, assert the panels' output is byte-identical to the single-provider baseline | unit | `npx vitest run convex/toolExecutions.test.ts` | ⚠ verify in W0 | ⬜ pending |
| TBD | TBD | TBD | OBS-01 (D-12 extended) | — | `successRate` and `avgDuration` are capped and report truncation, matching `fetchLlmRowsForWindow`'s `{rows, truncated}` shape | unit | `npx vitest run convex/toolExecutions.test.ts` | ⚠ verify in W0 | ⬜ pending |
| TBD | TBD | TBD | OBS-01/02/03 (cross-repo) | — | astridr payload widening (D-03 / D-08 / D-10) emits the added fields | unit (pytest) | astridr-repo: path TBD in Wave 0 | ⚠ verify in W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> **Corrected 2026-08-03 at plan-phase.** RESEARCH.md listed `convex/runtimeIngest.test.ts` as
> missing and `convex/llm.test.ts` as unconfirmed. Both **exist** (verified on disk). Extend them;
> do not create parallel files.

- [x] ~~`convex/runtimeIngest.test.ts` — does not exist~~ → **exists.** Add cases for the extended `tool_executed` case and the new `tool_policy_event` case alongside the existing `resolveGatewayTaskCompleted` / `processSwarmTaskEvent` pure-function tests.
- [x] ~~Confirm whether `convex/llm.test.ts` exists~~ → **exists.** Extend for the D-12 `sessionCalls` cap.
- [ ] `convex/toolPolicyEvents.test.ts` — new table + mutations, needs its own test file
- [ ] `convex/toolPolicyAlertEval.test.ts` — D-06 alert evaluator, including the negative-kind isolation control
- [ ] `src/pages/Tools.test.tsx` — new page, needs a component test scaffold
- [ ] `convex/toolExecutions.test.ts` — confirm existence; needed for the D-15 provider-filter arg and the D-12-extended caps on `successRate` / `avgDuration`
- [ ] **Confirm** astridr-repo's pytest path for `loop.py`'s `tool_executed` / leak-detector emits — research did not enumerate astridr-repo's test directory.
- [ ] Extend `convex/aggregates.test.ts` (exists, 34 tests) rather than creating a parallel file.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| **D-07 live induction** — the astridr → CodePulse ingest path actually carries `tool_policy_event` and the widened `tool_executed` payload end-to-end | OBS-01, OBS-02 | No `convex-test`; the `runMutation`/`ctx.db` seam is deliberately un-unit-tested. A passing parser test proves parsing, not delivery. | 1. Bring the self-hosted Convex backend + astridr stack up. 2. Induce a real `tool_policy_event` of each of the 4 kinds and at least one `tool_executed`. 3. Query the live `toolPolicyEvents` / `toolExecutions` tables and show the actual rows (raw output, not a count derived from a flag). 4. Confirm the alert fired for exactly the 2 alerting kinds and NOT for the other 2. Record the raw query output in `105-VERIFICATION.md`. |
| **Trace waterfall visual depth** — nested spans, per-tool timings, cache badges render legibly at real trace sizes | OBS-03 | Rendering legibility at real data volume is not assertable from jsdom; the existing tests cover the pure grouping functions only. | Open the trace waterfall against a real multi-round session, confirm nesting depth, per-tool durations, and cache-hit badges are present and correct against the underlying rows. Confirm the truncation notice appears when the feeder cap is hit (must be exercised on data that actually trips the cap — a fixture that never hits it proves nothing). |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all ❌ / ⚠ references above
- [ ] No watch-mode flags (`vitest run`, never bare `vitest`)
- [ ] Feedback latency < 60s
- [ ] D-07 live induction recorded with raw query output
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
