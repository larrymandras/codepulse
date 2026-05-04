---
phase: 59
slug: rubric-inspired-observability-status-heartbeat-grid-cron-cal
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-04
---

# Phase 59 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 with @testing-library/react |
| **Config file** | None — uses Vite's default Vitest config |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run` (related test files)
- **After every plan wave:** Run `npx vitest run` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 59-01-01 | 01 | 1 | D-02 | — | N/A | unit | `npx vitest run src/components/AgentStatusTile.test.tsx` | ❌ W0 | ⬜ pending |
| 59-01-02 | 01 | 1 | D-03 | — | N/A | unit | `npx vitest run src/components/StatusHeartbeatGrid.test.tsx` | ❌ W0 | ⬜ pending |
| 59-02-01 | 02 | 1 | D-06 | — | N/A | unit | `npx vitest run src/lib/rhythmCategories.test.ts` | ❌ W0 | ⬜ pending |
| 59-03-01 | 03 | 1 | D-11 | T-59-01 | Ingest auth via validateIngestAuth() | unit | `npx vitest run convex/agentStatus.test.ts` | ❌ W0 | ⬜ pending |
| 59-03-02 | 03 | 1 | D-12 | — | N/A | unit | `npx vitest run convex/dailyRhythm.test.ts` | ❌ W0 | ⬜ pending |
| 59-03-03 | 03 | 1 | D-13 | — | N/A | unit | `npx vitest run convex/pipelineStepEvents.test.ts` | ❌ W0 | ⬜ pending |
| 59-01-03 | 01 | 1 | Idle timeout | — | N/A | unit | `npx vitest run src/components/StatusHeartbeatGrid.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/AgentStatusTile.test.tsx` — stubs for D-02 state rendering
- [ ] `src/components/StatusHeartbeatGrid.test.tsx` — stubs for D-03, idle timeout
- [ ] `src/lib/rhythmCategories.test.ts` — stubs for D-06 keyword heuristic
- [ ] `convex/agentStatus.test.ts` — stubs for D-11 ingest routing
- [ ] `convex/dailyRhythm.test.ts` — stubs for D-12 upsert/replace logic
- [ ] `convex/pipelineStepEvents.test.ts` — stubs for D-13 step event storage

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pulsing tile animation visual | D-02 | CSS animation visual quality | Open Operations page, verify green/amber pulse on active/recent tiles |
| React Flow diagram renders pipeline stages | D-09 | React Flow mocked in tests | Open Operations page with active pipeline, verify 5 stages visible |
| Calendar color coding legibility | D-06 | Visual design review | Open Operations page, verify category colors distinguishable |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
