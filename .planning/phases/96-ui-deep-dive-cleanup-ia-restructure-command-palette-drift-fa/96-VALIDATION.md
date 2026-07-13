---
phase: 96
slug: ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-13
---

# Phase 96 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 + `@testing-library/react` 16.3.2, jsdom 29.1.1 |
| **Config file** | `vite.config.ts` (Vitest config colocated with Vite config) |
| **Quick run command** | `npx vitest run src/<path>/<File>.test.tsx` |
| **Full suite command** | `npm test` (Vitest); Playwright `npm run test:e2e` is separate and not required per-task |
| **Estimated runtime** | ~60 seconds (full Vitest suite) |

---

## Sampling Rate

- **After every task commit:** Run targeted `npx vitest run <file>` for the file(s) touched
- **After every plan wave:** Run `npm test` (full Vitest suite)
- **Before `/gsd:verify-work`:** Full suite green + `npx tsc --noEmit` clean (this phase touches `anyApi`/`as any` typing, so a clean type-check is a meaningful gate)
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

> Task IDs to be filled in by the planner. Rows below map phase findings → verification, per RESEARCH.md Validation Architecture.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | — | — | F2 | — | N/A | unit | `npx vitest run src/components/__tests__/CommandPalette.test.tsx` | ✅ (extend) | ⬜ pending |
| TBD | — | — | F3 | — | N/A | unit | `npx vitest run src/layouts/__tests__/DashboardLayout.test.tsx` | ✅ (extend) | ⬜ pending |
| TBD | — | — | F6 | V4 Access Control | Chat approve/reject sends `{request_id_target, decision}`; ack error surfaces a toast | unit | `npx vitest run src/pages/__tests__/Chat.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | — | — | F6 | V4 Access Control | Shared approval component behaves identically from Chat and Inbox call sites | unit/integration | new test alongside shared component | ❌ W0 | ⬜ pending |
| TBD | — | — | F1/D-01/D-02 | — | N/A | unit | `npx vitest run src/pages/__tests__/Tasks.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | — | — | F4 | — | No fabricated "Valid" badge; Automation shows computed `CRON_SCHEDULES.length` | unit | `npx vitest run src/pages/__tests__/Security.test.tsx` + `Automation.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | — | — | F5 | — | N/A | build | `npx tsc --noEmit` + existing router tests | ✅ | ⬜ pending |
| TBD | — | — | F9/D-10 | — | N/A | unit | `npx vitest run src/pages/__tests__/MeetingBot.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | — | — | F7 | — | N/A | unit | `npx vitest run src/components/__tests__/PageHeader.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/pages/__tests__/Chat.test.tsx` — covers F6 payload-shape fix + ack-error handling (zero current coverage; file with the confirmed live bug)
- [ ] `src/pages/__tests__/Tasks.test.tsx` — covers merged board (F1/D-01/D-02), highest-complexity UI change this phase
- [ ] `src/pages/__tests__/Security.test.tsx`, `src/pages/__tests__/Automation.test.tsx` — covers F4 honesty fixes (regression-guard against fabricated values returning)
- [ ] `src/pages/__tests__/MeetingBot.test.tsx` — covers F9/D-10 live-roster wiring
- [ ] `src/components/__tests__/PageHeader.test.tsx` — covers the shared component's typography contract (F7) that 31 pages depend on
- Framework install: none — Vitest/RTL/jsdom already present and configured.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Chat approval round-trip against live Ástríðr WS | F6 | Requires running astridr backend; jsdom mocks the WS layer | Start astridr + CodePulse dev, trigger an approval from Chat, confirm decision lands server-side (no 300s timeout) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
