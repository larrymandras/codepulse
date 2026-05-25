---
phase: 68
slug: gateway-observability
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-22
---

# Phase 68 — Validation Strategy

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
| *Populated during planning* | | | GW-08, GW-09, GW-10, GW-11 | — | — | — | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Convex schema additions (3 new tables) with validators and indexes
- [ ] Test stubs for GW-08 through GW-11 requirements
- [ ] Verify existing test infrastructure covers new component patterns

*Existing vitest infrastructure covers most phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Quota gauges show live remaining capacity | GW-08 | Requires running gateway with live provider credentials | Start dev server, verify quota bars render with real data |
| Routing decisions expand with score breakdown | GW-09 | Visual verification of expandable row interaction | Click routing row, verify score sub-scores visible |
| Provider comparison chart renders correctly | GW-10 | Visual chart layout verification | Check grouped bars, colors match provider families |
| CostTrendChart per-provider stacking | GW-11 | Visual verification of stacked chart segments | Verify provider segments stack correctly in each time bucket |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
