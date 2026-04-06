---
phase: 1
slug: ui-redesign
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 + @testing-library/react 16.3.2 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm test -- --run --reporter=verbose` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run`
- **After every plan wave:** Run `npm test -- --run --reporter=verbose`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | UI-01 | — | N/A | unit (CSS snapshot) | `npm test -- --run src/components/__tests__/theme.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | UI-02 | — | N/A | unit | `npm test -- --run src/components/__tests__/MetricCard.test.tsx` | ✅ (needs update) | ⬜ pending |
| 01-01-03 | 01 | 1 | UI-03 | — | N/A | unit | `npm test -- --run src/components/__tests__/SectionHeader.test.tsx` | ❌ W0 | ⬜ pending |
| 01-01-04 | 01 | 1 | UI-04 | — | N/A | unit | `npm test -- --run src/components/__tests__/DashboardLayout.test.tsx` | ❌ W0 | ⬜ pending |
| 01-01-05 | 01 | 1 | UI-05 | — | N/A | unit | `npm test -- --run src/components/__tests__/FlexBarChart.test.tsx` | ❌ W0 | ⬜ pending |
| 01-01-06 | 01 | 1 | UI-06 | — | N/A | unit | `npm test -- --run src/components/__tests__/EntityRow.test.tsx` | ❌ W0 | ⬜ pending |
| 01-01-07 | 01 | 1 | UI-07 | — | N/A | unit | `npm test -- --run src/components/__tests__/ActivityAnimation.test.tsx` | ❌ W0 | ⬜ pending |
| 01-01-08 | 01 | 1 | UI-08 | — | N/A | static (grep) | Manual verification during code review | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/__tests__/theme.test.ts` — stubs for UI-01 (CSS variable values, --radius: 0)
- [ ] `src/components/__tests__/SectionHeader.test.tsx` — stubs for UI-03
- [ ] `src/layouts/__tests__/DashboardLayout.test.tsx` — stubs for UI-04 (sidebar sections, Lucide icons, badges)
- [ ] `src/components/__tests__/FlexBarChart.test.tsx` — stubs for UI-05
- [ ] `src/components/__tests__/EntityRow.test.tsx` — stubs for UI-06
- [ ] `src/components/__tests__/ActivityAnimation.test.tsx` — stubs for UI-07
- [ ] Update `src/components/__tests__/MetricCard.test.tsx` — update for borderless visual, tabular-nums, Lucide trend icons

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| oklch palette visual consistency across all 15 pages | UI-01 | Visual inspection needed | Open each page, verify no stale colors |
| Activity feed slide-in animation timing/feel | UI-07 | Timing is subjective | Trigger new entries, verify animation is smooth |
| Chart drill-down UX | UI-05 | Interaction flow check | Click bar segments, verify navigation/filtering works |
