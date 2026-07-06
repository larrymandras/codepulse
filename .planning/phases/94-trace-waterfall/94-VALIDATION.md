---
phase: 94
slug: trace-waterfall
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-06
---

# Phase 94 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x (jsdom) |
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
| *(filled by planner — one row per task)* | | | TRACE-01 / TRACE-02 | | | unit | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `convex/runtimeIngest.test.ts` — extend with `traceId` pass-through stubs (TRACE-01), following the existing hand-mirrored pure-logic + mock `ctx.db` pattern (no convex-test library in this repo)
- [ ] `src/components/TraceWaterfall.test.tsx` — stubs for waterfall grouping/ordering/fallback-bucket rendering (TRACE-02), including the seconds-vs-milliseconds start-time conversion (`start = timestamp − latencyMs/1000`)

*Existing vitest infrastructure covers all phase requirements — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live end-to-end trace: astridr emits `traceId` → `/runtime-ingest` → waterfall renders grouped bars | TRACE-01, TRACE-02 | Cross-repo live data flow; unit tests mock ingest | Run astridr stack, trigger a chat turn, open the session's waterfall in CodePulse, confirm bars group under one trace with cost + cache annotations |
| Legacy rows (no `traceId`) render in fallback bucket without error | TRACE-01 | Depends on pre-existing prod rows in tidy-whale-981 | Open a pre-Phase-94 session's waterfall; confirm graceful fallback rendering, no console errors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
