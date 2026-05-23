---
phase: 69
slug: sdk-spend-guard-multi-provider-ux
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-23
---

# Phase 69 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | GW-12 | — | N/A | unit | `npx vitest run` | TBD | pending |
| TBD | TBD | TBD | GW-13 | — | N/A | unit | `npx vitest run` | TBD | pending |
| TBD | TBD | TBD | GW-14 | — | N/A | unit | `npx vitest run` | TBD | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for SDKSpendGuard component
- [ ] Test stubs for ProviderControls component
- [ ] Test stubs for provider badge rendering
- [ ] Test stubs for 80% auto-alert rule creation

*Existing vitest infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-to-reorder provider priority | GW-13 | @dnd-kit interaction requires browser | Drag providers in Settings, verify order persists on refresh |
| WebSocket provider disable command | GW-13 | Requires live gateway connection | Toggle provider off, verify routing stops |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
