---
phase: 02
slug: bidirectional-telemetry
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 1.x + @testing-library/react |
| **Config file** | `vitest.config.ts` (jsdom environment, globals: true) |
| **Setup file** | `src/test/setup.ts` (jest-dom matchers) |
| **Quick run command** | `npx vitest run src/hooks/useLiveState.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/hooks/useLiveState.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green + `npx tsc --noEmit` clean
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 0 | RT-03, RT-04, RT-08 | T-02-01 | Validate payload shape before setState | unit | `npx vitest run src/hooks/useLiveState.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 0 | RT-02 | T-02-02 | Auth error state visible in UI | unit | `npx vitest run src/components/ConnectionPopover.test.tsx` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | RT-03 | — | N/A | unit | `npx vitest run src/hooks/useLiveState.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | RT-04 | T-02-01 | Clear state on disconnect | unit | `npx vitest run src/hooks/useLiveState.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | RT-01, RT-05 | — | N/A | manual/e2e | Requires Ástríðr running | Deferred | ⬜ pending |
| 02-03-02 | 03 | 2 | RT-06 | — | N/A | unit (existing) | `npm test` | Partial | ⬜ pending |
| 02-04-01 | 04 | 2 | RT-07 | — | N/A | manual/e2e | Requires Ástríðr running | Deferred | ⬜ pending |
| 02-04-02 | 04 | 2 | RT-08 | — | N/A | unit | `npx vitest run src/hooks/useLiveState.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/hooks/useLiveState.test.ts` — stubs for RT-03, RT-04, RT-08. Must mock `useAstridrWS` (same pattern as useCommandCatalog)
- [ ] `src/components/ConnectionPopover.test.tsx` — covers RT-02. Renders popover in disconnected state, verifies auth error display
- [ ] No framework install needed — Vitest already configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live event delivery end-to-end | RT-01, RT-05, RT-07 | Requires running Ástríðr WebSocket server | 1. Start Ástríðr locally 2. Open CodePulse dashboard 3. Trigger events in Ástríðr 4. Verify widgets update within 1s |
| Live run transcript streaming | RT-05 | Requires active agent run | 1. Start agent run in Ástríðr 2. Open LiveRun page 3. Verify transcript events appear in real-time |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
