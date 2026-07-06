---
phase: 94
slug: trace-waterfall
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-06
---

# Phase 94 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x (jsdom) — CodePulse; pytest — Ástríðr (cross-repo) |
| **Config file** | `vitest.config.ts` (setup: `src/test/setup.ts`) |
| **Quick run command** | `npx vitest run <changed test file>` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <changed test file>`
- **After every plan wave:** Run `npm test` + `npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 94-01-T1 | 01 | 1 | TRACE-01 | T-94-01, T-94-02 | Bearer-gated ingest; v.string() rejects non-string traceId | unit | `npx vitest run convex/llm.test.ts convex/runtimeIngest.test.ts` | ✅ extend | ⬜ pending |
| 94-01-T2 | 01 | 1 | TRACE-01 | T-94-02 | session-scoped read, archived excluded, no cap | unit | `npx vitest run convex/llm.test.ts` | ✅ extend | ⬜ pending |
| 94-02-T1 | 02 | 1 | TRACE-01 | T-94-03, T-94-04 | distinct contextvar, not a secret, no goalId reuse | unit | `python -m pytest tests/unit/test_trace_context.py -q` | ❌ Wave 0 (astridr) | ⬜ pending |
| 94-02-T2 | 02 | 1 | TRACE-01 | T-94-04 | per-site attach; ollama net-new; goalId untouched | unit+syntax | `python -m pytest tests/unit/test_trace_context.py -q` + `py_compile` | ❌ Wave 0 (astridr) | ⬜ pending |
| 94-03-T1 | 03 | 2 | TRACE-02 | T-94-06 | 3-state cache (undefined≠0), cost dash, bar-math /1000 | unit | `npx vitest run src/components/TraceWaterfall.test.tsx` | ❌ Wave 0 | ⬜ pending |
| 94-03-T2 | 03 | 2 | TRACE-02 | T-94-05, T-94-06 | JSX-escaped labels, token-only color, no estimation | unit | `npx vitest run src/components/TraceWaterfall.test.tsx` + `npx tsc --noEmit` | ❌ Wave 0 | ⬜ pending |
| 94-04-T1 | 04 | 3 | TRACE-02 | T-94-07 | ?tab validated against Tab union, silent fallback | smoke | `npx tsc --noEmit && npm run build` | ✅ existing cmds | ⬜ pending |
| 94-04-T2 | 04 | 3 | TRACE-02 | T-94-08 | encodeURIComponent + sessionId guard; deletion clean | smoke | `rg "LangfuseTraceLink" src/` (zero) + `npx tsc --noEmit && npm run build` | ✅ existing cmds | ⬜ pending |
| 94-05-T1 | 05 | 4 | TRACE-01/02 | T-94-09 | operator-gated deploy, not auto-deployed | manual | operator: `npx convex deploy --yes` + astridr rebuild | N/A (checkpoint) | ⬜ pending |
| 94-05-T2 | 05 | 4 | TRACE-01/02 | T-94-09 | live grouped render + legacy fallback, clean console | manual | operator live verification vs tidy-whale-981 | N/A (checkpoint) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/TraceWaterfall.test.tsx` — NET-NEW (Plan 03 Task 1): grouping (traced vs untraced bucket), bar-math seconds/ms conversion (`start = timestamp − latencyMs/1000`), cache-badge three-state, cost-dash. Written RED before the component is fleshed out.
- [ ] `C:/Users/mandr/astridr-repo/tests/unit/test_trace_context.py` — NET-NEW (Plan 02 Task 1): set/get roundtrip, reset-restores-prior, traceId≠goalId independence, per-turn set at _process_inner.
- [ ] `convex/llm.test.ts` — EXTEND (Plan 01): recordCall traceId persistence (present/absent) + sessionCalls session-scope/archived/asc/legacy-undefined, via the hand-mirrored pure-logic + mock ctx.db pattern (no convex-test in this repo).
- [ ] `convex/runtimeIngest.test.ts` — EXTEND (Plan 01): `extractLlmCallTraceId` camelCase/snake_case/undefined, mirroring extractLlmCallGoalId.

*Existing vitest + pytest infrastructure covers all phase requirements — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live end-to-end trace: astridr emits `traceId` → `/runtime-ingest` → waterfall renders grouped bars | TRACE-01, TRACE-02 | Cross-repo live data flow; unit tests mock ingest | Plan 05 Task 2: run astridr stack, trigger a chat turn, open the session's waterfall in CodePulse, confirm bars group under one trace with cost + cache annotations |
| Legacy rows (no `traceId`) render in fallback bucket without error | TRACE-01 | Depends on pre-existing prod rows in tidy-whale-981 | Plan 05 Task 2: open a pre-Phase-94 session's waterfall; confirm graceful fallback rendering, no console errors |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 / manual-checkpoint dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (Plan 05 is the intentional manual live gate per D-05)
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned — 2026-07-06
