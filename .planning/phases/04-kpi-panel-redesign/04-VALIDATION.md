---
phase: 04
slug: kpi-panel-redesign
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-14
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 + jsdom |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/components/BackgroundSparkline.test.tsx src/components/MetricCard.test.tsx` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/components/BackgroundSparkline.test.tsx src/components/MetricCard.test.tsx`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 0 | KPI-01 | — | N/A | unit | `npx vitest run src/components/BackgroundSparkline.test.tsx` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 0 | KPI-02 | — | N/A | unit | `npx vitest run src/components/MetricCard.test.tsx` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 0 | KPI-02 | — | N/A | unit | `npx vitest run src/components/HeroStatsBar.test.tsx` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | KPI-01 | — | N/A | unit | `npx vitest run src/components/BackgroundSparkline.test.tsx` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 1 | KPI-02 | — | N/A | unit | `npx vitest run src/components/MetricCard.test.tsx` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 2 | CC-05 | — | N/A | manual | Browser visual verification | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/BackgroundSparkline.test.tsx` — stubs for KPI-01 smoke test + catmullRomPath unit tests + flatSparkline zero-division guard
- [ ] `src/components/MetricCard.test.tsx` — add thresholdTone() unit tests (covers KPI-02)
- [ ] `src/components/HeroStatsBar.test.tsx` — add data-tone attribute presence test (covers KPI-02)

**motion/react mock pattern** (established in AgentStatusTile.test.tsx):
```typescript
vi.mock("motion/react", () => ({
  motion: {
    path: ({ d, children, ...rest }: any) => <path d={d} {...rest}>{children}</path>,
    svg: ({ children, ...rest }: any) => <svg {...rest}>{children}</svg>,
  },
  useReducedMotion: () => false,
}));
```

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sparkline draw-in animation plays left-to-right ~600ms on mount | KPI-01/D-03 | CSS/Motion animation timing cannot be verified in jsdom | Open dashboard, observe tile mount animation sequence |
| Live morph animation smooth on 5s data poll | KPI-01/D-04 | JS-driven animation interpolation not testable in jsdom | Watch HeroStatsBar for 10+ seconds, confirm path transitions |
| Three-layer tone styling visible (bg/text/border opacity) | KPI-02/D-07 | OKLCH color-mix rendering requires real browser | Inspect tiles with devtools, verify 8%/15-20%/100% layers |
| Sparkline behind radial gradient (layer order correct) | D-02 | z-index visual stacking requires real renderer | Inspect tiles, confirm sparkline below radial glow |
| prefers-reduced-motion disables all animations | D-03/CC-01 | OS accessibility setting required | Toggle OS reduced-motion, reload, confirm instant render |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
