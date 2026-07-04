---
phase: 91
slug: 3d-memory-galaxy
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-29
---

# Phase 91 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 91-RESEARCH.md §"Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x + jsdom |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run src/components/graph/` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~quick: a few s · full: existing suite |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/components/graph/` (covers CodeVaultGraph + ForceGraph3D tests)
- **After every plan wave:** Run `npm test` (full Vitest suite)
- **Before `/gsd:verify-work`:** Full suite green + SC#2 build-manifest check + SC#3 manual FPS gate
- **Max feedback latency:** < 30 seconds (quick run)

---

## Per-Task Verification Map

> Plan IDs/waves are filled by the planner; this maps each Success Criterion to its validation method. Every task touching a SC must reference the matching row.

| SC# | Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-----|-------------|----------|-----------|-------------------|-------------|--------|
| SC#1 | G3D-01 | 2D path unchanged; toggle swaps render surface; 2D→3D→2D restores `ForceGraphCanvas` | unit (jsdom) | `npx vitest run src/components/graph/CodeVaultGraph.test.tsx` | ❌ W0 (new ForceGraph3D.test.tsx) | ⬜ pending |
| SC#2 | G3D-01 | `three` isolated to its own lazy chunk; main bundle ships zero three.js | build-manifest check | `npm run build && grep -c "SphereGeometry" dist/assets/index-*.js` → expect `0` | ✅ (CI/manual step) | ⬜ pending |
| SC#3 | G3D-02 | ≥30 FPS at live ~4,038-node `graphSnapshots` snapshot | manual benchmark (gate) | DevTools Performance panel vs live snapshot — explicit pass/fail gate task | N/A (manual) | ⬜ pending |
| SC#4 | G3D-02 | WebGL context disposed on every 2D↔3D toggle (no leak); mode persists via idb-keyval | unit (disposal mock) + manual (leak) | `npx vitest run src/components/graph/ForceGraph3D.test.tsx` + DevTools Memory snapshot after 3+ toggles | ❌ W0 | ⬜ pending |
| SC#5 | G3D-02 | 3D node/link colors read from `useThemeColors()`; no hardcoded hex (except justified `#09090b` backdrop, `#27272a` dim) | unit (jsdom) | `npx vitest run src/components/graph/CodeVaultGraph.test.tsx` — assert `colorFn3D` returns `colors.primary`/`colors.vaultNode` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/graph/ForceGraph3D.test.tsx` — covers SC#1 (toggle restore), SC#4 (disposal mock), SC#5 (colorFn hex check)
- [ ] `vi.mock("react-force-graph-3d")` in the test file — mirror the existing `ForceGraphCanvas` mock pattern in `CodeVaultGraph.test.tsx`

*No new test framework or shared fixtures needed — existing Vitest setup, `useThemeColors` mock, and `ForceGraphCanvas` mock patterns are directly reusable.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ≥30 FPS at 4,038 nodes (SC#3) | G3D-02 | FPS at GPU scale cannot be asserted in jsdom; requires real WebGL + live data | Load live `graphSnapshots` payload in 3D mode, record 5s in Chrome DevTools Performance panel, confirm sustained ≥30 FPS after sim settle. Gate/checkpoint task — not shipped UI. |
| No WebGL memory leak on repeat toggle (SC#4) | G3D-02 | Requires real WebGLRenderingContext lifecycle, unavailable in jsdom | Toggle 2D↔3D 3+ times, take DevTools Memory heap snapshot, confirm no growing/orphaned `WebGLRenderingContext` and the live WebGL context count returns to baseline. |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies (SC#3 + SC#4-leak are manual gates, documented above)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`ForceGraph3D.test.tsx` + react-force-graph-3d mock)
- [ ] No watch-mode flags (use `vitest run`, not `vitest`)
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
