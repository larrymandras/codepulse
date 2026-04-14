---
phase: 07
slug: intelligence-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
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
| 07-01-01 | 01 | 1 | INT-01 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | INT-02 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 1 | INT-03 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 07-02-02 | 02 | 1 | INT-04 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 07-03-01 | 03 | 2 | INT-05 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 07-03-02 | 03 | 2 | INT-06 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 07-04-01 | 04 | 2 | INT-07 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for cost forecast computation (INT-01)
- [ ] Test stubs for session briefing generation (INT-02)
- [ ] Test stubs for daily digest generation (INT-03, INT-04)
- [ ] Test stubs for anomaly detection z-score computation (INT-05)
- [ ] Test stubs for activity changelog grouping (INT-06)
- [ ] Test stubs for memory quality metrics (INT-07)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| LLM briefing narrative quality | INT-02 | LLM output is non-deterministic | Review generated briefing for coherence and completeness |
| Daily digest content relevance | INT-03 | LLM summarization quality | Browse digests on Briefings page, verify activity coverage |
| Anomaly badge visual display | INT-05 | Visual UI verification | Trigger anomaly via test data, verify badge renders on MetricCard |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
