---
phase: 05
slug: usage-gauges-model-metrics
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-15
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x + @testing-library/react 16.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *Populated after planning* | | | | | | | | | |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — vitest + testing-library already installed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SVG gauge renders visually correct 270-degree arc | UG-01 | Visual appearance verification | Open Analytics page, verify gauge shape and animation |
| Model strip gradient fills are visually distinguishable | UG-02 | Color perception check | Click each segment, verify expand/collapse and color contrast |
| Provider radial gradients match brand colors | UG-03 | Visual brand color verification | Compare rendered gradients against OKLCH brand token values |
| Window bar tick marks align with time intervals | UG-04 | Visual alignment check | Switch between 1h/24h/7d presets, verify tick label granularity |
| Gauge animations are smooth on live data updates | UG-06 | Animation smoothness is subjective | Trigger Convex data changes, observe gauge transitions for jumps |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
